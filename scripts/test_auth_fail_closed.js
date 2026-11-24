/**
 * Security Test Suite: Authentication Middleware Fail-Closed Verification
 * Validates that authenticateToken fails securely under all failure conditions.
 */

const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');
const { JWT_SECRET } = require('../config/jwt');
const { collections } = require('../config/db');

console.log('====================================================');
console.log(' BukSU DigiTab - Auth Fail-Closed Security Test');
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
    const res = {
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
    return res;
}

async function runTests() {
    // Save original collections.users
    const origUsers = collections.users;

    // Test 1: Missing token -> 401
    {
        const req = { headers: {} };
        const res = mockRes();
        let nextCalled = false;
        await authenticateToken(req, res, () => { nextCalled = true; });
        assert(res.statusCode === 401 && !nextCalled, 'Missing token returns HTTP 401 without next()');
    }

    // Test 2: Invalid / forged token -> 401
    {
        const forgedToken = jwt.sign({ id: 'bad_user' }, 'wrong-secret-key-32-chars-long!');
        const req = { headers: { authorization: `Bearer ${forgedToken}` } };
        const res = mockRes();
        let nextCalled = false;
        await authenticateToken(req, res, () => { nextCalled = true; });
        assert(res.statusCode === 401 && !nextCalled, 'Invalid JWT signature returns HTTP 401 without next()');
    }

    // Test 3: User missing from database (deleted user) -> 401
    {
        const validToken = jwt.sign({ id: '507f1f77bcf86cd799439011', role: 'judge', token_version: 1 }, JWT_SECRET);
        collections.users = {
            findOne: async () => null // User not found
        };
        const req = { headers: { authorization: `Bearer ${validToken}` } };
        const res = mockRes();
        let nextCalled = false;
        await authenticateToken(req, res, () => { nextCalled = true; });
        assert(res.statusCode === 401 && res.body?.code === 'USER_NOT_FOUND' && !nextCalled,
            'Missing/deleted user returns HTTP 401 USER_NOT_FOUND (fail-closed)');
    }

    // Test 4: Deactivated account -> 403
    {
        const validToken = jwt.sign({ id: '507f1f77bcf86cd799439012', role: 'judge', token_version: 1 }, JWT_SECRET);
        collections.users = {
            findOne: async () => ({
                _id: '507f1f77bcf86cd799439012',
                is_active: false,
                status: 'disabled',
                token_version: 1
            })
        };
        const req = { headers: { authorization: `Bearer ${validToken}` } };
        const res = mockRes();
        let nextCalled = false;
        await authenticateToken(req, res, () => { nextCalled = true; });
        assert(res.statusCode === 403 && res.body?.code === 'ACCOUNT_DISABLED' && !nextCalled,
            'Deactivated account returns HTTP 403 ACCOUNT_DISABLED');
    }

    // Test 5: Superseded token version -> 401
    {
        const oldToken = jwt.sign({ id: '507f1f77bcf86cd799439013', role: 'judge', token_version: 1 }, JWT_SECRET);
        collections.users = {
            findOne: async () => ({
                _id: '507f1f77bcf86cd799439013',
                is_active: true,
                status: 'active',
                token_version: 2 // DB is on version 2, token is on version 1
            })
        };
        const req = { headers: { authorization: `Bearer ${oldToken}` } };
        const res = mockRes();
        let nextCalled = false;
        await authenticateToken(req, res, () => { nextCalled = true; });
        assert(res.statusCode === 401 && res.body?.code === 'SESSION_SUPERSEDED' && !nextCalled,
            'Superseded session token returns HTTP 401 SESSION_SUPERSEDED');
    }

    // Test 6: Database connection error / query failure -> 503 fail-closed (NEVER allow through)
    {
        const validToken = jwt.sign({ id: '507f1f77bcf86cd799439014', role: 'judge', token_version: 1 }, JWT_SECRET);
        collections.users = {
            findOne: async () => {
                throw new Error('MongoNetworkTimeoutException');
            }
        };
        const req = { headers: { authorization: `Bearer ${validToken}` } };
        const res = mockRes();
        let nextCalled = false;
        await authenticateToken(req, res, () => { nextCalled = true; });
        assert(res.statusCode === 503 && res.body?.code === 'AUTH_SERVICE_UNAVAILABLE' && !nextCalled,
            'Database error fails closed with HTTP 503 AUTH_SERVICE_UNAVAILABLE and does NOT call next()');
    }

    // Test 7: Valid active user -> next() called with populated req.user
    {
        const validToken = jwt.sign({ id: '507f1f77bcf86cd799439015', role: 'judge', token_version: 1 }, JWT_SECRET);
        collections.users = {
            findOne: async () => ({
                _id: '507f1f77bcf86cd799439015',
                role: 'judge',
                is_active: true,
                status: 'active',
                token_version: 1,
                email: 'judge1@buksu.edu.ph'
            })
        };
        const req = { headers: { authorization: `Bearer ${validToken}` } };
        const res = mockRes();
        let nextCalled = false;
        await authenticateToken(req, res, () => { nextCalled = true; });
        assert(nextCalled && req.user?.id === '507f1f77bcf86cd799439015',
            'Valid user attaches req.user and invokes next()');
    }

    // Restore original collections.users
    collections.users = origUsers;

    console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
