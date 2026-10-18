<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "Authentication required."]);
    exit;
}

require_once __DIR__ . "/../database/config.php";
require_once __DIR__ . "/../utils/logger.php";

$method = $_SERVER['REQUEST_METHOD'];
$role = strtolower($_SESSION['role'] ?? '');
$userId = (string)$_SESSION['user_id'];

// Helper function to calculate total weighted score
function calculateTotalScore($criteriaScores, $criteriaMap) {
    $hasPercentages = false;
    foreach ($criteriaMap as $c) {
        if (!empty($c['percentage']) && (int)$c['percentage'] > 0) {
            $hasPercentages = true;
            break;
        }
    }

    $total = 0.0;
    if ($hasPercentages) {
        foreach ($criteriaScores as $cs) {
            $critId = (string)($cs['criteria_id'] ?? '');
            $score = (float)($cs['score'] ?? 0);
            $max = (float)($cs['max'] ?? 100);
            if ($max <= 0) $max = 100.0;

            $pct = isset($criteriaMap[$critId]) ? (float)$criteriaMap[$critId]['percentage'] : 0.0;
            $weighted = ($score / $max) * $pct;
            $total += $weighted;
        }
    } else {
        foreach ($criteriaScores as $cs) {
            $total += (float)($cs['score'] ?? 0);
        }
    }

    return round($total, 2);
}

