<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode(["success" => false, "message" => "Access denied. Only administrators can start or stop judging."]);
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

$eventId = (int)($data['id'] ?? $data['event_id'] ?? $data['eventId'] ?? 0);
$action = trim($data['action'] ?? ''); // 'start' or 'stop'

if ($eventId <= 0 || !in_array($action, ['start', 'stop'])) {
    echo json_encode(["success" => false, "message" => "Valid event_id and action ('start' or 'stop') are required."]);
    exit;
}

try {
    $event = $eventsCollection->findOne(['_id' => $eventId]);
    if (!$event) {
        echo json_encode(["success" => false, "message" => "Event not found."]);
        exit;
    }

    $eventNameStr = $event['eventName'] ?? ("Event #" . $eventId);

    if ($action === 'start') {
        // Validation: Verify event has criteria and contestants before starting judging
        $criteriaCount = $criteriaCollection->countDocuments(['event_id' => $eventId]);
        if ($criteriaCount === 0) {
            echo json_encode([
                "success" => false,
                "message" => "Cannot start judging. Please add at least one judging criterion first."
            ]);
            exit;
        }

        $contestantsCount = $contestantsCollection->countDocuments(['event_id' => $eventId]);
        if ($contestantsCount === 0) {
            echo json_encode([
                "success" => false,
                "message" => "Cannot start judging. Please add at least one contestant first."
            ]);
            exit;
        }

        $eventsCollection->updateOne(
            ['_id' => $eventId],
            [
                '$set' => [
                    'judgingStatus' => 'In Progress',
                    'status' => 'Ongoing',
                    'judgingStartedAt' => new MongoDB\BSON\UTCDateTime(),
                    'updatedAt' => new MongoDB\BSON\UTCDateTime()
                ]
            ]
        );

        logSystemAction(
            $_SESSION['user_id'],
            $_SESSION['username'],
            $_SESSION['role'],
            'START_JUDGING',
            "Started judging period for competition '{$eventNameStr}' (ID: {$eventId})."
        );

        // Notify assigned judges
        $assignedJudges = $event['assignedjudges'] ?? [];
        foreach ($assignedJudges as $jId) {
            $notificationsCollection->insertOne([
                'user_id' => $jId,
                'type' => 'judging_period',
                'title' => 'Judging Started',
                'message' => "The judging period for '{$eventNameStr}' is now LIVE! You may now begin scoring contestants.",
                'event_id' => $eventId,
                'role' => 'judge',
                'status' => 'active',
                'is_read' => false,
                'created_at' => new MongoDB\BSON\UTCDateTime()
            ]);
        }

        // Notify tabulators
        $tabulators = $event['tabulators'] ?? [];
        foreach ($tabulators as $tId) {
            $notificationsCollection->insertOne([
                'user_id' => $tId,
                'type' => 'judging_period',
                'title' => 'Judging Started',
                'message' => "Judging for '{$eventNameStr}' is now active. Real-time scores will stream into your tabulation board.",
                'event_id' => $eventId,
                'role' => 'tabulator',
                'status' => 'active',
                'is_read' => false,
                'created_at' => new MongoDB\BSON\UTCDateTime()
            ]);
        }

        echo json_encode([
            "success" => true,
            "message" => "Judging period for '{$eventNameStr}' has started! Scoring is now live.",
            "judgingStatus" => "In Progress",
            "status" => "Ongoing"
        ]);
        exit;
    }

    if ($action === 'stop') {
        $eventsCollection->updateOne(
            ['_id' => $eventId],
            [
                '$set' => [
                    'judgingStatus' => 'Finished',
                    'judgingStoppedAt' => new MongoDB\BSON\UTCDateTime(),
                    'updatedAt' => new MongoDB\BSON\UTCDateTime()
                ]
            ]
        );

        logSystemAction(
            $_SESSION['user_id'],
            $_SESSION['username'],
            $_SESSION['role'],
            'STOP_JUDGING',
            "Stopped judging period for competition '{$eventNameStr}' (ID: {$eventId})."
        );

        // Notify assigned judges and tabulators
        $allAssigned = array_merge((array)($event['assignedjudges'] ?? []), (array)($event['tabulators'] ?? []));
        foreach ($allAssigned as $uId) {
            $notificationsCollection->insertOne([
                'user_id' => $uId,
                'type' => 'judging_period',
                'title' => 'Judging Ended',
                'message' => "The judging period for '{$eventNameStr}' has concluded. Scoring is now closed.",
                'event_id' => $eventId,
                'is_read' => false,
                'created_at' => new MongoDB\BSON\UTCDateTime()
            ]);
        }

        echo json_encode([
            "success" => true,
            "message" => "Judging period for '{$eventNameStr}' has ended. Scoring is now closed.",
            "judgingStatus" => "Finished"
        ]);
        exit;
    }

} catch (Throwable $e) {
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
    exit;
}
