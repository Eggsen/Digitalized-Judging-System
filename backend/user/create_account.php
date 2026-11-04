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

$email = trim($data['email'] ?? "");
$role = strtolower(trim($data['role'] ?? ""));

if ($email === "" || $role === "") {
    echo json_encode([
        "success" => false,
        "message" => "Role and email are required."
    ]);
    exit;
}

if (!in_array($role, ['admin', 'judge', 'tabulator'])) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid role. You can only send invitations for Admin, Judge, or Tabulator accounts."
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
    $existingEmail = $usersCollection->findOne(['email' => $email]);
    if ($existingEmail) {
        echo json_encode([
            "success" => false,
            "message" => "Email address is already registered in the system."
        ]);
        exit;
    }

    $inviteToken = bin2hex(random_bytes(16));
    $inviteExpiresAt = new MongoDB\BSON\UTCDateTime((time() + (7 * 86400)) * 1000); // 7-day token validity window

    // Build the pending invited user document (no username; invited user inputs their name upon activation)
    $newUser = [
        'first_name' => null,
        'last_name' => null,
        'name' => null,
        'username' => null,
        'email' => $email,
        'password' => null,
        'role' => $role,
        'status' => 'pending',
        'invite_token' => $inviteToken,
        'invite_expires_at' => $inviteExpiresAt,
        'is_active' => true,
        'created_by' => $_SESSION['username'] ?? 'admin',
        'created_at' => new MongoDB\BSON\UTCDateTime()
    ];

    $result = $usersCollection->insertOne($newUser);

    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $protocol = $isHttps ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';
    $inviteLink = "{$protocol}://{$host}/auth/accept-invitation.php?invite_token={$inviteToken}";

    // Send invitation email
    $roleDisplay = ucfirst($role);
    $inviter = htmlspecialchars($_SESSION['username'] ?? 'Admin');
    $subject = "You're Invited! Set Up Your {$roleDisplay} Account | BukSU Judging System";
    $htmlBody = "
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background: #ffffff;'>
            <h2 style='color: #0f172a; margin-top: 0;'>Welcome to BukSU Digitalized Judging System</h2>
            <p style='color: #334155; font-size: 14px;'>Hello,</p>
            <p style='color: #334155; font-size: 14px;'>You have been invited by Administrator <strong>{$inviter}</strong> to join as an official <strong>{$roleDisplay}</strong>.</p>
            <p style='color: #334155; font-size: 14px;'>Click the button below to provide your first and last name, set up your password, and activate your account:</p>
            <div style='margin: 24px 0; text-align: center;'>
                <a href='{$inviteLink}' style='background-color: #1e1b4b; color: #fbbf24; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px;'>Accept Invitation & Set Up Account</a>
            </div>
            <p style='color: #64748b; font-size: 12px;'>Or copy and paste this URL into your browser:<br><a href='{$inviteLink}' style='color: #4f46e5;'>{$inviteLink}</a></p>
            <hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;'>
            <p style='color: #94a3b8; font-size: 11px; text-align: center;'>&copy; 2026 BukSU Digitalized Judging System</p>
        </div>
    ";

    $emailResult = sendSystemEmail($email, $subject, $htmlBody);
    $emailSent = !empty($emailResult['sent']);

    if ($result->getInsertedCount() > 0) {
        $msg = $emailSent 
            ? "Invitation email successfully sent to {$email}." 
            : "Invitation created, but automated email could not be sent" . (!empty($emailResult['error']) ? ": {$emailResult['error']}" : " (check SMTP settings)") . ". Please copy and share the link below manually.";

        echo json_encode([
            "success" => true,
            "email_sent" => $emailSent,
            "email_error" => $emailResult['error'] ?? null,
            "message" => $msg,
            "invite_token" => $inviteToken,
            "invite_link" => $inviteLink,
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
