<?php

/**
 * CLI Tool to manage, restore, or create Administrator accounts in MongoDB.
 * Usage:
 *   php backend/database/manage_admin.php [options]
 *
 * Options:
 *   --list                     List all accounts in the database
 *   --restore-all              Reactivate all revoked/disabled admin accounts
 *   --restore-email=<email>    Reactivate and grant admin access to a specific email
 *   --create                   Create or update a new admin account
 *     --email=<email>          Admin email (default: admin@buksu.edu.ph)
 *     --username=<username>    Admin username (default: Admin)
 *     --password=<password>    Admin password (default: AdminPassword123!)
 *     --first-name=<name>      First name (default: System)
 *     --last-name=<name>       Last name (default: Administrator)
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    die("This script can only be run from the command line.\n");
}

require_once __DIR__ . '/config.php';

$options = getopt("", [
    "list",
    "restore-all",
    "restore-email:",
    "create",
    "email:",
    "username:",
    "password:",
    "first-name:",
    "last-name:"
]);

function printHeader($text) {
    echo "\n=== " . $text . " ===\n";
}

// 1. If --restore-email is provided
if (isset($options['restore-email'])) {
    $targetEmail = trim($options['restore-email']);
    printHeader("Restoring Account: $targetEmail");

    $user = $usersCollection->findOne(['email' => new MongoDB\BSON\Regex('^' . preg_quote($targetEmail, '/') . '$', 'i')]);
    if (!$user) {
        echo "Error: No user found with email '$targetEmail'.\n";
        exit(1);
    }

    $updateFields = [
        'role' => 'admin',
        'status' => 'active',
        'is_active' => true
    ];

    if (empty($user['password'])) {
        $defaultPass = $options['password'] ?? 'AdminPassword123!';
        $updateFields['password'] = password_hash($defaultPass, PASSWORD_DEFAULT);
        echo "Note: Account had no password. Set temporary password: $defaultPass\n";
    }

    $usersCollection->updateOne(['_id' => $user['_id']], ['$set' => $updateFields]);
    echo "SUCCESS: Account '$targetEmail' restored! Role is now 'admin', status is 'active', and is_active is true.\n";
    exit(0);
}

// 2. If --create is provided
if (isset($options['create'])) {
    $email = trim($options['email'] ?? 'admin@buksu.edu.ph');
    $username = trim($options['username'] ?? 'Admin');
    $password = trim($options['password'] ?? 'AdminPassword123!');
    $firstName = trim($options['first-name'] ?? 'System');
    $lastName = trim($options['last-name'] ?? 'Administrator');
    $fullName = trim($firstName . ' ' . $lastName);

    printHeader("Creating / Updating Admin Account: $email");

    $existing = $usersCollection->findOne([
        '$or' => [
            ['email' => new MongoDB\BSON\Regex('^' . preg_quote($email, '/') . '$', 'i')],
            ['username' => $username]
        ]
    ]);

    $data = [
        'first_name' => $firstName,
        'last_name' => $lastName,
        'name' => $fullName,
        'username' => $username,
        'email' => $email,
        'password' => password_hash($password, PASSWORD_DEFAULT),
        'role' => 'admin',
        'is_active' => true,
        'status' => 'active',
        'updated_at' => new MongoDB\BSON\UTCDateTime()
    ];

    if ($existing) {
        $usersCollection->updateOne(['_id' => $existing['_id']], ['$set' => $data]);
        echo "SUCCESS: Existing account '{$existing['email']}' updated to active Administrator!\n";
    } else {
        $data['created_at'] = new MongoDB\BSON\UTCDateTime();
        $usersCollection->insertOne($data);
        echo "SUCCESS: New Administrator account created!\n";
    }

    echo "----------------------------------------\n";
    echo "Username: $username\n";
    echo "Email:    $email\n";
    echo "Password: $password\n";
    echo "Role:     admin\n";
    echo "----------------------------------------\n";
    exit(0);
}

// 3. Default / Interactive behavior: Inspect database, restore revoked admins, and list accounts
printHeader("Digitalized Judging System - Admin Account Manager");

$allUsers = iterator_to_array($usersCollection->find([], ['sort' => ['created_at' => -1]]));
echo "Total users in database: " . count($allUsers) . "\n\n";

printf("%-26s | %-15s | %-28s | %-10s | %-10s | %-8s\n", "ID", "Username", "Email", "Role", "Status", "Active");
echo str_repeat("-", 108) . "\n";

$revokedAdmins = [];
$activeAdmins = [];

foreach ($allUsers as $u) {
    $id = (string)$u['_id'];
    $uname = $u['username'] ?? $u['name'] ?? '(unnamed)';
    $uemail = $u['email'] ?? '(no email)';
    $urole = $u['role'] ?? 'user';
    $ustatus = $u['status'] ?? 'unknown';
    $uactive = isset($u['is_active']) ? ($u['is_active'] ? 'true' : 'false') : 'false';

    printf("%-26s | %-15s | %-28s | %-10s | %-10s | %-8s\n",
        substr($id, 0, 26),
        substr($uname, 0, 15),
        substr($uemail, 0, 28),
        substr($urole, 0, 10),
        substr($ustatus, 0, 10),
        substr($uactive, 0, 8)
    );

    if (strtolower($urole) === 'admin') {
        if ($ustatus === 'active' && $uactive === 'true') {
            $activeAdmins[] = $u;
        } else {
            $revokedAdmins[] = $u;
        }
    }
}
echo str_repeat("-", 108) . "\n\n";

// Auto-restore revoked admins if found
if (!empty($revokedAdmins) || isset($options['restore-all'])) {
    echo "Found " . count($revokedAdmins) . " revoked/inactive admin account(s). Reactivating...\n";
    foreach ($revokedAdmins as $radmin) {
        $rId = $radmin['_id'];
        $rName = $radmin['email'] ?? $radmin['username'] ?? 'Admin';
        $usersCollection->updateOne(
            ['_id' => $rId],
            ['$set' => [
                'status' => 'active',
                'is_active' => true
            ]]
        );
        echo " -> Restored admin account: $rName (ID: $rId)\n";
    }
    echo "All revoked admin accounts have been re-activated!\n\n";
}

// If no active admins exist at all, create a default active admin
$currentActiveAdminCount = count($activeAdmins) + count($revokedAdmins);
if ($currentActiveAdminCount === 0) {
    echo "No active administrator account found! Creating emergency admin account...\n";
    $defaultPass = 'AdminPassword123!';
    $newAdmin = [
        'first_name' => 'System',
        'last_name' => 'Admin',
        'name' => 'System Admin',
        'username' => 'Admin',
        'email' => 'admin@buksu.edu.ph',
        'password' => password_hash($defaultPass, PASSWORD_DEFAULT),
        'role' => 'admin',
        'is_active' => true,
        'status' => 'active',
        'created_at' => new MongoDB\BSON\UTCDateTime()
    ];
    $usersCollection->insertOne($newAdmin);
    echo "Emergency Admin Created:\n";
    echo "Username: Admin\n";
    echo "Email:    admin@buksu.edu.ph\n";
    echo "Password: $defaultPass\n";
} else {
    echo "You now have active administrator account(s). You can log in using your admin credentials.\n";
}

