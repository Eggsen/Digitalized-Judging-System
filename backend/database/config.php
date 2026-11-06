<?php

$autoloadPath = __DIR__ . '/../../vendor/autoload.php';
if (!file_exists($autoloadPath)) {
    if (basename($_SERVER['PHP_SELF'] ?? '') !== 'config.php') {
        header("Content-Type: application/json", true, 500);
        echo json_encode([
            "success" => false,
            "message" => "Composer dependencies are missing. Please run 'composer install' in the project directory."
        ]);
        exit;
    } else {
        echo "Composer dependencies missing. Run 'composer install'.";
        exit;
    }
}

require_once $autoloadPath;

use Dotenv\Dotenv;
use MongoDB\Client;

try {
    $dotenv = Dotenv::createImmutable(__DIR__ . '/../..');
    $dotenv->safeLoad();

    $rawUri = $_ENV['MONGODB_URI'] ?? getenv('MONGODB_URI') ?: '';
    $rawDb = $_ENV['MONGODB_DATABASE'] ?? getenv('MONGODB_DATABASE') ?: '';
    $uri = trim((string)$rawUri, " \t\n\r\0\x0B\"'") ?: null;
    $databaseName = trim((string)$rawDb, " \t\n\r\0\x0B\"'") ?: null;

    if (!$uri || !$databaseName) {
        throw new Exception("Database environment variables MONGODB_URI or MONGODB_DATABASE missing.");
    }

    if (!extension_loaded('mongodb')) {
        throw new Exception("PHP MongoDB extension is missing or not enabled. Please enable 'extension=mongodb' in your php.ini.");
    }

    // Connect to MongoDB Atlas
    $uriOptions = ['tlsAllowInvalidCertificates' => true];
    $client = new Client($uri, $uriOptions);

    // Select database
    $db = $client->selectDatabase($databaseName);

    // Access collections
    $usersCollection = $db->users;
    $eventsCollection = $db->events;
    $logsCollection = $db->logs;
    $notificationsCollection = $db->notifications;
    $contestantsCollection = $db->contestants;
    $criteriaCollection = $db->criteria;
    $scoresCollection = $db->scores;
    $settingsCollection = $db->settings;
    $logoLibraryCollection = $db->logo_library;

    // Sync stored API keys from MongoDB settings into runtime environment
    // to persist settings across Render container restarts
    try {
        $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']);
        if (!empty($settingsDoc['api_keys']) && (is_array($settingsDoc['api_keys']) || is_object($settingsDoc['api_keys']))) {
            foreach ($settingsDoc['api_keys'] as $envKey => $envVal) {
                if ($envVal !== null && $envVal !== '') {
                    $_ENV[(string)$envKey] = (string)$envVal;
                    putenv("{$envKey}=" . (string)$envVal);
                }
            }
        }
    } catch (Throwable $ignore) {
        // Safe fallback if settings collection is not yet ready
    }

} catch (Throwable $e) {
    if (basename($_SERVER['PHP_SELF'] ?? '') !== 'config.php') {
        header("Content-Type: application/json", true, 500);
        echo json_encode([
            "success" => false,
            "message" => "Database Connection Failed: " . $e->getMessage()
        ]);
        exit;
    } else {
        echo "MongoDB Connection Failed: " . htmlspecialchars($e->getMessage());
        exit;
    }
}