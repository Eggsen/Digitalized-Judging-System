<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . "/../database/config.php";
require_once __DIR__ . "/../utils/qrcode.php";

$eventId = trim($_GET['event_id'] ?? '');
$type = trim($_GET['type'] ?? 'judge'); // 'judge' or 'public'

if (empty($eventId)) {
    echo json_encode(["success" => false, "message" => "Event ID is required."]);
    exit;
}

try {
    $event = null;
    try {
        $event = $eventsCollection->findOne(['_id' => new MongoDB\BSON\ObjectId($eventId)]);
    } catch (Throwable $e) {}

    if (!$event) {
        $event = $eventsCollection->findOne(['_id' => $eventId]);
    }

    if (!$event && is_numeric($eventId)) {
        $event = $eventsCollection->findOne(['_id' => (int)$eventId]);
    }

    if (!$event) {
        $event = $eventsCollection->findOne(['id' => is_numeric($eventId) ? (int)$eventId : $eventId]);
    }

    if (!$event) {
        echo json_encode(["success" => false, "message" => "Competition event not found."]);
        exit;
    }

    if (!isQrCodeServiceEnabled()) {
        echo json_encode([
            "success" => false,
            "disabled" => true,
            "message" => "QR Code Generation API has been disabled by the administrator in Settings."
        ]);
        exit;
    }

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https" : "http";
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';

    if ($type === 'public') {
        $targetUrl = "{$protocol}://{$host}/dashboard.php?view_event={$eventId}&type=public_matrix";
        $title = "Official Public Results & Tabulation";
        $description = "Scan this QR code with any smartphone camera to view live certified standings and scores.";
    } else {
        $targetUrl = "{$protocol}://{$host}/dashboard.php?event_id={$eventId}&action=judge_score";
        $title = "Judge Scoring Sheet Direct Access";
        $description = "Scan this QR code with your mobile or tablet camera to immediately launch your official scoring sheet.";
    }

    $qrUrl = generateQrCodeUrl($targetUrl, 280);

    echo json_encode([
        "success" => true,
        "event_id" => $eventId,
        "event_name" => $event['eventName'] ?? 'Competition',
        "type" => $type,
        "title" => $title,
        "description" => $description,
        "target_url" => $targetUrl,
        "qr_url" => $qrUrl
    ]);
    exit;

} catch (Throwable $e) {
    echo json_encode(["success" => false, "message" => "Error generating QR code: " . $e->getMessage()]);
    exit;
}
