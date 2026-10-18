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

            $criteria[] = [
                'id' => $idStr,
                'title' => $doc['title'] ?? '',
                'description' => $doc['description'] ?? '',
                'event_id' => (int)($doc['event_id'] ?? $eventId),
                'max_points' => (int)($doc['max_points'] ?? 100),
                'percentage' => $pct,
                'sub_criteria' => $subCriteria,
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

// Helper to sanitize sub_criteria array
function sanitizeSubCriteria($rawSubCriteria) {
    if (!is_array($rawSubCriteria)) return [];
    $sanitized = [];
    foreach ($rawSubCriteria as $index => $sc) {
        $name = trim($sc['name'] ?? '');
        if ($name === '') continue;
        $id = trim($sc['id'] ?? ('sub-' . ($index + 1) . '-' . bin2hex(random_bytes(2))));
        $desc = trim($sc['description'] ?? '');

        $levels = [];
        $rawLevels = is_array($sc['levels'] ?? null) ? $sc['levels'] : [];
        $defaultLabels = [
            '5' => 'Outstanding performance and flawless execution.',
            '4' => 'Very good performance with minor inconsistencies.',
            '3' => 'Satisfactory performance meeting standard requirements.',
            '2' => 'Fair performance with noticeable areas for improvement.',
            '1' => 'Poor performance needing substantial development.'
        ];

        for ($lvl = 5; $lvl >= 1; $lvl--) {
            $key = (string)$lvl;
            $val = trim($rawLevels[$key] ?? ($rawLevels[$lvl] ?? ''));
            $levels[$key] = $val !== '' ? $val : $defaultLabels[$key];
        }

        $sanitized[] = [
            'id' => $id,
            'name' => $name,
            'description' => $desc,
            'levels' => $levels
        ];
    }
    return $sanitized;
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
        $subCriteria = sanitizeSubCriteria($data['sub_criteria'] ?? []);

        if ($eventId <= 0 || $title === '') {
            echo json_encode(["success" => false, "message" => "Criterion title and valid event_id are required."]);
            exit;
        }

        if ($maxPoints <= 0) $maxPoints = 100;
        if ($percentage < 0) $percentage = 0;

        try {
            $newId = "criteria-" . bin2hex(random_bytes(6));
            $doc = [
                '_id' => $newId,
                'title' => $title,
                'description' => $description,
                'event_id' => $eventId,
                'max_points' => $maxPoints,
                'percentage' => $percentage,
                'sub_criteria' => $subCriteria,
                'created_at' => (new DateTime())->format('Y-m-d H:i:s')
            ];

            $criteriaCollection->insertOne($doc);

            logSystemAction(
                $_SESSION['user_id'],
                $_SESSION['username'],
                $_SESSION['role'],
                'CREATE_CRITERIA',
                "Added criterion '{$title}' ({$percentage}%, Max {$maxPoints} pts, " . count($subCriteria) . " rubric indicators) for event ID: {$eventId}."
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
                    'sub_criteria' => $subCriteria
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

            $updateFields = [
                'title' => $title,
                'description' => $description,
                'max_points' => $maxPoints,
                'percentage' => $percentage,
                'updated_at' => (new DateTime())->format('Y-m-d H:i:s')
            ];

            if (isset($data['sub_criteria']) && is_array($data['sub_criteria'])) {
                $updateFields['sub_criteria'] = sanitizeSubCriteria($data['sub_criteria']);
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
                $cId = trim($w['id'] ?? '');
                $pct = (int)($w['percentage'] ?? 0);
                $totalPercentage += $pct;

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
