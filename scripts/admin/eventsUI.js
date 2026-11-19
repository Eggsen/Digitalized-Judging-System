import { listEvents, createEvent, editEvent, assignJudges, archiveEvent, deleteArchivedEvent, listLogs } from "./eventsAPI.js";
import { listAccounts } from "./adminAPI.js";
import { showToast, formatDateTime, toDateTimeLocalValue, formatActionTerm } from "../utils/uiUtils.js";
import { openManageSetupModal, initContestantsCriteriaUI } from "./contestantsCriteriaUI.js";
import { openJudgeScoringModal, initJudgeUI } from "../judge/judgeUI.js";
import { openTabulationBoardModal, initTabulatorUI } from "../tabulator/tabulatorUI.js";
import { toggleJudgingPeriod } from "./judgingAPI.js";
import { loadSystemSettings, checkIsSettingsDirty, triggerUnsavedChangesShake, resetSettingsDirtyState } from "./settingsUI.js";

const userRole = document.body.dataset.role;
let cachedEventsList = [];

document.addEventListener("DOMContentLoaded", () => {
    initCommonModalEvents();
    initQrModalControls();

    // Ensure judge and tabulator modal controls are ready for all authenticated roles
    initJudgeUI();
    initTabulatorUI();

    if (userRole === 'admin') {
        initAdminTabs();
        initAdminEventActions();
        initContestantsCriteriaUI();
        loadAdminEvents();
        loadAuditLogs();
    } else if (userRole === 'judge') {
        initUserTabs();
        loadUserAssignedEvents();
        document.getElementById('refreshUserEventsBtn')?.addEventListener('click', loadUserAssignedEvents);
    } else if (userRole === 'tabulator') {
        initUserTabs();
        loadUserAssignedEvents();
        document.getElementById('refreshUserEventsBtn')?.addEventListener('click', loadUserAssignedEvents);
    }

    // Automatically launch scoring or tabulation modal if arrived via scanned QR code or deep link
    handleQrDeepLinks();
});

function handleQrDeepLinks() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('event_id') || urlParams.get('eventId') || urlParams.get('view_event') || urlParams.get('id') || urlParams.get('event');
    const action = urlParams.get('action');
    const type = urlParams.get('type');

    if (!eventId) return;

    const numericEventId = parseInt(eventId);
    if (isNaN(numericEventId) || numericEventId <= 0) return;

    // Clean URL query parameters silently so subsequent manual page refreshes don't re-trigger modals
    try {
        window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {}

    // Allow DOM to settle before opening the deep-linked modal
    setTimeout(() => {
        // 1. Judge Direct Scoring Sheet Access (scanned Judge QR Placard)
        if (action === 'judge_score') {
            if (userRole === 'judge' || userRole === 'admin') {
                openJudgeScoringModal(numericEventId);
            } else {
                openTabulationBoardModal(numericEventId);
            }
            return;
        }

        // 2. Public Live Tabulation Board / Verification Seal Access (scanned Public QR Code)
        if (urlParams.has('view_event') || type === 'public_matrix' || action === 'tabulation' || action === 'matrix') {
            openTabulationBoardModal(numericEventId);
            return;
        }

        // 3. Fallback based on user role
        if (userRole === 'judge') {
            openJudgeScoringModal(numericEventId);
        } else {
            openTabulationBoardModal(numericEventId);
        }
    }, 150);
}

/* -------------------------------------------------------------
 * ADMIN TABS & NAVIGATION (SIDEBAR + TOP BAR SYNC)
 * ------------------------------------------------------------- */
let pendingMainTabDiscardTarget = null;
let pendingMainTabDiscardTimer = null;

export function switchAdminTab(targetTab) {
    window.switchAdminTab = switchAdminTab;

    const currentVisibleTab = document.querySelector('.admin-tab-content:not(.hidden)');
    const isAlreadyActive = currentVisibleTab && currentVisibleTab.id === targetTab;
    if (isAlreadyActive) {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        return;
    }

    const settingsTab = document.getElementById('settings-tab');
    const isCurrentlyOnSettings = settingsTab && !settingsTab.classList.contains('hidden');

    if (isCurrentlyOnSettings && targetTab !== 'settings-tab' && typeof checkIsSettingsDirty === 'function' && checkIsSettingsDirty()) {
        if (pendingMainTabDiscardTarget === targetTab) {
            clearTimeout(pendingMainTabDiscardTimer);
            pendingMainTabDiscardTarget = null;
            if (typeof resetSettingsDirtyState === 'function') resetSettingsDirtyState();
        } else {
            pendingMainTabDiscardTarget = targetTab;
            clearTimeout(pendingMainTabDiscardTimer);
            pendingMainTabDiscardTimer = setTimeout(() => {
                pendingMainTabDiscardTarget = null;
            }, 3000);
            const targetBtn = document.querySelector(`.admin-tab-btn[data-tab="${targetTab}"], .sidebar-nav-btn[data-tab="${targetTab}"]`);
            if (typeof triggerUnsavedChangesShake === 'function') {
                triggerUnsavedChangesShake(targetBtn);
            }
            return;
        }
    }

    // Toggle welcome hero banner: only visible on primary events-tab
    const welcomeHero = document.getElementById('welcome-hero-card');
    if (welcomeHero) {
        if (targetTab === 'events-tab') {
            welcomeHero.classList.remove('hidden');
        } else {
            welcomeHero.classList.add('hidden');
        }
    }

    const tabBtns = document.querySelectorAll('.admin-tab-btn, .sidebar-nav-btn[data-tab]:not([data-tab^="user-"])');
    const tabContents = document.querySelectorAll('.admin-tab-content');

    tabBtns.forEach(b => {
        const isMatch = b.dataset.tab === targetTab;
        const icon = b.querySelector('i:not(#sidebar-settings-chevron)');
        if (b.classList.contains('sidebar-nav-btn')) {
            const hasChevron = !!b.querySelector('#sidebar-settings-chevron');
            const layoutClass = hasChevron ? 'flex items-center justify-between' : 'flex items-center gap-3';
            if (isMatch) {
                b.className = `sidebar-nav-btn w-full px-4 py-3 text-xs font-bold rounded-2xl bg-buksu-navy text-white shadow-md transition-all cursor-pointer ${layoutClass} border border-buksu-gold/30`;
            } else {
                b.className = `sidebar-nav-btn w-full px-4 py-3 text-xs font-bold rounded-2xl text-slate-600 hover:text-buksu-navy hover:bg-slate-100 transition-all cursor-pointer ${layoutClass} border border-transparent`;
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

    const subNav = document.getElementById('sidebar-settings-subnav');
    const chevron = document.getElementById('sidebar-settings-chevron');
    if (targetTab === 'settings-tab') {
        if (subNav) subNav.classList.remove('hidden');
        if (chevron) {
            chevron.classList.add('rotate-180', 'text-buksu-gold');
            chevron.classList.remove('text-slate-400');
        }
    } else {
        if (subNav) subNav.classList.add('hidden');
        if (chevron) {
            chevron.classList.remove('rotate-180', 'text-buksu-gold');
            chevron.classList.add('text-slate-400');
        }
    }

    tabContents.forEach(c => c.classList.add('hidden'));
    const activeContent = document.getElementById(targetTab);
    if (activeContent) {
        activeContent.classList.remove('hidden');
        activeContent.classList.add('animate-fade-in');
    }

    // Always reset viewport scroll so newly entered tab begins at the top
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    });

    if (targetTab === 'events-tab') loadAdminEvents();
    if (targetTab === 'assignments-tab') loadJudgeAssignments();
    if (targetTab === 'logs-tab') loadAuditLogs();
    if (targetTab === 'settings-tab') loadSystemSettings();
    if (targetTab === 'notifications-tab' && typeof window.loadPageNotifications === 'function') {
        window.loadPageNotifications();
    }
}

function initAdminTabs() {
    window.switchAdminTab = switchAdminTab;
    const tabBtns = document.querySelectorAll('.admin-tab-btn, .sidebar-nav-btn[data-tab]:not([data-tab^="user-"])');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            if (targetTab) switchAdminTab(targetTab);
        });
    });

    const chevron = document.getElementById('sidebar-settings-chevron');
    chevron?.addEventListener('click', (e) => {
        e.stopPropagation();
        const subNav = document.getElementById('sidebar-settings-subnav');
        if (subNav) {
            const isHidden = subNav.classList.toggle('hidden');
            chevron.classList.toggle('rotate-180', !isHidden);
        }
    });

    document.getElementById('event-status-filter')?.addEventListener('change', loadAdminEvents);
    document.getElementById('refreshEventsBtn')?.addEventListener('click', loadAdminEvents);
    document.getElementById('refreshLogsBtn')?.addEventListener('click', () => loadAuditLogs('logs-tbody'));

    // Auto-switch to tab if specified in URL query (?tab=notifications-tab)
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab') || window.location.hash.replace('#', '');
    if (tabParam && document.getElementById(tabParam)) {
        switchAdminTab(tabParam);
    }
}

