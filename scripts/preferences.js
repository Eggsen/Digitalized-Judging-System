/**
 * preferences.js
 * Manages User & Admin UI Preferences:
 * 1. Theme: Light Mode vs Dark Mode
 * 2. Color Palette Rule: Normal Mode vs 3-Color Rule Mode (BukSU Navy & Gold)
 * 3. Navigation Placement: Usual Placement (Top Tabs) vs Sidebar Mode (Vertical Left Sidebar)
 *
 * Each user account has an INDEPENDENT configured setting (scoped by user ID/account).
 * A change by one user (e.g. Tabulator) NEVER affects other users (e.g. Judge or Admin).
 * Persists locally per-user via localStorage and syncs with MongoDB Atlas.
 */

import { showToast } from "/scripts/utils/uiUtils.js";

export const PREF_DEFAULTS = {
    THEME: 'light',
    COLOR_RULE: 'normal',
    NAV_PLACEMENT: 'top'
};

/**
 * Derives a unique storage prefix for the currently active user account.
 * This guarantees complete appearance setting isolation between accounts.
 */
export function getUserStoragePrefix() {
    const userId = window.__CURRENT_USER_ID__ || document.body?.dataset.userId || '';
    if (userId) return `djs_user_${userId}_`;

    const username = window.__CURRENT_USERNAME__ || document.body?.dataset.username || '';
    if (username) return `djs_user_${username}_`;

    const role = window.__CURRENT_ROLE__ || document.body?.dataset.role || '';
    if (role) return `djs_role_${role}_`;

    return 'djs_user_default_';
}

function normalizeKeyName(key) {
    if (key === 'theme' || key === 'djs_theme') return 'theme';
    if (key === 'colorRule' || key === 'color_rule' || key === 'djs_color_rule') return 'color_rule';
    if (key === 'navPlacement' || key === 'nav_placement' || key === 'djs_nav_placement') return 'nav_placement';
    return key;
}

export function getPrefStorageKey(keyName) {
    return getUserStoragePrefix() + normalizeKeyName(keyName);
}

/**
 * Retrieve current user preferences from their own scoped localStorage
 */
export function getPreferences() {
    const p = getUserStoragePrefix();
    return {
        theme: localStorage.getItem(p + 'theme') || PREF_DEFAULTS.THEME,
        colorRule: localStorage.getItem(p + 'color_rule') || PREF_DEFAULTS.COLOR_RULE,
        navPlacement: localStorage.getItem(p + 'nav_placement') || PREF_DEFAULTS.NAV_PLACEMENT
    };
}

/**
 * Apply preference classes directly to document.documentElement
 */
export function applyPreferences(prefs = getPreferences()) {
    const root = document.documentElement;

    // 1. Theme (Dark / Light)
    if (prefs.theme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }

    // 2. Color Palette Rule (Normal / 3-Color Rule)
    if (prefs.colorRule === 'three-color') {
        root.classList.add('three-color-mode');
    } else {
        root.classList.remove('three-color-mode');
    }

    // 3. Navigation Placement (Top Tabs / Sidebar)
    if (prefs.navPlacement === 'sidebar') {
        root.classList.add('layout-sidebar');
    } else {
        root.classList.remove('layout-sidebar');
    }

    // Sync interactive card styles in the UI
    syncPreferencesUI(prefs);
}

/**
 * Update a specific preference key for the current user and re-apply
 */
export function setPreference(key, value, notify = true) {
    const cleanKey = normalizeKeyName(key);
    const storageKey = getPrefStorageKey(cleanKey);
    localStorage.setItem(storageKey, value);

    const prefs = getPreferences();
    applyPreferences(prefs);

    // Persist to user's MongoDB profile in background
    savePreferencesToServer(prefs);

    if (notify) {
        if (cleanKey === 'theme') {
            showToast("Appearance Updated", `Switched to ${value === 'dark' ? 'Dark' : 'Light'} Mode.`, "info");
        } else if (cleanKey === 'color_rule') {
            showToast("Color Scheme Updated", `Switched to ${value === 'three-color' ? '3-Color Rule Mode' : 'Normal Color Mode'}.`, "info");
        } else if (cleanKey === 'nav_placement') {
            showToast("Layout Updated", `Navigation moved to ${value === 'sidebar' ? 'Sidebar' : 'Top Tabs'}.`, "info");
        }
    }
}

/**
 * Reset current user's preferences to system defaults
 */
export function resetPreferences() {
    const p = getUserStoragePrefix();
    localStorage.removeItem(p + 'theme');
    localStorage.removeItem(p + 'color_rule');
    localStorage.removeItem(p + 'nav_placement');

    applyPreferences(PREF_DEFAULTS);
    savePreferencesToServer(PREF_DEFAULTS);
    showToast("Preferences Reset", "Display preferences restored to system defaults.", "success");
}

/**
 * Persist preferences to user's MongoDB account
 */
async function savePreferencesToServer(prefs) {
    try {
        await fetch('/backend/user/preferences.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                theme: prefs.theme,
                colorRule: prefs.colorRule,
                navPlacement: prefs.navPlacement
            })
        });
    } catch (err) {
        console.warn('Failed to sync preferences to server:', err);
    }
}

/**
 * Sync preferences from server if user has configured them previously
 */
