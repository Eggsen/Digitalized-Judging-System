<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Any authenticated session can fetch public WebSocket config
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Authentication required."
    ]);
    exit;
}

require_once __DIR__ . "/websocket.php";

$cfg = getWebSocketConfig();

echo json_encode([
    "success"       => true,
    "enabled"       => $cfg['enabled'],
    "is_configured" => $cfg['is_configured'],
    "key"           => $cfg['key'],
    "cluster"       => $cfg['cluster'],
    "host"          => $cfg['host'],
    "port"          => $cfg['port'],
    "scheme"        => $cfg['scheme']
]);