/* -------------------------------------------------------------
 * JUDGE / TABULATOR USER TABS & NAVIGATION (SIDEBAR + TOP BAR SYNC)
 * ------------------------------------------------------------- */
export function switchUserTab(targetTab) {
    window.switchUserTab = switchUserTab;

    const currentVisibleTab = document.querySelector('.user-tab-content:not(.hidden)');
    const isAlreadyActive = currentVisibleTab && currentVisibleTab.id === targetTab;
    if (isAlreadyActive) {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        return;
    }

    // Toggle welcome hero banner: only visible on primary user-events-tab
    const welcomeHero = document.getElementById('welcome-hero-card');
    if (welcomeHero) {
        if (targetTab === 'user-events-tab') {
            welcomeHero.classList.remove('hidden');
        } else {
            welcomeHero.classList.add('hidden');
        }
    }

    const userTabBtns = document.querySelectorAll('.user-tab-btn, .sidebar-nav-btn[data-tab^="user-"], .sidebar-nav-btn[data-tab="notifications-tab"]');
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

    // Always reset viewport scroll so newly entered tab begins at the top
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    });

    if (targetTab === 'user-events-tab') loadUserAssignedEvents();
    if (targetTab === 'user-logs-tab') loadAuditLogs('user-logs-tbody');
    if (targetTab === 'notifications-tab' && typeof window.loadPageNotifications === 'function') {
        window.loadPageNotifications();
    }
}

function initUserTabs() {
    window.switchUserTab = switchUserTab;
    const userTabBtns = document.querySelectorAll('.user-tab-btn, .sidebar-nav-btn[data-tab^="user-"], .sidebar-nav-btn[data-tab="notifications-tab"]');

    userTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            if (targetTab) switchUserTab(targetTab);
        });
    });

    document.getElementById('refreshUserLogsBtn')?.addEventListener('click', () => loadAuditLogs('user-logs-tbody'));

    // Auto-switch to tab if specified in URL query (?tab=notifications-tab)
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab') || window.location.hash.replace('#', '');
    if (tabParam && document.getElementById(tabParam)) {
        switchUserTab(tabParam);
    }
}

/* -------------------------------------------------------------
 * COMPETITIONS PAGINATION & DATE VALIDATION HELPERS
 * ------------------------------------------------------------- */
export const adminEventsPagination = {
    page: 1,
    limit: 6,
    total: 0,
    totalPages: 1,
    initialized: false
};

export const userEventsPagination = {
    page: 1,
    limit: 6,
    total: 0,
    totalPages: 1,
    initialized: false
};

export function validateCompetitionDate(dateStr) {
    if (!dateStr) return { valid: false, message: 'Event date and time is required.' };
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { valid: false, message: 'Please provide a valid event date and time.' };
    const year = d.getFullYear();
    if (year < 2000 || year > 2100) {
        return { valid: false, message: `Invalid year (${year}). Competition year must be between 2000 and 2100.` };
    }
    return { valid: true };
}

