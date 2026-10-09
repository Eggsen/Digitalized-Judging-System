import { listEvents, createEvent, editEvent, assignJudges, archiveEvent, listLogs } from "./eventsAPI.js";
import { listAccounts } from "./adminAPI.js";
import { showToast } from "../utils/uiUtils.js";

const userRole = document.body.dataset.role;
let cachedEventsList = [];

document.addEventListener("DOMContentLoaded", () => {
    if (userRole === 'admin') {
        initAdminTabs();
        initAdminEventActions();
        loadAdminEvents();
        loadAuditLogs();
    } else if (userRole === 'judge' || userRole === 'tabulator') {
        initCommonModalEvents();
        loadUserAssignedEvents();
        document.getElementById('refreshUserEventsBtn')?.addEventListener('click', loadUserAssignedEvents);
    }
});

/* -------------------------------------------------------------
 * ADMIN TABS & NAVIGATION
 * ------------------------------------------------------------- */
function initAdminTabs() {
    const tabBtns = document.querySelectorAll('.admin-tab-btn');
    const tabContents = document.querySelectorAll('.admin-tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            tabBtns.forEach(b => {
                b.className = 'admin-tab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-100 transition-all cursor-pointer';
            });
            btn.className = 'admin-tab-btn px-4 py-2 text-xs font-bold rounded-xl bg-buksu-navy text-white transition-all cursor-pointer';

            tabContents.forEach(c => c.classList.add('hidden'));
            const activeContent = document.getElementById(targetTab);
            if (activeContent) {
                activeContent.classList.remove('hidden');
                activeContent.classList.add('animate-fade-in');
            }

            if (targetTab === 'events-tab') loadAdminEvents();
            if (targetTab === 'assignments-tab') loadJudgeAssignments();
            if (targetTab === 'logs-tab') loadAuditLogs();
        });
    });

    document.getElementById('event-status-filter')?.addEventListener('change', loadAdminEvents);
    document.getElementById('refreshEventsBtn')?.addEventListener('click', loadAdminEvents);
    document.getElementById('refreshLogsBtn')?.addEventListener('click', loadAuditLogs);
}

/* -------------------------------------------------------------
 * RENDER ADMIN EVENTS & COMPETITIONS
 * ------------------------------------------------------------- */
