const { MongoClient, ServerApiVersion } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const uri = (process.env.MONGODB_URI || '').trim().replace(/^["']|["']$/g, '');
const dbName = (process.env.MONGODB_DATABASE || 'djs_db').trim().replace(/^["']|["']$/g, '');

if (!uri) {
    console.error('FATAL: MONGODB_URI is not set in environment or .env file');
}

let client = null;
let db = null;

const collections = {
    users: null,
    events: null,
    contestants: null,
    criteria: null,
    scores: null,
    score_versions: null,
    settings: null,
    logs: null,
    notifications: null,
    logo_library: null
};

async function connectDB() {
    if (db) return { db, collections };

    try {
        client = new MongoClient(uri, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: false,
                deprecationErrors: true
            },
            tlsAllowInvalidCertificates: true
        });

        await client.connect();
        db = client.db(dbName);

        collections.users = db.collection('users');
        collections.events = db.collection('events');
        collections.contestants = db.collection('contestants');
        collections.criteria = db.collection('criteria');
        collections.scores = db.collection('scores');
        collections.score_versions = db.collection('score_versions');
        collections.settings = db.collection('settings');
        collections.logs = db.collection('logs');
        collections.notifications = db.collection('notifications');
        collections.logo_library = db.collection('logo_library');

        console.log(`[Database] Connected successfully to MongoDB Atlas (${dbName})`);

        // Ensure audit logs index on timestamp for fast and reliable descending/ascending queries
        try {
            await collections.logs.createIndex({ timestamp: -1 });
            // Self-heal: normalize any legacy string timestamps into BSON Date objects
            await collections.logs.updateMany(
                { timestamp: { $type: 'string' } },
                [{ $set: { timestamp: { $toDate: '$timestamp' } } }]
            );
        } catch (idxErr) {
            console.warn('[Database] Log timestamp index/migration notice:', idxErr.message);
        }

        // Overlay api_keys from system_settings into process.env to persist across cloud restarts
        try {
            const settingsDoc = await collections.settings.findOne({ _id: 'system_settings' });
            if (settingsDoc && settingsDoc.api_keys && typeof settingsDoc.api_keys === 'object') {
                for (const [k, v] of Object.entries(settingsDoc.api_keys)) {
                    if (v !== null && v !== undefined && v !== '') {
                        process.env[k] = String(v);
                    }
                }
            }
        } catch (err) {
            console.warn('[Database] Could not overlay MongoDB API keys into process.env:', err.message);
        }

        return { db, collections };
    } catch (err) {
        console.error('[Database] MongoDB Connection Failed:', err.message);
        throw err;
    }
}

function getDB() {
    if (!db) {
        throw new Error('Database not initialized. Call connectDB() first.');
    }
    return { db, collections };
}

module.exports = {
    connectDB,
    getDB,
    collections
};