// -------------------------------------------------------------
// GET: Retrieve scores
// -------------------------------------------------------------
if ($method === "GET") {
    $eventId = (int)($_GET['event_id'] ?? 0);
    if ($eventId <= 0) {
        echo json_encode(["success" => false, "message" => "Valid event_id is required."]);
        exit;
    }

    try {
        $event = $eventsCollection->findOne(['_id' => $eventId]);
        if (!$event) {
            echo json_encode(["success" => false, "message" => "Event not found."]);
            exit;
        }

        // Fetch criteria for this event
        $criteriaCursor = $criteriaCollection->find(['event_id' => $eventId]);
        $criteria = [];
        $criteriaMap = [];
        foreach ($criteriaCursor as $doc) {
            $idStr = (string)$doc['_id'];
            $critData = [
                'id' => $idStr,
                'title' => $doc['title'] ?? '',
                'description' => $doc['description'] ?? '',
                'max_points' => (int)($doc['max_points'] ?? 100),
                'percentage' => (int)($doc['percentage'] ?? 0)
            ];
            $criteria[] = $critData;
            $criteriaMap[$idStr] = $critData;
        }

        // Fetch contestants for this event
        $contestantsCursor = $contestantsCollection->find(
            ['event_id' => $eventId],
            ['sort' => ['contestant_number' => 1]]
        );
        $contestants = [];
        foreach ($contestantsCursor as $doc) {
            $contestants[] = [
                'id' => (string)$doc['_id'],
                'contestant_number' => (int)($doc['contestant_number'] ?? 0),
                'name' => $doc['name'] ?? '',
                'department_or_org' => $doc['department_or_org'] ?? '',
                'description' => $doc['description'] ?? ''
            ];
        }

        // If user is a Judge: return only their own scores + contestants + criteria
        if ($role === 'judge') {
            $scoresCursor = $scoresCollection->find([
                'event_id' => $eventId,
                'judge_id' => $userId
            ]);

            $judgeScores = [];
            foreach ($scoresCursor as $s) {
                $cId = (string)($s['contestant_id'] ?? '');
                $judgeScores[$cId] = [
                    'id' => (string)$s['_id'],
                    'contestant_id' => $cId,
                    'criteria_scores' => (array)($s['criteria_scores'] ?? []),
                    'total_score' => (float)($s['total_score'] ?? 0),
                    'status' => $s['status'] ?? 'draft',
                    'submitted_at' => $s['submitted_at'] ?? ''
                ];
            }

            echo json_encode([
                "success" => true,
                "role" => "judge",
                "event" => [
                    'id' => $eventId,
                    'eventName' => $event['eventName'] ?? '',
                    'status' => $event['status'] ?? 'Upcoming',
                    'judgingStatus' => $event['judgingStatus'] ?? 'Not Yet Started'
                ],
                "contestants" => $contestants,
                "criteria" => $criteria,
                "scores" => $judgeScores
            ]);
            exit;
        }

        // If user is Admin or Tabulator: return full tabulation matrix!
        // 1. Get assigned judges details
        $assignedJudgeIds = (array)($event['assignedjudges'] ?? []);
        $judges = [];
        foreach ($assignedJudgeIds as $jId) {
            $jObjId = $jId instanceof MongoDB\BSON\ObjectId ? $jId : new MongoDB\BSON\ObjectId((string)$jId);
            $u = $usersCollection->findOne(['_id' => $jObjId]);
            if ($u) {
                $judges[] = [
                    'id' => (string)$u['_id'],
                    'username' => $u['username'] ?? 'Judge',
                    'email' => $u['email'] ?? ''
                ];
            }
        }

        // 2. Fetch all scores for this event
        $scoresCursor = $scoresCollection->find(['event_id' => $eventId]);
        $allScores = [];
        $scoresByContestantJudge = []; // ["contestantId_judgeId"] => scoreDoc
        foreach ($scoresCursor as $s) {
            $cId = (string)($s['contestant_id'] ?? '');
            $jId = (string)($s['judge_id'] ?? '');
            $scoreData = [
                'id' => (string)$s['_id'],
                'contestant_id' => $cId,
                'judge_id' => $jId,
                'criteria_scores' => (array)($s['criteria_scores'] ?? []),
                'total_score' => (float)($s['total_score'] ?? 0),
                'status' => $s['status'] ?? 'draft',
                'submitted_at' => $s['submitted_at'] ?? ''
            ];
            $allScores[] = $scoreData;
            $scoresByContestantJudge["{$cId}_{$jId}"] = $scoreData;
        }

        // 3. Build Matrix & Calculate Rankings
        $matrix = [];
        $totalSubmittedEntries = 0;
        foreach ($contestants as $c) {
            $cId = $c['id'];
            $judgeEntries = [];
            $submittedSum = 0.0;
            $submittedCount = 0;

            foreach ($judges as $j) {
                $jId = $j['id'];
                $key = "{$cId}_{$jId}";
                if (isset($scoresByContestantJudge[$key])) {
                    $entry = $scoresByContestantJudge[$key];
                    $judgeEntries[$jId] = $entry;
                    if ($entry['status'] === 'submitted') {
                        $submittedSum += (float)$entry['total_score'];
                        $submittedCount++;
                        $totalSubmittedEntries++;
                    }
                } else {
                    $judgeEntries[$jId] = [
                        'status' => 'pending',
                        'total_score' => null
                    ];
                }
            }

            $avgScore = $submittedCount > 0 ? round($submittedSum / $submittedCount, 2) : 0.0;

            $matrix[] = [
                'contestant_id' => $cId,
                'contestant_number' => $c['contestant_number'],
                'name' => $c['name'],
                'department_or_org' => $c['department_or_org'],
                'description' => $c['description'],
                'judge_scores' => $judgeEntries,
                'submitted_count' => $submittedCount,
                'total_score' => round($submittedSum, 2),
                'average_score' => $avgScore
            ];
        }

        // Sort matrix by average_score desc to assign ranks
        usort($matrix, function($a, $b) {
            if ($b['average_score'] == $a['average_score']) {
                return $a['contestant_number'] - $b['contestant_number'];
            }
            return ($b['average_score'] > $a['average_score']) ? 1 : -1;
        });

        // Assign ranks (with tie-handling)
        $rank = 1;
        for ($i = 0; $i < count($matrix); $i++) {
            if ($matrix[$i]['submitted_count'] === 0) {
                $matrix[$i]['rank'] = '-';
            } else {
                if ($i > 0 && $matrix[$i]['average_score'] === $matrix[$i - 1]['average_score']) {
                    $matrix[$i]['rank'] = $matrix[$i - 1]['rank'];
                } else {
                    $matrix[$i]['rank'] = $rank;
                }
                $rank++;
            }
        }

        $totalExpectedEntries = count($contestants) * count($judges);

        echo json_encode([
            "success" => true,
            "role" => $role,
            "event" => [
                'id' => $eventId,
                'eventName' => $event['eventName'] ?? '',
                'status' => $event['status'] ?? 'Upcoming',
                'judgingStatus' => $event['judgingStatus'] ?? 'Not Yet Started'
            ],
            "judges" => $judges,
            "criteria" => $criteria,
            "contestants" => $contestants,
            "matrix" => $matrix,
            "stats" => [
                'total_contestants' => count($contestants),
                'total_judges' => count($judges),
                'total_submitted' => $totalSubmittedEntries,
                'total_expected' => $totalExpectedEntries,
                'is_completed' => ($totalExpectedEntries > 0 && $totalSubmittedEntries >= $totalExpectedEntries)
            ]
        ]);
        exit;

    } catch (Throwable $e) {
        echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
        exit;
    }
}

