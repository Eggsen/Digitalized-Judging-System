<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "Authentication required."]);
    exit;
}

require_once __DIR__ . "/../database/config.php";
require_once __DIR__ . "/../utils/logger.php";

$method = $_SERVER['REQUEST_METHOD'];

function parseTeamMembers($raw) {
    if (is_array($raw)) {
        return array_values(array_filter(array_map('trim', $raw), fn($m) => $m !== ''));
    }
    if (is_string($raw)) {
        $lines = preg_split('/[\r\n,]+/', $raw);
        return array_values(array_filter(array_map('trim', $lines), fn($m) => $m !== ''));
    }
    return [];
}

// GET: Retrieve contestants for an event (available to all logged-in roles)
if ($method === "GET") {
    $eventId = (int)($_GET['event_id'] ?? 0);
    if ($eventId <= 0) {
        echo json_encode(["success" => false, "message" => "Valid event_id is required."]);
        exit;
    }

    try {
        $cursor = $contestantsCollection->find(
            ['event_id' => $eventId],
            ['sort' => ['contestant_number' => 1]]
        );

        $contestants = [];
        foreach ($cursor as $doc) {
            $idStr = (string)$doc['_id'];
            $contestants[] = [
                'id' => $idStr,
                'contestant_number' => (int)($doc['contestant_number'] ?? 0),
                'name' => $doc['name'] ?? '',
                'department_or_org' => $doc['department_or_org'] ?? '',
                'description' => $doc['description'] ?? '',
                'entry_type' => $doc['entry_type'] ?? 'individual',
                'team_members' => (array)($doc['team_members'] ?? []),
                'comments' => (array)($doc['comments'] ?? []),
                'event_id' => (int)($doc['event_id'] ?? $eventId),
                'created_at' => isset($doc['created_at']) ? (string)$doc['created_at'] : ''
            ];
        }

        echo json_encode([
            "success" => true,
            "contestants" => $contestants
        ]);
        exit;
    } catch (Throwable $e) {
        echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
        exit;
    }
}

