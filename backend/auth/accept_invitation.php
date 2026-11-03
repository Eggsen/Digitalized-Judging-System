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

        $fullName = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
        $displayName = !empty($fullName) ? $fullName : ($user['name'] ?? $user['username'] ?? $user['email'] ?? '');

        echo json_encode([
            "success" => true,
            "username" => $displayName,
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
    $firstName = trim($data['first_name'] ?? "");
    $lastName = trim($data['last_name'] ?? "");
    $password = trim($data['password'] ?? "");
    $confirmPassword = trim($data['confirm_password'] ?? "");

    if ($token === "") {
        echo json_encode(["success" => false, "message" => "Invitation token is missing."]);
        exit;
    }

    if ($firstName === "" || $lastName === "") {
        echo json_encode(["success" => false, "message" => "Please enter your first name and last name."]);
        exit;
    }

    if (strlen($firstName) < 2 || strlen($lastName) < 2) {
        echo json_encode(["success" => false, "message" => "First and last names must each be at least 2 characters."]);
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

        $fullName = trim($firstName . ' ' . $lastName);
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $updateResult = $usersCollection->updateOne(
            ['_id' => $user['_id']],
            [
                '$set' => [
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'name' => $fullName,
                    'username' => $fullName,
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
                "message" => "Profile and password set successfully! You can now log in.",
                "username" => $fullName,
                "email" => $user['email'] ?? ''
            ]);
        } else {
            echo json_encode([
                "success" => false,
                "message" => "Failed to update account. Please try again."
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
