const path = require('path');
const dotenv = require('dotenv');

// Ensure environment variables are loaded
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const INSECURE_DEFAULTS = new Set([
    'your_secure_random_jwt_secret_key_here',
    'secret',
    'jwt_secret',
    'changeme',
    'password',
    '12345678',
    'admin'
]);

const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Validates a candidate JWT secret against security standards:
 * - Must be defined and non-empty string
 * - Must not match known default or sample placeholder values
 * - Must meet minimum length requirements (>= 32 characters / 256 bits for HMAC-SHA256)
 *
 * @param {string} secret
 * @returns {{ valid: boolean, error?: string, secret?: string }}
 */
function validateJwtSecret(secret) {
    if (!secret || typeof secret !== 'string' || !secret.trim()) {
        return {
            valid: false,
            error: 'JWT_SECRET environment variable is missing, empty, or not a string.'
        };
    }

    const trimmed = secret.trim();

    if (INSECURE_DEFAULTS.has(trimmed.toLowerCase())) {
        return {
            valid: false,
            error: 'JWT_SECRET is configured to a known insecure placeholder or default fallback value.'
        };
    }

    if (trimmed.length < MIN_JWT_SECRET_LENGTH) {
        return {
            valid: false,
            error: `JWT_SECRET is insufficiently strong (${trimmed.length} characters). Minimum required length is ${MIN_JWT_SECRET_LENGTH} characters.`
        };
    }

    return { valid: true, secret: trimmed };
}

/**
 * Retrieves and enforces validation of the system JWT_SECRET.
 * Throws a fatal exception if the secret is missing or insufficiently secure.
 *
 * @returns {string}
 */
function getValidatedJwtSecret() {
    const result = validateJwtSecret(process.env.JWT_SECRET);
    if (!result.valid) {
        console.error(`[FATAL SECURITY CONFIGURATION] ${result.error}`);
        throw new Error(`[FATAL SECURITY CONFIGURATION] ${result.error}`);
    }
    return result.secret;
}

// Evaluate at load time to enforce early failure before handling requests
const JWT_SECRET = getValidatedJwtSecret();

module.exports = {
    JWT_SECRET,
    validateJwtSecret,
    getValidatedJwtSecret,
    MIN_JWT_SECRET_LENGTH
};
