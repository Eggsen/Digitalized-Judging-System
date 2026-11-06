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
        const secretKey = (process.env.RECAPTCHA_SECRET_KEY || (collections.settings ? (await collections.settings.findOne({ _id: 'system_settings' }))?.api_keys?.RECAPTCHA_SECRET_KEY : '') || '').trim();

        if (process.env.NODE_ENV !== 'production' && recaptchaToken === 'test_bypass') {
            return next();
        }

        if (!secretKey) {
            // Secret key not configured, bypass gracefully
            return next();
        }

        if (!recaptchaToken) {
            return res.status(400).json({
                success: false,
                message: 'Please complete the reCAPTCHA bot verification challenge.'
            });
        }

        const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(recaptchaToken)}`;
        const response = await axios.post(verificationUrl);
        const data = response.data;

        if (!data.success) {
            return res.status(400).json({
                success: false,
                message: 'reCAPTCHA verification failed. Please try again.'
            });
        }

        next();
    } catch (err) {
        console.error('[RecaptchaMiddleware] Verification error:', err.message);
        // Fail open if Google reCAPTCHA service is unreachable to prevent locking users out
        next();
    }
}

module.exports = {
    verifyRecaptcha
};

