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

            $scoringCategories = [];
            if (!empty($doc['scoring_categories'])) {
                $scoringCategories = sanitizeScoringCategories($doc['scoring_categories'], $maxPoints);
            } else if (!empty($doc['sub_criteria'])) {
                $scoringCategories = getDefaultScoringCategories($maxPoints);
            } else {
                $scoringCategories = getDefaultScoringCategories($maxPoints);
            }

            $criteria[] = [
                'id' => $idStr,
                'title' => $doc['title'] ?? '',
                'description' => $doc['description'] ?? '',
                'event_id' => (int)($doc['event_id'] ?? $eventId),
                'max_points' => $maxPoints,
                'percentage' => $pct,
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

// Helper to provide default scoring categories scaled to maxPoints
function getDefaultScoringCategories($maxPoints) {
    $maxPts = (float)$maxPoints;
    if ($maxPts <= 0) $maxPts = 100.0;
    $count = 4;
    $perCat = round($maxPts / $count, 2);

    return [
        [
            'id' => 'cat-1',
            'name' => 'Difficulty & Variety',
            'description' => 'Degree of difficulty, complexity, and choreographic variety.',
            'points' => $perCat
        ],
        [
            'id' => 'cat-2',
            'name' => 'Synchronization & Timing',
            'description' => 'Precision, unison among performers, and beat alignment.',
            'points' => $perCat
        ],
        [
            'id' => 'cat-3',
            'name' => 'Technique & Form',
            'description' => 'Body control, posture, execution lines, and cleanliness.',
            'points' => $perCat
        ],
        [
            'id' => 'cat-4',
            'name' => 'Staging & Transitions',
            'description' => 'Spatial coverage, dynamic formations, and transition fluidity.',
            'points' => $perCat
        ]
    ];
}

// Helper to sanitize customizable scoring categories array
function sanitizeScoringCategories($rawCategories, $maxPoints) {
    if ($rawCategories instanceof Traversable) {
        $rawCategories = iterator_to_array($rawCategories);
    } elseif (is_object($rawCategories)) {
        $rawCategories = (array)$rawCategories;
    }

    if (!is_array($rawCategories) || empty($rawCategories)) {
        return getDefaultScoringCategories($maxPoints);
    }

    $maxPts = (float)$maxPoints;
    if ($maxPts <= 0) $maxPts = 100.0;

    $sanitized = [];
    foreach ($rawCategories as $index => $cat) {
        if ($cat instanceof Traversable) {
            $cat = iterator_to_array($cat);
        } elseif (is_object($cat)) {
            $cat = (array)$cat;
        }

        $name = trim($cat['name'] ?? '');
        if ($name === '') {
            $name = 'Score Tier ' . ($index + 1);
        }
        $id = trim($cat['id'] ?? ('cat-' . ($index + 1) . '-' . bin2hex(random_bytes(2))));
        $desc = trim($cat['description'] ?? '');
        $pts = (float)($cat['points'] ?? 0);
        if ($pts < 0) $pts = 0;
        if ($pts > $maxPts) $pts = $maxPts;

        $sanitized[] = [
            'id' => $id,
            'name' => $name,
            'description' => $desc,
            'points' => round($pts, 2)
        ];
    }

    if (empty($sanitized)) {
        return getDefaultScoringCategories($maxPoints);
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

            $scoringCategories = sanitizeScoringCategories($data['scoring_categories'] ?? [], $maxPoints);
            $newId = "criteria-" . bin2hex(random_bytes(6));
            $doc = [
                '_id' => $newId,
                'title' => $title,
                'description' => $description,
                'event_id' => $eventId,
                'max_points' => $maxPoints,
                'percentage' => $percentage,
                'scoring_categories' => $scoringCategories,
                'created_at' => (new DateTime())->format('Y-m-d H:i:s')
            ];

            $criteriaCollection->insertOne($doc);

            logSystemAction(
                $_SESSION['user_id'],
                $_SESSION['username'],
                $_SESSION['role'],
                'CREATE_CRITERIA',
                "Added criterion '{$title}' ({$percentage}%, Max {$maxPoints} pts, " . count($scoringCategories) . " score categories) for event ID: {$eventId}."
            );

            echo json_encode([
                "success" => true,
                "message" => "Judging criterion '{$title}' added successfully!",
                "criterion" => [
                    'id' => $newId,
                    'title' => $title,
                    'description' => $description,
                    'event_id' => $eventId,
                    'max_points' => $maxPoints,
                    'percentage' => $percentage,
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

            $updateFields = [
                'title' => $title,
                'description' => $description,
                'max_points' => $maxPoints,
                'percentage' => $percentage,
                'updated_at' => (new DateTime())->format('Y-m-d H:i:s')
            ];

            if (isset($data['scoring_categories']) && is_array($data['scoring_categories'])) {
                $updateFields['scoring_categories'] = sanitizeScoringCategories($data['scoring_categories'], $maxPoints);
            }

            $criteriaCollection->updateOne(
                ['_id' => $existing['_id']],
                ['$set' => $updateFields]
            );

            logSystemAction(
                $_SESSION['user_id'],
                $_SESSION['username'],
                $_SESSION['role'],
                'EDIT_CRITERIA',
                "Updated criterion '{$title}' ({$percentage}%, Max {$maxPoints} pts) (ID: {$id})."
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
