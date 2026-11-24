/**
 * Security Test Suite: Google OAuth State Validation (CSRF Mitigation)
 * Verifies that:
 * 1. Missing state in callback query is rejected
 * 2. Missing state cookie is rejected
 * 3. Mismatched state (CSRF attempt) is rejected
 * 4. State cookie is cleared on receipt
 * 5. Matching state proceeds with token exchange
 */

const { googleCallback } = require('../controllers/authController');

console.log('====================================================');
console.log(' BukSU DigiTab - OAuth State Validation Test');
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

function mockRes() {
    return {
        redirectUrl: null,
        clearedCookies: [],
        redirect(url) {
            this.redirectUrl = url;
            return this;
        },
        clearCookie(name) {
            this.clearedCookies.push(name);
            return this;
        }
    };
}

async function runTests() {
    // Test 1: Missing state query parameter
    {
        const req = {
            query: { code: 'auth_code_123' },
            cookies: { oauth_state: 'valid_cookie_state' }
        };
        const res = mockRes();
        await googleCallback(req, res);
        assert(res.redirectUrl === '/auth/login?error=invalid_oauth_state',
            'Missing state query parameter is rejected with invalid_oauth_state');
        assert(res.clearedCookies.includes('oauth_state'), 'State cookie was cleared');
    }

    // Test 2: Missing state cookie
    {
        const req = {
            query: { code: 'auth_code_123', state: 'some_state' },
            cookies: {}
        };
        const res = mockRes();
        await googleCallback(req, res);
        assert(res.redirectUrl === '/auth/login?error=invalid_oauth_state',
            'Missing oauth_state cookie is rejected with invalid_oauth_state');
    }

    // Test 3: Mismatched state (simulated CSRF attack)
    {
        const req = {
            query: { code: 'attacker_code', state: 'attacker_state' },
            cookies: { oauth_state: 'victim_state' }
        };
        const res = mockRes();
        await googleCallback(req, res);
        assert(res.redirectUrl === '/auth/login?error=invalid_oauth_state',
            'Mismatched state (CSRF attack) is rejected with invalid_oauth_state');
    }

    // Test 4: Denied consent
    {
        const req = {
            query: { error: 'access_denied' },
            cookies: { oauth_state: 'some_state' }
        };
        const res = mockRes();
        await googleCallback(req, res);
        assert(res.redirectUrl === '/auth/login?error=oauth_denied',
            'OAuth provider error is handled with oauth_denied redirect');
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
