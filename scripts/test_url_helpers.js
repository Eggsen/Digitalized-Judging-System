/**
 * Security Test Suite: Trusted URL Resolution & Host-Header Injection Defense
 * Verifies that:
 * 1. Configured APP_URL is strictly enforced over spoofed Host headers
 * 2. Host header spoofing (evil.com) is neutralized in development
 * 3. Legitimate localhost / 127.0.0.1 development links function properly
 * 4. Production fails closed if APP_URL is unconfigured
 */

const { getTrustedBaseUrl, buildPasswordResetUrl, buildInvitationUrl } = require('../utils/urlHelpers');

console.log('====================================================');
console.log(' BukSU DigiTab - Trusted URL Security Test');
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

function mockReq(host, protocol = 'http') {
    return {
        protocol,
        get(header) {
            if (header.toLowerCase() === 'host') return host;
            return null;
        }
    };
}

// Test 1: Configured APP_URL takes absolute precedence over spoofed Host header
{
    process.env.APP_URL = 'https://judgetab.buksu.edu.ph';
    const req = mockReq('evil-attacker-site.com');
    const url = buildPasswordResetUrl('testtoken123', req);
    assert(url.startsWith('https://judgetab.buksu.edu.ph/auth/reset-password?token=testtoken123'),
        'Uses configured APP_URL and ignores attacker-controlled Host header');
    delete process.env.APP_URL;
}

// Test 2: Spoofed Host header in development falls back to safe localhost default
{
    process.env.NODE_ENV = 'development';
    const req = mockReq('attacker.com');
    const url = buildPasswordResetUrl('token456', req);
    assert(!url.includes('attacker.com') && url.includes('localhost'),
        'Rejects spoofed host "attacker.com" and falls back to safe localhost');
}

// Test 3: Legitimate local development host (localhost:5000) is accepted
{
    process.env.NODE_ENV = 'development';
    const req = mockReq('localhost:5000');
    const inviteUrl = buildInvitationUrl('invitetoken789', req);
    assert(inviteUrl.startsWith('http://localhost:5000/auth/accept-invitation?token=invitetoken789'),
        'Permits legitimate localhost:5000 development requests');
}

// Test 4: Legitimate 127.0.0.1 host is accepted
{
    process.env.NODE_ENV = 'development';
    const req = mockReq('127.0.0.1:5000');
    const inviteUrl = buildInvitationUrl('invitetoken789', req);
    assert(inviteUrl.startsWith('http://127.0.0.1:5000/auth/accept-invitation?token=invitetoken789'),
        'Permits legitimate 127.0.0.1:5000 development requests');
}

// Test 5: Production environment throws fatal error if APP_URL is missing (fail-closed)
{
    process.env.NODE_ENV = 'production';
    delete process.env.APP_URL;
    delete process.env.BASE_URL;
    let threw = false;
    try {
        getTrustedBaseUrl(mockReq('localhost:5000'));
    } catch (e) {
        threw = true;
        assert(e.message.includes('APP_URL must be configured in production'),
            'Production fails closed with error when APP_URL is missing');
    }
    assert(threw, 'Host poisoning defense blocked link generation in production without APP_URL');
}

// Restore environment
process.env.NODE_ENV = 'development';

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
