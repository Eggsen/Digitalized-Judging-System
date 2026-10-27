<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "Authentication required."]);
    exit;
}

$userRole = strtolower($_SESSION['role'] ?? '');
$isGet = ($_SERVER['REQUEST_METHOD'] === 'GET');

// Non-admins can only read settings in GET mode (e.g., judges/tabulators reading branding/precision)
if (!$isGet && $userRole !== 'admin') {
    echo json_encode(["success" => false, "message" => "Access denied. Administrator privileges required."]);
    exit;
}

require_once __DIR__ . "/../database/config.php";
require_once __DIR__ . "/../utils/logger.php";
require_once __DIR__ . "/../utils/mailer.php";

function maskEmail($email) {
    if (empty($email) || strpos($email, '@') === false) return 'admin email';
    $parts = explode('@', $email);
    $name = $parts[0];
    $domain = $parts[1];
    $len = strlen($name);
    if ($len <= 2) {
        $maskedName = substr($name, 0, 1) . '*';
    } else {
        $maskedName = substr($name, 0, 1) . str_repeat('*', min(4, $len - 2)) . substr($name, -1);
    }
    return $maskedName . '@' . $domain;
}

function getDefaultSettings() {
    return [
        '_id' => 'system_settings',
        'branding' => [
            'institutionName' => 'Bukidnon State University',
            'campusUnit' => 'Main Campus, Malaybalay City - Office of Student Affairs & Services',
            'systemTitle' => 'JudgeTab - Digitalized Judging System',
            'headerSubtitle' => 'Official Tabulation & Certification of Competition Results',
            'primaryColor' => '#0F2C59',
            'accentColor' => '#F8B400',
            'showWatermark' => true,
            'signatories' => [
                ['name' => 'Dr. Juan Dela Cruz', 'title' => 'Head Tabulator / Chief Statistician'],
                ['name' => 'Prof. Maria Santos', 'title' => 'Chairman of the Board of Judges'],
                ['name' => 'Engr. Roberto Reyes', 'title' => 'Overall Event Director / Coordinator']
            ]
        ],
        'judging' => [
            'decimalPrecision' => 2,
            'tabulationMethod' => 'standard_average',
            'tieBreakerRule' => 'highest_weight_criterion',
            'unlockPolicy' => 'admin_approval',
            'blindJudging' => true,
            'maxCriteriaWeight' => 100
        ],
        'security' => [
            'googleAuthEnabled' => true,
            'recaptchaEnabled' => true
        ],
        'backup' => [
            'lastBackupAt' => null,
            'autoBackupNotice' => true
        ],
        'updatedAt' => date('Y-m-d H:i:s'),
        'updatedBy' => 'System Default'
    ];
}