// -------------------------------------------------------------
// POST: Enter, Save Draft, or Submit Scores (Judge only, or Admin)
// -------------------------------------------------------------
if ($method === "POST") {
    if ($role !== 'judge' && $role !== 'admin') {
        echo json_encode(["success" => false, "message" => "Only designated judges can enter scores."]);
        exit;
    }

    $rawJson = file_get_contents("php://input");
    $data = json_decode($rawJson, true);
    if (!$data) {
        echo json_encode(["success" => false, "message" => "Invalid JSON payload."]);
        exit;
    }

    $eventId = (int)($data['event_id'] ?? 0);
    $contestantId = trim($data['contestant_id'] ?? '');
    $criteriaScores = $data['criteria_scores'] ?? []; // Array of [{criteria_id, max, score}]
    $action = trim($data['action'] ?? 'submit'); // 'draft' or 'submit'
    $status = ($action === 'draft') ? 'draft' : 'submitted';

    if ($eventId <= 0 || $contestantId === '' || !is_array($criteriaScores)) {
        echo json_encode(["success" => false, "message" => "Event ID, Contestant ID, and criteria scores are required."]);
        exit;
    }

    try {
        $event = $eventsCollection->findOne(['_id' => $eventId]);
        if (!$event) {
            echo json_encode(["success" => false, "message" => "Event not found."]);
            exit;
        }

        // Verify judging period is active
        $judgingStatus = $event['judgingStatus'] ?? 'Not Yet Started';
        if ($judgingStatus !== 'In Progress' && $role !== 'admin') {
            echo json_encode([
                "success" => false,
                "message" => "Scoring is currently inactive. Judging state: '{$judgingStatus}'. Only administrators can start the judging period."
            ]);
            exit;
        }

        // Verify that the judge is assigned to this event
        if ($role === 'judge') {
            $assignedJudges = (array)($event['assignedjudges'] ?? []);
            $isAssigned = false;
            foreach ($assignedJudges as $aj) {
                if ((string)$aj === $userId) {
                    $isAssigned = true;
                    break;
                }
            }
            if (!$isAssigned) {
                echo json_encode(["success" => false, "message" => "You are not assigned as an official judge for this competition."]);
                exit;
            }
        }

        // Fetch criteria for calculation
        $criteriaCursor = $criteriaCollection->find(['event_id' => $eventId]);
        $criteriaMap = [];
        foreach ($criteriaCursor as $doc) {
            $criteriaMap[(string)$doc['_id']] = [
                'title' => $doc['title'] ?? '',
                'max_points' => (int)($doc['max_points'] ?? 100),
                'percentage' => (int)($doc['percentage'] ?? 0)
            ];
        }

        // Sanitize criteria scores
        $cleanedScores = [];
        foreach ($criteriaScores as $cs) {
            $critId = (string)($cs['criteria_id'] ?? '');
            $maxPts = isset($criteriaMap[$critId]) ? (float)$criteriaMap[$critId]['max_points'] : (float)($cs['max'] ?? 100);
            $scorePts = (float)($cs['score'] ?? 0);

            if ($scorePts < 0) $scorePts = 0;
            if ($scorePts > $maxPts) $scorePts = $maxPts;

            $cleanedScores[] = [
                'criteria_id' => $critId,
                'max' => (int)$maxPts,
                'score' => round($scorePts, 2)
            ];
        }

        $totalScore = calculateTotalScore($cleanedScores, $criteriaMap);

        // Check if score record already exists for this judge + contestant
        $existingScore = $scoresCollection->findOne([
            'event_id' => $eventId,
            'judge_id' => $userId,
            'contestant_id' => $contestantId
        ]);

        $nowStr = (new DateTime())->format('Y-m-d H:i:s');
        $scoreId = $existingScore ? (string)$existingScore['_id'] : ("score-" . bin2hex(random_bytes(6)));

        $docToSet = [
            'event_id' => $eventId,
            'judge_id' => $userId,
            'contestant_id' => $contestantId,
            'criteria_scores' => $cleanedScores,
            'total_score' => $totalScore,
            'status' => $status,
            'submitted_at' => $nowStr
        ];

        $scoresCollection->updateOne(
            [
                'event_id' => $eventId,
                'judge_id' => $userId,
                'contestant_id' => $contestantId
            ],
            [
                '$set' => $docToSet,
                '$setOnInsert' => ['_id' => $scoreId]
            ],
            ['upsert' => true]
        );

        $contestant = $contestantsCollection->findOne(['_id' => $contestantId]);
        $contestantName = $contestant ? ($contestant['name'] . " (#" . $contestant['contestant_number'] . ")") : "Contestant {$contestantId}";

        logSystemAction(
            $userId,
            $_SESSION['username'],
            $_SESSION['role'],
            $status === 'submitted' ? 'SUBMIT_SCORE' : 'SAVE_DRAFT_SCORE',
            ($status === 'submitted' ? "Submitted final score ({$totalScore} pts)" : "Saved draft score ({$totalScore} pts)") . " for {$contestantName} in '{$event['eventName']}'."
        );

        // If submitted: notify tabulators for real-time tracking
        if ($status === 'submitted') {
            $tabulators = (array)($event['tabulators'] ?? []);
            foreach ($tabulators as $tId) {
                $notificationsCollection->insertOne([
                    'user_id' => $tId,
                    'type' => 'score_submitted',
                    'title' => 'Score Submitted',
                    'message' => "Judge {$_SESSION['username']} submitted a score of {$totalScore} for {$contestantName}.",
                    'event_id' => $eventId,
                    'role' => 'tabulator',
                    'is_read' => false,
                    'created_at' => new MongoDB\BSON\UTCDateTime()
                ]);
            }
        }

        echo json_encode([
            "success" => true,
            "message" => $status === 'submitted' ? "Score submitted successfully!" : "Draft score saved.",
            "score" => [
                'id' => $scoreId,
                'contestant_id' => $contestantId,
                'total_score' => $totalScore,
                'status' => $status,
                'submitted_at' => $nowStr
            ]
        ]);
        exit;

    } catch (Throwable $e) {
        echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
        exit;
    }
}

echo json_encode(["success" => false, "message" => "Method not allowed."]);
exit;
