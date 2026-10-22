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

    if ($action === 'reset_defaults') {
        $default = getDefaultSettings();
        $default['updatedAt'] = date('Y-m-d H:i:s');
        $default['updatedBy'] = $_SESSION['username'] ?? 'Administrator';

        $settingsCollection->replaceOne(['_id' => 'system_settings'], $default, ['upsert' => true]);

        logSystemAction(
            $_SESSION['user_id'] ?? null,
            $_SESSION['username'] ?? 'Admin',
            'admin',
            'RESET_SETTINGS',
            'Reset all system branding and judging settings to factory defaults.'
        );

        echo json_encode([
            "success" => true,
            "message" => "Settings reset to system defaults.",
            "settings" => $default
        ]);
        exit;
    }

    echo json_encode(["success" => false, "message" => "Unrecognized action."]);
    exit;

} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => "Error: " . $e->getMessage()]);
    exit;
}
