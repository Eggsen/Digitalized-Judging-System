/**
 * Security Test Suite: JWT Secret Validation and Fail-Closed Enforcement
 * Verifies that:
 * 1. Missing or undefined JWT_SECRET fails securely
 * 2. Default insecure fallback secret is rejected
 * 3. Short secret (< 32 chars) is rejected
 * 4. High-entropy secret (>= 32 chars) passes validation
 * 5. Token generation and verification are consistent
 */

const { validateJwtSecret, MIN_JWT_SECRET_LENGTH } = require('../config/jwt');
const jwt = require('jsonwebtoken');

console.log('====================================================');
console.log(' BukSU DigiTab - JWT Secret Security Test Suite');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`[PASS] ${testName}`);
        passed++;
    } else {
        console.error(`[FAIL] ${testName}`);
        failed++;
    }
}

// Case 1: Missing / empty secret
const missing1 = validateJwtSecret(null);
assert(missing1.valid === false && missing1.error.includes('missing'), 'Rejects null JWT_SECRET');

const missing2 = validateJwtSecret('');
assert(missing2.valid === false && missing2.error.includes('missing'), 'Rejects empty string JWT_SECRET');

const missing3 = validateJwtSecret('   ');
assert(missing3.valid === false && missing3.error.includes('missing'), 'Rejects whitespace-only JWT_SECRET');

// Case 2: Insecure default fallback secret
const defSecret = validateJwtSecret('changeme');
assert(defSecret.valid === false && defSecret.error.includes('insecure placeholder'), 'Rejects known insecure default "changeme"');

const placeholder = validateJwtSecret('your_secure_random_jwt_secret_key_here');
assert(placeholder.valid === false && placeholder.error.includes('insecure placeholder'), 'Rejects placeholder "your_secure_random_jwt_secret_key_here"');

// Case 3: Insufficient length (< 32 characters)
const shortSecret = validateJwtSecret('short-secret-only-24-chr');
assert(shortSecret.valid === false && shortSecret.error.includes('insufficiently strong'), `Rejects secret under ${MIN_JWT_SECRET_LENGTH} characters`);

// Case 4: Valid high-entropy secret
const validSecret = 'a-very-strong-and-secure-jwt-key-that-exceeds-thirty-two-chars!';
const validRes = validateJwtSecret(validSecret);
assert(validRes.valid === true && validRes.secret === validSecret, 'Accepts valid >= 32 character high-entropy secret');

// Case 5: Token signature and verification integrity
const token = jwt.sign({ userId: 'u123', role: 'admin' }, validSecret, { expiresIn: '1h' });
const decoded = jwt.verify(token, validSecret);
assert(decoded.userId === 'u123' && decoded.role === 'admin', 'Token signed and verified successfully with valid secret');

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);

if (failed > 0) {
    process.exit(1);
}
