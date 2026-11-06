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
