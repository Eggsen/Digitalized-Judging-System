<?php

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
require_once __DIR__ . "/../utils/cloudinary.php";

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    echo json_encode(["success" => false, "message" => "Invalid HTTP method. POST required."]);
    exit;
}

try {
    // Check if reset action requested (from POST or JSON body)
    $rawInput = file_get_contents('php://input');
    $jsonData = json_decode($rawInput, true);
    $action = $_POST['action'] ?? $jsonData['action'] ?? '';

    if ($action === 'reset_default_logo') {
        $settingsCollection->updateOne(
            ['_id' => 'system_settings'],
            [
                '$set' => [
                    'branding.logoUrl' => null,
                    'updatedAt' => date('Y-m-d H:i:s'),
                    'updatedBy' => $_SESSION['username'] ?? 'Administrator'
                ]
            ]
        );

        logSystemAction(
            $_SESSION['user_id'] ?? null,
            $_SESSION['username'] ?? 'Admin',
            'admin',
            'RESET_INSTITUTION_LOGO',
            'Reset institution branding logo to system default BukSU seal.'
        );

        echo json_encode([
            "success" => true,
            "logoUrl" => null,
            "logo_url" => "/assets/logo/DJS Logo.png",
            "message" => "Institution logo reset to system default."
        ]);
        exit;
    }

    // Process file upload (supports 'logo' or 'logo_file')
    $file = $_FILES['logo'] ?? $_FILES['logo_file'] ?? null;
    if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
        $uploadError = $file['error'] ?? 'No file provided';
        echo json_encode(["success" => false, "message" => "Please select a valid image file to upload (Code: {$uploadError})."]);
        exit;
    }
    $allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    $detectedMime = mime_content_type($file['tmp_name']) ?: '';

    if (!in_array($detectedMime, $allowedTypes) && !in_array($file['type'], $allowedTypes)) {
        echo json_encode(["success" => false, "message" => "Invalid file format. Please upload a PNG, JPG, WebP, or SVG logo."]);
        exit;
    }

    // Maximum file size: 5MB
    if ($file['size'] > 5 * 1024 * 1024) {
        echo json_encode(["success" => false, "message" => "Image file size exceeds the 5MB limit."]);
        exit;
    }

    $uploadResult = uploadImageToCloudinary($file, 'djs_institution_logos');

    if (!$uploadResult['success']) {
        echo json_encode([
            "success" => false,
            "message" => $uploadResult['message'] ?? "Failed to upload image."
        ]);
        exit;
    }

    $newLogoUrl = $uploadResult['url'];
    $provider = $uploadResult['provider'] ?? 'storage';

    // Persist to system_settings
    $settingsCollection->updateOne(
        ['_id' => 'system_settings'],
        [
            '$set' => [
                'branding.logoUrl' => $newLogoUrl,
                'updatedAt' => date('Y-m-d H:i:s'),
                'updatedBy' => $_SESSION['username'] ?? 'Administrator'
            ]
        ]
    );

    logSystemAction(
        $_SESSION['user_id'] ?? null,
        $_SESSION['username'] ?? 'Admin',
        'admin',
        'UPDATE_INSTITUTION_LOGO',
        "Uploaded and set new institution branding logo via {$provider} ({$newLogoUrl})."
    );

    echo json_encode([
        "success" => true,
        "logoUrl" => $newLogoUrl,
        "logo_url" => $newLogoUrl,
        "storage" => $provider,
        "provider" => $provider,
        "message" => $uploadResult['message'] ?? "Institution logo updated successfully!"
    ]);
    exit;

} catch (Throwable $e) {
    echo json_encode(["success" => false, "message" => "Error uploading logo: " . $e->getMessage()]);
    exit;
}