try {
    if ($isGet) {
        $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']);

        if (!$settingsDoc) {
            $default = getDefaultSettings();
            $settingsCollection->insertOne($default);
            $settingsDoc = $default;
        }

        if (empty($settingsDoc['security'])) {
            $settingsDoc['security'] = [
                'googleAuthEnabled' => true,
                'recaptchaEnabled' => true
            ];
        }

        // Diagnostics info
        $diagnostics = [
            'database' => $databaseName ?? 'djs_db',
            'connection' => 'Connected (MongoDB Atlas)',
            'counts' => [
                'events' => $eventsCollection->countDocuments(),
                'contestants' => $contestantsCollection->countDocuments(),
                'criteria' => $criteriaCollection->countDocuments(),
                'scores' => $scoresCollection->countDocuments(),
                'users' => $usersCollection->countDocuments(),
                'logs' => $logsCollection->countDocuments()
            ],
            'serverTime' => date('Y-m-d H:i:s T'),
            'phpVersion' => PHP_VERSION,
            'systemVersion' => 'v2.4-Production'
        ];

        echo json_encode([
            "success" => true,
            "settings" => $settingsDoc,
            "diagnostics" => $diagnostics
        ]);
        exit;
    }

    // POST handling
    $rawJson = file_get_contents("php://input");
    $data = json_decode($rawJson, true) ?? [];
    $action = $data['action'] ?? 'save';

    if ($action === 'save') {
        $branding = $data['branding'] ?? [];
        $judging = $data['judging'] ?? [];

        // Clean & sanitize signatories
        $signatories = [];
        if (!empty($branding['signatories']) && is_array($branding['signatories'])) {
            foreach ($branding['signatories'] as $sig) {
                $name = trim($sig['name'] ?? '');
                $title = trim($sig['title'] ?? '');
                if ($name !== '' || $title !== '') {
                    $signatories[] = [
                        'name' => htmlspecialchars($name),
                        'title' => htmlspecialchars($title)
                    ];
                }
            }
        }
        if (empty($signatories)) {
            $signatories = getDefaultSettings()['branding']['signatories'];
        }

        $cleanBranding = [
            'institutionName' => trim($branding['institutionName'] ?? 'Bukidnon State University'),
            'campusUnit' => trim($branding['campusUnit'] ?? 'Main Campus, Malaybalay City - Office of Student Affairs & Services'),
            'systemTitle' => trim($branding['systemTitle'] ?? 'JudgeTab - Digitalized Judging System'),
            'headerSubtitle' => trim($branding['headerSubtitle'] ?? 'Official Tabulation & Certification of Competition Results'),
            'primaryColor' => $branding['primaryColor'] ?? '#0F2C59',
            'accentColor' => $branding['accentColor'] ?? '#F8B400',
            'showWatermark' => !empty($branding['showWatermark']),
            'signatories' => $signatories
        ];

        $precision = (int)($judging['decimalPrecision'] ?? 2);
        if ($precision < 1 || $precision > 4) $precision = 2;

        $cleanJudging = [
            'decimalPrecision' => $precision,
            'tabulationMethod' => in_array($judging['tabulationMethod'] ?? '', ['standard_average', 'olympic_trimming', 'ordinal_ranking']) 
                ? $judging['tabulationMethod'] : 'standard_average',
            'tieBreakerRule' => in_array($judging['tieBreakerRule'] ?? '', ['highest_weight_criterion', 'judge_majority_vote', 'split_award']) 
                ? $judging['tieBreakerRule'] : 'highest_weight_criterion',
            'unlockPolicy' => in_array($judging['unlockPolicy'] ?? '', ['admin_approval', 'judge_self_unlock']) 
                ? $judging['unlockPolicy'] : 'admin_approval',
            'blindJudging' => !empty($judging['blindJudging']),
            'maxCriteriaWeight' => 100
        ];

        $updateDoc = [
            '$set' => [
                'branding' => $cleanBranding,
                'judging' => $cleanJudging,
                'updatedAt' => date('Y-m-d H:i:s'),
                'updatedBy' => $_SESSION['username'] ?? 'Administrator'
            ]
        ];

        $settingsCollection->updateOne(['_id' => 'system_settings'], $updateDoc, ['upsert' => true]);

        logSystemAction(
            $_SESSION['user_id'] ?? null,
            $_SESSION['username'] ?? 'Admin',
            'admin',
            'UPDATE_SETTINGS',
            'Updated system branding, judging rules, and tabulation policies.'
        );

        $freshDoc = $settingsCollection->findOne(['_id' => 'system_settings']);

        echo json_encode([
            "success" => true,
            "message" => "System settings updated successfully.",
            "settings" => $freshDoc
        ]);
        exit;
    }

    if ($action === 'export_backup') {
        // Collect collections data
        $backupData = [
            'metadata' => [
                'system' => 'BukSU JudgeTab Digitalized Judging System',
                'exportedAt' => date('Y-m-d H:i:s T'),
                'exportedBy' => $_SESSION['username'] ?? 'Administrator',
                'database' => $databaseName ?? 'djs_db',
                'schemaVersion' => '2.4'
            ],
            'settings' => $settingsCollection->findOne(['_id' => 'system_settings']),
            'events' => iterator_to_array($eventsCollection->find([], ['limit' => 500])),
            'contestants' => iterator_to_array($contestantsCollection->find([], ['limit' => 1000])),
            'criteria' => iterator_to_array($criteriaCollection->find([], ['limit' => 1000])),
            'scores' => iterator_to_array($scoresCollection->find([], ['limit' => 2000])),
            'users' => iterator_to_array($usersCollection->find([], [
                'projection' => ['password' => 0, 'invite_token' => 0, 'reset_token' => 0],
                'limit' => 500
            ])),
            'logs' => iterator_to_array($logsCollection->find([], ['sort' => ['timestamp' => -1], 'limit' => 300]))
        ];

        // Update lastBackupAt
        $now = date('Y-m-d H:i:s');
        $settingsCollection->updateOne(['_id' => 'system_settings'], [
            '$set' => ['backup.lastBackupAt' => $now]
        ]);

        logSystemAction(
            $_SESSION['user_id'] ?? null,
            $_SESSION['username'] ?? 'Admin',
            'admin',
            'EXPORT_BACKUP',
            'Downloaded complete JSON system database backup.'
        );

        echo json_encode([
            "success" => true,
            "message" => "Backup generated successfully.",
            "filename" => "judgetab_backup_" . date('Y-m-d_His') . ".json",
            "lastBackupAt" => $now,
            "data" => $backupData
        ]);
        exit;
    }

    if ($action === 'clear_logs') {
        $deleted = $logsCollection->deleteMany([]);
        logSystemAction(
            $_SESSION['user_id'] ?? null,
            $_SESSION['username'] ?? 'Admin',
            'admin',
            'CLEAR_LOGS',
            'Admin purged all system audit activity logs.'
        );

        echo json_encode([
            "success" => true,
            "message" => "Activity logs cleared successfully (" . $deleted->getDeletedCount() . " records purged)."
        ]);
        exit;
    }

    if ($action === 'request_security_change') {
        $googleAuth = !empty($data['googleAuthEnabled']);
        $recaptcha = !empty($data['recaptchaEnabled']);

        $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']) ?? getDefaultSettings();
        $currentSec = $settingsDoc['security'] ?? ['googleAuthEnabled' => true, 'recaptchaEnabled' => true];
        $currGoogle = $currentSec['googleAuthEnabled'] ?? true;
        $currRecaptcha = $currentSec['recaptchaEnabled'] ?? true;

        // If no changes, return immediately
        if ($googleAuth === $currGoogle && $recaptcha === $currRecaptcha) {
            echo json_encode([
                "success" => true,
                "requires_confirmation" => false,
                "message" => "Security settings are unchanged.",
                "security" => $currentSec
            ]);
            exit;
        }

        // Get admin email
        $adminUser = null;
        try {
            $adminUser = $usersCollection->findOne(['_id' => new MongoDB\BSON\ObjectId($_SESSION['user_id'])]);
        } catch (Throwable $e) {}

        if (!$adminUser) {
            $adminUser = $usersCollection->findOne(['username' => $_SESSION['username']]);
        }

        $adminEmail = trim($adminUser['email'] ?? $_SESSION['email'] ?? '');
        if (empty($adminEmail)) {
            echo json_encode([
                "success" => false,
                "message" => "No registered email address found for your administrator account. Please configure an email address in your profile to receive confirmation codes."
            ]);
            exit;
        }

        // Generate 6-digit verification code and secure link token
        $code = sprintf("%06d", random_int(100000, 999999));
        $token = bin2hex(random_bytes(24));
        $expiresAt = new MongoDB\BSON\UTCDateTime((time() + 900) * 1000); // 15 minutes

        $pending = [
            'code' => $code,
            'token' => $token,
            'changes' => [
                'googleAuthEnabled' => $googleAuth,
                'recaptchaEnabled' => $recaptcha
            ],
            'requested_by_id' => (string)$_SESSION['user_id'],
            'requested_by_username' => $_SESSION['username'],
            'requested_by_email' => $adminEmail,
            'expires_at' => $expiresAt,
            'created_at' => new MongoDB\BSON\UTCDateTime()
        ];

        $settingsCollection->updateOne(
            ['_id' => 'system_settings'],
            ['$set' => ['pending_security_change' => $pending]]
        );

        $googleChangeText = ($currGoogle ? '<span style="color:#10b981;font-weight:bold;">Enabled</span>' : '<span style="color:#ef4444;font-weight:bold;">Disabled</span>')
            . ' &rarr; ' . ($googleAuth ? '<span style="color:#10b981;font-weight:bold;">Enabled</span>' : '<span style="color:#ef4444;font-weight:bold;">Disabled</span>');

        $recaptchaChangeText = ($currRecaptcha ? '<span style="color:#10b981;font-weight:bold;">Enabled</span>' : '<span style="color:#ef4444;font-weight:bold;">Disabled</span>')
            . ' &rarr; ' . ($recaptcha ? '<span style="color:#10b981;font-weight:bold;">Enabled</span>' : '<span style="color:#ef4444;font-weight:bold;">Disabled</span>');

        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';
        $verifyLink = "{$protocol}://{$host}/backend/crud/verify_security_change.php?token={$token}";

        $emailSubject = "Action Required: Confirm Security Settings Change - BukSU DJS";
        $htmlMessage = "
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;'>
            <div style='text-align: center; margin-bottom: 24px;'>
                <div style='display:inline-block; padding: 10px 16px; background-color: #0F2C59; color: #F8B400; border-radius: 12px; font-weight: bold; font-size: 16px;'>
                    BukSU Digitalized Judging System
                </div>
                <h2 style='color: #0F2C59; margin-top: 16px; margin-bottom: 4px;'>Confirm Security Settings Modification</h2>
                <p style='color: #64748b; font-size: 13px; margin: 0;'>An administrator requested changes to authentication & security controls.</p>
            </div>

            <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;'>
                <h3 style='margin: 0 0 12px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569;'>Proposed Changes:</h3>
                <table style='width: 100%; font-size: 13px; border-collapse: collapse;'>
                    <tr style='border-bottom: 1px solid #e2e8f0;'>
                        <td style='padding: 8px 0; color: #334155;'><strong>Google OAuth 2.0 Login:</strong></td>
                        <td style='padding: 8px 0; text-align: right;'>{$googleChangeText}</td>
                    </tr>
                    <tr>
                        <td style='padding: 8px 0; color: #334155;'><strong>Google reCAPTCHA v2:</strong></td>
                        <td style='padding: 8px 0; text-align: right;'>{$recaptchaChangeText}</td>
                    </tr>
                </table>
            </div>

            <div style='text-align: center; margin: 24px 0; padding: 20px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px;'>
                <div style='font-size: 12px; font-weight: bold; color: #1e40af; text-transform: uppercase; margin-bottom: 8px;'>Your 6-Digit Confirmation Code:</div>
                <div style='font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #0F2C59; font-family: monospace;'>{$code}</div>
                <p style='font-size: 11px; color: #64748b; margin-top: 8px; margin-bottom: 0;'>Valid for 15 minutes</p>
            </div>

            <div style='text-align: center; margin-bottom: 24px;'>
                <p style='font-size: 12px; color: #475569; margin-bottom: 12px;'>Or click the button below to confirm immediately:</p>
                <a href='{$verifyLink}' style='display: inline-block; padding: 12px 28px; background-color: #0F2C59; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 13px; border-radius: 10px; border: 1px solid #F8B400;'>Confirm & Apply Changes</a>
            </div>

            <div style='border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center;'>
                <p style='margin: 0;'>Requested by admin: <strong>" . htmlspecialchars($_SESSION['username']) . "</strong> on " . date('Y-m-d H:i:s T') . "</p>
                <p style='margin-top: 4px;'>If you did not initiate this change, someone may be attempting to alter your system security. Please check your credentials immediately.</p>
            </div>
        </div>
        ";

        sendSystemEmail($adminEmail, $emailSubject, $htmlMessage);

        echo json_encode([
            "success" => true,
            "requires_confirmation" => true,
            "masked_email" => maskEmail($adminEmail),
            "message" => "Confirmation code sent to " . maskEmail($adminEmail) . ". Please verify to apply changes."
        ]);
        exit;
    }

    if ($action === 'confirm_security_change') {
        $code = trim($data['code'] ?? '');

        if (empty($code)) {
            echo json_encode(["success" => false, "message" => "Please enter the 6-digit confirmation code."]);
            exit;
        }

        $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']);
        $pending = $settingsDoc['pending_security_change'] ?? null;

        if (!$pending) {
            echo json_encode(["success" => false, "message" => "No pending security changes found or code has already been confirmed."]);
            exit;
        }

        // Check expiration
        $expiresAt = $pending['expires_at'] ?? null;
        if ($expiresAt instanceof MongoDB\BSON\UTCDateTime) {
            $expirySec = $expiresAt->toDateTime()->getTimestamp();
            if (time() > $expirySec) {
                $settingsCollection->updateOne(
                    ['_id' => 'system_settings'],
                    ['$unset' => ['pending_security_change' => ""]]
                );
                echo json_encode(["success" => false, "message" => "Confirmation code has expired. Please request a new confirmation code."]);
                exit;
            }
        }

        // Check code
        if (trim((string)($pending['code'] ?? '')) !== $code) {
            echo json_encode(["success" => false, "message" => "Incorrect confirmation code. Please check your email and try again."]);
            exit;
        }

        // Apply changes
        $newSecurity = [
            'googleAuthEnabled' => !empty($pending['changes']['googleAuthEnabled']),
            'recaptchaEnabled' => !empty($pending['changes']['recaptchaEnabled'])
        ];

        $settingsCollection->updateOne(
            ['_id' => 'system_settings'],
            [
                '$set' => [
                    'security' => $newSecurity,
                    'updatedAt' => date('Y-m-d H:i:s'),
                    'updatedBy' => $_SESSION['username'] ?? 'Administrator'
                ],
                '$unset' => [
                    'pending_security_change' => ""
                ]
            ]
        );

        logSystemAction(
            $_SESSION['user_id'] ?? null,
            $_SESSION['username'] ?? 'Admin',
            'admin',
            'UPDATE_SECURITY_SETTINGS',
            'Admin confirmed and updated authentication security controls: Google OAuth=' . ($newSecurity['googleAuthEnabled'] ? 'ON' : 'OFF') . ', reCAPTCHA=' . ($newSecurity['recaptchaEnabled'] ? 'ON' : 'OFF')
        );

        echo json_encode([
            "success" => true,
            "message" => "Security settings successfully verified and updated!",
            "security" => $newSecurity
        ]);
        exit;
    }

    if ($action === 'resend_security_code') {
        $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']);
        $pending = $settingsDoc['pending_security_change'] ?? null;

        if (!$pending) {
            echo json_encode(["success" => false, "message" => "No pending security changes to confirm."]);
            exit;
        }

        // Generate fresh code & expiry
        $code = sprintf("%06d", random_int(100000, 999999));
        $token = bin2hex(random_bytes(24));
        $expiresAt = new MongoDB\BSON\UTCDateTime((time() + 900) * 1000);
        $adminEmail = $pending['requested_by_email'] ?? $_SESSION['email'] ?? '';

        $settingsCollection->updateOne(
            ['_id' => 'system_settings'],
            ['$set' => [
                'pending_security_change.code' => $code,
                'pending_security_change.token' => $token,
                'pending_security_change.expires_at' => $expiresAt
            ]]
        );

        $googleAuth = !empty($pending['changes']['googleAuthEnabled']);
        $recaptcha = !empty($pending['changes']['recaptchaEnabled']);
        $currSec = $settingsDoc['security'] ?? ['googleAuthEnabled' => true, 'recaptchaEnabled' => true];
        $currGoogle = $currSec['googleAuthEnabled'] ?? true;
        $currRecaptcha = $currSec['recaptchaEnabled'] ?? true;

        $googleChangeText = ($currGoogle ? '<span style="color:#10b981;font-weight:bold;">Enabled</span>' : '<span style="color:#ef4444;font-weight:bold;">Disabled</span>')
            . ' &rarr; ' . ($googleAuth ? '<span style="color:#10b981;font-weight:bold;">Enabled</span>' : '<span style="color:#ef4444;font-weight:bold;">Disabled</span>');
        
        $recaptchaChangeText = ($currRecaptcha ? '<span style="color:#10b981;font-weight:bold;">Enabled</span>' : '<span style="color:#ef4444;font-weight:bold;">Disabled</span>')
            . ' &rarr; ' . ($recaptcha ? '<span style="color:#10b981;font-weight:bold;">Enabled</span>' : '<span style="color:#ef4444;font-weight:bold;">Disabled</span>');

        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';
        $verifyLink = "{$protocol}://{$host}/backend/crud/verify_security_change.php?token={$token}";

        $emailSubject = "Resent Code: Confirm Security Settings Change - BukSU DJS";
        $htmlMessage = "
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;'>
            <div style='text-align: center; margin-bottom: 24px;'>
                <div style='display:inline-block; padding: 10px 16px; background-color: #0F2C59; color: #F8B400; border-radius: 12px; font-weight: bold; font-size: 16px;'>
                    BukSU Digitalized Judging System
                </div>
                <h2 style='color: #0F2C59; margin-top: 16px; margin-bottom: 4px;'>Security Confirmation Code (Resent)</h2>
                <p style='color: #64748b; font-size: 13px; margin: 0;'>Here is your new confirmation code for authentication settings.</p>
            </div>

            <div style='text-align: center; margin: 24px 0; padding: 20px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px;'>
                <div style='font-size: 12px; font-weight: bold; color: #1e40af; text-transform: uppercase; margin-bottom: 8px;'>Your New 6-Digit Confirmation Code:</div>
                <div style='font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #0F2C59; font-family: monospace;'>{$code}</div>
                <p style='font-size: 11px; color: #64748b; margin-top: 8px; margin-bottom: 0;'>Valid for 15 minutes</p>
            </div>

            <div style='text-align: center; margin-bottom: 24px;'>
                <a href='{$verifyLink}' style='display: inline-block; padding: 12px 28px; background-color: #0F2C59; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 13px; border-radius: 10px; border: 1px solid #F8B400;'>Confirm & Apply Changes</a>
            </div>
        </div>";

        sendSystemEmail($adminEmail, $emailSubject, $htmlMessage);

        echo json_encode([
            "success" => true,
            "message" => "A new confirmation code has been sent to " . maskEmail($adminEmail) . "."
        ]);
        exit;
    }

    echo json_encode(["success" => false, "message" => "Unrecognized action."]);
    exit;

} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => "Error: " . $e->getMessage()]);
    exit;
}
