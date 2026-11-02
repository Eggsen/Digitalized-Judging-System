<?php

/**
 * Cloudinary Media Storage Helper
 * 
 * Uploads images to Cloudinary CDN with automatic fallback to local server storage
 * when Cloudinary is disabled in Admin Settings or credentials are not yet configured.
 */

if (file_exists(__DIR__ . "/../../vendor/autoload.php")) {
    require_once __DIR__ . "/../../vendor/autoload.php";
}

function uploadImageToCloudinary($fileOrPath, string $folder = 'djs_system_assets'): array {
    global $settingsCollection;
    if (!isset($settingsCollection)) {
        try {
            require_once __DIR__ . "/../database/config.php";
        } catch (Throwable $e) {}
    }

    $cloudinaryEnabled = true;
    if (isset($settingsCollection)) {
        try {
            $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']);
            if (isset($settingsDoc['security']['cloudinaryEnabled'])) {
                $cloudinaryEnabled = (bool)$settingsDoc['security']['cloudinaryEnabled'];
            }
        } catch (Throwable $e) {}
    }

    $cloudName = trim($_ENV['CLOUDINARY_CLOUD_NAME'] ?? getenv('CLOUDINARY_CLOUD_NAME') ?: '');
    $apiKey = trim($_ENV['CLOUDINARY_API_KEY'] ?? getenv('CLOUDINARY_API_KEY') ?: '');
    $apiSecret = trim($_ENV['CLOUDINARY_API_SECRET'] ?? getenv('CLOUDINARY_API_SECRET') ?: '');

    $canUseCloudinary = ($cloudinaryEnabled && !empty($cloudName) && !empty($apiKey) && !empty($apiSecret));

    // Determine the source file path and mime type
    $tempFilePath = null;
    $originalName = 'image.png';

    if (is_array($fileOrPath) && isset($fileOrPath['tmp_name'])) {
        $tempFilePath = $fileOrPath['tmp_name'];
        $originalName = $fileOrPath['name'] ?? 'image.png';
    } elseif (is_string($fileOrPath) && file_exists($fileOrPath)) {
        $tempFilePath = $fileOrPath;
        $originalName = basename($fileOrPath);
    } else {
        return [
            'success' => false,
            'message' => 'Invalid file provided for upload.'
        ];
    }

    // Try Cloudinary if enabled & configured
    if ($canUseCloudinary && extension_loaded('curl')) {
        try {
            $timestamp = time();
            $paramsToSign = "folder={$folder}&timestamp={$timestamp}";
            $signature = sha1($paramsToSign . $apiSecret);

            $endpoint = "https://api.cloudinary.com/v1_1/{$cloudName}/image/upload";

            $mimeType = mime_content_type($tempFilePath) ?: 'image/png';
            $curlFile = new CURLFile($tempFilePath, $mimeType, $originalName);

            $postData = [
                'file' => $curlFile,
                'api_key' => $apiKey,
                'timestamp' => $timestamp,
                'folder' => $folder,
                'signature' => $signature
            ];

            $ch = curl_init($endpoint);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $postData,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 20
            ]);

            $rawResponse = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($httpCode >= 200 && $httpCode < 300) {
                $result = json_decode($rawResponse, true);
                if (!empty($result['secure_url'])) {
                    return [
                        'success' => true,
                        'url' => $result['secure_url'],
                        'public_id' => $result['public_id'] ?? null,
                        'provider' => 'cloudinary',
                        'message' => 'Image successfully uploaded to Cloudinary CDN.'
                    ];
                }
            }
        } catch (Throwable $e) {
            // Fall back to local upload below
            error_log("Cloudinary Upload Exception: " . $e->getMessage());
        }
    }

    // Fallback: Local Server Storage
    $uploadDir = __DIR__ . "/../../assets/uploads/logos";
    if (!file_exists($uploadDir)) {
        @mkdir($uploadDir, 0777, true);
    }

    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION)) ?: 'png';
    $safeExt = in_array($extension, ['png', 'jpg', 'jpeg', 'webp', 'svg']) ? $extension : 'png';
    $filename = "institution_logo_" . time() . "_" . bin2hex(random_bytes(4)) . ".{$safeExt}";
    $destination = $uploadDir . "/" . $filename;

    if (is_uploaded_file($tempFilePath)) {
        $moved = @move_uploaded_file($tempFilePath, $destination);
    } else {
        $moved = @copy($tempFilePath, $destination);
    }

    if ($moved) {
        return [
            'success' => true,
            'url' => "/assets/uploads/logos/{$filename}",
            'provider' => 'local',
            'message' => $canUseCloudinary 
                ? 'Stored locally on server (Cloudinary upload failed, local fallback used).'
                : 'Stored locally on server (Cloudinary is disabled or credentials unconfigured).'
        ];
    }

    return [
        'success' => false,
        'message' => 'Failed to save uploaded image to local server directory.'
    ];
}
