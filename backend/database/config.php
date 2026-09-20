<?php

require_once __DIR__ . '/../../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../..');
$dotenv->load();

$uri = $_ENV['MONGODB_URI'];
$databaseName = $_ENV['MONGODB_DATABASE'];

try {
    // Connect to MongoDB Atlas
    $client = new MongoDB\Client($uri);

    // Select database
    $db = $client->selectDatabase($databaseName);

    // Test connection
    $db->command(['ping' => 1]);

    echo "MongoDB connection successful!<br>";

    // Access users collection
    $users = $db->users;

    // Find admin user
    $admin = $users->findOne([
        'username' => 'Admin'
    ]);

    if ($admin) {
        echo "Admin user found!<br>";
        echo "Username: " . htmlspecialchars($admin['username']) . "<br>";
        echo "Role: " . htmlspecialchars($admin['role'] ?? 'No role field') . "<br>";
    } else {
        echo "Admin user was NOT found.";
    }

} catch (Exception $e) {
    echo "MongoDB connection failed:<br>";
    echo htmlspecialchars($e->getMessage());
}