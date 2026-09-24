<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . "/../database/config.php";

if ($_SERVER['REQUEST_METHOD'] !== "POST") {
    echo json_encode([
        "success" => false,
        "message" => "Invalid HTTP request method."
    ]);
    exit;
}

$rawJson = file_get_contents("php://input");
$data = json_decode($rawJson, true);

if (!$data) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid JSON payload."
    ]);
    exit;
}

$action = trim($data['action'] ?? "");

if ($action === "verify_user") {
    $username = trim($data['username'] ?? "");
    $role     = strtolower(trim($data['role'] ?? ""));

    if ($username === "" || $role === "") {
        echo json_encode([
            "success" => false,
            "message" => "Username and role are required."
        ]);
        exit;
    }

    if (!in_array($role, ['judge', 'tabulator'])) {
        echo json_encode([
            "success" => false,
            "message" => "Password reset is only available for Judge and Tabulator accounts."
        ]);
        exit;
    }

    try {
        $user = $usersCollection->findOne([
            'username' => $username,
            'role'     => $role
        ]);

        if (!$user) {
            echo json_encode([
                "success" => false,
                "message" => "No " . ucfirst($role) . " account found with that username."
            ]);
            exit;
        }

        if (isset($user['is_active']) && $user['is_active'] === false) {
            echo json_encode([
                "success" => false,
                "message" => "This account is disabled. Please contact your administrator."
            ]);
            exit;
        }

        // Store reset intent in session (so user can't skip to step 2)
        $_SESSION['reset_username'] = $username;
        $_SESSION['reset_role']     = $role;
        $_SESSION['reset_user_id']  = (string)$user['_id'];

        echo json_encode([
            "success" => true,
            "message" => "Account found. You may now set your new password."
        ]);

    } catch (Throwable $e) {
        echo json_encode([
            "success" => false,
            "message" => "Database error: " . $e->getMessage()
        ]);
        exit;
    }
} elseif ($action === "reset") {
    $newPassword     = trim($data['new_password'] ?? "");
    $confirmPassword = trim($data['confirm_password'] ?? "");

    // Verify the reset session is active
    if (empty($_SESSION['reset_user_id'])) {
        echo json_encode([
            "success" => false,
            "message" => "Reset session expired. Please start over."
        ]);
        exit;
    }

    if ($newPassword === "" || $confirmPassword === "") {
        echo json_encode([
            "success" => false,
            "message" => "Please fill in both password fields."
        ]);
        exit;
    }

    if ($newPassword !== $confirmPassword) {
        echo json_encode([
            "success" => false,
            "message" => "Passwords do not match."
        ]);
        exit;
    }

    if (strlen($newPassword) < 6) {
        echo json_encode([
            "success" => false,
            "message" => "Password must be at least 6 characters long."
        ]);
        exit;
    }

    try {
        $objectId       = new MongoDB\BSON\ObjectId($_SESSION['reset_user_id']);
        $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);

        $result = $usersCollection->updateOne(
            ['_id' => $objectId],
            ['$set' => ['password' => $hashedPassword]]
        );

        // Clear the reset session data
        unset($_SESSION['reset_username'], $_SESSION['reset_role'], $_SESSION['reset_user_id']);

        if ($result->getModifiedCount() > 0) {
            echo json_encode([
                "success" => true,
                "message" => "Password has been reset successfully. You can now log in with your new password."
            ]);
        } else {
            echo json_encode([
                "success" => false,
                "message" => "Password was not changed. Please try again."
            ]);
        }

    } catch (Throwable $e) {
        echo json_encode([
            "success" => false,
            "message" => "Database error: " . $e->getMessage()
        ]);
        exit;
    }

} else {
    echo json_encode([
        "success" => false,
        "message" => "Unknown action."
    ]);
    exit;
}
