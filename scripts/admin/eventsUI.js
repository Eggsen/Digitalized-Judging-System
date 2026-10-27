import { listEvents, createEvent, editEvent, assignJudges, archiveEvent, deleteArchivedEvent, listLogs } from "./eventsAPI.js";
import { listAccounts } from "./adminAPI.js";
import { showToast } from "../utils/uiUtils.js";
import { openManageSetupModal, initContestantsCriteriaUI } from "./contestantsCriteriaUI.js";
import { openJudgeScoringModal, initJudgeUI } from "../judge/judgeUI.js";
import { openTabulationBoardModal, initTabulatorUI } from "../tabulator/tabulatorUI.js";
import { toggleJudgingPeriod } from "./judgingAPI.js";
import { loadSystemSettings } from "./settingsUI.js";

const userRole = document.body.dataset.role;
let cachedEventsList = [];

document.addEventListener("DOMContentLoaded", () => {
    initCommonModalEvents();

    if (userRole === 'admin') {
        initAdminTabs();
        initAdminEventActions();
        initContestantsCriteriaUI();
        initJudgeUI();
        initTabulatorUI();
        loadAdminEvents();
        loadAuditLogs();
    } else if (userRole === 'judge') {
        initJudgeUI();
        initUserTabs();
        loadUserAssignedEvents();
        document.getElementById('refreshUserEventsBtn')?.addEventListener('click', loadUserAssignedEvents);
    } else if (userRole === 'tabulator') {
        initTabulatorUI();
        initUserTabs();
        loadUserAssignedEvents();
        document.getElementById('refreshUserEventsBtn')?.addEventListener('click', loadUserAssignedEvents);
    }
});

/* -------------------------------------------------------------
 * ADMIN TABS & NAVIGATION (SIDEBAR + TOP BAR SYNC)
 * ------------------------------------------------------------- */
export function switchAdminTab(targetTab) {
    const tabBtns = document.querySelectorAll('.admin-tab-btn, .sidebar-nav-btn[data-tab]:not([data-tab^="user-"])');
    const tabContents = document.querySelectorAll('.admin-tab-content');

    tabBtns.forEach(b => {
        const isMatch = b.dataset.tab === targetTab;
        const icon = b.querySelector('i');
        if (b.classList.contains('sidebar-nav-btn')) {
            if (isMatch) {
                b.className = 'sidebar-nav-btn w-full px-4 py-3 text-xs font-bold rounded-2xl bg-buksu-navy text-white shadow-md transition-all cursor-pointer flex items-center gap-3 border border-buksu-gold/30';
            } else {
                b.className = 'sidebar-nav-btn w-full px-4 py-3 text-xs font-bold rounded-2xl text-slate-600 hover:text-buksu-navy hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-3 border border-transparent';
            }
        } else {
            if (isMatch) {
                b.className = 'admin-tab-btn px-4 py-2 text-xs font-bold rounded-xl bg-buksu-navy text-white shadow-xs transition-all cursor-pointer';
            } else {
                b.className = 'admin-tab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-white hover:text-buksu-navy transition-all cursor-pointer';
            }
        }
        if (icon) {
            if (isMatch) {
                icon.classList.remove('text-slate-400', 'text-slate-500', 'text-indigo-500', 'text-emerald-500', 'text-amber-500');
                icon.classList.add('text-buksu-gold');
            } else {
                icon.classList.remove('text-buksu-gold', 'text-indigo-500', 'text-emerald-500', 'text-amber-500');
                icon.classList.add('text-slate-400');
            }
        }
    });

    tabContents.forEach(c => c.classList.add('hidden'));
    const activeContent = document.getElementById(targetTab);
    if (activeContent) {
        activeContent.classList.remove('hidden');
        activeContent.classList.add('animate-fade-in');
    }

    if (targetTab === 'events-tab') loadAdminEvents();
    if (targetTab === 'assignments-tab') loadJudgeAssignments();
    if (targetTab === 'logs-tab') loadAuditLogs();
    if (targetTab === 'settings-tab') loadSystemSettings();
}