function renderEventsPagination(state, containerId, infoId, controlsId, onPageChange) {
    const container = document.getElementById(containerId);
    const infoEl = document.getElementById(infoId);
    const controlsEl = document.getElementById(controlsId);

    if (!container || !infoEl || !controlsEl) return;

    if (state.total === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    const start = (state.page - 1) * state.limit + 1;
    const end = Math.min(state.page * state.limit, state.total);
    infoEl.textContent = `Showing ${start} to ${end} of ${state.total} competitions.`;

    if (state.totalPages <= 1) {
        controlsEl.innerHTML = '';
        return;
    }

    const pages = getPaginationPageList(state.page, state.totalPages);
    let html = '';

    const prevDisabled = state.page <= 1;
    html += `
        <button type="button" class="event-page-btn px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 text-xs" data-page="${state.page - 1}" ${prevDisabled ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-left text-[10px]"></i>
            <span class="hidden sm:inline">Prev</span>
        </button>
    `;

    pages.forEach(p => {
        if (p === '...') {
            html += `<span class="px-2 py-1 text-slate-400 font-bold select-none text-xs">...</span>`;
        } else if (p === state.page) {
            html += `
                <button type="button" class="w-8 h-8 rounded-xl bg-buksu-navy text-white font-black shadow-xs border border-buksu-navy text-xs cursor-default">
                    ${p}
                </button>
            `;
        } else {
            html += `
                <button type="button" class="event-page-btn w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs cursor-pointer" data-page="${p}">
                    ${p}
                </button>
            `;
        }
    });

    const nextDisabled = state.page >= state.totalPages;
    html += `
        <button type="button" class="event-page-btn px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 text-xs" data-page="${state.page + 1}" ${nextDisabled ? 'disabled' : ''}>
            <span class="hidden sm:inline">Next</span>
            <i class="fa-solid fa-chevron-right text-[10px]"></i>
        </button>
    `;

    controlsEl.innerHTML = html;

    controlsEl.querySelectorAll('.event-page-btn:not([disabled])').forEach(b => {
        b.addEventListener('click', () => {
            const newPage = parseInt(b.dataset.page, 10);
            if (!isNaN(newPage) && newPage >= 1 && newPage <= state.totalPages) {
                state.page = newPage;
                onPageChange();
            }
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

    adminEventsPagination.total = events.length;
    adminEventsPagination.totalPages = Math.max(1, Math.ceil(events.length / adminEventsPagination.limit));
    if (adminEventsPagination.page > adminEventsPagination.totalPages) {
        adminEventsPagination.page = adminEventsPagination.totalPages;
    }

    if (!adminEventsPagination.initialized) {
        adminEventsPagination.initialized = true;
        document.getElementById('admin-events-page-size')?.addEventListener('change', (e) => {
            adminEventsPagination.limit = parseInt(e.target.value, 10) || 6;
            adminEventsPagination.page = 1;
            loadAdminEvents();
        });
        document.getElementById('event-status-filter')?.addEventListener('change', () => {
            adminEventsPagination.page = 1;
        });
    }

    if (events.length === 0) {
        document.getElementById('admin-events-pagination-container')?.classList.add('hidden');
        grid.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                <i class="fa-solid fa-trophy text-3xl text-slate-300 mb-2"></i>
                <p class="text-xs font-bold text-slate-600">No competitions found</p>
                <p class="text-[11px] text-slate-400 mt-1">Create a new competition or adjust your status filter.</p>
            </div>
        `;
        return;
    }

    const startIndex = (adminEventsPagination.page - 1) * adminEventsPagination.limit;
    const paginatedEvents = events.slice(startIndex, startIndex + adminEventsPagination.limit);

    grid.innerHTML = paginatedEvents.map(e => {
        const isOngoing = (e.status === 'Ongoing' || e.judgingStatus === 'In Progress');
        const isStopped = (e.judgingStatus === 'Finished' || e.status === 'Completed');
        const isCompleted = (e.status === 'Completed' || e.judgingStatus === 'Finished');
        const isArchived = (e.status === 'Archived');
        const canArchive = (!isOngoing || isStopped);
        const canEdit = (!isOngoing || isStopped);

        let judgingBadge = '';
        if (e.judgingStatus === 'In Progress') {
            judgingBadge = '<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 animate-pulse"><i class="fa-solid fa-play text-[8px]"></i> Judging Active</span>';
        } else if (e.judgingStatus === 'Finished') {
            judgingBadge = '<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-800 border border-slate-300">Judging Finished</span>';
        } else {
            judgingBadge = '<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">Judging Inactive</span>';
        }

        const contestantsCount = Number(e.contestants_count || 0);
        const criteriaCount = Number(e.criteria_count || 0);
        const judgesCount = Number(e.judges_count !== undefined ? e.judges_count : (e.assignedjudges ? e.assignedjudges.length : 0));
        const tabulatorsCount = Number(e.tabulators_count !== undefined ? e.tabulators_count : (e.tabulators ? e.tabulators.length : 0));

        const missingSetupList = [];
        if (contestantsCount === 0) missingSetupList.push('contestants');
        if (criteriaCount === 0) missingSetupList.push('criteria');
        if (judgesCount === 0) missingSetupList.push('judges');
        if (tabulatorsCount === 0) missingSetupList.push('tabulator');

        const canStartEvent = missingSetupList.length === 0;

        // Determine primary status action button (Start / Stop / Completed / Archived)
        let statusButtonHtml = '';
        if (e.judgingStatus === 'In Progress') {
            statusButtonHtml = `
                <button type="button" class="toggle-judging-btn px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-[11px] cursor-pointer transition-colors shadow-xs flex items-center gap-1 shrink-0" data-id="${e.id}" data-action="stop" data-name="${escapeHtml(e.eventName)}">
                    <i class="fa-solid fa-stop"></i> Stop
                </button>
            `;
        } else if (isCompleted) {
            // Completed state: disable/hide green start button so completed events cannot be accidentally restarted
            statusButtonHtml = `
                <button type="button" disabled class="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-extrabold rounded-xl text-[11px] cursor-not-allowed flex items-center gap-1 border border-slate-200 dark:border-slate-700 shadow-none shrink-0 select-none" title="Judging finished. Competition completed.">
                    <i class="fa-solid fa-circle-check text-slate-400 dark:text-slate-500"></i> Completed
                </button>
            `;
        } else if (isArchived) {
            statusButtonHtml = `
                <button type="button" disabled class="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-extrabold rounded-xl text-[11px] cursor-not-allowed flex items-center gap-1 border border-slate-200 dark:border-slate-700 shadow-none shrink-0 select-none" title="Competition is archived.">
                    <i class="fa-solid fa-box-archive text-slate-400 dark:text-slate-500"></i> Archived
                </button>
            `;
        } else if (canStartEvent) {
            statusButtonHtml = `
                <button type="button" class="toggle-judging-btn px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-[11px] cursor-pointer transition-colors shadow-xs flex items-center gap-1 shrink-0" data-id="${e.id}" data-action="start" data-can-start="true" data-name="${escapeHtml(e.eventName)}">
                    <i class="fa-solid fa-play"></i> Start
                </button>
            `;
        } else {
            statusButtonHtml = `
                <button type="button" class="toggle-judging-btn px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-500 font-extrabold rounded-xl text-[11px] cursor-pointer transition-colors shadow-xs flex items-center gap-1 border border-slate-300 shrink-0" data-id="${e.id}" data-action="start" data-can-start="false" data-missing="${escapeHtml(missingSetupList.join(', '))}" data-name="${escapeHtml(e.eventName)}" title="Cannot start: setup incomplete (missing ${escapeHtml(missingSetupList.join(', '))})">
                    <i class="fa-solid fa-lock text-slate-400"></i> Start
                </button>
            `;
        }

        return `
        <div class="event-card ${e.status === 'Ongoing' ? 'bg-emerald-50/30 hover:bg-white border-2 border-emerald-300/80 hover:border-emerald-500 shadow-xs' : 'bg-slate-50 hover:bg-white border border-slate-200/80 hover:border-slate-400'} rounded-2xl p-5 hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer group relative" data-id="${e.id}">
            ${e.status === 'Ongoing' ? '<div class="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-tr-2xl rounded-bl-full pointer-events-none"></div>' : ''}
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
                        <span>${formatDateTime(e.date)}</span>
                    </div>
                    <div class="flex items-center gap-2 text-[11px]">
                        <i class="fa-solid fa-location-dot text-buksu-navy w-4"></i>
                        <span>${escapeHtml(e.venue || 'TBA')}</span>
                    </div>
                    <div class="flex items-center gap-2 text-[11px]">
                        <i class="fa-solid fa-users text-buksu-navy w-4"></i>
                        <span>Contestants: ${contestantsCount > 0 ? `<strong class="text-slate-800">${contestantsCount}</strong>` : '<span class="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-[10px]">0 (Required)</span>'}</span>
                    </div>
                    <div class="flex items-center gap-2 text-[11px]">
                        <i class="fa-solid fa-list-check text-buksu-navy w-4"></i>
                        <span>Criteria: ${criteriaCount > 0 ? `<strong class="text-slate-800">${criteriaCount}</strong>` : '<span class="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-[10px]">0 (Required)</span>'}</span>
                    </div>
                    <div class="flex items-center gap-2 text-[11px]">
                        <i class="fa-solid fa-gavel text-buksu-navy w-4"></i>
                        <span>Judges: ${judgesCount > 0 ? e.assignedjudges.map(j => escapeHtml(j.username)).join(', ') : '<span class="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-[10px]">None assigned (Required)</span>'}</span>
                    </div>
                    <div class="flex items-center gap-2 text-[11px]">
                        <i class="fa-solid fa-calculator text-buksu-navy w-4"></i>
                        <span>Tabulators: ${tabulatorsCount > 0 ? e.tabulators.map(t => escapeHtml(t.username)).join(', ') : '<span class="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-[10px]">None assigned (Required)</span>'}</span>
                    </div>
                </div>
            </div>

            <div class="mt-5 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                <!-- Primary Action Buttons: Setup, Start/Stop/Completed, Board -->
                <div class="flex items-center gap-1.5 flex-wrap min-w-0">
                    <button type="button" class="open-setup-btn px-2.5 py-1.5 bg-buksu-navy hover:bg-buksu-navy-light text-white font-extrabold rounded-xl text-[11px] cursor-pointer transition-colors shadow-xs flex items-center gap-1 shrink-0" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}">
                        <i class="fa-solid fa-sliders text-buksu-gold"></i> Setup
                    </button>
                    ${statusButtonHtml}
                    <button type="button" class="open-tab-board-btn px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-extrabold rounded-xl text-[11px] cursor-pointer transition-colors border border-amber-200 flex items-center gap-1 shrink-0" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}">
                        <i class="fa-solid fa-calculator"></i> Board
                    </button>
                </div>

                <!-- Secondary Actions: Single "..." More Actions Dropdown -->
                <div class="relative dropdown-container shrink-0">
                    <button type="button" class="event-more-actions-btn w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-buksu-navy dark:hover:text-white transition-colors flex items-center justify-center cursor-pointer border border-slate-200 dark:border-slate-700 shadow-2xs" aria-label="More actions for ${escapeHtml(e.eventName)}" title="More Actions" data-id="${e.id}">
                        <i class="fa-solid fa-ellipsis text-sm"></i>
                    </button>

                    <div class="event-more-actions-menu absolute right-0 bottom-full mb-1 sm:bottom-auto sm:top-full sm:mt-1.5 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1.5 z-40 hidden text-xs font-semibold text-slate-700 dark:text-slate-200 animate-fade-in divide-y divide-slate-100 dark:divide-slate-700/60">
                        <div class="py-1">
                            <button type="button" class="menu-item-action open-setup-btn w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}">
                                <i class="fa-solid fa-users w-4 text-center text-buksu-navy dark:text-buksu-gold"></i>
                                <span>Manage Contestants</span>
                            </button>
                            <button type="button" class="menu-item-action open-assign-btn w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}">
                                <i class="fa-solid fa-users-gear w-4 text-center text-buksu-navy dark:text-buksu-gold"></i>
                                <span>Assign Personnel</span>
                            </button>
                            <button type="button" class="menu-item-action open-qr-modal-btn w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}">
                                <i class="fa-solid fa-qrcode w-4 text-center text-purple-600 dark:text-purple-400"></i>
                                <span>View QR Codes</span>
                            </button>
                            <button type="button" class="menu-item-action open-executive-report-btn w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}">
                                <i class="fa-solid fa-file-invoice w-4 text-center text-sky-600 dark:text-sky-400"></i>
                                <span>Executive Summary (PDF)</span>
                            </button>
                            ${canEdit ? `
                                <button type="button" class="menu-item-action open-edit-btn w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
                                    data-id="${e.id}" 
                                    data-name="${escapeHtml(e.eventName)}" 
                                    data-type="${escapeHtml(e.type)}" 
                                    data-desc="${escapeHtml(e.description)}" 
                                    data-venue="${escapeHtml(e.venue)}" 
                                    data-rawdate="${e.date || ''}" 
                                    data-status="${e.status}" 
                                    data-judging="${e.judgingStatus}"
                                    data-can-edit="true">
                                    <i class="fa-solid fa-pen-to-square w-4 text-center text-slate-600 dark:text-slate-300"></i>
                                    <span>Edit Details</span>
                                </button>
                            ` : `
                                <button type="button" class="menu-item-action open-edit-btn w-full px-3.5 py-2 text-left flex items-center gap-2.5 opacity-50 cursor-not-allowed text-slate-400"
                                    data-id="${e.id}" 
                                    data-name="${escapeHtml(e.eventName)}" 
                                    data-status="${e.status}" 
                                    data-judging="${e.judgingStatus}"
                                    data-can-edit="false"
                                    title="Cannot edit: judging is active.">
                                    <i class="fa-solid fa-pen-to-square w-4 text-center text-slate-400"></i>
                                    <span>Edit Details</span>
                                </button>
                            `}
                        </div>

                        <div class="py-1">
                            ${e.status !== 'Archived' ? (
                                canArchive ? `
                                    <button type="button" class="menu-item-action archive-btn w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-400 transition-colors cursor-pointer" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}" data-can-archive="true">
                                        <i class="fa-solid fa-box-archive w-4 text-center text-amber-600"></i>
                                        <span>Archive Event</span>
                                    </button>
                                ` : `
                                    <button type="button" class="menu-item-action archive-btn w-full px-3.5 py-2 text-left flex items-center gap-2.5 opacity-50 cursor-not-allowed text-slate-400" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}" data-can-archive="false" data-judging="${e.judgingStatus}" data-status="${e.status}" title="Cannot archive: judging is active.">
                                        <i class="fa-solid fa-box-archive w-4 text-center text-slate-400"></i>
                                        <span>Archive Event</span>
                                    </button>
                                `
                            ) : ''}
                            <button type="button" class="menu-item-action delete-event-btn w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-bold transition-colors cursor-pointer" data-id="${e.id}" data-name="${escapeHtml(e.eventName)}" data-status="${e.status}">
                                <i class="fa-solid fa-trash-can w-4 text-center text-rose-500"></i>
                                <span>Delete Event</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');

    bindEventCardActions();
    renderEventsPagination(adminEventsPagination, 'admin-events-pagination-container', 'admin-events-pagination-info', 'admin-events-pagination-controls', loadAdminEvents);
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
                <p class="text-xs text-slate-500 mt-0.5">${e.type} &bull; ${formatDateTime(e.date)} &bull; ${escapeHtml(e.venue || 'TBA')}</p>
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
 * SYSTEM & USER AUDIT LOGS VIEW
 * ------------------------------------------------------------- */
function getActionBadge(actionName, rawAction) {
    const text = formatActionTerm(actionName || rawAction || 'Activity');
    const act = (rawAction || actionName || text || '').toLowerCase();

    let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    let icon = 'fa-regular fa-clock';

    if (act.includes('submit')) {
        badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
        icon = 'fa-solid fa-paper-plane';
    } else if (act.includes('draft') || act.includes('save')) {
        badgeClass = 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800';
        icon = 'fa-solid fa-floppy-disk';
    } else if (act.includes('unlock')) {
        badgeClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
        icon = 'fa-solid fa-lock-open';
    } else if (act.includes('lock')) {
        badgeClass = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
        icon = 'fa-solid fa-lock';
    } else if (act.includes('revoke') || act.includes('reject')) {
        badgeClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800';
        icon = 'fa-solid fa-ban';
    } else if (act.includes('delete') || act.includes('clear') || act.includes('decline') || act.includes('remove')) {
        badgeClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800';
        icon = 'fa-solid fa-trash';
    } else if (act.includes('create') || act.includes('add') || act.includes('register') || act.includes('accept') || act.includes('award')) {
        badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
        icon = 'fa-solid fa-circle-plus';
    } else if (act.includes('edit') || act.includes('update') || act.includes('adjust') || act.includes('configure') || act.includes('change')) {
        badgeClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
        icon = 'fa-solid fa-pen-to-square';
    } else if (act.includes('assign')) {
        badgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800';
        icon = 'fa-solid fa-user-check';
    } else if (act.includes('login') || act.includes('sign in') || act.includes('signed in')) {
        badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
        icon = 'fa-solid fa-right-to-bracket';
    } else if (act.includes('logout') || act.includes('sign out') || act.includes('signed out')) {
        badgeClass = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
        icon = 'fa-solid fa-right-from-bracket';
    } else if (act.includes('archive')) {
        badgeClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
        icon = 'fa-solid fa-box-archive';
    } else if (act.includes('verify') || act.includes('verified')) {
        badgeClass = 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800';
        icon = 'fa-solid fa-shield-check';
    } else if (act.includes('reset')) {
        badgeClass = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800';
        icon = 'fa-solid fa-key';
    } else if (act.includes('backup') || act.includes('export')) {
        badgeClass = 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800';
        icon = 'fa-solid fa-cloud-arrow-down';
    }

    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold border ${badgeClass}"><i class="${icon} text-[10px]"></i><span>${escapeHtml(text)}</span></span>`;
}

/* -------------------------------------------------------------
 * SYSTEM & USER AUDIT LOGS VIEW (SEARCH, PAGINATION, ROWS FILTER)
 * ------------------------------------------------------------- */
const auditLogsState = {
    'logs-tbody': {
        page: 1,
        limit: 25,
        search: '',
        role: 'all',
        date: '',
        sort: 'desc',
        total: 0,
        unfilteredTotal: 0,
        totalPages: 1,
        searchInputId: 'logs-search-input',
        clearBtnId: 'logs-search-clear-btn',
        pageSizeId: 'logs-page-size',
        roleFilterId: 'logs-role-filter',
        dateFilterId: 'logs-date-filter',
        dateClearBtnId: 'logs-date-clear-btn',
        dateSortId: 'logs-date-sort',
        timestampHeaderId: 'logs-timestamp-header-btn',
        infoId: 'logs-pagination-info',
        controlsId: 'logs-pagination-controls',
        reqId: 0,
        initialized: false
    },
    'user-logs-tbody': {
        page: 1,
        limit: 25,
        search: '',
        role: 'all',
        date: '',
        sort: 'desc',
        total: 0,
        unfilteredTotal: 0,
        totalPages: 1,
        searchInputId: 'user-logs-search-input',
        clearBtnId: 'user-logs-search-clear-btn',
        pageSizeId: 'user-logs-page-size',
        dateFilterId: 'user-logs-date-filter',
        dateClearBtnId: 'user-logs-date-clear-btn',
        dateSortId: 'user-logs-date-sort',
        timestampHeaderId: 'user-logs-timestamp-header-btn',
        infoId: 'user-logs-pagination-info',
        controlsId: 'user-logs-pagination-controls',
        reqId: 0,
        initialized: false
    }
};

function initAuditLogsControls(tbodyId = 'logs-tbody') {
    const state = auditLogsState[tbodyId];
    if (!state || state.initialized) return;

    const searchInput = document.getElementById(state.searchInputId);
    const clearBtn = document.getElementById(state.clearBtnId);
    const pageSizeSelect = document.getElementById(state.pageSizeId);
    const roleFilter = document.getElementById(state.roleFilterId);
    const dateFilter = document.getElementById(state.dateFilterId);
    const dateClearBtn = document.getElementById(state.dateClearBtnId);
    const dateSort = document.getElementById(state.dateSortId);
    const tsHeaderBtn = document.getElementById(state.timestampHeaderId);
    const sortIconId = tbodyId === 'user-logs-tbody' ? 'user-logs-sort-icon' : 'logs-sort-icon';

    if (searchInput) {
        let debounceTimer = null;
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (clearBtn) {
                if (val.length > 0) {
                    clearBtn.classList.remove('hidden');
                } else {
                    clearBtn.classList.add('hidden');
                }
            }

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                state.search = val;
                state.page = 1;
                loadAuditLogs(tbodyId, 1);
            }, 300);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(debounceTimer);
                state.search = searchInput.value.trim();
                state.page = 1;
                loadAuditLogs(tbodyId, 1);
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
            }
            clearBtn.classList.add('hidden');
            if (state.search !== '') {
                state.search = '';
                state.page = 1;
                loadAuditLogs(tbodyId, 1);
            }
        });
    }

    if (roleFilter) {
        roleFilter.addEventListener('change', (e) => {
            state.role = e.target.value;
            state.page = 1;
            loadAuditLogs(tbodyId, 1);
        });
    }

    if (dateFilter) {
        dateFilter.addEventListener('change', (e) => {
            const val = e.target.value.trim();
            state.date = val;
            if (dateClearBtn) {
                if (val) dateClearBtn.classList.remove('hidden');
                else dateClearBtn.classList.add('hidden');
            }
            state.page = 1;
            loadAuditLogs(tbodyId, 1);
        });
    }

    if (dateClearBtn) {
        dateClearBtn.addEventListener('click', () => {
            if (dateFilter) dateFilter.value = '';
            dateClearBtn.classList.add('hidden');
            if (state.date !== '') {
                state.date = '';
                state.page = 1;
                loadAuditLogs(tbodyId, 1);
            }
        });
    }

    function updateSortDisplay(newSort) {
        state.sort = newSort;
        if (dateSort && dateSort.value !== newSort) {
            dateSort.value = newSort;
        }
        const icon = document.getElementById(sortIconId);
        if (icon) {
            if (newSort === 'asc') {
                icon.className = 'fa-solid fa-arrow-up-short-wide ms-1 text-[11px] text-buksu-navy dark:text-buksu-gold font-bold';
            } else {
                icon.className = 'fa-solid fa-arrow-down-wide-short ms-1 text-[11px] text-buksu-navy dark:text-buksu-gold font-bold';
            }
        }
    }

    if (dateSort) {
        dateSort.addEventListener('change', (e) => {
            updateSortDisplay(e.target.value);
            state.page = 1;
            loadAuditLogs(tbodyId, 1);
        });
    }

    if (tsHeaderBtn) {
        tsHeaderBtn.addEventListener('click', () => {
            const nextSort = state.sort === 'asc' ? 'desc' : 'asc';
            updateSortDisplay(nextSort);
            state.page = 1;
            loadAuditLogs(tbodyId, 1);
        });
    }

    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
            const newLimit = parseInt(e.target.value, 10);
            if ([10, 25, 50, 100].includes(newLimit)) {
                state.limit = newLimit;
                state.page = 1;
                loadAuditLogs(tbodyId, 1);
            }
        });
    }

    // Admin Audit Logs Export Controls
    if (tbodyId === 'logs-tbody') {
        const exportBtn = document.getElementById('logs-export-btn');
        const exportMenu = document.getElementById('logs-export-menu');
        const exportPdfBtn = document.getElementById('logs-export-pdf-btn');
        const exportCsvBtn = document.getElementById('logs-export-csv-btn');

        if (exportBtn && exportMenu) {
            exportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                exportMenu.classList.toggle('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!exportMenu.classList.contains('hidden') && !e.target.closest('#logs-export-dropdown-container')) {
                    exportMenu.classList.add('hidden');
                }
            });
        }

        function getExportParams() {
            const p = new URLSearchParams();
            const searchVal = (searchInput?.value || state.search || '').trim();
            const roleVal = roleFilter?.value || state.role || 'all';
            const dateVal = (dateFilter?.value || state.date || '').trim();
            const sortVal = dateSort?.value || state.sort || 'desc';

            if (searchVal) p.set('search', searchVal);
            if (roleVal && roleVal !== 'all') p.set('role', roleVal);
            if (dateVal) p.set('date', dateVal);
            if (sortVal) p.set('sort', sortVal);
            p.set('tz_offset', new Date().getTimezoneOffset());
            return p.toString();
        }

        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', async () => {
                if (exportMenu) exportMenu.classList.add('hidden');
                showToast("Generating Audit PDF", "Compiling official system audit trail report...", "info");
                const params = getExportParams();
                const endpoint = `/api/logs/export/pdf?${params}&disposition=download`;
                try {
                    const res = await fetch(endpoint);
                    if (res.ok) {
                        const blob = await res.blob();
                        const blobUrl = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        const dateTag = new Date().toISOString().slice(0, 10);
                        a.download = `BukSU_Audit_Trail_${dateTag}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
                        showToast("Audit PDF Ready", "Audit trail report downloaded successfully.", "success");
                    } else {
                        const errData = await res.json().catch(() => ({}));
                        showToast("Export Failed", errData.message || "Failed to generate audit PDF.", "error");
                    }
                } catch (err) {
                    showToast("Export Failed", err.message || "Could not download audit PDF.", "error");
                }
            });
        }

        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', async () => {
                if (exportMenu) exportMenu.classList.add('hidden');
                showToast("Exporting Logs to CSV", "Preparing spreadsheet data...", "info");
                const params = getExportParams();
                const endpoint = `/api/logs/export/csv?${params}`;
                try {
                    const res = await fetch(endpoint);
                    if (res.ok) {
                        const blob = await res.blob();
                        const blobUrl = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        const dateTag = new Date().toISOString().slice(0, 10);
                        a.download = `BukSU_Audit_Logs_${dateTag}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
                        showToast("CSV Downloaded", "Audit logs CSV file downloaded successfully.", "success");
                    } else {
                        showToast("Export Failed", "Failed to generate CSV export.", "error");
                    }
                } catch (err) {
                    showToast("Export Failed", err.message || "Could not download CSV.", "error");
                }
            });
        }
    }

    state.initialized = true;
}

