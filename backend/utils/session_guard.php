<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Validates the current session for 7-day hard timeout and server-side revocation.
 * 
 * @param bool $redirectOnFailure Whether to redirect to login page immediately upon failure.
 * @return bool True if session is valid and active; false if expired or revoked.
 */
function validateUserSession($redirectOnFailure = false) {
    if (empty($_SESSION['user_id'])) {
        if ($redirectOnFailure) {
            $reqUri = $_SERVER['REQUEST_URI'] ?? '';
            $loginUrl = "/auth/login.php";
            if (!empty($reqUri) && strpos($reqUri, '?') !== false) {
                $loginUrl .= "?redirect_to=" . urlencode($reqUri);
            }
            header("Location: " . $loginUrl);
            exit;
        }
        return false;
    }

    $now = time();
    $maxLifetime = 7 * 86400; // 7 days (604,800 seconds)

    // 1. Enforce 7-Day Hard Timeout
    $loginTime = $_SESSION['login_time'] ?? null;
    if ($loginTime && ($now - $loginTime > $maxLifetime)) {
        destroyCurrentSession();
        if ($redirectOnFailure) {
            header("Location: /auth/login.php?error=session_expired");
            exit;
        }
        return false;
    }

    // 2. Check Server-Side Revocation against MongoDB
    global $usersCollection;
    if (!isset($usersCollection)) {
        try {
            require_once __DIR__ . "/../database/config.php";
        } catch (Throwable $e) {}
    }

    if (isset($usersCollection)) {
        try {
            $userId = $_SESSION['user_id'];
            $objectId = (is_string($userId) && strlen($userId) === 24) ? new MongoDB\BSON\ObjectId($userId) : $userId;
            $user = $usersCollection->findOne(['_id' => $objectId]);

            if (!$user) {
                destroyCurrentSession();
                if ($redirectOnFailure) {
                    header("Location: /auth/login.php?error=no_account");
                    exit;
                }
                return false;
            }

            // Check if account has been disabled
            if (isset($user['is_active']) && $user['is_active'] === false) {
                destroyCurrentSession();
                if ($redirectOnFailure) {
                    header("Location: /auth/login.php?error=account_disabled");
                    exit;
                }
                return false;
            }

            // Check if session token was invalidated / revoked
            if (!empty($_SESSION['session_token']) && !empty($user['session_token'])) {
                if ($_SESSION['session_token'] !== $user['session_token']) {
                    destroyCurrentSession();
                    if ($redirectOnFailure) {
                        header("Location: /auth/login.php?error=session_revoked");
                        exit;
                    }
                    return false;
                }
            }
        } catch (Throwable $e) {
            // Keep session alive if database momentarily blips
        }
    }

    $_SESSION['last_activity'] = $now;
    return true;
}

/**
 * Cleanly clear and destroy current PHP session cookies.
 */
function destroyCurrentSession() {
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    @session_destroy();
}

