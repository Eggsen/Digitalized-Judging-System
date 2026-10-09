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

$rawJson = file_get_contents("php://input");
$data = json_decode($rawJson, true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "Invalid JSON payload."]);
    exit;
}

$notifId = trim($data['notification_id'] ?? "");
$action = strtolower(trim($data['action'] ?? ""));

if ($notifId === "" || !in_array($action, ['accept', 'decline'], true)) {
    echo json_encode(["success" => false, "message" => "Valid notification_id and action (accept or decline) are required."]);
    exit;
}

try {
    $userIdStr = $_SESSION['user_id'];
    $username = $_SESSION['username'] ?? 'User';
    $userRole = ucfirst(strtolower($_SESSION['role'] ?? 'user'));
    $userObjId = new MongoDB\BSON\ObjectId($userIdStr);

    $notifObjId = new MongoDB\BSON\ObjectId($notifId);
    $notif = $notificationsCollection->findOne([
        '_id' => $notifObjId,
        'user_id' => $userObjId,
        'type' => 'event_invitation'
    ]);

    if (!$notif) {
        echo json_encode(["success" => false, "message" => "Event invitation notification not found."]);
        exit;
    }

    $eventId = (int)($notif['event_id'] ?? 0);
    $eventDoc = $eventsCollection->findOne(['_id' => $eventId]);
    $eventName = $eventDoc['eventName'] ?? ("Event #" . $eventId);

    if ($action === 'accept') {
        // Update notification
        $notificationsCollection->updateOne(
            ['_id' => $notifObjId],
            ['$set' => [
                'status' => 'accepted',
                'is_read' => true,
                'updated_at' => new MongoDB\BSON\UTCDateTime()
            ]]
        );

        // Ensure user is in event confirmed list if using confirmation map
        $eventsCollection->updateOne(
            ['_id' => $eventId],
            ['$addToSet' => ['confirmed_users' => $userObjId]]
        );

        // Send Notification to Admin
        $notificationsCollection->insertOne([
            'target_role' => 'admin',
            'type' => 'invitation_accepted',
            'title' => 'Event Invitation Accepted',
            'message' => "{$username} ({$userRole}) accepted the invitation to event \"{$eventName}\".",
            'event_id' => $eventId,
            'user_id' => $userObjId,
            'is_read' => false,
            'created_at' => new MongoDB\BSON\UTCDateTime()
        ]);

        logSystemAction(
            $userIdStr,
            $username,
            $_SESSION['role'],
            "ACCEPT_EVENT_INVITATION",
            "Accepted invitation to event '{$eventName}'."
        );

        echo json_encode([
            "success" => true,
            "message" => "Invitation accepted! Competition \"{$eventName}\" is now active on your dashboard."
        ]);

    } else {
        // Decline invitation
        $notificationsCollection->updateOne(
            ['_id' => $notifObjId],
            ['$set' => [
                'status' => 'declined',
                'is_read' => true,
                'updated_at' => new MongoDB\BSON\UTCDateTime()
            ]]
        );

        // Remove user from event's assigned arrays
        $eventsCollection->updateOne(
            ['_id' => $eventId],
            [
                '$pull' => [
                    'assignedjudges' => $userObjId,
                    'tabulators' => $userObjId,
                    'confirmed_users' => $userObjId
                ]
            ]
        );

        // Send Notification to Admin
        $notificationsCollection->insertOne([
            'target_role' => 'admin',
            'type' => 'invitation_declined',
            'title' => 'Event Invitation Declined',
            'message' => "{$username} ({$userRole}) declined the invitation to event \"{$eventName}\".",
            'event_id' => $eventId,
            'user_id' => $userObjId,
            'is_read' => false,
            'created_at' => new MongoDB\BSON\UTCDateTime()
        ]);

        logSystemAction(
            $userIdStr,
            $username,
            $_SESSION['role'],
            "DECLINE_EVENT_INVITATION",
            "Declined invitation to event '{$eventName}'."
        );

        echo json_encode([
            "success" => true,
            "message" => "Invitation declined for event \"{$eventName}\"."
        ]);
    }

} catch (Throwable $e) {
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
    exit;
}
