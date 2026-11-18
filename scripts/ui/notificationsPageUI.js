/**
 * notificationsPageUI.js
 * Dedicated Notifications Page UI Controller
 */

import { fetchNotifications, respondToInvitation, markNotificationsRead, updateNotificationRead } from "./notificationAPI.js";
import { showToast, formatDateTime, escapeHtml } from "../utils/uiUtils.js";

let allNotifications = [];
let currentFilter = 'all';
let currentSearch = '';

document.addEventListener("DOMContentLoaded", () => {
    initNotificationsPage();
});

export function initNotificationsPage() {
    window.loadPageNotifications = loadPageNotifications;
    window.initNotificationsPage = initNotificationsPage;

    const markAllBtn = document.getElementById('page-mark-all-read-btn');
    const refreshBtn = document.getElementById('page-refresh-notifs-btn');
    const searchInput = document.getElementById('notif-search-input');
    const filterBtns = document.querySelectorAll('.page-notif-filter-btn');

    markAllBtn?.addEventListener('click', async () => {
        const res = await markNotificationsRead();
        if (res.success) {
            showToast("Notifications Marked Read", "All notifications have been marked as read.", "success");
            await loadPageNotifications();
        } else {
            showToast("Action Failed", res.message || "Failed to update notifications.", "error");
        }
    });

    refreshBtn?.addEventListener('click', async () => {
        await loadPageNotifications();
        showToast("Refreshed", "Notification list updated.", "info");
    });

    searchInput?.addEventListener('input', (e) => {
        currentSearch = (e.target.value || '').trim().toLowerCase();
        renderFilteredNotifications();
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter || 'all';
            filterBtns.forEach(b => {
                if (b === btn) {
                    b.className = 'page-notif-filter-btn px-3 py-1.5 text-xs font-bold rounded-xl bg-buksu-navy text-white shadow-xs transition-all cursor-pointer whitespace-nowrap';
                } else {
                    b.className = 'page-notif-filter-btn px-3 py-1.5 text-xs font-bold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-buksu-navy dark:hover:text-white transition-all cursor-pointer whitespace-nowrap';
                }
            });
            renderFilteredNotifications();
        });
    });

    loadPageNotifications();
    setInterval(loadPageNotifications, 15000);
}

export async function loadPageNotifications() {
    const container = document.getElementById('notifications-full-list');
    if (!container) return;

    const res = await fetchNotifications();
    if (!res.success || !res.notifications) {
        container.innerHTML = `
            <div class="py-12 text-center text-rose-500 bg-white rounded-3xl shadow-sm border border-rose-100 p-6">
                <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
                <p class="text-xs font-bold">${res.message || 'Failed to load notifications.'}</p>
            </div>
        `;
        return;
    }

    allNotifications = res.notifications || [];
    updateHeaderCounts(res.unread_count || 0);
    renderFilteredNotifications();
}

function updateHeaderCounts(unreadCount) {
    const unreadBadge = document.getElementById('page-notif-unread-badge');
    if (unreadBadge) {
        if (unreadCount > 0) {
            unreadBadge.textContent = `${unreadCount} Unread`;
            unreadBadge.classList.remove('hidden');
        } else {
            unreadBadge.classList.add('hidden');
        }
    }

    const countAll = allNotifications.length;
    const countUnread = allNotifications.filter(n => !n.is_read).length;
    const countInv = allNotifications.filter(n => n.type === 'event_invitation').length;
    const countSys = allNotifications.filter(n => n.type !== 'event_invitation').length;

    const elAll = document.getElementById('count-all');
    const elUnread = document.getElementById('count-unread');
    const elInv = document.getElementById('count-invitations');
    const elSys = document.getElementById('count-system');

    if (elAll) elAll.textContent = countAll;
    if (elUnread) elUnread.textContent = countUnread;
    if (elInv) elInv.textContent = countInv;
    if (elSys) elSys.textContent = countSys;
}

