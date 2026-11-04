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

    // Helper to strip accidental quotes and whitespace from environment variables (e.g., entered in Render UI)
    $cleanEnv = function($val, $default = '') {
        if ($val === null || $val === false || $val === '') return $default;
        return trim((string)$val, " \t\n\r\0\x0B\"'");
    };

    $smtpHost = $cleanEnv($_ENV['SMTP_HOST'] ?? getenv('SMTP_HOST'), 'smtp.gmail.com');
    $smtpPort = (int)$cleanEnv($_ENV['SMTP_PORT'] ?? getenv('SMTP_PORT'), '587');
    $smtpUsername = $cleanEnv($_ENV['SMTP_USERNAME'] ?? getenv('SMTP_USERNAME'), '');
    $rawPassword = $cleanEnv($_ENV['SMTP_PASSWORD'] ?? getenv('SMTP_PASSWORD'), '');
    // Google App Passwords are 16 letters, often copied with spaces (e.g. "abcd efgh ijkl mnop"). Strip spaces automatically.
    $smtpPassword = str_replace(' ', '', $rawPassword);
    $smtpFromEmail = $cleanEnv($_ENV['SMTP_FROM_EMAIL'] ?? getenv('SMTP_FROM_EMAIL'), $smtpUsername);
    $smtpFromName = $cleanEnv($_ENV['SMTP_FROM_NAME'] ?? getenv('SMTP_FROM_NAME'), 'BukSU Judging System');

    // HTTP-based Email API (HTTPS Port 443 - Permitted on Render Free Tier where SMTP ports 25/465/587 are blocked)
    $brevoApiKey = $cleanEnv($_ENV['BREVO_API_KEY'] ?? getenv('BREVO_API_KEY') ?: ($_ENV['SENDINBLUE_API_KEY'] ?? getenv('SENDINBLUE_API_KEY')));

    $mailSent = false;
    $errorMessage = null;
    $deliveryMethod = "None";

    // 1. Check Brevo HTTP API (HTTPS port 443)
    if (!empty($brevoApiKey)) {
        try {
            $senderEmail = !empty($smtpFromEmail) ? $smtpFromEmail : (!empty($smtpUsername) ? $smtpUsername : 'noreply@buksu.edu.ph');
            $payload = [
                'sender' => [
                    'name'  => $smtpFromName,
                    'email' => $senderEmail
                ],
                'to' => [
                    ['email' => $toEmail]
                ],
                'subject'     => $subject,
                'htmlContent' => $htmlMessage,
                'textContent' => strip_tags($htmlMessage)
            ];

            $ch = curl_init('https://api.brevo.com/v3/smtp/email');
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 15,
                CURLOPT_HTTPHEADER     => [
                    'Accept: application/json',
                    'Content-Type: application/json',
                    'api-key: ' . $brevoApiKey
                ],
                CURLOPT_POSTFIELDS     => json_encode($payload),
                CURLOPT_SSL_VERIFYPEER => true
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErr = curl_error($ch);
            curl_close($ch);

            if ($response !== false && ($httpCode === 200 || $httpCode === 201)) {
                $mailSent = true;
                $deliveryMethod = "Brevo HTTP API";
            } else {
                $errJson = json_decode($response, true);
                $apiMsg = $errJson['message'] ?? ($curlErr ?: "HTTP {$httpCode}");
                $errorMessage = "Brevo API Error: {$apiMsg}";
            }
        } catch (Throwable $e) {
            $errorMessage = "Brevo API Exception: " . $e->getMessage();
        }
    }
    // 2. Fallback to PHPMailer SMTP (Ports 587/465 — Works locally, but blocked on Render Free Tier)
    elseif (class_exists('PHPMailer\PHPMailer\PHPMailer') && !empty($smtpUsername) && !empty($smtpPassword)) {
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
            $mail->Timeout    = 8;
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
            $deliveryMethod = "PHPMailer SMTP ({$smtpHost}:{$smtpPort})";
        } catch (Throwable $e) {
            $mailSent = false;
            $rawErr = $e->getMessage();
            if (stripos($rawErr, 'Could not connect to SMTP host') !== false || stripos($rawErr, 'Failed to connect to server') !== false) {
                $errorMessage = "SMTP Connection Blocked: Cannot connect to {$smtpHost}:{$smtpPort}. (Note: Free hosting tiers like Render block outbound SMTP ports 25, 465, and 587 to prevent spam. Add BREVO_API_KEY to your Render environment variables to send over HTTPS port 443).";
            } else {
                $errorMessage = "SMTP Error: {$rawErr}";
            }
        }
    } else {
        // Fallback to standard PHP mail() if PHPMailer is missing or SMTP credentials are not set
        $headers  = "MIME-Version: 1.0" . "\r\n";
        $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
        $headers .= "From: BukSU Judging System <noreply@buksu.edu.ph>" . "\r\n";
        try {
            @$mailSent = mail($toEmail, $subject, $htmlMessage, $headers);
            $deliveryMethod = "PHP mail()";
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
    $statusText = $mailSent ? "SUCCESS ({$deliveryMethod})" : "FAILED ({$deliveryMethod})";
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
        "delivery_method" => $deliveryMethod,
        "error" => $errorMessage
    ];
}
