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

    return round($total, 4);
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

        // Load System Settings
        $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']);
        $judgingSettings = (array)($settingsDoc['judging'] ?? [
            'decimalPrecision' => 2,
            'tabulationMethod' => 'standard_average',
            'tieBreakerRule' => 'highest_weight_criterion',
            'unlockPolicy' => 'admin_approval',
            'blindJudging' => true
        ]);
        $brandingSettings = (array)($settingsDoc['branding'] ?? []);
        $decimalPrecision = (int)($judgingSettings['decimalPrecision'] ?? 2);
        $tabulationMethod = $judgingSettings['tabulationMethod'] ?? 'standard_average';
        $tieBreakerRule = $judgingSettings['tieBreakerRule'] ?? 'highest_weight_criterion';
        $unlockPolicy = $judgingSettings['unlockPolicy'] ?? 'admin_approval';

        // Fetch criteria for this event
        $criteriaCursor = $criteriaCollection->find(['event_id' => $eventId], ['sort' => ['percentage' => -1, 'title' => 1]]);
        $criteria = [];
        $criteriaMap = [];
        foreach ($criteriaCursor as $doc) {
            $idStr = (string)$doc['_id'];
            $subCriteria = [];
            if (!empty($doc['sub_criteria'])) {
                foreach ($doc['sub_criteria'] as $sc) {
                    $levels = [];
                    if (!empty($sc['levels'])) {
                        for ($lvl = 5; $lvl >= 1; $lvl--) {
                            $levels[(string)$lvl] = (string)($sc['levels'][(string)$lvl] ?? ($sc['levels'][$lvl] ?? ''));
                        }
                    }
                    $subCriteria[] = [
                        'id' => (string)($sc['id'] ?? ('sub-' . bin2hex(random_bytes(3)))),
                        'name' => (string)($sc['name'] ?? ''),
                        'description' => (string)($sc['description'] ?? ''),
                        'levels' => $levels
                    ];
                }
            }

            $critData = [
                'id' => $idStr,
                'title' => $doc['title'] ?? '',
                'description' => $doc['description'] ?? '',
                'max_points' => (int)($doc['max_points'] ?? 100),
                'percentage' => (int)($doc['percentage'] ?? 0),
                'sub_criteria' => $subCriteria
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
                'description' => $doc['description'] ?? '',
                'entry_type' => $doc['entry_type'] ?? 'individual',
                'team_members' => (array)($doc['team_members'] ?? []),
                'comments' => (array)($doc['comments'] ?? [])
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
                $formattedCriteriaScores = [];
                if (!empty($s['criteria_scores'])) {
                    foreach ($s['criteria_scores'] as $cs) {
                        $sub = [];
                        if (!empty($cs['sub_scores'])) {
                            foreach ($cs['sub_scores'] as $k => $v) {
                                $sub[(string)$k] = (int)$v;
                            }
                        }
                        $formattedCriteriaScores[] = [
                            'criteria_id' => (string)($cs['criteria_id'] ?? ''),
                            'max' => (int)($cs['max'] ?? 100),
                            'score' => (float)($cs['score'] ?? 0),
                            'sub_scores' => (object)$sub
                        ];
                    }
                }
                $judgeScores[$cId] = [
                    'id' => (string)$s['_id'],
                    'contestant_id' => $cId,
                    'criteria_scores' => $formattedCriteriaScores,
                    'total_score' => (float)($s['total_score'] ?? 0),
                    'status' => $s['status'] ?? 'draft',
                    'submitted_at' => $s['submitted_at'] ?? ''
                ];
            }

            echo json_encode([
                "success" => true,
                "role" => "judge",
                "judge_id" => $userId,
                "judge_username" => $_SESSION['username'] ?? 'Judge',
                "event" => [
                    'id' => $eventId,
                    'eventName' => $event['eventName'] ?? '',
                    'status' => $event['status'] ?? 'Upcoming',
                    'judgingStatus' => $event['judgingStatus'] ?? 'Not Yet Started'
                ],
                "contestants" => $contestants,
                "criteria" => $criteria,
                "scores" => $judgeScores,
                "settings" => [
                    "judging" => $judgingSettings,
                    "branding" => $brandingSettings
                ]
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
            $formattedCriteriaScores = [];
            if (!empty($s['criteria_scores'])) {
                foreach ($s['criteria_scores'] as $cs) {
                    $sub = [];
                    if (!empty($cs['sub_scores'])) {
                        foreach ($cs['sub_scores'] as $k => $v) {
                            $sub[(string)$k] = (int)$v;
                        }
                    }
                    $formattedCriteriaScores[] = [
                        'criteria_id' => (string)($cs['criteria_id'] ?? ''),
                        'max' => (int)($cs['max'] ?? 100),
                        'score' => (float)($cs['score'] ?? 0),
                        'sub_scores' => (object)$sub
                    ];
                }
            }
            $scoreData = [
                'id' => (string)$s['_id'],
                'contestant_id' => $cId,
                'judge_id' => $jId,
                'criteria_scores' => $formattedCriteriaScores,
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
            $submittedScoresList = [];
            $submittedSum = 0.0;
            $submittedCount = 0;
            $critScoresSum = []; // For tie-breaking: sum per criteria_id across judges

            foreach ($judges as $j) {
                $jId = $j['id'];
                $key = "{$cId}_{$jId}";
                if (isset($scoresByContestantJudge[$key])) {
                    $entry = $scoresByContestantJudge[$key];
                    $judgeEntries[$jId] = $entry;
                    if ($entry['status'] === 'submitted') {
                        $sVal = (float)$entry['total_score'];
                        $submittedSum += $sVal;
                        $submittedScoresList[] = $sVal;
                        $submittedCount++;
                        $totalSubmittedEntries++;

                        // Sum per criterion
                        if (!empty($entry['criteria_scores'])) {
                            foreach ($entry['criteria_scores'] as $cs) {
                                $crId = (string)($cs['criteria_id'] ?? '');
                                $critScoresSum[$crId] = ($critScoresSum[$crId] ?? 0.0) + (float)($cs['score'] ?? 0);
                            }
                        }
                    }
                } else {
                    $judgeEntries[$jId] = [
                        'status' => 'pending',
                        'total_score' => null
                    ];
                }
            }

            // Tabulation Algorithm: Standard Average vs Olympic Trimming
            $isTrimmed = false;
            $avgScore = 0.0;
            if ($tabulationMethod === 'olympic_trimming' && count($submittedScoresList) >= 3) {
                $tempScores = $submittedScoresList;
                sort($tempScores);
                // Drop highest and lowest score
                $trimmed = array_slice($tempScores, 1, -1);
                $avgScore = round(array_sum($trimmed) / count($trimmed), $decimalPrecision);
                $isTrimmed = true;
            } else {
                $avgScore = $submittedCount > 0 ? round($submittedSum / $submittedCount, $decimalPrecision) : 0.0;
            }

            $matrix[] = [
                'contestant_id' => $cId,
                'contestant_number' => $c['contestant_number'],
                'name' => $c['name'],
                'department_or_org' => $c['department_or_org'],
                'description' => $c['description'],
                'entry_type' => $c['entry_type'] ?? 'individual',
                'team_members' => $c['team_members'] ?? [],
                'comments' => $c['comments'] ?? [],
                'judge_scores' => $judgeEntries,
                'submitted_count' => $submittedCount,
                'total_score' => round($submittedSum, $decimalPrecision),
                'average_score' => $avgScore,
                'is_olympic_trimmed' => $isTrimmed,
                'crit_scores_sum' => $critScoresSum
            ];
        }

        // Handle Ordinal Ranking if selected:
        if ($tabulationMethod === 'ordinal_ranking' && count($judges) > 0) {
            $rankSums = [];
            foreach ($judges as $j) {
                $jId = $j['id'];
                $judgeContestantScores = [];
                foreach ($matrix as $row) {
                    $entry = $row['judge_scores'][$jId] ?? null;
                    if ($entry && $entry['status'] === 'submitted') {
                        $judgeContestantScores[] = [
                            'contestant_id' => $row['contestant_id'],
                            'score' => (float)$entry['total_score']
                        ];
                    }
                }
                usort($judgeContestantScores, function($a, $b) {
                    return ($b['score'] > $a['score']) ? 1 : -1;
                });
                for ($r = 0; $r < count($judgeContestantScores); $r++) {
                    $cid = $judgeContestantScores[$r]['contestant_id'];
                    $rankSums[$cid] = ($rankSums[$cid] ?? 0) + ($r + 1);
                }
            }
            foreach ($matrix as &$row) {
                $cid = $row['contestant_id'];
                $row['rank_sum'] = $rankSums[$cid] ?? 999;
            }
            unset($row);

            usort($matrix, function($a, $b) {
                if ($a['rank_sum'] == $b['rank_sum']) {
                    return ($b['average_score'] > $a['average_score']) ? 1 : -1;
                }
                return ($a['rank_sum'] > $b['rank_sum']) ? 1 : -1;
            });
        } else {
            // Sort matrix by average_score desc with Tie-breaker rule!
            usort($matrix, function($a, $b) use ($tieBreakerRule, $criteria) {
                if ($b['average_score'] == $a['average_score']) {
                    if ($tieBreakerRule === 'highest_weight_criterion' && !empty($criteria)) {
                        $topCritId = (string)($criteria[0]['id'] ?? '');
                        $critScoreA = (float)($a['crit_scores_sum'][$topCritId] ?? 0);
                        $critScoreB = (float)($b['crit_scores_sum'][$topCritId] ?? 0);
                        if ($critScoreB != $critScoreA) {
                            return ($critScoreB > $critScoreA) ? 1 : -1;
                        }
                    }
                    return $a['contestant_number'] - $b['contestant_number'];
                }
                return ($b['average_score'] > $a['average_score']) ? 1 : -1;
            });
        }

        // Assign ranks (with tie-handling)
        $rank = 1;
        for ($i = 0; $i < count($matrix); $i++) {
            if ($matrix[$i]['submitted_count'] === 0) {
                $matrix[$i]['rank'] = '-';
            } else {
                $isTied = false;
                if ($i > 0) {
                    if ($tabulationMethod === 'ordinal_ranking') {
                        $isTied = ($matrix[$i]['rank_sum'] === $matrix[$i - 1]['rank_sum'] && $matrix[$i]['average_score'] === $matrix[$i - 1]['average_score']);
                    } else {
                        $isTied = ($matrix[$i]['average_score'] === $matrix[$i - 1]['average_score']);
                    }
                }

                if ($isTied) {
                    $matrix[$i]['rank'] = $matrix[$i - 1]['rank'];
                    $matrix[$i]['is_tie'] = true;
                    $matrix[$i - 1]['is_tie'] = true;
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
            "settings" => [
                "judging" => $judgingSettings,
                "branding" => $brandingSettings
            ],
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
    if ($role !== 'judge' && $role !== 'admin' && $role !== 'tabulator') {
        echo json_encode(["success" => false, "message" => "Unauthorized access."]);
        exit;
    }

    $rawJson = file_get_contents("php://input");
    $data = json_decode($rawJson, true);
    if (!$data) {
        echo json_encode(["success" => false, "message" => "Invalid JSON payload."]);
        exit;
    }

    $action = trim($data['action'] ?? 'submit'); // 'draft', 'submit', or 'unlock_score'

    // ---------------------------------------------------------
    // ACTION: UNLOCK SCORE (Admin or Tabulator only)
    // ---------------------------------------------------------
    if ($action === 'unlock_score') {
        if ($role !== 'admin' && $role !== 'tabulator') {
            echo json_encode(["success" => false, "message" => "Only administrators or tabulators can unlock submitted scores."]);
            exit;
        }

        $eventId = (int)($data['event_id'] ?? 0);
        $contestantId = trim($data['contestant_id'] ?? '');
        $targetJudgeId = trim($data['judge_id'] ?? '');

        if ($eventId <= 0 || $contestantId === '' || $targetJudgeId === '') {
            echo json_encode(["success" => false, "message" => "Event ID, Contestant ID, and Judge ID are required to unlock score."]);
            exit;
        }

        try {
            $existing = $scoresCollection->findOne([
                'event_id' => $eventId,
                'contestant_id' => $contestantId,
                'judge_id' => $targetJudgeId
            ]);

            if (!$existing) {
                echo json_encode(["success" => false, "message" => "No score record found to unlock."]);
                exit;
            }

            $nowStr = (new DateTime())->format('Y-m-d H:i:s');
            $scoresCollection->updateOne(
                [
                    'event_id' => $eventId,
                    'contestant_id' => $contestantId,
                    'judge_id' => $targetJudgeId
                ],
                [
                    '$set' => [
                        'status' => 'draft',
                        'unlocked_at' => $nowStr,
                        'unlocked_by' => $_SESSION['username'] ?? 'Admin'
                    ]
                ]
            );

            $contestant = $contestantsCollection->findOne(['_id' => $contestantId]);
            $cName = $contestant ? ($contestant['name'] ?? "Contestant {$contestantId}") : "Contestant {$contestantId}";
            $judgeUser = $usersCollection->findOne(['_id' => $targetJudgeId]);
            $jName = $judgeUser ? ($judgeUser['username'] ?? $targetJudgeId) : $targetJudgeId;
            $eventDoc = $eventsCollection->findOne(['_id' => $eventId]);
            $evName = $eventDoc ? ($eventDoc['eventName'] ?? "Event #{$eventId}") : "Event #{$eventId}";

            logSystemAction(
                $userId,
                $_SESSION['username'] ?? 'System',
                $role,
                'UNLOCK_SCORE',
                "Unlocked submitted score for {$cName} from Judge {$jName} in '{$evName}'."
            );

            // Send notification to judge
            $notificationsCollection->insertOne([
                'user_id' => $targetJudgeId,
                'type' => 'score_unlocked',
                'title' => 'Score Unlocked for Editing',
                'message' => "Your submitted score for {$cName} in '{$evName}' was unlocked by {$_SESSION['username']}. You may now revise and resubmit your score.",
                'event_id' => $eventId,
                'role' => 'judge',
                'is_read' => false,
                'created_at' => new MongoDB\BSON\UTCDateTime()
            ]);

            echo json_encode([
                "success" => true,
                "message" => "Score successfully unlocked! Judge {$jName} may now edit and resubmit.",
                "unlocked" => [
                    'event_id' => $eventId,
                    'contestant_id' => $contestantId,
                    'judge_id' => $targetJudgeId,
                    'status' => 'draft'
                ]
            ]);
            exit;
        } catch (Throwable $e) {
            echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
            exit;
        }
    }

    // Normal Score Entry (Judge or Admin only)
    if ($role !== 'judge' && $role !== 'admin') {
        echo json_encode(["success" => false, "message" => "Only designated judges can enter scores."]);
        exit;
    }

    $eventId = (int)($data['event_id'] ?? 0);
    $contestantId = trim($data['contestant_id'] ?? '');
    $criteriaScores = $data['criteria_scores'] ?? []; // Array of [{criteria_id, max, score}]
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
                'percentage' => (int)($doc['percentage'] ?? 0),
                'sub_criteria' => (array)($doc['sub_criteria'] ?? [])
            ];
        }

        // Sanitize criteria scores
        $cleanedScores = [];
        foreach ($criteriaScores as $cs) {
            $critId = (string)($cs['criteria_id'] ?? '');
            $maxPts = isset($criteriaMap[$critId]) ? (float)$criteriaMap[$critId]['max_points'] : (float)($cs['max'] ?? 100);
            $scorePts = (float)($cs['score'] ?? 0);
            $subScores = isset($cs['sub_scores']) && (is_array($cs['sub_scores']) || is_object($cs['sub_scores'])) ? (array)$cs['sub_scores'] : [];

            // If sub_scores are present and criterion has sub_criteria, calculate score accurately from 5-to-1 ratings
            if (!empty($subScores) && !empty($criteriaMap[$critId]['sub_criteria'])) {
                $subCriteria = (array)$criteriaMap[$critId]['sub_criteria'];
                $subTotal = 0;
                $validSubScores = [];
                foreach ($subCriteria as $sc) {
                    $scId = (string)($sc['id'] ?? '');
                    if ($scId === '') continue;
                    $rating = isset($subScores[$scId]) ? (int)$subScores[$scId] : 0;
                    if ($rating < 1) $rating = 1;
                    if ($rating > 5) $rating = 5;
                    $validSubScores[$scId] = $rating;
                    $subTotal += $rating;
                }
                $maxPossibleRating = count($subCriteria) * 5;
                if ($maxPossibleRating > 0) {
                    $scorePts = ($subTotal / $maxPossibleRating) * $maxPts;
                }
                $subScores = $validSubScores;
            }

            if ($scorePts < 0) $scorePts = 0;
            if ($scorePts > $maxPts) $scorePts = $maxPts;

            $scoreEntry = [
                'criteria_id' => $critId,
                'max' => (int)$maxPts,
                'score' => round($scorePts, 2)
            ];
            if (!empty($subScores)) {
                $scoreEntry['sub_scores'] = (object)$subScores;
            }

            $cleanedScores[] = $scoreEntry;
        }

        $totalScore = calculateTotalScore($cleanedScores, $criteriaMap);

        // Check if score record already exists for this judge + contestant
        $existingScore = $scoresCollection->findOne([
            'event_id' => $eventId,
            'judge_id' => $userId,
            'contestant_id' => $contestantId
        ]);

        // Enforce lock policy if existing score was already submitted
        if ($role === 'judge' && $existingScore && ($existingScore['status'] ?? '') === 'submitted') {
            $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']);
            $unlockPolicy = $settingsDoc['judging']['unlockPolicy'] ?? 'admin_approval';

            if ($unlockPolicy === 'locked_after_submit') {
                echo json_encode([
                    "success" => false,
                    "message" => "This score is finalized and strictly locked. Edits are not allowed per system policy."
                ]);
                exit;
            } else if ($unlockPolicy === 'admin_approval') {
                echo json_encode([
                    "success" => false,
                    "message" => "This score has already been submitted and locked. Please ask an Administrator or Tabulator to unlock it from the Tabulation Board."
                ]);
                exit;
            }
        }

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
