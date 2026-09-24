/**
 * Helper utility functions for UI feedback, notice banners, and notifications.
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
