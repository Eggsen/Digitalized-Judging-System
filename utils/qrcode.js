const QRCode = require('qrcode');

/**
 * Generate a QR code as a base64 Data URL (PNG)
 */
async function generateQRCodeDataURL(text, options = {}) {
    try {
        const qrOptions = {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.92,
            margin: 2,
            color: {
                dark: '#0F2C59',
                light: '#FFFFFF'
            },
            width: 300,
            ...options
        };
        return await QRCode.toDataURL(text, qrOptions);
    } catch (err) {
        console.error('[QRCode] Generation error:', err.message);
        throw err;
    }
}

/**
 * Generate a QR code as an SVG string
 */
async function generateQRCodeSVG(text, options = {}) {
    try {
        const qrOptions = {
            errorCorrectionLevel: 'M',
            margin: 2,
            color: {
                dark: '#0F2C59',
                light: '#FFFFFF'
            },
            ...options
        };
        return await QRCode.toString(text, { type: 'svg', ...qrOptions });
    } catch (err) {
        console.error('[QRCode] SVG error:', err.message);
        throw err;
    }
}

module.exports = {
    generateQRCodeDataURL,
    generateQRCodeSVG
};

