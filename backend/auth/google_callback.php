<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . "/../database/config.php";

// Check if Google returned an error or if the user cancelled
if (!empty($_GET['error'])) {
    $error = htmlspecialchars($_GET['error']);
    header("Location: /auth/login.php?error=oauth_denied&details=" . urlencode($error));
    exit;
}

// CSRF State Token Verification
$state = $_GET['state'] ?? '';
$savedState = $_SESSION['oauth2_state'] ?? '';
unset($_SESSION['oauth2_state']);

if (empty($state) || empty($savedState) || !hash_equals($savedState, $state)) {
    header("Location: /auth/login.php?error=invalid_state");
    exit;
}

$code = $_GET['code'] ?? '';
if (empty($code)) {
    header("Location: /auth/login.php?error=no_code");
    exit;
}

$clientId     = $_ENV['GOOGLE_CLIENT_ID'] ?? '';
$clientSecret = $_ENV['GOOGLE_CLIENT_SECRET'] ?? '';
$redirectUri  = $_ENV['GOOGLE_REDIRECT_URI'] ?? 'http://localhost:8000/backend/auth/google_callback.php';

if (empty($clientId) || empty($clientSecret)) {
    header("Location: /auth/login.php?error=oauth_config_missing");
    exit;
}

// 1. Exchange authorization code for access token
$tokenEndpoint = "https://oauth2.googleapis.com/token";
$postData = [
    'code'          => $code,
    'client_id'     => $clientId,
    'client_secret' => $clientSecret,
    'redirect_uri'  => $redirectUri,
    'grant_type'    => 'authorization_code'
];

$ch = curl_init($tokenEndpoint);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => http_build_query($postData),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/x-www-form-urlencoded'
    ],
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_SSL_VERIFYPEER => true
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false || $httpCode !== 200) {
    error_log("Google Token Exchange Failed: HTTP $httpCode - " . ($curlError ?: $response));
    header("Location: /auth/login.php?error=token_exchange_failed");
    exit;
}

$tokenData = json_decode($response, true);
$accessToken = $tokenData['access_token'] ?? null;

if (!$accessToken) {
    header("Location: /auth/login.php?error=missing_access_token");
    exit;
}

// 2. Fetch user profile from Google UserInfo endpoint
$userInfoEndpoint = "https://www.googleapis.com/oauth2/v3/userinfo";
$ch = curl_init($userInfoEndpoint);
curl_setopt_array($ch, [
    CURLOPT_HTTPGET        => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $accessToken
    ],
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_SSL_VERIFYPEER => true
]);

$userResponse = curl_exec($ch);
$userHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$userCurlError = curl_error($ch);
curl_close($ch);

if ($userResponse === false || $userHttpCode !== 200) {
    error_log("Google UserInfo Request Failed: HTTP $userHttpCode - " . ($userCurlError ?: $userResponse));
    header("Location: /auth/login.php?error=userinfo_failed");
    exit;
}

$googleUser = json_decode($userResponse, true);
$googleEmail = trim($googleUser['email'] ?? '');
$emailVerified = !empty($googleUser['email_verified']);

if (empty($googleEmail) || !$emailVerified) {
    header("Location: /auth/login.php?error=unverified_email");
    exit;
}

try {
    // 3. Match Google account with an existing user in MongoDB
    $user = $usersCollection->findOne([
        'email' => new MongoDB\BSON\Regex('^' . preg_quote($googleEmail, '/') . '$', 'i')
    ]);

    if (!$user) {
        // As configured: Existing users only. Reject unknown Google accounts.
        header("Location: /auth/login.php?error=no_account&email=" . urlencode($googleEmail));
        exit;
    }

    // 4. Check if account is active
    if (isset($user['is_active']) && $user['is_active'] === false) {
        header("Location: /auth/login.php?error=account_disabled");
        exit;
    }

    // 5. Update user document with google_id, last_login, and activate status if pending
    $updateFields = [
        'google_id'   => (string)($googleUser['sub'] ?? ''),
        'last_login'  => new MongoDB\BSON\UTCDateTime(),
        'status'      => 'active'
    ];

    if (!empty($googleUser['picture']) && empty($user['avatar'])) {
        $updateFields['avatar'] = $googleUser['picture'];
    }

    $usersCollection->updateOne(
        ['_id' => $user['_id']],
        ['$set' => $updateFields]
    );

    // 6. Establish authenticated session
    $_SESSION['user_id'] = (string)$user['_id'];
    $_SESSION['username'] = $user['username'] ?? explode('@', $googleEmail)[0];
    $_SESSION['email'] = $user['email'] ?? $googleEmail;
    $_SESSION['role'] = strtolower($user['role'] ?? 'user');

    if (isset($user['preferences']) && (is_array($user['preferences']) || is_object($user['preferences']))) {
        $_SESSION['preferences'] = (array)$user['preferences'];
    } else {
        $_SESSION['preferences'] = ['theme' => 'light', 'colorRule' => 'normal', 'navPlacement' => 'top'];
    }

    // 7. Successfully authenticated, redirect to dashboard
    header("Location: /dashboard.php");
    exit;

} catch (Throwable $e) {
    error_log("Google Auth DB Error: " . $e->getMessage());
    header("Location: /auth/login.php?error=auth_exception");
    exit;
}
