<?php
/**
 * Logo Library / Asset Repository API
 * Allows listing, selecting, and managing previously uploaded institution logos.
 */

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id']) || strtolower($_SESSION['role'] ?? '') !== 'admin') {
    echo json_encode(["success" => false, "message" => "Access denied. Administrator privileges required."]);
    exit;
}

require_once __DIR__ . "/../database/config.php";
require_once __DIR__ . "/../utils/logger.php";

$method = $_SERVER['REQUEST_METHOD'];

try {
    // Current system settings
    $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']);
    $activeLogoUrl = $settingsDoc['branding']['logoUrl'] ?? null;
    $defaultLogoUrl = '/assets/logo/DJS Logo.png';

    // GET: List all logos in repository
    if ($method === 'GET') {
        // Auto-seed: If active logo exists and is not recorded in logo_library yet, record it
        if (!empty($activeLogoUrl) && $activeLogoUrl !== $defaultLogoUrl) {
            $exists = $logoLibraryCollection->findOne(['url' => $activeLogoUrl]);
            if (!$exists) {
                $storage = strpos($activeLogoUrl, 'cloudinary.com') !== false ? 'cloudinary' : 'local';
                $logoLibraryCollection->insertOne([
                    'url' => $activeLogoUrl,
                    'filename' => basename(parse_url($activeLogoUrl, PHP_URL_PATH) ?: 'institution_logo'),
                    'storage' => $storage,
                    'uploadedBy' => $settingsDoc['updatedBy'] ?? 'Admin',
                    'uploadedAt' => $settingsDoc['updatedAt'] ?? date('Y-m-d H:i:s'),
                    'createdAt' => new MongoDB\BSON\UTCDateTime()
                ]);
            }
        }

        // Auto-seed: Inspect local uploads directory for existing logos not yet in database
        $localUploadsDir = __DIR__ . '/../../assets/uploads/logos';
        if (is_dir($localUploadsDir)) {
            $files = scandir($localUploadsDir);
            foreach ($files as $f) {
                if ($f === '.' || $f === '..' || $f === '.gitkeep') continue;
                $localUrl = "/assets/uploads/logos/{$f}";
                $exists = $logoLibraryCollection->findOne(['url' => $localUrl]);
                if (!$exists) {
                    $logoLibraryCollection->insertOne([
                        'url' => $localUrl,
                        'filename' => $f,
                        'storage' => 'local',
                        'size' => filesize("{$localUploadsDir}/{$f}"),
                        'uploadedBy' => 'Admin',
                        'uploadedAt' => date('Y-m-d H:i:s', filemtime("{$localUploadsDir}/{$f}")),
                        'createdAt' => new MongoDB\BSON\UTCDateTime()
                    ]);
                }
            }
        }

        $cursor = $logoLibraryCollection->find([], ['sort' => ['createdAt' => -1]]);
        $items = [];

        // Always include Default BukSU Seal as first option
        $items[] = [
            'id' => 'default_system_logo',
            'url' => $defaultLogoUrl,
            'filename' => 'BukSU Official Seal (System Default)',
            'storage' => 'default',
            'uploadedAt' => 'Pre-installed',
            'isDefault' => true,
            'isActive' => empty($activeLogoUrl) || $activeLogoUrl === $defaultLogoUrl
        ];

        foreach ($cursor as $doc) {
            $url = $doc['url'] ?? '';
            if (empty($url)) continue;

            $items[] = [
                'id' => (string)$doc['_id'],
                'url' => $url,
                'filename' => $doc['filename'] ?? basename($url),
                'storage' => $doc['storage'] ?? (strpos($url, 'cloudinary') !== false ? 'cloudinary' : 'local'),
                'uploadedBy' => $doc['uploadedBy'] ?? 'Admin',
                'uploadedAt' => $doc['uploadedAt'] ?? 'Recently',
                'isDefault' => false,
                'isActive' => ($activeLogoUrl === $url)
            ];
        }

        echo json_encode([
            "success" => true,
            "activeLogoUrl" => $activeLogoUrl,
            "items" => $items
        ]);
        exit;
    }

    // POST: Select or Delete
    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true) ?: $_POST;
        $action = trim($data['action'] ?? '');

        if ($action === 'select_logo') {
            $selectedUrl = trim($data['url'] ?? '');

            if ($selectedUrl === $defaultLogoUrl || $selectedUrl === 'default_system_logo' || empty($selectedUrl)) {
                $newLogoVal = null;
                $effectiveUrl = $defaultLogoUrl;
                $actionNote = "Reverted active logo to system default BukSU seal.";
            } else {
                $newLogoVal = $selectedUrl;
                $effectiveUrl = $selectedUrl;
                $actionNote = "Selected logo from library: {$selectedUrl}";
            }

            $settingsCollection->updateOne(
                ['_id' => 'system_settings'],
                [
                    '$set' => [
                        'branding.logoUrl' => $newLogoVal,
                        'updatedAt' => date('Y-m-d H:i:s'),
                        'updatedBy' => $_SESSION['username'] ?? 'Administrator'
                    ]
                ]
            );

            logSystemAction(
                $_SESSION['user_id'] ?? null,
                $_SESSION['username'] ?? 'Admin',
                'admin',
                'SELECT_LOGO_FROM_LIBRARY',
                $actionNote
            );

            $storageType = 'default';
            if (!empty($newLogoVal)) {
                $storageType = strpos($newLogoVal, 'cloudinary.com') !== false ? 'cloudinary' : 'local';
            }

            echo json_encode([
                "success" => true,
                "logoUrl" => $newLogoVal,
                "effectiveUrl" => $effectiveUrl,
                "storage" => $storageType,
                "message" => "Institution logo updated successfully from library!"
            ]);
            exit;
        }

        if ($action === 'delete_logo') {
            $id = trim($data['id'] ?? '');
            if (empty($id) || $id === 'default_system_logo') {
                echo json_encode(["success" => false, "message" => "Default system logo cannot be deleted."]);
                exit;
            }

            $item = null;
            try {
                $item = $logoLibraryCollection->findOne(['_id' => new MongoDB\BSON\ObjectId($id)]);
            } catch (Throwable $e) {}

            if (!$item) {
                echo json_encode(["success" => false, "message" => "Logo asset not found in library."]);
                exit;
            }

            $deletedUrl = $item['url'] ?? '';

            // If it's the currently active logo, revert active logo to null (default)
            if ($activeLogoUrl === $deletedUrl) {
                $settingsCollection->updateOne(
                    ['_id' => 'system_settings'],
                    ['$set' => [
                        'branding.logoUrl' => null,
                        'updatedAt' => date('Y-m-d H:i:s'),
                        'updatedBy' => $_SESSION['username'] ?? 'Administrator'
                    ]]
                );
            }

            // If local storage, delete physical file
            if (($item['storage'] ?? '') === 'local' && !empty($deletedUrl)) {
                $relPath = ltrim(parse_url($deletedUrl, PHP_URL_PATH), '/');
                $localFilePath = __DIR__ . '/../../' . $relPath;
                if (file_exists($localFilePath) && is_file($localFilePath)) {
                    @unlink($localFilePath);
                }
            }

            $logoLibraryCollection->deleteOne(['_id' => $item['_id']]);

            logSystemAction(
                $_SESSION['user_id'] ?? null,
                $_SESSION['username'] ?? 'Admin',
                'admin',
                'DELETE_LOGO_FROM_LIBRARY',
                "Deleted logo asset from library: {$deletedUrl}"
            );

            echo json_encode([
                "success" => true,
                "wasActive" => ($activeLogoUrl === $deletedUrl),
                "message" => "Logo deleted from repository successfully."
            ]);
            exit;
        }

        echo json_encode(["success" => false, "message" => "Invalid action specified."]);
        exit;
    }

    echo json_encode(["success" => false, "message" => "Method not allowed."]);
    exit;

} catch (Throwable $e) {
    echo json_encode(["success" => false, "message" => "Error: " . $e->getMessage()]);
    exit;
}
