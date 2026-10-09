<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . "/../database/config.php";
require_once __DIR__ . "/../utils/mailer.php";

$method = $_SERVER['REQUEST_METHOD'];

if ($method === "GET") {
    $token = trim($_GET['token'] ?? $_GET['reset_token'] ?? "");
    if ($token === "") {
        echo json_encode(["success" => false, "message" => "Reset token is required."]);
        exit;
    }

    try {
        $user = $usersCollection->findOne(['reset_token' => $token]);
        if (!$user) {
            echo json_encode(["success" => false, "message" => "Invalid or expired password reset token."]);
            exit;
        }

        echo json_encode([
            "success" => true,
            "username" => $user['username'] ?? '',
            "email" => $user['email'] ?? '',
            "role" => $user['role'] ?? ''
        ]);
        exit;
    } catch (Throwable $e) {
        echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
        exit;
    }
}

if ($method !== "POST") {
    echo json_encode(["success" => false, "message" => "Invalid HTTP request method."]);
    exit;
}

$rawJson = file_get_contents("php://input");
$data = json_decode($rawJson, true);

if (!$data) {
    echo json_encode(["success" => false, "message" => "Invalid JSON payload."]);
    exit;
}

$action = trim($data['action'] ?? "");

// Request password reset email
if ($action === "request_reset") {
    $identifier = trim($data['email'] ?? $data['identifier'] ?? "");

    if ($identifier === "") {
        echo json_encode(["success" => false, "message" => "Please enter your registered email address."]);
        exit;
    }

    try {
        $user = $usersCollection->findOne([
            '$or' => [
                ['email' => $identifier],
                ['username' => $identifier]
            ]
        ]);

        if (!$user) {
            echo json_encode([
                "success" => false,
                "message" => "No account found matching the provided email or username."
            ]);
            exit;
        }

        if (empty($user['email'])) {
            echo json_encode([
                "success" => false,
                "message" => "This account does not have a registered email address. Please contact an administrator."
            ]);
            exit;
        }

        if (isset($user['is_active']) && $user['is_active'] === false) {
            echo json_encode([
                "success" => false,
                "message" => "Account is disabled. Please contact your administrator."
            ]);
            exit;
        }

        $resetToken = bin2hex(random_bytes(16));

        $usersCollection->updateOne(
            ['_id' => $user['_id']],
            [
                '$set' => [
                    'reset_token' => $resetToken,
                    'reset_requested_at' => new MongoDB\BSON\UTCDateTime()
                ]
            ]
        );

        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';
        $resetLink = "{$protocol}://{$host}/auth/reset-password.php?reset_token={$resetToken}";

        $subject = "Reset Your Password | BukSU Digitalized Judging System";
        $htmlBody = "
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background: #ffffff;'>
                <h2 style='color: #0f172a; margin-top: 0;'>Password Reset Request</h2>
                <p style='color: #334155; font-size: 14px;'>Hello <strong>" . htmlspecialchars($user['username']) . "</strong>,</p>
                <p style='color: #334155; font-size: 14px;'>We received a request to reset the password for your <strong>" . ucfirst($user['role']) . "</strong> account.</p>
                <p style='color: #334155; font-size: 14px;'>Click the button below to set a new password:</p>
                <div style='margin: 24px 0; text-align: center;'>
                    <a href='{$resetLink}' style='background-color: #1e1b4b; color: #fbbf24; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px;'>Reset My Password</a>
                </div>
                <p style='color: #64748b; font-size: 12px;'>Or copy and paste this link into your browser:<br><a href='{$resetLink}' style='color: #4f46e5;'>{$resetLink}</a></p>
                <hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;'>
                <p style='color: #94a3b8; font-size: 11px; text-align: center;'>If you did not request this password reset, you can safely ignore this email.</p>
            </div>
        ";

        sendSystemEmail($user['email'], $subject, $htmlBody);

        echo json_encode([
            "success" => true,
            "message" => "Password reset email sent to " . htmlspecialchars($user['email']) . ".",
            "reset_link" => $resetLink
        ]);
        exit;

    } catch (Throwable $e) {
        echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
        exit;
    }

} elseif ($action === "complete_reset" || $action === "reset") {
    $token = trim($data['reset_token'] ?? $data['token'] ?? "");
    $newPassword = trim($data['new_password'] ?? "");
    $confirmPassword = trim($data['confirm_password'] ?? "");

    if ($token === "") {
        echo json_encode(["success" => false, "message" => "Reset token is missing."]);
        exit;
    }

    if ($newPassword === "" || $confirmPassword === "") {
        echo json_encode(["success" => false, "message" => "Please fill in all password fields."]);
        exit;
    }

    if ($newPassword !== $confirmPassword) {
        echo json_encode(["success" => false, "message" => "Passwords do not match."]);
        exit;
    }

    if (strlen($newPassword) < 6) {
        echo json_encode(["success" => false, "message" => "Password must be at least 6 characters long."]);
        exit;
    }

    try {
        $user = $usersCollection->findOne(['reset_token' => $token]);
        if (!$user) {
            echo json_encode(["success" => false, "message" => "Invalid or expired reset link."]);
            exit;
        }

        $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);

        $result = $usersCollection->updateOne(
            ['_id' => $user['_id']],
            [
                '$set' => [
                    'password' => $hashedPassword,
                    'status' => 'active',
                    'is_active' => true
                ],
                '$unset' => [
                    'reset_token' => ""
                ]
            ]
        );

        if ($result->getModifiedCount() > 0) {
            echo json_encode([
                "success" => true,
                "message" => "Password reset successfully! You can now log in with your new password.",
                "username" => $user['username']
            ]);
        } else {
            echo json_encode(["success" => false, "message" => "Password was not changed. Please try again."]);
        }
        exit;

    } catch (Throwable $e) {
        echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
        exit;
    }
} else {
    echo json_encode(["success" => false, "message" => "Unknown action."]);
    exit;
}
