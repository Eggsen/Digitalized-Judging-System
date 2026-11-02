<?php

/**
 * QR Code Generator Helper
 * 
 * Uses public QR Code generation APIs (QR Server API & QuickChart QR API)
 * to produce mobile-friendly scan codes for live judge scoring and public leaderboards.
 */

function isQrCodeServiceEnabled(): bool {
    global $settingsCollection;
    if (!isset($settingsCollection)) {
        try {
            require_once __DIR__ . "/../database/config.php";
        } catch (Throwable $e) {}
    }

    if (isset($settingsCollection)) {
        try {
            $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']);
            if (isset($settingsDoc['security']['qrCodeEnabled'])) {
                return (bool)$settingsDoc['security']['qrCodeEnabled'];
            }
        } catch (Throwable $e) {}
    }
    return true; // Default enabled
}

function generateQrCodeUrl(string $data, int $size = 250, string $provider = 'qrserver'): ?string {
    if (!isQrCodeServiceEnabled()) {
        return null;
    }

    $encodedData = urlencode($data);

    if ($provider === 'quickchart') {
        return "https://quickchart.io/qr?text={$encodedData}&size={$size}&margin=1";
    }

    // Default: QR Server API (fast, reliable, free public REST service)
    return "https://api.qrserver.com/v1/create-qr-code/?size={$size}x{$size}&data={$encodedData}&margin=4";
}
