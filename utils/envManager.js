const fs = require('fs');
const path = require('path');

const ALLOWED_ENV_KEYS = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'RECAPTCHA_SITE_KEY',
    'RECAPTCHA_SECRET_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'CLOUDINARY_FOLDER',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USERNAME',
    'SMTP_PASSWORD',
    'SMTP_FROM_EMAIL',
    'SMTP_FROM_NAME',
    'PUSHER_APP_ID',
    'PUSHER_KEY',
    'PUSHER_SECRET',
    'PUSHER_CLUSTER'
];

const PROTECTED_SYSTEM_KEYS = [
    'PORT', 'NODE_ENV', 'MONGODB_URI', 'JWT_SECRET', 'PATH', 'PWD', 'HOME', 'SHELL', 'TEMP', 'TMP'
];

const INTEGRATION_KEYS_MAP = {
    google: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'],
    recaptcha: ['RECAPTCHA_SITE_KEY', 'RECAPTCHA_SECRET_KEY'],
    cloudinary: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_FOLDER'],
    email: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'SMTP_FROM_EMAIL', 'SMTP_FROM_NAME'],
    websocket: ['PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET', 'PUSHER_CLUSTER']
};

function parseEnvString(content) {
    const result = {};
    if (!content || typeof content !== 'string') return result;
    const lines = content.split('\n');
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx !== -1) {
            const key = line.substring(0, eqIdx).trim();
            let val = line.substring(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            result[key] = val;
        }
    }
    return result;
}

function getDefaultIntegrationCredentials(targetService = null) {
    const defaultsPath = path.resolve(__dirname, '../.env.defaults');
    const backupPath = path.resolve(__dirname, '../.env.backup');

    let parsed = {};
    if (fs.existsSync(defaultsPath)) {
        try {
            parsed = parseEnvString(fs.readFileSync(defaultsPath, 'utf8'));
        } catch (e) {
            console.error('[EnvManager] Failed to read .env.defaults:', e.message);
        }
    } else if (fs.existsSync(backupPath)) {
        try {
            parsed = parseEnvString(fs.readFileSync(backupPath, 'utf8'));
        } catch (e) {}
    }

    const credentials = {};
    for (const [service, keys] of Object.entries(INTEGRATION_KEYS_MAP)) {
        credentials[service] = {};
        for (const key of keys) {
            if (parsed[key] !== undefined && parsed[key] !== '') {
                credentials[service][key] = parsed[key];
            } else if (process.env[key] !== undefined && process.env[key] !== '') {
                credentials[service][key] = process.env[key];
            } else {
                credentials[service][key] = '';
            }
        }
    }

    if (targetService) {
        return credentials[targetService] || null;
    }
    return credentials;
}

const DEFAULT_INTEGRATION_CREDENTIALS = new Proxy({}, {
    get(target, prop) {
        if (typeof prop === 'string') {
            const all = getDefaultIntegrationCredentials();
            return all[prop];
        }
        return Reflect.get(target, prop);
    },
    has(target, prop) {
        return Object.prototype.hasOwnProperty.call(INTEGRATION_KEYS_MAP, prop);
    },
    ownKeys(target) {
        return Object.keys(INTEGRATION_KEYS_MAP);
    },
    getOwnPropertyDescriptor(target, prop) {
        if (Object.prototype.hasOwnProperty.call(INTEGRATION_KEYS_MAP, prop)) {
            return {
                value: getDefaultIntegrationCredentials()[prop],
                writable: false,
                enumerable: true,
                configurable: true
            };
        }
        return undefined;
    }
});

function isValidCustomKeyName(name) {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim().toUpperCase();
    if (PROTECTED_SYSTEM_KEYS.includes(trimmed)) return false;
    if (ALLOWED_ENV_KEYS.includes(trimmed)) return false;
    return /^[A-Z][A-Z0-9_]{1,63}$/.test(trimmed);
}

function getEnvFilePath() {
    return path.resolve(__dirname, '../.env');
}

function getCustomApiKeys(settingsDoc = null) {
    const customKeys = {};
    if (settingsDoc && settingsDoc.custom_keys && typeof settingsDoc.custom_keys === 'object') {
        for (const [k, v] of Object.entries(settingsDoc.custom_keys)) {
            if (isValidCustomKeyName(k)) {
                customKeys[k.trim().toUpperCase()] = String(v || '');
            }
        }
    }
    return customKeys;
}

