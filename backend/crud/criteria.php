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

// GET: Retrieve criteria for an event (available to Admin, Judge, and Tabulator)
if ($method === "GET") {
    $eventId = (int)($_GET['event_id'] ?? 0);
    if ($eventId <= 0) {
        echo json_encode(["success" => false, "message" => "Valid event_id is required."]);
        exit;
    }

    try {
        $cursor = $criteriaCollection->find(['event_id' => $eventId], ['sort' => ['percentage' => -1, 'title' => 1]]);

        $criteria = [];
        $totalWeight = 0;
        foreach ($cursor as $doc) {
            $idStr = (string)$doc['_id'];
            $pct = (int)($doc['percentage'] ?? 0);
            $totalWeight += $pct;
            $maxPoints = (int)($doc['max_points'] ?? 100);

            $scoringType = trim($doc['scoring_type'] ?? '');
            if ($scoringType !== 'rubric' && $scoringType !== 'category') {
                if (!empty($doc['scoring_categories'])) {
                    $scoringType = 'category';
                } else {
                    $scoringType = 'rubric';
                }
            }

            $rubricRatings = [];
            if ($scoringType === 'rubric') {
                if (!empty($doc['rubric_ratings'])) {
                    $rubricRatings = sanitizeRubricRatings($doc['rubric_ratings'], $maxPoints);
                } else {
                    $rubricRatings = getDefaultRubricRatings($maxPoints);
                }
            }

            $minPoints = (float)($doc['min_points'] ?? 0.0);
            $scoreStep = (float)($doc['score_step'] ?? 0.5);
            $instructions = (string)($doc['instructions'] ?? '');

            $scoringCategories = [];
            if ($scoringType === 'category') {
                if (!empty($doc['scoring_categories'])) {
                    $scoringCategories = sanitizeScoringCategories($doc['scoring_categories'], $maxPoints, true);
                } else {
                    $scoringCategories = getDefaultScoringCategories($maxPoints);
                }
            } elseif (!empty($doc['scoring_categories'])) {
                $scoringCategories = sanitizeScoringCategories($doc['scoring_categories'], $maxPoints, false);
            }

            $criteria[] = [
                'id' => $idStr,
                'title' => $doc['title'] ?? '',
                'description' => $doc['description'] ?? '',
                'event_id' => (int)($doc['event_id'] ?? $eventId),
                'scoring_type' => $scoringType,
                'min_points' => $minPoints,
                'max_points' => $maxPoints,
                'score_step' => $scoreStep,
                'instructions' => $instructions,
                'percentage' => $pct,
                'rubric_ratings' => $rubricRatings,
                'scoring_categories' => $scoringCategories,
                'sub_criteria' => [],
                'created_at' => isset($doc['created_at']) ? (string)$doc['created_at'] : ''
            ];
        }

        echo json_encode([
            "success" => true,
            "criteria" => $criteria,
            "total_weight" => $totalWeight
        ]);
        exit;
    } catch (Throwable $e) {
        echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
        exit;
    }
}

// Helper to provide default predefined rubric ratings scaled to maxPoints
function getDefaultRubricRatings($maxPoints) {
    $maxPts = (float)$maxPoints;
    if ($maxPts <= 0) $maxPts = 100.0;

    return [
        [
            'id' => 'rating-1',
            'name' => 'Excellent / Outstanding',
            'score' => round($maxPts * 1.0, 2),
            'description' => 'Exemplary performance, flawless execution, and superior technical mastery.'
        ],
        [
            'id' => 'rating-2',
            'name' => 'Very Good / Proficient',
            'score' => round($maxPts * 0.75, 2),
            'description' => 'High-level proficiency with solid technique and only minor, isolated errors.'
        ],
        [
            'id' => 'rating-3',
            'name' => 'Good / Competent',
            'score' => round($maxPts * 0.50, 2),
            'description' => 'Meets standard expectations; demonstrated ability with noticeable room for improvement.'
        ],
        [
            'id' => 'rating-4',
            'name' => 'Fair / Needs Improvement',
            'score' => round($maxPts * 0.25, 2),
            'description' => 'Below standard; frequent inconsistencies, technical flaws, or lack of refinement.'
        ]
    ];
}

