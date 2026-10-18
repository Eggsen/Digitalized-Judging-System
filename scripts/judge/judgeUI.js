import { getScores, submitScore } from "/scripts/admin/judgingAPI.js";
import { showToast } from "/scripts/utils/uiUtils.js";

let currentEventId = null;
let currentEventData = null;
let contestantsList = [];
let criteriaList = [];
let judgeScoresMap = {};
let selectedContestantId = null;

export function initJudgeUI() {
    const modal = document.getElementById('judge-scoring-modal');
    if (!modal) return;

    // Close buttons
    modal.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    // Save Draft button
    document.getElementById('saveDraftScoreBtn')?.addEventListener('click', () => handleSaveScore('draft'));

    // Submit Final Score button
    document.getElementById('submitFinalScoreBtn')?.addEventListener('click', () => handleSaveScore('submit'));
}

export async function openJudgeScoringModal(eventId, eventName) {
    const modal = document.getElementById('judge-scoring-modal');
    if (!modal) return;

    currentEventId = parseInt(eventId);
    selectedContestantId = null;

    document.getElementById('judge-modal-title').textContent = eventName || `Competition #${currentEventId}`;
    modal.classList.remove('hidden');

    await loadJudgeEventData();
}

async function loadJudgeEventData() {
    const contestantListContainer = document.getElementById('judge-contestants-list');
    const scoringFormContainer = document.getElementById('judge-scoring-form-body');
    if (!contestantListContainer) return;

    contestantListContainer.innerHTML = `
        <div class="py-8 text-center text-slate-400 text-xs">
            <i class="fa-solid fa-spinner fa-spin text-lg mb-2"></i>
            <p>Loading contestants and criteria...</p>
        </div>
    `;

    if (scoringFormContainer) {
        scoringFormContainer.innerHTML = `
            <div class="py-16 text-center text-slate-400 text-xs">
                <i class="fa-solid fa-user-check text-3xl text-slate-300 mb-2"></i>
                <p class="font-bold text-slate-600">Select a contestant to begin scoring</p>
                <p class="text-[11px] text-slate-400 mt-1">Choose any contestant from the list on the left.</p>
            </div>
        `;
    }

    const res = await getScores(currentEventId);
    if (!res.success) {
        contestantListContainer.innerHTML = `
            <div class="py-6 text-center text-rose-500 text-xs font-semibold">
                ${escapeHtml(res.message || 'Failed to load scoring sheet.')}
            </div>
        `;
        return;
    }

    currentEventData = res.event || {};
    contestantsList = res.contestants || [];
    criteriaList = res.criteria || [];
    judgeScoresMap = res.scores || {};

    // Update Judging Period state badge in modal header
    const judgingStatusBadge = document.getElementById('judge-event-status-badge');
    if (judgingStatusBadge) {
        const jStatus = currentEventData.judgingStatus || 'Not Yet Started';
        judgingStatusBadge.textContent = jStatus;
        if (jStatus === 'In Progress') {
            judgingStatusBadge.className = 'px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse';
        } else if (jStatus === 'Finished') {
            judgingStatusBadge.className = 'px-3 py-1 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-300';
        } else {
            judgingStatusBadge.className = 'px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300';
        }
    }

    // Render Contestants List
    renderJudgeContestants();

    // Automatically select first contestant if available
    if (contestantsList.length > 0) {
        selectContestant(contestantsList[0].id);
    }
}

