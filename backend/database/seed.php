<?php

require_once __DIR__ . '/config.php';

echo "Seeding users into MongoDB database...\n";

$defaultUsers = [
    [
        'username' => 'Admin',
        'email' => 'admin@buksu.edu.ph',
        'password' => password_hash('adminpassword123', PASSWORD_DEFAULT),
        'role' => 'admin',
        'created_at' => new MongoDB\BSON\UTCDateTime()
    ],
    [
        'username' => 'Judge1',
        'email' => 'judge1@buksu.edu.ph',
        'password' => password_hash('judgepassword123', PASSWORD_DEFAULT),
        'role' => 'judge',
        'created_at' => new MongoDB\BSON\UTCDateTime()
    ],
    [
        'username' => 'Tabulator1',
        'email' => 'tabulator1@buksu.edu.ph',
        'password' => password_hash('tabulatorpassword123', PASSWORD_DEFAULT),
        'role' => 'tabulator',
        'created_at' => new MongoDB\BSON\UTCDateTime()
    ]
];

foreach ($defaultUsers as $userData) {
    $existing = $usersCollection->findOne([
        '$or' => [
            ['username' => $userData['username']],
            ['email' => $userData['email']]
        ]
    ]);

    if ($existing) {
        $usersCollection->updateOne(
            ['_id' => $existing['_id']],
            ['$set' => [
                'password' => $userData['password'],
                'role' => $userData['role'],
                'email' => $userData['email']
            ]]
        );
        echo "Updated existing user: {$userData['username']} ({$userData['role']})\n";
    } else {
        $usersCollection->insertOne($userData);
        echo "Created user: {$userData['username']} ({$userData['role']})\n";
    }
}

echo "Seeding completed successfully!\n";
