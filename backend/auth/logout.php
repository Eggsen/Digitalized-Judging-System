<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . "/../utils/logger.php";

if (!empty($_SESSION['user_id'])) {
    logSystemAction(
        $_SESSION['user_id'],
        $_SESSION['username'] ?? 'User',
        $_SESSION['role'] ?? 'user',
        'LOGOUT',
        "Signed out of the system."
    );
}

$_SESSION = [];

if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

session_destroy();

echo json_encode([
    "success" => true,
    "message" => "Logged out successfully."
]);
