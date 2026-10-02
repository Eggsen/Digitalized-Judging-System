<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode(["success" => false, "message" => "Access denied. Only administrators can edit events."]);
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
$eventName = trim($data['eventName'] ?? "");
$type = trim($data['type'] ?? "");
$description = trim($data['description'] ?? "");
$venue = trim($data['venue'] ?? "");
$dateInput = trim($data['date'] ?? "");
$status = trim($data['status'] ?? "");
$judgingStatus = trim($data['judgingStatus'] ?? "");

if ($eventId <= 0 || $eventName === "") {
    echo json_encode(["success" => false, "message" => "Event ID and event name are required."]);
    exit;
}

try {
    $existing = $eventsCollection->findOne(['_id' => $eventId]);
    if (!$existing) {
        echo json_encode(["success" => false, "message" => "Event not found."]);
        exit;
    }

    $updateFields = [
        'eventName' => $eventName,
        'type' => $type ?: ($existing['type'] ?? 'Competition'),
        'description' => $description,
        'venue' => $venue ?: ($existing['venue'] ?? ''),
        'updatedAt' => new MongoDB\BSON\UTCDateTime()
    ];

    if ($dateInput !== "") {
        $timestamp = strtotime($dateInput) ?: time();
        $updateFields['date'] = new MongoDB\BSON\UTCDateTime($timestamp * 1000);
    }

    if ($status !== "") {
        $updateFields['status'] = $status;
    }

    if ($judgingStatus !== "") {
        $updateFields['judgingStatus'] = $judgingStatus;
    }

    $result = $eventsCollection->updateOne(
        ['_id' => $eventId],
        ['$set' => $updateFields]
    );

    logSystemAction(
        $_SESSION['user_id'],
        $_SESSION['username'],
        $_SESSION['role'],
        'EDIT_EVENT',
        "Updated information for event '{$eventName}' (ID: {$eventId})."
    );

    echo json_encode([
        "success" => true,
        "message" => "Event '{$eventName}' updated successfully!"
    ]);

} catch (Throwable $e) {
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
    exit;
}
