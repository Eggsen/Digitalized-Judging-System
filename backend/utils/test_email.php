<?php

/**
 * Diagnostic CLI tool to test email dispatch (Mailjet / AWS SES / SendGrid / Brevo / Resend / SMTP).
 * Usage:
 *   php backend/utils/test_email.php [recipient_email]
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    die("This script can only be run via CLI.\n");
}

require_once __DIR__ . '/mailer.php';

$recipient = $argv[1] ?? ($_ENV['SMTP_USERNAME'] ?? getenv('SMTP_USERNAME') ?: 'tanneryoly07@gmail.com');

echo "\n=== BukSU Digitalized Judging System - Email Diagnostics ===\n";
echo "Testing delivery to: {$recipient}\n\n";

$cleanEnv = function($val, $default = '') {
    if ($val === null || $val === false || $val === '') return $default;
    return trim((string)$val, " \t\n\r\0\x0B\"'");
};

$smtpHost = $cleanEnv($_ENV['SMTP_HOST'] ?? getenv('SMTP_HOST'), 'smtp.gmail.com');
$smtpPort = (int)$cleanEnv($_ENV['SMTP_PORT'] ?? getenv('SMTP_PORT'), '587');
$smtpUsername = $cleanEnv($_ENV['SMTP_USERNAME'] ?? getenv('SMTP_USERNAME'), '');
$mailjetKey = $cleanEnv($_ENV['MAILJET_API_KEY'] ?? getenv('MAILJET_API_KEY'));
$awsKeyId = $cleanEnv($_ENV['AWS_ACCESS_KEY_ID'] ?? getenv('AWS_ACCESS_KEY_ID') ?: ($_ENV['AWS_SES_KEY'] ?? getenv('AWS_SES_KEY')));
$sendgridKey = $cleanEnv($_ENV['SENDGRID_API_KEY'] ?? getenv('SENDGRID_API_KEY'));
$brevoKey = $cleanEnv($_ENV['BREVO_API_KEY'] ?? getenv('BREVO_API_KEY') ?: ($_ENV['SENDINBLUE_API_KEY'] ?? getenv('SENDINBLUE_API_KEY')));
$resendKey = $cleanEnv($_ENV['RESEND_API_KEY'] ?? getenv('RESEND_API_KEY'));

echo "Detected Environment Configuration:\n";
echo " - Mailjet API:  " . (!empty($mailjetKey) ? "CONFIGURED (" . substr($mailjetKey, 0, 8) . "...)" : "NOT CONFIGURED") . "\n";
echo " - Amazon SES:   " . (!empty($awsKeyId) ? "CONFIGURED (" . substr($awsKeyId, 0, 8) . "...)" : "NOT CONFIGURED") . "\n";
echo " - SendGrid API: " . (!empty($sendgridKey) ? "CONFIGURED (" . substr($sendgridKey, 0, 8) . "...)" : "NOT CONFIGURED") . "\n";
echo " - Brevo API:    " . (!empty($brevoKey) ? "CONFIGURED (" . substr($brevoKey, 0, 8) . "...)" : "NOT CONFIGURED") . "\n";
echo " - Resend API:   " . (!empty($resendKey) ? "CONFIGURED (" . substr($resendKey, 0, 8) . "...)" : "NOT CONFIGURED") . "\n";
echo " - SMTP Host:    {$smtpHost}:{$smtpPort}\n";
echo " - SMTP User:    " . (!empty($smtpUsername) ? substr($smtpUsername, 0, 3) . '***@' . explode('@', $smtpUsername)[1] : '(not set)') . "\n";
echo "---------------------------------------------------------\n";

$testSubject = "Test Email | BukSU Digitalized Judging System Diagnostics";
$testHtml = "
<div style='font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;'>
    <h2 style='color: #0F2C59;'>System Email Test Succeeded!</h2>
    <p>This is a test notification from your Digitalized Judging System instance.</p>
    <p>Timestamp: " . date('Y-m-d H:i:s T') . "</p>
</div>
";

echo "Attempting to send test email...\n";
$start = microtime(true);
$result = sendSystemEmail($recipient, $testSubject, $testHtml, true);
$duration = round(microtime(true) - $start, 2);

echo "Completed in: {$duration}s\n\n";

if ($result['sent']) {
    echo ">>> RESULT: SUCCESS! <<<\n";
    echo "Delivery Method: " . ($result['delivery_method'] ?? 'Unknown') . "\n";
    echo "Check the inbox of {$recipient} to verify receipt.\n";
} else {
    echo ">>> RESULT: FAILED <<<\n";
    echo "Delivery Method: " . ($result['delivery_method'] ?? 'Unknown') . "\n";
    echo "Error Details:   " . ($result['error'] ?? 'Unknown error') . "\n\n";
    echo "Diagnosis:\n";
    echo " - Traditional SMTP ports (25, 465, 587) are blocked by Render Free Tier.\n";
    echo " - Recommended options: Use Mailjet (MAILJET_API_KEY + MAILJET_SECRET_KEY) or AWS SES (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY).\n";
}
echo "\n";

