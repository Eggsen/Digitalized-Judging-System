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

function formatMongoDate($val) {
    if (empty($val)) return '';
    try {
        if ($val instanceof MongoDB\BSON\UTCDateTime) {
            $dt = $val->toDateTime();
            $dt->setTimezone(new DateTimeZone(date_default_timezone_get() ?: 'Asia/Manila'));
            return $dt->format('Y-m-d h:i A');
        }
        if (is_numeric($val)) {
            return date('Y-m-d h:i A', (int)$val);
        }
        if (is_string($val)) {
            return date('Y-m-d h:i A', strtotime($val));
        }
    } catch (Throwable $e) {
        return (string)$val;
    }
    return '';
}

try {
    // Get all non-admin accounts (judges and tabulators)
    $cursor = $usersCollection->find(
        ['role' => ['$in' => ['judge', 'tabulator']]],
        ['projection' => ['password' => 0]] // Exclude password from response
    );

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';

    $accounts = [];
    foreach ($cursor as $user) {
        $status = $user['status'] ?? (empty($user['password']) ? 'pending' : 'active');
        $token = $user['invite_token'] ?? null;
        $inviteLink = $token ? "{$protocol}://{$host}/index.php?invite_token={$token}" : null;

        $accounts[] = [
            'id' => (string) $user['_id'],
            'username' => $user['username'] ?? '',
            'email' => $user['email'] ?? '',
            'role' => $user['role'] ?? '',
            'status' => $status,
            'invite_token' => $token,
            'invite_link' => $inviteLink,
            'is_active' => $user['is_active'] ?? true,
            'created_by' => $user['created_by'] ?? 'system',
            'created_at' => formatMongoDate($user['created_at'] ?? null),
            'activated_at' => formatMongoDate($user['activated_at'] ?? null)
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
