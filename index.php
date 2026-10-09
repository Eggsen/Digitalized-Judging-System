<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!empty($_GET['invite_token']) || !empty($_GET['token'])) {
    $token = $_GET['invite_token'] ?? $_GET['token'];
    header("Location: /auth/accept-invitation.php?invite_token=" . urlencode($token));
    exit;
}

if (!empty($_GET['reset_token'])) {
    $token = $_GET['reset_token'];
    header("Location: /auth/reset-password.php?reset_token=" . urlencode($token));
    exit;
}

if (isset($_SESSION['user_id']) && !empty($_SESSION['username'])) {
    header("Location: /dashboard.php");
    exit;
}

header("Location: /auth/login.php");
exit;