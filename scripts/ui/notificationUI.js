import { fetchNotifications, respondToInvitation, markNotificationsRead } from "./notificationAPI.js";
import { showToast } from "../utils/uiUtils.js";
import { loadAdminEvents } from "../admin/eventsUI.js";

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

        let icon = 'fa-bell text-indigo-500 bg-indigo-50 border-indigo-100';
        if (n.type === 'event_invitation') icon = 'fa-envelope-open-text text-amber-600 bg-amber-50 border-amber-200';
        if (n.type === 'invitation_accepted') icon = 'fa-circle-check text-emerald-600 bg-emerald-50 border-emerald-200';
        if (n.type === 'invitation_declined') icon = 'fa-circle-xmark text-rose-600 bg-rose-50 border-rose-200';

        return `
            <div class="p-3.5 hover:bg-slate-50 transition-colors flex items-start gap-3 ${isUnread ? 'bg-indigo-50/30' : ''}">
                <div class="w-8 h-8 rounded-xl flex items-center justify-center text-sm border shrink-0 ${icon}">
                    <i class="fa-solid ${icon.split(' ')[0]}"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1 mb-0.5">
                        <h4 class="font-extrabold text-slate-800 text-xs truncate">${escapeHtml(n.title)}</h4>
                        <span class="text-[10px] text-slate-400 font-normal shrink-0">${n.created_at}</span>
                    </div>
                    <p class="text-[11px] text-slate-600 leading-snug font-normal">${escapeHtml(n.message)}</p>

                    ${isInvitation ? `
                        <div class="mt-2.5 flex items-center gap-2">
                            <button class="accept-inv-btn px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1" data-id="${n.id}">
                                <i class="fa-solid fa-check"></i> Accept
                            </button>
                            <button class="decline-inv-btn px-3 py-1 bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-600 font-semibold text-[11px] rounded-lg transition-colors cursor-pointer flex items-center gap-1" data-id="${n.id}">
                                <i class="fa-solid fa-xmark"></i> Decline
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Bind invitation action buttons
    document.querySelectorAll('.accept-inv-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Accepting...';

            const res = await respondToInvitation(btn.dataset.id, 'accept');
            if (res.success) {
                showToast("Invitation Accepted!", res.message, "create");
                await loadNotifications();
                window.location.reload();
            } else {
                showToast("Action Failed", res.message, "error");
                btn.disabled = false;
            }
        });
    });

    document.querySelectorAll('.decline-inv-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Declining...';

            const res = await respondToInvitation(btn.dataset.id, 'decline');
            if (res.success) {
                showToast("Invitation Declined", res.message, "archive");
                await loadNotifications();
                window.location.reload();
            } else {
                showToast("Action Failed", res.message, "error");
                btn.disabled = false;
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
