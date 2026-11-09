/**
 * Helper utility functions for UI feedback, notice banners, and toast notifications.
 */

/**
 * Displays a formatted notice message banner.
 * @param {HTMLElement|string} noticeTarget - Element or element ID containing notice text
 * @param {string} message - Message text to display
 * @param {'error'|'success'|'info'|'warning'} [type='error'] - Notice type styling
 */
export function showNotice(noticeTarget, message, type = 'error') {
    const noticeText = typeof noticeTarget === 'string' ? document.getElementById(noticeTarget) : noticeTarget;
    if (!noticeText) return;

    const container = noticeText.parentElement;

    let icon = 'fa-triangle-exclamation';
    let colorClass = 'text-rose-600 bg-rose-50 border border-rose-200';

    if (type === 'success') {
        icon = 'fa-circle-check';
        colorClass = 'text-emerald-600 bg-emerald-50 border border-emerald-200';
    } else if (type === 'info') {
        icon = 'fa-spinner fa-spin';
        colorClass = 'text-buksu-navy bg-slate-100 border border-slate-200';
    } else if (type === 'warning') {
        icon = 'fa-circle-exclamation';
        colorClass = 'text-amber-600 bg-amber-50 border border-amber-200';
    }

    noticeText.innerHTML = `<i class="fa-solid ${icon} me-1.5"></i> ${message}`;
    if (container) {
        container.className = `text-center px-3 py-2 rounded-xl text-xs font-semibold ${colorClass} transition-all duration-200 block`;
    }
}

/**
 * Hides a notice message container.
 * @param {HTMLElement|string} noticeTarget - Element or element ID containing notice text
 */
export function hideNotice(noticeTarget) {
    const noticeText = typeof noticeTarget === 'string' ? document.getElementById(noticeTarget) : noticeTarget;
    if (noticeText && noticeText.parentElement) {
        noticeText.parentElement.classList.add('hidden');
        noticeText.parentElement.classList.remove('block');
    }
}

/**
 * Displays a sleek top-right toast notification.
 * @param {string} title - Title text of the notification
 * @param {string} message - Detailed message text
 * @param {'create'|'edit'|'archive'|'success'|'info'|'warning'|'error'} [type='success'] - Toast type
 * @param {number} [duration=4000] - Duration before auto-dismiss in ms
 */
export function showToast(title, message = '', type = 'success', duration = 4000) {
    if (['success', 'error', 'info', 'warning', 'create', 'edit', 'archive'].includes(message)) {
        type = message;
        message = '';
    }

    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 backdrop-blur-md transition-all duration-300 transform translate-x-full opacity-0`;

    let icon = 'fa-circle-check';
    let iconBg = 'bg-emerald-600 text-white';
    let borderColor = 'border-emerald-200 dark:border-emerald-800';

    if (type === 'create' || type === 'success') {
        icon = 'fa-circle-check';
        iconBg = 'bg-emerald-600 text-white';
        borderColor = 'border-emerald-200 dark:border-emerald-800';
    } else if (type === 'edit' || type === 'info') {
        icon = 'fa-pen-to-square';
        iconBg = 'bg-sky-600 text-white';
        borderColor = 'border-sky-200 dark:border-sky-800';
    } else if (type === 'archive' || type === 'warning') {
        icon = 'fa-circle-exclamation';
        iconBg = 'bg-amber-500 text-white';
        borderColor = 'border-amber-200 dark:border-amber-800';
    } else if (type === 'error') {
        icon = 'fa-triangle-exclamation';
        iconBg = 'bg-rose-600 text-white';
        borderColor = 'border-rose-200 dark:border-rose-800';
    }

    toast.classList.add(...borderColor.split(' '));

    toast.innerHTML = `
        <div class="w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center shrink-0 text-sm shadow-sm">
            <i class="fa-solid ${icon}"></i>
        </div>
        <div class="flex-1 min-w-0">
            <h4 class="font-extrabold text-slate-900 dark:text-slate-100 text-xs tracking-tight ${message ? 'mb-0.5' : ''}">${escapeHtml(title)}</h4>
            ${message ? `<p class="text-[11px] text-slate-600 dark:text-slate-300 font-normal leading-snug">${escapeHtml(message)}</p>` : ''}
        </div>
        <button type="button" class="toast-close-btn text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-sm cursor-pointer p-0.5">&times;</button>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
    });

    const closeToast = () => {
        toast.classList.remove('translate-x-0', 'opacity-100');
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('.toast-close-btn')?.addEventListener('click', closeToast);

    if (duration > 0) {
        setTimeout(closeToast, duration);
    }
}

