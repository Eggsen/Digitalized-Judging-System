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
export function showToast(title, message, type = 'success', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl border bg-white/95 backdrop-blur-md transition-all duration-300 transform translate-x-full opacity-0`;

    let icon = 'fa-circle-check';
    let iconBg = 'bg-emerald-600 text-white';
    let borderColor = 'border-emerald-200';

    if (type === 'create' || type === 'success') {
        icon = 'fa-trophy';
        iconBg = 'bg-indigo-600 text-buksu-gold';
        borderColor = 'border-indigo-200';
    } else if (type === 'edit' || type === 'info') {
        icon = 'fa-pen-to-square';
        iconBg = 'bg-sky-600 text-white';
        borderColor = 'border-sky-200';
    } else if (type === 'archive' || type === 'warning') {
        icon = 'fa-box-archive';
        iconBg = 'bg-amber-500 text-white';
        borderColor = 'border-amber-200';
    } else if (type === 'error') {
        icon = 'fa-circle-exclamation';
        iconBg = 'bg-rose-600 text-white';
        borderColor = 'border-rose-200';
    }

    toast.classList.add(borderColor);

    toast.innerHTML = `
        <div class="w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center shrink-0 text-sm shadow-sm">
            <i class="fa-solid ${icon}"></i>
        </div>
        <div class="flex-1 min-w-0">
            <h4 class="font-extrabold text-buksu-navy text-xs tracking-tight mb-0.5">${escapeHtml(title)}</h4>
            <p class="text-[11px] text-slate-500 font-normal leading-snug">${escapeHtml(message)}</p>
        </div>
        <button type="button" class="toast-close-btn text-slate-400 hover:text-slate-600 transition-colors text-sm cursor-pointer p-0.5">&times;</button>
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

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
