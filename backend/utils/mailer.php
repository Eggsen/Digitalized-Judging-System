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

    // HTTP-based Email APIs (HTTPS Port 443 - Permitted on Render Free Tier where SMTP ports 25/465/587 are blocked)
    $mailjetKey = $cleanEnv($_ENV['MAILJET_API_KEY'] ?? getenv('MAILJET_API_KEY'));
    $mailjetSecret = $cleanEnv($_ENV['MAILJET_SECRET_KEY'] ?? getenv('MAILJET_SECRET_KEY'));
    $awsKeyId = $cleanEnv($_ENV['AWS_ACCESS_KEY_ID'] ?? getenv('AWS_ACCESS_KEY_ID') ?: ($_ENV['AWS_SES_KEY'] ?? getenv('AWS_SES_KEY')));
    $awsSecret = $cleanEnv($_ENV['AWS_SECRET_ACCESS_KEY'] ?? getenv('AWS_SECRET_ACCESS_KEY') ?: ($_ENV['AWS_SES_SECRET'] ?? getenv('AWS_SES_SECRET')));
    $awsRegion = $cleanEnv($_ENV['AWS_REGION'] ?? getenv('AWS_REGION') ?: 'us-east-1');
    $sendgridApiKey = $cleanEnv($_ENV['SENDGRID_API_KEY'] ?? getenv('SENDGRID_API_KEY'));
    $brevoApiKey = $cleanEnv($_ENV['BREVO_API_KEY'] ?? getenv('BREVO_API_KEY') ?: ($_ENV['SENDINBLUE_API_KEY'] ?? getenv('SENDINBLUE_API_KEY')));
    $resendApiKey = $cleanEnv($_ENV['RESEND_API_KEY'] ?? getenv('RESEND_API_KEY'));

    $mailSent = false;
    $errorMessage = null;
    $deliveryMethod = "None";

    // 1. Check Mailjet API (HTTPS port 443)
    if (!empty($mailjetKey) && !empty($mailjetSecret)) {
        try {
            $senderEmail = !empty($smtpFromEmail) ? $smtpFromEmail : (!empty($smtpUsername) ? $smtpUsername : 'tanneryoly07@gmail.com');
            $payload = json_encode([
                'Messages' => [
                    [
                        'From' => [
                            'Email' => $senderEmail,
                            'Name'  => $smtpFromName
                        ],
                        'To' => [
                            [
                                'Email' => $toEmail
                            ]
                        ],
                        'Subject'  => $subject,
                        'HTMLPart' => $htmlMessage,
                        'TextPart' => strip_tags($htmlMessage)
                    ]
                ]
            ]);

            $ch = curl_init('https://api.mailjet.com/v3.1/send');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $payload,
                CURLOPT_USERPWD        => "{$mailjetKey}:{$mailjetSecret}",
                CURLOPT_HTTPHEADER     => [
                    'Content-Type: application/json'
                ],
                CURLOPT_TIMEOUT        => 15,
                CURLOPT_SSL_VERIFYPEER => true
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErr = curl_error($ch);
            curl_close($ch);

            if ($response !== false && ($httpCode === 200 || $httpCode === 201)) {
                $mailSent = true;
                $deliveryMethod = "Mailjet API";
            } else {
                $errJson = json_decode($response, true);
                $apiMsg = $errJson['ErrorMessage'] ?? ($errJson['Messages'][0]['Errors'][0]['ErrorMessage'] ?? ($curlErr ?: "HTTP {$httpCode}"));
                $errorMessage = "Mailjet API Error: {$apiMsg}";
            }
        } catch (Throwable $e) {
            $errorMessage = "Mailjet API Exception: " . $e->getMessage();
        }
    }
    // 2. Check Amazon SES API (HTTPS port 443 via SigV4)
    elseif (!empty($awsKeyId) && !empty($awsSecret)) {
        try {
            $senderEmail = !empty($smtpFromEmail) ? $smtpFromEmail : (!empty($smtpUsername) ? $smtpUsername : 'tanneryoly07@gmail.com');
            $fromHeader = !empty($smtpFromName) ? "{$smtpFromName} <{$senderEmail}>" : $senderEmail;

            $host = "email.{$awsRegion}.amazonaws.com";
            $url = "https://{$host}/v2/email/outbound-emails";

            $payload = json_encode([
                'FromEmailAddress' => $fromHeader,
                'Destination' => [
                    'ToAddresses' => [$toEmail]
                ],
                'Content' => [
                    'Simple' => [
                        'Subject' => [
                            'Data'    => $subject,
                            'Charset' => 'UTF-8'
                        ],
                        'Body' => [
                            'Html' => [
                                'Data'    => $htmlMessage,
                                'Charset' => 'UTF-8'
                            ],
                            'Text' => [
                                'Data'    => strip_tags($htmlMessage),
                                'Charset' => 'UTF-8'
                            ]
                        ]
                    ]
                ]
            ]);

            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CUSTOMREQUEST  => 'POST',
                CURLOPT_POSTFIELDS     => $payload,
                CURLOPT_AWS_SIGV4      => "aws:amz:{$awsRegion}:ses",
                CURLOPT_USERPWD        => "{$awsKeyId}:{$awsSecret}",
                CURLOPT_HTTPHEADER     => [
                    'Content-Type: application/json',
                    'Host: ' . $host
                ],
                CURLOPT_TIMEOUT        => 15,
                CURLOPT_SSL_VERIFYPEER => true
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErr = curl_error($ch);
            curl_close($ch);

            if ($response !== false && ($httpCode === 200 || $httpCode === 202)) {
                $mailSent = true;
                $deliveryMethod = "Amazon SES API ({$awsRegion})";
            } else {
                $errJson = json_decode($response, true);
                $apiMsg = $errJson['message'] ?? ($errJson['Message'] ?? ($curlErr ?: "HTTP {$httpCode} - {$response}"));
                $errorMessage = "Amazon SES Error: {$apiMsg}";
            }
        } catch (Throwable $e) {
            $errorMessage = "Amazon SES Exception: " . $e->getMessage();
        }
    }
    // 3. Check SendGrid HTTP API (HTTPS port 443)
    elseif (!empty($sendgridApiKey)) {
        try {
            $senderEmail = !empty($smtpFromEmail) ? $smtpFromEmail : (!empty($smtpUsername) ? $smtpUsername : 'tanneryoly07@gmail.com');
            $payload = [
                'personalizations' => [
                    [
                        'to' => [
                            ['email' => $toEmail]
                        ],
                        'subject' => $subject
                    ]
                ],
                'from' => [
                    'email' => $senderEmail,
                    'name'  => $smtpFromName
                ],
                'content' => [
                    [
                        'type'  => 'text/plain',
                        'value' => strip_tags($htmlMessage)
                    ],
                    [
                        'type'  => 'text/html',
                        'value' => $htmlMessage
                    ]
                ]
            ];

            $ch = curl_init('https://api.sendgrid.com/v3/mail/send');
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 15,
                CURLOPT_HTTPHEADER     => [
                    'Authorization: Bearer ' . $sendgridApiKey,
                    'Content-Type: application/json'
                ],
                CURLOPT_POSTFIELDS     => json_encode($payload),
                CURLOPT_SSL_VERIFYPEER => true
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErr = curl_error($ch);
            curl_close($ch);

            if ($response !== false && ($httpCode === 200 || $httpCode === 202)) {
                $mailSent = true;
                $deliveryMethod = "SendGrid Web API";
            } else {
                $errJson = json_decode($response, true);
                $apiMsg = '';
                if (isset($errJson['errors']) && is_array($errJson['errors'])) {
                    $msgs = array_map(function($e) { return $e['message'] ?? ''; }, $errJson['errors']);
                    $apiMsg = implode('; ', array_filter($msgs));
                }
                if (empty($apiMsg)) {
                    $apiMsg = $curlErr ?: "HTTP {$httpCode} - {$response}";
                }
                $errorMessage = "SendGrid API Error: {$apiMsg}";
            }
        } catch (Throwable $e) {
            $errorMessage = "SendGrid API Exception: " . $e->getMessage();
        }
    }
    // 4. Check Brevo HTTP API (HTTPS port 443)
    elseif (!empty($brevoApiKey)) {
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
    // 5. Check Resend HTTP API (HTTPS port 443)
    elseif (!empty($resendApiKey)) {
        try {
            $senderEmail = !empty($smtpFromEmail) ? $smtpFromEmail : 'onboarding@resend.dev';
            $fromHeader = !empty($smtpFromName) ? "{$smtpFromName} <{$senderEmail}>" : $senderEmail;

            $payload = [
                'from'    => $fromHeader,
                'to'      => [$toEmail],
                'subject' => $subject,
                'html'    => $htmlMessage,
                'text'    => strip_tags($htmlMessage)
            ];

            $ch = curl_init('https://api.resend.com/emails');
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 15,
                CURLOPT_HTTPHEADER     => [
                    'Authorization: Bearer ' . $resendApiKey,
                    'Content-Type: application/json'
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
                $deliveryMethod = "Resend HTTP API";
            } else {
                $errJson = json_decode($response, true);
                $apiMsg = $errJson['message'] ?? ($curlErr ?: "HTTP {$httpCode}");
                $errorMessage = "Resend API Error: {$apiMsg}";
            }
        } catch (Throwable $e) {
            $errorMessage = "Resend API Exception: " . $e->getMessage();
        }
    }
    // 6. Fallback to PHPMailer SMTP (Ports 587/465 — Works locally, but blocked on Render Free Tier)
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
                $errorMessage = "SMTP Connection Blocked: Cannot connect to {$smtpHost}:{$smtpPort}. (Note: Free hosting tiers like Render block outbound SMTP ports 25, 465, and 587 to prevent spam. Use an API key like MAILJET_API_KEY, AWS_ACCESS_KEY_ID, or SENDGRID_API_KEY to send over HTTPS port 443).";
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