function getSystemApiKeys(settingsDoc = null) {
    const keys = {};
    for (const k of ALLOWED_ENV_KEYS) {
        keys[k] = '';
    }

    const envPath = getEnvFilePath();
    if (fs.existsSync(envPath)) {
        try {
            const content = fs.readFileSync(envPath, 'utf8');
            const lines = content.split('\n');
            for (let line of lines) {
                line = line.trim();
                if (!line || line.startsWith('#')) continue;
                const eqIdx = line.indexOf('=');
                if (eqIdx !== -1) {
                    const k = line.substring(0, eqIdx).trim();
                    let v = line.substring(eqIdx + 1).trim();
                    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                        v = v.substring(1, v.length - 1);
                    }
                    if (ALLOWED_ENV_KEYS.includes(k)) {
                        keys[k] = v;
                    }
                }
            }
        } catch (e) {
            console.warn('[EnvManager] Error reading .env file:', e.message);
        }
    }

    // Overlay process.env
    for (const k of ALLOWED_ENV_KEYS) {
        if (!keys[k] && process.env[k]) {
            keys[k] = process.env[k];
        }
    }

    // Overlay MongoDB saved values if provided
    if (settingsDoc && settingsDoc.api_keys && typeof settingsDoc.api_keys === 'object') {
        for (const k of ALLOWED_ENV_KEYS) {
            if (settingsDoc.api_keys[k] !== undefined && settingsDoc.api_keys[k] !== '') {
                keys[k] = String(settingsDoc.api_keys[k]);
            }
        }
    }

    return keys;
}

function formatEnvVal(val) {
    if (!val) return '';
    val = String(val);
    if (/[\s"\'#$=]/.test(val)) {
        return '"' + val.replace(/(["\\$`])/g, '\\$1') + '"';
    }
    return val;
}

function updateEnvFile(newValues, customValues = {}, removedKeys = []) {
    const envPath = getEnvFilePath();
    const validUpdates = {};

    for (const [k, v] of Object.entries(newValues || {})) {
        if (ALLOWED_ENV_KEYS.includes(k)) {
            validUpdates[k] = String(v || '').trim();
        }
    }

    if (customValues && typeof customValues === 'object') {
        for (const [k, v] of Object.entries(customValues)) {
            if (isValidCustomKeyName(k)) {
                validUpdates[k.trim().toUpperCase()] = String(v || '').trim();
            }
        }
    }

    const removedSet = new Set((removedKeys || []).map(k => String(k).trim().toUpperCase()));

    if (Object.keys(validUpdates).length === 0 && removedSet.size === 0) {
        return false;
    }

    let lines = [];
    if (fs.existsSync(envPath)) {
        try {
            lines = fs.readFileSync(envPath, 'utf8').split('\n');
        } catch (e) {
            lines = [];
        }
    }

    const updatedKeys = new Set();
    const newLines = [];

    for (let line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            newLines.push(line);
            continue;
        }

        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
            const k = trimmed.substring(0, eqIdx).trim();
            if (removedSet.has(k)) {
                delete process.env[k];
                continue;
            }
            if (validUpdates.hasOwnProperty(k)) {
                newLines.push(`${k}=${formatEnvVal(validUpdates[k])}`);
                updatedKeys.add(k);
                process.env[k] = validUpdates[k];
                continue;
            }
        }

        newLines.push(line);
    }

    // Append any keys that weren't in the file
    const missing = Object.keys(validUpdates).filter(k => !updatedKeys.has(k) && !removedSet.has(k));
    if (missing.length > 0) {
        newLines.push('');
        newLines.push('# Custom & Additional API Configuration (Admin Settings)');
        for (const k of missing) {
            newLines.push(`${k}=${formatEnvVal(validUpdates[k])}`);
            process.env[k] = validUpdates[k];
        }
    }

    try {
        fs.writeFileSync(envPath, newLines.join('\n').trim() + '\n', 'utf8');
        return true;
    } catch (err) {
        console.error('[EnvManager] Failed to write .env file:', err.message);
        return false;
    }
}

module.exports = {
    ALLOWED_ENV_KEYS,
    PROTECTED_SYSTEM_KEYS,
    DEFAULT_INTEGRATION_CREDENTIALS,
    getDefaultIntegrationCredentials,
    isValidCustomKeyName,
    getSystemApiKeys,
    getCustomApiKeys,
    updateEnvFile
};

