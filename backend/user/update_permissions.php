<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode([
        "success" => false,
        "message" => "Access denied. Only administrators can manage account permissions."
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

$rawJson = file_get_contents("php://input");
$data = json_decode($rawJson, true);

if (!$data) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid JSON payload."
    ]);
    exit;
}

$userId   = trim($data['user_id'] ?? "");
$isActive = isset($data['is_active']) ? (bool)$data['is_active'] : null;

if ($userId === "" || $isActive === null) {
    echo json_encode([
        "success" => false,
        "message" => "user_id and is_active are required."
    ]);
    exit;
}

try {
    $objectId = new MongoDB\BSON\ObjectId($userId);

    // Make sure we're not changing an admin account
    $targetUser = $usersCollection->findOne(['_id' => $objectId]);
    if (!$targetUser) {
        echo json_encode([
            "success" => false,
            "message" => "Account not found."
        ]);
        exit;
    }

    if (strtolower($targetUser['role'] ?? '') === 'admin') {
        echo json_encode([
            "success" => false,
            "message" => "Cannot change permissions of an admin account."
        ]);
        exit;
    }

    $result = $usersCollection->updateOne(
        ['_id' => $objectId],
        ['$set' => ['is_active' => $isActive]]
    );

    if ($result->getModifiedCount() > 0) {
        $statusText = $isActive ? "enabled" : "disabled";
        echo json_encode([
            "success" => true,
            "message" => "Account access has been " . $statusText . " for \"" . ($targetUser['username'] ?? $userId) . "\"."
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "No changes were made. The account may already have that status."
        ]);
    }

} catch (Throwable $e) {
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
    exit;
}
