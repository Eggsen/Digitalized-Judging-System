const axios = require('axios');
const { collections } = require('../config/db');

/**
 * Middleware: Verify Google reCAPTCHA v2 token if enabled in system settings
 */
async function verifyRecaptcha(req, res, next) {
    try {
        // Check if reCAPTCHA is enabled in system settings
        if (collections.settings) {
            const settings = await collections.settings.findOne({ _id: 'system_settings' });
            if (settings && settings.security && settings.security.recaptchaEnabled === false) {
                return next(); // Bypassed because admin turned it off in settings
            }
        }

        const recaptchaToken = req.body.recaptcha_token || req.body.recaptcha_response || req.body['g-recaptcha-response'] || req.headers['x-recaptcha-token'];
        let settingsDoc = null;
        if (collections.settings) {
            try { settingsDoc = await collections.settings.findOne({ _id: 'system_settings' }); } catch (_) {}
        }
        const secretKey = (process.env.RECAPTCHA_SECRET_KEY || settingsDoc?.api_keys?.RECAPTCHA_SECRET_KEY || '').trim();
        const isProduction = process.env.NODE_ENV === 'production';

        if (!isProduction && recaptchaToken === 'test_bypass') {
            return next();
        }

        if (!secretKey) {
            if (isProduction) {
                console.error('[RecaptchaMiddleware] FATAL: RECAPTCHA_SECRET_KEY is missing in production.');
                return res.status(503).json({
                    success: false,
                    message: 'Bot verification service is temporarily unavailable. Please contact the administrator.'
                });
            }
            // In non-production, permit local testing without API credentials
            console.warn('[RecaptchaMiddleware] Warning: RECAPTCHA_SECRET_KEY missing in non-production. Bypassing check.');
            return next();
        }

        if (!recaptchaToken) {
            return res.status(400).json({
                success: false,
                message: 'Please complete the reCAPTCHA bot verification challenge.'
            });
        }

        const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(recaptchaToken)}`;
        const response = await axios.post(verificationUrl, null, { timeout: 5000 });
        const data = response.data;

        if (!data || !data.success) {
            return res.status(400).json({
                success: false,
                message: 'reCAPTCHA verification failed. Please try again.'
            });
        }

        next();
    } catch (err) {
        console.error('[RecaptchaMiddleware] Verification error:', err.message);
        if (process.env.NODE_ENV === 'production') {
            return res.status(503).json({
                success: false,
                message: 'Bot verification service temporarily unreachable. Please try again shortly.'
            });
        }
        // In non-production offline development, allow pass-through
        next();
    }
}

module.exports = {
    verifyRecaptcha
};

