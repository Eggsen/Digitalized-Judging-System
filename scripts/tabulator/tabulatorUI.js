import { getScores } from "/scripts/admin/judgingAPI.js";
import { showToast } from "/scripts/utils/uiUtils.js";

let currentEventId = null;
let pollInterval = null;
let cachedData = null;

export function initTabulatorUI() {
    const modal = document.getElementById('tabulation-board-modal');
    if (!modal) return;

    // Close buttons
    modal.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            closeTabulationModal();
        });
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeTabulationModal();
    });

    // Refresh button
    document.getElementById('refreshTabulationBtn')?.addEventListener('click', () => {
        loadTabulationData(true);
    });

    // Print button
    document.getElementById('printTabulationBtn')?.addEventListener('click', () => {
        window.print();
    });
}

export async function openTabulationBoardModal(eventId, eventName) {
    const modal = document.getElementById('tabulation-board-modal');
    if (!modal) return;

    currentEventId = parseInt(eventId);
    document.getElementById('tabulation-event-title').textContent = eventName || `Competition #${currentEventId}`;
    modal.classList.remove('hidden');

    // Initial load
    await loadTabulationData(false);

    // Setup real-time polling every 3 seconds
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
        loadTabulationData(false);
    }, 3000);
}

export function closeTabulationModal() {
    const modal = document.getElementById('tabulation-board-modal');
    if (modal) modal.classList.add('hidden');
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

async function loadTabulationData(isManual = false) {
    if (!currentEventId) return;

    const res = await getScores(currentEventId);
    if (!res.success) {
        if (isManual) showToast(res.message || 'Failed to update tabulation board.', 'error');
        return;
    }

    cachedData = res;
    renderTabulationBoard(res);

    if (isManual) {
        showToast('Tabulation board refreshed!', 'success');
    }
}

function renderTabulationBoard(data) {
    const { event, judges = [], matrix = [], stats = {} } = data;

    // Header status & live indicator
    const judgingStatusEl = document.getElementById('tab-event-judging-badge');
    if (judgingStatusEl) {
        const jStatus = event.judgingStatus || 'Not Yet Started';
        judgingStatusEl.textContent = jStatus;
        if (jStatus === 'In Progress') {
            judgingStatusEl.className = 'px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse';
        } else if (jStatus === 'Finished') {
            judgingStatusEl.className = 'px-3 py-1 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-300';
        } else {
            judgingStatusEl.className = 'px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300';
        }
    }

    // Stats Bar
    const statsContainer = document.getElementById('tab-stats-container');
    if (statsContainer && stats) {
        const totalSubmitted = stats.total_submitted || 0;
        const totalExpected = stats.total_expected || 0;
        const pct = totalExpected > 0 ? Math.round((totalSubmitted / totalExpected) * 100) : 0;

        statsContainer.innerHTML = `
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs w-full">
                <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contestants</span>
                    <span class="text-base font-extrabold text-slate-800">${stats.total_contestants || 0} Entries</span>
                </div>
                <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Judges Panel</span>
                    <span class="text-base font-extrabold text-slate-800">${judges.length} Judges</span>
                </div>
                <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scores Received</span>
                    <span class="text-base font-extrabold ${pct === 100 ? 'text-emerald-600' : 'text-slate-800'}">${totalSubmitted} / ${totalExpected} (${pct}%)</span>
                </div>
                <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tabulation Status</span>
                    <span class="text-xs font-black uppercase ${stats.is_completed ? 'text-emerald-600' : 'text-amber-600'}">
                        ${stats.is_completed ? '<i class="fa-solid fa-circle-check me-1"></i> Completed' : '<i class="fa-solid fa-hourglass-half me-1 animate-pulse"></i> In Tabulation'}
                    </span>
                </div>
            </div>
        `;
    }

    // Render Table Matrix
    const tableHead = document.getElementById('tab-table-head');
    const tableBody = document.getElementById('tab-table-body');
    if (!tableHead || !tableBody) return;

    // Build Table Header
    let theadHtml = `
        <tr class="bg-slate-100/90 text-slate-700 text-[11px] font-extrabold uppercase tracking-wider">
            <th class="py-3 px-4 text-center rounded-tl-xl w-14">Rank</th>
            <th class="py-3 px-4 text-left">Contestant Entry</th>
    `;

    judges.forEach(j => {
        theadHtml += `
            <th class="py-3 px-3 text-center whitespace-nowrap">
                <div class="font-extrabold text-slate-800">${escapeHtml(j.username)}</div>
                <div class="text-[9px] font-normal text-slate-400 normal-case">Official Judge</div>
            </th>
        `;
    });

    theadHtml += `
            <th class="py-3 px-4 text-center bg-indigo-50/60 text-indigo-900 rounded-tr-xl">Average Score</th>
        </tr>
    `;
    tableHead.innerHTML = theadHtml;

    // Build Table Body
    if (matrix.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="${2 + judges.length + 1}" class="py-12 text-center text-slate-400 text-xs">
                    <i class="fa-solid fa-clipboard-list text-2xl text-slate-300 mb-2"></i>
                    <p class="font-bold text-slate-600">No contestants registered yet</p>
                </td>
            </tr>
        `;
        return;
    }

    let tbodyHtml = '';
    matrix.forEach(row => {
        let rankBadge = '';
        let rowClass = 'hover:bg-slate-50/80 transition-colors border-b border-slate-100';

        if (row.rank === 1) {
            rankBadge = '<span class="w-8 h-8 rounded-full bg-amber-400 text-buksu-navy font-black text-xs inline-flex items-center justify-center shadow-sm border border-amber-300"><i class="fa-solid fa-trophy"></i></span>';
            rowClass += ' bg-amber-50/20';
        } else if (row.rank === 2) {
            rankBadge = '<span class="w-8 h-8 rounded-full bg-slate-300 text-slate-800 font-black text-xs inline-flex items-center justify-center shadow-sm border border-slate-400"><i class="fa-solid fa-medal"></i></span>';
        } else if (row.rank === 3) {
            rankBadge = '<span class="w-8 h-8 rounded-full bg-amber-700/80 text-white font-black text-xs inline-flex items-center justify-center shadow-sm border border-amber-800"><i class="fa-solid fa-award"></i></span>';
        } else {
            rankBadge = `<span class="w-7 h-7 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs inline-flex items-center justify-center">${row.rank}</span>`;
        }

        tbodyHtml += `
            <tr class="${rowClass}">
                <td class="py-3.5 px-4 text-center align-middle">
                    ${rankBadge}
                </td>
                <td class="py-3.5 px-4 align-middle">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-buksu-navy text-buksu-gold font-black text-xs flex items-center justify-center shrink-0 border border-buksu-gold/30">
                            #${row.contestant_number}
                        </div>
                        <div>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <h4 class="font-extrabold text-slate-800 text-xs">${escapeHtml(row.name)}</h4>
                                ${row.entry_type === 'team' ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">Team</span>` : ''}
                            </div>
                            <p class="text-[11px] text-slate-500 font-normal">${escapeHtml(row.department_or_org || 'Independent')}</p>
                            ${row.team_members && row.team_members.length > 0 ? `<p class="text-[10px] text-indigo-900/80 font-medium line-clamp-1"><i class="fa-solid fa-users text-indigo-500 me-1"></i>${escapeHtml(row.team_members.join(', '))}</p>` : ''}
                            ${row.comments && row.comments.length > 0 ? `<div class="flex items-center gap-1 mt-0.5 flex-wrap">${row.comments.map(c => `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-300"><i class="fa-solid fa-award text-amber-600 me-0.5"></i>${escapeHtml(c.text)}</span>`).join('')}</div>` : ''}
                        </div>
                    </div>
                </td>
        `;

        // Scores per Judge
        judges.forEach(j => {
            const entry = row.judge_scores ? row.judge_scores[j.id] : null;
            let scoreCell = '<span class="text-slate-300 text-xs font-semibold">&mdash;</span>';

            if (entry) {
                if (entry.status === 'submitted') {
                    scoreCell = `
                        <div class="inline-flex flex-col items-center">
                            <span class="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                ${parseFloat(entry.total_score).toFixed(2)}%
                            </span>
                            <span class="text-[9px] text-emerald-600 font-semibold mt-0.5"><i class="fa-solid fa-circle-check"></i> Final</span>
                        </div>
                    `;
                } else if (entry.status === 'draft') {
                    scoreCell = `
                        <div class="inline-flex flex-col items-center opacity-70">
                            <span class="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                ${parseFloat(entry.total_score).toFixed(2)}%
                            </span>
                            <span class="text-[9px] text-amber-600 font-semibold mt-0.5"><i class="fa-solid fa-pen-ruler"></i> Draft</span>
                        </div>
                    `;
                } else {
                    scoreCell = `
                        <span class="text-[10px] text-slate-400 italic bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60">
                            Pending
                        </span>
                    `;
                }
            }

            tbodyHtml += `
                <td class="py-3.5 px-3 text-center align-middle">
                    ${scoreCell}
                </td>
            `;
        });

        // Average score
        tbodyHtml += `
                <td class="py-3.5 px-4 text-center align-middle bg-indigo-50/40">
                    <span class="text-sm font-black text-buksu-navy font-mono">
                        ${row.submitted_count > 0 ? `${row.average_score.toFixed(2)}%` : '<span class="text-slate-400 font-normal text-xs">No submissions</span>'}
                    </span>
                    ${row.submitted_count > 0 ? `<div class="text-[9px] text-slate-400 font-normal">from ${row.submitted_count}/${judges.length} judges</div>` : ''}
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = tbodyHtml;
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
