<?php

/**
 * System Audit Logger Helper
 */
function logSystemAction($userId, $username, $role, $action, $details) {
    global $logsCollection;

    if (!isset($logsCollection)) {
        return false;
    }

    try {
        $userObjId = null;
        if ($userId) {
            try {
                $userObjId = (is_string($userId) && strlen($userId) === 24) ? new MongoDB\BSON\ObjectId($userId) : $userId;
            } catch (Throwable $e) {
                $userObjId = (string)$userId;
            }
        }

        $logDoc = [
            'userId' => $userObjId,
            'username' => $username ?: 'System',
            'role' => strtolower($role ?: 'system'),
            'action' => strtoupper($action),
            'details' => is_array($details) ? json_encode($details) : (string)$details,
            'timestamp' => new MongoDB\BSON\UTCDateTime()
        ];

        $result = $logsCollection->insertOne($logDoc);
        return $result->getInsertedCount() > 0;
    } catch (Throwable $e) {
        error_log("Failed to log system action: " . $e->getMessage());
        return false;
    }
}
