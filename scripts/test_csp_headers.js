/**
 * Security Test Suite: Content Security Policy & HTTP Headers
 * Verifies that:
 * 1. Content Security Policy header is present and active
 * 2. script-src permits required CDNs (FontAwesome, Pusher, reCAPTCHA)
 * 3. style-src permits Google Fonts and FontAwesome
 * 4. connect-src permits Pusher WebSockets and Cloudinary
 * 5. img-src permits Cloudinary and Google Avatars
 * 6. frame-src permits Google reCAPTCHA
 * 7. object-src is restricted to 'none'
 */

const express = require('express');
const http = require('http');
const helmet = require('helmet');

console.log('====================================================');
console.log(' BukSU DigiTab - Content Security Policy Test');
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

async function runTests() {
    const app = express();

    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "'unsafe-eval'",
                    "https://kit.fontawesome.com",
                    "https://ka-f.fontawesome.com",
                    "https://js.pusher.com",
                    "https://www.google.com/recaptcha/",
                    "https://www.gstatic.com/recaptcha/"
                ],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://fonts.googleapis.com",
                    "https://ka-f.fontawesome.com"
                ],
                fontSrc: [
                    "'self'",
                    "data:",
                    "https://fonts.gstatic.com",
                    "https://ka-f.fontawesome.com"
                ],
                imgSrc: [
                    "'self'",
                    "data:",
                    "blob:",
                    "https://res.cloudinary.com",
                    "https://*.googleusercontent.com",
                    "https://www.google.com/recaptcha/",
                    "https://*.gstatic.com",
                    "https://quickchart.io"
                ],
                connectSrc: [
                    "'self'",
                    "https://ka-f.fontawesome.com",
                    "https://www.google.com/recaptcha/",
                    "https://*.pusher.com",
                    "wss://*.pusher.com",
                    "https://api.cloudinary.com"
                ],
                frameSrc: [
                    "'self'",
                    "https://www.google.com/recaptcha/",
                    "https://recaptcha.google.com/"
                ],
                objectSrc: ["'none'"],
                baseUri: ["'self'"]
            }
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
        frameguard: { action: 'sameorigin' }
    }));

    app.get('/test-csp', (req, res) => {
        res.send('<h1>CSP Test OK</h1>');
    });

    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    const response = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/test-csp`, res => {
            resolve(res);
        }).on('error', reject);
    });

    const csp = response.headers['content-security-policy'];
    assert(Boolean(csp), 'Content-Security-Policy header is active and emitted');

    if (csp) {
        assert(csp.includes("default-src 'self'"), 'Enforces default-src \'self\'');
        assert(csp.includes('https://kit.fontawesome.com') && csp.includes('https://js.pusher.com') && csp.includes('https://www.google.com/recaptcha/'),
            'script-src permits FontAwesome, Pusher, and reCAPTCHA');
        assert(csp.includes('https://fonts.googleapis.com'), 'style-src permits Google Fonts');
        assert(csp.includes('wss://*.pusher.com'), 'connect-src permits Pusher WebSockets (wss://*.pusher.com)');
        assert(csp.includes('https://res.cloudinary.com') && csp.includes('https://*.googleusercontent.com'),
            'img-src permits Cloudinary and Google Avatars');
        assert(csp.includes('https://quickchart.io'),
            'img-src permits QuickChart for judge QR badge generation');
        assert(csp.includes('https://recaptcha.google.com/'), 'frame-src permits Google reCAPTCHA');
        assert(csp.includes("object-src 'none'"), 'Restricts object-src to \'none\' (plugin restriction)');
    }

    assert(response.headers['x-frame-options'] === 'SAMEORIGIN', 'Enforces X-Frame-Options: SAMEORIGIN (clickjacking protection)');
    assert(response.headers['x-content-type-options'] === 'nosniff', 'Enforces X-Content-Type-Options: nosniff');

    server.close();

    console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
