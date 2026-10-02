<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode(["success" => false, "message" => "Access denied. Only administrators can view audit logs."]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== "GET") {
    echo json_encode(["success" => false, "message" => "Invalid HTTP request method."]);
    exit;
}

require_once __DIR__ . "/../database/config.php";

function formatMongoDate($val) {
    if (empty($val)) return '';
    try {
        if ($val instanceof MongoDB\BSON\UTCDateTime) {
            $dt = $val->toDateTime();
            $dt->setTimezone(new DateTimeZone(date_default_timezone_get() ?: 'Asia/Manila'));
            return $dt->format('Y-m-d h:i:s A');
        }
        if (is_numeric($val)) {
            return date('Y-m-d h:i:s A', (int)$val);
        }
        if (is_string($val)) {
            return date('Y-m-d h:i:s A', strtotime($val));
        }
    } catch (Throwable $e) {
        return (string)$val;
    }
    return '';
}

try {
    $cursor = $logsCollection->find([], ['sort' => ['timestamp' => -1], 'limit' => 100]);

    $logs = [];
    foreach ($cursor as $doc) {
        $logs[] = [
            'id' => (string)$doc['_id'],
            'userId' => isset($doc['userId']) ? (string)$doc['userId'] : '',
            'username' => $doc['username'] ?? 'System',
            'role' => $doc['role'] ?? 'system',
            'action' => $doc['action'] ?? 'ACTION',
            'details' => $doc['details'] ?? '',
            'timestamp' => formatMongoDate($doc['timestamp'] ?? null)
        ];
    }

    echo json_encode([
        "success" => true,
        "logs" => $logs
    ]);

} catch (Throwable $e) {
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
    exit;
}
