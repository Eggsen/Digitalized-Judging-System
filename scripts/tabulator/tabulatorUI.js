import { getScores, unlockJudgeScore, verifyJudgeScore, unverifyJudgeScore, verifyAllJudgeScores } from "/scripts/admin/judgingAPI.js";
import { showToast } from "/scripts/utils/uiUtils.js";
import { openEventQrModal } from "/scripts/admin/eventsUI.js";
import { subscribeToEventChannel, unsubscribeFromEventChannel, onWebSocketStatusChange, getWebSocketStatus } from "/scripts/utils/websocket.js";

let currentEventId = null;
let pollInterval = null;
let cachedData = null;
let wsStatusUnsub = null;
let activeBreakdownContestantId = null;
let activeBreakdownJudgeId = null;

function updateSyncIndicator(status) {
    const indicator = document.getElementById('tab-live-sync-indicator');
    if (!indicator) return;

    if (status === 'connected') {
        indicator.innerHTML = `
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="text-emerald-700 font-bold flex items-center gap-1.5">
                <i class="fa-solid fa-bolt text-amber-500"></i> Real-Time WebSocket Live
            </span>
        `;
    } else if (status === 'connecting') {
        indicator.innerHTML = `
            <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
            <span class="text-slate-500">Connecting real-time stream...</span>
        `;
    } else {
        indicator.innerHTML = `
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span class="text-slate-400">Live auto-syncing every 3s (Polling fallback)</span>
        `;
    }
}

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

    // Score Breakdown Modal close buttons & backdrop click
    const breakdownModal = document.getElementById('score-breakdown-modal');
    if (breakdownModal) {
        breakdownModal.querySelectorAll('.close-breakdown-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                closeScoreBreakdownModal();
            });
        });

        breakdownModal.addEventListener('click', (e) => {
            if (e.target === breakdownModal) closeScoreBreakdownModal();
        });
    }

    // Refresh button
    document.getElementById('refreshTabulationBtn')?.addEventListener('click', () => {
        loadTabulationData(true);
    });

    // Verify All button
    document.getElementById('tabVerifyAllBtn')?.addEventListener('click', async () => {
        if (!currentEventId || !cachedData) return;
        const { stats = {} } = cachedData;
        const unverifiedCount = (stats.total_submitted || 0) - (stats.total_verified || 0);
        if (unverifiedCount <= 0) {
            showToast('All Scores Verified', 'All submitted scores are already verified.', 'info');
            return;
        }

        if (!confirm(`Verify and certify all ${unverifiedCount} final submitted judge score(s)?\n\nThis will certify all scores and make the official Print Matrix & PDF generation available.`)) {
            return;
        }

        const btn = document.getElementById('tabVerifyAllBtn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i> Verifying All...';
        }

        const res = await verifyAllJudgeScores(currentEventId);
        if (res.success) {
            showToast('All Scores Certified!', res.message || 'All final scores have been verified.', 'success');
            await loadTabulationData(false);
        } else {
            showToast(res.message || 'Failed to verify all scores.', 'error');
            if (btn) btn.disabled = false;
        }
    });

    // Print button wrapper (lock feedback) & Print button
    document.getElementById('printTabulationWrapper')?.addEventListener('click', () => {
        const printBtn = document.getElementById('printTabulationBtn');
        if (printBtn && printBtn.disabled) {
            showToast("Print Matrix Locked", printBtn.title || "All final scores must be verified before generating PDF / Print Matrix.", "warning");
        }
    });

    document.getElementById('printTabulationBtn')?.addEventListener('click', () => {
        const printBtn = document.getElementById('printTabulationBtn');
        if (printBtn && !printBtn.disabled) {
            window.print();
        }
    });

    // QR Access button
    document.getElementById('openTabulationQrBtn')?.addEventListener('click', () => {
        const eventName = document.getElementById('tabulation-event-title')?.textContent || `Competition #${currentEventId}`;
        if (currentEventId) {
            openEventQrModal(currentEventId, eventName, 'tabulation-board-modal');
        }
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

    // Initial sync indicator state
    updateSyncIndicator(getWebSocketStatus());

    // Listen to WebSocket status changes to adjust polling interval dynamically
    if (wsStatusUnsub) wsStatusUnsub();
    wsStatusUnsub = onWebSocketStatusChange((status) => {
        updateSyncIndicator(status);

        if (pollInterval) clearInterval(pollInterval);
        // If WebSocket is connected, relax polling to 25s heartbeat; otherwise use fast 3s polling
        const intervalMs = (status === 'connected') ? 25000 : 3000;
        pollInterval = setInterval(() => {
            loadTabulationData(false);
        }, intervalMs);
    });

    // Subscribe to real-time WebSocket channel for instant updates
    subscribeToEventChannel(currentEventId, {
        onScoreUpdated: (data) => {
            console.log('⚡ [Live Tabulation] Real-time score update received:', data);
            loadTabulationData(false);
            if (data.judge_name && data.contestant_name) {
                showToast("Live Score Received", `Judge ${data.judge_name} submitted a score for ${data.contestant_name}.`, "info");
            }
        },
        onScoreUnlocked: (data) => {
            console.log('⚡ [Live Tabulation] Score unlocked in real-time:', data);
            loadTabulationData(false);
        },
        onScoreVerified: (data) => {
            console.log('⚡ [Live Tabulation] Score verification update in real-time:', data);
            loadTabulationData(false);
            if (activeBreakdownContestantId && String(activeBreakdownContestantId) === String(data.contestant_id) && activeBreakdownJudgeId && String(activeBreakdownJudgeId) === String(data.judge_id)) {
                setTimeout(() => {
                    openScoreBreakdownModal(activeBreakdownContestantId, activeBreakdownJudgeId);
                }, 200);
            }
        },
        onJudgingStatusChanged: (data) => {
            console.log('⚡ [Live Tabulation] Judging status changed:', data);
            loadTabulationData(false);
            if (data.judgingStatus) {
                showToast("Judging Status Updated", `Judging period is now ${data.judgingStatus}.`, "info");
            }
        }
    });

    // Setup initial polling interval (3s default, will adjust when WS connects)
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
        loadTabulationData(false);
    }, 3000);
}

