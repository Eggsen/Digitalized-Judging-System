const axios = require('axios');
const nodemailer = require('nodemailer');
const Pusher = require('pusher');
const cloudinary = require('cloudinary').v2;
const { isValidCustomKeyName } = require('./envManager');

function isNetworkOfflineError(err) {
    if (!err) return false;
    const code = err.code || (err.error && err.error.code) || (err.cause && err.cause.code);
    if (code === 'ENOTFOUND' || code === 'EDNS' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'EAI_AGAIN') {
        return true;
    }
    const msg = String(err.message || '');
    if (msg.includes('ENOTFOUND') || msg.includes('EAI_AGAIN') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT')) {
        return true;
    }
    return false;
}

/**
 * Validate Cloudinary Media Storage API Credentials
 */
async function validateCloudinary(cloudName, apiKey, apiSecret, folder = null) {
    const cName = String(cloudName || '').trim();
    const aKey = String(apiKey || '').trim();
    const aSecret = String(apiSecret || '').trim();

    if (!cName && !aKey && !aSecret) {
        return { valid: true, skipped: true, message: 'Cloudinary credentials are not configured.' };
    }

    if (!cName || !aKey || !aSecret) {
        return {
            valid: false,
            service: 'cloudinary',
            message: 'Incomplete Cloudinary configuration. Cloud Name, API Key, and API Secret are all required.'
        };
    }

    if (!/^[a-zA-Z0-9_-]{2,64}$/.test(cName)) {
        return { valid: false, service: 'cloudinary', message: 'Invalid Cloudinary Cloud Name format (alphanumeric, hyphens/underscores).' };
    }

    if (!/^\d{8,25}$/.test(aKey)) {
        return { valid: false, service: 'cloudinary', message: 'Invalid Cloudinary API Key format. Must be numeric digits (typically 12-20 digits).' };
    }

    if (!/^[a-zA-Z0-9_.-]{16,64}$/.test(aSecret)) {
        return { valid: false, service: 'cloudinary', message: 'Invalid Cloudinary API Secret format (16-64 alphanumeric characters).' };
    }

    try {
        const testCloudinary = cloudinary.v2 || cloudinary;
        testCloudinary.config({
            cloud_name: cName,
            api_key: aKey,
            api_secret: aSecret,
            secure: true
        });

        const pingRes = await testCloudinary.api.ping({ timeout: 6000 });
        if (pingRes && (pingRes.status === 'ok' || pingRes.status === 200)) {
            return { valid: true, service: 'cloudinary', message: 'Cloudinary API credentials verified successfully with Cloudinary servers.' };
        }
        return { valid: true, service: 'cloudinary', message: 'Cloudinary credentials verified.' };
    } catch (err) {
        if (err.http_code === 401 || err.http_code === 403 || (err.message && (err.message.toLowerCase().includes('must supply api_key') || err.message.toLowerCase().includes('invalid api_key')))) {
            return { valid: false, service: 'cloudinary', message: `Cloudinary rejected API credentials: ${err.message || 'Invalid API Key or Secret.'}` };
        }
        if (err.http_code === 404) {
            return { valid: false, service: 'cloudinary', message: `Cloudinary cloud name "${cName}" was not found.` };
        }
        if (isNetworkOfflineError(err)) {
            return { valid: true, service: 'cloudinary', warning: true, message: 'Cloudinary credentials syntax verified (offline mode: server cannot reach Cloudinary ping endpoint).' };
        }
        return { valid: false, service: 'cloudinary', message: `Cloudinary validation error: ${err.message}` };
    }
}

/**
 * Validate Google reCAPTCHA v2 API Keys
 */
