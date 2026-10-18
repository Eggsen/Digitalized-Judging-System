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

// GET: Retrieve contestants for an event (available to all logged-in roles)
if ($method === "GET") {
    $eventId = (int)($_GET['event_id'] ?? 0);
    if ($eventId <= 0) {
        echo json_encode(["success" => false, "message" => "Valid event_id is required."]);
        exit;
    }

    try {
        $cursor = $contestantsCollection->find(
            ['event_id' => $eventId],
            ['sort' => ['contestant_number' => 1]]
        );

        $contestants = [];
        foreach ($cursor as $doc) {
            $idStr = (string)$doc['_id'];
            $contestants[] = [
                'id' => $idStr,
                'contestant_number' => (int)($doc['contestant_number'] ?? 0),
                'name' => $doc['name'] ?? '',
                'department_or_org' => $doc['department_or_org'] ?? '',
                'description' => $doc['description'] ?? '',
                'event_id' => (int)($doc['event_id'] ?? $eventId),
                'created_at' => isset($doc['created_at']) ? (string)$doc['created_at'] : ''
            ];
        }

        echo json_encode([
            "success" => true,
            "contestants" => $contestants
        ]);
        exit;
    } catch (Throwable $e) {
        echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
        exit;
    }
}

// POST: Manage contestants (Admin only)
if ($method === "POST") {
    if (strtolower($_SESSION['role'] ?? '') !== 'admin') {
        echo json_encode(["success" => false, "message" => "Access denied. Only administrators can manage contestants."]);
        exit;
    }

    $rawJson = file_get_contents("php://input");
    $data = json_decode($rawJson, true);
    if (!$data) {
        echo json_encode(["success" => false, "message" => "Invalid JSON payload."]);
        exit;
    }

    $action = trim($data['action'] ?? 'create');

    // Action 1: Create contestant
    if ($action === 'create') {
        $eventId = (int)($data['event_id'] ?? 0);
        $contestantNumber = (int)($data['contestant_number'] ?? 0);
        $name = trim($data['name'] ?? '');
        $department = trim($data['department_or_org'] ?? '');
        $description = trim($data['description'] ?? '');

        if ($eventId <= 0 || $contestantNumber <= 0 || $name === '') {
            echo json_encode(["success" => false, "message" => "Contestant number, name, and valid event_id are required."]);
            exit;
        }

        try {
            // Check if contestant number already exists for this event
            $existing = $contestantsCollection->findOne([
                'event_id' => $eventId,
                'contestant_number' => $contestantNumber
            ]);

            if ($existing) {
                echo json_encode(["success" => false, "message" => "Contestant #{$contestantNumber} already exists in this competition."]);
                exit;
            }

            $newId = "contestant-" . bin2hex(random_bytes(6));
            $doc = [
                '_id' => $newId,
                'contestant_number' => $contestantNumber,
                'name' => $name,
                'department_or_org' => $department,
                'description' => $description,
                'event_id' => $eventId,
                'created_at' => (new DateTime())->format('Y-m-d H:i:s')
            ];

            $contestantsCollection->insertOne($doc);

            logSystemAction(
                $_SESSION['user_id'],
                $_SESSION['username'],
                $_SESSION['role'],
                'CREATE_CONTESTANT',
                "Created Contestant #{$contestantNumber} '{$name}' for event ID: {$eventId}."
            );

            echo json_encode([
                "success" => true,
                "message" => "Contestant #{$contestantNumber} '{$name}' added successfully!",
                "contestant" => [
                    'id' => $newId,
                    'contestant_number' => $contestantNumber,
                    'name' => $name,
                    'department_or_org' => $department,
                    'description' => $description,
                    'event_id' => $eventId
                ]
            ]);
            exit;
        } catch (Throwable $e) {
            echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
            exit;
        }
    }

    // Action 2: Edit contestant
    if ($action === 'edit') {
        $id = trim($data['id'] ?? '');
        $contestantNumber = (int)($data['contestant_number'] ?? 0);
        $name = trim($data['name'] ?? '');
        $department = trim($data['department_or_org'] ?? '');
        $description = trim($data['description'] ?? '');

        if ($id === '' || $name === '' || $contestantNumber <= 0) {
            echo json_encode(["success" => false, "message" => "Contestant ID, number, and name are required."]);
            exit;
        }

        try {
            $filter = ['_id' => $id];
            if (preg_match('/^[a-f\d]{24}$/i', $id)) {
                $filter = ['$or' => [['_id' => new MongoDB\BSON\ObjectId($id)], ['_id' => $id]]];
            }

            $existing = $contestantsCollection->findOne($filter);
            if (!$existing) {
                echo json_encode(["success" => false, "message" => "Contestant record not found."]);
                exit;
            }

            $eventId = (int)$existing['event_id'];

            // Check if updated number conflicts with another contestant in the same event
            $duplicate = $contestantsCollection->findOne([
                'event_id' => $eventId,
                'contestant_number' => $contestantNumber,
                '_id' => ['$ne' => $existing['_id']]
            ]);

            if ($duplicate) {
                echo json_encode(["success" => false, "message" => "Contestant #{$contestantNumber} is already taken by another contestant."]);
                exit;
            }

            $contestantsCollection->updateOne(
                ['_id' => $existing['_id']],
                [
                    '$set' => [
                        'contestant_number' => $contestantNumber,
                        'name' => $name,
                        'department_or_org' => $department,
                        'description' => $description,
                        'updated_at' => (new DateTime())->format('Y-m-d H:i:s')
                    ]
                ]
            );

            logSystemAction(
                $_SESSION['user_id'],
                $_SESSION['username'],
                $_SESSION['role'],
                'EDIT_CONTESTANT',
                "Updated Contestant #{$contestantNumber} '{$name}' (ID: {$id})."
            );

            echo json_encode([
                "success" => true,
                "message" => "Contestant details updated successfully!"
            ]);
            exit;
        } catch (Throwable $e) {
            echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
            exit;
        }
    }

    // Action 3: Delete contestant
    if ($action === 'delete') {
        $id = trim($data['id'] ?? '');
        if ($id === '') {
            echo json_encode(["success" => false, "message" => "Contestant ID is required."]);
            exit;
        }

        try {
            $filter = ['_id' => $id];
            if (preg_match('/^[a-f\d]{24}$/i', $id)) {
                $filter = ['$or' => [['_id' => new MongoDB\BSON\ObjectId($id)], ['_id' => $id]]];
            }

            $existing = $contestantsCollection->findOne($filter);
            if (!$existing) {
                echo json_encode(["success" => false, "message" => "Contestant record not found."]);
                exit;
            }

            $contestantsCollection->deleteOne(['_id' => $existing['_id']]);

            // Also clean up any associated score records
            $scoresCollection->deleteMany(['contestant_id' => (string)$existing['_id']]);

            logSystemAction(
                $_SESSION['user_id'],
                $_SESSION['username'],
                $_SESSION['role'],
                'DELETE_CONTESTANT',
                "Deleted Contestant #{$existing['contestant_number']} '{$existing['name']}'."
            );

            echo json_encode([
                "success" => true,
                "message" => "Contestant removed successfully."
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