function getPaginationPageList(current, total) {
    if (total <= 7) {
        const pages = [];
        for (let i = 1; i <= total; i++) pages.push(i);
        return pages;
    }
    if (current <= 4) {
        return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
        return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
}

function renderAuditLogsPagination(tbodyId = 'logs-tbody') {
    const state = auditLogsState[tbodyId] || auditLogsState['logs-tbody'];

    // Update "Showing 1 to 100 of 3684 items." counter
    const infoEl = document.getElementById(state.infoId);
    if (infoEl) {
        if (state.total === 0) {
            infoEl.textContent = state.search ? 'Showing 0 items.' : 'Showing 0 items.';
        } else {
            const start = (state.page - 1) * state.limit + 1;
            const end = Math.min(state.page * state.limit, state.total);
            if (state.search && state.unfilteredTotal && state.unfilteredTotal > state.total) {
                infoEl.textContent = `Showing ${start} to ${end} of ${state.total} items (filtered from ${state.unfilteredTotal} total items).`;
            } else {
                infoEl.textContent = `Showing ${start} to ${end} of ${state.total} items.`;
            }
        }
    }

    // Render pagination buttons
    const controlsEl = document.getElementById(state.controlsId);
    if (!controlsEl) return;

    if (state.total === 0 || state.totalPages <= 1) {
        controlsEl.innerHTML = '';
        return;
    }

    const currentPage = state.page;
    const totalPages = state.totalPages;
    const pages = getPaginationPageList(currentPage, totalPages);

    let html = '';

    // Previous Button
    const prevDisabled = currentPage <= 1;
    html += `
        <button type="button" class="logs-page-btn px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 text-xs" data-page="${currentPage - 1}" ${prevDisabled ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-left text-[10px]"></i>
            <span class="hidden sm:inline">Previous</span>
        </button>
    `;

    // Page Numbers
    pages.forEach(p => {
        if (p === '...') {
            html += `<span class="px-2 py-1 text-slate-400 dark:text-slate-500 font-bold select-none text-xs">...</span>`;
        } else if (p === currentPage) {
            html += `
                <button type="button" class="w-8 h-8 rounded-xl bg-buksu-navy dark:bg-buksu-gold text-white dark:text-buksu-navy font-black shadow-xs border border-buksu-navy dark:border-buksu-gold text-xs cursor-default">
                    ${p}
                </button>
            `;
        } else {
            html += `
                <button type="button" class="logs-page-btn w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs cursor-pointer" data-page="${p}">
                    ${p}
                </button>
            `;
        }
    });

    // Next Button
    const nextDisabled = currentPage >= totalPages;
    html += `
        <button type="button" class="logs-page-btn px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 text-xs" data-page="${currentPage + 1}" ${nextDisabled ? 'disabled' : ''}>
            <span class="hidden sm:inline">Next</span>
            <i class="fa-solid fa-chevron-right text-[10px]"></i>
        </button>
    `;

    controlsEl.innerHTML = html;

    controlsEl.querySelectorAll('.logs-page-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = parseInt(btn.dataset.page, 10);
            if (target && target >= 1 && target <= totalPages && target !== currentPage) {
                loadAuditLogs(tbodyId, target);
            }
        });
    });
}

