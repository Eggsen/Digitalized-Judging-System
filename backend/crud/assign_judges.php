<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode(["success" => false, "message" => "Access denied. Only administrators can assign judges."]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== "POST") {
    echo json_encode(["success" => false, "message" => "Invalid HTTP request method."]);
    exit;
}

require_once __DIR__ . "/../database/config.php";
require_once __DIR__ . "/../utils/logger.php";

$rawJson = file_get_contents("php://input");
$data = json_decode($rawJson, true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "Invalid JSON payload."]);
    exit;
}

$eventId = (int)($data['id'] ?? $data['eventId'] ?? 0);
$judgeIds = is_array($data['assignedjudges'] ?? null) ? $data['assignedjudges'] : [];
$tabulatorIds = is_array($data['tabulators'] ?? null) ? $data['tabulators'] : [];

if ($eventId <= 0) {
    echo json_encode(["success" => false, "message" => "Event ID is required."]);
    exit;
}

try {
    $existing = $eventsCollection->findOne(['_id' => $eventId]);
    if (!$existing) {
        echo json_encode(["success" => false, "message" => "Event not found."]);
        exit;
    }

    $assignedJudgesObj = [];
    foreach ($judgeIds as $jId) {
        if (is_string($jId) && strlen($jId) === 24) {
            $assignedJudgesObj[] = new MongoDB\BSON\ObjectId($jId);
        }
    }

    $tabulatorsObj = [];
    foreach ($tabulatorIds as $tId) {
        if (is_string($tId) && strlen($tId) === 24) {
            $tabulatorsObj[] = new MongoDB\BSON\ObjectId($tId);
        }
    }

    $result = $eventsCollection->updateOne(
        ['_id' => $eventId],
        [
            '$set' => [
                'assignedjudges' => $assignedJudgesObj,
                'tabulators' => $tabulatorsObj,
                'updatedAt' => new MongoDB\BSON\UTCDateTime()
            ]
        ]
    );

    logSystemAction(
        $_SESSION['user_id'],
        $_SESSION['username'],
        $_SESSION['role'],
        'ASSIGN_JUDGES',
        "Updated judge (" . count($assignedJudgesObj) . ") and tabulator (" . count($tabulatorsObj) . ") assignments for event '" . ($existing['eventName'] ?? $eventId) . "'."
    );

    echo json_encode([
        "success" => true,
        "message" => "Judge and Tabulator assignments updated successfully!"
    ]);

} catch (Throwable $e) {
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
    exit;
}
