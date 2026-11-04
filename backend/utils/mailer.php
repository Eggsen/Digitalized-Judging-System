<?php

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\SMTP;

if (file_exists(__DIR__ . "/../../vendor/autoload.php")) {
    require_once __DIR__ . "/../../vendor/autoload.php";
}

function sendSystemEmail($toEmail, $subject, $htmlMessage, $bypassSettingCheck = false) {
    // Check if the administrator disabled outgoing system email service
    if (!$bypassSettingCheck) {
        global $settingsCollection;
        if (!isset($settingsCollection)) {
            try {
                require_once __DIR__ . "/../database/config.php";
            } catch (Throwable $e) {}
        }
        if (isset($settingsCollection)) {
            try {
                $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']);
                if ($settingsDoc && isset($settingsDoc['security']['emailServiceEnabled']) && $settingsDoc['security']['emailServiceEnabled'] === false) {
                    $logDir = __DIR__ . "/../logs";
                    if (!file_exists($logDir)) {
                        @mkdir($logDir, 0777, true);
                    }
                    $logFile = $logDir . "/sent_emails.log";
                    $logEntry = "[" . date('Y-m-d H:i:s') . "] STATUS: BLOCKED (Email dispatch disabled by administrator in Settings)\n"
                              . "TO: {$toEmail} | SUBJECT: {$subject}\n"
                              . "---------------------------------------------------------\n";
                    @file_put_contents($logFile, $logEntry, FILE_APPEND);

                    return [
                        "sent" => false,
                        "logged" => true,
                        "disabled" => true,
                        "error" => "Email service has been disabled by the administrator in Settings."
                    ];
                }
            } catch (Throwable $e) {}
        }
    }

    $smtpHost = trim($_ENV['SMTP_HOST'] ?? getenv('SMTP_HOST') ?: 'smtp.gmail.com');
    $smtpPort = (int)($_ENV['SMTP_PORT'] ?? getenv('SMTP_PORT') ?: 587);
    $smtpUsername = trim($_ENV['SMTP_USERNAME'] ?? getenv('SMTP_USERNAME') ?: '');
    $rawPassword = trim($_ENV['SMTP_PASSWORD'] ?? getenv('SMTP_PASSWORD') ?: '');
    // Google App Passwords are 16 letters, often copied with spaces (e.g. "abcd efgh ijkl mnop"). Strip spaces automatically.
    $smtpPassword = str_replace(' ', '', $rawPassword);
    $smtpFromEmail = trim($_ENV['SMTP_FROM_EMAIL'] ?? getenv('SMTP_FROM_EMAIL') ?: $smtpUsername);
    $smtpFromName = trim($_ENV['SMTP_FROM_NAME'] ?? getenv('SMTP_FROM_NAME') ?: 'BukSU Judging System');

    $mailSent = false;
    $errorMessage = null;

    if (class_exists('PHPMailer\PHPMailer\PHPMailer') && !empty($smtpUsername) && !empty($smtpPassword)) {
        try {
            $mail = new PHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = $smtpHost;
            $mail->SMTPAuth   = true;
            $mail->Username   = $smtpUsername;
            $mail->Password   = $smtpPassword;
            if ($smtpPort === 465) {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            } else {
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            }
            $mail->Port       = $smtpPort;
            $mail->Timeout    = 10;
            $mail->SMTPOptions = [
                'ssl' => [
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                    'allow_self_signed' => true
                ]
            ];

            $mail->setFrom($smtpFromEmail ?: $smtpUsername, $smtpFromName);
            $mail->addAddress($toEmail);

            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $htmlMessage;
            $mail->AltBody = strip_tags($htmlMessage);

            $mail->send();
            $mailSent = true;
        } catch (Throwable $e) {
            $mailSent = false;
            $errorMessage = $e->getMessage();
        }
    } else {
        // Fallback to standard PHP mail() if PHPMailer is missing or SMTP credentials are not set
        $headers  = "MIME-Version: 1.0" . "\r\n";
        $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
        $headers .= "From: BukSU Judging System <noreply@buksu.edu.ph>" . "\r\n";
        try {
            @$mailSent = mail($toEmail, $subject, $htmlMessage, $headers);
        } catch (Throwable $e) {
            $mailSent = false;
        }
    }

    // Always log emails to local log file for testing & auditing
    $logDir = __DIR__ . "/../logs";
    if (!file_exists($logDir)) {
        @mkdir($logDir, 0777, true);
    }

    $logFile = $logDir . "/sent_emails.log";
    $statusText = $mailSent ? "SUCCESS (SMTP/Mail)" : "LOGGED (SMTP credentials needed in .env)";
    if ($errorMessage) {
        $statusText .= " | Error: {$errorMessage}";
    }

    $logEntry = "[" . date('Y-m-d H:i:s') . "] STATUS: {$statusText}\n"
              . "TO: {$toEmail} | SUBJECT: {$subject}\n"
              . "BODY: " . strip_tags($htmlMessage) . "\n"
              . "---------------------------------------------------------\n";
    @file_put_contents($logFile, $logEntry, FILE_APPEND);

    return [
        "sent" => $mailSent,
        "logged" => true,
        "error" => $errorMessage
    ];
}
