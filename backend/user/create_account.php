<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode([
        "success" => false,
        "message" => "Access denied. Only administrators can create accounts."
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

$username = trim($data['username'] ?? "");
$email    = trim($data['email'] ?? "");
$password = trim($data['password'] ?? "");
$role     = strtolower(trim($data['role'] ?? ""));

if ($username === "" || $password === "" || $role === "") {
    echo json_encode([
        "success" => false,
        "message" => "Username, password, and role are required."
    ]);
    exit;
}

if (!in_array($role, ['judge', 'tabulator'])) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid role. You can only create Judge or Tabulator accounts."
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

if ($email !== "" && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid email address format."
    ]);
    exit;
}

try {
    $existingUser = $usersCollection->findOne(['username' => $username]);
    if ($existingUser) {
        echo json_encode([
            "success" => false,
            "message" => "Username already exists. Please choose a different username."
        ]);
        exit;
    }

    if ($email !== "") {
        $existingEmail = $usersCollection->findOne(['email' => $email]);
        if ($existingEmail) {
            echo json_encode([
                "success" => false,
                "message" => "Email address is already in use."
            ]);
            exit;
        }
    }

    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    // Build the new user document
    $newUser = [
        'username'   => $username,
        'email'      => $email,
        'password'   => $hashedPassword,
        'role'       => $role,
        'is_active'  => true,
        'created_by' => $_SESSION['username'],
        'created_at' => new MongoDB\BSON\UTCDateTime()
    ];

    $result = $usersCollection->insertOne($newUser);

    if ($result->getInsertedCount() > 0) {
        echo json_encode([
            "success" => true,
            "message" => ucfirst($role) . " account for \"" . $username . "\" created successfully."
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "Failed to create account. Please try again."
        ]);
    }

} catch (Throwable $e) {
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
    exit;
}
