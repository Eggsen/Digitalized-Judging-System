<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode([
        "success" => false,
        "message" => "Access denied. Only administrators can revoke invitations."
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== "POST") {
    echo json_encode([
        "success" => false,
        "message" => "Invalid HTTP request method."
    ]);
    exit;
}

require_once __DIR__ . "/../database/config.php";
require_once __DIR__ . "/../utils/logger.php";

$rawJson = file_get_contents("php://input");
$data = json_decode($rawJson, true);

if (!$data) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid JSON payload."
    ]);
    exit;
}

$userId = trim($data['user_id'] ?? "");

if ($userId === "") {
    echo json_encode([
        "success" => false,
        "message" => "User ID is required."
    ]);
    exit;
}

if ($userId === (string)$_SESSION['user_id']) {
    echo json_encode([
        "success" => false,
        "message" => "You cannot revoke your own account or invitation."
    ]);
    exit;
}

try {
    $objectId = new MongoDB\BSON\ObjectId($userId);
    $user = $usersCollection->findOne(['_id' => $objectId]);

    if (!$user) {
        echo json_encode([
            "success" => false,
            "message" => "Account not found."
        ]);
        exit;
    }

    if (!empty($user['password']) && ($user['status'] ?? '') === 'active') {
        echo json_encode([
            "success" => false,
            "message" => "This account is already active. You can disable the account or revoke its active sessions instead."
        ]);
        exit;
    }

    // Invalidate invitation token and mark status as revoked
    $updateResult = $usersCollection->updateOne(
        ['_id' => $objectId],
        [
            '$set' => [
                'status' => 'revoked',
                'is_active' => false
            ],
            '$unset' => [
                'invite_token' => "",
                'invite_expires_at' => ""
            ]
        ]
    );

    if ($updateResult->getModifiedCount() > 0) {
        $identifier = $user['email'] ?? $user['username'] ?? 'User';
        logSystemAction(
            $_SESSION['user_id'],
            $_SESSION['username'],
            'admin',
            'REVOKE_INVITATION',
            "Revoked account invitation for {$identifier} ({$user['role']})."
        );

        echo json_encode([
            "success" => true,
            "message" => "Invitation for \"{$identifier}\" has been revoked successfully."
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "Invitation was already revoked or no changes were made."
        ]);
    }

} catch (Throwable $e) {
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
    exit;
}

