<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
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

$username        = trim($data['username'] ?? "");
$email           = trim($data['email'] ?? "");
$password        = trim($data['password'] ?? "");
$confirmPassword = trim($data['confirm_password'] ?? $data['password'] ?? "");

if ($username === "" || $password === "") {
    echo json_encode([
        "success" => false,
        "message" => "Username and password are required."
    ]);
    exit;
}

if (strlen($username) < 3) {
    echo json_encode([
        "success" => false,
        "message" => "Username must be at least 3 characters long."
    ]);
    exit;
}

if (strlen($password) < 6) {
    echo json_encode([
        "success" => false,
        "message" => "Password must be at least 6 characters long."
    ]);
    exit;
}

if ($confirmPassword !== "" && $password !== $confirmPassword) {
    echo json_encode([
        "success" => false,
        "message" => "Passwords do not match."
    ]);
    exit;
}

if ($email !== "" && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid email address format."
    ]);
    exit;
}

try {
    // Check for existing username
    $existingUser = $usersCollection->findOne(['username' => $username]);
    if ($existingUser) {
        echo json_encode([
            "success" => false,
            "message" => "Username already exists. Please choose a different username."
        ]);
        exit;
    }

    // Check for existing email if provided
    if ($email !== "") {
        $existingEmail = $usersCollection->findOne(['email' => $email]);
        if ($existingEmail) {
            echo json_encode([
                "success" => false,
                "message" => "Email address is already registered."
            ]);
            exit;
        }
    }

    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    $newAdmin = [
        'username'   => $username,
        'email'      => $email,
        'password'   => $hashedPassword,
        'role'       => 'admin',
        'is_active'  => true,
        'created_at' => new MongoDB\BSON\UTCDateTime()
    ];

    $result = $usersCollection->insertOne($newAdmin);

    if ($result->getInsertedCount() > 0) {
        echo json_encode([
            "success"  => true,
            "message"  => "Admin account for \"" . $username . "\" registered successfully! You can now log in.",
            "username" => $username
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "Failed to create Admin account. Please try again."
        ]);
    }

} catch (Throwable $e) {
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
    exit;
}
