<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode([
        "success" => false,
        "message" => "Access denied. Only administrators can configure user roles."
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
$newRole = strtolower(trim($data['role'] ?? ""));

$allowedRoles = ['judge', 'tabulator'];

if ($userId === "" || !in_array($newRole, $allowedRoles, true)) {
    echo json_encode([
        "success" => false,
        "message" => "Valid user_id and role (judge or tabulator) are required."
    ]);
    exit;
}

try {
    $objectId = new MongoDB\BSON\ObjectId($userId);

    $targetUser = $usersCollection->findOne(['_id' => $objectId]);
    if (!$targetUser) {
        echo json_encode([
            "success" => false,
            "message" => "Account not found."
        ]);
        exit;
    }

    $oldRole = strtolower($targetUser['role'] ?? 'user');

    if ($oldRole === 'admin') {
        echo json_encode([
            "success" => false,
            "message" => "Cannot change the role of an administrator account."
        ]);
        exit;
    }

    if ($oldRole === $newRole) {
        echo json_encode([
            "success" => false,
            "message" => "Account is already assigned as a " . ucfirst($newRole) . "."
        ]);
        exit;
    }

    $result = $usersCollection->updateOne(
        ['_id' => $objectId],
        ['$set' => [
            'role' => $newRole,
            'updated_at' => new MongoDB\BSON\UTCDateTime()
        ]]
    );

    if ($result->getModifiedCount() > 0) {
        // Migrate user ID between assignedjudges and tabulators arrays in events collection
        if ($newRole === 'judge') {
            $eventsCollection->updateMany(
                ['tabulators' => $objectId],
                [
                    '$pull' => ['tabulators' => $objectId],
                    '$addToSet' => ['assignedjudges' => $objectId]
                ]
            );
        } else if ($newRole === 'tabulator') {
            $eventsCollection->updateMany(
                ['assignedjudges' => $objectId],
                [
                    '$pull' => ['assignedjudges' => $objectId],
                    '$addToSet' => ['tabulators' => $objectId]
                ]
            );
        }

        logSystemAction(
            $_SESSION['user_id'],
            $_SESSION['username'],
            $_SESSION['role'],
            "UPDATE_USER_ROLE",
            "Changed role for user '{$targetUser['username']}' from '{$oldRole}' to '{$newRole}' and updated event assignments."
        );

        echo json_encode([
            "success" => true,
            "message" => "Role for account \"" . ($targetUser['username'] ?? $userId) . "\" updated to " . ucfirst($newRole) . " and event cards updated."
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "Failed to update role. No changes were made."
        ]);
    }

} catch (Throwable $e) {
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
    exit;
}