export async function fetchUserPreferencesFromServer() {
    try {
        const res = await fetch('/backend/user/preferences.php');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.preferences) {
            const serverPrefs = data.preferences;
            const p = getUserStoragePrefix();

            const localTheme = localStorage.getItem(p + 'theme');
            const localColorRule = localStorage.getItem(p + 'color_rule');
            const localNavPlacement = localStorage.getItem(p + 'nav_placement');

            // If user has not yet customized locally on this browser, initialize with their database preferences
            if (!localTheme && serverPrefs.theme) localStorage.setItem(p + 'theme', serverPrefs.theme);
            if (!localColorRule && serverPrefs.colorRule) localStorage.setItem(p + 'color_rule', serverPrefs.colorRule);
            if (!localNavPlacement && serverPrefs.navPlacement) localStorage.setItem(p + 'nav_placement', serverPrefs.navPlacement);

            applyPreferences(getPreferences());
        }
    } catch (err) {
        console.warn('Failed to fetch user preferences from server:', err);
    }
}

/**
 * Sync the active states of all preference cards & toggle indicators in the DOM
 */
export function syncPreferencesUI(prefs = getPreferences()) {
    // Theme cards
    document.querySelectorAll('[data-pref-theme]').forEach(el => {
        const val = el.dataset.prefTheme;
        const isActive = val === prefs.theme;
        updateCardActiveState(el, isActive);
    });

    // Color rule cards
    document.querySelectorAll('[data-pref-color-rule]').forEach(el => {
        const val = el.dataset.prefColorRule;
        const isActive = val === prefs.colorRule;
        updateCardActiveState(el, isActive);
    });

    // Nav placement cards
    document.querySelectorAll('[data-pref-nav]').forEach(el => {
        const val = el.dataset.prefNav;
        const isActive = val === prefs.navPlacement;
        updateCardActiveState(el, isActive);
    });
}

function updateCardActiveState(cardEl, isActive) {
    const checkEl = cardEl.querySelector('.pref-check-indicator');
    const badgeEl = cardEl.querySelector('.pref-active-badge');

    if (isActive) {
        cardEl.classList.add('ring-2', 'ring-buksu-navy', 'border-buksu-navy', 'bg-white', 'shadow-sm', 'dark:ring-buksu-gold', 'dark:border-buksu-gold', 'dark:bg-slate-800');
        cardEl.classList.remove('border-slate-200', 'border-slate-300', 'dark:border-slate-700', 'bg-slate-50', 'bg-amber-50/20');
        if (checkEl) {
            checkEl.classList.remove('hidden');
            checkEl.classList.add('flex');
        }
        if (badgeEl) badgeEl.classList.remove('hidden');
    } else {
        cardEl.classList.remove('ring-2', 'ring-buksu-navy', 'border-buksu-navy', 'shadow-sm', 'dark:ring-buksu-gold', 'dark:border-buksu-gold', 'bg-amber-50/20');
        cardEl.classList.add('border-slate-200', 'dark:border-slate-700', 'bg-white', 'dark:bg-slate-800');
        if (checkEl) {
            checkEl.classList.add('hidden');
            checkEl.classList.remove('flex');
        }
        if (badgeEl) badgeEl.classList.add('hidden');
    }
}

/**
 * Initialize event listeners for preferences controls
 */
export function initPreferences() {
    // Clean up old shared global settings that caused cross-user leakage
    try {
        localStorage.removeItem('djs_theme');
        localStorage.removeItem('djs_color_rule');
        localStorage.removeItem('djs_nav_placement');
    } catch (_) {}

    // Apply immediately upon init
    applyPreferences();

    // Fetch user preferences from server
    fetchUserPreferencesFromServer();

    // Theme selector click bindings
    document.querySelectorAll('[data-pref-theme]').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const theme = card.dataset.prefTheme;
            setPreference('theme', theme);
        });
    });

    // Color rule click bindings
    document.querySelectorAll('[data-pref-color-rule]').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const rule = card.dataset.prefColorRule;
            setPreference('colorRule', rule);
        });
    });

    // Navigation placement click bindings
    document.querySelectorAll('[data-pref-nav]').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const placement = card.dataset.prefNav;
            setPreference('navPlacement', placement);
        });
    });

    // Reset buttons
    document.querySelectorAll('.reset-preferences-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            resetPreferences();
        });
    });

    // Header Quick Preferences button
    const openPrefBtn = document.getElementById('openPreferencesBtn');
    if (openPrefBtn) {
        openPrefBtn.addEventListener('click', async () => {
            const userRole = document.body.dataset.role || 'user';
            try {
                if (userRole === 'admin') {
                    const { switchAdminTab } = await import("/scripts/admin/eventsUI.js");
                    const { activateSettingsSubtab } = await import("/scripts/admin/settingsUI.js");
                    if (typeof switchAdminTab === 'function') switchAdminTab('settings-tab');
                    if (typeof activateSettingsSubtab === 'function') activateSettingsSubtab('settings-content-preferences');
                } else {
                    const { switchUserTab } = await import("/scripts/admin/eventsUI.js");
                    if (typeof switchUserTab === 'function') switchUserTab('user-preferences-tab');
                }
            } catch (err) {
                console.error("Failed to switch to preferences tab:", err);
            }

            setTimeout(() => {
                const target = document.getElementById('settings-content-preferences') || document.getElementById('user-preferences-tab');
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 120);
        });
    }
}

// Auto-initialize when document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPreferences);
} else {
    initPreferences();
}
