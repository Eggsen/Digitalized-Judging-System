const cloudinary = require('cloudinary').v2;
const { collections } = require('../config/db');

function isCloudinaryConfigured() {
    const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
    const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
    const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
    return Boolean(cloudName && apiKey && apiSecret);
}

function initCloudinary() {
    if (!isCloudinaryConfigured()) return false;

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
        api_key: process.env.CLOUDINARY_API_KEY.trim(),
        api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
        secure: true
    });
    return true;
}

/**
 * Upload image buffer or base64 data to Cloudinary
 */
async function uploadToCloudinary(fileData, customFolder = null) {
    if (!initCloudinary()) {
        return { success: false, configured: false, message: 'Cloudinary credentials missing.' };
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
    uploadToCloudinary
};

