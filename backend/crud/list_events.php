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

    // Fetch accepted event IDs for judges and tabulators
    $acceptedEventIds = [];
    if ($role === 'judge' || $role === 'tabulator') {
        $acceptedNotifs = $notificationsCollection->find([
            'user_id' => $userObjId,
            'type' => 'event_invitation',
            'status' => 'accepted'
        ]);
        foreach ($acceptedNotifs as $an) {
            if (!empty($an['event_id'])) {
                $acceptedEventIds[] = (int)$an['event_id'];
            }
        }
    }

    $filter = [];
    if ($role === 'judge') {
        $filter = [
            'assignedjudges' => $userObjId,
            '_id' => ['$in' => $acceptedEventIds]
        ];
    } elseif ($role === 'tabulator') {
        $filter = [
            'tabulators' => $userObjId,
            '_id' => ['$in' => $acceptedEventIds]
        ];
    }

    $cursor = $eventsCollection->find($filter, ['sort' => ['createdAt' => -1]]);

    // Fetch all user info
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

    // Map invitation statuses for each event assignment
    $invitationNotifs = $notificationsCollection->find(['type' => 'event_invitation']);
    $invitationStatusMap = [];
    foreach ($invitationNotifs as $inDoc) {
        $eId = (int)($inDoc['event_id'] ?? 0);
        $uId = (string)($inDoc['user_id'] ?? '');
        if ($eId > 0 && $uId !== '') {
            $invitationStatusMap["{$eId}_{$uId}"] = $inDoc['status'] ?? 'pending';
        }
    }

    $events = [];
    foreach ($cursor as $doc) {
        $docId = (int)$doc['_id'];
        $assignedJudgesDetails = [];
        $tabulatorDetails = [];

        if (!empty($doc['assignedjudges']) && is_iterable($doc['assignedjudges'])) {
            foreach ($doc['assignedjudges'] as $jId) {
                $strId = (string)$jId;
                if (isset($userMap[$strId])) {
                    $userInfo = $userMap[$strId];
                    $userInfo['invitation_status'] = $invitationStatusMap["{$docId}_{$strId}"] ?? 'accepted';
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
                    $userInfo['invitation_status'] = $invitationStatusMap["{$docId}_{$strId}"] ?? 'accepted';
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
