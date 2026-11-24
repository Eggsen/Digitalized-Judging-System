/**
 * Security Test Suite: reCAPTCHA Fail-Secure & Bypass Hardening Test
 * Verifies that:
 * 1. test_bypass token is forbidden in production
 * 2. Missing production credentials fail closed with 503
 * 3. Service failure in production fails closed with 503
 * 4. Legitimate local test bypass works in development
 */

const { verifyRecaptcha } = require('../middleware/recaptcha');
const { collections } = require('../config/db');

console.log('====================================================');
console.log(' BukSU DigiTab - reCAPTCHA Security Test');
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
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        }
    };
}

async function runTests() {
    collections.settings = {
        findOne: async () => ({
            _id: 'system_settings',
            security: { recaptchaEnabled: true }
        })
    };

    // Test 1: Production forbids test_bypass token
    {
        process.env.NODE_ENV = 'production';
        process.env.RECAPTCHA_SECRET_KEY = '6Le-w-fake-secret-key-for-test-32char!';
        const req = {
            body: { recaptcha_token: 'test_bypass' },
            headers: {}
        };
        const res = mockRes();
        let nextCalled = false;
        await verifyRecaptcha(req, res, () => { nextCalled = true; });
        // Since test_bypass is not bypassed in production, it sends request to Google API (which will fail for fake key)
        assert(!nextCalled && (res.statusCode === 400 || res.statusCode === 503),
            'Production disallows test_bypass and blocks unauthenticated progression');
    }

    // Test 2: Production with missing secret key fails closed with HTTP 503
    {
        process.env.NODE_ENV = 'production';
        delete process.env.RECAPTCHA_SECRET_KEY;
        const req = {
            body: { recaptcha_token: 'some_client_token' },
            headers: {}
        };
        const res = mockRes();
        let nextCalled = false;
        await verifyRecaptcha(req, res, () => { nextCalled = true; });
        assert(!nextCalled && res.statusCode === 503,
            'Missing RECAPTCHA_SECRET_KEY in production returns HTTP 503 (fail closed)');
    }

    // Test 3: Development allows test_bypass token
    {
        process.env.NODE_ENV = 'development';
        process.env.RECAPTCHA_SECRET_KEY = 'any_secret';
        const req = {
            body: { recaptcha_token: 'test_bypass' },
            headers: {}
        };
        const res = mockRes();
        let nextCalled = false;
        await verifyRecaptcha(req, res, () => { nextCalled = true; });
        assert(nextCalled, 'Development permits test_bypass token for local automated testing');
    }

    // Test 4: Missing token in development returns 400
    {
        process.env.NODE_ENV = 'development';
        process.env.RECAPTCHA_SECRET_KEY = '6Le-valid-format-key-for-testing-key!';
        const req = {
            body: {},
            headers: {}
        };
        const res = mockRes();
        let nextCalled = false;
        await verifyRecaptcha(req, res, () => { nextCalled = true; });
        assert(!nextCalled && res.statusCode === 400,
            'Missing reCAPTCHA token returns HTTP 400 Bad Request');
    }

    // Restore
    process.env.NODE_ENV = 'development';

    console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
