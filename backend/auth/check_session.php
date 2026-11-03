<?php

header("Content-Type: application/json");

require_once __DIR__ . "/../utils/session_guard.php";

$isValid = validateUserSession(false);

if ($isValid && isset($_SESSION['user_id']) && isset($_SESSION['username'])) {
    echo json_encode([
        "authenticated" => true,
        "user" => [
            "id" => $_SESSION['user_id'],
            "username" => $_SESSION['username'],
            "email" => $_SESSION['email'] ?? '',
            "role" => $_SESSION['role'] ?? 'user'
        ]
    ]);
} else {
    echo json_encode([
        "authenticated" => false,
        "message" => "Session is invalid or has expired."
    ]);
}
