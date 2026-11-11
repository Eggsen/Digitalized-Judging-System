const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { collections } = require('../config/db');
const { logSystemAction } = require('../utils/logger');
const { sendSystemEmail } = require('../utils/mailer');
const { getSystemApiKeys, updateEnvFile } = require('../utils/envManager');
const { getIdFilter, maskEmail } = require('../utils/dbHelpers');

const JWT_SECRET = process.env.JWT_SECRET || 'buksu-djs-super-secret-jwt-key-2026';

const SECRET_ENV_KEYS = [
    'GOOGLE_CLIENT_SECRET',
    'RECAPTCHA_SECRET_KEY',
    'CLOUDINARY_API_SECRET',
    'PUSHER_SECRET',
    'SMTP_PASSWORD'
];

function maskSecretValue(val) {
    if (!val || String(val).trim() === '') return '';
    return '••••••••••••••••';
}

function isMaskedValue(val) {
    if (val === undefined || val === null) return false;
    const str = String(val).trim();
    if (!str) return false;
    return /^[•*]+$/.test(str) || str.includes('••••');
}

function getDefaultSettings() {
    return {
        _id: 'system_settings',
        branding: {
            institutionName: 'Bukidnon State University',
            campusUnit: 'Main Campus, Malaybalay City - Office of Student Affairs & Services',
            systemTitle: 'JudgeTab - Digitalized Judging System',
            headerSubtitle: 'Official Tabulation & Certification of Competition Results',
            logoUrl: null,
            primaryColor: '#0F2C59',
            accentColor: '#F8B400',
            showWatermark: true,
            signatories: [
                { name: 'Dr. Juan Dela Cruz', title: 'Head Tabulator / Chief Statistician' },
                { name: 'Prof. Maria Santos', title: 'Chairman of the Board of Judges' },
                { name: 'Engr. Roberto Reyes', title: 'Overall Event Director / Coordinator' }
            ]
        },
        judging: {
            decimalPrecision: 2,
            tabulationMethod: 'standard_average',
            tieBreakerRule: 'highest_weight_criterion',
            unlockPolicy: 'admin_approval',
            blindJudging: true,
            maxCriteriaWeight: 100
        },
        security: {
            googleAuthEnabled: true,
            recaptchaEnabled: true,
            emailServiceEnabled: true,
            qrCodeEnabled: true,
            cloudinaryEnabled: true,
            websocketEnabled: true
        },
        backup: {
            lastBackupAt: null,
            autoBackupNotice: true
        },
        updatedAt: new Date().toISOString(),
        updatedBy: 'System Default'
    };
}

/**
 * Get Settings & Diagnostics
 */
async function getSettings(req, res, next) {
    try {
        let settingsDoc = await collections.settings.findOne({ _id: 'system_settings' });
        if (!settingsDoc) {
            settingsDoc = getDefaultSettings();
            await collections.settings.insertOne(settingsDoc);
        }

        // Diagnostics
        const [eventsCount, contestantsCount, criteriaCount, scoresCount, usersCount, logsCount] = await Promise.all([
            collections.events.countDocuments(),
            collections.contestants.countDocuments(),
            collections.criteria.countDocuments(),
            collections.scores.countDocuments(),
            collections.users.countDocuments(),
            collections.logs.countDocuments()
        ]);

        const diagnostics = {
            database: process.env.MONGODB_DATABASE || 'djs_db',
            connection: 'Connected (MongoDB Atlas)',
            counts: {
                events: eventsCount,
                contestants: contestantsCount,
                criteria: criteriaCount,
                scores: scoresCount,
                users: usersCount,
                logs: logsCount
            },
            serverTime: new Date().toISOString(),
            nodeVersion: process.version,
            systemVersion: 'v3.0-REST-NodeJS'
        };

        const recaptchaSiteKey = (process.env.RECAPTCHA_SITE_KEY || (settingsDoc.api_keys && settingsDoc.api_keys.RECAPTCHA_SITE_KEY) || '').trim();

        const responsePayload = {
            success: true,
            settings: settingsDoc,
            recaptcha_site_key: recaptchaSiteKey,
            diagnostics
        };

        // If admin, return masked placeholders by default. Real values are only unlocked via Admin PIN verification.
        if (req.user && req.user.role === 'admin') {
            const rawKeys = getSystemApiKeys(settingsDoc);
            const masked = {};
            for (const key of Object.keys(rawKeys)) {
                if (rawKeys[key] && String(rawKeys[key]).trim() !== '') {
                    masked[key] = maskSecretValue(rawKeys[key]);
                } else {
                    masked[key] = '';
                }
            }
            responsePayload.api_keys = masked;
        } else {
            // For public / unauthenticated forms, include public client keys
            responsePayload.api_keys = {
                RECAPTCHA_SITE_KEY: recaptchaSiteKey
            };
        }

        res.json(responsePayload);
    } catch (err) {
        next(err);
    }
}

