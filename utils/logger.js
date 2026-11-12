const { collections } = require('../config/db');

/**
 * Human-readable mapping of audit action codes to clear, non-technical English phrases
 */
const ACTION_MAPPINGS = {
    // Scoring & Judging
    'REQUEST_SCORE_UNLOCK': 'Requested a score unlock',
    'APPROVE_SCORE_UNLOCK': 'Approved score unlock',
    'REJECT_SCORE_UNLOCK': 'Rejected score unlock',
    'JUDGE_SELF_UNLOCK': 'Unlocked a score',
    'UNLOCK_SCORE': 'Unlocked a score',
    'SCORE_UNLOCKED': 'Unlocked a score',
    'LOCK_SCORE': 'Locked a score',
    'SUBMIT_SCORE': 'Submitted a score',
    'SAVE_DRAFT_SCORE': 'Saved draft score',
    'VERIFY_SCORE': 'Verified a score',
    'VERIFY_ALL_SCORES': 'Verified all scores',

    // Authentication & Access
    'LOGIN_LOCAL': 'Signed in',
    'LOGIN_GOOGLE': 'Signed in with Google',
    'LOGOUT': 'Signed out',
    'REQUEST_PASSWORD_RESET': 'Requested password reset',
    'PASSWORD_RESET': 'Reset password',
    'ACCEPT_INVITATION': 'Accepted invitation',
    'VERIFY_ADMIN_PIN': 'Verified Admin PIN',
    'RESET_ADMIN_PIN': 'Reset Admin PIN',

    // Competitions & Events
    'CREATE_EVENT': 'Created an event',
    'UPDATE_EVENT': 'Updated event details',
    'DELETE_EVENT': 'Deleted an event',
    'ARCHIVE_EVENT': 'Archived an event',
    'UNARCHIVE_EVENT': 'Restored an event',
    'ASSIGN_PERSONNEL': 'Assigned event personnel',
    'TOGGLE_JUDGING': 'Changed judging status',
    'ACCEPT_EVENT_INVITATION': 'Accepted event assignment',
    'DECLINE_EVENT_INVITATION': 'Declined event assignment',

    // Criteria & Rules
    'CREATE_CRITERION': 'Added a criterion',
    'UPDATE_CRITERION': 'Updated a criterion',
    'DELETE_CRITERION': 'Deleted a criterion',
    'UPDATE_CRITERIA_WEIGHTS': 'Updated criteria weights',

    // Contestants & Citations
    'CREATE_CONTESTANT': 'Added a contestant',
    'UPDATE_CONTESTANT': 'Updated contestant details',
    'DELETE_CONTESTANT': 'Removed a contestant',
    'ASSIGN_SPECIAL_AWARD': 'Awarded special citation',
    'REMOVE_SPECIAL_AWARD': 'Removed special citation',

    // User Accounts
    'CREATE_USER': 'Created user account',
    'UPDATE_USER': 'Updated user account',
    'DELETE_USER': 'Deleted user account',
    'UPDATE_ROLE': 'Changed user role',

    // System Settings & Maintenance
    'UPDATE_SETTINGS': 'Updated system settings',
    'UPDATE_API_KEYS': 'Updated environment credentials',
    'UPDATE_SECURITY_CONTROLS': 'Updated security controls',
    'EXPORT_BACKUP': 'Exported database backup',
    'CLEAR_LOGS': 'Cleared audit logs',
    'SELECT_LOGO_FROM_LIBRARY': 'Selected logo asset',
    'DELETE_LOGO_FROM_LIBRARY': 'Deleted logo asset',
    'UPLOAD_LOGO': 'Uploaded logo asset'
};

/**
 * Formats any raw action code or slug into natural, human-readable English
 * @param {string} action - Raw action identifier (e.g. 'unlock_score', 'REQUEST_SCORE_UNLOCK')
 * @returns {string} Human-friendly description (e.g. 'Unlocked a score')
 */
function formatActionTerm(action) {
    if (!action || typeof action !== 'string') return 'Activity';
    const trimmed = action.trim();
    if (!trimmed) return 'Activity';

    // 1. Direct or normalized key match
    const normalizedKey = trimmed.toUpperCase().replace(/[\s-]+/g, '_');
    if (ACTION_MAPPINGS[normalizedKey]) {
        return ACTION_MAPPINGS[normalizedKey];
    }
    if (ACTION_MAPPINGS[trimmed]) {
        return ACTION_MAPPINGS[trimmed];
    }

    // 2. Intelligent dynamic fallback for unmapped or custom actions
    const words = trimmed
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_\-]+/g, ' ')
        .trim()
        .split(/\s+/);

    if (words.length === 0) return 'Activity';

    const verbMap = {
        unlock: 'Unlocked a',
        lock: 'Locked a',
        create: 'Created a',
        add: 'Added a',
        delete: 'Deleted',
        remove: 'Removed',
        update: 'Updated',
        edit: 'Updated',
        change: 'Changed',
        modify: 'Modified',
        submit: 'Submitted a',
        verify: 'Verified a',
        approve: 'Approved',
        reject: 'Rejected',
        request: 'Requested',
        assign: 'Assigned',
        accept: 'Accepted',
        decline: 'Declined',
        archive: 'Archived',
        restore: 'Restored',
        unarchive: 'Restored',
        export: 'Exported',
        import: 'Imported',
        clear: 'Cleared',
        reset: 'Reset',
        toggle: 'Toggled',
        upload: 'Uploaded',
        download: 'Downloaded'
    };

    const firstWordLower = words[0].toLowerCase();
    if (verbMap[firstWordLower]) {
        const rest = words.slice(1).join(' ');
        return (verbMap[firstWordLower] + (rest ? ' ' + rest : '')).replace(/\s+/g, ' ').trim();
    }

    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).replace(/_/g, ' ');
}

/**
 * Log an administrative or system action into the audit trail collection
 */
async function logSystemAction(userId, username, role, action, details, req = null) {
    try {
        if (!collections.logs) return;

        let ipAddress = '127.0.0.1';
        let userAgent = 'System / Internal';

        if (req) {
            ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
            if (typeof ipAddress === 'string' && ipAddress.includes(',')) {
                ipAddress = ipAddress.split(',')[0].trim();
            }
            userAgent = req.headers['user-agent'] || 'Unknown Client';
        }

        const rawAction = action || 'UNKNOWN_ACTION';
        const readableAction = formatActionTerm(rawAction);

        const logEntry = {
            user_id: userId ? String(userId) : null,
            username: username || 'System',
            role: (role || 'system').toLowerCase(),
            action: readableAction,
            raw_action: rawAction,
            details: details || '',
            ip_address: ipAddress,
            user_agent: userAgent,
            timestamp: new Date()
        };

        await collections.logs.insertOne(logEntry);
    } catch (err) {
        console.error('[Logger] Failed to write audit log:', err.message);
    }
}

module.exports = {
    logSystemAction,
    formatActionTerm,
    ACTION_MAPPINGS
};
