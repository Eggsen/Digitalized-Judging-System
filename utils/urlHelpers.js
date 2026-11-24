const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Resolves a trusted base application URL for security-critical operations
 * (such as password reset links, email invitations, and OAuth redirect URIs).
 *
 * Security Controls:
 * - Mitigates Host-Header Poisoning and Password Reset Token Hijacking.
 * - In production: Requires an explicit, validated APP_URL or BASE_URL.
 * - In development: Accepts strictly validated localhost / 127.0.0.1 or falls back to http://localhost:${PORT}.
 *
 * @param {import('express').Request} [req]
 * @returns {string} Fully qualified trusted base URL (e.g. "https://digitalized-judging-system.onrender.com" or "http://localhost:5000")
 */
function getTrustedBaseUrl(req) {
    const configuredUrl = (process.env.APP_URL || process.env.BASE_URL || '').trim().replace(/\/+$/, '');
    const isProduction = process.env.NODE_ENV === 'production';

    if (configuredUrl) {
        try {
            const parsed = new URL(configuredUrl);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                return configuredUrl;
            }
        } catch (_) {
            console.error('[UrlHelpers] Invalid APP_URL / BASE_URL format:', configuredUrl);
        }
    }

    if (isProduction) {
        console.error('[FATAL SECURITY CONFIGURATION] APP_URL or BASE_URL is required in production for security-sensitive links.');
        throw new Error('FATAL SECURITY CONFIGURATION: APP_URL must be configured in production to prevent Host header poisoning.');
    }

    // In development / local testing:
    const port = process.env.PORT || 5000;
    if (!req) {
        return `http://localhost:${port}`;
    }

    // Strictly validate host against local loopback patterns only
    const rawHost = (req.get('host') || '').trim().toLowerCase();
    const isLocalHost = /^localhost(:\d+)?$/.test(rawHost) || /^127\.0\.0\.1(:\d+)?$/.test(rawHost);

    if (isLocalHost) {
        const protocol = req.protocol === 'https' ? 'https' : 'http';
        return `${protocol}://${rawHost}`;
    }

    // Safe default if an unexpected or spoofed Host header is received in development
    return `http://localhost:${port}`;
}

/**
 * Builds a secure, trusted password reset URL.
 * @param {string} token - Raw unhashed password reset token
 * @param {import('express').Request} [req]
 * @returns {string}
 */
function buildPasswordResetUrl(token, req) {
    const baseUrl = getTrustedBaseUrl(req);
    return `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * Builds a secure, trusted invitation URL.
 * @param {string} token - Invitation token
 * @param {import('express').Request} [req]
 * @returns {string}
 */
function buildInvitationUrl(token, req) {
    const baseUrl = getTrustedBaseUrl(req);
    return `${baseUrl}/auth/accept-invitation?token=${encodeURIComponent(token)}`;
}

module.exports = {
    getTrustedBaseUrl,
    buildPasswordResetUrl,
    buildInvitationUrl
};