/**
 * Save Branding & Judging Rules
 */
async function saveSettings(req, res, next) {
    try {
        const { branding = {}, judging = {} } = req.body;

        const cleanSignatories = Array.isArray(branding.signatories)
            ? branding.signatories.map(s => ({ name: String(s.name || '').trim(), title: String(s.title || '').trim() })).filter(s => s.name || s.title)
            : getDefaultSettings().branding.signatories;

        const cleanBranding = {
            institutionName: (branding.institutionName || 'Bukidnon State University').trim(),
            campusUnit: (branding.campusUnit || '').trim(),
            systemTitle: (branding.systemTitle || 'JudgeTab - Digitalized Judging System').trim(),
            headerSubtitle: (branding.headerSubtitle || '').trim(),
            logoUrl: branding.logoUrl || null,
            primaryColor: branding.primaryColor || '#0F2C59',
            accentColor: branding.accentColor || '#F8B400',
            showWatermark: Boolean(branding.showWatermark),
            signatories: cleanSignatories
        };

        const precision = Math.min(Math.max(parseInt(judging.decimalPrecision || 2, 10), 1), 4);
        const cleanJudging = {
            decimalPrecision: precision,
            tabulationMethod: ['standard_average', 'olympic_trimming', 'ordinal_ranking'].includes(judging.tabulationMethod)
                ? judging.tabulationMethod : 'standard_average',
            tieBreakerRule: ['highest_weight_criterion', 'judge_majority_vote', 'split_award'].includes(judging.tieBreakerRule)
                ? judging.tieBreakerRule : 'highest_weight_criterion',
            unlockPolicy: ['admin_approval', 'judge_self_unlock'].includes(judging.unlockPolicy)
                ? judging.unlockPolicy : 'admin_approval',
            blindJudging: Boolean(judging.blindJudging),
            maxCriteriaWeight: 100
        };

        const now = new Date().toISOString();
        await collections.settings.updateOne(
            { _id: 'system_settings' },
            {
                $set: {
                    branding: cleanBranding,
                    judging: cleanJudging,
                    updatedAt: now,
                    updatedBy: req.user.username
                }
            },
            { upsert: true }
        );

        await logSystemAction(req.user.id, req.user.username, req.user.role, 'UPDATE_SETTINGS', 'Updated institutional branding, judging rules, and signatories.', req);

        const updatedDoc = await collections.settings.findOne({ _id: 'system_settings' });

        res.json({
            success: true,
            message: 'System settings updated successfully.',
            settings: updatedDoc
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Verify Admin PIN to unlock API Keys / Environment (.env) editing
 */
async function verifyAdminPin(req, res, next) {
    try {
        const { pin } = req.body;
        const submittedPin = String(pin || '').trim();

        if (!submittedPin) {
            return res.status(400).json({ success: false, message: 'Please enter your Admin PIN.' });
        }

        const userDoc = await collections.users.findOne(getIdFilter(req.user.id));
        if (!userDoc) {
            return res.status(404).json({ success: false, message: 'Admin user not found.' });
        }

        // Rate-limiting / lockout check
        if (userDoc.pin_locked_until && new Date() < new Date(userDoc.pin_locked_until)) {
            const remainingMinutes = Math.ceil((new Date(userDoc.pin_locked_until) - new Date()) / 60000);
            return res.status(429).json({
                success: false,
                message: `Too many failed PIN attempts. Access locked. Please wait ${remainingMinutes} minute(s) before trying again.`
            });
        }

        let isMatch = false;
        if (userDoc.admin_pin) {
            isMatch = await bcrypt.compare(submittedPin, userDoc.admin_pin);
        } else {
            // Fallback for existing admin accounts: match process.env.ADMIN_PIN
            const envPin = (process.env.ADMIN_PIN || '').trim();
            if (envPin && submittedPin === envPin) {
                isMatch = true;
                // Automatically persist and hash this PIN exclusively for this admin
                const hashedPin = await bcrypt.hash(submittedPin, 10);
                await collections.users.updateOne(
                    { _id: userDoc._id },
                    { $set: { admin_pin: hashedPin } }
                );
            }
        }

        if (!isMatch) {
            const currentFailed = (userDoc.pin_failed_attempts || 0) + 1;
            const updateDoc = { pin_failed_attempts: currentFailed };
            if (currentFailed >= 5) {
                updateDoc.pin_locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
                updateDoc.pin_failed_attempts = 0;
            }
            await collections.users.updateOne({ _id: userDoc._id }, { $set: updateDoc });

            const remaining = 5 - currentFailed;
            return res.status(401).json({
                success: false,
                message: currentFailed >= 5
                    ? 'Too many failed attempts. Admin PIN is locked for 15 minutes.'
                    : `Incorrect Admin PIN. ${remaining} attempt(s) remaining.`
            });
        }

        // Reset failed attempts on success
        if (userDoc.pin_failed_attempts || userDoc.pin_locked_until) {
            await collections.users.updateOne(
                { _id: userDoc._id },
                { $set: { pin_failed_attempts: 0, pin_locked_until: null } }
            );
        }

        // Generate 15-minute unlock token
        const unlockToken = jwt.sign(
            {
                userId: String(userDoc._id),
                username: userDoc.username,
                role: 'admin',
                purpose: 'env_credentials_unlock'
            },
            JWT_SECRET,
            { expiresIn: '15m' }
        );

        let settingsDoc = await collections.settings.findOne({ _id: 'system_settings' });
        const unmaskedKeys = getSystemApiKeys(settingsDoc);

        await logSystemAction(
            req.user.id,
            req.user.username,
            req.user.role,
            'VERIFY_ADMIN_PIN',
            'Successfully verified exclusive Admin PIN to unlock environment configuration.',
            req
        );

        res.json({
            success: true,
            message: 'Admin PIN verified successfully. Environment credentials unlocked for editing.',
            unlock_token: unlockToken,
            api_keys: unmaskedKeys
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Save API Keys (.env and MongoDB sync)
 */
async function saveApiKeys(req, res, next) {
    try {
        const incomingKeys = req.body.api_keys || {};
        if (typeof incomingKeys !== 'object') {
            return res.status(400).json({ success: false, message: 'Invalid API keys format.' });
        }

        const unlockToken = req.headers['x-unlock-token'] || req.body.unlock_token;
        const submittedPin = req.headers['x-admin-pin'] || req.body.pin;

        let isAuthorized = false;

        // Verify unlock token
        if (unlockToken) {
            try {
                const decoded = jwt.verify(unlockToken, JWT_SECRET);
                if (decoded.purpose === 'env_credentials_unlock' && decoded.userId === String(req.user.id)) {
                    isAuthorized = true;
                }
            } catch (e) {}
        }

        // Fallback: Verify direct PIN if provided
        if (!isAuthorized && submittedPin) {
            const userDoc = await collections.users.findOne(getIdFilter(req.user.id));
            if (userDoc) {
                if (userDoc.admin_pin) {
                    isAuthorized = await bcrypt.compare(String(submittedPin).trim(), userDoc.admin_pin);
                } else if (process.env.ADMIN_PIN && String(submittedPin).trim() === process.env.ADMIN_PIN.trim()) {
                    isAuthorized = true;
                }
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Elevated authorization required. Please verify your exclusive Admin PIN before saving credentials.'
            });
        }

        let settingsDoc = await collections.settings.findOne({ _id: 'system_settings' });
        const currentSystemKeys = getSystemApiKeys(settingsDoc);

        // Sanitize incoming keys: if a field has bullet mask or empty secret when already set, preserve the real existing value
        const sanitizedKeys = { ...incomingKeys };
        for (const field of Object.keys(currentSystemKeys)) {
            const incomingVal = sanitizedKeys[field];
            if (isMaskedValue(incomingVal) || (SECRET_ENV_KEYS.includes(field) && incomingVal === '' && currentSystemKeys[field])) {
                sanitizedKeys[field] = currentSystemKeys[field] || '';
            }
        }

        // 1. Update physical .env on server
        updateEnvFile(sanitizedKeys);

        // 2. Persist to MongoDB system_settings to survive restarts
        await collections.settings.updateOne(
            { _id: 'system_settings' },
            {
                $set: {
                    api_keys: sanitizedKeys,
                    updatedAt: new Date().toISOString(),
                    updatedBy: req.user.username
                }
            },
            { upsert: true }
        );

        await logSystemAction(req.user.id, req.user.username, req.user.role, 'UPDATE_API_KEYS', 'Updated environment credentials in .env file and database.', req);

        // Return masked keys for security
        const updatedDoc = await collections.settings.findOne({ _id: 'system_settings' });
        const latestKeys = getSystemApiKeys(updatedDoc);
        const maskedLatest = {};
        for (const key of Object.keys(latestKeys)) {
            if (latestKeys[key] && String(latestKeys[key]).trim() !== '') {
                maskedLatest[key] = maskSecretValue(latestKeys[key]);
            } else {
                maskedLatest[key] = '';
            }
        }

        res.json({
            success: true,
            message: 'API credentials successfully updated in .env and synchronized with cloud database.',
            api_keys: maskedLatest
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Update / Toggle Security Controls with Email OTP Verification
 */
async function updateSecurityControls(req, res, next) {
    try {
        const {
            code,
            action,
            googleAuthEnabled,
            recaptchaEnabled,
            emailServiceEnabled,
            qrCodeEnabled,
            cloudinaryEnabled,
            websocketEnabled
        } = req.body;

        let settingsDoc = await collections.settings.findOne({ _id: 'system_settings' });
        if (!settingsDoc) {
            settingsDoc = getDefaultSettings();
            await collections.settings.insertOne(settingsDoc);
        }

        const currentSecurity = settingsDoc.security || {
            googleAuthEnabled: true,
            recaptchaEnabled: true,
            emailServiceEnabled: true,
            qrCodeEnabled: true,
            cloudinaryEnabled: true,
            websocketEnabled: true
        };

        // Check for 2FA unlock token or direct authenticated apply
        const unlockToken = req.headers['x-unlock-token'] || req.body.unlock_token;
        let isTokenValid = false;
        if (unlockToken) {
            try {
                const decoded = jwt.verify(unlockToken, JWT_SECRET);
                if (decoded.purpose === 'env_credentials_unlock' && decoded.userId === String(req.user.id)) {
                    isTokenValid = true;
                }
            } catch (e) {}
        }

        // Direct apply when 2FA has been verified for the System Security & Infrastructure section
        if (isTokenValid || req.body.direct_apply) {
            const requestedSecurity = {
                googleAuthEnabled: googleAuthEnabled !== undefined ? Boolean(googleAuthEnabled) : (currentSecurity.googleAuthEnabled !== false),
                recaptchaEnabled: recaptchaEnabled !== undefined ? Boolean(recaptchaEnabled) : (currentSecurity.recaptchaEnabled !== false),
                emailServiceEnabled: emailServiceEnabled !== undefined ? Boolean(emailServiceEnabled) : (currentSecurity.emailServiceEnabled !== false),
                qrCodeEnabled: qrCodeEnabled !== undefined ? Boolean(qrCodeEnabled) : (currentSecurity.qrCodeEnabled !== false),
                cloudinaryEnabled: cloudinaryEnabled !== undefined ? Boolean(cloudinaryEnabled) : (currentSecurity.cloudinaryEnabled !== false),
                websocketEnabled: websocketEnabled !== undefined ? Boolean(websocketEnabled) : (currentSecurity.websocketEnabled !== false)
            };

            const newSecurity = {
                ...currentSecurity,
                ...requestedSecurity
            };

            await collections.settings.updateOne(
                { _id: 'system_settings' },
                {
                    $set: {
                        security: newSecurity,
                        updatedAt: new Date().toISOString(),
                        updatedBy: req.user.username
                    }
                }
            );

            await logSystemAction(
                req.user.id,
                req.user.username,
                req.user.role,
                'UPDATE_SECURITY_CONTROLS',
                'Immediately updated security controls in 2FA-authenticated System Security & Infrastructure section.',
                req
            );

            return res.json({
                success: true,
                message: 'Security controls updated successfully.',
                security: newSecurity
            });
        }

        // 1. Confirmation OTP code submitted
        if (code !== undefined && code !== null && String(code).trim() !== '') {
            const pending = settingsDoc.pending_security_change;
            if (!pending || !pending.code) {
                return res.status(400).json({
                    success: false,
                    message: 'No pending security change found. Please submit your changes again.'
                });
            }

            if (pending.expires_at && new Date() > new Date(pending.expires_at)) {
                return res.status(400).json({
                    success: false,
                    message: 'The confirmation code has expired (valid for 15 minutes). Please request a new one.'
                });
            }

            if (String(pending.code).trim() !== String(code).trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid confirmation code. Please check your email and try again.'
                });
            }

            // OTP code is valid: apply changes
            const newSecurity = {
                ...currentSecurity,
                ...(pending.changes || pending.pending_security || {})
            };

            await collections.settings.updateOne(
                { _id: 'system_settings' },
                {
                    $set: {
                        security: newSecurity,
                        updatedAt: new Date().toISOString(),
                        updatedBy: req.user.username
                    },
                    $unset: {
                        pending_security_change: ''
                    }
                }
            );

            await logSystemAction(
                req.user.id,
                req.user.username,
                req.user.role,
                'UPDATE_SECURITY_CONTROLS',
                'Confirmed and updated security controls via email OTP verification.',
                req
            );

            return res.json({
                success: true,
                message: 'Security controls successfully confirmed and updated!',
                security: newSecurity
            });
        }

        // 2. Resend code requested
        if (action === 'resend_security_code') {
            const pending = settingsDoc.pending_security_change;
            if (!pending || (!pending.changes && !pending.pending_security)) {
                return res.status(400).json({
                    success: false,
                    message: 'No pending security change found. Please make changes and submit again.'
                });
            }

            const newCode = crypto.randomInt(100000, 999999).toString();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            const targetEmail = pending.requested_by_email || req.user.email || process.env.SMTP_USERNAME;

            await collections.settings.updateOne(
                { _id: 'system_settings' },
                {
                    $set: {
                        'pending_security_change.code': newCode,
                        'pending_security_change.expires_at': expiresAt
                    }
                }
            );

            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
                    <h2 style="color: #0F2C59; margin-bottom: 8px;">Security Verification Code</h2>
                    <p style="color: #475569; font-size: 14px;">Here is your new 6-digit confirmation code to update system security controls in BukSU JudgeTab:</p>
                    <div style="text-align: center; margin: 24px 0;">
                        <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0F2C59; background: #f1f5f9; padding: 10px 24px; border-radius: 12px; border: 1px dashed #cbd5e1;">${newCode}</span>
                    </div>
                    <p style="font-size: 12px; color: #94a3b8;">This code will expire in 15 minutes. If you did not request this, please verify system security immediately.</p>
                </div>
            `;

            await sendSystemEmail(targetEmail, 'New Security Verification Code - BukSU JudgeTab', emailHtml, true);

            return res.json({
                success: true,
                message: 'A new 6-digit verification code has been dispatched to your email.',
                masked_email: maskEmail(targetEmail)
            });
        }

        // 3. Initial request to change security controls
        const requestedSecurity = {
            googleAuthEnabled: Boolean(googleAuthEnabled),
            recaptchaEnabled: Boolean(recaptchaEnabled),
            emailServiceEnabled: Boolean(emailServiceEnabled),
            qrCodeEnabled: Boolean(qrCodeEnabled),
            cloudinaryEnabled: Boolean(cloudinaryEnabled),
            websocketEnabled: Boolean(websocketEnabled)
        };

        // Determine admin email
        let adminEmail = req.user.email;
        if (!adminEmail) {
            const userDoc = await collections.users.findOne(getIdFilter(req.user.id));
            adminEmail = userDoc?.email || process.env.SMTP_USERNAME || process.env.SMTP_FROM_EMAIL;
        }

        const hasSmtp = Boolean(process.env.SMTP_USERNAME && process.env.SMTP_PASSWORD);

        // If SMTP configured and admin email found: require OTP verification!
        if (hasSmtp && adminEmail) {
            const otpCode = crypto.randomInt(100000, 999999).toString();
            const token = crypto.randomBytes(24).toString('hex');
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

            const pendingData = {
                code: otpCode,
                token,
                changes: requestedSecurity,
                pending_security: requestedSecurity,
                requested_by_id: String(req.user.id),
                requested_by_username: req.user.username,
                requested_by_email: adminEmail,
                expires_at: expiresAt,
                created_at: new Date().toISOString()
            };

            await collections.settings.updateOne(
                { _id: 'system_settings' },
                { $set: { pending_security_change: pendingData } },
                { upsert: true }
            );

            const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
                    <h2 style="color: #0F2C59; margin-bottom: 8px;">Security Verification Code</h2>
                    <p style="color: #475569; font-size: 14px;">A request has been initiated to modify Authentication &amp; Security Controls in BukSU JudgeTab. To apply these changes, enter the 6-digit confirmation code below:</p>
                    <div style="text-align: center; margin: 24px 0;">
                        <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0F2C59; background: #f1f5f9; padding: 10px 24px; border-radius: 12px; border: 1px dashed #cbd5e1;">${otpCode}</span>
                    </div>
                    <p style="font-size: 12px; color: #94a3b8;">This code will expire in 15 minutes. If you did not request this, please investigate system security.</p>
                </div>
            `;

            // Force send verification email even if other automated emails are suppressed
            await sendSystemEmail(adminEmail, 'Security Controls Verification Code - BukSU JudgeTab', emailHtml, true);

            return res.json({
                success: true,
                requires_confirmation: true,
                masked_email: maskEmail(adminEmail),
                expires_in: 900
            });
        }

        // Direct update fallback if SMTP is not configured
        await collections.settings.updateOne(
            { _id: 'system_settings' },
            {
                $set: {
                    security: requestedSecurity,
                    updatedAt: new Date().toISOString(),
                    updatedBy: req.user.username
                }
            },
            { upsert: true }
        );

        await logSystemAction(req.user.id, req.user.username, req.user.role, 'UPDATE_SECURITY_CONTROLS', 'Updated security controls (direct mode).', req);

        res.json({
            success: true,
            message: 'Security controls updated successfully.',
            security: requestedSecurity
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Export System Backup JSON
 */
async function exportBackup(req, res, next) {
    try {
        const [settings, events, contestants, criteria, scores, users, logs] = await Promise.all([
            collections.settings.findOne({ _id: 'system_settings' }),
            collections.events.find({}).toArray(),
            collections.contestants.find({}).toArray(),
            collections.criteria.find({}).toArray(),
            collections.scores.find({}).toArray(),
            collections.users.find({}, { projection: { password: 0, reset_token: 0, invite_token: 0 } }).toArray(),
            collections.logs.find({}).sort({ timestamp: -1 }).limit(500).toArray()
        ]);

        const now = new Date().toISOString();
        await collections.settings.updateOne(
            { _id: 'system_settings' },
            { $set: { 'backup.lastBackupAt': now } }
        );

        // Security: Mask all third-party API keys and sensitive OTP objects from backup JSON dump
        let sanitizedSettings = settings ? JSON.parse(JSON.stringify(settings)) : {};
        if (sanitizedSettings.api_keys) {
            for (const key of Object.keys(sanitizedSettings.api_keys)) {
                if (sanitizedSettings.api_keys[key] && String(sanitizedSettings.api_keys[key]).trim() !== '') {
                    sanitizedSettings.api_keys[key] = '••••••••••••••••';
                }
            }
        }
        if (sanitizedSettings.pending_security_change) {
            delete sanitizedSettings.pending_security_change;
        }

        await logSystemAction(req.user.id, req.user.username, req.user.role, 'EXPORT_BACKUP', 'Downloaded system JSON database backup.', req);

        res.json({
            success: true,
            message: 'Backup generated successfully.',
            filename: `judgetab_backup_${now.replace(/[:.]/g, '-')}.json`,
            lastBackupAt: now,
            data: {
                metadata: {
                    system: 'BukSU JudgeTab Digitalized Judging System',
                    exportedAt: now,
                    exportedBy: req.user.username,
                    schemaVersion: '3.0'
                },
                settings: sanitizedSettings,
                events,
                contestants,
                criteria,
                scores,
                users,
                logs
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Clear Audit Logs (Requires typing "Confirm")
 */
async function clearLogs(req, res, next) {
    try {
        const confirmation = req.body && req.body.confirmation;
        if (String(confirmation || '').trim().toLowerCase() !== 'confirm') {
            return res.status(400).json({
                success: false,
                message: 'Action aborted. You must type "Confirm" to purge activity audit logs.'
            });
        }

        const result = await collections.logs.deleteMany({});
        await logSystemAction(req.user.id, req.user.username, req.user.role, 'CLEAR_LOGS', `Admin purged activity logs (${result.deletedCount} records deleted).`, req);

        res.json({
            success: true,
            message: `Activity audit logs cleared successfully (${result.deletedCount} records purged).`,
            deletedCount: result.deletedCount
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Upload Institution Logo (Cloudinary or Base64)
 */
async function uploadLogo(req, res, next) {
    try {
        const { logo_base64, logo_url, action, filename } = req.body;

        if (action === 'reset_default_logo') {
            await collections.settings.updateOne(
                { _id: 'system_settings' },
                { $set: { 'branding.logoUrl': null, updatedAt: new Date().toISOString() } }
            );
            return res.json({ success: true, message: 'Logo reset to default.', logoUrl: null });
        }

        let finalUrl = logo_url;
        let storage = 'local';

        if (logo_base64) {
            // Attempt Cloudinary upload if credentials are configured
            try {
                const { isCloudinaryConfiguredAsync, uploadToCloudinary } = require('../utils/cloudinary');
                const hasCloudinary = await isCloudinaryConfiguredAsync();
                if (hasCloudinary) {
                    const uploadRes = await uploadToCloudinary(logo_base64, 'djs_institution_logos');
                    if (uploadRes && uploadRes.success) {
                        finalUrl = uploadRes.url;
                        storage = 'cloudinary';
                    }
                }
            } catch (cloudErr) {
                console.warn('[Logo Upload] Cloudinary upload bypassed, falling back to local storage:', cloudErr.message);
            }

            // Local filesystem storage fallback
            if (!finalUrl && typeof logo_base64 === 'string' && logo_base64.startsWith('data:image/')) {
                const matches = logo_base64.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
                if (matches) {
                    let ext = matches[1].toLowerCase();
                    if (ext === 'jpeg') ext = 'jpg';
                    if (ext === 'svg+xml') ext = 'svg';
                    const base64Data = matches[2];
                    const buffer = Buffer.from(base64Data, 'base64');

                    const safeName = (filename ? path.parse(filename).name : 'logo')
                        .replace(/[^a-zA-Z0-9_-]/g, '_')
                        .substring(0, 32);
                    const fname = `logo_${Date.now()}_${safeName}.${ext}`;
                    const targetDir = path.join(__dirname, '..', 'assets', 'uploads', 'logos');
                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true });
                    }
                    fs.writeFileSync(path.join(targetDir, fname), buffer);
                    finalUrl = `/assets/uploads/logos/${fname}`;
                    storage = 'local';
                }
            }
        }

        if (finalUrl) {
            await collections.settings.updateOne(
                { _id: 'system_settings' },
                { $set: { 'branding.logoUrl': finalUrl, updatedAt: new Date().toISOString() } }
            );

            // Add to logo library if not already present
            const exists = await collections.logo_library.findOne({ url: finalUrl });
            if (!exists) {
                await collections.logo_library.insertOne({
                    url: finalUrl,
                    storage,
                    uploaded_by: req.user ? req.user.username : 'Administrator',
                    created_at: new Date().toISOString()
                });
            }
        }

        res.json({
            success: Boolean(finalUrl),
            message: finalUrl ? 'Logo updated successfully.' : 'Failed to process logo image.',
            logoUrl: finalUrl,
            storage
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Get Logo Library / Repository
 */
async function getLogoLibrary(req, res, next) {
    try {
        const settingsDoc = await collections.settings.findOne({ _id: 'system_settings' });
        const activeLogoUrl = settingsDoc?.branding?.logoUrl || null;
        const defaultLogoUrl = '/assets/logo/DJS Logo.png';

        // Auto-seed: Inspect local uploads directory for existing logos not yet in database
        const localUploadsDir = path.join(__dirname, '..', 'assets', 'uploads', 'logos');
        if (fs.existsSync(localUploadsDir)) {
            try {
                const files = fs.readdirSync(localUploadsDir);
                for (const f of files) {
                    if (f === '.' || f === '..' || f === '.gitkeep') continue;
                    const localUrl = `/assets/uploads/logos/${f}`;
                    const exists = await collections.logo_library.findOne({ url: localUrl });
                    if (!exists) {
                        const stats = fs.statSync(path.join(localUploadsDir, f));
                        await collections.logo_library.insertOne({
                            url: localUrl,
                            filename: f,
                            storage: 'local',
                            size: stats.size,
                            uploadedBy: 'Admin',
                            uploadedAt: new Date(stats.mtime).toISOString().replace('T', ' ').substring(0, 19),
                            created_at: new Date(stats.mtime).toISOString()
                        });
                    }
                }
            } catch (fsErr) {
                console.warn('[LogoLibrary] File system scan notice:', fsErr.message);
            }
        }

        // Auto-seed active logo if not yet in library
        if (activeLogoUrl && activeLogoUrl !== defaultLogoUrl) {
            const exists = await collections.logo_library.findOne({ url: activeLogoUrl });
            if (!exists) {
                const storage = activeLogoUrl.includes('cloudinary.com') ? 'cloudinary' : 'local';
                const filename = path.basename(new URL(activeLogoUrl, 'http://localhost').pathname) || 'institution_logo';
                await collections.logo_library.insertOne({
                    url: activeLogoUrl,
                    filename,
                    storage,
                    uploadedBy: settingsDoc?.updatedBy || 'Admin',
                    uploadedAt: settingsDoc?.updatedAt || new Date().toISOString(),
                    created_at: new Date().toISOString()
                });
            }
        }

        const cursor = await collections.logo_library.find({}).sort({ created_at: -1 }).toArray();
        const items = [];

        // Always include Default BukSU Seal as first option
        items.push({
            id: 'default_system_logo',
            url: defaultLogoUrl,
            filename: 'BukSU Official Seal (System Default)',
            storage: 'default',
            uploadedAt: 'Pre-installed',
            isDefault: true,
            isActive: !activeLogoUrl || activeLogoUrl === defaultLogoUrl
        });

        for (const doc of cursor) {
            const url = doc.url || '';
            if (!url) continue;

            items.push({
                id: String(doc._id),
                url,
                filename: doc.filename || path.basename(url) || 'logo',
                storage: doc.storage || (url.includes('cloudinary') ? 'cloudinary' : 'local'),
                uploadedBy: doc.uploadedBy || doc.uploaded_by || 'Admin',
                uploadedAt: doc.uploadedAt || doc.created_at || 'Recently',
                isDefault: false,
                isActive: (activeLogoUrl === url)
            });
        }

        res.json({
            success: true,
            activeLogoUrl,
            items
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Manage Logo Library (Select or Delete Logo)
 */
async function manageLogoLibrary(req, res, next) {
    try {
        const defaultLogoUrl = '/assets/logo/DJS Logo.png';
        const { action } = req.body;

        if (action === 'select_logo') {
            const selectedUrl = (req.body.url || '').trim();
            let newLogoVal = null;
            let effectiveUrl = defaultLogoUrl;
            let actionNote = 'Reverted active logo to system default BukSU seal.';

            if (selectedUrl && selectedUrl !== defaultLogoUrl && selectedUrl !== 'default_system_logo') {
                newLogoVal = selectedUrl;
                effectiveUrl = selectedUrl;
                actionNote = `Selected logo from library: ${selectedUrl}`;
            }

            await collections.settings.updateOne(
                { _id: 'system_settings' },
                {
                    $set: {
                        'branding.logoUrl': newLogoVal,
                        updatedAt: new Date().toISOString(),
                        updatedBy: req.user.username || 'Administrator'
                    }
                }
            );

            await logSystemAction(
                req.user.id,
                req.user.username,
                req.user.role,
                'SELECT_LOGO_FROM_LIBRARY',
                actionNote,
                req
            );

            let storageType = 'default';
            if (newLogoVal) {
                storageType = newLogoVal.includes('cloudinary.com') ? 'cloudinary' : 'local';
            }

            return res.json({
                success: true,
                logoUrl: newLogoVal,
                effectiveUrl,
                storage: storageType,
                message: 'Institution logo updated successfully from library!'
            });
        }

        if (action === 'delete_logo') {
            const id = (req.body.id || '').trim();
            if (!id || id === 'default_system_logo') {
                return res.status(400).json({ success: false, message: 'Default system logo cannot be deleted.' });
            }

            const query = getIdFilter(id);
            const item = await collections.logo_library.findOne(query);
            if (!item) {
                return res.status(404).json({ success: false, message: 'Logo asset not found in library.' });
            }

            const deletedUrl = item.url || '';
            const settingsDoc = await collections.settings.findOne({ _id: 'system_settings' });
            const activeLogoUrl = settingsDoc?.branding?.logoUrl || null;
            const wasActive = (activeLogoUrl === deletedUrl);

            if (wasActive) {
                await collections.settings.updateOne(
                    { _id: 'system_settings' },
                    {
                        $set: {
                            'branding.logoUrl': null,
                            updatedAt: new Date().toISOString(),
                            updatedBy: req.user.username || 'Administrator'
                        }
                    }
                );
            }

            // If local storage, delete physical file if on disk
            if (item.storage === 'local' && deletedUrl) {
                try {
                    const localPath = path.join(__dirname, '..', deletedUrl.replace(/^\//, ''));
                    if (fs.existsSync(localPath)) {
                        fs.unlinkSync(localPath);
                    }
                } catch (delErr) {
                    console.warn('[LogoLibrary] Local file unlink notice:', delErr.message);
                }
            }

            await collections.logo_library.deleteOne(query);

            await logSystemAction(
                req.user.id,
                req.user.username,
                req.user.role,
                'DELETE_LOGO_FROM_LIBRARY',
                `Deleted logo asset from library: ${deletedUrl}`,
                req
            );

            return res.json({
                success: true,
                wasActive,
                message: 'Logo deleted from repository successfully.'
            });
        }

        return res.status(400).json({ success: false, message: 'Invalid action specified.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getSettings,
    saveSettings,
    verifyAdminPin,
    saveApiKeys,
    updateSecurityControls,
    exportBackup,
    clearLogs,
    uploadLogo,
    getLogoLibrary,
    manageLogoLibrary
};
