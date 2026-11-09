const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const { collections } = require('../config/db');
const { logSystemAction } = require('../utils/logger');
const { sendSystemEmail } = require('../utils/mailer');
const { getIdFilter } = require('../utils/dbHelpers');

const JWT_SECRET = process.env.JWT_SECRET || 'buksu-djs-super-secret-jwt-key-2026';
const JWT_EXPIRES_IN = '7d';

function generateToken(user) {
    return jwt.sign(
        {
            id: String(user._id),
            username: user.username,
            role: user.role,
            full_name: user.full_name || user.name || user.username
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Standard Email and Password Login (Email Only)
 */
async function login(req, res, next) {
    try {
        const email = (req.body.email || req.body.identifier || '').trim();
        const password = req.body.password;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please enter your email and password.' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
        }

        // Case-insensitive lookup strictly matching email (username logins no longer accepted)
        const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const user = await collections.users.findOne({
            email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') }
        });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials. No account found with this email address.' });
        }

        if (user.is_active === false || user.status === 'disabled') {
            return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact an administrator.' });
        }

        if (user.status === 'pending') {
            return res.status(403).json({ success: false, message: 'Your invitation has not yet been accepted. Please check your email to activate your account.' });
        }

        // Lockout check for admin accounts
        if (user.role === 'admin' && user.pin_locked_until && new Date() < new Date(user.pin_locked_until)) {
            const remainingMinutes = Math.ceil((new Date(user.pin_locked_until) - new Date()) / 60000);
            return res.status(429).json({
                success: false,
                is_locked: true,
                message: `Too many failed attempts. This admin account is locked for ${remainingMinutes} more minute(s).`
            });
        }

        // Support bcrypt comparison with $2y$ (PHP legacy) and $2a$/$2b$
        let isMatch = false;
        if (user.password) {
            try {
                isMatch = await bcrypt.compare(password, user.password);
            } catch (e) {}

            if (!isMatch && user.password.startsWith('$2y$')) {
                try {
                    isMatch = await bcrypt.compare(password, user.password.replace(/^\$2y\$/, '$2a$'));
                } catch (e) {}
            }
        }

        if (!isMatch) {
            if (user.role === 'admin') {
                const failed = (user.pin_failed_attempts || 0) + 1;
                const update = { pin_failed_attempts: failed };
                if (failed >= 5) {
                    update.pin_locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
                    update.pin_failed_attempts = 0;
                }
                await collections.users.updateOne({ _id: user._id }, { $set: update });

                if (failed >= 5) {
                    return res.status(429).json({
                        success: false,
                        is_locked: true,
                        message: 'Too many failed login attempts. This admin account has been locked for 15 minutes.'
                    });
                }
                const remaining = 5 - failed;
                return res.status(401).json({
                    success: false,
                    message: `Invalid credentials. Incorrect password. ${remaining} attempt(s) remaining.`
                });
            }

            return res.status(401).json({ success: false, message: 'Invalid credentials. Incorrect password.' });
        }

        // Admin PIN verification for admin role
        if (user.role === 'admin') {
            const adminPin = (req.body.admin_pin || '').trim();

            if (!adminPin) {
                const challengeToken = jwt.sign(
                    {
                        userId: String(user._id),
                        username: user.username,
                        email: user.email,
                        role: 'admin',
                        purpose: 'admin_login_challenge'
                    },
                    JWT_SECRET,
                    { expiresIn: '5m' }
                );

                return res.json({
                    success: false,
                    require_admin_pin: true,
                    challenge_token: challengeToken,
                    message: 'Administrator verification required: Please enter your exclusive Admin PIN.'
                });
            }

            let isPinMatch = false;
            if (user.admin_pin) {
                isPinMatch = await bcrypt.compare(adminPin, user.admin_pin);
            } else {
                const envPin = (process.env.ADMIN_PIN || '').trim();
                if (envPin && adminPin === envPin) {
                    isPinMatch = true;
                    const hashedPin = await bcrypt.hash(adminPin, 10);
                    await collections.users.updateOne(
                        { _id: user._id },
                        { $set: { admin_pin: hashedPin } }
                    );
                }
            }

            if (!isPinMatch) {
                const failed = (user.pin_failed_attempts || 0) + 1;
                const update = { pin_failed_attempts: failed };
                if (failed >= 5) {
                    update.pin_locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
                    update.pin_failed_attempts = 0;
                }
                await collections.users.updateOne({ _id: user._id }, { $set: update });

                if (failed >= 5) {
                    return res.status(429).json({
                        success: false,
                        is_locked: true,
                        message: 'Too many failed attempts. This admin account has been locked for 15 minutes.'
                    });
                }

                const remaining = 5 - failed;
                return res.status(401).json({
                    success: false,
                    require_admin_pin: true,
                    message: `Incorrect Admin PIN. ${remaining} attempt(s) remaining.`
                });
            }
        }

        // Reset failed attempts & upgrade legacy hash if needed
        const updateFields = {
            last_login: new Date().toISOString(),
            pin_failed_attempts: 0,
            pin_locked_until: null
        };
        if (user.password && user.password.startsWith('$2y$')) {
            updateFields.password = await bcrypt.hash(password, 10);
        }

        await collections.users.updateOne(
            { _id: user._id },
            { $set: updateFields }
        );

        const token = generateToken(user);
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        };

        res.cookie('djs_token', token, cookieOptions);
        res.cookie('jwt_token', token, cookieOptions);

        await logSystemAction(user._id, user.username, user.role, 'LOGIN_LOCAL', 'User signed in successfully.', req);

        res.json({
            success: true,
            message: 'Authentication successful.',
            token,
            redirect: '/dashboard',
            user: {
                id: String(user._id),
                username: user.username,
                email: user.email,
                role: user.role,
                full_name: user.full_name || user.name || user.username
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Verify Admin PIN during 2FA Login Challenge (POST /api/auth/verify-login-pin)
 */
async function verifyLoginPin(req, res, next) {
    try {
        const { challenge_token, pin, admin_pin } = req.body;
        const submittedPin = String(pin || admin_pin || '').trim();

        if (!challenge_token) {
            return res.status(400).json({ success: false, message: 'Authentication challenge expired. Please sign in again.' });
        }

        if (!submittedPin) {
            return res.status(400).json({ success: false, message: 'Please enter your Admin PIN.' });
        }

        let decoded;
        try {
            decoded = jwt.verify(challenge_token, JWT_SECRET);
        } catch (e) {
            return res.status(401).json({ success: false, message: 'Your login verification session has expired. Please sign in again.' });
        }

        if (decoded.purpose !== 'admin_login_challenge' || !decoded.userId) {
            return res.status(401).json({ success: false, message: 'Invalid challenge session.' });
        }

        const user = await collections.users.findOne(getIdFilter(decoded.userId));
        if (!user || user.role !== 'admin') {
            return res.status(404).json({ success: false, message: 'Admin account not found.' });
        }

        if (user.is_active === false || user.status === 'disabled') {
            return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact an administrator.' });
        }

        // Check lockout
        if (user.pin_locked_until && new Date() < new Date(user.pin_locked_until)) {
            const remainingMinutes = Math.ceil((new Date(user.pin_locked_until) - new Date()) / 60000);
            return res.status(429).json({
                success: false,
                is_locked: true,
                message: `Too many failed attempts. This admin account is locked for ${remainingMinutes} more minute(s).`
            });
        }

        let isPinMatch = false;
        if (user.admin_pin) {
            isPinMatch = await bcrypt.compare(submittedPin, user.admin_pin);
        } else {
            const envPin = (process.env.ADMIN_PIN || '').trim();
            if (envPin && submittedPin === envPin) {
                isPinMatch = true;
                const hashedPin = await bcrypt.hash(submittedPin, 10);
                await collections.users.updateOne(
                    { _id: user._id },
                    { $set: { admin_pin: hashedPin } }
                );
            }
        }

        if (!isPinMatch) {
            const failed = (user.pin_failed_attempts || 0) + 1;
            const update = { pin_failed_attempts: failed };
            if (failed >= 5) {
                update.pin_locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
                update.pin_failed_attempts = 0;
            }
            await collections.users.updateOne({ _id: user._id }, { $set: update });

            if (failed >= 5) {
                return res.status(429).json({
                    success: false,
                    is_locked: true,
                    message: 'Too many failed attempts. This admin account has been locked for 15 minutes.'
                });
            }

            const remaining = 5 - failed;
            return res.status(401).json({
                success: false,
                require_admin_pin: true,
                message: `Incorrect Admin PIN. ${remaining} attempt(s) remaining.`
            });
        }

        // Reset failed attempts
        await collections.users.updateOne(
            { _id: user._id },
            {
                $set: {
                    last_login: new Date().toISOString(),
                    pin_failed_attempts: 0,
                    pin_locked_until: null
                }
            }
        );

        const token = generateToken(user);
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        };

        res.cookie('djs_token', token, cookieOptions);
        res.cookie('jwt_token', token, cookieOptions);

        await logSystemAction(user._id, user.username, user.role, 'LOGIN_LOCAL', 'Admin completed 2FA PIN verification and signed in.', req);

        res.json({
            success: true,
            message: 'Admin authentication successful.',
            token,
            redirect: '/dashboard',
            user: {
                id: String(user._id),
                username: user.username,
                email: user.email,
                role: user.role,
                full_name: user.full_name || user.name || user.username
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Get Current Authenticated User (Session Check)
 */
async function getMe(req, res) {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }

    try {
        const query = getIdFilter(req.user.id);
        const user = await collections.users.findOne(query, {
            projection: { password: 0, reset_token: 0, reset_token_expires_at: 0 }
        });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Account no longer exists.' });
        }

        if (user.is_active === false || user.status === 'disabled') {
            return res.status(403).json({ success: false, message: 'Your account is disabled.' });
        }

        res.json({
            success: true,
            user: {
                id: String(user._id),
                username: user.username,
                email: user.email,
                role: user.role,
                full_name: user.full_name || user.name || user.username,
                avatar_url: user.avatar_url || user.avatar || null,
                preferences: user.preferences || {}
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

/**
 * Sign Out / Logout
 */
async function logout(req, res) {
    res.clearCookie('djs_token');
    res.clearCookie('jwt_token');

    if (req.user) {
        await logSystemAction(req.user.id, req.user.username, req.user.role, 'LOGOUT', 'User signed out.', req);
    }

    res.json({ success: true, message: 'Successfully signed out.' });
}

/**
 * Initiate Google OAuth Redirect
 */
async function googleRedirect(req, res, next) {
    try {
        const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
        if (!clientId) {
            return res.status(500).send('Google OAuth Client ID is not configured on this server.');
        }

        const protocol = req.protocol;
        const host = req.get('host');
        const redirectUri = `${protocol}://${host}/backend/auth/google_callback.php`;

        const state = crypto.randomBytes(16).toString('hex');
        res.cookie('oauth_state', state, { httpOnly: true, maxAge: 10 * 60 * 1000 });

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${encodeURIComponent(clientId)}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `response_type=code&` +
            `scope=email%20profile%20openid&` +
            `state=${encodeURIComponent(state)}&` +
            `prompt=select_account`;

        res.redirect(authUrl);
    } catch (err) {
        next(err);
    }
}

/**
 * Google OAuth Callback
 */
async function googleCallback(req, res) {
    try {
        const { code, error } = req.query;

        if (error) {
            return res.redirect('/auth/login?error=oauth_denied');
        }

        if (!code) {
            return res.redirect('/auth/login?error=no_code');
        }

        const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
        const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
        const protocol = req.protocol;
        const host = req.get('host');
        const redirectUri = `${protocol}://${host}/backend/auth/google_callback.php`;

        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
        });

        const { access_token, id_token } = tokenResponse.data;

        // Fetch Google Profile
        const userinfoResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` }
        });

        const profile = userinfoResponse.data;
        const googleEmail = (profile.email || '').toLowerCase().trim();

        if (!googleEmail || !profile.email_verified) {
            return res.redirect('/auth/login?error=unverified_email');
        }

        // Look for existing user by email (case-insensitive)
        let user = await collections.users.findOne({
            email: { $regex: new RegExp(`^${googleEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });

        if (!user) {
            return res.redirect(`/auth/login?error=no_account&email=${encodeURIComponent(googleEmail)}`);
        }

        if (user.is_active === false || user.status === 'disabled') {
            return res.redirect('/auth/login?error=account_disabled');
        }

        // Update user record with google_id, last_login, avatar
        const updateFields = {
            google_id: profile.sub,
            last_login: new Date().toISOString(),
            status: 'active'
        };
        if (profile.picture && !user.avatar_url && !user.avatar) {
            updateFields.avatar_url = profile.picture;
        }
        await collections.users.updateOne(
            { _id: user._id },
            { $set: updateFields }
        );

        // If user is administrator, require Admin PIN verification challenge
        if (user.role === 'admin') {
            if (user.pin_locked_until && new Date() < new Date(user.pin_locked_until)) {
                return res.redirect('/auth/login?error=account_locked');
            }

            const challengeToken = jwt.sign(
                {
                    userId: String(user._id),
                    username: user.username,
                    email: user.email,
                    role: 'admin',
                    purpose: 'admin_login_challenge'
                },
                JWT_SECRET,
                { expiresIn: '5m' }
            );

            return res.redirect(`/auth/login?admin_pin_challenge=${encodeURIComponent(challengeToken)}&email=${encodeURIComponent(user.email)}`);
        }

        const token = generateToken(user);
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        };

        res.cookie('djs_token', token, cookieOptions);
        res.cookie('jwt_token', token, cookieOptions);

        await logSystemAction(user._id, user.username, user.role, 'LOGIN_GOOGLE', 'User logged in via Google OAuth SSO.', req);

        res.redirect('/dashboard');
    } catch (err) {
        console.error('[GoogleOAuth] Callback error:', err.response?.data || err.message);
        const detailMsg = err.response?.data?.error_description || err.message;
        res.redirect('/auth/login?error=token_exchange_failed&details=' + encodeURIComponent(detailMsg));
    }
}

/**
 * Request Password Reset Link
 */
async function requestPasswordReset(req, res, next) {
    try {
        const email = (req.body.email || req.body.identifier || '').trim();
        if (!email) {
            return res.status(400).json({ success: false, message: 'Please enter your registered email address.' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
        }

        // Check if email service is disabled
        const settings = await collections.settings.findOne({ _id: 'system_settings' });
        if (settings?.security?.emailServiceEnabled === false) {
            return res.status(403).json({
                success: false,
                message: 'Password reset emails cannot be sent because the email notification service has been disabled by the administrator.'
            });
        }

        // reCAPTCHA verification
        const recaptchaToken = req.body.recaptcha_response || req.body['g-recaptcha-response'] || req.body.recaptcha_token;
        const recaptchaEnabled = settings?.security?.recaptchaEnabled !== false;
        const secretKey = (process.env.RECAPTCHA_SECRET_KEY || settings?.api_keys?.RECAPTCHA_SECRET_KEY || '').trim();

        if (recaptchaEnabled && secretKey && !(process.env.NODE_ENV !== 'production' && recaptchaToken === 'test_bypass')) {
            if (!recaptchaToken) {
                return res.status(400).json({
                    success: false,
                    message: 'Please complete the reCAPTCHA verification to proceed.'
                });
            }

            try {
                const verifyRes = await axios.post(
                    `https://www.google.com/recaptcha/api/siteverify?secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(recaptchaToken)}`,
                    null,
                    { timeout: 5000 }
                );
                if (verifyRes.data && !verifyRes.data.success) {
                    return res.status(400).json({
                        success: false,
                        message: 'reCAPTCHA verification failed. Please try again.'
                    });
                }
            } catch (recaptchaErr) {
                console.warn('[Recaptcha] Verification service warning:', recaptchaErr.message);
            }
        }

        // Case-insensitive user lookup strictly by email
        const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const user = await collections.users.findOne({
            email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') }
        });

        // Exact match check: do NOT pretend to succeed if account doesn't exist
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No registered account found with this email address.'
            });
        }

        if (!user.email) {
            return res.status(400).json({
                success: false,
                message: 'This account does not have a registered email address. Please contact an administrator.'
            });
        }

        if (user.is_active === false || user.status === 'disabled') {
            return res.status(403).json({
                success: false,
                message: 'This account is currently disabled. Please contact your administrator.'
            });
        }

        const resetToken = crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

        await collections.users.updateOne(
            { _id: user._id },
            {
                $set: {
                    reset_token: resetToken,
                    reset_token_expires_at: expiresAt,
                    reset_requested_at: new Date().toISOString()
                }
            }
        );

        const protocol = req.protocol;
        const host = req.get('host');
        const resetLink = `${protocol}://${host}/auth/reset-password?token=${resetToken}`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 550px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
                <h2 style="color: #0F2C59; margin-bottom: 8px;">Reset Your Password</h2>
                <p style="color: #475569; font-size: 14px;">Hello <strong>${user.username}</strong>,</p>
                <p style="color: #475569; font-size: 14px;">We received a request to reset your password for BukSU JudgeTab. Click below to choose a new password:</p>
                <div style="text-align: center; margin: 28px 0;">
                    <a href="${resetLink}" style="padding: 12px 28px; background-color: #0F2C59; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px;">Reset Password</a>
                </div>
                <p style="font-size: 12px; color: #94a3b8;">This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
            </div>
        `;

        await sendSystemEmail(user.email, 'Password Reset Request - BukSU JudgeTab', html, true);

        await logSystemAction(user._id, user.username, user.role, 'REQUEST_PASSWORD_RESET', `Password reset requested for "${user.username}".`, req);

        res.json({
            success: true,
            message: 'Password reset link sent to your email.'
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Verify Password Reset Token (GET /api/auth/reset-password?token=...)
 */
async function verifyResetToken(req, res, next) {
    try {
        const token = (req.query.token || req.query.reset_token || '').trim();
        if (!token) {
            return res.status(400).json({ success: false, message: 'Reset token is required.' });
        }

        const user = await collections.users.findOne({ reset_token: token });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired password reset link.' });
        }

        if (user.reset_token_expires_at && new Date() > new Date(user.reset_token_expires_at)) {
            return res.status(400).json({ success: false, message: 'This password reset link has expired. Please request a new one.' });
        }

        res.json({
            success: true,
            username: user.username,
            email: user.email || '',
            role: user.role || 'user'
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Execute Password Reset or Route Request Reset
 */
async function resetPassword(req, res, next) {
    try {
        // If client called with action: 'request_reset' or identifier without token, delegate to requestPasswordReset
        if (req.body.action === 'request_reset' || (!req.body.token && !req.body.reset_token && (req.body.identifier || req.body.email))) {
            return requestPasswordReset(req, res, next);
        }

        const token = (req.body.token || req.body.reset_token || '').trim();
        const newPassword = (req.body.new_password || req.body.password || '').trim();
        const confirmPassword = (req.body.confirm_password || '').trim();

        if (!token) {
            return res.status(400).json({ success: false, message: 'Reset token is missing.' });
        }

        if (!newPassword) {
            return res.status(400).json({ success: false, message: 'Please enter a new password.' });
        }

        if (confirmPassword && newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match.' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
        }

        if (!/[A-Z]/.test(newPassword)) {
            return res.status(400).json({ success: false, message: 'Password must contain at least one capital letter (A-Z).' });
        }

        if (!/[0-9]/.test(newPassword)) {
            return res.status(400).json({ success: false, message: 'Password must contain at least one number (0-9).' });
        }

        const user = await collections.users.findOne({ reset_token: token });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired password reset link.' });
        }

        if (user.reset_token_expires_at && new Date() > new Date(user.reset_token_expires_at)) {
            return res.status(400).json({ success: false, message: 'This password reset link has expired.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await collections.users.updateOne(
            { _id: user._id },
            {
                $set: {
                    password: hashedPassword,
                    status: 'active',
                    is_active: true,
                    updated_at: new Date().toISOString()
                },
                $unset: {
                    reset_token: '',
                    reset_token_expires_at: '',
                    reset_requested_at: ''
                }
            }
        );

        await logSystemAction(user._id, user.username, user.role, 'PASSWORD_RESET', 'User completed password reset successfully.', req);

        res.json({
            success: true,
            message: 'Password reset successfully! You can now log in with your new password.',
            username: user.username
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Verify Invitation Token (GET /api/auth/accept-invitation?token=...)
 */
async function verifyInvitationToken(req, res, next) {
    try {
        const token = (req.query.token || req.query.invite_token || '').trim();
        if (!token) {
            return res.status(400).json({ success: false, message: 'Invitation token is required.' });
        }

        const user = await collections.users.findOne({
            $or: [
                { invite_token: token },
                { invitation_token: token }
            ]
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or already used invitation token.' });
        }

        if (user.invite_token_expires_at && new Date() > new Date(user.invite_token_expires_at)) {
            return res.status(400).json({ success: false, message: 'This invitation link has expired. Please contact an administrator to resend an invitation.' });
        }

        if (user.status === 'disabled' || user.is_active === false) {
            return res.status(403).json({ success: false, message: 'This account has been disabled by the administrator.' });
        }

        res.json({
            success: true,
            username: user.username,
            email: user.email || '',
            role: user.role || 'judge',
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            full_name: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Accept Invitation (POST /api/auth/accept-invitation)
 */
async function acceptInvitation(req, res, next) {
    try {
        const token = (req.body.token || req.body.invite_token || '').trim();
        const password = req.body.password;
        const confirmPassword = req.body.confirm_password;
        const firstName = (req.body.first_name || '').trim();
        const lastName = (req.body.last_name || '').trim();

        if (!token) {
            return res.status(400).json({ success: false, message: 'Invitation token is required.' });
        }

        if (!password) {
            return res.status(400).json({ success: false, message: 'Please enter a password.' });
        }

        if (confirmPassword && password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match.' });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
        }

        if (!/[A-Z]/.test(password)) {
            return res.status(400).json({ success: false, message: 'Password must contain at least one capital letter (A-Z).' });
        }

        if (!/[0-9]/.test(password)) {
            return res.status(400).json({ success: false, message: 'Password must contain at least one number (0-9).' });
        }

        const user = await collections.users.findOne({
            $or: [
                { invite_token: token },
                { invitation_token: token }
            ]
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or already used invitation token.' });
        }

        if (user.invite_token_expires_at && new Date() > new Date(user.invite_token_expires_at)) {
            return res.status(400).json({ success: false, message: 'This invitation link has expired. Please contact an administrator to resend an invitation.' });
        }

        if (user.status === 'disabled' || user.is_active === false) {
            return res.status(403).json({ success: false, message: 'This account has been disabled by the administrator.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const fullName = (req.body.full_name || `${firstName} ${lastName}`.trim() || user.full_name || user.username).trim();

        const updateDoc = {
            password: hashedPassword,
            status: 'active',
            is_active: true,
            activated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (firstName) updateDoc.first_name = firstName;
        if (lastName) updateDoc.last_name = lastName;
        if (fullName) updateDoc.full_name = fullName;

        await collections.users.updateOne(
            { _id: user._id },
            {
                $set: updateDoc,
                $unset: { invite_token: '', invite_token_expires_at: '', invitation_token: '' }
            }
        );

        await logSystemAction(user._id, user.username, user.role, 'ACCEPT_INVITATION', `User "${user.username}" accepted invitation and activated account.`, req);

        res.json({
            success: true,
            message: 'Account activated successfully. You can now sign in.',
            username: user.username,
            email: user.email
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    login,
    verifyLoginPin,
    getMe,
    logout,
    googleRedirect,
    googleCallback,
    requestPasswordReset,
    verifyResetToken,
    resetPassword,
    verifyInvitationToken,
    acceptInvitation
};
