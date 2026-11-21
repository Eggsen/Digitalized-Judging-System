const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'buksu-djs-super-secret-jwt-key-2026';

/**
 * Fast token extractor from Authorization header, HTTP-only cookies, or query parameter.
 * Used for rate-limiting identity resolution prior to database lookups.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractTokenFast(req) {
    if (!req) return null;
    const authHeader = req.headers ? req.headers['authorization'] : null;
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
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
 * Hybrid Identifier Key Generator
 * Identifies clients by authenticated User ID (protecting multiple judges/admins
 * sharing the same campus Wi-Fi / NAT router from collectively exhausting rate limits),
 * and safely falls back to standard IP subnet normalization for unauthenticated visitors.
 * @param {import('express').Request} req
 * @returns {string}
 */
function hybridKeyGenerator(req) {
    // 1. Upstream authenticated user object
    if (req.user && (req.user.id || req.user._id)) {
        return `user_${req.user.id || req.user._id}`;
    }

    // 2. Decode JWT if token is present on the request
    const token = extractTokenFast(req);
    if (token) {
        try {
            const decoded = jwt.decode(token);
            if (decoded && (decoded.id || decoded._id)) {
                return `user_${decoded.id || decoded._id}`;
            }
        } catch (_) {
            // Fall through to IP if token is malformed
        }
    }

    // 3. Fallback to client IP with official IPv4/IPv6 CIDR subnet normalization
    const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    return ipKeyGenerator(clientIp);
}

/**
 * Creates a standard JSON error response handler for 429 status code
 * @param {string} code
 * @param {string} message
 */
function createRateLimitHandler(code, message) {
    return (req, res, next, options) => {
        const statusCode = options.statusCode || 429;
        res.status(statusCode).json({
            success: false,
            code: code,
            message: message
        });
    };
}

// -------------------------------------------------------------
// Tier 1: Rapid-Action / Burst Click Limiter
// Triggers when mutating actions (POST/PUT/PATCH/DELETE) are fired
// multiple times within 1 second.
// -------------------------------------------------------------
const burstActionLimiter = rateLimit({
    windowMs: 1000, // 1 second rolling window
    max: 2, // At most 2 actions within 1 second per client
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: hybridKeyGenerator,
    skip: (req) => {
        // Skip safe read-only methods (GET, HEAD, OPTIONS)
        return req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
    },
    handler: createRateLimitHandler('BURST_LIMIT_EXCEEDED', 'Too many actions, please try again later.')
});

// -------------------------------------------------------------
// Tier 2: Strict Authentication Limiter
// Mitigates brute-force attacks and credential stuffing on Login & PIN verification.
// Uses client IP to defend against unauthorized probing.
// -------------------------------------------------------------
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // 15 attempts per 15 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1'),
    handler: createRateLimitHandler(
        'AUTH_LIMIT_EXCEEDED',
        'Too many authentication attempts from this IP address. Please wait a few minutes before trying again.'
    )
});

// -------------------------------------------------------------
// Tier 3: Email Dispatch Limiter
// Protects SMTP mail quotas and prevents spamming reset/invite links.
// -------------------------------------------------------------
const emailDispatchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: hybridKeyGenerator,
    handler: createRateLimitHandler(
        'EMAIL_LIMIT_EXCEEDED',
        'Too many password reset or invitation requests. Please wait a few minutes before requesting another email.'
    )
});

// -------------------------------------------------------------
// Tier 4: Live Score Submission & Locking Limiter
// Prevents rapid duplicate score submits while giving judges and tabulators
// ample room for live judging during fast-paced competitions.
// -------------------------------------------------------------
const scoreSubmissionLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 score submissions / state modifications per minute
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: hybridKeyGenerator,
    handler: createRateLimitHandler(
        'SCORE_LIMIT_EXCEEDED',
        'Too many score submissions. Please wait a moment before submitting again.'
    )
});

// -------------------------------------------------------------
// Tier 5: Resource-Intensive Operations Limiter
// Throttles PDF generation (pdfmake), bulk media uploads, and database backups.
// -------------------------------------------------------------
const heavyOpsLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 export/upload operations per minute
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: hybridKeyGenerator,
    handler: createRateLimitHandler(
        'HEAVY_OPS_LIMIT_EXCEEDED',
        'Too many export or upload operations. Please wait a moment before trying again.'
    )
});

// -------------------------------------------------------------
// Tier 6: General Catch-All API Limiter
// Global safety net for all /api routes; accommodates 3-second live polling.
// -------------------------------------------------------------
const generalApiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 300, // 300 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: hybridKeyGenerator,
    handler: createRateLimitHandler('API_LIMIT_EXCEEDED', 'Too many requests. Please slow down.')
});

module.exports = {
    hybridKeyGenerator,
    burstActionLimiter,
    authLimiter,
    emailDispatchLimiter,
    scoreSubmissionLimiter,
    heavyOpsLimiter,
    generalApiLimiter
};