export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Formats a date/time string, timestamp, or Date object into a readable localized format.
 * E.g., '2027-09-20T15:00:00.000Z' -> 'Sep 20, 2027, 11:00 PM'
 * or '2027-09-20' -> 'Sep 20, 2027'
 * @param {string|number|Date} dateVal - Input date or timestamp
 * @param {Object} [options={}] - Options (e.g. { fallback: 'TBA', dateOnly: false })
 * @returns {string} Formatted human-readable date
 */
export function formatDateTime(dateVal, options = {}) {
    if (!dateVal) return options.fallback || 'TBA';
    
    if (typeof dateVal === 'string') {
        const trimmed = dateVal.trim();
        if (!trimmed) return options.fallback || 'TBA';
        
        // Pure date: YYYY-MM-DD without time
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            const [y, m, d] = trimmed.split('-').map(Number);
            const dt = new Date(y, m - 1, d);
            if (!isNaN(dt.getTime())) {
                return dt.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
            }
        }
    }

    const d = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) {
        return String(dateVal);
    }

    if (options.dateOnly) {
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Formats a date into a value compatible with HTML5 <input type="datetime-local"> (YYYY-MM-DDTHH:mm).
 * @param {string|number|Date} dateVal 
 * @returns {string}
 */
export function toDateTimeLocalValue(dateVal) {
    if (!dateVal) return '';
    const d = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    
    const pad = n => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Human-readable mapping of audit action codes to clear, non-technical English phrases
 */
export const ACTION_MAPPINGS = {
    // Scoring & Judging
    'REQUEST_SCORE_UNLOCK': 'Requested a score unlock',
    'APPROVE_SCORE_UNLOCK': 'Approved score unlock',
    'REJECT_SCORE_UNLOCK': 'Rejected score unlock',
    'JUDGE_SELF_UNLOCK': 'Unlocked a score',
    'UNLOCK_SCORE': 'Unlocked a score',
    'SCORE_UNLOCKED': 'Unlocked a score',
    'LOCK_SCORE': 'Locked a score',
    'SUBMIT_SCORE': 'Submitted a score',
    'SAVE_DRAFT_SCORE': 'Saved draft score',
    'VERIFY_SCORE': 'Verified a score',
    'VERIFY_ALL_SCORES': 'Verified all scores',

    // Authentication & Access
    'LOGIN_LOCAL': 'Signed in',
    'LOGIN_GOOGLE': 'Signed in with Google',
    'LOGOUT': 'Signed out',
    'REQUEST_PASSWORD_RESET': 'Requested password reset',
    'PASSWORD_RESET': 'Reset password',
    'ACCEPT_INVITATION': 'Accepted invitation',
    'VERIFY_ADMIN_PIN': 'Verified Admin PIN',
    'RESET_ADMIN_PIN': 'Reset Admin PIN',

    // Competitions & Events
    'CREATE_EVENT': 'Created an event',
    'UPDATE_EVENT': 'Updated event details',
    'DELETE_EVENT': 'Deleted an event',
    'ARCHIVE_EVENT': 'Archived an event',
    'UNARCHIVE_EVENT': 'Restored an event',
    'ASSIGN_PERSONNEL': 'Assigned event personnel',
    'TOGGLE_JUDGING': 'Changed judging status',
    'ACCEPT_EVENT_INVITATION': 'Accepted event assignment',
    'DECLINE_EVENT_INVITATION': 'Declined event assignment',

    // Criteria & Rules
    'CREATE_CRITERION': 'Added a criterion',
    'UPDATE_CRITERION': 'Updated a criterion',
    'DELETE_CRITERION': 'Deleted a criterion',
    'UPDATE_CRITERIA_WEIGHTS': 'Updated criteria weights',

    // Contestants & Citations
    'CREATE_CONTESTANT': 'Added a contestant',
    'UPDATE_CONTESTANT': 'Updated contestant details',
    'DELETE_CONTESTANT': 'Removed a contestant',
    'ASSIGN_SPECIAL_AWARD': 'Awarded special citation',
    'REMOVE_SPECIAL_AWARD': 'Removed special citation',

    // User Accounts
    'CREATE_USER': 'Created user account',
    'UPDATE_USER': 'Updated user account',
    'DELETE_USER': 'Deleted user account',
    'UPDATE_ROLE': 'Changed user role',

    // System Settings & Maintenance
    'UPDATE_SETTINGS': 'Updated system settings',
    'UPDATE_API_KEYS': 'Updated environment credentials',
    'UPDATE_SECURITY_CONTROLS': 'Updated security controls',
    'EXPORT_BACKUP': 'Exported database backup',
    'CLEAR_LOGS': 'Cleared audit logs',
    'SELECT_LOGO_FROM_LIBRARY': 'Selected logo asset',
    'DELETE_LOGO_FROM_LIBRARY': 'Deleted logo asset',
    'UPLOAD_LOGO': 'Uploaded logo asset'
};

/**
 * Formats any raw action code or slug into natural, human-readable English
 * @param {string} action - Raw action identifier (e.g. 'unlock_score', 'REQUEST_SCORE_UNLOCK')
 * @returns {string} Human-friendly description (e.g. 'Unlocked a score')
 */
export function formatActionTerm(action) {
    if (!action || typeof action !== 'string') return 'Activity';
    const trimmed = action.trim();
    if (!trimmed) return 'Activity';

    // 1. Direct or normalized key match
    const normalizedKey = trimmed.toUpperCase().replace(/[\s-]+/g, '_');
    if (ACTION_MAPPINGS[normalizedKey]) {
        return ACTION_MAPPINGS[normalizedKey];
    }
    if (ACTION_MAPPINGS[trimmed]) {
        return ACTION_MAPPINGS[trimmed];
    }

    // 2. Intelligent dynamic fallback for unmapped or custom actions
    const words = trimmed
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_\-]+/g, ' ')
        .trim()
        .split(/\s+/);

    if (words.length === 0) return 'Activity';

    const verbMap = {
        unlock: 'Unlocked a',
        lock: 'Locked a',
        create: 'Created a',
        add: 'Added a',
        delete: 'Deleted',
        remove: 'Removed',
        update: 'Updated',
        edit: 'Updated',
        change: 'Changed',
        modify: 'Modified',
        submit: 'Submitted a',
        verify: 'Verified a',
        approve: 'Approved',
        reject: 'Rejected',
        request: 'Requested',
        assign: 'Assigned',
        accept: 'Accepted',
        decline: 'Declined',
        archive: 'Archived',
        restore: 'Restored',
        unarchive: 'Restored',
        export: 'Exported',
        import: 'Imported',
        clear: 'Cleared',
        reset: 'Reset',
        toggle: 'Toggled',
        upload: 'Uploaded',
        download: 'Downloaded'
    };

    const firstWordLower = words[0].toLowerCase();
    if (verbMap[firstWordLower]) {
        const rest = words.slice(1).join(' ');
        return (verbMap[firstWordLower] + (rest ? ' ' + rest : '')).replace(/\s+/g, ' ').trim();
    }

    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).replace(/_/g, ' ');
}