export function closeTabulationModal() {
    closeScoreBreakdownModal();
    const modal = document.getElementById('tabulation-board-modal');
    if (modal) modal.classList.add('hidden');

    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }

    if (currentEventId) {
        unsubscribeFromEventChannel(currentEventId);
    }

    if (wsStatusUnsub) {
        wsStatusUnsub();
        wsStatusUnsub = null;
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
    const screenTitleEl = document.getElementById('tabulation-event-title');
    if (screenTitleEl && event?.eventName) {
        screenTitleEl.textContent = event.eventName;
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

    // Dynamic Institution Logo on Print Header
    const printLogoEl = document.getElementById('tab-print-logo');
    if (printLogoEl) {
        printLogoEl.src = branding.logoUrl || '/assets/logo/DJS Logo.png';
        printLogoEl.style.display = 'block';
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

    // Digital QR Verification Seal
    const qrSealEl = document.getElementById('tab-print-qr-seal');
    if (qrSealEl) {
        if (settings.security?.qrCodeEnabled !== false && currentEventId) {
            fetch(`/backend/crud/get_event_qr.php?event_id=${encodeURIComponent(currentEventId)}&type=public`)
                .then(r => r.json())
                .then(qrRes => {
                    const sealQr = qrRes.qr_code_url || qrRes.qr_url;
                    if (qrRes.success && sealQr) {
                        qrSealEl.src = sealQr;
                        qrSealEl.style.display = 'block';
                    } else {
                        qrSealEl.style.display = 'none';
                    }
                })
                .catch(() => {
                    qrSealEl.style.display = 'none';
                });
        } else {
            qrSealEl.style.display = 'none';
        }
    }

    // Header status & live indicator
    const judgingStatusEl = document.getElementById('tab-event-judging-badge');
    if (judgingStatusEl) {
        const jStatus = event.judgingStatus || 'Not Yet Started';
        judgingStatusEl.textContent = jStatus;
        if (jStatus === 'In Progress') {
            judgingStatusEl.className = 'px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse';
        } else if (jStatus === 'Finished') {
            judgingStatusEl.className = 'px-3 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-800 border border-slate-300';
        } else {
            judgingStatusEl.className = 'px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300';
        }
    }

    // Stats Bar
    const statsContainer = document.getElementById('tab-stats-container');
    if (statsContainer && stats) {
        const totalSubmitted = stats.total_submitted || 0;
        const totalVerified = stats.total_verified || 0;
        const totalExpected = stats.total_expected || 0;
        const pct = totalExpected > 0 ? Math.round((totalSubmitted / totalExpected) * 100) : 0;
        const verPct = totalExpected > 0 ? Math.round((totalVerified / totalExpected) * 100) : 0;

        statsContainer.innerHTML = `
            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 text-xs w-full">
                <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contestants</span>
                    <span class="text-base font-extrabold text-slate-800">${stats.total_contestants || 0} Entries</span>
                </div>
                <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Judges Panel</span>
                    <span class="text-base font-extrabold text-slate-800">${judges.length} Judges</span>
                </div>
                <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Final Scores Received</span>
                    <span class="text-base font-extrabold ${pct === 100 ? 'text-emerald-600' : 'text-slate-800'}">${totalSubmitted} / ${totalExpected} (${pct}%)</span>
                </div>
                <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tabulator Verified</span>
                    <span class="text-base font-extrabold ${totalVerified >= totalExpected && totalExpected > 0 ? 'text-emerald-600' : (totalVerified > 0 ? 'text-amber-600' : 'text-slate-700')}">
                        ${totalVerified} / ${totalExpected} (${verPct}%)
                    </span>
                </div>
                <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 col-span-2 sm:col-span-4 lg:col-span-1">
                    <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tabulation Status</span>
                    <span class="text-xs font-black uppercase ${stats.is_all_verified ? 'text-emerald-600' : (stats.is_completed ? 'text-amber-600' : 'text-slate-700')}">
                        ${stats.is_all_verified 
                            ? '<i class="fa-solid fa-certificate me-1"></i> Certified &bull; PDF Ready' 
                            : (stats.is_completed 
                                ? '<i class="fa-solid fa-shield-halved me-1 animate-pulse"></i> Awaiting Verification' 
                                : '<i class="fa-solid fa-hourglass-half me-1"></i> In Tabulation')}
                    </span>
                </div>
            </div>
        `;
    }

    // Update Verify All Final Scores button
    const verifyAllBtn = document.getElementById('tabVerifyAllBtn');
    if (verifyAllBtn) {
        const totalSubmitted = stats.total_submitted || 0;
        const totalVerified = stats.total_verified || 0;
        const unverifiedCount = totalSubmitted - totalVerified;
        if ((role === 'admin' || role === 'tabulator') && unverifiedCount > 0) {
            verifyAllBtn.innerHTML = `<i class="fa-solid fa-shield-check"></i> Verify All (${unverifiedCount} Final)`;
            verifyAllBtn.classList.remove('hidden');
            verifyAllBtn.disabled = false;
        } else {
            verifyAllBtn.classList.add('hidden');
        }
    }

    // Update Print Matrix button state (Locked until ALL final scores are verified)
    const printBtn = document.getElementById('printTabulationBtn');
    if (printBtn) {
        const totalSubmitted = stats.total_submitted || 0;
        const totalVerified = stats.total_verified || 0;
        const totalExpected = stats.total_expected || 0;
        const isAllVerified = Boolean(stats.is_all_verified);

        if (isAllVerified) {
            printBtn.disabled = false;
            printBtn.className = "px-3.5 py-1.5 bg-buksu-navy hover:bg-buksu-navy-light text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5";
            printBtn.innerHTML = '<i class="fa-solid fa-print"></i> Print Matrix / PDF';
            printBtn.title = "Print or export official certified tabulation matrix PDF";
        } else {
            printBtn.disabled = true;
            printBtn.className = "px-3.5 py-1.5 bg-slate-100 text-slate-400 border border-slate-200 font-bold text-xs rounded-xl transition-all cursor-not-allowed flex items-center gap-1.5 disabled:pointer-events-none";
            printBtn.innerHTML = '<i class="fa-solid fa-lock text-slate-400"></i> Print Matrix';

            let msg = "Official Print Matrix is unavailable until all final judge scores are verified.";
            if (totalSubmitted < totalExpected) {
                msg = `Print Matrix is locked: Incomplete submissions (${totalSubmitted}/${totalExpected} scores submitted). All scores must be submitted and verified before generating PDF.`;
            } else if (totalVerified < totalSubmitted) {
                msg = `Print Matrix is locked: ${totalSubmitted - totalVerified} final score(s) awaiting verification. Click 'Verify' on each final score or 'Verify All Scores' to unlock.`;
            }
            printBtn.title = msg;
        }
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
            <th class="py-3 px-4 text-center bg-slate-100 text-buksu-navy font-black rounded-tr-xl">Average Score</th>
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
                                ${row.entry_type === 'team' ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-buksu-navy border border-slate-200">Team</span>` : ''}
                            </div>
                            <p class="text-[11px] text-slate-500 font-normal">${escapeHtml(row.department_or_org || 'Independent')}</p>
                            ${row.team_members && row.team_members.length > 0 ? `<p class="text-[10px] text-slate-600 font-medium line-clamp-1"><i class="fa-solid fa-users text-buksu-navy me-1"></i>${escapeHtml(row.team_members.join(', '))}</p>` : ''}
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
                            <button type="button" class="unlock-judge-score-btn no-print text-[9px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-1.5 py-0.5 rounded border border-slate-200 hover:border-rose-200 transition-colors inline-flex items-center gap-1 mt-1 cursor-pointer" data-contestant-id="${row.contestant_id}" data-judge-id="${j.id}" data-judge-name="${escapeHtml(j.username)}" data-contestant-name="${escapeHtml(row.name)}" title="Unlock score to allow judge to edit">
                                <i class="fa-solid fa-lock-open text-[8px]"></i> Unlock
                            </button>
                        `;
                    }

                    const isVerified = Boolean(entry.is_verified);
                    let verifyBadgeHtml = '';
                    if (isVerified) {
                        verifyBadgeHtml = `
                            <span class="text-[9px] text-emerald-800 bg-emerald-100/90 font-extrabold px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-1 mt-0.5 shadow-2xs">
                                <i class="fa-solid fa-shield-check text-emerald-600 text-[8px]"></i> Final &bull; Verified
                            </span>
                        `;
                    } else {
                        verifyBadgeHtml = `
                            <span class="text-[9px] text-amber-800 bg-amber-100 font-extrabold px-1.5 py-0.5 rounded border border-amber-300 flex items-center gap-1 mt-0.5 shadow-2xs animate-pulse">
                                <i class="fa-solid fa-shield text-amber-600 text-[8px]"></i> Final &bull; Verify
                            </span>
                        `;
                    }

                    scoreCell = `
                        <div class="inline-flex flex-col items-center">
                            <button type="button" class="view-score-breakdown-btn group flex flex-col items-center p-1.5 rounded-xl hover:bg-slate-100/80 transition-all cursor-pointer border border-transparent hover:border-slate-300 no-print" data-contestant-id="${row.contestant_id}" data-judge-id="${j.id}" title="Click to inspect itemized criteria breakdown and verify score">
                                <span class="text-xs font-black ${isVerified ? 'text-emerald-800 bg-emerald-50 border-emerald-300' : 'text-slate-800 bg-slate-50 border-slate-300'} px-2.5 py-0.5 rounded-md border group-hover:scale-105 transition-transform shadow-2xs">
                                    ${parseFloat(entry.total_score).toFixed(precision)}%
                                </span>
                                ${verifyBadgeHtml}
                            </button>
                            <div class="hidden print-only text-center">
                                <div class="text-xs font-black text-slate-800 font-mono">${parseFloat(entry.total_score).toFixed(precision)}%</div>
                                <div class="text-[8px] text-slate-500 uppercase">${isVerified ? 'Verified' : 'Final'}</div>
                            </div>
                            ${unlockBtnHtml}
                        </div>
                    `;
                } else if (entry.status === 'draft') {
                    scoreCell = `
                        <div class="inline-flex flex-col items-center">
                            <button type="button" class="view-score-breakdown-btn group flex flex-col items-center p-1.5 rounded-xl hover:bg-slate-100/60 transition-all cursor-pointer border border-transparent hover:border-slate-300 no-print" data-contestant-id="${row.contestant_id}" data-judge-id="${j.id}" title="Judge is currently drafting scores. Draft scores cannot be verified until officially submitted.">
                                <span class="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200 group-hover:scale-105 transition-transform">
                                    ${parseFloat(entry.total_score || 0).toFixed(precision)}%
                                </span>
                                <span class="text-[9px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                                    <i class="fa-solid fa-pen-ruler text-[8px]"></i> In-Progress Draft
                                </span>
                            </button>
                            <div class="hidden print-only text-center">
                                <div class="text-xs font-normal text-slate-400 italic">Pending Submission</div>
                            </div>
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
            methodBadges += `<div class="text-[10px] font-extrabold text-buksu-navy mb-0.5">Rank Sum: ${row.rank_sum}</div>`;
        }

        tbodyHtml += `
                <td class="py-3.5 px-4 text-center align-middle bg-slate-50/70">
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

    // Bind View Score Breakdown button click handlers
    tableBody.querySelectorAll('.view-score-breakdown-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const cid = btn.dataset.contestantId;
            const jid = btn.dataset.judgeId;
            openScoreBreakdownModal(cid, jid);
        });
    });

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

export function openScoreBreakdownModal(contestantId, judgeId) {
    if (!cachedData) return;

    const modal = document.getElementById('score-breakdown-modal');
    if (!modal) return;

    activeBreakdownContestantId = contestantId;
    activeBreakdownJudgeId = judgeId;

    const { matrix = [], judges = [], criteria = [], settings = {}, role = '' } = cachedData;
    const judgingSettings = settings.judging || {};
    const precision = parseInt(judgingSettings.decimalPrecision ?? 2);
    const unlockPolicy = judgingSettings.unlockPolicy || 'admin_approval';

    // 1. Locate contestant row and judge
    const contestantRow = matrix.find(r => String(r.contestant_id) === String(contestantId));
    const judge = judges.find(j => String(j.id) === String(judgeId));

    if (!contestantRow || !judge) {
        showToast('Score record or judge information not found.', 'error');
        return;
    }

    const entry = contestantRow.judge_scores ? contestantRow.judge_scores[judge.id] : null;
    if (!entry) {
        showToast('No score record found for this judge and contestant.', 'warning');
        return;
    }

    // 2. Populate Header & Banner info
    const numEl = document.getElementById('breakdown-contestant-num');
    const nameEl = document.getElementById('breakdown-contestant-name');
    const deptEl = document.getElementById('breakdown-contestant-dept');
    const typeEl = document.getElementById('breakdown-contestant-type');
    const judgeEl = document.getElementById('breakdown-judge-name');
    const totalScoreEl = document.getElementById('breakdown-total-score');
    const statusBadgeEl = document.getElementById('breakdown-status-badge');
    const submittedTimeEl = document.getElementById('breakdown-submitted-time');
    const critCountEl = document.getElementById('breakdown-criteria-count');
    const verBannerEl = document.getElementById('breakdown-verification-banner');

    if (numEl) numEl.textContent = `#${contestantRow.contestant_number}`;
    if (nameEl) nameEl.textContent = contestantRow.name;
    if (deptEl) deptEl.textContent = contestantRow.department_or_org || 'Independent';

    if (typeEl) {
        if (contestantRow.entry_type === 'team') {
            typeEl.textContent = 'Team';
            typeEl.classList.remove('hidden');
        } else {
            typeEl.classList.add('hidden');
        }
    }

    if (judgeEl) {
        judgeEl.innerHTML = `<i class="fa-solid fa-gavel text-buksu-navy text-[10px]"></i> ${escapeHtml(judge.username)}`;
    }

    if (totalScoreEl) {
        totalScoreEl.textContent = `${parseFloat(entry.total_score || 0).toFixed(precision)}%`;
    }

    const isSubmitted = (entry.status === 'submitted');
    const isVerified = Boolean(entry.is_verified);

    if (statusBadgeEl) {
        if (isSubmitted) {
            if (isVerified) {
                statusBadgeEl.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs';
                statusBadgeEl.innerHTML = '<i class="fa-solid fa-shield-check"></i> Final &bull; Certified &amp; Verified';
            } else {
                statusBadgeEl.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 animate-pulse shadow-2xs';
                statusBadgeEl.innerHTML = '<i class="fa-solid fa-shield text-amber-600"></i> Final &bull; Awaiting Verification';
            }
        } else {
            statusBadgeEl.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1';
            statusBadgeEl.innerHTML = '<i class="fa-solid fa-pen-ruler"></i> In-Progress Draft';
        }
    }

    // Interactive Verification Banner
    if (verBannerEl) {
        if (isSubmitted) {
            if (isVerified) {
                const verDateStr = entry.verified_at ? new Date(entry.verified_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
                verBannerEl.innerHTML = `
                    <div class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300/80 text-emerald-950 text-xs flex items-center justify-between gap-3 flex-wrap shadow-2xs">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                                <i class="fa-solid fa-certificate"></i>
                            </div>
                            <div>
                                <span class="font-black text-emerald-950 block text-xs">Score Verified &amp; Certified by Tabulator</span>
                                <span class="text-[11px] text-emerald-800">Checked and certified correct by <strong>${escapeHtml(entry.verified_by || 'Tabulator')}</strong> ${verDateStr ? `on ${escapeHtml(verDateStr)}` : ''}.</span>
                            </div>
                        </div>
                        <span class="px-2.5 py-1 rounded-xl bg-emerald-200/90 text-emerald-950 font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                            <i class="fa-solid fa-circle-check text-emerald-700"></i> Certified
                        </span>
                    </div>
                `;
            } else {
                verBannerEl.innerHTML = `
                    <div class="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-center justify-between gap-3 flex-wrap shadow-2xs">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                                <i class="fa-solid fa-shield-halved"></i>
                            </div>
                            <div>
                                <span class="font-black text-amber-950 block text-xs">Awaiting Tabulator Verification</span>
                                <span class="text-[11px] text-amber-800">Please audit the criteria and score categories entered below. Click <strong>"Verify Score"</strong> to certify.</span>
                            </div>
                        </div>
                        <span class="px-2.5 py-1 rounded-xl bg-amber-200 text-amber-950 font-black text-[10px] uppercase tracking-wider flex items-center gap-1 animate-pulse">
                            <i class="fa-solid fa-hourglass-half"></i> Action Required
                        </span>
                    </div>
                `;
            }
        } else {
            verBannerEl.innerHTML = `
                <div class="p-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-xs flex items-center gap-2.5">
                    <i class="fa-solid fa-pen-ruler text-amber-600 text-sm shrink-0"></i>
                    <span>Judge evaluation is currently in <strong>Draft</strong>. Only submitted final evaluations can be verified.</span>
                </div>
            `;
        }
    }

    if (submittedTimeEl) {
        if (entry.submitted_at) {
            const dateStr = new Date(entry.submitted_at).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short'
            });
            submittedTimeEl.innerHTML = `<i class="fa-regular fa-clock me-1 text-slate-400"></i>Submitted: <strong class="text-slate-700">${escapeHtml(dateStr)}</strong>`;
        } else {
            submittedTimeEl.innerHTML = `<i class="fa-regular fa-clock me-1 text-slate-400"></i>Status: <strong class="text-slate-700">${isSubmitted ? 'Submitted' : 'Draft'}</strong>`;
        }
    }

    // 3. Render Itemized Criteria List
    const criteriaScores = Array.isArray(entry.criteria_scores) ? entry.criteria_scores : [];
    const criteriaScoresMap = {};
    criteriaScores.forEach(cs => {
        criteriaScoresMap[String(cs.criteria_id)] = cs;
    });

    let scoredCount = 0;
    const criteriaContainer = document.getElementById('breakdown-criteria-list');

    if (criteriaContainer) {
        if (criteria.length === 0) {
            criteriaContainer.innerHTML = `
                <div class="py-8 text-center text-slate-400 text-xs">
                    <p>No criteria defined for this competition.</p>
                </div>
            `;
        } else {
            let criteriaHtml = '';
            let calculationSteps = [];

            criteria.forEach(cr => {
                const critScore = criteriaScoresMap[String(cr.id)];
                const maxPts = parseFloat(cr.max_points || 100);
                const weightPct = parseFloat(cr.percentage || 0);
                const isScored = Boolean(critScore && critScore.score !== undefined && critScore.score !== null);

                if (isScored) scoredCount++;

                const rawScore = isScored ? parseFloat(critScore.score) : 0;
                const weightedScore = maxPts > 0 ? (rawScore / maxPts) * weightPct : 0;
                calculationSteps.push(`${weightedScore.toFixed(precision)}%`);

                const isCategory = (cr.scoring_type === 'category' || (Array.isArray(cr.scoring_categories) && cr.scoring_categories.length > 0));

                let typeBadge = '';
                if (isCategory) {
                    typeBadge = `<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Category-Based</span>`;
                } else {
                    typeBadge = `<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Criteria-Based (Rubric)</span>`;
                }

                // Render inner details (either Category sub-scores or Rubric rating)
                let innerDetailsHtml = '';
                if (isCategory) {
                    const categories = Array.isArray(cr.scoring_categories) ? cr.scoring_categories : [];
                    const subScores = (critScore && critScore.sub_scores) ? critScore.sub_scores : {};

                    if (categories.length > 0) {
                        innerDetailsHtml = `
                            <div class="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                                <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                                    <span>Score Categories Breakdown</span>
                                    <span>Entered / Max</span>
                                </div>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    ${categories.map(cat => {
                                        const catMax = parseFloat(cat.points || 0);
                                        const catEntered = subScores[cat.id] !== undefined ? parseFloat(subScores[cat.id]) : (subScores[String(cat.id)] !== undefined ? parseFloat(subScores[String(cat.id)]) : null);
                                        const catEnteredFormatted = catEntered !== null ? catEntered.toFixed(precision) : '—';
                                        const catPct = (catMax > 0 && catEntered !== null) ? Math.min(100, Math.round((catEntered / catMax) * 100)) : 0;

                                        return `
                                            <div class="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/70 text-xs">
                                                <div class="flex items-center justify-between gap-1.5 mb-1">
                                                    <span class="font-bold text-slate-700 text-[11px] truncate" title="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</span>
                                                    <span class="font-mono font-black text-slate-900 text-xs shrink-0">${catEnteredFormatted} <span class="text-[10px] text-slate-400 font-normal">/ ${catMax}</span></span>
                                                </div>
                                                ${cat.description ? `<p class="text-[10px] text-slate-400 line-clamp-1 mb-1.5">${escapeHtml(cat.description)}</p>` : ''}
                                                <div class="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                                    <div class="h-full ${catPct >= 80 ? 'bg-emerald-500' : (catPct >= 50 ? 'bg-amber-500' : 'bg-slate-400')} rounded-full transition-all" style="width: ${catPct}%"></div>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }
                } else {
                    // Rubric / Criteria-based
                    const rubricRatings = Array.isArray(cr.rubric_ratings) ? cr.rubric_ratings : [];
                    let ratingName = critScore?.rating_name || '';
                    let ratingDesc = '';

                    if (!ratingName && critScore?.rating_id) {
                        const matchedRating = rubricRatings.find(r => String(r.id) === String(critScore.rating_id));
                        if (matchedRating) {
                            ratingName = matchedRating.name;
                            ratingDesc = matchedRating.description || '';
                        }
                    } else if (ratingName && rubricRatings.length > 0) {
                        const matchedRating = rubricRatings.find(r => r.name === ratingName);
                        if (matchedRating && matchedRating.description) {
                            ratingDesc = matchedRating.description;
                        }
                    }

                    if (ratingName) {
                        innerDetailsHtml = `
                            <div class="mt-3 pt-2.5 border-t border-slate-100">
                                <div class="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                                    <div class="flex items-center gap-2">
                                        <div class="w-7 h-7 rounded-lg bg-amber-400 text-buksu-navy flex items-center justify-center text-xs font-black shadow-2xs">
                                            <i class="fa-solid fa-star"></i>
                                        </div>
                                        <div>
                                            <span class="text-[9px] uppercase font-bold text-amber-800 tracking-wider block">Selected Rating Level</span>
                                            <span class="font-extrabold text-slate-800 text-xs">${escapeHtml(ratingName)}</span>
                                            ${ratingDesc ? `<p class="text-[10px] text-slate-500 mt-0.5">${escapeHtml(ratingDesc)}</p>` : ''}
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <span class="text-xs font-black text-slate-800 font-mono">${rawScore.toFixed(precision)} / ${maxPts} pts</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                }

                criteriaHtml += `
                    <div class="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all">
                        <div class="flex items-start justify-between gap-3 flex-wrap">
                            <div class="space-y-1">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="px-2 py-0.5 rounded text-[10px] font-black bg-buksu-navy text-buksu-gold border border-buksu-gold/30">
                                        ${weightPct}% Weight
                                    </span>
                                    ${typeBadge}
                                    ${!isScored ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-200">Pending</span>` : ''}
                                </div>
                                <h5 class="font-extrabold text-slate-800 text-xs sm:text-sm mt-1">${escapeHtml(cr.title)}</h5>
                                ${cr.description ? `<p class="text-[11px] text-slate-500 font-normal leading-relaxed">${escapeHtml(cr.description)}</p>` : ''}
                            </div>

                            <div class="text-right bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/80 shrink-0">
                                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Raw Score Entered</div>
                                <div class="text-sm font-black text-slate-900 font-mono">
                                    ${rawScore.toFixed(precision)} <span class="text-[11px] text-slate-400 font-normal">/ ${maxPts} pts</span>
                                </div>
                                <div class="text-[10px] font-extrabold text-emerald-700 mt-0.5">
                                    Weighted: +${weightedScore.toFixed(precision)}%
                                </div>
                            </div>
                        </div>

                        ${innerDetailsHtml}
                    </div>
                `;
            });

            // Summary card showing formula breakdown
            criteriaHtml += `
                <div class="p-3.5 rounded-2xl bg-buksu-navy/5 border border-buksu-navy/20 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div class="space-y-0.5 min-w-0 flex-1">
                        <span class="font-extrabold text-slate-800 flex items-center gap-1.5">
                            <i class="fa-solid fa-calculator text-buksu-navy"></i> Tabulation Verification Formula
                        </span>
                        <p class="text-[11px] text-slate-600 font-mono break-all sm:break-words">
                            ${calculationSteps.join(' + ')} = <strong class="text-buksu-navy font-bold">${parseFloat(entry.total_score || 0).toFixed(precision)}%</strong>
                        </p>
                    </div>
                    <div class="text-right shrink-0">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Verified Total</span>
                        <span class="text-base font-black text-buksu-navy font-mono">${parseFloat(entry.total_score || 0).toFixed(precision)}%</span>
                    </div>
                </div>
            `;

            criteriaContainer.innerHTML = criteriaHtml;
        }
    }

    if (critCountEl) {
        critCountEl.textContent = `${scoredCount} of ${criteria.length} Criteria Evaluated`;
    }

    // 4. Citations & Comments from this judge for this contestant
    const citationsSecEl = document.getElementById('breakdown-citations-section');
    const citationsListEl = document.getElementById('breakdown-citations-list');
    if (citationsSecEl && citationsListEl) {
        const comments = Array.isArray(contestantRow.comments) ? contestantRow.comments : [];
        const judgeComments = comments.filter(c => !c.judge_id || String(c.judge_id) === String(judge.id));

        if (judgeComments.length > 0) {
            citationsListEl.innerHTML = judgeComments.map(c => `
                <span class="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5 shadow-2xs">
                    <i class="fa-solid fa-award text-amber-700"></i> ${escapeHtml(c.text || c.award_title || '')}
                </span>
            `).join('');
            citationsSecEl.classList.remove('hidden');
        } else {
            citationsSecEl.classList.add('hidden');
        }
    }

    // 5. Verify / Unverify action in modal footer
    const verifyContainer = document.getElementById('breakdown-verify-container');
    if (verifyContainer) {
        if ((role === 'admin' || role === 'tabulator') && isSubmitted) {
            if (!isVerified) {
                verifyContainer.innerHTML = `
                    <button type="button" id="modalVerifyScoreBtn" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-colors inline-flex items-center gap-2 shrink-0">
                        <i class="fa-solid fa-shield-check text-sm"></i> Verify Score
                    </button>
                `;

                const verifyBtn = document.getElementById('modalVerifyScoreBtn');
                if (verifyBtn) {
                    verifyBtn.addEventListener('click', async () => {
                        verifyBtn.disabled = true;
                        verifyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i> Verifying...';

                        const res = await verifyJudgeScore(currentEventId, contestantId, judge.id);
                        if (res.success) {
                            showToast(res.message || 'Score verified successfully!', 'success');
                            await loadTabulationData(false);
                            openScoreBreakdownModal(contestantId, judge.id);
                        } else {
                            showToast(res.message || 'Failed to verify score.', 'error');
                            verifyBtn.disabled = false;
                            verifyBtn.innerHTML = '<i class="fa-solid fa-shield-check text-sm"></i> Verify Score';
                        }
                    });
                }
            } else {
                verifyContainer.innerHTML = `
                    <div class="flex flex-wrap items-center gap-2 shrink-0">
                        <span class="px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-black inline-flex items-center gap-1.5 shadow-2xs shrink-0">
                            <i class="fa-solid fa-shield-check text-emerald-600"></i> Verified
                        </span>
                        <button type="button" id="modalUnverifyScoreBtn" class="px-3.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-300 font-bold text-xs rounded-xl cursor-pointer transition-colors inline-flex items-center gap-1 shrink-0" title="Revoke verification if judge needs to revise">
                            <i class="fa-solid fa-rotate-left text-[10px]"></i> Revoke Verification
                        </button>
                    </div>
                `;

                const unverifyBtn = document.getElementById('modalUnverifyScoreBtn');
                if (unverifyBtn) {
                    unverifyBtn.addEventListener('click', async () => {
                        if (!confirm(`Revoke tabulator verification for this score?\n\nJudge "${judge.username}" score for "${contestantRow.name}" will return to unverified status.`)) {
                            return;
                        }

                        unverifyBtn.disabled = true;
                        unverifyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i> Revoking...';

                        const res = await unverifyJudgeScore(currentEventId, contestantId, judge.id);
                        if (res.success) {
                            showToast(res.message || 'Score verification revoked.', 'info');
                            await loadTabulationData(false);
                            openScoreBreakdownModal(contestantId, judge.id);
                        } else {
                            showToast(res.message || 'Failed to revoke verification.', 'error');
                            unverifyBtn.disabled = false;
                            unverifyBtn.innerHTML = '<i class="fa-solid fa-rotate-left text-[10px]"></i> Revoke Verification';
                        }
                    });
                }
            }
        } else {
            verifyContainer.innerHTML = '';
        }
    }

    // 6. Unlock action in modal footer
    const unlockContainer = document.getElementById('breakdown-unlock-container');
    if (unlockContainer) {
        if (isSubmitted && (role === 'admin' || role === 'tabulator') && unlockPolicy !== 'locked_after_submit') {
            unlockContainer.innerHTML = `
                <button type="button" id="modalUnlockJudgeScoreBtn" class="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-300 font-extrabold text-xs rounded-xl cursor-pointer transition-colors inline-flex items-center gap-1.5 shadow-2xs shrink-0" data-contestant-id="${contestantId}" data-judge-id="${judge.id}" data-judge-name="${escapeHtml(judge.username)}" data-contestant-name="${escapeHtml(contestantRow.name)}">
                    <i class="fa-solid fa-lock-open text-rose-600"></i> Unlock Score
                </button>
            `;

            const unlockBtn = document.getElementById('modalUnlockJudgeScoreBtn');
            if (unlockBtn) {
                unlockBtn.addEventListener('click', async () => {
                    if (!confirm(`Unlock submitted score by Judge "${judge.username}" for "${contestantRow.name}"?\n\nThis will return the score to draft status so the judge can revise and re-submit.`)) {
                        return;
                    }

                    unlockBtn.disabled = true;
                    unlockBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i> Unlocking...';

                    const res = await unlockJudgeScore(currentEventId, contestantId, judge.id);
                    if (res.success) {
                        showToast(res.message || 'Score unlocked successfully!', 'success');
                        closeScoreBreakdownModal();
                        await loadTabulationData(false);
                    } else {
                        showToast(res.message || 'Failed to unlock score.', 'error');
                        unlockBtn.disabled = false;
                        unlockBtn.innerHTML = '<i class="fa-solid fa-lock-open text-rose-600"></i> Unlock Score for Judge';
                    }
                });
            }
        } else {
            unlockContainer.innerHTML = '';
        }
    }

    modal.classList.remove('hidden');
}

export function closeScoreBreakdownModal() {
    activeBreakdownContestantId = null;
    activeBreakdownJudgeId = null;
    const modal = document.getElementById('score-breakdown-modal');
    if (modal) modal.classList.add('hidden');
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
