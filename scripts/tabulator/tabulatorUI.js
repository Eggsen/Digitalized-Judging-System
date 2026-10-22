import { getScores, unlockJudgeScore } from "/scripts/admin/judgingAPI.js";
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
    const { event, judges = [], matrix = [], stats = {}, settings = {}, role = '' } = data;
    const judgingSettings = settings.judging || {};
    const branding = settings.branding || {};
    const precision = parseInt(judgingSettings.decimalPrecision ?? 2);
    const tabulationMethod = judgingSettings.tabulationMethod || 'standard_average';
    const tieBreakerRule = judgingSettings.tieBreakerRule || 'highest_weight_criterion';
    const unlockPolicy = judgingSettings.unlockPolicy || 'admin_approval';

    // Update Print Header & Signatories
    const printInstEl = document.getElementById('tab-print-institution');
    if (printInstEl) {
        printInstEl.textContent = branding.institutionName || 'Bukidnon State University';
    }
    const printTitleEl = document.getElementById('tab-print-event-title');
    if (printTitleEl) {
        printTitleEl.textContent = `${event.eventName || `Competition #${currentEventId}`} — Official Tabulation Matrix`;
    }
    const printDateEl = document.getElementById('tab-print-date');
    if (printDateEl) {
        printDateEl.textContent = new Date().toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    }

    // Watermark
    const watermarkEl = document.getElementById('tab-print-watermark');
    const watermarkTextEl = document.getElementById('tab-print-watermark-text');
    if (watermarkEl && watermarkTextEl) {
        if (branding.watermarkEnabled) {
            watermarkTextEl.textContent = branding.watermarkText || 'OFFICIAL TABULATION SHEET';
            watermarkEl.classList.remove('hidden');
        } else {
            watermarkEl.classList.add('hidden');
        }
    }

    // Signatories
    const signatoriesContainer = document.getElementById('tab-signatories-grid');
    if (signatoriesContainer) {
        const defaultSignatories = [
            { name: "John Doe", role: "Tabulator" },
            { name: "Jane Smith", role: "Head Tabulator" },
            { name: "Dr. Alex Morgan", role: "Chairman of the Board" }
        ];
        const signatories = (Array.isArray(branding.signatories) && branding.signatories.length === 3) 
            ? branding.signatories 
            : defaultSignatories;

        signatoriesContainer.innerHTML = signatories.map(sig => `
            <div class="flex flex-col items-center">
                <div class="w-48 border-b-2 border-slate-800 mb-2 h-12"></div>
                <span class="text-xs font-black uppercase text-slate-900 leading-tight">${escapeHtml(sig.name || 'Signatory Name')}</span>
                <span class="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mt-0.5">${escapeHtml(sig.role || 'Designated Signatory')}</span>
            </div>
        `).join('');
    }

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
                    let unlockBtnHtml = '';
                    if ((role === 'admin' || role === 'tabulator') && unlockPolicy !== 'locked_after_submit') {
                        unlockBtnHtml = `
                            <button type="button" class="unlock-judge-score-btn text-[9px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-1.5 py-0.5 rounded border border-slate-200 hover:border-rose-200 transition-colors inline-flex items-center gap-1 mt-1 cursor-pointer" data-contestant-id="${row.contestant_id}" data-judge-id="${j.id}" data-judge-name="${escapeHtml(j.username)}" data-contestant-name="${escapeHtml(row.name)}" title="Unlock score to allow judge to edit">
                                <i class="fa-solid fa-lock-open text-[8px]"></i> Unlock
                            </button>
                        `;
                    }

                    scoreCell = `
                        <div class="inline-flex flex-col items-center">
                            <span class="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                ${parseFloat(entry.total_score).toFixed(precision)}%
                            </span>
                            <span class="text-[9px] text-emerald-600 font-semibold mt-0.5"><i class="fa-solid fa-circle-check"></i> Final</span>
                            ${unlockBtnHtml}
                        </div>
                    `;
                } else if (entry.status === 'draft') {
                    scoreCell = `
                        <div class="inline-flex flex-col items-center opacity-70">
                            <span class="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                ${parseFloat(entry.total_score).toFixed(precision)}%
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

        // Average score with method badges
        let methodBadges = '';
        if (row.is_olympic_trimmed) {
            methodBadges += `<span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 inline-block mb-1" title="Olympic Trimming Applied (Highest & Lowest judge score excluded)">Olympic Trimmed</span>`;
        }
        if (tabulationMethod === 'ordinal_ranking' && row.rank_sum !== undefined) {
            methodBadges += `<div class="text-[10px] font-extrabold text-indigo-700 mb-0.5">Rank Sum: ${row.rank_sum}</div>`;
        }

        tbodyHtml += `
                <td class="py-3.5 px-4 text-center align-middle bg-indigo-50/40">
                    ${methodBadges}
                    <div class="text-sm font-black text-buksu-navy font-mono">
                        ${row.submitted_count > 0 ? `${parseFloat(row.average_score).toFixed(precision)}%` : '<span class="text-slate-400 font-normal text-xs">No submissions</span>'}
                    </div>
                    ${row.submitted_count > 0 ? `<div class="text-[9px] text-slate-400 font-normal">from ${row.submitted_count}/${judges.length} judges</div>` : ''}
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = tbodyHtml;

    // Bind Unlock Score button click handlers
    tableBody.querySelectorAll('.unlock-judge-score-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const cid = btn.dataset.contestantId;
            const jid = btn.dataset.judgeId;
            const jName = btn.dataset.judgeName;
            const cName = btn.dataset.contestantName;

            if (!confirm(`Unlock submitted score by Judge "${jName}" for "${cName}"?\n\nThis will return the score to draft status so the judge can revise and re-submit.`)) {
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[8px]"></i> Unlocking...';

            const res = await unlockJudgeScore(currentEventId, cid, jid);
            if (res.success) {
                showToast(res.message || 'Score unlocked successfully!', 'success');
                await loadTabulationData(false);
            } else {
                showToast(res.message || 'Failed to unlock score.', 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-lock-open text-[8px]"></i> Unlock';
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
