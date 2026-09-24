<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (isset($_SESSION['user_id']) && isset($_SESSION['username'])) {
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
        "authenticated" => false
    ]);
}
