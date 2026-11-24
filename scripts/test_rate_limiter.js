/**
 * Comprehensive Test Suite for Tiered Rate Limiting and Burst Click Protection
 * Run with: node scripts/test_rate_limiter.js
 */

const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const {
    hybridKeyGenerator,
    burstActionLimiter,
    authLimiter,
    emailDispatchLimiter,
    scoreSubmissionLimiter,
    heavyOpsLimiter,
    generalApiLimiter
} = require('../middleware/rateLimiter');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'explicit_test_jwt_secret_with_sufficient_entropy_for_unit_tests!';
const { JWT_SECRET } = require('../config/jwt');

async function runTests() {
    console.log('====================================================');
    console.log(' BukSU DJS - Tiered Rate Limiter Test Suite');
    console.log('====================================================\n');

    let passedTests = 0;
    let failedTests = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`[PASS] ${message}`);
            passedTests++;
        } else {
            console.error(`[FAIL] ${message}`);
            failedTests++;
        }
    }

    // -------------------------------------------------------------
    // TEST 1: Hybrid Key Generator
    // -------------------------------------------------------------
    console.log('--- Test 1: Hybrid Key Identification Strategy ---');

    // 1a. User already authenticated on req
    const keyFromReqUser = hybridKeyGenerator({ user: { id: 'judge_42' }, ip: '192.168.1.100' });
    assert(keyFromReqUser === 'user_judge_42', 'Identifies client by req.user.id');

    // 1b. User with Bearer token
    const sampleToken = jwt.sign({ id: 'admin_88', role: 'admin' }, JWT_SECRET);
    const keyFromBearer = hybridKeyGenerator({
        headers: { authorization: `Bearer ${sampleToken}` },
        ip: '192.168.1.100'
    });
    assert(keyFromBearer === 'user_admin_88', 'Identifies client by Bearer JWT token');

    // 1c. User with Cookie token
    const keyFromCookie = hybridKeyGenerator({
        cookies: { djs_token: sampleToken },
        ip: '192.168.1.100'
    });
    assert(keyFromCookie === 'user_admin_88', 'Identifies client by cookie JWT token');

    // 1d. Unauthenticated visitor falls back to IP
    const keyFromIp = hybridKeyGenerator({ ip: '203.177.10.5' });
    assert(keyFromIp === '203.177.10.5', 'Falls back to normalized IP for unauthenticated visitor');

    // 1e. Shared Wi-Fi scenario: two different judges from same IP have distinct keys
    const judge1Token = jwt.sign({ id: 'judge_1' }, JWT_SECRET);
    const judge2Token = jwt.sign({ id: 'judge_2' }, JWT_SECRET);
    const judge1Key = hybridKeyGenerator({ cookies: { djs_token: judge1Token }, ip: '10.0.0.1' });
    const judge2Key = hybridKeyGenerator({ cookies: { djs_token: judge2Token }, ip: '10.0.0.1' });
    assert(judge1Key !== judge2Key, 'Separates different judges on shared campus Wi-Fi (distinct buckets)');

    // -------------------------------------------------------------
    // TEST 2: Burst Action Limiter (1s rolling window)
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Rapid Click / Burst Action Limiter ---');

    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.use(burstActionLimiter);

    app.get('/api/test-read', (req, res) => res.json({ success: true, action: 'read' }));
    app.post('/api/test-action', (req, res) => res.json({ success: true, action: 'mutated' }));

    const server = app.listen(0);
    const port = server.address().port;

    const requestHelper = (method, path) => new Promise((resolve) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: port,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                let parsed = null;
                try { parsed = JSON.parse(body); } catch (_) {}
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.end();
    });

    // Safe GET methods should NOT trigger burst limiter
    const get1 = await requestHelper('GET', '/api/test-read');
    const get2 = await requestHelper('GET', '/api/test-read');
    const get3 = await requestHelper('GET', '/api/test-read');
    assert(get1.status === 200 && get2.status === 200 && get3.status === 200, 'Read-only requests (GET) bypass burst action limiter');

    // Fast POST requests (burst within 1 second):
    const post1 = await requestHelper('POST', '/api/test-action');
    const post2 = await requestHelper('POST', '/api/test-action');
    const post3 = await requestHelper('POST', '/api/test-action');

    assert(post1.status === 200, 'First action within 1s succeeds (HTTP 200)');
    assert(post2.status === 200, 'Second action within 1s succeeds (HTTP 200)');
    assert(post3.status === 429, 'Third action within 1s is throttled (HTTP 429)');
    assert(
        post3.body?.message === 'Too many actions, please try again later.',
        'Returns exact message: "Too many actions, please try again later."'
    );
    assert(post3.body?.code === 'BURST_LIMIT_EXCEEDED', 'Returns code BURST_LIMIT_EXCEEDED');

    server.close();

    // -------------------------------------------------------------
    // TEST 3: Verification of Other Tier Configurations
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Tiered Limiters Configuration & Initialization ---');
    assert(typeof authLimiter === 'function', 'authLimiter is properly instantiated');
    assert(typeof emailDispatchLimiter === 'function', 'emailDispatchLimiter is properly instantiated');
    assert(typeof scoreSubmissionLimiter === 'function', 'scoreSubmissionLimiter is properly instantiated');
    assert(typeof heavyOpsLimiter === 'function', 'heavyOpsLimiter is properly instantiated');
    assert(typeof generalApiLimiter === 'function', 'generalApiLimiter is properly instantiated');

    console.log('\n====================================================');
    console.log(` Tests Completed: ${passedTests} passed, ${failedTests} failed.`);
    console.log('====================================================');

    if (failedTests > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
