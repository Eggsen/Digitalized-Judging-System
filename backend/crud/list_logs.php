<?php

header("Content-Type: application/json");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    echo json_encode(["success" => false, "message" => "Please sign in to view activity logs."]);
    exit;
}

$currentRole = strtolower($_SESSION['role'] ?? '');
$currentUserId = (string)$_SESSION['user_id'];
$currentUsername = $_SESSION['username'] ?? '';

if (!in_array($currentRole, ['admin', 'judge', 'tabulator'])) {
    echo json_encode(["success" => false, "message" => "Access denied. Invalid user role."]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== "GET") {
    echo json_encode(["success" => false, "message" => "Invalid HTTP request method."]);
    exit;
}

require_once __DIR__ . "/../database/config.php";

function formatMongoDate($val) {
    if (empty($val)) return '';
    try {
        if ($val instanceof MongoDB\BSON\UTCDateTime) {
            $dt = $val->toDateTime();
            $dt->setTimezone(new DateTimeZone(date_default_timezone_get() ?: 'Asia/Manila'));
            return $dt->format('Y-m-d h:i:s A');
        }
        if (is_numeric($val)) {
            return date('Y-m-d h:i:s A', (int)$val);
        }
        if (is_string($val)) {
            return date('Y-m-d h:i:s A', strtotime($val));
        }
    } catch (Throwable $e) {
        return (string)$val;
    }
    return '';
}

$actionMap = [
    'submit_score'              => 'Submitted a score',
    'save_draft_score'          => 'Saved draft score',
    'unlock_score'              => 'Unlocked contestant score',
    'lock_score'                => 'Locked contestant score',
    'create_event'              => 'Created competition',
    'edit_event'                => 'Updated competition details',
    'archive_event'             => 'Archived competition',
    'delete_archived_event'     => 'Deleted competition',
    'assign_judges'             => 'Assigned judges & tabulators',
    'create_criteria'           => 'Added scoring criterion',
    'edit_criteria'             => 'Updated scoring criterion',
    'delete_criteria'           => 'Removed scoring criterion',
    'configure_weights'         => 'Adjusted criteria percentages',
    'add_contestant'            => 'Registered contestant',
    'create_contestant'         => 'Registered contestant',
    'edit_contestant'           => 'Updated contestant info',
    'update_contestant'         => 'Updated contestant info',
    'delete_contestant'         => 'Removed contestant',
    'reorder_contestants'       => 'Reordered performance lineup',
    'start_judging'             => 'Started judging round',
    'stop_judging'              => 'Ended judging round',
    'accept_event_invitation'   => 'Accepted event assignment',
    'decline_event_invitation'  => 'Declined event assignment',
    'update_user_role'          => 'Changed user role',
    'update_permissions'        => 'Updated user access',
    'update_settings'           => 'Updated system settings',
    'update_security_settings'  => 'Updated security settings',
    'verify_security_settings'  => 'Confirmed security changes',
    'export_backup'             => 'Downloaded database backup',
    'clear_logs'                => 'Purged audit logs',
    'update_institution_logo'   => 'Updated university logo',
    'reset_institution_logo'    => 'Reset university logo',
    'select_logo_from_library'  => 'Selected preset logo',
    'delete_logo_from_library'  => 'Deleted logo from library',
    'login'                     => 'Signed in',
    'logout'                    => 'Signed out',
    'password_reset'            => 'Reset password',
    'invite_user'               => 'Sent account invitation',
    'accept_invitation'         => 'Activated account',
    'revoke_invitation'         => 'Revoked account invitation',
    'revoke_sessions'           => 'Terminated active sessions'
];

/**
 * Convert technical internal action codes into friendly, readable phrases for non-tech users
 */
function formatLogActionLabel($rawAction, $map = null) {
    global $actionMap;
    if ($map === null) {
        $map = $actionMap;
    }

    if (empty($rawAction)) return 'Activity Logged';

    $normalized = strtolower(trim($rawAction));

    if (isset($map[$normalized])) {
        return $map[$normalized];
    }

    $clean = str_replace(['_', '-'], ' ', $normalized);
    return ucfirst($clean);
}

try {
    $search = trim($_GET['search'] ?? '');
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limitParam = (int)($_GET['limit'] ?? 25);
    $allowedLimits = [10, 25, 50, 100];
    $limit = in_array($limitParam, $allowedLimits, true) ? $limitParam : 25;

    $andClauses = [];

    // Role-based segregation: judges and tabulators only see their own actions
    $baseRoleFilter = [];
    if ($currentRole !== 'admin') {
        $idConditions = [
            ['userId' => $currentUserId],
            ['username' => $currentUsername]
        ];
        try {
            if (strlen($currentUserId) === 24) {
                $idConditions[] = ['userId' => new MongoDB\BSON\ObjectId($currentUserId)];
            }
        } catch (Throwable $e) {}

        $baseRoleFilter = ['$or' => $idConditions];
        $andClauses[] = $baseRoleFilter;
    }

    $unfilteredCount = $logsCollection->countDocuments($baseRoleFilter);

    // Search filter across username, role, action, details
    if ($search !== '') {
        $matchingActions = [];
        foreach ($actionMap as $rawKey => $label) {
            if (stripos($label, $search) !== false || stripos($rawKey, $search) !== false) {
                $matchingActions[] = $rawKey;
                $matchingActions[] = strtoupper($rawKey);
                $matchingActions[] = strtolower($rawKey);
            }
        }

        $escaped = preg_quote($search, '/');
        $searchRegex = new MongoDB\BSON\Regex($escaped, 'i');

        $orConditions = [
            ['username' => $searchRegex],
            ['role' => $searchRegex],
            ['details' => $searchRegex],
            ['action' => $searchRegex]
        ];

        if (!empty($matchingActions)) {
            $orConditions[] = ['action' => ['$in' => array_values(array_unique($matchingActions))]];
        }

        $andClauses[] = ['$or' => $orConditions];
    }

    $filter = [];
    if (count($andClauses) === 1) {
        $filter = $andClauses[0];
    } elseif (count($andClauses) > 1) {
        $filter = ['$and' => $andClauses];
    }

    $totalCount = $logsCollection->countDocuments($filter);
    $totalPages = $totalCount > 0 ? (int)ceil($totalCount / $limit) : 1;

    if ($page > $totalPages && $totalPages > 0) {
        $page = $totalPages;
    }

    $skip = ($page - 1) * $limit;

    $cursor = $logsCollection->find($filter, [
        'sort' => ['timestamp' => -1],
        'skip' => $skip,
        'limit' => $limit
    ]);

    $logs = [];
    foreach ($cursor as $doc) {
        $rawAction = $doc['action'] ?? 'ACTION';
        $logs[] = [
            'id' => (string)$doc['_id'],
            'userId' => isset($doc['userId']) ? (string)$doc['userId'] : '',
            'username' => $doc['username'] ?? 'System',
            'role' => $doc['role'] ?? 'system',
            'rawAction' => $rawAction,
            'action' => formatLogActionLabel($rawAction, $actionMap),
            'details' => $doc['details'] ?? '',
            'timestamp' => formatMongoDate($doc['timestamp'] ?? null)
        ];
    }

    $start = $totalCount > 0 ? $skip + 1 : 0;
    $end = $totalCount > 0 ? min($skip + $limit, $totalCount) : 0;

    echo json_encode([
        "success" => true,
        "role" => $currentRole,
        "logs" => $logs,
        "total" => $totalCount,
        "unfilteredTotal" => $unfilteredCount,
        "page" => $page,
        "limit" => $limit,
        "totalPages" => $totalPages,
        "start" => $start,
        "end" => $end
    ]);

} catch (Throwable $e) {
    echo json_encode(["success" => false, "message" => "Database error: " . $e->getMessage()]);
    exit;
}
