<?php

/**
 * Environment (.env) Manager
 * Handles reading and writing allowed environment variables to the root .env file,
 * with database synchronization for ephemeral cloud environments (e.g. Render).
 */

if (!defined('ALLOWED_ENV_KEYS')) {
    define('ALLOWED_ENV_KEYS', [
        // Google OAuth 2.0
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'GOOGLE_REDIRECT_URI',

        // Google reCAPTCHA v2
        'RECAPTCHA_SITE_KEY',
        'RECAPTCHA_SECRET_KEY',

        // Cloudinary Media Storage CDN
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET',
        'CLOUDINARY_FOLDER',

        // Gmail SMTP Email Service
        'SMTP_HOST',
        'SMTP_PORT',
        'SMTP_SECURE',
        'SMTP_USERNAME',
        'SMTP_PASSWORD',
        'SMTP_FROM_EMAIL',
        'SMTP_FROM_NAME',

        // Pusher Real-Time WebSockets
        'PUSHER_APP_ID',
        'PUSHER_KEY',
        'PUSHER_SECRET',
        'PUSHER_CLUSTER'
    ]);
}

/**
 * Get path to the root .env file
 */
function getEnvFilePath(): string {
    return dirname(__DIR__, 2) . '/.env';
}

/**
 * Read current values of allowed environment keys.
 * Checks MongoDB first (if document provided), falling back to .env file and PHP environment.
 */
function getSystemApiKeys($settingsCollection = null): array {
    $keys = [];
    $allowed = ALLOWED_ENV_KEYS;

    // Default structure with empty strings
    foreach ($allowed as $key) {
        $keys[$key] = '';
    }

    // 1. Try reading from .env file
    $envPath = getEnvFilePath();
    if (file_exists($envPath) && is_readable($envPath)) {
        $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || str_starts_with($line, '#')) {
                continue;
            }
            if (strpos($line, '=') !== false) {
                [$k, $v] = explode('=', $line, 2);
                $k = trim($k);
                $v = trim($v);
                // Strip surrounding quotes if present
                if ((str_starts_with($v, '"') && str_ends_with($v, '"')) ||
                    (str_starts_with($v, "'") && str_ends_with($v, "'"))) {
                    $v = substr($v, 1, -1);
                }
                if (in_array($k, $allowed, true)) {
                    $keys[$k] = $v;
                }
            }
        }
    }

    // 2. Overlay runtime $_ENV / getenv if .env was empty or missing some
    foreach ($allowed as $key) {
        if ($keys[$key] === '') {
            $val = $_ENV[$key] ?? getenv($key);
            if ($val !== false && $val !== null) {
                $keys[$key] = (string)$val;
            }
        }
    }

    // 3. Overlay MongoDB stored overrides if available (persists through Render container restarts)
    if ($settingsCollection) {
        try {
            $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']);
            if (!empty($settingsDoc['api_keys']) && is_array($settingsDoc['api_keys'])) {
                foreach ($allowed as $key) {
                    if (isset($settingsDoc['api_keys'][$key]) && $settingsDoc['api_keys'][$key] !== '') {
                        $keys[$key] = (string)$settingsDoc['api_keys'][$key];
                    }
                }
            }
        } catch (Throwable $e) {
            // Ignore DB errors during fallback read
        }
    }

    return $keys;
}

/**
 * Format a value safely for writing into a .env file
 */
function formatEnvValue(string $val): string {
    // If empty
    if ($val === '') {
        return '';
    }
    // If value contains spaces, quotes, hash, dollar, or newlines, wrap in double quotes with escaping
    if (preg_match('/[\s"\'#$=]/', $val)) {
        return '"' . addcslashes($val, "\\\"\$\r\n") . '"';
    }
    return $val;
}

/**
 * Write updated key-value pairs to the root .env file while preserving
 * comments and unedited lines (such as MONGODB_URI and MONGODB_DATABASE).
 */
function updateEnvFile(array $newValues): bool {
    $envPath = getEnvFilePath();
    $allowed = ALLOWED_ENV_KEYS;

    // Filter to allowed keys only
    $validUpdates = [];
    foreach ($newValues as $k => $v) {
        if (in_array($k, $allowed, true)) {
            $validUpdates[$k] = (string)$v;
        }
    }

    if (empty($validUpdates)) {
        return false;
    }

    $lines = [];
    if (file_exists($envPath)) {
        $lines = file($envPath, FILE_IGNORE_NEW_LINES);
        if ($lines === false) {
            $lines = [];
        }
    }

    $updatedKeys = [];
    $newLines = [];

    foreach ($lines as $line) {
        $trimmed = trim($line);
        // Preserve comments and empty lines
        if (empty($trimmed) || str_starts_with($trimmed, '#')) {
            $newLines[] = $line;
            continue;
        }

        if (strpos($trimmed, '=') !== false) {
            [$k, ] = explode('=', $trimmed, 2);
            $k = trim($k);

            if (array_key_exists($k, $validUpdates)) {
                $formattedVal = formatEnvValue($validUpdates[$k]);
                $newLines[] = "{$k}={$formattedVal}";
                $updatedKeys[$k] = true;
                // Also update runtime environment
                $_ENV[$k] = $validUpdates[$k];
                putenv("{$k}={$validUpdates[$k]}");
                continue;
            }
        }

        // Keep unedited line
        $newLines[] = $line;
    }

    // Append any allowed keys that were not present in existing .env
    $missingKeys = array_diff_key($validUpdates, $updatedKeys);
    if (!empty($missingKeys)) {
        $newLines[] = "";
        $newLines[] = "# Additional API Configuration (Added via Admin Settings)";
        foreach ($missingKeys as $k => $v) {
            $formattedVal = formatEnvValue($v);
            $newLines[] = "{$k}={$formattedVal}";
            $_ENV[$k] = $v;
            putenv("{$k}={$v}");
        }
    }

    $content = implode("\n", $newLines) . "\n";

    // Write file with lock
    $result = @file_put_contents($envPath, $content, LOCK_EX);
    return ($result !== false);
}

