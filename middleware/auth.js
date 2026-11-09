const jwt = require('jsonwebtoken');

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
    if (req.query && req.query.token) {
        return req.query.token;
    }
    return null;
}

/**
 * Generate a JWT token for a user
 */
function generateToken(user) {
    const payload = {
        id: String(user._id || user.id),
        username: user.username,
        email: user.email || '',
        role: (user.role || 'judge').toLowerCase(),
        full_name: user.full_name || user.name || user.username
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

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: 'Session expired or invalid. Please sign in again.'
            });
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

