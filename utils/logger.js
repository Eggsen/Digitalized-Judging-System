const { collections } = require('../config/db');

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

        const logEntry = {
            user_id: userId ? String(userId) : null,
            username: username || 'System',
            role: (role || 'system').toLowerCase(),
            action: action || 'UNKNOWN_ACTION',
            details: details || '',
            ip_address: ipAddress,
            user_agent: userAgent,
            timestamp: new Date().toISOString()
        };

        await collections.logs.insertOne(logEntry);
    } catch (err) {
        console.error('[Logger] Failed to write audit log:', err.message);
    }
}

module.exports = {
    logSystemAction
};

