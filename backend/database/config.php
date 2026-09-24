<?php

require_once __DIR__ . '/../../vendor/autoload.php';

use Dotenv\Dotenv;
use MongoDB\Client;

try {
    $dotenv = Dotenv::createImmutable(__DIR__ . '/../..');
    $dotenv->load();

    $uri = $_ENV['MONGODB_URI'] ?? null;
    $databaseName = $_ENV['MONGODB_DATABASE'] ?? null;

    if (!$uri || !$databaseName) {
        throw new Exception("Database environment variables MONGODB_URI or MONGODB_DATABASE missing.");
    }

    // Connect to MongoDB Atlas
    $uriOptions = ['tlsAllowInvalidCertificates' => true];
    $client = new Client($uri, $uriOptions);

    // Select database
    $db = $client->selectDatabase($databaseName);

    // Access users collection
    $usersCollection = $db->users;

} catch (Exception $e) {
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