function initAdminTabs() {
    const tabBtns = document.querySelectorAll('.admin-tab-btn, .sidebar-nav-btn[data-tab]:not([data-tab^="user-"])');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            if (targetTab) switchAdminTab(targetTab);
        });
    });

    document.getElementById('event-status-filter')?.addEventListener('change', loadAdminEvents);
    document.getElementById('refreshEventsBtn')?.addEventListener('click', loadAdminEvents);
    document.getElementById('refreshLogsBtn')?.addEventListener('click', loadAuditLogs);
}

/* -------------------------------------------------------------
 * JUDGE / TABULATOR USER TABS & NAVIGATION (SIDEBAR + TOP BAR SYNC)
 * ------------------------------------------------------------- */
export function switchUserTab(targetTab) {
    const userTabBtns = document.querySelectorAll('.user-tab-btn, .sidebar-nav-btn[data-tab^="user-"]');
    const userTabContents = document.querySelectorAll('.user-tab-content');

    userTabBtns.forEach(b => {
        const isMatch = b.dataset.tab === targetTab;
        const icon = b.querySelector('i');
        if (b.classList.contains('sidebar-nav-btn')) {
            if (isMatch) {
                b.className = 'sidebar-nav-btn w-full px-4 py-3 text-xs font-bold rounded-2xl bg-buksu-navy text-white shadow-md transition-all cursor-pointer flex items-center gap-3 border border-buksu-gold/30';
            } else {
                b.className = 'sidebar-nav-btn w-full px-4 py-3 text-xs font-bold rounded-2xl text-slate-600 hover:text-buksu-navy hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-3 border border-transparent';
            }
        } else {
            if (isMatch) {
                b.className = 'user-tab-btn px-4 py-2 text-xs font-bold rounded-xl bg-buksu-navy text-white shadow-xs transition-all cursor-pointer';
            } else {
                b.className = 'user-tab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-white hover:text-buksu-navy transition-all cursor-pointer';
            }
        }
        if (icon) {
            if (isMatch) {
                icon.classList.remove('text-slate-400', 'text-slate-500', 'text-indigo-500', 'text-emerald-500', 'text-amber-500');
                icon.classList.add('text-buksu-gold');
            } else {
                icon.classList.remove('text-buksu-gold', 'text-indigo-500', 'text-emerald-500', 'text-amber-500');
                icon.classList.add('text-slate-400');
            }
        }
    });

    userTabContents.forEach(c => c.classList.add('hidden'));
    const activeContent = document.getElementById(targetTab);
    if (activeContent) {
        activeContent.classList.remove('hidden');
        activeContent.classList.add('animate-fade-in');
    }

    if (targetTab === 'user-events-tab') loadUserAssignedEvents();
}

