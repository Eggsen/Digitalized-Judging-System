/**
 * Helper to manage Google reCAPTCHA v2 widgets across multiple cards/forms.
 */

const widgetMap = {};
let isScriptReady = false;

// Global callback invoked by Google reCAPTCHA API script when ready
window.onRecaptchaApiReady = function () {
    isScriptReady = true;
    // Automatically render the primary login widget if its container exists
    if (document.getElementById('login-recaptcha')) {
        renderRecaptchaWidget('login-recaptcha');
    }
};

/**
 * Render reCAPTCHA widget into a specific container element.
 * Safe to call multiple times; will not re-render if already initialized.
 * @param {string} containerId 
 */
export function renderRecaptchaWidget(containerId) {
    if (window.RECAPTCHA_ENABLED === false) {
        return;
    }
    const siteKey = window.RECAPTCHA_SITE_KEY;
    if (!siteKey) {
        return;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    // Check if widget for this container has already been rendered
    if (widgetMap[containerId] !== undefined) {
        return;
    }

    if (!window.grecaptcha || typeof window.grecaptcha.render !== 'function') {
        // If API is not yet loaded, queue render shortly
        setTimeout(() => renderRecaptchaWidget(containerId), 250);
        return;
    }

    try {
        const widgetId = window.grecaptcha.render(containerId, {
            sitekey: siteKey,
            theme: 'light'
        });
        widgetMap[containerId] = widgetId;
    } catch (err) {
        console.error(`reCAPTCHA render error for container "${containerId}":`, err);
    }
}

/**
 * Get response token for a container.
 * @param {string} containerId 
 * @returns {string} Response token, or empty string if not checked
 */
export function getRecaptchaResponse(containerId) {
    if (!window.grecaptcha || widgetMap[containerId] === undefined) {
        return "";
    }
    try {
        return window.grecaptcha.getResponse(widgetMap[containerId]) || "";
    } catch (err) {
        return "";
    }
}

/**
 * Reset a reCAPTCHA widget after a failed submission.
 * @param {string} containerId 
 */
export function resetRecaptchaWidget(containerId) {
    if (!window.grecaptcha || widgetMap[containerId] === undefined) {
        return;
    }
    try {
        window.grecaptcha.reset(widgetMap[containerId]);
    } catch (err) {
        console.warn(`reCAPTCHA reset failed for "${containerId}":`, err);
    }
}