async function validateRecaptcha(siteKey, secretKey) {
    const sKey = String(siteKey || '').trim();
    const secKey = String(secretKey || '').trim();

    if (!sKey && !secKey) {
        return { valid: true, skipped: true, message: 'reCAPTCHA credentials are not configured.' };
    }

    if (!secKey) {
        return { valid: false, service: 'recaptcha', message: 'reCAPTCHA Secret Key (RECAPTCHA_SECRET_KEY) is required.' };
    }

    if (sKey && !/^[a-zA-Z0-9_-]{30,55}$/.test(sKey)) {
        return { valid: false, service: 'recaptcha', message: 'Invalid reCAPTCHA Site Key format (expected ~40 alphanumeric characters).' };
    }

    if (!/^[a-zA-Z0-9_-]{30,55}$/.test(secKey)) {
        return { valid: false, service: 'recaptcha', message: 'Invalid reCAPTCHA Secret Key format (expected ~40 alphanumeric characters).' };
    }

    try {
        const response = await axios.post(
            'https://www.google.com/recaptcha/api/siteverify',
            new URLSearchParams({
                secret: secKey,
                response: 'buksu_djs_dummy_probe_token'
            }).toString(),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 6000
            }
        );

        const data = response.data || {};
        const errorCodes = data['error-codes'] || [];

        if (errorCodes.includes('invalid-input-secret')) {
            return { valid: false, service: 'recaptcha', message: 'Google reCAPTCHA API rejected Secret Key: Invalid secret key.' };
        }

        // If Google returned invalid-input-response or missing-input-response, the secret key is valid!
        return { valid: true, service: 'recaptcha', message: 'Google reCAPTCHA Secret Key verified successfully with Google API.' };
    } catch (err) {
        if (isNetworkOfflineError(err)) {
            return { valid: true, service: 'recaptcha', warning: true, message: 'reCAPTCHA credentials syntax verified (offline mode: Google API unreachable).' };
        }
        return { valid: false, service: 'recaptcha', message: `reCAPTCHA validation error: ${err.message}` };
    }
}

/**
 * Validate Real-Time WebSockets (Pusher) Credentials
 */
async function validatePusher(appId, key, secret, cluster = 'ap1') {
    const aId = String(appId || '').trim();
    const aKey = String(key || '').trim();
    const aSec = String(secret || '').trim();
    const aClust = String(cluster || 'ap1').trim();

    if (!aId && !aKey && !aSec) {
        return { valid: true, skipped: true, message: 'Pusher WebSockets are not configured.' };
    }

    if (!aId || !aKey || !aSec) {
        return { valid: false, service: 'websocket', message: 'Pusher App ID, Key, and Secret are all required.' };
    }

    if (!/^\d{4,15}$/.test(aId)) {
        return { valid: false, service: 'websocket', message: 'Pusher App ID must be numeric digits.' };
    }

    if (!/^[a-fA-F0-9]{16,32}$/.test(aKey)) {
        return { valid: false, service: 'websocket', message: 'Invalid Pusher Key format. Expected a 20-character hexadecimal key.' };
    }

    if (!/^[a-fA-F0-9]{16,32}$/.test(aSec)) {
        return { valid: false, service: 'websocket', message: 'Invalid Pusher Secret format. Expected a 20-character hexadecimal secret.' };
    }

    try {
        const pusherClient = new Pusher({
            appId: aId,
            key: aKey,
            secret: aSec,
            cluster: aClust,
            useTLS: true
        });

        const res = await pusherClient.get({ path: '/channels', timeout: 6000 });
        if (res && res.status >= 200 && res.status < 300) {
            return { valid: true, service: 'websocket', message: 'Pusher WebSocket credentials verified successfully with Pusher API.' };
        }
        return { valid: true, service: 'websocket', message: 'Pusher WebSocket credentials verified.' };
    } catch (err) {
        if (err.status === 401 || err.status === 403 || (err.message && err.message.toLowerCase().includes('signature'))) {
            return { valid: false, service: 'websocket', message: `Pusher authentication rejected: ${err.message || 'Invalid Key or Secret.'}` };
        }
        if (err.status === 400 || err.status === 404) {
            return { valid: false, service: 'websocket', message: `Pusher App ID "${aId}" or cluster "${aClust}" not found.` };
        }
        if (isNetworkOfflineError(err)) {
            return { valid: true, service: 'websocket', warning: true, message: 'Pusher credentials syntax verified (offline mode: server cannot reach Pusher).' };
        }
        return { valid: false, service: 'websocket', message: `Pusher validation error: ${err.message}` };
    }
}

/**
 * Validate Gmail / SMTP Email Server & Credentials
 */
