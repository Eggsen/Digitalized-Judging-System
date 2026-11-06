const crypto = require('crypto');
const { collections } = require('../config/db');
const { logSystemAction } = require('../utils/logger');
const { sendSystemEmail } = require('../utils/mailer');
const { getSystemApiKeys, updateEnvFile } = require('../utils/envManager');
const { getIdFilter, maskEmail } = require('../utils/dbHelpers');

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

        // If admin, include api_keys from .env and MongoDB
        if (req.user && req.user.role === 'admin') {
            responsePayload.api_keys = getSystemApiKeys(settingsDoc);
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
 * Save API Keys (.env and MongoDB sync)
 */
async function saveApiKeys(req, res, next) {
    try {
        const incomingKeys = req.body.api_keys || {};
        if (typeof incomingKeys !== 'object') {
            return res.status(400).json({ success: false, message: 'Invalid API keys format.' });
        }

        // 1. Update physical .env on server
        updateEnvFile(incomingKeys);

        // 2. Persist to MongoDB system_settings to survive restarts
        await collections.settings.updateOne(
            { _id: 'system_settings' },
            {
                $set: {
                    api_keys: incomingKeys,
                    updatedAt: new Date().toISOString(),
                    updatedBy: req.user.username
                }
            },
            { upsert: true }
        );

        await logSystemAction(req.user.id, req.user.username, req.user.role, 'UPDATE_API_KEYS', 'Updated environment credentials in .env file and database.', req);

        res.json({
            success: true,
            message: 'API credentials successfully updated in .env and synchronized with cloud database.',
            api_keys: getSystemApiKeys({ api_keys: incomingKeys })
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
                settings,
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
 * Clear Audit Logs
 */
async function clearLogs(req, res, next) {
    try {
        const result = await collections.logs.deleteMany({});
        await logSystemAction(req.user.id, req.user.username, req.user.role, 'CLEAR_LOGS', `Admin purged activity logs (${result.deletedCount} records deleted).`, req);

        res.json({
            success: true,
            message: `Activity audit logs cleared successfully (${result.deletedCount} records purged).`
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
        const { logo_base64, logo_url, action } = req.body;

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
            const { uploadToCloudinary } = require('../utils/cloudinary');
            const uploadRes = await uploadToCloudinary(logo_base64, 'djs_institution_logos');
            if (uploadRes.success) {
                finalUrl = uploadRes.url;
                storage = 'cloudinary';
            }
        }

        if (finalUrl) {
            await collections.settings.updateOne(
                { _id: 'system_settings' },
                { $set: { 'branding.logoUrl': finalUrl, updatedAt: new Date().toISOString() } }
            );

            // Add to logo library
            await collections.logo_library.insertOne({
                url: finalUrl,
                storage,
                uploaded_by: req.user.username,
                created_at: new Date().toISOString()
            });
        }

        res.json({
            success: true,
            message: 'Logo updated successfully.',
            logoUrl: finalUrl,
            storage
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Get Logo Library
 */
async function getLogoLibrary(req, res, next) {
    try {
        const logos = await collections.logo_library.find({}).sort({ created_at: -1 }).toArray();
        res.json({
            success: true,
            logos: logos.map(l => ({ ...l, id: String(l._id) }))
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getSettings,
    saveSettings,
    saveApiKeys,
    updateSecurityControls,
    exportBackup,
    clearLogs,
    uploadLogo,
    getLogoLibrary
};