export async function loadAdminEvents() {
    const grid = document.getElementById('admin-events-grid');
    if (!grid) return;

    const filterVal = document.getElementById('event-status-filter')?.value || 'ALL';

    grid.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400">
            <i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
            <p class="text-xs font-semibold">Loading competitions...</p>
        </div>
    `;

    const res = await listEvents();
    if (!res.success || !res.events) {
        grid.innerHTML = `<div class="col-span-full py-8 text-center text-rose-500 text-xs font-semibold">${res.message || 'Failed to load competitions.'}</div>`;
        return;
    }

    cachedEventsList = res.events;
    let events = res.events;
    if (filterVal !== 'ALL') {
        events = events.filter(e => e.status === filterVal);
    }

    if (events.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                <i class="fa-solid fa-trophy text-3xl text-slate-300 mb-2"></i>
                <p class="text-xs font-bold text-slate-600">No competitions found</p>
                <p class="text-[11px] text-slate-400 mt-1">Create a new competition to get started.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = events.map(e => `
        <div class="event-card bg-slate-50 hover:bg-white border border-slate-200/80 hover:border-indigo-300 rounded-2xl p-5 hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer group" data-id="${e.id}">
            <div>
                <div class="flex items-center justify-between gap-2 mb-2">
                    <span class="px-2.5 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wide ${getStatusStyle(e.status)}">${e.status}</span>
                    <span class="px-2.5 py-1 text-[10px] font-bold bg-slate-200/70 text-slate-700 rounded-lg">${e.type}</span>
                </div>
                <h3 class="font-extrabold text-buksu-navy text-sm mb-1 group-hover:text-indigo-600 transition-colors">${escapeHtml(e.eventName)}</h3>
                <p class="text-xs text-slate-500 font-normal line-clamp-2 mb-3">${escapeHtml(e.description || 'No description provided.')}</p>

                <div class="space-y-1.5 text-xs text-slate-600 border-t border-slate-200/60 pt-3">
                    <div class="flex items-center gap-2 text-[11px]">
                        <i class="fa-regular fa-clock text-buksu-navy w-4"></i>
                        <span>${e.date || 'TBA'}</span>
                    </div>
                    <div class="flex items-center gap-2 text-[11px]">
                        <i class="fa-solid fa-location-dot text-buksu-navy w-4"></i>
                        <span>${escapeHtml(e.venue || 'TBA')}</span>
                    </div>
                    <div class="flex items-center gap-2 text-[11px]">
                        <i class="fa-solid fa-gavel text-buksu-navy w-4"></i>
                        <span>Judges: ${e.assignedjudges && e.assignedjudges.length > 0 ? e.assignedjudges.map(j => escapeHtml(j.username)).join(', ') : '<span class="text-slate-400">None assigned</span>'}</span>
                    </div>
                    <div class="flex items-center gap-2 text-[11px]">
                        <i class="fa-solid fa-calculator text-buksu-navy w-4"></i>
                        <span>Tabulators: ${e.tabulators && e.tabulators.length > 0 ? e.tabulators.map(t => escapeHtml(t.username)).join(', ') : '<span class="text-slate-400">None assigned</span>'}</span>
                    </div>
                </div>
            </div>

            <div class="mt-5 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-1.5">
                <button class="open-assign-btn px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-xl text-[11px] cursor-pointer transition-colors" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}">
                    <i class="fa-solid fa-user-plus me-1"></i> Assign
                </button>
                <div class="flex items-center gap-1">
                    <button class="open-edit-btn px-2.5 py-1.5 bg-slate-200/60 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] cursor-pointer transition-colors" 
                        data-id="${e.id}" 
                        data-name="${escapeHtml(e.eventName)}" 
                        data-type="${escapeHtml(e.type)}" 
                        data-desc="${escapeHtml(e.description)}" 
                        data-venue="${escapeHtml(e.venue)}" 
                        data-rawdate="${e.rawDate}" 
                        data-status="${e.status}" 
                        data-judging="${e.judgingStatus}">
                        <i class="fa-solid fa-pen text-buksu-navy me-1"></i> Edit
                    </button>
                    ${e.status !== 'Archived' ? `
                        <button class="archive-btn px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-[11px] cursor-pointer transition-colors" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}">
                            <i class="fa-solid fa-box-archive me-1"></i> Archive
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');

    bindEventCardActions();
}

/* -------------------------------------------------------------
 * JUDGE & TABULATOR ASSIGNMENTS VIEW
 * ------------------------------------------------------------- */
async function loadJudgeAssignments() {
    const container = document.getElementById('assignments-container');
    if (!container) return;

    container.innerHTML = `<div class="py-8 text-center text-slate-400 text-xs"><i class="fa-solid fa-spinner fa-spin me-1.5"></i> Loading assignments...</div>`;

    const res = await listEvents();
    if (!res.success || !res.events) {
        container.innerHTML = `<div class="py-6 text-center text-rose-500 text-xs">${res.message}</div>`;
        return;
    }

    if (res.events.length === 0) {
        container.innerHTML = `<div class="py-8 text-center text-slate-400 text-xs">No competitions created yet.</div>`;
        return;
    }

    container.innerHTML = res.events.map(e => `
        <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between flex-wrap gap-4">
            <div>
                <h4 class="font-extrabold text-slate-800 text-sm">${escapeHtml(e.eventName)}</h4>
                <p class="text-xs text-slate-500 mt-0.5">${e.type} &bull; ${e.date || 'TBA'} &bull; ${escapeHtml(e.venue || 'TBA')}</p>
                <div class="flex items-center gap-4 mt-2 text-xs">
                    <span class="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        <i class="fa-solid fa-gavel text-buksu-navy me-1"></i> ${e.assignedjudges ? e.assignedjudges.length : 0} Judges Assigned
                    </span>
                    <span class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <i class="fa-solid fa-calculator text-buksu-navy me-1"></i> ${e.tabulators ? e.tabulators.length : 0} Tabulators Assigned
                    </span>
                </div>
            </div>
            <button class="open-assign-btn px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow transition-colors" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}">
                <i class="fa-solid fa-users-gear me-1.5"></i> Manage Assignments
            </button>
        </div>
    `).join('');

    document.querySelectorAll('#assignments-container .open-assign-btn').forEach(btn => {
        btn.addEventListener('click', () => openAssignModal(btn.dataset.id, btn.dataset.name));
    });
}

/* -------------------------------------------------------------
 * SYSTEM AUDIT LOGS VIEW
 * ------------------------------------------------------------- */
async function loadAuditLogs() {
    const tbody = document.getElementById('logs-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin me-1.5"></i> Loading audit logs...</td></tr>`;

    const res = await listLogs();
    if (!res.success || !res.logs) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-rose-500 text-xs">${res.message || 'Failed to fetch logs.'}</td></tr>`;
        return;
    }

    if (res.logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-slate-400 text-xs">No audit logs recorded yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = res.logs.map(log => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
            <td class="px-4 py-3 font-mono text-[11px] text-slate-500 align-middle whitespace-nowrap">${log.timestamp}</td>
            <td class="px-4 py-3 font-semibold text-slate-800 align-middle">
                ${escapeHtml(log.username)}
                <span class="ms-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200/70 text-slate-600">${escapeHtml(log.role)}</span>
            </td>
            <td class="px-4 py-3 text-center align-middle">
                <span class="px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">${escapeHtml(log.action)}</span>
            </td>
            <td class="px-4 py-3 text-slate-700 align-middle font-normal">${escapeHtml(log.details)}</td>
        </tr>
    `).join('');
}

/* -------------------------------------------------------------
 * JUDGE / TABULATOR ASSIGNED EVENTS VIEW
 * ------------------------------------------------------------- */
async function loadUserAssignedEvents() {
    const grid = document.getElementById('user-assigned-events-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400">
            <i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
            <p class="text-xs font-semibold">Loading your assigned competitions...</p>
        </div>
    `;

    const res = await listEvents();
    if (!res.success || !res.events) {
        grid.innerHTML = `<div class="col-span-full py-8 text-center text-rose-500 text-xs">${res.message}</div>`;
        return;
    }

    cachedEventsList = res.events;

    if (res.events.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                <i class="fa-solid fa-clipboard-check text-3xl text-slate-300 mb-2"></i>
                <p class="text-xs font-bold text-slate-600">No assigned competitions yet</p>
                <p class="text-[11px] text-slate-400 mt-1">You will see your assigned competitions here once designated by an administrator.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = res.events.map(e => `
        <div class="event-card bg-slate-50 hover:bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-5 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer group" data-id="${e.id}">
            <div>
                <div class="flex items-center justify-between gap-2 mb-2">
                    <span class="px-2.5 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wide ${getStatusStyle(e.status)}">${e.status}</span>
                    <span class="px-2.5 py-1 text-[10px] font-bold bg-slate-200/70 text-slate-700 rounded-lg">${e.type}</span>
                </div>
                <h3 class="font-extrabold text-buksu-navy text-sm mb-1 group-hover:text-indigo-600 transition-colors">${escapeHtml(e.eventName)}</h3>
                <p class="text-xs text-slate-500 font-normal line-clamp-2 mb-3">${escapeHtml(e.description || 'No description provided.')}</p>

                <div class="space-y-1.5 text-xs text-slate-600 border-t border-slate-200/60 pt-3">
                    <div class="flex items-center gap-2 text-[11px]">
                        <i class="fa-regular fa-clock text-buksu-navy w-4"></i>
                        <span>${e.date || 'TBA'}</span>
                    </div>
                    <div class="flex items-center gap-2 text-[11px]">
                        <i class="fa-solid fa-location-dot text-buksu-navy w-4"></i>
                        <span>${escapeHtml(e.venue || 'TBA')}</span>
                    </div>
                    <div class="flex items-center gap-2 text-[11px]">
                        <i class="fa-solid fa-tasks text-buksu-navy w-4"></i>
                        <span>Judging State: <strong class="text-slate-800">${escapeHtml(e.judgingStatus || 'Not Yet Started')}</strong></span>
                    </div>
                </div>
            </div>

            <div class="mt-5 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span class="font-medium">Assigned to Portal</span>
                <span class="font-bold text-buksu-navy flex items-center gap-1"><i class="fa-solid fa-circle-check text-buksu-navy"></i> Active</span>
            </div>
        </div>
    `).join('');

    bindUserEventCardActions();

}

/* -------------------------------------------------------------
 * ACTION BINDINGS & MODALS
 * ------------------------------------------------------------- */
function initAdminEventActions() {
    initCommonModalEvents();

    // Open Create Modal
    document.getElementById('open-create-event-modal-btn')?.addEventListener('click', () => {
        document.getElementById('create-event-modal')?.classList.remove('hidden');
    });

    // Submit Create Event
    document.getElementById('createEventForm')?.addEventListener('submit', async () => {
        const eventName = document.getElementById('ev-name').value.trim();
        const type = document.getElementById('ev-type').value.trim();
        const venue = document.getElementById('ev-venue').value.trim();
        const date = document.getElementById('ev-date').value;
        const description = document.getElementById('ev-desc').value.trim();

        if (!eventName || !type || !venue || !date) {
            alert('Please fill in Event Name, Type, Venue, and Date.');
            return;
        }

        const res = await createEvent({ eventName, type, venue, date, description });
        if (res.success) {
            document.getElementById('create-event-modal')?.classList.add('hidden');
            document.getElementById('ev-name').value = '';
            document.getElementById('ev-type').value = '';
            document.getElementById('ev-venue').value = '';
            document.getElementById('ev-date').value = '';
            document.getElementById('ev-desc').value = '';

            showToast("Competition Created!", `New event "${eventName}" has been added successfully.`, "create");
            await loadAdminEvents();
        } else {
            showToast("Creation Failed", res.message || "Failed to create competition.", "error");
        }
    });

    // Submit Edit Event
    document.getElementById('editEventForm')?.addEventListener('submit', async () => {
        const id = document.getElementById('edit-ev-id').value;
        const eventName = document.getElementById('edit-ev-name').value.trim();
        const type = document.getElementById('edit-ev-type').value.trim();
        const venue = document.getElementById('edit-ev-venue').value.trim();
        const status = document.getElementById('edit-ev-status').value;
        const judgingStatus = document.getElementById('edit-ev-judging-status').value;
        const date = document.getElementById('edit-ev-date').value;
        const description = document.getElementById('edit-ev-desc').value.trim();

        const res = await editEvent({ id, eventName, type, venue, status, judgingStatus, date, description });
        if (res.success) {
            document.getElementById('edit-event-modal')?.classList.add('hidden');
            showToast("Competition Updated!", `Details for "${eventName}" have been updated.`, "edit");
            await loadAdminEvents();
        } else {
            showToast("Update Failed", res.message || "Failed to update event.", "error");
        }
    });

    // Submit Manage Assignments
    document.getElementById('assignEventForm')?.addEventListener('submit', async () => {
        const id = document.getElementById('assign-ev-id').value;
        const assignedjudges = Array.from(document.querySelectorAll('.judge-checkbox:checked')).map(cb => cb.value);
        const tabulators = Array.from(document.querySelectorAll('.tabulator-checkbox:checked')).map(cb => cb.value);

        const res = await assignJudges({ id, assignedjudges, tabulators });
        if (res.success) {
            document.getElementById('assign-event-modal')?.classList.add('hidden');
            showToast("Assignments Saved!", `Judges and Tabulators allocated successfully.`, "edit");
            await loadAdminEvents();
        } else {
            showToast("Assignment Failed", res.message || "Failed to update assignments.", "error");
        }
    });
}

function initCommonModalEvents() {
    // Close Modals
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#create-event-modal, #edit-event-modal, #assign-event-modal, #view-event-modal').forEach(m => m.classList.add('hidden'));
        });
    });

    // Close on backdrop click
    document.querySelectorAll('#create-event-modal, #edit-event-modal, #assign-event-modal, #view-event-modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    });
}