export async function loadAuditLogs(tbodyId = 'logs-tbody', targetPage = null) {
    if (typeof tbodyId !== 'string') {
        tbodyId = 'logs-tbody';
    }

    initAuditLogsControls(tbodyId);

    const state = auditLogsState[tbodyId] || auditLogsState['logs-tbody'];
    if (targetPage !== null && !isNaN(targetPage)) {
        state.page = Math.max(1, parseInt(targetPage, 10));
    }

    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const isUserTable = tbodyId === 'user-logs-tbody';
    const colSpan = isUserTable ? 3 : 4;

    tbody.innerHTML = `<tr><td colspan="${colSpan}" class="px-4 py-8 text-center text-slate-400 dark:text-slate-500"><i class="fa-solid fa-spinner fa-spin me-1.5"></i> Loading activity logs...</td></tr>`;

    const currentReqId = ++state.reqId;

    const res = await listLogs({
        page: state.page,
        limit: state.limit,
        search: state.search,
        role: state.role || 'all',
        date: state.date || '',
        sort: state.sort || 'desc',
        tz_offset: new Date().getTimezoneOffset()
    });

    if (currentReqId !== state.reqId) return;

    if (!res.success || !res.logs) {
        tbody.innerHTML = `<tr><td colspan="${colSpan}" class="px-4 py-6 text-center text-rose-500 text-xs">${escapeHtml(res.message || 'Failed to fetch logs.')}</td></tr>`;
        state.total = 0;
        state.totalPages = 1;
        renderAuditLogsPagination(tbodyId);
        return;
    }

    state.total = typeof res.total === 'number' ? res.total : res.logs.length;
    state.unfilteredTotal = typeof res.unfilteredTotal === 'number' ? res.unfilteredTotal : state.total;
    state.totalPages = typeof res.totalPages === 'number' ? res.totalPages : 1;
    state.page = typeof res.page === 'number' ? res.page : state.page;

    if (res.logs.length === 0) {
        const filters = [];
        if (state.search) filters.push(`keyword "${state.search}"`);
        if (state.role && state.role !== 'all') filters.push(`role "${state.role}"`);
        if (state.date) filters.push(`date "${state.date}"`);

        const emptyMsg = filters.length > 0 
            ? `No activity records found matching ${filters.join(', ')}.` 
            : `No activity records logged yet.`;
        tbody.innerHTML = `<tr><td colspan="${colSpan}" class="px-4 py-8 text-center text-slate-400 dark:text-slate-500 text-xs"><i class="fa-solid fa-inbox text-slate-300 dark:text-slate-600 text-xl block mb-1"></i>${escapeHtml(emptyMsg)}</td></tr>`;
        renderAuditLogsPagination(tbodyId);
        return;
    }

    tbody.innerHTML = res.logs.map(log => {
        const actionBadge = getActionBadge(log.action, log.rawAction);
        if (isUserTable) {
            return `
                <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/90 transition-colors">
                    <td class="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 align-middle whitespace-nowrap">${escapeHtml(formatDateTime(log.timestamp))}</td>
                    <td class="px-4 py-3 text-center align-middle whitespace-nowrap">${actionBadge}</td>
                    <td class="px-4 py-3 text-slate-700 dark:text-slate-200 align-middle font-normal">${escapeHtml(log.details)}</td>
                </tr>
            `;
        }
        return `
            <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/90 transition-colors">
                <td class="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 align-middle whitespace-nowrap">${escapeHtml(formatDateTime(log.timestamp))}</td>
                <td class="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100 align-middle whitespace-nowrap">
                    ${escapeHtml(log.username)}
                    <span class="ms-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${escapeHtml(log.role)}</span>
                </td>
                <td class="px-4 py-3 text-center align-middle whitespace-nowrap">${actionBadge}</td>
                <td class="px-4 py-3 text-slate-700 dark:text-slate-200 align-middle font-normal">${escapeHtml(log.details)}</td>
            </tr>
        `;
    }).join('');

    renderAuditLogsPagination(tbodyId);
}

