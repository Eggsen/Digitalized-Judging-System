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

function formatNotifDate($val) {
    if (empty($val)) return 'Just now';
    try {
        if ($val instanceof MongoDB\BSON\UTCDateTime) {
            $dt = $val->toDateTime();
            $dt->setTimezone(new DateTimeZone(date_default_timezone_get() ?: 'Asia/Manila'));
            return $dt->format('M j, Y h:i A');
        }
    } catch (Throwable $e) {
        return 'Just now';
    }
    return 'Just now';
}

try {
    $userIdStr = $_SESSION['user_id'];
    $role = strtolower($_SESSION['role'] ?? '');
    $userObjId = new MongoDB\BSON\ObjectId($userIdStr);

    // Build filter: specific to user OR targeted at user role (e.g., admin)
    if ($role === 'admin') {
        $filter = [
            '$or' => [
                ['user_id' => $userObjId],
                ['target_role' => 'admin']
            ]
        ];
    } else {
        $filter = ['user_id' => $userObjId];
    }

    $cursor = $notificationsCollection->find($filter, [
        'sort' => ['created_at' => -1],
        'limit' => 30
    ]);

    $notifications = [];
    $unreadCount = 0;

    foreach ($cursor as $doc) {
        $isRead = !empty($doc['is_read']);
        if (!$isRead) {
            $unreadCount++;
        }

        $notifications[] = [
            'id' => (string)$doc['_id'],
            'type' => $doc['type'] ?? 'system',
            'title' => $doc['title'] ?? 'Notification',
            'message' => $doc['message'] ?? '',
            'event_id' => $doc['event_id'] ?? null,
            'role' => $doc['role'] ?? null,
            'status' => $doc['status'] ?? 'pending',
            'is_read' => $isRead,
            'created_at' => formatNotifDate($doc['created_at'] ?? null)
        ];
    }

    echo json_encode([
        "success" => true,
        "unread_count" => $unreadCount,
        "notifications" => $notifications
    ]);

} catch (Throwable $e) {
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
    exit;
}