function bindEventCardActions() {
    // Card Click -> View Details Modal
    document.querySelectorAll('#admin-events-grid .event-card').forEach(card => {
        card.addEventListener('click', () => openViewEventModal(card.dataset.id));
    });

    // Open Assign Modal
    document.querySelectorAll('.open-assign-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openAssignModal(btn.dataset.id, btn.dataset.name);
        });
    });

    // Open Edit Modal
    document.querySelectorAll('.open-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('edit-ev-id').value = btn.dataset.id;
            document.getElementById('edit-ev-name').value = btn.dataset.name;
            document.getElementById('edit-ev-type').value = btn.dataset.type;
            document.getElementById('edit-ev-venue').value = btn.dataset.venue;
            document.getElementById('edit-ev-status').value = btn.dataset.status;
            document.getElementById('edit-ev-judging-status').value = btn.dataset.judging;
            document.getElementById('edit-ev-date').value = btn.dataset.rawdate;
            document.getElementById('edit-ev-desc').value = btn.dataset.desc;

            document.getElementById('edit-event-modal')?.classList.remove('hidden');
        });
    });

    // Archive Event
    document.querySelectorAll('.archive-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const eventName = btn.dataset.name;
            if (confirm(`Are you sure you want to archive competition "${eventName}"?`)) {
                const res = await archiveEvent({ id: btn.dataset.id });
                if (res.success) {
                    showToast("Competition Archived!", `Competition "${eventName}" has been archived.`, "archive");
                    await loadAdminEvents();
                } else {
                    showToast("Archive Failed", res.message || "Failed to archive event.", "error");
                }
            }
        });
    });
}

