<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode(["success" => false, "message" => "Access denied. Only administrators can archive competitions."]);
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

    $currentStatus = strtolower($existing['status'] ?? '');
    $currentJudgingStatus = strtolower($existing['judgingStatus'] ?? '');

    if ($currentStatus === 'archived') {
        echo json_encode(["success" => false, "message" => "This competition is already archived."]);
        exit;
    }

    $isOngoing = ($currentStatus === 'ongoing' || $currentJudgingStatus === 'in progress');
    $isStopped = ($currentJudgingStatus === 'finished' || $currentStatus === 'completed');

    if ($isOngoing && !$isStopped) {
        if ($currentJudgingStatus === 'in progress') {
            echo json_encode([
                "success" => false,
                "message" => "Cannot archive competition while judging is in progress. Please stop the judging period first to prevent conflicts."
            ]);
            exit;
        } else {
            echo json_encode([
                "success" => false,
                "message" => "Cannot archive an ongoing competition. Please stop the judging period or finalize the event before archiving."
            ]);
            exit;
        }
    }

    $result = $eventsCollection->updateOne(
        ['_id' => $eventId],
        [
            '$set' => [
                'status' => 'Archived',
                'updatedAt' => new MongoDB\BSON\UTCDateTime()
            ]
        ]
    );

    logSystemAction(
        $_SESSION['user_id'],
        $_SESSION['username'],
        $_SESSION['role'],
        'ARCHIVE_EVENT',
        "Archived competition '" . ($existing['eventName'] ?? $eventId) . "' (ID: {$eventId})."
    );

    echo json_encode([
        "success" => true,
        "message" => "Competition '" . ($existing['eventName'] ?? $eventId) . "' archived successfully!"
    ]);

} catch (Throwable $e) {
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
    exit;
}