// POST: Manage contestants & awards
if ($method === "POST") {
    $rawJson = file_get_contents("php://input");
    $data = json_decode($rawJson, true);
    if (!$data) {
        echo json_encode(["success" => false, "message" => "Invalid JSON payload."]);
        exit;
    }

    $action = trim($data['action'] ?? 'create');
    $userRole = strtolower($_SESSION['role'] ?? '');

    // Restrict structural changes to Admin only
    if (in_array($action, ['create', 'edit', 'update_members', 'delete'])) {
        if ($userRole !== 'admin') {
            echo json_encode(["success" => false, "message" => "Access denied. Only administrators can perform this action."]);
            exit;
        }
    }

    // Action 1: Create contestant
    if ($action === 'create') {
        $eventId = (int)($data['event_id'] ?? 0);
        $contestantNumber = (int)($data['contestant_number'] ?? 0);
        $name = trim($data['name'] ?? '');
        $department = trim($data['department_or_org'] ?? '');
        $description = trim($data['description'] ?? '');
        $entryType = in_array(strtolower($data['entry_type'] ?? ''), ['team', 'team-based', 'group']) ? 'team' : 'individual';
        $teamMembers = parseTeamMembers($data['team_members'] ?? []);

        $comments = [];
        $initialComment = trim($data['initial_comment'] ?? ($data['comment'] ?? ''));
        if ($initialComment !== '') {
            $comments[] = [
                'id' => 'cmt-' . bin2hex(random_bytes(4)),
                'text' => $initialComment,
                'author' => $_SESSION['username'] ?? 'Admin',
                'created_at' => (new DateTime())->format('Y-m-d H:i:s')
            ];
        }

        if ($eventId <= 0 || $contestantNumber <= 0 || $name === '') {
            echo json_encode(["success" => false, "message" => "Contestant number, name, and valid event_id are required."]);
            exit;
        }

        try {
            // Check if contestant number already exists for this event
            $existing = $contestantsCollection->findOne([
                'event_id' => $eventId,
                'contestant_number' => $contestantNumber
            ]);

            if ($existing) {
                echo json_encode(["success" => false, "message" => "Contestant #{$contestantNumber} already exists in this competition."]);
                exit;
            }

            $newId = "contestant-" . bin2hex(random_bytes(6));
            $doc = [
                '_id' => $newId,
                'contestant_number' => $contestantNumber,
                'name' => $name,
                'department_or_org' => $department,
                'description' => $description,
                'entry_type' => $entryType,
                'team_members' => $teamMembers,
                'comments' => $comments,
                'event_id' => $eventId,
                'created_at' => (new DateTime())->format('Y-m-d H:i:s')
            ];

            $contestantsCollection->insertOne($doc);

            logSystemAction(
                $_SESSION['user_id'],
                $_SESSION['username'],
                $_SESSION['role'],
                'CREATE_CONTESTANT',
                "Created Contestant #{$contestantNumber} '{$name}' ({$entryType}) for event ID: {$eventId}."
            );

            echo json_encode([
                "success" => true,
                "message" => "Contestant #{$contestantNumber} '{$name}' added successfully!",
                "contestant" => [
                    'id' => $newId,
                    'contestant_number' => $contestantNumber,
                    'name' => $name,
                    'department_or_org' => $department,
                    'description' => $description,
                    'entry_type' => $entryType,
                    'team_members' => $teamMembers,
                    'comments' => $comments,
                    'event_id' => $eventId
                ]
            ]);
            exit;
        } catch (Throwable $e) {
            echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
            exit;
        }
    }

    // Action 2: Edit contestant
    if ($action === 'edit') {
        $id = trim($data['id'] ?? '');
        $contestantNumber = (int)($data['contestant_number'] ?? 0);
        $name = trim($data['name'] ?? '');
        $department = trim($data['department_or_org'] ?? '');
        $description = trim($data['description'] ?? '');

        if ($id === '' || $name === '' || $contestantNumber <= 0) {
            echo json_encode(["success" => false, "message" => "Contestant ID, number, and name are required."]);
            exit;
        }

        try {
            $filter = ['_id' => $id];
            if (preg_match('/^[a-f\d]{24}$/i', $id)) {
                $filter = ['$or' => [['_id' => new MongoDB\BSON\ObjectId($id)], ['_id' => $id]]];
            }

            $existing = $contestantsCollection->findOne($filter);
            if (!$existing) {
                echo json_encode(["success" => false, "message" => "Contestant record not found."]);
                exit;
            }

            $eventId = (int)$existing['event_id'];

            // Check if updated number conflicts with another contestant in the same event
            $duplicate = $contestantsCollection->findOne([
                'event_id' => $eventId,
                'contestant_number' => $contestantNumber,
                '_id' => ['$ne' => $existing['_id']]
            ]);

            if ($duplicate) {
                echo json_encode(["success" => false, "message" => "Contestant #{$contestantNumber} is already taken by another contestant."]);
                exit;
            }

            $updateFields = [
                'contestant_number' => $contestantNumber,
                'name' => $name,
                'department_or_org' => $department,
                'description' => $description,
                'updated_at' => (new DateTime())->format('Y-m-d H:i:s')
            ];

            if (isset($data['entry_type'])) {
                $updateFields['entry_type'] = in_array(strtolower($data['entry_type']), ['team', 'team-based', 'group']) ? 'team' : 'individual';
            }
            if (isset($data['team_members'])) {
                $updateFields['team_members'] = parseTeamMembers($data['team_members']);
            }

            $contestantsCollection->updateOne(
                ['_id' => $existing['_id']],
                ['$set' => $updateFields]
            );

            logSystemAction(
                $_SESSION['user_id'],
                $_SESSION['username'],
                $_SESSION['role'],
                'EDIT_CONTESTANT',
                "Updated Contestant #{$contestantNumber} '{$name}' (ID: {$id})."
            );

            echo json_encode([
                "success" => true,
                "message" => "Contestant details updated successfully!"
            ]);
            exit;
        } catch (Throwable $e) {
            echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
            exit;
        }
    }

    // Action 3: Add Comment / Special Citation (Judge or Admin)
    if ($action === 'add_comment' || $action === 'add_award') {
        if (!in_array($userRole, ['admin', 'judge'])) {
            echo json_encode(["success" => false, "message" => "Access denied. Only judges or administrators can assign awards/comments."]);
            exit;
        }

        $contestantId = trim($data['contestant_id'] ?? ($data['id'] ?? ''));
        $awardTitle = trim($data['award_title'] ?? ($data['title'] ?? ''));
        $memberName = trim($data['member_name'] ?? ($data['member'] ?? ''));
        $commentText = trim($data['text'] ?? ($data['comment'] ?? ''));

        // Format display text nicely
        if ($awardTitle !== '') {
            $displayText = $awardTitle;
            if ($memberName !== '' && $memberName !== 'Entire Team') {
                $displayText .= " - " . $memberName;
            }
            if ($commentText !== '' && $commentText !== $awardTitle) {
                $displayText .= " (" . $commentText . ")";
            }
        } else {
            $displayText = $commentText;
        }

        if ($contestantId === '' || $displayText === '') {
            echo json_encode(["success" => false, "message" => "Contestant ID and award/citation details are required."]);
            exit;
        }

        try {
            $filter = ['_id' => $contestantId];
            if (preg_match('/^[a-f\d]{24}$/i', $contestantId)) {
                $filter = ['$or' => [['_id' => new MongoDB\BSON\ObjectId($contestantId)], ['_id' => $contestantId]]];
            }

            $existing = $contestantsCollection->findOne($filter);
            if (!$existing) {
                echo json_encode(["success" => false, "message" => "Contestant record not found."]);
                exit;
            }

            // If user is a judge, enforce judging period and score lock policy (unified with scoring)
            if ($userRole === 'judge') {
                $event = $eventsCollection->findOne(['_id' => (int)$existing['event_id']]);
                if (!$event || ($event['judgingStatus'] ?? '') !== 'In Progress') {
                    echo json_encode(["success" => false, "message" => "Judging session is inactive. Awards cannot be modified."]);
                    exit;
                }

                $judgeScore = $scoresCollection->findOne([
                    'event_id' => (int)$existing['event_id'],
                    'contestant_id' => (string)$existing['_id'],
                    'judge_id' => (string)$_SESSION['user_id']
                ]);

                if ($judgeScore && ($judgeScore['status'] ?? '') === 'submitted') {
                    $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']);
                    $unlockPolicy = $settingsDoc['judging']['unlockPolicy'] ?? 'admin_approval';

                    if ($unlockPolicy === 'locked_after_submit') {
                        echo json_encode(["success" => false, "message" => "This evaluation is finalized and strictly locked. Awards cannot be modified."]);
                        exit;
                    } else if ($unlockPolicy === 'admin_approval') {
                        echo json_encode(["success" => false, "message" => "This contestant's evaluation is submitted and locked. You must ask an Administrator or Tabulator to unlock it before modifying awards."]);
                        exit;
                    }
                }
            }

            $commentObj = [
                'id' => 'cmt-' . bin2hex(random_bytes(4)),
                'text' => $displayText,
                'award_title' => $awardTitle !== '' ? $awardTitle : $displayText,
                'member_name' => $memberName,
                'comment' => $commentText,
                'author' => $_SESSION['username'] ?? ($userRole === 'admin' ? 'Admin' : 'Judge'),
                'author_role' => $userRole,
                'judge_id' => (string)$_SESSION['user_id'],
                'created_at' => (new DateTime())->format('Y-m-d H:i:s')
            ];

            $contestantsCollection->updateOne(
                ['_id' => $existing['_id']],
                ['$push' => ['comments' => $commentObj]]
            );

            logSystemAction(
                $_SESSION['user_id'],
                $_SESSION['username'],
                $_SESSION['role'],
                'ADD_CONTESTANT_AWARD',
                "Assigned award/citation '{$displayText}' to Contestant #{$existing['contestant_number']} '{$existing['name']}'."
            );

            echo json_encode([
                "success" => true,
                "message" => "Special citation/award assigned successfully!",
                "comment" => $commentObj
            ]);
            exit;
        } catch (Throwable $e) {
            echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
            exit;
        }
    }

    // Action 4: Delete Comment / Citation from Contestant (Admin, or Judge who assigned it)
    if ($action === 'delete_comment' || $action === 'delete_award') {
        if (!in_array($userRole, ['admin', 'judge'])) {
            echo json_encode(["success" => false, "message" => "Access denied."]);
            exit;
        }

        $contestantId = trim($data['contestant_id'] ?? ($data['id'] ?? ''));
        $commentId = trim($data['comment_id'] ?? '');

        if ($contestantId === '' || $commentId === '') {
            echo json_encode(["success" => false, "message" => "Contestant ID and comment/award ID are required."]);
            exit;
        }

        try {
            $filter = ['_id' => $contestantId];
            if (preg_match('/^[a-f\d]{24}$/i', $contestantId)) {
                $filter = ['$or' => [['_id' => new MongoDB\BSON\ObjectId($contestantId)], ['_id' => $contestantId]]];
            }

            $existing = $contestantsCollection->findOne($filter);
            if (!$existing) {
                echo json_encode(["success" => false, "message" => "Contestant record not found."]);
                exit;
            }

            // If judge, verify judging session, score lock policy, and ownership
            if ($userRole === 'judge') {
                $event = $eventsCollection->findOne(['_id' => (int)$existing['event_id']]);
                if (!$event || ($event['judgingStatus'] ?? '') !== 'In Progress') {
                    echo json_encode(["success" => false, "message" => "Judging session is inactive. Awards cannot be modified."]);
                    exit;
                }

                $judgeScore = $scoresCollection->findOne([
                    'event_id' => (int)$existing['event_id'],
                    'contestant_id' => (string)$existing['_id'],
                    'judge_id' => (string)$_SESSION['user_id']
                ]);

                if ($judgeScore && ($judgeScore['status'] ?? '') === 'submitted') {
                    $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']);
                    $unlockPolicy = $settingsDoc['judging']['unlockPolicy'] ?? 'admin_approval';

                    if ($unlockPolicy === 'locked_after_submit') {
                        echo json_encode(["success" => false, "message" => "This evaluation is finalized and strictly locked. Awards cannot be removed."]);
                        exit;
                    } else if ($unlockPolicy === 'admin_approval') {
                        echo json_encode(["success" => false, "message" => "This contestant's evaluation has been submitted and locked. Ask an Administrator or Tabulator to unlock it before removing awards."]);
                        exit;
                    }
                }

                $isOwner = false;
                $currentUserId = (string)$_SESSION['user_id'];
                $currentUsername = (string)($_SESSION['username'] ?? '');

                foreach ($existing['comments'] ?? [] as $cmt) {
                    if (($cmt['id'] ?? '') === $commentId) {
                        if ((string)($cmt['judge_id'] ?? '') === $currentUserId || (string)($cmt['author'] ?? '') === $currentUsername) {
                            $isOwner = true;
                        }
                        break;
                    }
                }

                if (!$isOwner) {
                    echo json_encode(["success" => false, "message" => "You can only remove awards/citations that you personally assigned."]);
                    exit;
                }
            }

            $contestantsCollection->updateOne(
                ['_id' => $existing['_id']],
                ['$pull' => ['comments' => ['id' => $commentId]]]
            );

            logSystemAction(
                $_SESSION['user_id'],
                $_SESSION['username'],
                $_SESSION['role'],
                'DELETE_CONTESTANT_AWARD',
                "Removed award/citation ID '{$commentId}' from Contestant #{$existing['contestant_number']} '{$existing['name']}'."
            );

            echo json_encode([
                "success" => true,
                "message" => "Special award/citation removed successfully."
            ]);
            exit;
        } catch (Throwable $e) {
            echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
            exit;
        }
    }

    // Action 5: Update Team Members
    if ($action === 'update_members') {
        $contestantId = trim($data['contestant_id'] ?? ($data['id'] ?? ''));
        $members = parseTeamMembers($data['team_members'] ?? []);

        if ($contestantId === '') {
            echo json_encode(["success" => false, "message" => "Contestant ID is required."]);
            exit;
        }

        try {
            $filter = ['_id' => $contestantId];
            if (preg_match('/^[a-f\d]{24}$/i', $contestantId)) {
                $filter = ['$or' => [['_id' => new MongoDB\BSON\ObjectId($contestantId)], ['_id' => $contestantId]]];
            }

            $existing = $contestantsCollection->findOne($filter);
            if (!$existing) {
                echo json_encode(["success" => false, "message" => "Contestant record not found."]);
                exit;
            }

            $contestantsCollection->updateOne(
                ['_id' => $existing['_id']],
                ['$set' => [
                    'team_members' => $members,
                    'entry_type' => 'team'
                ]]
            );

            logSystemAction(
                $_SESSION['user_id'],
                $_SESSION['username'],
                $_SESSION['role'],
                'UPDATE_TEAM_MEMBERS',
                "Updated team members for Contestant #{$existing['contestant_number']} '{$existing['name']}'."
            );

            echo json_encode([
                "success" => true,
                "message" => "Team members updated successfully!",
                "team_members" => $members
            ]);
            exit;
        } catch (Throwable $e) {
            echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
            exit;
        }
    }

    // Action 6: Delete contestant
    if ($action === 'delete') {
        $id = trim($data['id'] ?? '');
        if ($id === '') {
            echo json_encode(["success" => false, "message" => "Contestant ID is required."]);
            exit;
        }

        try {
            $filter = ['_id' => $id];
            if (preg_match('/^[a-f\d]{24}$/i', $id)) {
                $filter = ['$or' => [['_id' => new MongoDB\BSON\ObjectId($id)], ['_id' => $id]]];
            }

            $existing = $contestantsCollection->findOne($filter);
            if (!$existing) {
                echo json_encode(["success" => false, "message" => "Contestant record not found."]);
                exit;
            }

            $contestantsCollection->deleteOne(['_id' => $existing['_id']]);

            // Also clean up any associated score records
            $scoresCollection->deleteMany(['contestant_id' => (string)$existing['_id']]);

            logSystemAction(
                $_SESSION['user_id'],
                $_SESSION['username'],
                $_SESSION['role'],
                'DELETE_CONTESTANT',
                "Deleted Contestant #{$existing['contestant_number']} '{$existing['name']}'."
            );

            echo json_encode([
                "success" => true,
                "message" => "Contestant removed successfully."
            ]);
            exit;
        } catch (Throwable $e) {
            echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
            exit;
        }
    }

    echo json_encode(["success" => false, "message" => "Invalid action specified."]);
    exit;
}

echo json_encode(["success" => false, "message" => "Method not allowed."]);
exit;