function initUserTabs() {
    const userTabBtns = document.querySelectorAll('.user-tab-btn, .sidebar-nav-btn[data-tab^="user-"]');

    userTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            if (targetTab) switchUserTab(targetTab);
        });
    });
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

    // Prioritize Ongoing events first
    events = sortEventsByPriority(events);

    if (events.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                <i class="fa-solid fa-trophy text-3xl text-slate-300 mb-2"></i>
                <p class="text-xs font-bold text-slate-600">No competitions found</p>
                <p class="text-[11px] text-slate-400 mt-1">Create a new competition or adjust your status filter.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = events.map(e => {
        const isOngoing = (e.status === 'Ongoing' || e.judgingStatus === 'In Progress');
        const isStopped = (e.judgingStatus === 'Finished' || e.status === 'Completed');
        const canArchive = (!isOngoing || isStopped);

        let judgingBadge = '';
        if (e.judgingStatus === 'In Progress') {
            judgingBadge = '<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 animate-pulse"><i class="fa-solid fa-play text-[8px]"></i> Judging Active</span>';
        } else if (e.judgingStatus === 'Finished') {
            judgingBadge = '<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-800 border border-slate-300">Judging Finished</span>';
        } else {
            judgingBadge = '<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">Judging Inactive</span>';
        }

        return `
        <div class="event-card ${e.status === 'Ongoing' ? 'bg-emerald-50/30 hover:bg-white border-2 border-emerald-300/80 hover:border-emerald-500 shadow-xs' : 'bg-slate-50 hover:bg-white border border-slate-200/80 hover:border-slate-400'} rounded-2xl p-5 hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer group relative overflow-hidden" data-id="${e.id}">
            ${e.status === 'Ongoing' ? '<div class="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full pointer-events-none"></div>' : ''}
            <div>
                <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        ${getStatusBadgeHtml(e.status)}
                        ${judgingBadge}
                    </div>
                    <span class="px-2.5 py-1 text-[10px] font-bold bg-slate-200/70 text-slate-700 rounded-lg">${e.type}</span>
                </div>
                <h3 class="font-extrabold text-buksu-navy text-sm mb-1 group-hover:text-slate-900 transition-colors">${escapeHtml(e.eventName)}</h3>
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

            <div class="mt-5 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-1.5 flex-wrap">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <button class="open-setup-btn px-2.5 py-1.5 bg-buksu-navy hover:bg-buksu-navy-light text-white font-extrabold rounded-xl text-[11px] cursor-pointer transition-colors shadow-xs flex items-center gap-1" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}">
                        <i class="fa-solid fa-sliders text-buksu-gold"></i> Setup
                    </button>
                    ${e.judgingStatus === 'In Progress' ? `
                        <button class="toggle-judging-btn px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-[11px] cursor-pointer transition-colors shadow-xs flex items-center gap-1" data-id="${e.id}" data-action="stop" data-name="${escapeHtml(e.eventName)}">
                            <i class="fa-solid fa-stop"></i> Stop
                        </button>
                    ` : `
                        <button class="toggle-judging-btn px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-[11px] cursor-pointer transition-colors shadow-xs flex items-center gap-1" data-id="${e.id}" data-action="start" data-name="${escapeHtml(e.eventName)}">
                            <i class="fa-solid fa-play"></i> Start
                        </button>
                    `}
                    <button class="open-tab-board-btn px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-extrabold rounded-xl text-[11px] cursor-pointer transition-colors border border-amber-200 flex items-center gap-1" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}">
                        <i class="fa-solid fa-calculator"></i> Board
                    </button>
                </div>
                <div class="flex items-center gap-1">
                    <button class="open-assign-btn p-1.5 bg-slate-100 hover:bg-slate-200 text-buksu-navy font-bold rounded-xl text-xs cursor-pointer transition-colors" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}" title="Assign Personnel">
                        <i class="fa-solid fa-users-gear"></i>
                    </button>
                    <button class="open-edit-btn p-1.5 bg-slate-200/60 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors" 
                        data-id="${e.id}" 
                        data-name="${escapeHtml(e.eventName)}" 
                        data-type="${escapeHtml(e.type)}" 
                        data-desc="${escapeHtml(e.description)}" 
                        data-venue="${escapeHtml(e.venue)}" 
                        data-rawdate="${e.rawDate}" 
                        data-status="${e.status}" 
                        data-judging="${e.judgingStatus}"
                        title="Edit Competition">
                        <i class="fa-solid fa-pen text-buksu-navy"></i>
                    </button>
                    ${e.status !== 'Archived' ? (
                        canArchive ? `
                            <button class="archive-btn p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-xs cursor-pointer transition-colors" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}" data-can-archive="true" title="Archive Competition">
                                <i class="fa-solid fa-box-archive"></i>
                            </button>
                        ` : `
                            <button class="archive-btn p-1.5 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs cursor-not-allowed transition-colors opacity-60" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}" data-can-archive="false" data-judging="${e.judgingStatus}" data-status="${e.status}" title="Cannot archive: Competition is ongoing. Stop judging first.">
                                <i class="fa-solid fa-box-archive"></i>
                            </button>
                        `
                    ) : `
                        <button class="delete-archived-btn p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold rounded-xl text-xs cursor-pointer transition-colors" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}" title="Permanently Delete Archived Competition">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    `}
                </div>
            </div>
        </div>
        `;
    }).join('');

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

    const events = sortEventsByPriority(res.events);

    container.innerHTML = events.map(e => `
        <div class="p-4 rounded-2xl ${e.status === 'Ongoing' ? 'bg-emerald-50/40 border-2 border-emerald-300' : 'bg-slate-50 border border-slate-200'} flex items-center justify-between flex-wrap gap-4">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    ${getStatusBadgeHtml(e.status)}
                    <h4 class="font-extrabold text-slate-800 text-sm">${escapeHtml(e.eventName)}</h4>
                </div>
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
            <button class="open-assign-btn px-3.5 py-2 bg-buksu-navy hover:bg-buksu-navy-light text-white font-bold rounded-xl text-xs cursor-pointer shadow transition-colors flex items-center gap-1.5" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}">
                <i class="fa-solid fa-users-gear text-buksu-gold"></i> Manage Assignments
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
        <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/90 transition-colors">
            <td class="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 align-middle whitespace-nowrap">${log.timestamp}</td>
            <td class="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100 align-middle">
                ${escapeHtml(log.username)}
                <span class="ms-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${escapeHtml(log.role)}</span>
            </td>
            <td class="px-4 py-3 text-center align-middle">
                <span class="px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase bg-slate-100 dark:bg-slate-800 text-buksu-navy dark:text-buksu-gold border border-slate-200 dark:border-slate-700">${escapeHtml(log.action)}</span>
            </td>
            <td class="px-4 py-3 text-slate-700 dark:text-slate-200 align-middle font-normal">${escapeHtml(log.details)}</td>
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

    const events = sortEventsByPriority(res.events);

    grid.innerHTML = events.map(e => `
        <div class="event-card ${e.status === 'Ongoing' ? 'bg-emerald-50/30 hover:bg-white border-2 border-emerald-300/80 hover:border-emerald-500 shadow-xs' : 'bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-400'} rounded-2xl p-5 hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer group relative overflow-hidden" data-id="${e.id}">
            ${e.status === 'Ongoing' ? '<div class="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full pointer-events-none"></div>' : ''}
            <div>
                <div class="flex items-center justify-between gap-2 mb-2">
                    ${getStatusBadgeHtml(e.status)}
                    <span class="px-2.5 py-1 text-[10px] font-bold bg-slate-200/70 text-slate-700 rounded-lg">${e.type}</span>
                </div>
                <h3 class="font-extrabold text-buksu-navy text-sm mb-1 group-hover:text-slate-900 transition-colors">${escapeHtml(e.eventName)}</h3>
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

            <div class="mt-5 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2 flex-wrap">
                ${userRole === 'judge' ? `
                    <button class="open-judge-scoring-btn px-4 py-2 bg-buksu-navy hover:bg-buksu-navy-light text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-md transition-all flex items-center gap-1.5" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}">
                        <i class="fa-solid fa-gavel text-buksu-gold"></i> Open Judging Sheet
                    </button>
                ` : `
                    <button class="open-tab-board-btn px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-md transition-all flex items-center gap-1.5" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}">
                        <i class="fa-solid fa-calculator"></i> Live Tabulation Board
                    </button>
                `}
                <span class="text-[11px] font-bold ${e.judgingStatus === 'In Progress' ? 'text-emerald-600 animate-pulse' : 'text-slate-500'}">
                    <i class="fa-solid ${e.judgingStatus === 'In Progress' ? 'fa-play' : 'fa-hourglass-start'} me-1"></i> ${escapeHtml(e.judgingStatus || 'Not Yet Started')}
                </span>
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

        const isOngoing = (status === 'Ongoing' || judgingStatus === 'In Progress');
        const isStopped = (judgingStatus === 'Finished' || status === 'Completed');
        if (status === 'Archived' && isOngoing && !isStopped) {
            showToast("Cannot Archive", "Cannot archive an ongoing competition. Please stop the judging period before archiving.", "warning");
            return;
        }

        const res = await editEvent({ id, eventName, type, venue, status, judgingStatus, date, description });
        if (res.success) {
            document.getElementById('edit-event-modal')?.classList.add('hidden');
            showToast("Competition Updated!", `Details for "${eventName}" have been updated.`, "edit");
            await loadAdminEvents();
        } else {
            showToast("Update Failed", res.message || "Failed to update event.", "error");
        }
    });

    // Delete Archived Competition from Edit Modal
    document.getElementById('deleteArchivedEventFromEditBtn')?.addEventListener('click', async () => {
        const id = document.getElementById('edit-ev-id').value;
        const name = document.getElementById('edit-ev-name').value;
        if (confirm(`Are you completely sure you want to permanently delete the archived competition "${name}"?\n\nThis will permanently remove all associated contestants, criteria, and scores. This action cannot be undone.`)) {
            const res = await deleteArchivedEvent({ id });
            if (res.success) {
                document.getElementById('edit-event-modal')?.classList.add('hidden');
                showToast("Competition Deleted!", `Archived competition "${name}" has been permanently deleted.`, "archive");
                await loadAdminEvents();
            } else {
                showToast("Deletion Failed", res.message || "Failed to delete competition.", "error");
            }
        }
    });

    // Toggle delete button visibility when status is changed in Edit Modal
    document.getElementById('edit-ev-status')?.addEventListener('change', (e) => {
        const deleteBtn = document.getElementById('deleteArchivedEventFromEditBtn');
        if (deleteBtn) {
            if (e.target.value === 'Archived') {
                deleteBtn.classList.remove('hidden');
            } else {
                deleteBtn.classList.add('hidden');
            }
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
    const modalIds = [
        'create-event-modal', 
        'edit-event-modal', 
        'assign-event-modal', 
        'view-event-modal',
        'manage-event-setup-modal',
        'adjust-weights-modal',
        'judge-scoring-modal',
        'tabulation-board-modal'
    ];

    // Close Modals on close button click - only closes the enclosing modal
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const enclosingModal = btn.closest('.fixed');
            if (enclosingModal) {
                enclosingModal.classList.add('hidden');
                // If closing parent manage-event-setup-modal, also close child sub-modals
                if (enclosingModal.id === 'manage-event-setup-modal') {
                    document.getElementById('adjust-weights-modal')?.classList.add('hidden');
                    document.getElementById('criterion-rubric-modal')?.classList.add('hidden');
                    document.getElementById('contestant-comments-modal')?.classList.add('hidden');
                }
            }
        });
    });

    // Close on backdrop click
    modalIds.forEach(id => {
        const modal = document.getElementById(id);
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    });
}

function bindEventCardActions() {
    // Card Click -> View Details Modal
    document.querySelectorAll('#admin-events-grid .event-card').forEach(card => {
        card.addEventListener('click', () => openViewEventModal(card.dataset.id));
    });

    // Setup Contestants & Criteria Modal
    document.querySelectorAll('.open-setup-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openManageSetupModal(btn.dataset.id, btn.dataset.name);
        });
    });

    // Toggle Judging Period (Start / Stop)
    document.querySelectorAll('.toggle-judging-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const eventName = btn.dataset.name;
            const id = btn.dataset.id;
            const confirmMsg = action === 'start' 
                ? `Are you sure you want to START the judging period for "${eventName}"? Assigned judges will immediately be permitted to enter scores.`
                : `Are you sure you want to STOP the judging period for "${eventName}"? Judging will be finalized and scoring submissions locked.`;

            if (confirm(confirmMsg)) {
                btn.disabled = true;
                const res = await toggleJudgingPeriod(id, action);
                btn.disabled = false;
                if (res.success) {
                    showToast("Judging Period Updated!", res.message, "create");
                    await loadAdminEvents();
                } else {
                    showToast("Action Failed", res.message || "Failed to update judging period.", "error");
                }
            }
        });
    });

    // Open Live Tabulation Board
    document.querySelectorAll('.open-tab-board-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTabulationBoardModal(btn.dataset.id, btn.dataset.name);
        });
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

            const isOngoing = (btn.dataset.status === 'Ongoing' || btn.dataset.judging === 'In Progress');
            const isStopped = (btn.dataset.judging === 'Finished' || btn.dataset.status === 'Completed');
            const canArchive = (!isOngoing || isStopped);

            const archivedOption = document.querySelector('#edit-ev-status option[value="Archived"]');
            if (archivedOption) {
                if (!canArchive) {
                    archivedOption.disabled = true;
                    archivedOption.textContent = 'Archived (Stop judging first)';
                } else {
                    archivedOption.disabled = false;
                    archivedOption.textContent = 'Archived';
                }
            }

            const deleteBtn = document.getElementById('deleteArchivedEventFromEditBtn');
            if (deleteBtn) {
                if (btn.dataset.status === 'Archived') {
                    deleteBtn.classList.remove('hidden');
                } else {
                    deleteBtn.classList.add('hidden');
                }
            }

            document.getElementById('edit-event-modal')?.classList.remove('hidden');
        });
    });

    // Archive Event
    document.querySelectorAll('.archive-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const eventName = btn.dataset.name;
            const canArchive = btn.dataset.canArchive === 'true';

            if (!canArchive) {
                const judging = btn.dataset.judging;
                const reason = judging === 'In Progress' 
                    ? `Judging for "${eventName}" is currently in progress. Please stop the judging period before archiving.` 
                    : `Competition "${eventName}" is currently ongoing. Please stop judging before archiving to prevent conflicts.`;
                showToast("Cannot Archive", reason, "warning");
                return;
            }

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

    // Delete Archived Event from Card
    document.querySelectorAll('.delete-archived-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const eventName = btn.dataset.name;
            const eventId = btn.dataset.id;
            if (confirm(`Are you completely sure you want to permanently delete the archived competition "${eventName}"?\n\nThis will permanently delete all associated contestants, criteria, and scores. This action cannot be undone.`)) {
                const res = await deleteArchivedEvent({ id: eventId });
                if (res.success) {
                    showToast("Competition Deleted!", `Archived competition "${eventName}" was permanently removed.`, "archive");
                    await loadAdminEvents();
                } else {
                    showToast("Deletion Failed", res.message || "Failed to delete archived competition.", "error");
                }
            }
        });
    });
}

function bindUserEventCardActions() {
    document.querySelectorAll('#user-assigned-events-grid .event-card').forEach(card => {
        card.addEventListener('click', () => openViewEventModal(card.dataset.id));
    });

    // Open Judge Scoring Modal
    document.querySelectorAll('.open-judge-scoring-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openJudgeScoringModal(btn.dataset.id, btn.dataset.name);
        });
    });

    // Open Tabulator Board Modal
    document.querySelectorAll('.open-tab-board-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTabulationBoardModal(btn.dataset.id, btn.dataset.name);
        });
    });
}

export async function openViewEventModal(eventId) {
    const modal = document.getElementById('view-event-modal');
    if (!modal) return;

    let event = cachedEventsList.find(e => String(e.id) === String(eventId));
    if (!event) {
        const res = await listEvents();
        if (res.success && res.events) {
            cachedEventsList = res.events;
            event = cachedEventsList.find(e => String(e.id) === String(eventId));
        }
    }
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
                        <div class="w-6 h-6 rounded-lg bg-slate-100 text-buksu-navy flex items-center justify-center text-xs font-bold shrink-0">
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

    // Action buttons in modal footer
    const actionsBox = document.getElementById('view-modal-action-buttons');
    if (actionsBox) {
        if (userRole === 'admin') {
            actionsBox.innerHTML = `
                <button type="button" class="view-modal-setup-btn px-3 py-1.5 bg-buksu-navy hover:bg-buksu-navy-light text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs">
                    <i class="fa-solid fa-sliders text-buksu-gold"></i> Setup
                </button>
                <button type="button" class="view-modal-board-btn px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs">
                    <i class="fa-solid fa-calculator"></i> Live Board
                </button>
                ${event.status === 'Archived' ? `
                    <button type="button" class="view-modal-delete-btn px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs">
                        <i class="fa-solid fa-trash-can"></i> Delete Competition
                    </button>
                ` : ''}
            `;
            actionsBox.querySelector('.view-modal-setup-btn')?.addEventListener('click', () => {
                modal.classList.add('hidden');
                openManageSetupModal(event.id, event.eventName);
            });
            actionsBox.querySelector('.view-modal-board-btn')?.addEventListener('click', () => {
                modal.classList.add('hidden');
                openTabulationBoardModal(event.id, event.eventName);
            });
            actionsBox.querySelector('.view-modal-delete-btn')?.addEventListener('click', async () => {
                if (confirm(`Are you completely sure you want to permanently delete the archived competition "${event.eventName}"?\n\nThis will permanently delete all associated contestants, criteria, and scores.`)) {
                    const res = await deleteArchivedEvent({ id: event.id });
                    if (res.success) {
                        modal.classList.add('hidden');
                        showToast("Competition Deleted!", `Archived competition "${event.eventName}" was permanently removed.`, "archive");
                        await loadAdminEvents();
                    } else {
                        showToast("Deletion Failed", res.message || "Failed to delete competition.", "error");
                    }
                }
            });
        } else if (userRole === 'judge') {
            actionsBox.innerHTML = `
                <button type="button" class="view-modal-judge-btn px-4 py-1.5 bg-buksu-navy hover:bg-buksu-navy-light text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs">
                    <i class="fa-solid fa-gavel text-buksu-gold"></i> Enter / View Scores
                </button>
            `;
            actionsBox.querySelector('.view-modal-judge-btn')?.addEventListener('click', () => {
                modal.classList.add('hidden');
                openJudgeScoringModal(event.id, event.eventName);
            });
        } else if (userRole === 'tabulator') {
            actionsBox.innerHTML = `
                <button type="button" class="view-modal-tab-btn px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs">
                    <i class="fa-solid fa-calculator"></i> Live Tabulation Board
                </button>
            `;
            actionsBox.querySelector('.view-modal-tab-btn')?.addEventListener('click', () => {
                modal.classList.add('hidden');
                openTabulationBoardModal(event.id, event.eventName);
            });
        } else {
            actionsBox.innerHTML = '';
        }
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
        judgeBox.innerHTML = judges.map(j => {
            const isActivated = j.status === 'active' && j.is_active !== false;
            const isChecked = currentJudgeIds.includes(String(j.id));
            let badge = '';
            if (j.is_active === false) {
                badge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 ms-auto shrink-0">Disabled</span>';
            } else if (j.status === 'pending') {
                badge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 ms-auto shrink-0"><i class="fa-solid fa-clock me-1"></i>Pending Activation</span>';
            } else {
                badge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 ms-auto shrink-0"><i class="fa-solid fa-circle-check me-1"></i>Activated</span>';
            }

            return `
                <label class="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-100 transition-colors ${!isActivated ? 'opacity-60 cursor-not-allowed bg-slate-100/60' : 'hover:bg-slate-50 cursor-pointer font-medium text-slate-700'}">
                    <div class="flex items-center gap-2 overflow-hidden">
                        <input type="checkbox" value="${j.id}" class="judge-checkbox accent-buksu-navy rounded w-4 h-4 shrink-0" ${isChecked ? 'checked' : ''} ${!isActivated ? 'disabled' : ''}>
                        <span class="truncate text-xs">${escapeHtml(j.username)} <span class="text-slate-400 font-normal">(${escapeHtml(j.email || 'No email')})</span></span>
                    </div>
                    ${badge}
                </label>
            `;
        }).join('');
    }

    if (tabulators.length === 0) {
        tabBox.innerHTML = '<span class="text-slate-400 italic">No tabulators found. Invite a tabulator first.</span>';
    } else {
        tabBox.innerHTML = tabulators.map(t => {
            const isActivated = t.status === 'active' && t.is_active !== false;
            const isChecked = currentTabIds.includes(String(t.id));
            let badge = '';
            if (t.is_active === false) {
                badge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 ms-auto shrink-0">Disabled</span>';
            } else if (t.status === 'pending') {
                badge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 ms-auto shrink-0"><i class="fa-solid fa-clock me-1"></i>Pending Activation</span>';
            } else {
                badge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 ms-auto shrink-0"><i class="fa-solid fa-circle-check me-1"></i>Activated</span>';
            }

            return `
                <label class="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-100 transition-colors ${!isActivated ? 'opacity-60 cursor-not-allowed bg-slate-100/60' : 'hover:bg-slate-50 cursor-pointer font-medium text-slate-700'}">
                    <div class="flex items-center gap-2 overflow-hidden">
                        <input type="checkbox" value="${t.id}" class="tabulator-checkbox accent-buksu-navy rounded w-4 h-4 shrink-0" ${isChecked ? 'checked' : ''} ${!isActivated ? 'disabled' : ''}>
                        <span class="truncate text-xs">${escapeHtml(t.username)} <span class="text-slate-400 font-normal">(${escapeHtml(t.email || 'No email')})</span></span>
                    </div>
                    ${badge}
                </label>
            `;
        }).join('');
    }
}

function getStatusStyle(status) {
    if (status === 'Upcoming') return 'bg-amber-100 text-amber-800';
    if (status === 'Ongoing') return 'bg-emerald-100 text-emerald-800';
    if (status === 'Completed') return 'bg-slate-100 text-slate-800 border border-slate-300';
    if (status === 'Archived') return 'bg-slate-200 text-slate-700';
    return 'bg-slate-100 text-slate-700';
}

function getStatusBadgeHtml(status) {
    if (status === 'Ongoing') {
        return `<span class="px-2.5 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wide bg-emerald-600 text-white inline-flex items-center gap-1.5 shadow-xs"><span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span> Ongoing</span>`;
    }
    if (status === 'Upcoming') {
        return `<span class="px-2.5 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wide bg-amber-100 text-amber-800">Upcoming</span>`;
    }
    if (status === 'Completed') {
        return `<span class="px-2.5 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wide bg-slate-100 text-slate-800 border border-slate-300">Completed</span>`;
    }
    if (status === 'Archived') {
        return `<span class="px-2.5 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wide bg-slate-200 text-slate-700">Archived</span>`;
    }
    return `<span class="px-2.5 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wide bg-slate-100 text-slate-700">${status}</span>`;
}

function sortEventsByPriority(events) {
    if (!Array.isArray(events)) return [];
    const statusPriority = {
        'Ongoing': 1,
        'Upcoming': 2,
        'Completed': 3,
        'Archived': 4
    };

    return [...events].sort((a, b) => {
        const prioA = statusPriority[a.status] || 99;
        const prioB = statusPriority[b.status] || 99;
        if (prioA !== prioB) {
            return prioA - prioB;
        }
        return (b.id || 0) - (a.id || 0);
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
