<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . "/../database/config.php";

if ($_SERVER['REQUEST_METHOD'] !== "POST") {
    echo json_encode([
        "success" => false,
        "message" => "Invalid HTTP Request method."
    ]); 
    exit;
}

$rawJson = file_get_contents("php://input");
$data = json_decode($rawJson, true);

if (!$data) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid JSON format payload."
    ]);
    exit;
}

$identifier = trim($data['email'] ?? $data['identifier'] ?? $data['username'] ?? "");
$password = trim($data['password'] ?? "");
$selectedRole = trim($data['role'] ?? "");

if ($identifier === "" || $password === "") {
    echo json_encode([
        "success" => false,
        "message" => "Please enter all required fields."
    ]);
    exit;
}

try {
    // Find user by username or email
    $user = $usersCollection->findOne([
        '$or' => [
            ['username' => $identifier],
            ['email' => $identifier]
        ]
    ]);

    if (!$user) {
        echo json_encode([
            "success" => false,
            "message" => "No account found matching the provided username/email."
        ]);
        exit;
    }

    // Check if role is specified and matches user role
    if ($selectedRole !== "" && strtolower($user['role'] ?? '') !== strtolower($selectedRole)) {
        echo json_encode([
            "success" => false,
            "message" => "This account does not have access permission for the " . ucfirst($selectedRole) . " portal."
        ]);
        exit;
    }

    // Verify password (check password_verify first, fallback to string equality)
    $storedPassword = $user['password'] ?? $user['password_hash'] ?? null;
    $passwordValid = false;
    if ($storedPassword !== null) {
        if (password_verify($password, $storedPassword)) {
            $passwordValid = true;
        } elseif ($password === $storedPassword) {
            $passwordValid = true;
        }
    }

    if (!$passwordValid) {
        echo json_encode([
            "success" => false,
            "message" => "Incorrect password. Please try again."
        ]);
        exit;
    }

    // Set session data
    $_SESSION['user_id'] = (string)$user['_id'];
    $_SESSION['username'] = $user['username'] ?? $identifier;
    $_SESSION['email'] = $user['email'] ?? '';
    $_SESSION['role'] = strtolower($user['role'] ?? 'user');

    echo json_encode([
        "success" => true,
        "message" => "Login successful! Redirecting...",
        "user" => [
            "id" => $_SESSION['user_id'],
            "username" => $_SESSION['username'],
            "email" => $_SESSION['email'],
            "role" => $_SESSION['role']
        ],
        "redirect" => "index.php"
    ]);

} catch (Throwable $e) {
    echo json_encode([
        "success" => false,
        "message" => "Authentication error: " . $e->getMessage()
    ]);
    exit;
}