async function validateSmtp(host, port, secure, username, password) {
    const sHost = String(host || 'smtp.gmail.com').trim();
    const sPort = parseInt(port || '587', 10);
    const sUser = String(username || '').trim();
    const sPass = String(password || '').trim().replace(/^["']|["']$/g, '');
    const isSecure = (String(secure || '').toLowerCase() === 'ssl' || sPort === 465);

    if (!sUser && !sPass) {
        return { valid: true, skipped: true, message: 'SMTP credentials are not configured.' };
    }

    if (!sUser || !sPass) {
        return { valid: false, service: 'email', message: 'SMTP Username (email) and Password/App Password are required.' };
    }

    if (!/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(sUser) && !/^[a-zA-Z0-9_.-]+$/.test(sUser)) {
        return { valid: false, service: 'email', message: 'Invalid SMTP Username format.' };
    }

    if (sPass.length < 4) {
        return { valid: false, service: 'email', message: 'SMTP Password is too short.' };
    }

    try {
        const transporter = nodemailer.createTransport({
            host: sHost,
            port: sPort,
            secure: isSecure,
            auth: {
                user: sUser,
                pass: sPass
            },
            tls: {
                rejectUnauthorized: false
            },
            connectionTimeout: 6000
        });

        await transporter.verify();
        return { valid: true, service: 'email', message: 'SMTP email server connection & credentials verified successfully.' };
    } catch (err) {
        if (err.responseCode === 535 || (err.message && (err.message.includes('535') || err.message.toLowerCase().includes('username and password not accepted')))) {
            return { valid: false, service: 'email', message: 'SMTP authentication failed: Invalid email username or password / App Password.' };
        }
        if (isNetworkOfflineError(err)) {
            return { valid: true, service: 'email', warning: true, message: 'SMTP credentials syntax verified (offline mode: SMTP host unreachable).' };
        }
        return { valid: false, service: 'email', message: `SMTP connection error: ${err.message}` };
    }
}

/**
 * Validate Google OAuth 2.0 Credentials
 */
async function validateGoogleOAuth(clientId, clientSecret, redirectUri) {
    const cId = String(clientId || '').trim();
    const cSec = String(clientSecret || '').trim();
    const rUri = String(redirectUri || '').trim();

    if (!cId && !cSec) {
        return { valid: true, skipped: true, message: 'Google OAuth credentials are not configured.' };
    }

    if (!cId) {
        return { valid: false, service: 'google', message: 'Google Client ID (GOOGLE_CLIENT_ID) is required.' };
    }

    if (!/^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(cId)) {
        return { valid: false, service: 'google', message: 'Invalid Google Client ID format. Must end with ".apps.googleusercontent.com".' };
    }

    if (cSec && !/^(GOCSPX-)?[a-zA-Z0-9_.-]{16,64}$/.test(cSec)) {
        return { valid: false, service: 'google', message: 'Invalid Google Client Secret format.' };
    }

    if (rUri && !/^https?:\/\//i.test(rUri)) {
        return { valid: false, service: 'google', message: 'Google Redirect URI must start with http:// or https://.' };
    }

    if (cSec) {
        try {
            await axios.post(
                'https://oauth2.googleapis.com/token',
                {
                    code: 'buksu_probe_token',
                    client_id: cId,
                    client_secret: cSec,
                    redirect_uri: rUri || 'http://localhost:8000/backend/auth/google_callback.php',
                    grant_type: 'authorization_code'
                },
                { timeout: 6000 }
            );
            return { valid: true, service: 'google', message: 'Google OAuth Client ID & Secret verified successfully.' };
        } catch (err) {
            const resp = err.response ? err.response.data : {};
            if (resp.error === 'invalid_client') {
                return { valid: false, service: 'google', message: `Google OAuth rejected credentials: ${resp.error_description || 'OAuth client not found or invalid client secret.'}` };
            }
            // If response is invalid_grant, Google authenticated the Client ID & Secret and only rejected the probe auth code!
            if (resp.error === 'invalid_grant' || (err.response && err.response.status === 400)) {
                return { valid: true, service: 'google', message: 'Google OAuth Client ID & Secret verified successfully with Google API.' };
            }
            if (isNetworkOfflineError(err)) {
                return { valid: true, service: 'google', warning: true, message: 'Google OAuth credentials syntax verified (offline mode: Google OAuth unreachable).' };
            }
            return { valid: false, service: 'google', message: `Google OAuth verification error: ${err.message}` };
        }
    }

    return { valid: true, service: 'google', message: 'Google Client ID format verified.' };
}

/**
 * Validate a Custom API Key or Token
 */
async function validateCustomApiKey(keyName, keyValue) {
    const rawKey = String(keyName || '').trim().toUpperCase();
    const rawVal = String(keyValue || '').trim();

    if (!isValidCustomKeyName(rawKey)) {
        return { valid: false, service: 'custom', keyName: rawKey, message: `Invalid custom variable name "${rawKey}".` };
    }

    if (!rawVal) {
        return { valid: false, service: 'custom', keyName: rawKey, message: `API Token / Value for "${rawKey}" cannot be empty.` };
    }

    if (rawVal.length < 4) {
        return { valid: false, service: 'custom', keyName: rawKey, message: `API Token / Value for "${rawKey}" must be at least 4 characters.` };
    }

    // Specialized validation for ADMIN_CREATOR_EMAILS / SUPER_ADMIN_EMAILS
    if (rawKey === 'ADMIN_CREATOR_EMAILS' || rawKey === 'SUPER_ADMIN_EMAILS') {
        const emails = rawVal.split(',').map(e => e.trim()).filter(Boolean);
        if (emails.length === 0) {
            return { valid: false, service: 'custom', keyName: rawKey, message: `"${rawKey}" must contain at least one valid authorized administrator email address.` };
        }
        const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
        for (const email of emails) {
            if (!emailRegex.test(email)) {
                return { valid: false, service: 'custom', keyName: rawKey, message: `Invalid email address format "${email}" in ${rawKey}. Expected valid email address (e.g. user@student.buksu.edu.ph).` };
            }
        }
        return { valid: true, service: 'custom', keyName: rawKey, message: `Validated ${emails.length} authorized administrator creator email(s) for ${rawKey}.` };
    }

    // Specialized format checking for common API tokens
    if (rawKey.includes('GEMINI') || rawKey.includes('GOOGLE_AI')) {
        if (!/^AIzaSy[a-zA-Z0-9_-]{33}$/.test(rawVal)) {
            return { valid: false, service: 'custom', keyName: rawKey, message: `Invalid Gemini API key format for "${rawKey}". Expected "AIzaSy" followed by 33 characters.` };
        }
        try {
            const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(rawVal)}`, { timeout: 6000 });
            if (res.status === 200) {
                return { valid: true, service: 'custom', keyName: rawKey, message: `Gemini API Token for "${rawKey}" verified successfully.` };
            }
        } catch (err) {
            if (err.response && (err.response.status === 400 || err.response.status === 403 || err.response.status === 401)) {
                return { valid: false, service: 'custom', keyName: rawKey, message: `Gemini API key rejected: ${err.response.data?.error?.message || 'Invalid key.'}` };
            }
            if (isNetworkOfflineError(err)) {
                return { valid: true, service: 'custom', keyName: rawKey, warning: true, message: `Gemini API Token syntax verified for "${rawKey}" (offline mode).` };
            }
        }
    }

    if (rawKey.includes('OPENAI')) {
        if (!/^sk-[a-zA-Z0-9_-]{20,}$/.test(rawVal)) {
            return { valid: false, service: 'custom', keyName: rawKey, message: `Invalid OpenAI API key format for "${rawKey}". Must start with "sk-".` };
        }
    }

    return { valid: true, service: 'custom', keyName: rawKey, message: `Custom API token "${rawKey}" format verified.` };
}

/**
 * Validate a single integration by service name
 */
async function validateSingleIntegration(service, credentials = {}) {
    const s = String(service || '').trim().toLowerCase();

    switch (s) {
        case 'google':
            return await validateGoogleOAuth(
                credentials.GOOGLE_CLIENT_ID,
                credentials.GOOGLE_CLIENT_SECRET,
                credentials.GOOGLE_REDIRECT_URI
            );
        case 'cloudinary':
            return await validateCloudinary(
                credentials.CLOUDINARY_CLOUD_NAME,
                credentials.CLOUDINARY_API_KEY,
                credentials.CLOUDINARY_API_SECRET,
                credentials.CLOUDINARY_FOLDER
            );
        case 'email':
        case 'smtp':
            return await validateSmtp(
                credentials.SMTP_HOST,
                credentials.SMTP_PORT,
                credentials.SMTP_SECURE,
                credentials.SMTP_USERNAME,
                credentials.SMTP_PASSWORD
            );
        case 'recaptcha':
            return await validateRecaptcha(
                credentials.RECAPTCHA_SITE_KEY,
                credentials.RECAPTCHA_SECRET_KEY
            );
        case 'websocket':
        case 'pusher':
            return await validatePusher(
                credentials.PUSHER_APP_ID,
                credentials.PUSHER_KEY,
                credentials.PUSHER_SECRET,
                credentials.PUSHER_CLUSTER
            );
        case 'custom':
            return await validateCustomApiKey(
                credentials.keyName || credentials.key,
                credentials.keyValue || credentials.value
            );
        default:
            return { valid: false, message: `Unknown service integration "${service}".` };
    }
}

/**
 * Validate all integration API tokens and custom keys intended for .env
 */
async function validateAllIntegrationTokens(apiKeys = {}, customKeys = {}) {
    const errors = [];
    const serviceResults = {};

    // 1. Google OAuth
    if (apiKeys.GOOGLE_CLIENT_ID || apiKeys.GOOGLE_CLIENT_SECRET) {
        const res = await validateGoogleOAuth(
            apiKeys.GOOGLE_CLIENT_ID,
            apiKeys.GOOGLE_CLIENT_SECRET,
            apiKeys.GOOGLE_REDIRECT_URI
        );
        serviceResults.google = res;
        if (!res.valid) {
            errors.push({ service: 'google', message: res.message });
        }
    }

    // 2. Cloudinary
    if (apiKeys.CLOUDINARY_CLOUD_NAME || apiKeys.CLOUDINARY_API_KEY || apiKeys.CLOUDINARY_API_SECRET) {
        const res = await validateCloudinary(
            apiKeys.CLOUDINARY_CLOUD_NAME,
            apiKeys.CLOUDINARY_API_KEY,
            apiKeys.CLOUDINARY_API_SECRET,
            apiKeys.CLOUDINARY_FOLDER
        );
        serviceResults.cloudinary = res;
        if (!res.valid) {
            errors.push({ service: 'cloudinary', message: res.message });
        }
    }

    // 3. Email / SMTP
    if (apiKeys.SMTP_USERNAME || apiKeys.SMTP_PASSWORD) {
        const res = await validateSmtp(
            apiKeys.SMTP_HOST,
            apiKeys.SMTP_PORT,
            apiKeys.SMTP_SECURE,
            apiKeys.SMTP_USERNAME,
            apiKeys.SMTP_PASSWORD
        );
        serviceResults.email = res;
        if (!res.valid) {
            errors.push({ service: 'email', message: res.message });
        }
    }

    // 4. reCAPTCHA
    if (apiKeys.RECAPTCHA_SITE_KEY || apiKeys.RECAPTCHA_SECRET_KEY) {
        const res = await validateRecaptcha(
            apiKeys.RECAPTCHA_SITE_KEY,
            apiKeys.RECAPTCHA_SECRET_KEY
        );
        serviceResults.recaptcha = res;
        if (!res.valid) {
            errors.push({ service: 'recaptcha', message: res.message });
        }
    }

    // 5. Pusher WebSockets
    if (apiKeys.PUSHER_APP_ID || apiKeys.PUSHER_KEY || apiKeys.PUSHER_SECRET) {
        const res = await validatePusher(
            apiKeys.PUSHER_APP_ID,
            apiKeys.PUSHER_KEY,
            apiKeys.PUSHER_SECRET,
            apiKeys.PUSHER_CLUSTER
        );
        serviceResults.websocket = res;
        if (!res.valid) {
            errors.push({ service: 'websocket', message: res.message });
        }
    }

    // 6. Custom Keys
    const customResults = {};
    if (customKeys && typeof customKeys === 'object') {
        for (const [k, v] of Object.entries(customKeys)) {
            // Empty custom keys represent unset placeholders and are skipped in batch validation
            if (!v || !String(v).trim()) {
                continue;
            }
            const res = await validateCustomApiKey(k, v);
            customResults[k] = res;
            if (!res.valid) {
                errors.push({ service: 'custom', keyName: k, message: res.message });
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        message: errors.length === 0
            ? 'All API tokens validated successfully.'
            : `Cannot save .env: One or more API tokens failed validation. ${errors.map(e => e.message).join(' | ')}`,
        services: serviceResults,
        customKeys: customResults
    };
}

module.exports = {
    validateCloudinary,
    validateRecaptcha,
    validatePusher,
    validateSmtp,
    validateGoogleOAuth,
    validateCustomApiKey,
    validateSingleIntegration,
    validateAllIntegrationTokens
};
