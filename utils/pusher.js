const Pusher = require('pusher');
const { collections } = require('../config/db');

let pusherInstance = null;

function getPusher() {
    const appId = (process.env.PUSHER_APP_ID || '').trim();
    const key = (process.env.PUSHER_KEY || '').trim();
    const secret = (process.env.PUSHER_SECRET || '').trim();
    const cluster = (process.env.PUSHER_CLUSTER || 'ap1').trim();

    if (!appId || !key || !secret) {
        return null;
    }

    if (!pusherInstance) {
        pusherInstance = new Pusher({
            appId,
            key,
            secret,
            cluster,
            useTLS: true
        });
    }

    return pusherInstance;
}

/**
 * Trigger real-time Pusher event
 */
async function triggerPusherEvent(channel, event, data) {
    try {
        // Check if WebSockets are disabled in settings
        if (collections.settings) {
            const settings = await collections.settings.findOne({ _id: 'system_settings' });
            if (settings && settings.security && settings.security.websocketEnabled === false) {
                return { success: false, disabled: true };
            }
        }

        const pusher = getPusher();
        if (!pusher) {
            return { success: false, configured: false };
        }

        await pusher.trigger(channel, event, data);
        return { success: true };
    } catch (err) {
        console.warn(`[Pusher] Failed to trigger event ${event} on channel ${channel}:`, err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    triggerPusherEvent,
    getPusher
};