// Helper to sanitize predefined rubric ratings array
function sanitizeRubricRatings($rawRatings, &$maxPoints) {
    if ($rawRatings instanceof Traversable) {
        $rawRatings = iterator_to_array($rawRatings);
    } elseif (is_object($rawRatings)) {
        $rawRatings = (array)$rawRatings;
    }

    if (!is_array($rawRatings) || empty($rawRatings)) {
        return getDefaultRubricRatings($maxPoints);
    }

    $sanitized = [];
    $highestScore = 0.0;
    foreach ($rawRatings as $idx => $r) {
        if ($r instanceof Traversable) {
            $r = iterator_to_array($r);
        } elseif (is_object($r)) {
            $r = (array)$r;
        }

        $name = trim($r['name'] ?? '');
        if ($name === '') {
            $name = 'Rating Tier ' . ($idx + 1);
        }
        $id = trim($r['id'] ?? ('rating-' . ($idx + 1) . '-' . bin2hex(random_bytes(2))));
        $desc = trim($r['description'] ?? '');
        $score = (float)($r['score'] ?? 0);
        if ($score < 0) $score = 0;

        if ($score > $highestScore) {
            $highestScore = $score;
        }

        $sanitized[] = [
            'id' => $id,
            'name' => $name,
            'score' => round($score, 2),
            'description' => $desc
        ];
    }

    if (empty($sanitized)) {
        return getDefaultRubricRatings($maxPoints);
    }

    // Sort descending by score
    usort($sanitized, function($a, $b) {
        if ($a['score'] === $b['score']) return 0;
        return ($a['score'] < $b['score']) ? 1 : -1;
    });

    if ($highestScore > 0) {
        $maxPoints = (int)ceil($highestScore);
    }

    return $sanitized;
}

// Helper to provide default scoring categories scaled to maxPoints
function getDefaultScoringCategories($maxPoints = 30) {
    $maxPts = (float)$maxPoints;
    if ($maxPts <= 0) $maxPts = 30.0;
    $count = 3;
    $perCat = round($maxPts / $count, 2);

    return [
        [
            'id' => 'cat-1',
            'name' => 'Stance uniqueness',
            'description' => 'Beautiful stance, stability, and posture.',
            'points' => $perCat
        ],
        [
            'id' => 'cat-2',
            'name' => 'Pose preference',
            'description' => 'Wonderful preference, angle, and dynamic execution.',
            'points' => $perCat
        ],
        [
            'id' => 'cat-3',
            'name' => 'Crowd impact',
            'description' => 'Crowds shout continuously; overall audience engagement and energy.',
            'points' => round($maxPts - ($perCat * 2), 2)
        ]
    ];
}

// Helper to sanitize customizable scoring categories array
function sanitizeScoringCategories($rawCategories, &$maxPoints, $isCategoryDriven = false) {
    if ($rawCategories instanceof Traversable) {
        $rawCategories = iterator_to_array($rawCategories);
    } elseif (is_object($rawCategories)) {
        $rawCategories = (array)$rawCategories;
    }

    if (!is_array($rawCategories) || empty($rawCategories)) {
        return getDefaultScoringCategories($maxPoints);
    }

    $sanitized = [];
    $totalCatPts = 0.0;
    foreach ($rawCategories as $index => $cat) {
        if ($cat instanceof Traversable) {
            $cat = iterator_to_array($cat);
        } elseif (is_object($cat)) {
            $cat = (array)$cat;
        }

        $name = trim($cat['name'] ?? '');
        if ($name === '') {
            $name = 'Score Category ' . ($index + 1);
        }
        $id = trim($cat['id'] ?? ('cat-' . ($index + 1) . '-' . bin2hex(random_bytes(2))));
        $desc = trim($cat['description'] ?? '');
        $pts = (float)($cat['points'] ?? 0);
        if ($pts < 0) $pts = 0;

        $sanitized[] = [
            'id' => $id,
            'name' => $name,
            'description' => $desc,
            'points' => round($pts, 2)
        ];
        $totalCatPts += $pts;
    }

    if (empty($sanitized)) {
        return getDefaultScoringCategories($maxPoints);
    }

    if ($isCategoryDriven && $totalCatPts > 0) {
        $maxPoints = (int)round($totalCatPts);
    }

    return $sanitized;
}

