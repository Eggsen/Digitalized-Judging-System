<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode([
        "success" => false,
        "message" => "Access denied. Only administrators can revoke user sessions."
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

    // Generate a fresh session token to invalidate all existing cookies/sessions for this user
    $freshToken = bin2hex(random_bytes(16));

    $updateResult = $usersCollection->updateOne(
        ['_id' => $objectId],
        [
            '$set' => [
                'session_token' => $freshToken,
                'sessions_revoked_at' => new MongoDB\BSON\UTCDateTime()
            ]
        ]
    );

    $identifier = $user['email'] ?? $user['username'] ?? 'User';
    logSystemAction(
        $_SESSION['user_id'],
        $_SESSION['username'],
        'admin',
        'REVOKE_SESSIONS',
        "Revoked all active sessions (forced logout) for {$identifier} ({$user['role']})."
    );

    echo json_encode([
        "success" => true,
        "message" => "Active sessions for \"{$identifier}\" have been terminated. The user is now logged out from all devices."
    ]);

} catch (Throwable $e) {
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
    exit;
}