function renderJudgeContestants() {
    const container = document.getElementById('judge-contestants-list');
    if (!container) return;

    if (contestantsList.length === 0) {
        container.innerHTML = `
            <div class="py-8 text-center text-slate-400 text-xs">
                <i class="fa-solid fa-users-slash text-2xl text-slate-300 mb-2"></i>
                <p class="font-bold text-slate-600">No contestants registered</p>
                <p class="text-[11px] text-slate-400 mt-1">Administrator has not registered contestants yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = contestantsList.map(c => {
        const scoreEntry = judgeScoresMap[c.id];
        let statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">Unscored</span>';
        let scorePill = '';

        if (scoreEntry) {
            if (scoreEntry.status === 'submitted') {
                statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-700 flex items-center gap-1"><i class="fa-solid fa-circle-check"></i> Submitted</span>';
                scorePill = `<span class="text-xs font-black text-emerald-700">${scoreEntry.total_score}%</span>`;
            } else if (scoreEntry.status === 'draft') {
                statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-700 flex items-center gap-1"><i class="fa-solid fa-pen-ruler"></i> Draft</span>';
                scorePill = `<span class="text-xs font-bold text-amber-700">${scoreEntry.total_score}%</span>`;
            }
        }

        const isSelected = selectedContestantId === c.id;

        return `
            <div class="judge-contestant-item p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                isSelected 
                    ? 'bg-buksu-navy text-white border-buksu-navy shadow-md ring-2 ring-buksu-gold/40' 
                    : 'bg-slate-50 hover:bg-white border-slate-200/80 text-slate-700'
            }" data-id="${c.id}">
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${
                        isSelected 
                            ? 'bg-buksu-gold text-buksu-navy font-black shadow-xs' 
                            : 'bg-slate-200 text-slate-700'
                    }">
                        #${c.contestant_number}
                    </div>
                    <div class="overflow-hidden">
                        <h5 class="font-extrabold text-xs truncate ${isSelected ? 'text-white' : 'text-slate-800'}">${escapeHtml(c.name)}</h5>
                        <p class="text-[10px] truncate ${isSelected ? 'text-slate-200' : 'text-slate-400'}">${escapeHtml(c.department_or_org || 'General')}</p>
                    </div>
                </div>
                <div class="flex flex-col items-end gap-1 shrink-0">
                    ${statusBadge}
                    ${scorePill}
                </div>
            </div>
        `;
    }).join('');

    // Bind contestant click handlers
    container.querySelectorAll('.judge-contestant-item').forEach(el => {
        el.addEventListener('click', () => {
            selectContestant(el.dataset.id);
        });
    });
}

function selectContestant(contestantId) {
    selectedContestantId = contestantId;
    renderJudgeContestants();

    const contestant = contestantsList.find(c => c.id === contestantId);
    if (!contestant) return;

    const scoringBody = document.getElementById('judge-scoring-form-body');
    if (!scoringBody) return;

    const isPeriodActive = (currentEventData.judgingStatus === 'In Progress');
    const scoreEntry = judgeScoresMap[contestantId];
    const isSubmitted = scoreEntry && scoreEntry.status === 'submitted';

    // Criteria breakdown header
    let html = `
        <div class="p-4 rounded-2xl bg-gradient-to-r from-buksu-navy to-buksu-navy-light text-white flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-buksu-gold text-buksu-navy flex items-center justify-center font-black text-lg shadow-md">
                    #${contestant.contestant_number}
                </div>
                <div>
                    <span class="text-[10px] uppercase font-bold tracking-wider text-buksu-gold">Scoring Contestant</span>
                    <h3 class="font-extrabold text-base leading-tight">${escapeHtml(contestant.name)}</h3>
                    <p class="text-xs text-slate-200">${escapeHtml(contestant.department_or_org || 'Independent')} ${contestant.description ? `&bull; <span class="italic text-slate-300">${escapeHtml(contestant.description)}</span>` : ''}</p>
                </div>
            </div>
            <div class="text-right">
                <span class="block text-[10px] font-bold text-slate-300 uppercase tracking-wider">Total Score</span>
                <span id="judge-live-total-score" class="font-black text-2xl text-buksu-gold">
                    ${scoreEntry ? scoreEntry.total_score : '0.00'}%
                </span>
            </div>
        </div>
    `;

    // Alert if scoring closed or submitted
    if (!isPeriodActive) {
        html += `
            <div class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <i class="fa-solid fa-lock text-sm shrink-0"></i>
                <span>Judging period is currently <strong>${escapeHtml(currentEventData.judgingStatus || 'Not Yet Started')}</strong>. Scoring is locked until an administrator starts the session.</span>
            </div>
        `;
    } else if (isSubmitted) {
        html += `
            <div class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-circle-check text-sm text-emerald-600 shrink-0"></i>
                    <span>Score for this contestant has been <strong>Submitted</strong> to the Tabulation Board.</span>
                </div>
                <button type="button" id="unlockScoreEditBtn" class="px-2.5 py-1 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[11px] cursor-pointer">
                    <i class="fa-solid fa-pen me-1"></i> Edit Score
                </button>
            </div>
        `;
    }

    if (criteriaList.length === 0) {
        html += `
            <div class="py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                <i class="fa-solid fa-list-check text-2xl text-slate-300 mb-2"></i>
                <p class="font-bold text-slate-600">No criteria defined for this competition</p>
                <p class="text-[11px] text-slate-400 mt-1">Administrator needs to configure judging criteria first.</p>
            </div>
        `;
        scoringBody.innerHTML = html;
        toggleActionButtons(false);
        return;
    }

    // Build map of existing scores for this contestant
    const existingScoresMap = {};
    if (scoreEntry && Array.isArray(scoreEntry.criteria_scores)) {
        scoreEntry.criteria_scores.forEach(cs => {
            existingScoresMap[cs.criteria_id] = cs.score;
        });
    }

    // Criteria scoring inputs
    html += `
        <div class="space-y-3">
            <div class="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                <span>Judging Criteria &amp; Weights</span>
                <span>Enter Points</span>
            </div>
    `;

    criteriaList.forEach(cr => {
        const val = existingScoresMap[cr.id] !== undefined ? existingScoresMap[cr.id] : '';
        const isInputsDisabled = (!isPeriodActive || (isSubmitted && !scoringBody.dataset.unlocked));

        html += `
            <div class="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="space-y-1 sm:max-w-md">
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            ${cr.percentage}% Weight
                        </span>
                        <h4 class="font-bold text-slate-800 text-xs">${escapeHtml(cr.title)}</h4>
                    </div>
                    ${cr.description ? `<p class="text-[11px] text-slate-500">${escapeHtml(cr.description)}</p>` : ''}
                    <p class="text-[10px] text-slate-400 font-medium">Max possible score: ${cr.max_points} pts</p>
                </div>

                <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <div class="relative">
                        <input type="number" 
                            class="criteria-score-input w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-extrabold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                            min="0" 
                            max="${cr.max_points}" 
                            step="0.5" 
                            placeholder="0 - ${cr.max_points}"
                            data-crit-id="${cr.id}"
                            data-max="${cr.max_points}"
                            data-pct="${cr.percentage}"
                            value="${val}"
                            ${isInputsDisabled ? 'disabled' : ''}>
                    </div>
                    <span class="text-xs font-bold text-slate-400">/ ${cr.max_points}</span>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    scoringBody.innerHTML = html;

    // Attach unlock button handler
    document.getElementById('unlockScoreEditBtn')?.addEventListener('click', () => {
        scoringBody.dataset.unlocked = "true";
        selectContestant(contestantId);
    });

    // Attach input listeners for live total score calculation
    document.querySelectorAll('.criteria-score-input').forEach(input => {
        input.addEventListener('input', updateLiveScore);
    });

    updateLiveScore();

    const canSubmit = isPeriodActive && (!isSubmitted || scoringBody.dataset.unlocked);
    toggleActionButtons(canSubmit);
}