// Helper for backward compatibility
function sanitizeSubCriteria($rawSubCriteria) {
    return [];
}

// POST: Manage criteria (Admin only)
if ($method === "POST") {
    if (strtolower($_SESSION['role'] ?? '') !== 'admin') {
        echo json_encode(["success" => false, "message" => "Access denied. Only administrators can manage criteria."]);
        exit;
    }

    $rawJson = file_get_contents("php://input");
    $data = json_decode($rawJson, true);
    if (!$data) {
        echo json_encode(["success" => false, "message" => "Invalid JSON payload."]);
        exit;
    }

    $action = trim($data['action'] ?? 'create');

    // Action 1: Create criteria
    if ($action === 'create') {
        $eventId = (int)($data['event_id'] ?? 0);
        $title = trim($data['title'] ?? '');
        $description = trim($data['description'] ?? '');
        $maxPoints = (int)($data['max_points'] ?? 100);
        $percentage = (int)($data['percentage'] ?? 0);
        $scoringType = trim($data['scoring_type'] ?? 'rubric');
        if ($scoringType !== 'category') {
            $scoringType = 'rubric';
        }

        $minPoints = (float)($data['min_points'] ?? 0.0);
        if ($minPoints < 0) $minPoints = 0.0;
        $scoreStep = (float)($data['score_step'] ?? 0.5);
        if ($scoreStep <= 0) $scoreStep = 0.5;
        $instructions = trim($data['instructions'] ?? '');

        if ($eventId <= 0 || $title === '') {
            echo json_encode(["success" => false, "message" => "Criterion title and valid event_id are required."]);
            exit;
        }

        if ($maxPoints <= 0) $maxPoints = 100;
        if ($percentage < 0) $percentage = 0;
        if ($percentage > 100) {
            echo json_encode(["success" => false, "message" => "Total criteria weight cannot exceed 100%."]);
            exit;
        }

        try {
            // Validate that total weight for this event will not exceed 100%
            $existingCriteriaCursor = $criteriaCollection->find(['event_id' => $eventId]);
            $currentTotalWeight = 0;
            foreach ($existingCriteriaCursor as $ec) {
                $currentTotalWeight += (int)($ec['percentage'] ?? 0);
            }
            if (($currentTotalWeight + $percentage) > 100) {
                $remainingAllowed = max(0, 100 - $currentTotalWeight);
                echo json_encode([
                    "success" => false,
                    "message" => "Total criteria weight cannot exceed 100%. Current criteria already total {$currentTotalWeight}%, leaving only {$remainingAllowed}% available."
                ]);
                exit;
            }

            $rubricRatings = [];
            if ($scoringType === 'rubric') {
                $rubricRatings = sanitizeRubricRatings($data['rubric_ratings'] ?? [], $maxPoints);
            }

            $isCategoryDriven = ($scoringType === 'category');
            $scoringCategories = sanitizeScoringCategories($data['scoring_categories'] ?? [], $maxPoints, $isCategoryDriven);

            $newId = "criteria-" . bin2hex(random_bytes(6));
            $doc = [
                '_id' => $newId,
                'title' => $title,
                'description' => $description,
                'event_id' => $eventId,
                'scoring_type' => $scoringType,
                'min_points' => $minPoints,
                'max_points' => $maxPoints,
                'score_step' => $scoreStep,
                'instructions' => $instructions,
                'percentage' => $percentage,
                'rubric_ratings' => $rubricRatings,
                'scoring_categories' => $scoringCategories,
                'created_at' => (new DateTime())->format('Y-m-d H:i:s')
            ];

            $criteriaCollection->insertOne($doc);

            if ($scoringType === 'rubric') {
                $typeLabel = "Rubric-Based (" . count($rubricRatings) . " predefined ratings)";
            } elseif ($scoringType === 'category') {
                $typeLabel = "Category-Based (" . count($scoringCategories) . " score categories, {$maxPoints} pts total)";
            } else {
                $typeLabel = "Manual Scoring ({$minPoints}-{$maxPoints} pts)";
            }

            logSystemAction(
                $_SESSION['user_id'],
                $_SESSION['username'],
                $_SESSION['role'],
                'CREATE_CRITERIA',
                "Added criterion '{$title}' ({$percentage}%, {$typeLabel}) for event ID: {$eventId}."
            );

            echo json_encode([
                "success" => true,
                "message" => "Judging criterion '{$title}' added successfully!",
                "criterion" => [
                    'id' => $newId,
                    'title' => $title,
                    'description' => $description,
                    'event_id' => $eventId,
                    'scoring_type' => $scoringType,
                    'min_points' => $minPoints,
                    'max_points' => $maxPoints,
                    'score_step' => $scoreStep,
                    'instructions' => $instructions,
                    'percentage' => $percentage,
                    'rubric_ratings' => $rubricRatings,
                    'scoring_categories' => $scoringCategories
                ]
            ]);
            exit;
        } catch (Throwable $e) {
            echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
            exit;
        }
    }

    // Action 2: Edit criteria
    if ($action === 'edit') {
        $id = trim($data['id'] ?? '');
        $title = trim($data['title'] ?? '');
        $description = trim($data['description'] ?? '');
        $maxPoints = (int)($data['max_points'] ?? 100);
        $percentage = (int)($data['percentage'] ?? 0);
        $scoringType = trim($data['scoring_type'] ?? 'rubric');
        if ($scoringType !== 'category') {
            $scoringType = 'rubric';
        }

        $minPoints = (float)($data['min_points'] ?? 0.0);
        if ($minPoints < 0) $minPoints = 0.0;
        $scoreStep = (float)($data['score_step'] ?? 0.5);
        if ($scoreStep <= 0) $scoreStep = 0.5;
        $instructions = trim($data['instructions'] ?? '');

        if ($id === '' || $title === '') {
            echo json_encode(["success" => false, "message" => "Criterion ID and title are required."]);
            exit;
        }

        if ($maxPoints <= 0) $maxPoints = 100;
        if ($percentage < 0) $percentage = 0;
        if ($percentage > 100) {
            echo json_encode(["success" => false, "message" => "Total criteria weight cannot exceed 100%."]);
            exit;
        }

        try {
            $filter = ['_id' => $id];
            if (preg_match('/^[a-f\d]{24}$/i', $id)) {
                $filter = ['$or' => [['_id' => new MongoDB\BSON\ObjectId($id)], ['_id' => $id]]];
            }

            $existing = $criteriaCollection->findOne($filter);
            if (!$existing) {
                echo json_encode(["success" => false, "message" => "Criterion not found."]);
                exit;
            }

            // Validate that total weight for this event excluding this criterion will not exceed 100%
            $critEventId = (int)($existing['event_id'] ?? 0);
            $otherCriteriaCursor = $criteriaCollection->find([
                'event_id' => $critEventId,
                '_id' => ['$ne' => $existing['_id']]
            ]);
            $otherTotalWeight = 0;
            foreach ($otherCriteriaCursor as $oc) {
                $otherTotalWeight += (int)($oc['percentage'] ?? 0);
            }
            if (($otherTotalWeight + $percentage) > 100) {
                $remainingAllowed = max(0, 100 - $otherTotalWeight);
                echo json_encode([
                    "success" => false,
                    "message" => "Total criteria weight cannot exceed 100%. Other criteria already total {$otherTotalWeight}%, leaving only {$remainingAllowed}% available."
                ]);
                exit;
            }

            $rubricRatings = [];
            if ($scoringType === 'rubric') {
                $rubricRatings = sanitizeRubricRatings($data['rubric_ratings'] ?? [], $maxPoints);
            }

            $isCategoryDriven = ($scoringType === 'category');
            $scoringCategories = sanitizeScoringCategories($data['scoring_categories'] ?? ($existing['scoring_categories'] ?? []), $maxPoints, $isCategoryDriven);

            $updateFields = [
                'title' => $title,
                'description' => $description,
                'scoring_type' => $scoringType,
                'min_points' => $minPoints,
                'max_points' => $maxPoints,
                'score_step' => $scoreStep,
                'instructions' => $instructions,
                'percentage' => $percentage,
                'rubric_ratings' => $rubricRatings,
                'scoring_categories' => $scoringCategories,
                'updated_at' => (new DateTime())->format('Y-m-d H:i:s')
            ];

            $criteriaCollection->updateOne(
                ['_id' => $existing['_id']],
                ['$set' => $updateFields]
            );

            if ($scoringType === 'rubric') {
                $typeLabel = "Rubric-Based (" . count($rubricRatings) . " predefined ratings)";
            } elseif ($scoringType === 'category') {
                $typeLabel = "Category-Based (" . count($scoringCategories) . " score categories, {$maxPoints} pts total)";
            } else {
                $typeLabel = "Manual Scoring ({$minPoints}-{$maxPoints} pts)";
            }

            logSystemAction(
                $_SESSION['user_id'],
                $_SESSION['username'],
                $_SESSION['role'],
                'EDIT_CRITERIA',
                "Updated criterion '{$title}' ({$percentage}%, {$typeLabel}) (ID: {$id})."
            );

            echo json_encode([
                "success" => true,
                "message" => "Judging criterion updated successfully!"
            ]);
            exit;
        } catch (Throwable $e) {
            echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
            exit;
        }
    }

    // Action 3: Configure criteria weights (bulk update)
    if ($action === 'configure_weights' || $action === 'update_weights') {
        $eventId = (int)($data['event_id'] ?? 0);
        $weights = $data['weights'] ?? []; // Array of ['id' => '...', 'percentage' => 30]

        if ($eventId <= 0 || !is_array($weights)) {
            echo json_encode(["success" => false, "message" => "Valid event_id and weights array are required."]);
            exit;
        }

        try {
            $totalPercentage = 0;
            foreach ($weights as $w) {
                $pct = (int)($w['percentage'] ?? 0);
                if ($pct < 0) $pct = 0;
                $totalPercentage += $pct;
            }

            if ($totalPercentage > 100) {
                echo json_encode([
                    "success" => false,
                    "message" => "Total criteria weight cannot exceed 100%. The sum of your configured weights is {$totalPercentage}%."
                ]);
                exit;
            }

            foreach ($weights as $w) {
                $cId = trim($w['id'] ?? '');
                $pct = (int)($w['percentage'] ?? 0);
                if ($pct < 0) $pct = 0;

                if ($cId !== '') {
                    $filter = ['_id' => $cId];
                    if (preg_match('/^[a-f\d]{24}$/i', $cId)) {
                        $filter = ['$or' => [['_id' => new MongoDB\BSON\ObjectId($cId)], ['_id' => $cId]]];
                    }

                    $criteriaCollection->updateOne(
                        $filter,
                        ['$set' => ['percentage' => $pct, 'updated_at' => (new DateTime())->format('Y-m-d H:i:s')]]
                    );
                }
            }

            logSystemAction(
                $_SESSION['user_id'],
                $_SESSION['username'],
                $_SESSION['role'],
                'CONFIGURE_WEIGHTS',
                "Configured criteria weights for event ID: {$eventId} (Total: {$totalPercentage}%)."
            );

            echo json_encode([
                "success" => true,
                "message" => "Criteria weights configured successfully!",
                "total_weight" => $totalPercentage
            ]);
            exit;
        } catch (Throwable $e) {
            echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
            exit;
        }
    }

    // Action 4: Delete criteria
    if ($action === 'delete') {
        $id = trim($data['id'] ?? '');
        if ($id === '') {
            echo json_encode(["success" => false, "message" => "Criterion ID is required."]);
            exit;
        }

        try {
            $filter = ['_id' => $id];
            if (preg_match('/^[a-f\d]{24}$/i', $id)) {
                $filter = ['$or' => [['_id' => new MongoDB\BSON\ObjectId($id)], ['_id' => $id]]];
            }

            $existing = $criteriaCollection->findOne($filter);
            if (!$existing) {
                echo json_encode(["success" => false, "message" => "Criterion not found."]);
                exit;
            }

            $criteriaCollection->deleteOne(['_id' => $existing['_id']]);

            logSystemAction(
                $_SESSION['user_id'],
                $_SESSION['username'],
                $_SESSION['role'],
                'DELETE_CRITERIA',
                "Deleted criterion '{$existing['title']}'."
            );

            echo json_encode([
                "success" => true,
                "message" => "Criterion deleted successfully."
            ]);
            exit;
        } catch (Throwable $e) {
            echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
            exit;
        }
    }

    echo json_encode(["success" => false, "message" => "Invalid action specified."]);
    exit;
}

echo json_encode(["success" => false, "message" => "Method not allowed."]);
exit;
