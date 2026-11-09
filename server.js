const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const { connectDB, collections } = require('./config/db');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { getIdFilter } = require('./utils/dbHelpers');

const JWT_SECRET = process.env.JWT_SECRET || 'buksu-djs-super-secret-jwt-key-2026';

// Route modules
const authRoutes = require('./routes/authRoutes');
const authController = require('./controllers/authController');
const eventRoutes = require('./routes/eventRoutes');
const contestantRoutes = require('./routes/contestantRoutes');
const criteriaRoutes = require('./routes/criteriaRoutes');
const scoreRoutes = require('./routes/scoreRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const logRoutes = require('./routes/logRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for Android, iOS, and Web clients
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Recaptcha-Token']
}));

// Body parsing with base64 image support (up to 15mb)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(cookieParser());

// Configure EJS view engine for dynamic server rendering
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static Asset Directories
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));
app.use('/scripts', express.static(path.join(__dirname, 'scripts')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/vendor/pdfmake', express.static(path.join(__dirname, 'node_modules/pdfmake/build')));

// -------------------------------------------------------------
// RESTful API Routes (Modern Architecture - Android/Web/iOS)
// -------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/contestants', contestantRoutes);
app.use('/api/criteria', criteriaRoutes);
app.use('/api/scores', scoreRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/logs', logRoutes);

// Google OAuth Callback (matching Google Cloud Console OAuth redirect configuration)
app.get(['/backend/auth/google_callback.php', '/api/auth/google/callback'], authController.googleCallback);
app.get(['/backend/auth/google_redirect.php', '/api/auth/google'], authController.googleRedirect);

// Role badge definitions (matches original system)
const roleBadges = {
    admin: { title: 'Administrator Dashboard', icon: 'fa-user-shield', color: 'bg-buksu-navy' },
    judge: { title: 'Official Judge Portal', icon: 'fa-gavel', color: 'bg-amber-600' },
    tabulator: { title: 'Tabulator Control Panel', icon: 'fa-calculator', color: 'bg-emerald-600' }
};

// -------------------------------------------------------------
// Web HTML Page Views (Clean URLs)
// -------------------------------------------------------------
app.get(['/', '/index.html'], (req, res) => {
    if (req.query.invite_token || req.query.token) {
        return res.redirect('/auth/accept-invitation?token=' + encodeURIComponent(req.query.invite_token || req.query.token));
    }
    if (req.query.reset_token) {
        return res.redirect('/auth/reset-password?token=' + encodeURIComponent(req.query.reset_token));
    }
    const token = req.cookies?.djs_token || req.cookies?.jwt_token;
    if (token) {
        try {
            jwt.verify(token, JWT_SECRET);
            return res.redirect('/dashboard');
        } catch (e) {
            res.clearCookie('djs_token');
            res.clearCookie('jwt_token');
        }
    }
    return res.redirect('/auth/login');
});

// Render Dashboard with Authenticated Session State (Exact same as original system)
app.get(['/dashboard', '/dashboard.html'], async (req, res) => {
    const token = req.cookies?.djs_token || req.cookies?.jwt_token;
    if (!token) {
        return res.redirect('/auth/login');
    }

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
        res.clearCookie('djs_token');
        res.clearCookie('jwt_token');
        return res.redirect('/auth/login?error=session_expired');
    }

    let user;
    try {
        user = await collections.users.findOne(getIdFilter(decoded.id));
    } catch (e) {}

    if (!user) {
        res.clearCookie('djs_token');
        res.clearCookie('jwt_token');
        return res.redirect('/auth/login?error=no_account');
    }

    if (user.is_active === false || user.status === 'disabled') {
        res.clearCookie('djs_token');
        res.clearCookie('jwt_token');
        return res.redirect('/auth/login?error=account_disabled');
    }

    const role = (user.role || 'judge').toLowerCase();
    const badgeInfo = roleBadges[role] || { title: 'User Dashboard', icon: 'fa-user', color: 'bg-slate-700' };

    const userPrefs = user.preferences || {};
    const serverTheme = userPrefs.theme || 'light';
    const serverColorRule = userPrefs.colorRule || 'normal';
    const serverNavPlacement = userPrefs.navPlacement || 'top';

    res.render('dashboard', {
        user: {
            id: String(user._id),
            username: user.username || 'User',
            email: user.email || '',
            role: role,
            full_name: user.full_name || user.name || user.username
        },
        badgeInfo,
        serverTheme,
        serverColorRule,
        serverNavPlacement
    });
});

app.get(['/auth/login', '/auth/login.html', '/login'], async (req, res) => {
    if (req.query.error) {
        res.clearCookie('djs_token');
        res.clearCookie('jwt_token');
    } else {
        const token = req.cookies?.djs_token || req.cookies?.jwt_token;
        if (token) {
            try {
                jwt.verify(token, JWT_SECRET);
                return res.redirect('/dashboard');
            } catch (e) {
                res.clearCookie('djs_token');
                res.clearCookie('jwt_token');
            }
        }
    }

    try {
        let isRecaptchaEnabled = true;
        let isEmailEnabled = true;
        let isGoogleAuthEnabled = true;
        let siteKey = (process.env.RECAPTCHA_SITE_KEY || '').trim();

        if (collections.settings) {
            const settingsDoc = await collections.settings.findOne({ _id: 'system_settings' });
            if (settingsDoc && settingsDoc.security) {
                if (settingsDoc.security.recaptchaEnabled === false) isRecaptchaEnabled = false;
                if (settingsDoc.security.emailServiceEnabled === false) isEmailEnabled = false;
                if (settingsDoc.security.googleAuthEnabled === false) isGoogleAuthEnabled = false;
            }
            if (settingsDoc && settingsDoc.api_keys && settingsDoc.api_keys.RECAPTCHA_SITE_KEY) {
                siteKey = settingsDoc.api_keys.RECAPTCHA_SITE_KEY.trim();
            }
        }

        let html = fs.readFileSync(path.join(__dirname, 'auth', 'login.html'), 'utf8');

        // Dynamically inject the runtime setting flags
        html = html.replace('window.EMAIL_SERVICE_ENABLED = true;', `window.EMAIL_SERVICE_ENABLED = ${isEmailEnabled};`);
        html = html.replace('window.RECAPTCHA_ENABLED = true;', `window.RECAPTCHA_ENABLED = ${isRecaptchaEnabled};`);
        if (siteKey) {
            html = html.replace("window.RECAPTCHA_SITE_KEY = '6Ld6WQ8uAAAAAJCMsoqiP9mQUlL3m7ekeFPzXBzR';", `window.RECAPTCHA_SITE_KEY = ${JSON.stringify(siteKey)};`);
        }

        if (!isRecaptchaEnabled) {
            html = html.replace('id="login-recaptcha-wrapper" class="', 'id="login-recaptcha-wrapper" style="display:none;" class="hidden ');
            html = html.replace('id="reset-recaptcha-wrapper" class="', 'id="reset-recaptcha-wrapper" style="display:none;" class="hidden ');
        }

        if (!isGoogleAuthEnabled) {
            html = html.replace('id="google-login-btn"', 'id="google-login-btn" style="display:none;"');
            html = html.replace('id="google-or-divider"', 'id="google-or-divider" style="display:none;"');
        }

        return res.send(html);
    } catch (err) {
        res.sendFile(path.join(__dirname, 'auth', 'login.html'));
    }
});

app.get(['/auth/reset-password', '/auth/reset-password.html', '/reset-password'], (req, res) => {
    res.sendFile(path.join(__dirname, 'auth', 'reset-password.html'));
});

app.get(['/auth/accept-invitation', '/auth/accept-invitation.html', '/accept-invitation'], (req, res) => {
    res.sendFile(path.join(__dirname, 'auth', 'accept-invitation.html'));
});

// 404 for API endpoints
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

// Start Server
async function startServer() {
    try {
        await connectDB();
        const PRIMARY_PORT = parseInt(process.env.PORT, 10) || 8000;
        
        app.listen(PRIMARY_PORT, () => {
            console.log(`\n======================================================`);
            console.log(`🚀 BukSU JudgeTab RESTful API & Web Server Started`);
            console.log(`📡 URL: http://localhost:${PRIMARY_PORT}`);
            console.log(`⚡ REST API Base: http://localhost:${PRIMARY_PORT}/api/`);
            console.log(`📱 Mobile/Android Ready: Full CORS & JWT Token Support`);
            console.log(`======================================================\n`);
        });

        // Also listen on secondary port 5000 if running on 8000 (and vice-versa) for complete backward compatibility
        const SECONDARY_PORT = (PRIMARY_PORT === 8000) ? 5000 : (PRIMARY_PORT === 5000 ? 8000 : null);
        if (SECONDARY_PORT) {
            try {
                const secondary = app.listen(SECONDARY_PORT, () => {
                    console.log(`📡 Secondary Port Active: http://localhost:${SECONDARY_PORT}`);
                });
                secondary.on('error', (err) => {
                    if (err.code !== 'EADDRINUSE') {
                        console.warn(`[Server] Secondary port ${SECONDARY_PORT} notice:`, err.message);
                    }
                });
            } catch (e) {}
        }
    } catch (err) {
        console.error('Failed to start server:', err.message);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = app;
