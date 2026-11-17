/**
 * Test Script for API Token Validation on .env Editing
 * Run with: node scripts/test_env_token_validation.js
 */

const { validateSingleIntegration, validateAllIntegrationTokens } = require('../utils/tokenValidator');
const { getSystemApiKeys, getCustomApiKeys } = require('../utils/envManager');

async function runTests() {
    console.log('====================================================');
    console.log(' BukSU DJS - .env API Token Validation Test Suite');
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

    // TEST 1: Cloudinary with invalid non-numeric API key
    console.log('--- Test 1: Cloudinary Validation ---');
    const invalidCloudinary = await validateSingleIntegration('cloudinary', {
        CLOUDINARY_CLOUD_NAME: 'test_cloud',
        CLOUDINARY_API_KEY: 'invalid_text_key',
        CLOUDINARY_API_SECRET: 'secret_1234567890'
    });
    assert(invalidCloudinary.valid === false, 'Rejects invalid non-numeric Cloudinary API Key');
    console.log(`       Message: "${invalidCloudinary.message}"`);

    // TEST 2: Google reCAPTCHA with invalid secret key
    console.log('\n--- Test 2: reCAPTCHA Validation ---');
    const invalidRecaptcha = await validateSingleIntegration('recaptcha', {
        RECAPTCHA_SITE_KEY: '6Ld6WQ8uAAAAAJCMsoqiP9mQUlL3m7ekeFPzXBzR',
        RECAPTCHA_SECRET_KEY: 'short'
    });
    assert(invalidRecaptcha.valid === false, 'Rejects malformed reCAPTCHA Secret Key');
    console.log(`       Message: "${invalidRecaptcha.message}"`);

    // TEST 3: Pusher WebSockets with invalid non-hex key
    console.log('\n--- Test 3: Pusher WebSockets Validation ---');
    const invalidPusher = await validateSingleIntegration('websocket', {
        PUSHER_APP_ID: '2209896',
        PUSHER_KEY: 'not_hexadecimal_key!!',
        PUSHER_SECRET: 'not_hexadecimal_secret!!',
        PUSHER_CLUSTER: 'ap1'
    });
    assert(invalidPusher.valid === false, 'Rejects malformed Pusher Key/Secret');
    console.log(`       Message: "${invalidPusher.message}"`);

    // TEST 4: Google OAuth with invalid Client ID
    console.log('\n--- Test 4: Google OAuth Validation ---');
    const invalidGoogle = await validateSingleIntegration('google', {
        GOOGLE_CLIENT_ID: 'invalid-client-id-without-domain',
        GOOGLE_CLIENT_SECRET: 'GOCSPX-sample'
    });
    assert(invalidGoogle.valid === false, 'Rejects Google Client ID without .apps.googleusercontent.com');
    console.log(`       Message: "${invalidGoogle.message}"`);

    // TEST 5: Custom AI Token (Gemini API Key format)
    console.log('\n--- Test 5: Custom API Token (GEMINI_API_KEY) ---');
    const invalidGemini = await validateSingleIntegration('custom', {
        keyName: 'GEMINI_API_KEY',
        keyValue: 'invalid_gemini_key_123'
    });
    assert(invalidGemini.valid === false, 'Rejects invalid Gemini API token format');
    console.log(`       Message: "${invalidGemini.message}"`);

    // TEST 6: Pre-save validation block when invalid keys are in payload
    console.log('\n--- Test 6: Pre-Save Blocking (.env protection) ---');
    const savePayloadWithInvalidToken = {
        CLOUDINARY_CLOUD_NAME: 'sqm9yu7u',
        CLOUDINARY_API_KEY: 'not_numeric', // INVALID
        CLOUDINARY_API_SECRET: '84_7xsADuavUE10tOwD--v_B5aw'
    };
    const saveResult = await validateAllIntegrationTokens(savePayloadWithInvalidToken, {});
    assert(saveResult.valid === false, 'Blocks saving when any API token in .env payload is invalid');
    assert(saveResult.errors.length > 0, 'Returns specific error details identifying invalid service');
    console.log(`       Rejection Reason: "${saveResult.message}"`);

    // TEST 7: Current valid keys in .env
    console.log('\n--- Test 7: Valid Current .env Credentials ---');
    const sysKeys = getSystemApiKeys();
    const customKeys = getCustomApiKeys();
    const currentKeysResult = await validateAllIntegrationTokens(sysKeys, customKeys);
    assert(currentKeysResult.valid === true, 'Accepts valid current working environment credentials');
    console.log(`       Result: "${currentKeysResult.message}"`);

    console.log('\n====================================================');
    console.log(` Tests Completed: ${passedTests} passed, ${failedTests} failed.`);
    console.log('====================================================');
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
