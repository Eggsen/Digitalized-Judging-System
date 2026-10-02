<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode([
        "success" => false,
        "message" => "Access denied. Only administrators can create events."
    ]);
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

$eventName = trim($data['eventName'] ?? "");
$type = trim($data['type'] ?? "");
$description = trim($data['description'] ?? "");
$venue = trim($data['venue'] ?? "");
$dateInput = trim($data['date'] ?? "");

if ($eventName === "" || $type === "" || $venue === "" || $dateInput === "") {
    echo json_encode([
        "success" => false,
        "message" => "Event name, competition type, venue, and date are required."
    ]);
    exit;
}

try {
    // Generate next integer _id matching schema
    $highestEvent = $eventsCollection->findOne([], ['sort' => ['_id' => -1]]);
    $nextId = ($highestEvent && is_numeric($highestEvent['_id'])) ? ((int)$highestEvent['_id'] + 1) : 1;

    // Convert date string to UTCDateTime
    $eventTimestamp = strtotime($dateInput) ?: time();
    $eventDate = new MongoDB\BSON\UTCDateTime($eventTimestamp * 1000);

    // Convert judge user IDs to ObjectIds
    $assignedJudgesObj = [];
    if (!empty($data['assignedjudges']) && is_array($data['assignedjudges'])) {
        foreach ($data['assignedjudges'] as $jId) {
            if (is_string($jId) && strlen($jId) === 24) {
                $assignedJudgesObj[] = new MongoDB\BSON\ObjectId($jId);
            }
        }
    }

    // Convert tabulator user IDs to ObjectIds
    $tabulatorsObj = [];
    if (!empty($data['tabulators']) && is_array($data['tabulators'])) {
        foreach ($data['tabulators'] as $tId) {
            if (is_string($tId) && strlen($tId) === 24) {
                $tabulatorsObj[] = new MongoDB\BSON\ObjectId($tId);
            }
        }
    }

    $adminObjId = new MongoDB\BSON\ObjectId($_SESSION['user_id']);
    $now = new MongoDB\BSON\UTCDateTime();

    $newEvent = [
        '_id' => $nextId,
        'eventName' => $eventName,
        'type' => $type,
        'description' => $description,
        'date' => $eventDate,
        'venue' => $venue,
        'assignedjudges' => $assignedJudgesObj,
        'tabulators' => $tabulatorsObj,
        'status' => 'Upcoming',
        'judgingStatus' => 'Not Yet Started',
        'createdBy' => $adminObjId,
        'createdAt' => $now,
        'updatedAt' => $now
    ];

    $result = $eventsCollection->insertOne($newEvent);

    if ($result->getInsertedCount() > 0) {
        logSystemAction(
            $_SESSION['user_id'],
            $_SESSION['username'],
            $_SESSION['role'],
            'CREATE_EVENT',
            "Created competition '{$eventName}' (Type: {$type}, Venue: {$venue}, ID: {$nextId})."
        );

        echo json_encode([
            "success" => true,
            "message" => "Competition '{$eventName}' created successfully!",
            "eventId" => $nextId
        ]);
    } else {
        echo json_encode(["success" => false, "message" => "Failed to create competition."]);
    }

} catch (Throwable $e) {
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
    exit;
}