function renderFilteredNotifications() {
    const container = document.getElementById('notifications-full-list');
    if (!container) return;

    let filtered = allNotifications;

    if (currentFilter === 'unread') {
        filtered = filtered.filter(n => !n.is_read);
    } else if (currentFilter === 'invitations') {
        filtered = filtered.filter(n => n.type === 'event_invitation');
    } else if (currentFilter === 'system') {
        filtered = filtered.filter(n => n.type !== 'event_invitation');
    }

    if (currentSearch) {
        filtered = filtered.filter(n => 
            (n.title && n.title.toLowerCase().includes(currentSearch)) ||
            (n.message && n.message.toLowerCase().includes(currentSearch))
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="py-16 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-2">
                <i class="fa-solid fa-bell-slash text-3xl text-slate-300 dark:text-slate-600 mb-1"></i>
                <h4 class="font-extrabold text-sm text-slate-700 dark:text-slate-300">No notifications found</h4>
                <p class="text-xs text-slate-400">There are no notifications matching your current filters or search query.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(n => {
        const isUnread = !n.is_read;
        const isInvitation = n.type === 'event_invitation' && n.status === 'pending';

        let icon = 'fa-bell text-buksu-navy bg-slate-100 border-slate-200';
        if (n.type === 'event_invitation') icon = 'fa-envelope-open-text text-buksu-navy bg-amber-50 border-amber-200 text-amber-700';
        if (n.type === 'invitation_accepted') icon = 'fa-circle-check text-emerald-600 bg-emerald-50 border-emerald-200';
        if (n.type === 'invitation_declined') icon = 'fa-circle-xmark text-rose-600 bg-rose-50 border-rose-200';

        return `
            <div class="notif-card p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${isUnread ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 shadow-md ring-1 ring-buksu-navy/10' : 'bg-slate-50/70 dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400'}" data-id="${n.id}">
                <div class="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                    <div class="flex items-start gap-3.5 flex-1 min-w-0">
                        <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-base border shrink-0 ${icon}">
                            <i class="fa-solid ${icon.split(' ')[0]}"></i>
                        </div>
                        <div class="flex-1 min-w-0 space-y-1">
                            <div class="flex items-center gap-2 flex-wrap">
                                <h3 class="font-extrabold text-slate-800 dark:text-slate-100 text-sm leading-tight">${escapeHtml(n.title)}</h3>
                                ${isUnread ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-buksu-navy text-white uppercase">New</span>' : ''}
                                ${n.type === 'event_invitation' ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${n.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : n.status === 'declined' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'} uppercase">${n.status || 'pending'}</span>` : ''}
                            </div>
                            <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">${escapeHtml(n.message)}</p>
                            <div class="flex items-center gap-3 pt-1 text-[11px] text-slate-400 font-medium">
                                <span><i class="fa-regular fa-clock me-1"></i>${formatDateTime(n.created_at)}</span>
                            </div>

                            ${isInvitation ? `
                                <div class="pt-3 flex items-center gap-2">
                                    <button type="button" class="page-accept-inv-btn px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5" data-id="${n.id}">
                                        <i class="fa-solid fa-check"></i> Accept Invitation
                                    </button>
                                    <button type="button" class="page-decline-inv-btn px-4 py-2 bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-600 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5" data-id="${n.id}">
                                        <i class="fa-solid fa-xmark"></i> Decline
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="shrink-0 flex items-center gap-1.5 self-start sm:self-auto">
                        <button type="button" class="page-toggle-read-btn p-2 rounded-xl text-slate-400 hover:text-buksu-navy hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs cursor-pointer border border-transparent hover:border-slate-200" data-id="${n.id}" data-read="${n.is_read ? 'true' : 'false'}" title="${isUnread ? 'Mark as read' : 'Mark as unread'}">
                            <i class="fa-solid ${isUnread ? 'fa-envelope-open' : 'fa-envelope'}"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    bindPageActions();
}

function bindPageActions() {
    // Accept Invitation
    document.querySelectorAll('.page-accept-inv-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Accepting...';

            const res = await respondToInvitation(id, 'accept');
            if (res.success) {
                showToast("Invitation Accepted!", res.message || "You have accepted the event invitation.", "create");
                await loadPageNotifications();
            } else {
                showToast("Action Failed", res.message || "Failed to accept invitation.", "error");
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Accept Invitation';
            }
        });
    });

    // Decline Invitation
    document.querySelectorAll('.page-decline-inv-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Declining...';

            const res = await respondToInvitation(id, 'decline');
            if (res.success) {
                showToast("Invitation Declined", res.message || "You have declined the invitation.", "archive");
                await loadPageNotifications();
            } else {
                showToast("Action Failed", res.message || "Failed to decline invitation.", "error");
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Decline';
            }
        });
    });

    // Toggle Read / Unread
    document.querySelectorAll('.page-toggle-read-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const currentRead = btn.dataset.read === 'true';
            const targetRead = !currentRead;

            const res = await updateNotificationRead(id, targetRead);
            if (res.success) {
                const targetNotif = allNotifications.find(n => n.id === id);
                if (targetNotif) targetNotif.is_read = targetRead;
                const unreadTotal = allNotifications.filter(n => !n.is_read).length;
                updateHeaderCounts(unreadTotal);
                renderFilteredNotifications();
            } else {
                showToast("Action Failed", res.message || "Failed to update notification.", "error");
            }
        });
    });
}
