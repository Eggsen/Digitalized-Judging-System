<?php

/**
 * Real-Time WebSocket Helper (Pusher Channels & Soketi Compatible)
 * 
 * Provides instantaneous pub/sub event broadcasting for live scores,
 * tabulation board updates, score unlock alerts, and judging period changes.
 * Falls back gracefully when disabled in settings or unconfigured in .env.
 */

if (file_exists(__DIR__ . "/../../vendor/autoload.php")) {
    require_once __DIR__ . "/../../vendor/autoload.php";
}

/**
 * Check if the Real-Time WebSocket service is enabled in System Settings
 */
function isWebSocketServiceEnabled(): bool {
    global $settingsCollection;
    if (!isset($settingsCollection)) {
        try {
            require_once __DIR__ . "/../database/config.php";
        } catch (Throwable $e) {}
    }

    if (isset($settingsCollection)) {
        try {
            $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']);
            if (isset($settingsDoc['security']['websocketEnabled'])) {
                return (bool)$settingsDoc['security']['websocketEnabled'];
            }
        } catch (Throwable $e) {}
    }
    return true; // Default enabled
}

/**
 * Retrieve public WebSocket configuration for frontend clients
 */
function getWebSocketConfig(): array {
    $cleanEnv = function($val, $default = '') {
        if ($val === null || $val === false || $val === '') return $default;
        return trim((string)$val, " \t\n\r\0\x0B\"'");
    };

    $enabled = isWebSocketServiceEnabled();
    $appId   = $cleanEnv($_ENV['PUSHER_APP_ID'] ?? getenv('PUSHER_APP_ID'));
    $appKey  = $cleanEnv($_ENV['PUSHER_KEY'] ?? getenv('PUSHER_KEY') ?: ($_ENV['PUSHER_APP_KEY'] ?? getenv('PUSHER_APP_KEY')));
    $secret  = $cleanEnv($_ENV['PUSHER_SECRET'] ?? getenv('PUSHER_SECRET') ?: ($_ENV['PUSHER_APP_SECRET'] ?? getenv('PUSHER_APP_SECRET')));
    $cluster = $cleanEnv($_ENV['PUSHER_CLUSTER'] ?? getenv('PUSHER_CLUSTER'), 'ap1');
    $host    = $cleanEnv($_ENV['PUSHER_HOST'] ?? getenv('PUSHER_HOST'));
    $port    = (int)$cleanEnv($_ENV['PUSHER_PORT'] ?? getenv('PUSHER_PORT'), ($host ? '80' : '443'));
    $scheme  = $cleanEnv($_ENV['PUSHER_SCHEME'] ?? getenv('PUSHER_SCHEME'), ($host && $port !== 443 ? 'http' : 'https'));

    $isConfigured = !empty($appId) && !empty($appKey) && !empty($secret);

    return [
        'enabled'       => $enabled,
        'is_configured' => $isConfigured,
        'app_id'        => $appId,
        'key'           => $appKey,
        'cluster'       => $cluster,
        'host'          => $host ?: null,
        'port'          => $port,
        'scheme'        => $scheme,
        'secret'        => $secret
    ];
}

/**
 * Broadcast an event via Pusher REST API to connected subscribers
 * 
 * @param string $channel Target channel (e.g., 'event-1')
 * @param string $event   Event name (e.g., 'score-updated', 'judging-status-changed')
 * @param array  $data    Payload data to send
 * @return array Status of dispatch
 */
function triggerWebSocketEvent(string $channel, string $event, array $data = []): array {
    $cfg = getWebSocketConfig();

    if (!$cfg['enabled']) {
        return [
            'success' => false,
            'disabled' => true,
            'message' => 'Real-Time WebSocket service is disabled in Settings.'
        ];
    }

    if (!$cfg['is_configured']) {
        return [
            'success' => false,
            'unconfigured' => true,
            'message' => 'Pusher credentials (PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET) not configured.'
        ];
    }

    try {
        $appId   = $cfg['app_id'];
        $appKey  = $cfg['key'];
        $secret  = $cfg['secret'];
        $cluster = $cfg['cluster'];
        $scheme  = $cfg['scheme'];
        $host    = $cfg['host'] ?: "api-{$cluster}.pusher.com";
        $port    = $cfg['port'];

        // Pusher event payload: 'data' property MUST be a stringified JSON
        $postData = [
            'name'     => $event,
            'channel'  => $channel,
            'data'     => json_encode($data)
        ];
        $body = json_encode($postData);
        $bodyMd5 = md5($body);

        $path = "/apps/{$appId}/events";
        $timestamp = time();

        $queryParams = [
            'auth_key'        => $appKey,
            'auth_timestamp'  => $timestamp,
            'auth_version'    => '1.0',
            'body_md5'        => $bodyMd5
        ];
        ksort($queryParams);
        $queryString = http_build_query($queryParams);

        $stringToSign = "POST\n{$path}\n{$queryString}";
        $authSignature = hash_hmac('sha256', $stringToSign, $secret, false);

        $url = "{$scheme}://{$host}:{$port}{$path}?{$queryString}&auth_signature={$authSignature}";

        if (!extension_loaded('curl')) {
            return [
                'success' => false,
                'message' => 'PHP cURL extension required for WebSocket dispatch.'
            ];
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 3, // Low timeout so it never stalls backend operations
            CURLOPT_CONNECTTIMEOUT => 2,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Accept: application/json'
            ],
            CURLOPT_SSL_VERIFYPEER => ($scheme === 'https')
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($response !== false && ($httpCode === 200 || $httpCode === 202)) {
            return [
                'success' => true,
                'channel' => $channel,
                'event'   => $event
            ];
        }

        return [
            'success' => false,
            'http_code' => $httpCode,
            'error'   => $curlErr ?: "HTTP {$httpCode}: {$response}"
        ];
    } catch (Throwable $e) {
        error_log("WebSocket Trigger Exception: " . $e->getMessage());
        return [
            'success' => false,
            'message' => $e->getMessage()
        ];
    }
}

