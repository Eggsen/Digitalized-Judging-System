<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Authentication required."
    ]);
    exit;
}

require_once __DIR__ . "/../database/config.php";

$userId = (string)$_SESSION['user_id'];
$defaults = [
    'theme' => 'light',
    'colorRule' => 'normal',
    'navPlacement' => 'top'
];

try {
    $objectUserId = new MongoDB\BSON\ObjectId($userId);
} catch (Throwable $e) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid session user ID."
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $user = $usersCollection->findOne(['_id' => $objectUserId]);
        $prefs = $defaults;
        if ($user && isset($user['preferences']) && (is_array($user['preferences']) || is_object($user['preferences']))) {
            $userPrefs = (array)$user['preferences'];
            $prefs['theme'] = in_array($userPrefs['theme'] ?? '', ['light', 'dark'], true) ? $userPrefs['theme'] : $defaults['theme'];
            $prefs['colorRule'] = in_array($userPrefs['colorRule'] ?? '', ['normal', 'three-color'], true) ? $userPrefs['colorRule'] : $defaults['colorRule'];
            $prefs['navPlacement'] = in_array($userPrefs['navPlacement'] ?? '', ['top', 'sidebar'], true) ? $userPrefs['navPlacement'] : $defaults['navPlacement'];
        }

        $_SESSION['preferences'] = $prefs;

        echo json_encode([
            "success" => true,
            "preferences" => $prefs
        ]);
        exit;
    } catch (Throwable $e) {
        echo json_encode([
            "success" => false,
            "message" => "Failed to retrieve preferences: " . $e->getMessage(),
            "preferences" => $defaults
        ]);
        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawJson = file_get_contents("php://input");
    $data = json_decode($rawJson, true) ?? [];

    $current = $defaults;
    try {
        $user = $usersCollection->findOne(['_id' => $objectUserId]);
        if ($user && isset($user['preferences']) && (is_array($user['preferences']) || is_object($user['preferences']))) {
            $current = array_merge($defaults, (array)$user['preferences']);
        }
    } catch (Throwable $e) {
        // Fall back to defaults
    }

    $theme = $data['theme'] ?? $current['theme'];
    $colorRule = $data['colorRule'] ?? $current['colorRule'];
    $navPlacement = $data['navPlacement'] ?? $current['navPlacement'];

    $cleanPrefs = [
        'theme' => in_array($theme, ['light', 'dark'], true) ? $theme : 'light',
        'colorRule' => in_array($colorRule, ['normal', 'three-color'], true) ? $colorRule : 'normal',
        'navPlacement' => in_array($navPlacement, ['top', 'sidebar'], true) ? $navPlacement : 'top'
    ];

    try {
        $usersCollection->updateOne(
            ['_id' => $objectUserId],
            [
                '$set' => [
                    'preferences' => $cleanPrefs,
                    'updated_at' => new MongoDB\BSON\UTCDateTime()
                ]
            ]
        );

        $_SESSION['preferences'] = $cleanPrefs;

        echo json_encode([
            "success" => true,
            "message" => "Preferences saved successfully.",
            "preferences" => $cleanPrefs
        ]);
        exit;
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Failed to save preferences: " . $e->getMessage()
        ]);
        exit;
    }
}

http_response_code(405);
echo json_encode([
    "success" => false,
    "message" => "Method not allowed."
]);
