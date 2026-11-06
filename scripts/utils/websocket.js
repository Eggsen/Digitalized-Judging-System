/**
 * Real-Time WebSocket Client Utility (Pusher Channels / Soketi)
 * 
 * Provides instantaneous event synchronization for:
 * - Tabulation Board live scoring matrix
 * - Judge real-time score unlock alerts
 * - Judging period state changes (Started / Finished)
 * 
 * Gracefully falls back to polling when unconfigured, disabled, or offline.
 */

let pusherInstance = null;
let activeChannels = new Map(); // eventId -> channel
let cachedConfig = null;
let currentStatus = 'uninitialized'; // 'connected' | 'connecting' | 'disconnected' | 'unavailable' | 'disabled' | 'unconfigured'
let statusListeners = new Set();

/**
 * Register a listener for WebSocket connection status changes
 */
export function onWebSocketStatusChange(fn) {
    if (typeof fn === 'function') {
        statusListeners.add(fn);
        fn(currentStatus);
    }
    return () => statusListeners.delete(fn);
}

function updateStatus(newStatus) {
    if (currentStatus !== newStatus) {
        currentStatus = newStatus;
        statusListeners.forEach(fn => {
            try { fn(newStatus); } catch (e) { console.error(e); }
        });
    }
}

export function getWebSocketStatus() {
    return currentStatus;
}

/**
 * Fetch public WebSocket configuration from server
 */
export async function getWebSocketConfig() {
    if (cachedConfig) return cachedConfig;
    try {
        const res = await fetch('/api/settings/websocket-config', {
            credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        cachedConfig = data;
        return data;
    } catch (e) {
        console.warn('Failed to fetch WebSocket config, falling back to polling:', e.message);
        return { enabled: false, is_configured: false };
    }
}

/**
 * Initialize Pusher client singleton
 */
export async function initWebSocket() {
    if (pusherInstance) return pusherInstance;

    // Check if Pusher CDN script is loaded
    if (typeof window.Pusher === 'undefined') {
        console.warn('Pusher library not loaded. Real-time WebSocket sync unavailable; relying on fallback polling.');
        updateStatus('unavailable');
        return null;
    }

    const config = await getWebSocketConfig();
    if (!config || !config.enabled) {
        updateStatus('disabled');
        return null;
    }

    if (!config.is_configured || !config.key) {
        updateStatus('unconfigured');
        return null;
    }

    try {
        const pusherOptions = {
            cluster: config.cluster || 'ap1',
            forceTLS: config.scheme === 'https'
        };

        if (config.host) {
            pusherOptions.wsHost = config.host;
            pusherOptions.httpHost = config.host;
            pusherOptions.wsPort = config.port || 80;
            pusherOptions.wssPort = config.port || 443;
            pusherOptions.enabledTransports = ['ws', 'wss'];
        }

        updateStatus('connecting');
        pusherInstance = new window.Pusher(config.key, pusherOptions);

        pusherInstance.connection.bind('connected', () => {
            console.log('⚡ [WebSocket] Connected to real-time pub/sub stream.');
            updateStatus('connected');
        });

        pusherInstance.connection.bind('connecting', () => {
            updateStatus('connecting');
        });

        pusherInstance.connection.bind('disconnected', () => {
            updateStatus('disconnected');
        });

        pusherInstance.connection.bind('unavailable', () => {
            console.warn('⚡ [WebSocket] Service unavailable; switching to fallback polling.');
            updateStatus('unavailable');
        });

        pusherInstance.connection.bind('failed', () => {
            console.warn('⚡ [WebSocket] Connection failed.');
            updateStatus('unavailable');
        });

        return pusherInstance;
    } catch (e) {
        console.error('Failed to initialize Pusher instance:', e);
        updateStatus('unavailable');
        return null;
    }
}

/**
 * Subscribe to an event's real-time channel
 * 
 * @param {number|string} eventId 
 * @param {object} callbacks { onScoreUpdated, onScoreUnlocked, onJudgingStatusChanged, onStructureChanged }
 * @returns {object|null} channel
 */
export async function subscribeToEventChannel(eventId, callbacks = {}) {
    const pusher = await initWebSocket();
    if (!pusher) return null;

    const channelName = `event-${eventId}`;

    let channel = activeChannels.get(eventId);
    if (!channel) {
        channel = pusher.subscribe(channelName);
        activeChannels.set(eventId, channel);
    }

    // Bind event handlers
    if (typeof callbacks.onScoreUpdated === 'function') {
        channel.bind('score-updated', (data) => {
            try {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                callbacks.onScoreUpdated(payload);
            } catch (e) {
                callbacks.onScoreUpdated(data);
            }
        });
    }

    if (typeof callbacks.onScoreUnlocked === 'function') {
        channel.bind('score-unlocked', (data) => {
            try {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                callbacks.onScoreUnlocked(payload);
            } catch (e) {
                callbacks.onScoreUnlocked(data);
            }
        });
    }

    if (typeof callbacks.onScoreVerified === 'function') {
        channel.bind('score-verified', (data) => {
            try {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                callbacks.onScoreVerified(payload);
            } catch (e) {
                callbacks.onScoreVerified(data);
            }
        });
    }

    if (typeof callbacks.onJudgingStatusChanged === 'function') {
        channel.bind('judging-status-changed', (data) => {
            try {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                callbacks.onJudgingStatusChanged(payload);
            } catch (e) {
                callbacks.onJudgingStatusChanged(data);
            }
        });
    }

    if (typeof callbacks.onStructureChanged === 'function') {
        channel.bind('event-structure-changed', (data) => {
            try {
                const payload = typeof data === 'string' ? JSON.parse(data) : data;
                callbacks.onStructureChanged(payload);
            } catch (e) {
                callbacks.onStructureChanged(data);
            }
        });
    }

    return channel;
}

/**
 * Unsubscribe from an event's real-time channel
 * 
 * @param {number|string} eventId 
 */
export function unsubscribeFromEventChannel(eventId) {
    if (!pusherInstance) return;
    const channelName = `event-${eventId}`;
    try {
        pusherInstance.unsubscribe(channelName);
        activeChannels.delete(eventId);
    } catch (e) {
        console.error('Error unsubscribing from channel:', e);
    }
}

