<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    echo json_encode([
        "success" => false,
        "message" => "Authentication required."
    ]);
    exit;
}

require_once __DIR__ . "/../database/config.php";

function formatMongoDate($val) {
    if (empty($val)) return '';
    try {
        if ($val instanceof MongoDB\BSON\UTCDateTime) {
            $dt = $val->toDateTime();
            $dt->setTimezone(new DateTimeZone(date_default_timezone_get() ?: 'Asia/Manila'));
            return $dt->format('Y-m-d h:i A');
        }
        if (is_numeric($val)) {
            return date('Y-m-d h:i A', (int)$val);
        }
        if (is_string($val)) {
            return date('Y-m-d h:i A', strtotime($val));
        }
    } catch (Throwable $e) {
        return (string)$val;
    }
    return '';
}

try {
    $role = strtolower($_SESSION['role'] ?? '');
    $userId = $_SESSION['user_id'];
    $userObjId = new MongoDB\BSON\ObjectId($userId);

    $filter = [];

    // Filter events based on role
    if ($role === 'judge') {
        $filter = ['assignedjudges' => $userObjId];
    } elseif ($role === 'tabulator') {
        $filter = ['tabulators' => $userObjId];
    }
    // Admin sees all events by default

    $cursor = $eventsCollection->find($filter, ['sort' => ['createdAt' => -1]]);

    // Pre-fetch all user info to populate judge and tabulator names cleanly
    $usersCursor = $usersCollection->find([], ['projection' => ['password' => 0]]);
    $userMap = [];
    foreach ($usersCursor as $u) {
        $userMap[(string)$u['_id']] = [
            'id' => (string)$u['_id'],
            'username' => $u['username'] ?? '',
            'email' => $u['email'] ?? '',
            'role' => $u['role'] ?? ''
        ];
    }

    $events = [];
    foreach ($cursor as $doc) {
        $assignedJudgesDetails = [];
        $tabulatorDetails = [];

        if (!empty($doc['assignedjudges']) && is_iterable($doc['assignedjudges'])) {
            foreach ($doc['assignedjudges'] as $jId) {
                $strId = (string)$jId;
                if (isset($userMap[$strId])) {
                    $userInfo = $userMap[$strId];
                    if ($userInfo['role'] === 'tabulator') {
                        $tabulatorDetails[] = $userInfo;
                    } else {
                        $assignedJudgesDetails[] = $userInfo;
                    }
                }
            }
        }

        if (!empty($doc['tabulators']) && is_iterable($doc['tabulators'])) {
            foreach ($doc['tabulators'] as $tId) {
                $strId = (string)$tId;
                if (isset($userMap[$strId])) {
                    $userInfo = $userMap[$strId];
                    if ($userInfo['role'] === 'judge') {
                        $assignedJudgesDetails[] = $userInfo;
                    } else {
                        $tabulatorDetails[] = $userInfo;
                    }
                }
            }
        }

        $creatorId = isset($doc['createdBy']) ? (string)$doc['createdBy'] : '';
        $creatorName = isset($userMap[$creatorId]) ? $userMap[$creatorId]['username'] : 'Admin';

        $events[] = [
            'id' => $doc['_id'],
            'eventName' => $doc['eventName'] ?? '',
            'type' => $doc['type'] ?? '',
            'description' => $doc['description'] ?? '',
            'date' => formatMongoDate($doc['date'] ?? null),
            'rawDate' => isset($doc['date']) && $doc['date'] instanceof MongoDB\BSON\UTCDateTime 
                ? $doc['date']->toDateTime()->format('Y-m-d\TH:i') 
                : '',
            'venue' => $doc['venue'] ?? '',
            'status' => $doc['status'] ?? 'Upcoming',
            'judgingStatus' => $doc['judgingStatus'] ?? 'Not Yet Started',
            'assignedjudges' => $assignedJudgesDetails,
            'tabulators' => $tabulatorDetails,
            'createdBy' => $creatorName,
            'createdAt' => formatMongoDate($doc['createdAt'] ?? null),
            'updatedAt' => formatMongoDate($doc['updatedAt'] ?? null)
        ];
    }

    echo json_encode([
        "success" => true,
        "events" => $events
    ]);

} catch (Throwable $e) {
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
    exit;
}
