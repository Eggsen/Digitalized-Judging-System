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

try {
    $userIdStr = $_SESSION['user_id'];
    $role = strtolower($_SESSION['role'] ?? '');
    $userObjId = new MongoDB\BSON\ObjectId($userIdStr);

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

    $notificationsCollection->updateMany(
        $filter,
        ['$set' => ['is_read' => true]]
    );

    echo json_encode(["success" => true, "message" => "Notifications marked as read."]);

} catch (Throwable $e) {
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
    exit;
}
