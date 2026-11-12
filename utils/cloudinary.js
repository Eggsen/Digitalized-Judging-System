const cloudinary = require('cloudinary').v2;
const { collections } = require('../config/db');

async function isCloudinaryConfiguredAsync() {
    let cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
    let apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
    let apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();

    if ((!cloudName || !apiKey || !apiSecret) && collections.settings) {
        try {
            const settingsDoc = await collections.settings.findOne({ _id: 'system_settings' });
            if (settingsDoc?.api_keys) {
                cloudName = cloudName || (settingsDoc.api_keys.CLOUDINARY_CLOUD_NAME || '').trim();
                apiKey = apiKey || (settingsDoc.api_keys.CLOUDINARY_API_KEY || '').trim();
                apiSecret = apiSecret || (settingsDoc.api_keys.CLOUDINARY_API_SECRET || '').trim();
            }
        } catch (e) {}
    }

    return Boolean(cloudName && apiKey && apiSecret);
}

function isCloudinaryConfigured() {
    const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
    const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
    const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
    return Boolean(cloudName && apiKey && apiSecret);
}

async function initCloudinary() {
    let cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
    let apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
    let apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();

    if ((!cloudName || !apiKey || !apiSecret) && collections.settings) {
        try {
            const settingsDoc = await collections.settings.findOne({ _id: 'system_settings' });
            if (settingsDoc?.api_keys) {
                cloudName = cloudName || (settingsDoc.api_keys.CLOUDINARY_CLOUD_NAME || '').trim();
                apiKey = apiKey || (settingsDoc.api_keys.CLOUDINARY_API_KEY || '').trim();
                apiSecret = apiSecret || (settingsDoc.api_keys.CLOUDINARY_API_SECRET || '').trim();
            }
        } catch (e) {}
    }

    if (!cloudName || !apiKey || !apiSecret) return false;

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true
    });
    return true;
}

/**
 * Upload image buffer or base64 data to Cloudinary
 */
async function uploadToCloudinary(fileData, customFolder = null) {
    const configured = await initCloudinary();
    if (!configured) {
        return { success: false, configured: false, message: 'Cloudinary credentials missing or incomplete.' };
    }

    try {
        const folder = customFolder || (process.env.CLOUDINARY_FOLDER || 'djs_system_assets').trim();
        const result = await cloudinary.uploader.upload(fileData, {
            folder,
            resource_type: 'auto'
        });

        return {
            success: true,
            url: result.secure_url,
            public_id: result.public_id,
            format: result.format
        };
    } catch (err) {
        console.error('[Cloudinary] Upload error:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    isCloudinaryConfigured,
    isCloudinaryConfiguredAsync,
    uploadToCloudinary
};

