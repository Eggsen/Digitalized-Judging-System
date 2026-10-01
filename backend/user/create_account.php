<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode([
        "success" => false,
        "message" => "Access denied. Only administrators can create accounts."
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== "POST") {
    echo json_encode([
        "success" => false,
        "message" => "Invalid HTTP request method."
    ]);
    exit;
}

require_once __DIR__ . "/../database/config.php";
require_once __DIR__ . "/../utils/mailer.php";

$rawJson = file_get_contents("php://input");
$data = json_decode($rawJson, true);

if (!$data) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid JSON payload."
    ]);
    exit;
}

$username = trim($data['username'] ?? "");
$email = trim($data['email'] ?? "");
$role = strtolower(trim($data['role'] ?? ""));

if ($username === "" || $email === "" || $role === "") {
    echo json_encode([
        "success" => false,
        "message" => "Username, email, and role are required."
    ]);
    exit;
}

if (!in_array($role, ['judge', 'tabulator'])) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid role. You can only send invitations for Judge or Tabulator accounts."
    ]);
    exit;
}

if (strlen($username) < 3) {
    echo json_encode([
        "success" => false,
        "message" => "Username must be at least 3 characters long."
    ]);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode([
        "success" => false,
        "message" => "Please enter a valid email address."
    ]);
    exit;
}

try {
    $existingUser = $usersCollection->findOne(['username' => $username]);
    if ($existingUser) {
        echo json_encode([
            "success" => false,
            "message" => "Username already exists. Please choose a different username."
        ]);
        exit;
    }

    $existingEmail = $usersCollection->findOne(['email' => $email]);
    if ($existingEmail) {
        echo json_encode([
            "success" => false,
            "message" => "Email address is already registered in the system."
        ]);
        exit;
    }

    $inviteToken = bin2hex(random_bytes(16));

    // Build the pending invited user document
    $newUser = [
        'username' => $username,
        'email' => $email,
        'password' => null,
        'role' => $role,
        'status' => 'pending',
        'invite_token' => $inviteToken,
        'is_active' => true,
        'created_by' => $_SESSION['username'],
        'created_at' => new MongoDB\BSON\UTCDateTime()
    ];

    $result = $usersCollection->insertOne($newUser);

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';
    $inviteLink = "{$protocol}://{$host}/index.php?invite_token={$inviteToken}";

    // Send invitation email
    $subject = "You're Invited! Set Up Your " . ucfirst($role) . " Account | BukSU Judging System";
    $htmlBody = "
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background: #ffffff;'>
            <h2 style='color: #0f172a; margin-top: 0;'>Welcome to BukSU Digitalized Judging System</h2>
            <p style='color: #334155; font-size: 14px;'>Hello <strong>{$username}</strong>,</p>
            <p style='color: #334155; font-size: 14px;'>You have been invited by Administrator <strong>{$_SESSION['username']}</strong> to join as an official <strong>" . ucfirst($role) . "</strong>.</p>
            <p style='color: #334155; font-size: 14px;'>Click the button below to set up your desired password and activate your account:</p>
            <div style='margin: 24px 0; text-align: center;'>
                <a href='{$inviteLink}' style='background-color: #1e1b4b; color: #fbbf24; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px;'>Accept Invitation & Set Password</a>
            </div>
            <p style='color: #64748b; font-size: 12px;'>Or copy and paste this URL into your browser:<br><a href='{$inviteLink}' style='color: #4f46e5;'>{$inviteLink}</a></p>
            <hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;'>
            <p style='color: #94a3b8; font-size: 11px; text-align: center;'>&copy; 2026 BukSU Digitalized Judging System</p>
        </div>
    ";

    sendSystemEmail($email, $subject, $htmlBody);

    if ($result->getInsertedCount() > 0) {
        echo json_encode([
            "success" => true,
            "message" => "Invitation sent to {$email} for " . ucfirst($role) . " \"{$username}\".",
            "invite_token" => $inviteToken,
            "invite_link" => $inviteLink,
            "username" => $username,
            "email" => $email,
            "role" => $role
        ]);
    } else {
        echo json_encode([
            "success" => false,
            "message" => "Failed to generate invitation. Please try again."
        ]);
    }

} catch (Throwable $e) {
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
    exit;
}