/* -------------------------------------------------------------
 * JUDGE / TABULATOR ASSIGNED EVENTS VIEW
 * ------------------------------------------------------------- */
export async function loadUserAssignedEvents() {
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

    userEventsPagination.total = res.events.length;
    userEventsPagination.totalPages = Math.max(1, Math.ceil(res.events.length / userEventsPagination.limit));
    if (userEventsPagination.page > userEventsPagination.totalPages) {
        userEventsPagination.page = userEventsPagination.totalPages;
    }

    if (!userEventsPagination.initialized) {
        userEventsPagination.initialized = true;
        document.getElementById('user-events-page-size')?.addEventListener('change', (e) => {
            userEventsPagination.limit = parseInt(e.target.value, 10) || 6;
            userEventsPagination.page = 1;
            loadUserAssignedEvents();
        });
        document.getElementById('refreshUserEventsBtn')?.addEventListener('click', loadUserAssignedEvents);
    }

    if (res.events.length === 0) {
        document.getElementById('user-events-pagination-container')?.classList.add('hidden');
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
    const startIndex = (userEventsPagination.page - 1) * userEventsPagination.limit;
    const paginatedEvents = events.slice(startIndex, startIndex + userEventsPagination.limit);

    grid.innerHTML = paginatedEvents.map(e => `
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
                        <span>${formatDateTime(e.date)}</span>
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
    renderEventsPagination(userEventsPagination, 'user-events-pagination-container', 'user-events-pagination-info', 'user-events-pagination-controls', loadUserAssignedEvents);
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
            showToast("Missing Fields", "Please fill in Event Name, Type, Venue, and Date.", "warning");
            return;
        }

        if (eventName.length > 100) {
            showToast("Invalid Input", "Event title cannot exceed 100 characters.", "warning");
            return;
        }
        if (type.length > 50) {
            showToast("Invalid Input", "Event type cannot exceed 50 characters.", "warning");
            return;
        }
        if (venue.length > 100) {
            showToast("Invalid Input", "Venue cannot exceed 100 characters.", "warning");
            return;
        }
        if (description.length > 500) {
            showToast("Invalid Input", "Description cannot exceed 500 characters.", "warning");
            return;
        }

        const dateCheck = validateCompetitionDate(date);
        if (!dateCheck.valid) {
            showToast("Invalid Date", dateCheck.message, "warning");
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

        // Ongoing events cannot be edited once started unless stopped
        if (isOngoing && !isStopped) {
            showToast("Cannot Update", "Ongoing competitions cannot be edited while started. Please stop the judging period before making changes.", "warning");
            return;
        }

        if (status === 'Archived' && isOngoing && !isStopped) {
            showToast("Cannot Archive", "Cannot archive an ongoing competition. Please stop the judging period before archiving.", "warning");
            return;
        }

        if (eventName.length > 100) {
            showToast("Invalid Input", "Event title cannot exceed 100 characters.", "warning");
            return;
        }
        if (type.length > 50) {
            showToast("Invalid Input", "Event type cannot exceed 50 characters.", "warning");
            return;
        }
        if (venue.length > 100) {
            showToast("Invalid Input", "Venue cannot exceed 100 characters.", "warning");
            return;
        }
        if (description.length > 500) {
            showToast("Invalid Input", "Description cannot exceed 500 characters.", "warning");
            return;
        }

        if (date) {
            const dateCheck = validateCompetitionDate(date);
            if (!dateCheck.valid) {
                showToast("Invalid Date", dateCheck.message, "warning");
                return;
            }
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
        'edit-contestant-modal',
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
                    document.getElementById('edit-contestant-modal')?.classList.add('hidden');
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

function closeAllEventActionDropdowns() {
    document.querySelectorAll('.event-more-actions-menu').forEach(menu => {
        menu.classList.add('hidden');
    });
    document.querySelectorAll('#admin-events-grid .event-card').forEach(card => {
        card.classList.remove('z-30');
        card.style.zIndex = '';
    });
}

function bindEventCardActions() {
    // Card Click -> View Details Modal (only when not clicking an interactive action or dropdown)
    document.querySelectorAll('#admin-events-grid .event-card').forEach(card => {
        card.addEventListener('click', () => openViewEventModal(card.dataset.id));
    });

    // Toggle More Actions Dropdown Menu
    document.querySelectorAll('.event-more-actions-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = btn.closest('.event-card');
            const menu = btn.parentElement.querySelector('.event-more-actions-menu');
            const isCurrentlyOpen = menu && !menu.classList.contains('hidden');

            closeAllEventActionDropdowns();

            if (!isCurrentlyOpen && menu) {
                menu.classList.remove('hidden');
                if (card) {
                    card.classList.add('z-30');
                    card.style.zIndex = '30';
                }
            }
        });
    });

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-container')) {
            closeAllEventActionDropdowns();
        }
    });

    // Close dropdowns on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllEventActionDropdowns();
        }
    });

    // Setup Contestants & Criteria Modal
    document.querySelectorAll('.open-setup-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllEventActionDropdowns();
            openManageSetupModal(btn.dataset.id, btn.dataset.name);
        });
    });

    // Refresh events grid when setup modal is dismissed so counts & start button reactively update
    document.querySelectorAll('#manage-event-setup-modal .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            loadAdminEvents();
        });
    });

    // Toggle Judging Period (Start / Stop)
    document.querySelectorAll('.toggle-judging-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            closeAllEventActionDropdowns();
            const action = btn.dataset.action;
            const eventName = btn.dataset.name;
            const id = btn.dataset.id;
            const canStart = btn.dataset.canStart !== 'false';
            const missing = btn.dataset.missing;

            // Prevent starting completed competition
            if (action === 'start' && (btn.dataset.status === 'Completed' || btn.dataset.judging === 'Finished')) {
                showToast("Competition Completed", "This competition has already finished judging and cannot be restarted.", "info");
                return;
            }

            // Prevent starting if setup is incomplete (no contestants, criteria, judges, or tabulator)
            if (action === 'start' && !canStart) {
                showToast(
                    "Setup Incomplete", 
                    `Cannot start "${eventName}". Please configure ${missing || 'all setup requirements'} before starting the competition.`, 
                    "warning"
                );
                return;
            }

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
            closeAllEventActionDropdowns();
            openTabulationBoardModal(btn.dataset.id, btn.dataset.name);
        });
    });

    // Open Assign Modal
    document.querySelectorAll('.open-assign-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllEventActionDropdowns();
            openAssignModal(btn.dataset.id, btn.dataset.name);
        });
    });

    // Open Executive Summary Report
    document.querySelectorAll('.open-executive-report-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            closeAllEventActionDropdowns();
            const eventId = btn.dataset.id;
            const eventName = btn.dataset.name || 'Competition';
            showToast("Generating Executive Summary", `Creating certified PDF memo for "${eventName}"...`, "info");
            const endpoint = `/api/events/${encodeURIComponent(eventId)}/executive-summary?action=download`;
            try {
                const res = await fetch(endpoint);
                if (res.ok) {
                    const blob = await res.blob();
                    const blobUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    const safeTitle = eventName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
                    a.download = `BukSU_Executive_Summary_${safeTitle}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
                    showToast("Report Downloaded", `Executive summary PDF for "${eventName}" downloaded successfully.`, "success");
                } else {
                    const errData = await res.json().catch(() => ({}));
                    showToast("Report Failed", errData.message || "Failed to generate executive report.", "error");
                }
            } catch (err) {
                showToast("Download Failed", err.message || "Could not fetch report.", "error");
            }
        });
    });

    // Open QR Code Modal
    document.querySelectorAll('.open-qr-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllEventActionDropdowns();
            openEventQrModal(btn.dataset.id, btn.dataset.name);
        });
    });

    // Open Edit Modal
    document.querySelectorAll('.open-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllEventActionDropdowns();

            if (btn.dataset.canEdit === 'false') {
                showToast("Event is Ongoing", "This competition is currently active and ongoing. Edits are locked until the judging period is stopped.", "warning");
                return;
            }

            document.getElementById('edit-ev-id').value = btn.dataset.id;
            document.getElementById('edit-ev-name').value = btn.dataset.name;
            document.getElementById('edit-ev-type').value = btn.dataset.type;
            document.getElementById('edit-ev-venue').value = btn.dataset.venue;
            document.getElementById('edit-ev-status').value = btn.dataset.status;
            document.getElementById('edit-ev-judging-status').value = btn.dataset.judging;
            document.getElementById('edit-ev-date').value = toDateTimeLocalValue(btn.dataset.rawdate);
            document.getElementById('edit-ev-desc').value = btn.dataset.desc;

            const isOngoing = (btn.dataset.status === 'Ongoing' || btn.dataset.judging === 'In Progress');
            const isStopped = (btn.dataset.judging === 'Finished' || btn.dataset.status === 'Completed');
            const canArchive = (!isOngoing || isStopped);

            const ongoingWarning = document.getElementById('edit-event-ongoing-warning');
            const saveBtn = document.getElementById('saveEditEventBtn');
            if (isOngoing && !isStopped) {
                ongoingWarning?.classList.remove('hidden');
                if (saveBtn) saveBtn.disabled = true;
            } else {
                ongoingWarning?.classList.add('hidden');
                if (saveBtn) saveBtn.disabled = false;
            }

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
            closeAllEventActionDropdowns();
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

    // Delete Event (from Dropdown or Card)
    document.querySelectorAll('.delete-event-btn, .delete-archived-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            closeAllEventActionDropdowns();
            const eventName = btn.dataset.name;
            const eventId = btn.dataset.id;
            const status = btn.dataset.status;

            const isOngoing = status === 'Ongoing';
            const extraWarning = isOngoing 
                ? '\n\nWARNING: This competition is currently ongoing! Deleting it will permanently remove all associated contestants, criteria, and scores.' 
                : '';

            if (confirm(`Are you completely sure you want to permanently delete the competition "${eventName}"?${extraWarning}\n\nThis will permanently delete all associated contestants, criteria, and scores. This action cannot be undone.`)) {
                btn.disabled = true;
                const res = await deleteArchivedEvent({ id: eventId });
                btn.disabled = false;
                if (res.success) {
                    showToast("Competition Deleted!", `Competition "${eventName}" was permanently removed.`, "archive");
                    await loadAdminEvents();
                } else {
                    showToast("Deletion Failed", res.message || "Failed to delete competition.", "error");
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
    document.getElementById('view-ev-date').textContent = formatDateTime(event.date);
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

/* -------------------------------------------------------------
 * EVENT QR CODE MODAL & INTEGRATION HANDLERS
 * ------------------------------------------------------------- */
let currentQrEventId = null;
let currentQrType = 'judge';
let currentQrData = null;
let activeParentModal = null;

export async function openEventQrModal(eventId, eventName, parentModal = null) {
    if (document.body.dataset.role === 'judge') {
        showToast('Access Restricted', 'QR code generation and sharing is restricted to Administrators and Tabulators.', 'warning');
        return;
    }

    currentQrEventId = eventId;
    currentQrType = 'judge';

    // Find any currently open modal so we can hide it and let only the QR modal appear
    if (!parentModal) {
        const openModals = Array.from(document.querySelectorAll('.fixed.inset-0:not(.hidden)'));
        activeParentModal = openModals.find(m => m.id !== 'event-qr-modal') || null;
    } else {
        activeParentModal = typeof parentModal === 'string' ? document.getElementById(parentModal) : parentModal;
    }

    if (activeParentModal) {
        activeParentModal.classList.add('hidden');
    }

    const modal = document.getElementById('event-qr-modal');
    const titleEl = document.getElementById('event-qr-modal-title');
    if (titleEl) titleEl.textContent = eventName || `Competition #${eventId}`;

    updateQrTypePills();
    if (modal) modal.classList.remove('hidden');

    await fetchAndRenderQrCode();
}

export function closeEventQrModal() {
    const modal = document.getElementById('event-qr-modal');
    if (modal) modal.classList.add('hidden');

    // Restore previous modal if one was open
    if (activeParentModal) {
        activeParentModal.classList.remove('hidden');
        activeParentModal = null;
    }
}

function updateQrTypePills() {
    const judgeBtn = document.getElementById('event-qr-type-judge');
    const publicBtn = document.getElementById('event-qr-type-public');
    const descEl = document.getElementById('event-qr-modal-desc');

    if (currentQrType === 'judge') {
        if (judgeBtn) {
            judgeBtn.className = 'flex-1 py-1.5 px-2 rounded-lg bg-white text-buksu-navy shadow-xs transition-all cursor-pointer font-bold';
        }
        if (publicBtn) {
            publicBtn.className = 'flex-1 py-1.5 px-2 rounded-lg text-slate-600 hover:text-buksu-navy transition-all cursor-pointer font-bold';
        }
        if (descEl) descEl.textContent = 'Scan for instant direct access to judge scoring sheet.';
    } else {
        if (judgeBtn) {
            judgeBtn.className = 'flex-1 py-1.5 px-2 rounded-lg text-slate-600 hover:text-buksu-navy transition-all cursor-pointer font-bold';
        }
        if (publicBtn) {
            publicBtn.className = 'flex-1 py-1.5 px-2 rounded-lg bg-white text-buksu-navy shadow-xs transition-all cursor-pointer font-bold';
        }
        if (descEl) descEl.textContent = 'Scan to view live public leaderboard & standings.';
    }
}

async function fetchAndRenderQrCode() {
    if (!currentQrEventId) return;

    const loadingEl = document.getElementById('event-qr-loading');
    const imgEl = document.getElementById('event-qr-img');
    const disabledEl = document.getElementById('event-qr-disabled-notice');
    const urlTextEl = document.getElementById('event-qr-url-text');

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (imgEl) imgEl.classList.add('hidden');
    if (disabledEl) disabledEl.classList.add('hidden');
    if (urlTextEl) urlTextEl.textContent = 'Generating...';

    try {
        const resp = await fetch(`/api/events/${encodeURIComponent(currentQrEventId)}/qr`);
        const data = await resp.json();
        currentQrData = data;

        if (loadingEl) loadingEl.classList.add('hidden');

        if (!data.success && data.message && data.message.includes('disabled')) {
            if (disabledEl) disabledEl.classList.remove('hidden');
            if (urlTextEl) urlTextEl.textContent = data.target_url || 'QR Generation Disabled';
            return;
        }

        const qrCodeUrl = data.qr_code_url || data.qr_url;
        if (data.success && qrCodeUrl) {
            currentQrData.qr_code_url = qrCodeUrl;
            if (imgEl) {
                imgEl.src = qrCodeUrl;
                imgEl.onerror = () => {
                    // Fallback to secondary provider if qrserver is blocked or slow
                    if (data.target_url && !imgEl.src.includes('quickchart.io')) {
                        imgEl.src = `https://quickchart.io/qr?text=${encodeURIComponent(data.target_url)}&size=280&margin=2`;
                        currentQrData.qr_code_url = imgEl.src;
                    }
                };
                imgEl.classList.remove('hidden');
            }
            if (urlTextEl) {
                urlTextEl.textContent = data.target_url || '';
            }
        } else {
            if (disabledEl) {
                disabledEl.classList.remove('hidden');
                disabledEl.textContent = data.message || 'Could not generate QR code.';
            }
            if (urlTextEl) urlTextEl.textContent = 'Error loading QR';
        }
    } catch (err) {
        console.error("QR Code fetch error:", err);
        if (loadingEl) loadingEl.classList.add('hidden');
        if (disabledEl) {
            disabledEl.classList.remove('hidden');
            disabledEl.textContent = 'Failed to load QR code due to network error.';
        }
    }
}

function initQrModalControls() {
    const closeBtn = document.getElementById('closeEventQrModalBtn');
    const modal = document.getElementById('event-qr-modal');
    const judgeBtn = document.getElementById('event-qr-type-judge');
    const publicBtn = document.getElementById('event-qr-type-public');
    const copyBtn = document.getElementById('copyEventQrUrlBtn');
    const printBtn = document.getElementById('printQrPlacardBtn');
    const downloadBtn = document.getElementById('downloadQrImgBtn');

    closeBtn?.addEventListener('click', closeEventQrModal);

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeEventQrModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeEventQrModal();
        }
    });

    judgeBtn?.addEventListener('click', () => {
        if (currentQrType !== 'judge') {
            currentQrType = 'judge';
            updateQrTypePills();
            fetchAndRenderQrCode();
        }
    });

    publicBtn?.addEventListener('click', () => {
        if (currentQrType !== 'public') {
            currentQrType = 'public';
            updateQrTypePills();
            fetchAndRenderQrCode();
        }
    });

    copyBtn?.addEventListener('click', async () => {
        const url = currentQrData?.target_url;
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            showToast("Copied!", "Access URL copied to clipboard.", "success");
        } catch (e) {
            const tempInput = document.createElement('input');
            tempInput.value = url;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            showToast("Copied!", "Access URL copied to clipboard.", "success");
        }
    });

    printBtn?.addEventListener('click', () => {
        const qrUrl = currentQrData?.qr_code_url || currentQrData?.qr_url;
        if (!qrUrl) return;
        const win = window.open('', '_blank');
        const eventName = document.getElementById('event-qr-modal-title')?.textContent || 'Competition';
        const typeLabel = currentQrType === 'judge' ? 'Judge Direct Scoring Access' : 'Public Live Leaderboard Access';
        win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${eventName} - QR Placard</title>
                <style>
                    body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; margin: 0; background: #f8fafc; }
                    .card { border: 3px solid #0F172A; border-radius: 24px; padding: 32px; max-width: 420px; margin: auto; background: #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
                    h1 { font-size: 20px; color: #0F172A; margin: 0 0 4px; text-transform: uppercase; font-weight: 900; }
                    h2 { font-size: 13px; color: #475569; margin: 0 0 20px; font-weight: 700; }
                    img { width: 240px; height: 240px; border: 1px solid #CBD5E1; border-radius: 16px; padding: 12px; background: #fff; }
                    p { font-size: 12px; color: #64748B; margin-top: 16px; font-weight: 500; }
                    .url { font-family: monospace; font-size: 11px; background: #F1F5F9; padding: 8px 12px; border-radius: 8px; word-break: break-all; margin-top: 8px; color: #0F172A; }
                </style>
            </head>
            <body onload="window.print()">
                <div class="card">
                    <h1>${eventName}</h1>
                    <h2>${typeLabel}</h2>
                    <img src="${qrUrl}" alt="QR Code">
                    <p>Scan with your phone's camera to access immediately.</p>
                    <div class="url">${currentQrData.target_url}</div>
                </div>
            </body>
            </html>
        `);
        win.document.close();
    });

    downloadBtn?.addEventListener('click', async () => {
        const qrUrl = currentQrData?.qr_code_url || currentQrData?.qr_url;
        if (!qrUrl) return;
        try {
            const resp = await fetch(qrUrl);
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `event_qr_${currentQrEventId}_${currentQrType}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            window.open(qrUrl, '_blank');
        }
    });
}