function bindUserEventCardActions() {
    document.querySelectorAll('#user-assigned-events-grid .event-card').forEach(card => {
        card.addEventListener('click', () => openViewEventModal(card.dataset.id));
    });
}

export function openViewEventModal(eventId) {
    const modal = document.getElementById('view-event-modal');
    if (!modal) return;

    const event = cachedEventsList.find(e => String(e.id) === String(eventId));
    if (!event) return;

    // Set Title, Type, Status Badges
    document.getElementById('view-ev-title').textContent = event.eventName || 'Unnamed Event';
    document.getElementById('view-ev-type-badge').textContent = event.type || 'General';
    
    const statusBadge = document.getElementById('view-ev-status-badge');
    statusBadge.textContent = event.status || 'Upcoming';
    statusBadge.className = `px-2.5 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wide ${getStatusStyle(event.status)}`;

    // Set Details
    document.getElementById('view-ev-date').textContent = event.date || 'TBA';
    document.getElementById('view-ev-venue').textContent = event.venue || 'TBA';
    document.getElementById('view-ev-judging-status').textContent = event.judgingStatus || 'Not Yet Started';
    document.getElementById('view-ev-desc').textContent = event.description && event.description.trim() ? event.description : 'No description provided.';

    // Populate Judges List
    const judgesBox = document.getElementById('view-ev-judges-list');
    if (event.assignedjudges && event.assignedjudges.length > 0) {
        judgesBox.innerHTML = event.assignedjudges.map(j => {
            const st = j.invitation_status || 'accepted';
            let stBadge = '<span class="px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-emerald-100 text-emerald-700 uppercase shrink-0">Accepted</span>';
            if (st === 'pending') stBadge = '<span class="px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-100 text-amber-700 uppercase shrink-0 animate-pulse">Pending</span>';
            if (st === 'declined') stBadge = '<span class="px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-rose-100 text-rose-700 uppercase shrink-0">Declined</span>';

            return `
                <div class="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                    <div class="flex items-center gap-2.5 overflow-hidden">
                        <div class="w-6 h-6 rounded-lg bg-indigo-100 text-buksu-navy flex items-center justify-center text-xs font-bold shrink-0">
                            <i class="fa-solid fa-gavel"></i>
                        </div>
                        <div class="overflow-hidden">
                            <span class="font-extrabold text-slate-800 block leading-tight truncate">${escapeHtml(j.username)}</span>
                            <span class="text-[10px] text-slate-500 font-normal block truncate">${escapeHtml(j.email || 'No email')}</span>
                        </div>
                    </div>
                    ${stBadge}
                </div>
            `;
        }).join('');
    } else {
        judgesBox.innerHTML = '<span class="text-slate-400 text-xs italic">No judges assigned yet.</span>';
    }

    // Populate Tabulators List
    const tabBox = document.getElementById('view-ev-tabulators-list');
    if (event.tabulators && event.tabulators.length > 0) {
        tabBox.innerHTML = event.tabulators.map(t => {
            const st = t.invitation_status || 'accepted';
            let stBadge = '<span class="px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-emerald-100 text-emerald-700 uppercase shrink-0">Accepted</span>';
            if (st === 'pending') stBadge = '<span class="px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-100 text-amber-700 uppercase shrink-0 animate-pulse">Pending</span>';
            if (st === 'declined') stBadge = '<span class="px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-rose-100 text-rose-700 uppercase shrink-0">Declined</span>';

            return `
                <div class="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                    <div class="flex items-center gap-2.5 overflow-hidden">
                        <div class="w-6 h-6 rounded-lg bg-emerald-100 text-buksu-navy flex items-center justify-center text-xs font-bold shrink-0">
                            <i class="fa-solid fa-calculator"></i>
                        </div>
                        <div class="overflow-hidden">
                            <span class="font-extrabold text-slate-800 block leading-tight truncate">${escapeHtml(t.username)}</span>
                            <span class="text-[10px] text-slate-500 font-normal block truncate">${escapeHtml(t.email || 'No email')}</span>
                        </div>
                    </div>
                    ${stBadge}
                </div>
            `;
        }).join('');
    } else {
        tabBox.innerHTML = '<span class="text-slate-400 text-xs italic">No tabulators assigned yet.</span>';
    }

    // Show modal
    modal.classList.remove('hidden');
}

