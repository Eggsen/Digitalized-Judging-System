import { fetchNotifications, respondToInvitation, markNotificationsRead, updateNotificationRead } from "./notificationAPI.js";
import { showToast, formatDateTime } from "../utils/uiUtils.js";
import { loadAdminEvents, loadUserAssignedEvents } from "../admin/eventsUI.js";

document.addEventListener("DOMContentLoaded", () => {
    initNotificationUI();
});

export function initNotificationUI() {
    const notifBtn = document.getElementById('notifBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    const markAllBtn = document.getElementById('markAllReadBtn');

    if (!notifBtn || !notifDropdown) return;

    // Toggle dropdown
    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown.classList.toggle('hidden');
        if (!notifDropdown.classList.contains('hidden')) {
            loadNotifications();
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
            notifDropdown.classList.add('hidden');
        }
    });

    // Mark all as read
    markAllBtn?.addEventListener('click', async () => {
        const res = await markNotificationsRead();
        if (res.success) {
            await loadNotifications();
        }
    });

    // Initial load & poll every 15 seconds
    loadNotifications();
    setInterval(loadNotifications, 15000);
}

export async function loadNotifications() {
    const badge = document.getElementById('notifBadge');
    const list = document.getElementById('notifList');
    if (!list) return;

    const res = await fetchNotifications();
    if (!res.success || !res.notifications) {
        list.innerHTML = '<div class="p-4 text-center text-rose-500 text-xs">Failed to load notifications.</div>';
        return;
    }

    const unreadCount = res.unread_count || 0;
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    if (res.notifications.length === 0) {
        list.innerHTML = `
            <div class="p-8 text-center text-slate-400">
                <i class="fa-solid fa-bell-slash text-2xl text-slate-300 mb-2"></i>
                <p class="text-xs font-semibold text-slate-600">No notifications</p>
                <p class="text-[11px] text-slate-400 mt-0.5">You're all caught up!</p>
            </div>
        `;
        return;
    }

    list.innerHTML = res.notifications.map(n => {
        const isUnread = !n.is_read;
        const isInvitation = n.type === 'event_invitation' && n.status === 'pending';

        let icon = 'fa-bell text-buksu-navy bg-slate-100 border-slate-200';
        if (n.type === 'event_invitation') icon = 'fa-envelope-open-text text-buksu-navy bg-slate-100 border-slate-200';
        if (n.type === 'invitation_accepted') icon = 'fa-circle-check text-emerald-600 bg-emerald-50 border-emerald-200';
        if (n.type === 'invitation_declined') icon = 'fa-circle-xmark text-rose-600 bg-rose-50 border-rose-200';

        return `
            <div class="notif-item p-3.5 hover:bg-slate-100/70 transition-colors flex items-start gap-3 cursor-pointer select-none relative ${isUnread ? 'bg-slate-50/90 font-medium' : 'bg-white text-slate-600'}" data-id="${n.id}" data-read="${n.is_read ? 'true' : 'false'}" title="${isUnread ? 'Click to mark as read' : 'Click to mark as unread'}">
                <span class="notif-dot w-2 h-2 rounded-full ${isUnread ? 'bg-buksu-navy' : 'bg-transparent'} shrink-0 mt-2 transition-all"></span>
                <div class="w-8 h-8 rounded-xl flex items-center justify-center text-sm border shrink-0 ${icon}">
                    <i class="fa-solid ${icon.split(' ')[0]}"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1 mb-0.5">
                        <h4 class="font-extrabold text-slate-800 text-xs truncate">${escapeHtml(n.title)}</h4>
                        <span class="text-[10px] text-slate-400 font-normal shrink-0">${formatDateTime(n.created_at)}</span>
                    </div>
                    <p class="text-[11px] leading-snug font-normal ${isUnread ? 'text-slate-800 font-medium' : 'text-slate-600'}">${escapeHtml(n.message)}</p>

                    ${isInvitation ? `
                        <div class="notif-invitation-actions mt-2.5 flex items-center gap-2">
                            <button type="button" class="accept-inv-btn px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1" data-id="${n.id}">
                                <i class="fa-solid fa-check"></i> Accept
                            </button>
                            <button type="button" class="decline-inv-btn px-3 py-1 bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-600 font-semibold text-[11px] rounded-lg transition-colors cursor-pointer flex items-center gap-1" data-id="${n.id}">
                                <i class="fa-solid fa-xmark"></i> Decline
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Bind click to toggle/update read status on notification click
    document.querySelectorAll('.notif-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            if (e.target.closest('button')) return;

            const notifId = item.dataset.id;
            const currentRead = item.dataset.read === 'true';
            const targetRead = !currentRead;

            // Optimistic UI update
            item.dataset.read = targetRead ? 'true' : 'false';
            item.title = targetRead ? 'Click to mark as unread' : 'Click to mark as read';
            const dot = item.querySelector('.notif-dot');
            const msgP = item.querySelector('p');

            if (targetRead) {
                dot?.classList.remove('bg-buksu-navy');
                dot?.classList.add('bg-transparent');
                item.classList.remove('bg-slate-50/90', 'font-medium');
                item.classList.add('bg-white', 'text-slate-600');
                msgP?.classList.remove('text-slate-800', 'font-medium');
                msgP?.classList.add('text-slate-600');
            } else {
                dot?.classList.add('bg-buksu-navy');
                dot?.classList.remove('bg-transparent');
                item.classList.add('bg-slate-50/90', 'font-medium');
                item.classList.remove('bg-white', 'text-slate-600');
                msgP?.classList.add('text-slate-800', 'font-medium');
                msgP?.classList.remove('text-slate-600');
            }

            // Update badge count
            const badge = document.getElementById('notifBadge');
            if (badge) {
                let count = parseInt(badge.textContent) || 0;
                count = targetRead ? Math.max(0, count - 1) : count + 1;
                badge.textContent = count > 9 ? '9+' : count;
                if (count > 0) badge.classList.remove('hidden');
                else badge.classList.add('hidden');
            }

            await updateNotificationRead(notifId, targetRead);
        });
    });

    // Bind invitation action buttons (accept / decline)
    document.querySelectorAll('.accept-inv-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const notifId = btn.dataset.id;
            const item = btn.closest('.notif-item');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Accepting...';

            const res = await respondToInvitation(notifId, 'accept');
            if (res.success) {
                // Automatically mark notification as read in UI
                if (item) {
                    item.dataset.read = 'true';
                    item.title = 'Click to mark as unread';
                    const dot = item.querySelector('.notif-dot');
                    dot?.classList.remove('bg-buksu-navy');
                    dot?.classList.add('bg-transparent');
                    item.classList.remove('bg-slate-50/90', 'font-medium');
                    item.classList.add('bg-white', 'text-slate-600');
                    const actionsDiv = btn.closest('.notif-invitation-actions') || btn.parentElement;
                    if (actionsDiv) {
                        actionsDiv.innerHTML = '<span class="px-2.5 py-1 rounded-lg text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1"><i class="fa-solid fa-check text-emerald-600"></i> Accepted</span>';
                    }
                }

                // Decrement badge count
                const badge = document.getElementById('notifBadge');
                if (badge) {
                    let count = Math.max(0, (parseInt(badge.textContent) || 1) - 1);
                    badge.textContent = count > 9 ? '9+' : count;
                    if (count > 0) badge.classList.remove('hidden');
                    else badge.classList.add('hidden');
                }

                showToast("Invitation Accepted!", res.message, "create");

                // Directly reload events view so the event displays immediately without a full page refresh
                const role = document.body.dataset.role;
                if (role === 'admin') {
                    if (typeof loadAdminEvents === 'function') await loadAdminEvents();
                } else if (role === 'judge' || role === 'tabulator') {
                    if (typeof loadUserAssignedEvents === 'function') await loadUserAssignedEvents();
                }
            } else {
                showToast("Action Failed", res.message, "error");
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Accept';
            }
        });
    });

    document.querySelectorAll('.decline-inv-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const notifId = btn.dataset.id;
            const item = btn.closest('.notif-item');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Declining...';

            const res = await respondToInvitation(notifId, 'decline');
            if (res.success) {
                // Automatically mark notification as read in UI
                if (item) {
                    item.dataset.read = 'true';
                    item.title = 'Click to mark as unread';
                    const dot = item.querySelector('.notif-dot');
                    dot?.classList.remove('bg-buksu-navy');
                    dot?.classList.add('bg-transparent');
                    item.classList.remove('bg-slate-50/90', 'font-medium');
                    item.classList.add('bg-white', 'text-slate-600');
                    const actionsDiv = btn.closest('.notif-invitation-actions') || btn.parentElement;
                    if (actionsDiv) {
                        actionsDiv.innerHTML = '<span class="px-2.5 py-1 rounded-lg text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1"><i class="fa-solid fa-xmark text-rose-600"></i> Declined</span>';
                    }
                }

                // Decrement badge count
                const badge = document.getElementById('notifBadge');
                if (badge) {
                    let count = Math.max(0, (parseInt(badge.textContent) || 1) - 1);
                    badge.textContent = count > 9 ? '9+' : count;
                    if (count > 0) badge.classList.remove('hidden');
                    else badge.classList.add('hidden');
                }

                showToast("Invitation Declined", res.message, "archive");

                // Directly reload events view
                const role = document.body.dataset.role;
                if (role === 'admin') {
                    if (typeof loadAdminEvents === 'function') await loadAdminEvents();
                } else if (role === 'judge' || role === 'tabulator') {
                    if (typeof loadUserAssignedEvents === 'function') await loadUserAssignedEvents();
                }
            } else {
                showToast("Action Failed", res.message, "error");
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Decline';
            }
        });
    });
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
