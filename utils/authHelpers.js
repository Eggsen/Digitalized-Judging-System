const { collections } = require('../config/db');
const { getIdFilter } = require('./dbHelpers');

// Default primary account with exclusive privileges to create admin accounts
const DEFAULT_AUTHORIZED_ADMIN_CREATORS = [
    '2401108432@student.buksu.edu.ph'
];

/**
 * Get the consolidated list of emails authorized to create Administrator accounts.
 * Combines built-in defaults, environment configuration, and database settings.
 * 
 * @param {Object} [settingsDoc] - Optional cached settings document
 * @returns {string[]} Lowercase trimmed emails
 */
function getAuthorizedAdminEmails(settingsDoc = null) {
    const list = new Set(DEFAULT_AUTHORIZED_ADMIN_CREATORS.map(e => e.toLowerCase().trim()));

    // 1. From environment variable (e.g. ADMIN_CREATOR_EMAILS="2401108432@student.buksu.edu.ph,other@buksu.edu.ph")
    const envStr = (process.env.ADMIN_CREATOR_EMAILS || process.env.SUPER_ADMIN_EMAILS || '').trim();
    if (envStr) {
        envStr.split(',').forEach(e => {
            const clean = e.toLowerCase().trim();
            if (clean) list.add(clean);
        });
    }

    // 2. From database settings if provided
    if (settingsDoc) {
        const configured = settingsDoc?.security?.authorized_admin_creators 
            || settingsDoc?.security?.authorizedAdminCreators 
            || settingsDoc?.authorized_admin_creators;

        if (Array.isArray(configured)) {
            configured.forEach(e => {
                const s = String(e || '').toLowerCase().trim();
                if (s) list.add(s);
            });
        } else if (typeof configured === 'string') {
            configured.split(',').forEach(e => {
                const s = e.toLowerCase().trim();
                if (s) list.add(s);
            });
        }
    }

    return Array.from(list);
}

/**
 * Synchronous check whether a specific email address is in the authorized admin creators list.
 * 
 * @param {string} email
 * @param {Object} [settingsDoc]
 * @returns {boolean}
 */
function isEmailAuthorizedAdminCreator(email, settingsDoc = null) {
    if (!email || typeof email !== 'string') return false;
    const clean = email.toLowerCase().trim();
    const authorized = getAuthorizedAdminEmails(settingsDoc);
    return authorized.includes(clean);
}

/**
 * Asynchronous check whether a user has elevated privilege to create, promote, or delete Administrator accounts.
 * Verifies user role, explicit DB flags (can_create_admin, is_super_admin), and authorized emails list.
 * 
 * @param {Object} user - User document or decoded JWT
 * @param {Object} [settingsDoc] - Optional settings document
 * @returns {Promise<boolean>}
 */
async function canUserCreateAdmin(user, settingsDoc = null) {
    if (!user) return false;

    const role = (user.role || '').toLowerCase();
    if (role !== 'admin') {
        return false;
    }

    // Direct boolean flags on user object
    if (user.can_create_admin === true || user.is_super_admin === true) {
        return true;
    }

    let email = (user.email || '').toLowerCase().trim();

    // If user object lacks email (e.g. partial JWT payload), fetch from database
    let dbUser = null;
    if (!email && user.id && collections.users) {
        try {
            dbUser = await collections.users.findOne(
                getIdFilter(user.id),
                { projection: { email: 1, role: 1, can_create_admin: 1, is_super_admin: 1 } }
            );
            if (dbUser) {
                if (dbUser.can_create_admin === true || dbUser.is_super_admin === true) {
                    return true;
                }
                email = (dbUser.email || '').toLowerCase().trim();
            }
        } catch (e) {
            // DB lookup failed or unavailable
        }
    }

    // Retrieve settings if not provided
    let settings = settingsDoc;
    if (!settings && collections.settings) {
        try {
            settings = await collections.settings.findOne({ _id: 'system_settings' });
        } catch (e) {}
    }

    if (email && isEmailAuthorizedAdminCreator(email, settings)) {
        return true;
    }

    // Final fallback: check database record if we have an ID and haven't fetched dbUser yet
    if (user.id && !dbUser && collections.users) {
        try {
            const u = await collections.users.findOne(
                getIdFilter(user.id),
                { projection: { can_create_admin: 1, is_super_admin: 1 } }
            );
            if (u && (u.can_create_admin === true || u.is_super_admin === true)) {
                return true;
            }
        } catch (e) {}
    }

    return false;
}

module.exports = {
    DEFAULT_AUTHORIZED_ADMIN_CREATORS,
    getAuthorizedAdminEmails,
    isEmailAuthorizedAdminCreator,
    canUserCreateAdmin
};