async function openAssignModal(eventId, eventName) {
    const modal = document.getElementById('assign-event-modal');
    if (!modal) return;

    document.getElementById('assign-ev-id').value = eventId;
    document.getElementById('assign-ev-title').textContent = `Competition: ${eventName}`;

    const judgeBox = document.getElementById('assign-judges-checkboxes');
    const tabBox = document.getElementById('assign-tabulators-checkboxes');

    judgeBox.innerHTML = '<span class="text-slate-400">Loading accounts...</span>';
    tabBox.innerHTML = '<span class="text-slate-400">Loading accounts...</span>';

    modal.classList.remove('hidden');

    const [accRes, evRes] = await Promise.all([listAccounts(), listEvents()]);
    const currentEvent = evRes.events ? evRes.events.find(e => String(e.id) === String(eventId)) : null;

    const currentJudgeIds = currentEvent && currentEvent.assignedjudges ? currentEvent.assignedjudges.map(j => String(j.id)) : [];
    const currentTabIds = currentEvent && currentEvent.tabulators ? currentEvent.tabulators.map(t => String(t.id)) : [];

    const judges = accRes.accounts ? accRes.accounts.filter(a => a.role === 'judge') : [];
    const tabulators = accRes.accounts ? accRes.accounts.filter(a => a.role === 'tabulator') : [];

    if (judges.length === 0) {
        judgeBox.innerHTML = '<span class="text-slate-400 italic">No judges found. Invite a judge first.</span>';
    } else {
        judgeBox.innerHTML = judges.map(j => `
            <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input type="checkbox" value="${j.id}" class="judge-checkbox accent-indigo-600 rounded" ${currentJudgeIds.includes(String(j.id)) ? 'checked' : ''}>
                <span>${escapeHtml(j.username)} (${escapeHtml(j.email || 'No email')})</span>
            </label>
        `).join('');
    }

    if (tabulators.length === 0) {
        tabBox.innerHTML = '<span class="text-slate-400 italic">No tabulators found. Invite a tabulator first.</span>';
    } else {
        tabBox.innerHTML = tabulators.map(t => `
            <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                <input type="checkbox" value="${t.id}" class="tabulator-checkbox accent-indigo-600 rounded" ${currentTabIds.includes(String(t.id)) ? 'checked' : ''}>
                <span>${escapeHtml(t.username)} (${escapeHtml(t.email || 'No email')})</span>
            </label>
        `).join('');
    }
}

function getStatusStyle(status) {
    if (status === 'Upcoming') return 'bg-amber-100 text-amber-800';
    if (status === 'Ongoing') return 'bg-emerald-100 text-emerald-800';
    if (status === 'Completed') return 'bg-indigo-100 text-indigo-800';
    if (status === 'Archived') return 'bg-slate-200 text-slate-700';
    return 'bg-slate-100 text-slate-700';
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
