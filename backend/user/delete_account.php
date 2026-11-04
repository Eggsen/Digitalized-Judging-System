<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode([
        "success" => false,
        "message" => "Access denied. Only administrators can remove accounts."
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

// Cannot delete self
if ($userId === (string)$_SESSION['user_id']) {
    echo json_encode([
        "success" => false,
        "message" => "You cannot remove your own administrator account."
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

    $status = strtolower($user['status'] ?? '');

    // Allow deleting accounts that are revoked or expired
    if ($status !== 'revoked' && $status !== 'expired') {
        echo json_encode([
            "success" => false,
            "message" => "Only revoked or expired accounts can be removed. Please revoke the account or invitation first."
        ]);
        exit;
    }

    // Clean up any assignments in events
    if (isset($eventsCollection)) {
        $eventsCollection->updateMany(
            ['$or' => [['assignedjudges' => $objectId], ['tabulators' => $objectId]]],
            ['$pull' => ['assignedjudges' => $objectId, 'tabulators' => $objectId]]
        );
    }

    // Clean up notifications for this user
    if (isset($notificationsCollection)) {
        $notificationsCollection->deleteMany(['userId' => $objectId]);
    }

    // Delete the user record
    $deleteResult = $usersCollection->deleteOne(['_id' => $objectId]);

    if ($deleteResult->getDeletedCount() > 0) {
        $identifier = $user['email'] ?? $user['username'] ?? 'User';
        logSystemAction(
            $_SESSION['user_id'],
            $_SESSION['username'],
            'admin',
            'DELETE_ACCOUNT',
            "Permanently removed revoked account for {$identifier} ({$user['role']})."
        );

        echo json_encode([
            "success" => true,
            "message" => "Revoked account for \"{$identifier}\" has been permanently removed."
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "Account could not be removed."
        ]);
    }

} catch (Throwable $e) {
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
    exit;
}