function updateLiveScore() {
    let totalScore = 0.0;
    const inputs = document.querySelectorAll('.criteria-score-input');
    
    inputs.forEach(input => {
        const val = parseFloat(input.value) || 0;
        const max = parseFloat(input.dataset.max) || 100;
        const pct = parseFloat(input.dataset.pct) || 0;

        if (pct > 0) {
            totalScore += (val / max) * pct;
        } else {
            totalScore += val;
        }
    });

    const display = document.getElementById('judge-live-total-score');
    if (display) {
        display.textContent = `${totalScore.toFixed(2)}%`;
    }
}

function toggleActionButtons(enabled) {
    const draftBtn = document.getElementById('saveDraftScoreBtn');
    const submitBtn = document.getElementById('submitFinalScoreBtn');

    if (draftBtn) draftBtn.disabled = !enabled;
    if (submitBtn) submitBtn.disabled = !enabled;
}

async function handleSaveScore(action) {
    if (!currentEventId || !selectedContestantId) {
        showToast('Please select a contestant first.', 'warning');
        return;
    }

    const inputs = document.querySelectorAll('.criteria-score-input');
    const criteriaScores = [];
    let hasInvalid = false;

    inputs.forEach(input => {
        const critId = input.dataset.critId;
        const max = parseFloat(input.dataset.max) || 100;
        const rawVal = input.value.trim();
        const score = parseFloat(rawVal) || 0;

        if (rawVal === '' && action === 'submit') {
            hasInvalid = true;
        }

        if (score < 0 || score > max) {
            hasInvalid = true;
        }

        criteriaScores.push({
            criteria_id: critId,
            score: score,
            max: max
        });
    });

    if (hasInvalid && action === 'submit') {
        showToast('Please provide valid scores within the allowable points for all criteria before submitting.', 'warning');
        return;
    }

    const contestant = contestantsList.find(c => c.id === selectedContestantId);
    const contestantName = contestant ? contestant.name : 'this contestant';

    if (action === 'submit') {
        const confirmed = confirm(`Are you sure you want to submit your final score for "${contestantName}"? The Tabulator will receive this score immediately.`);
        if (!confirmed) return;
    }

    const btn = action === 'submit' ? document.getElementById('submitFinalScoreBtn') : document.getElementById('saveDraftScoreBtn');
    if (btn) btn.disabled = true;

    const res = await submitScore({
        event_id: currentEventId,
        contestant_id: selectedContestantId,
        criteria_scores: criteriaScores,
        action: action
    });

    if (btn) btn.disabled = false;

    if (res.success) {
        showToast(res.message, 'success');
        
        // Update local cache
        judgeScoresMap[selectedContestantId] = {
            id: res.score_id,
            contestant_id: selectedContestantId,
            criteria_scores: criteriaScores,
            total_score: res.total_score,
            status: action === 'submit' ? 'submitted' : 'draft',
            submitted_at: new Date().toISOString()
        };

        const scoringBody = document.getElementById('judge-scoring-form-body');
        if (scoringBody) delete scoringBody.dataset.unlocked;

        renderJudgeContestants();
        selectContestant(selectedContestantId);
    } else {
        showToast(res.message || 'Failed to save score.', 'error');
    }
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
