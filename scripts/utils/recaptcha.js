/**
 * Helper to manage Google reCAPTCHA v2 widgets across multiple cards/forms.
 */

const widgetMap = {};
const renderingInProgress = {};

/**
 * Initialize / render the primary login widget if its container exists.
 */
export function initLoginRecaptcha() {
    if (document.getElementById('login-recaptcha')) {
        renderRecaptchaWidget('login-recaptcha');
    }
}

// Global hook for inline callback in login.php
window.__initLoginRecaptcha = initLoginRecaptcha;

// Global callback invoked by Google reCAPTCHA API script when ready
const previousOnload = window.onRecaptchaApiReady;
window.onRecaptchaApiReady = function () {
    window.__recaptchaApiLoaded = true;
    if (typeof previousOnload === 'function') {
        try {
            previousOnload();
        } catch (e) {
            console.warn("Previous onRecaptchaApiReady callback failed:", e);
        }
    }
    initLoginRecaptcha();
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
    if (widgetMap[containerId] !== undefined && container.children.length > 0) {
        return;
    }

    if (renderingInProgress[containerId]) {
        return;
    }

    if (!window.grecaptcha || typeof window.grecaptcha.render !== 'function') {
        // If API is not yet loaded, queue retry shortly
        setTimeout(() => renderRecaptchaWidget(containerId), 150);
        return;
    }

    try {
        renderingInProgress[containerId] = true;
        // Ensure container is empty before rendering to avoid duplicate widget errors
        if (container.children.length === 0) {
            const widgetId = window.grecaptcha.render(containerId, {
                sitekey: siteKey,
                theme: 'light'
            });
            widgetMap[containerId] = widgetId;
        }
    } catch (err) {
        console.error(`reCAPTCHA render error for container "${containerId}":`, err);
    } finally {
        delete renderingInProgress[containerId];
    }
}

/**
 * Get response token for a container.
 * @param {string} containerId 
 * @returns {string} Response token, or empty string if not checked
 */
export function getRecaptchaResponse(containerId) {
    if (!window.grecaptcha) {
        return "";
    }
    if (widgetMap[containerId] !== undefined) {
        try {
            return window.grecaptcha.getResponse(widgetMap[containerId]) || "";
        } catch (err) {
            return "";
        }
    }
    // Fallback if widgetMap entry is missing: try default widget response
    try {
        return window.grecaptcha.getResponse() || "";
    } catch (err) {
        return "";
    }
}

/**
 * Reset a reCAPTCHA widget after a failed submission.
 * @param {string} containerId 
 */
export function resetRecaptchaWidget(containerId) {
    if (!window.grecaptcha) {
        return;
    }
    try {
        if (widgetMap[containerId] !== undefined) {
            window.grecaptcha.reset(widgetMap[containerId]);
        } else {
            window.grecaptcha.reset();
        }
    } catch (err) {
        console.warn(`reCAPTCHA reset failed for "${containerId}":`, err);
    }
}

// Auto-trigger rendering immediately or as soon as DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initLoginRecaptcha();
    });
} else {
    initLoginRecaptcha();
}

