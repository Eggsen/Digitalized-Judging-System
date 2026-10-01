<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . "/../database/config.php";

$method = $_SERVER['REQUEST_METHOD'];

if ($method === "GET") {
    $token = trim($_GET['token'] ?? $_GET['invite_token'] ?? "");
    if ($token === "") {
        echo json_encode(["success" => false, "message" => "Invitation token is required."]);
        exit;
    }

    try {
        $user = $usersCollection->findOne(['invite_token' => $token]);
        if (!$user) {
            echo json_encode(["success" => false, "message" => "Invalid or expired invitation token."]);
            exit;
        }

        echo json_encode([
            "success" => true,
            "username" => $user['username'] ?? '',
            "role" => $user['role'] ?? '',
            "email" => $user['email'] ?? ''
        ]);
        exit;
    } catch (Throwable $e) {
        echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
        exit;
    }
} elseif ($method === "POST") {
    $rawJson = file_get_contents("php://input");
    $data = json_decode($rawJson, true);

    if (!$data) {
        echo json_encode(["success" => false, "message" => "Invalid JSON payload."]);
        exit;
    }

    $token = trim($data['token'] ?? $data['invite_token'] ?? "");
    $password = trim($data['password'] ?? "");
    $confirmPassword = trim($data['confirm_password'] ?? "");

    if ($token === "") {
        echo json_encode(["success" => false, "message" => "Invitation token is missing."]);
        exit;
    }

    if ($password === "" || $confirmPassword === "") {
        echo json_encode(["success" => false, "message" => "Please fill in all password fields."]);
        exit;
    }

    if ($password !== $confirmPassword) {
        echo json_encode(["success" => false, "message" => "Passwords do not match."]);
        exit;
    }

    if (strlen($password) < 6) {
        echo json_encode(["success" => false, "message" => "Password must be at least 6 characters long."]);
        exit;
    }

    try {
        $user = $usersCollection->findOne(['invite_token' => $token]);
        if (!$user) {
            echo json_encode(["success" => false, "message" => "Invalid or expired invitation link."]);
            exit;
        }

        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $updateResult = $usersCollection->updateOne(
            ['_id' => $user['_id']],
            [
                '$set' => [
                    'password' => $hashedPassword,
                    'status' => 'active',
                    'is_active' => true,
                    'activated_at' => new MongoDB\BSON\UTCDateTime()
                ],
                '$unset' => [
                    'invite_token' => ""
                ]
            ]
        );

        if ($updateResult->getModifiedCount() > 0) {
            echo json_encode([
                "success" => true,
                "message" => "Password created successfully! You can now log in to your dashboard.",
                "username" => $user['username']
            ]);
        } else {
            echo json_encode([
                "success" => false,
                "message" => "Failed to set password. Please try again."
            ]);
        }
        exit;
    } catch (Throwable $e) {
        echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
        exit;
    }
} else {
    echo json_encode(["success" => false, "message" => "Invalid HTTP method."]);
    exit;
}
