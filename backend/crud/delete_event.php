<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode(["success" => false, "message" => "Access denied. Only administrators can delete competitions."]);
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
    echo json_encode(["success" => false, "message" => "Valid Event ID is required."]);
    exit;
}

try {
    $existing = $eventsCollection->findOne(['_id' => $eventId]);
    if (!$existing) {
        echo json_encode(["success" => false, "message" => "Competition record not found."]);
        exit;
    }

    $eventName = $existing['eventName'] ?? "Competition #{$eventId}";
    $currentStatus = $existing['status'] ?? '';

    // Verify competition is archived before allowing complete deletion
    if (strtolower($currentStatus) !== 'archived') {
        echo json_encode([
            "success" => false, 
            "message" => "Only archived competitions can be completely deleted. Please archive this competition first before deleting."
        ]);
        exit;
    }

    // 1. Delete associated contestants
    $contestantsCollection->deleteMany(['event_id' => $eventId]);

    // 2. Delete associated criteria
    $criteriaCollection->deleteMany(['event_id' => $eventId]);

    // 3. Delete associated scores
    $scoresCollection->deleteMany(['event_id' => $eventId]);

    // 4. Delete associated notifications
    $notificationsCollection->deleteMany(['event_id' => $eventId]);

    // 5. Delete the event document
    $eventsCollection->deleteOne(['_id' => $eventId]);

    logSystemAction(
        $_SESSION['user_id'],
        $_SESSION['username'],
        $_SESSION['role'],
        'DELETE_ARCHIVED_EVENT',
        "Permanently deleted archived competition '{$eventName}' (ID: {$eventId}) along with all associated contestants, criteria, and scores."
    );

    echo json_encode([
        "success" => true,
        "message" => "Archived competition '{$eventName}' has been completely deleted."
    ]);
    exit;

} catch (Throwable $e) {
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
    exit;
}
