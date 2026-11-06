const nodemailer = require('nodemailer');
const { collections } = require('../config/db');

function createTransporter() {
    const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secureProtocol = (process.env.SMTP_SECURE || 'tls').toLowerCase().trim();
    const isSecure = (secureProtocol === 'ssl' || port === 465);
    const user = (process.env.SMTP_USERNAME || '').trim();
    const pass = (process.env.SMTP_PASSWORD || '').trim().replace(/^["']|["']$/g, '');

    if (!user || !pass) {
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: isSecure,
        auth: { user, pass },
        tls: {
            rejectUnauthorized: false
        }
    });
}

/**
 * Send an email using SMTP (e.g. Gmail)
 * @param {string} to
 * @param {string} subject
 * @param {string} htmlContent
 * @param {boolean} forceSend - If true, bypasses the system settings emailServiceEnabled suppression (e.g. for security OTP & password resets)
 */
async function sendSystemEmail(to, subject, htmlContent, forceSend = false) {
    try {
        // Check if automated emails are disabled in system settings
        if (!forceSend && collections.settings) {
            const settings = await collections.settings.findOne({ _id: 'system_settings' });
            if (settings && settings.security && settings.security.emailServiceEnabled === false) {
                console.log(`[Mailer] Automated email sending is disabled in system security settings. Suppressed email to ${to}.`);
                return { success: false, disabled: true, message: 'Email service is disabled in system settings.' };
            }
        }

        const transporter = createTransporter();
        if (!transporter) {
            console.warn(`[Mailer] SMTP credentials not configured. Email to ${to} was not sent.`);
            return { success: false, configured: false, message: 'SMTP credentials not configured.' };
        }

        const fromEmail = (process.env.SMTP_FROM_EMAIL || process.env.SMTP_USERNAME || 'noreply@djs.local').trim();
        const fromName = (process.env.SMTP_FROM_NAME || 'Digitalized Judging System').trim().replace(/^["']|["']$/g, '');

        const info = await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to,
            subject,
            html: htmlContent
        });

        console.log(`[Mailer] Email sent successfully to ${to} (Message ID: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error(`[Mailer] Error sending email to ${to}:`, err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    sendSystemEmail
};
