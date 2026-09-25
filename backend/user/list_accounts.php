<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Only admin can list accounts
if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode([
        "success" => false,
        "message" => "Access denied. Only administrators can view accounts."
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== "GET") {
    echo json_encode([
        "success" => false,
        "message" => "Invalid HTTP request method."
    ]);
    exit;
}

require_once __DIR__ . "/../database/config.php";

try {
    // Get all non-admin accounts (judges and tabulators)
    $cursor = $usersCollection->find(
        ['role' => ['$in' => ['judge', 'tabulator']]],
        ['projection' => ['password' => 0]] // Exclude password from response
    );

    $accounts = [];
    foreach ($cursor as $user) {
        $accounts[] = [
            'id' => (string) $user['_id'],
            'username' => $user['username'] ?? '',
            'email' => $user['email'] ?? '',
            'role' => $user['role'] ?? '',
            'is_active' => $user['is_active'] ?? true,
            'created_by' => $user['created_by'] ?? 'system',
            'created_at' => isset($user['created_at'])
                ? $user['created_at']->toDateTime()->format('Y-m-d H:i:s')
                : ''
        ];
    }

    echo json_encode([
        "success" => true,
        "accounts" => $accounts
    ]);

} catch (Throwable $e) {
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
    exit;
}
