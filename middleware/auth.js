const jwt = require('jsonwebtoken');
const { collections } = require('../config/db');
const { getIdFilter } = require('../utils/dbHelpers');
const { isEmailAuthorizedAdminCreator } = require('../utils/authHelpers');

const JWT_SECRET = process.env.JWT_SECRET || 'buksu-djs-super-secret-jwt-key-2026';

/**
 * Extract token from Authorization Bearer header or HTTP-only cookies
 */
function extractToken(req) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1].trim();
    }
    if (req.cookies && (req.cookies.djs_token || req.cookies.jwt_token || req.cookies.token)) {
        return req.cookies.djs_token || req.cookies.jwt_token || req.cookies.token;
    }
    // Only permit query token on specific download/export endpoints (e.g. PDF export)
    if (req.query && req.query.token) {
        const isDownloadEndpoint = req.path.includes('/export-pdf') || req.path.includes('/download') || req.path.includes('/qr') || req.path.includes('/export') || req.path.includes('/executive-summary');
        if (isDownloadEndpoint) {
            return req.query.token;
        }
    }
    return null;
}

/**
 * Generate a JWT token for a user with embedded MVCC token_version
 */
function generateToken(user) {
    const role = (user.role || 'judge').toLowerCase();
    const email = (user.email || '').toLowerCase().trim();
    const canCreateAdmin = role === 'admin' && Boolean(
        user.can_create_admin === true || 
        user.is_super_admin === true || 
        isEmailAuthorizedAdminCreator(email)
    );

    const payload = {
        id: String(user._id || user.id),
        username: user.username,
        email: email,
        role: role,
        can_create_admin: canCreateAdmin,
        full_name: user.full_name || user.name || user.username,
        token_version: Number(user.token_version || 1)
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '7d'
    });
}

/**
 * Middleware: Require valid authentication token (RESTful Bearer or Cookie)
 */
function authenticateToken(req, res, next) {
    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required. Please sign in.'
        });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: 'Session expired or invalid. Please sign in again.'
            });
        }

        // Active account, role, and MVCC token_version verification
        try {
            if (collections.users && decoded.id) {
                const u = await collections.users.findOne(
                    getIdFilter(decoded.id),
                    { projection: { is_active: 1, status: 1, role: 1, token_version: 1 } }
                );
                if (u && (u.is_active === false || u.status === 'disabled')) {
                    return res.status(403).json({
                        success: false,
                        code: 'ACCOUNT_DISABLED',
                        message: 'Your account has been deactivated. Please contact an administrator.'
                    });
                }

                // MVCC: Concurrency Session Version Check
                // If a newer login or admin action bumped token_version in the DB, this older session is superseded
                const currentDbVersion = Number(u?.token_version || 1);
                const tokenVersion = Number(decoded.token_version || 1);
                if (u && tokenVersion < currentDbVersion) {
                    return res.status(401).json({
                        success: false,
                        code: 'SESSION_SUPERSEDED',
                        session_expired: true,
                        message: 'Your session has ended because this account signed in from another device or was refreshed.'
                    });
                }

                if (u && u.role) {
                    decoded.role = u.role.toLowerCase();
                }
                const email = (u?.email || decoded.email || '').toLowerCase().trim();
                decoded.can_create_admin = decoded.role === 'admin' && Boolean(
                    u?.can_create_admin === true || 
                    u?.is_super_admin === true || 
                    decoded.can_create_admin === true || 
                    isEmailAuthorizedAdminCreator(email)
                );
            }
        } catch (dbErr) {
            // Fail open on database connection hiccup
        }

        if (decoded.can_create_admin === undefined) {
            const email = (decoded.email || '').toLowerCase().trim();
            decoded.can_create_admin = (decoded.role || '').toLowerCase() === 'admin' && isEmailAuthorizedAdminCreator(email);
        }

        req.user = decoded;
        next();
    });
}

/**
 * Middleware: Optional authentication (attaches user if token present)
 */
function optionalToken(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (!err && decoded) {
            const email = (decoded.email || '').toLowerCase().trim();
            decoded.can_create_admin = (decoded.role || '').toLowerCase() === 'admin' && Boolean(
                decoded.can_create_admin === true || isEmailAuthorizedAdminCreator(email)
            );
            req.user = decoded;
        } else {
            req.user = null;
        }
        next();
    });
}

/**
 * Middleware: Role-Based Access Control (RBAC)
 * e.g. requireRole(['admin']), requireRole(['admin', 'tabulator'])
 */
function requireRole(allowedRoles = []) {
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles.map(r => r.toLowerCase()) : [allowedRoles.toLowerCase()];

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.'
            });
        }

        const userRole = (req.user.role || '').toLowerCase();
        if (!rolesArray.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Requires one of the following roles: ${rolesArray.join(', ')}.`
            });
        }

        next();
    };
}

module.exports = {
    JWT_SECRET,
    generateToken,
    authenticateToken,
    optionalToken,
    requireRole
};

