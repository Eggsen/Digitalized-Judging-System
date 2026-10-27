<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// If already authenticated, redirect to dashboard
if (isset($_SESSION['user_id']) && !empty($_SESSION['username'])) {
    header("Location: /dashboard.php");
    exit;
}

require_once __DIR__ . "/../database/config.php";

$clientId = $_ENV['GOOGLE_CLIENT_ID'] ?? '';
$redirectUri = $_ENV['GOOGLE_REDIRECT_URI'] ?? 'http://localhost:8000/backend/auth/google_callback.php';

if (empty($clientId)) {
    header("Location: /auth/login.php?error=oauth_config_missing");
    exit;
}

// Generate cryptographically secure state token to prevent CSRF
$state = bin2hex(random_bytes(16));
$_SESSION['oauth2_state'] = $state;

$params = [
    'client_id'     => $clientId,
    'redirect_uri'  => $redirectUri,
    'response_type' => 'code',
    'scope'         => 'openid profile email',
    'state'         => $state,
    'access_type'   => 'online',
    'prompt'        => 'select_account'
];

$authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($params);

header("Location: " . $authUrl);
exit;
