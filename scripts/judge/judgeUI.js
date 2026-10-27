import { getScores, submitScore, addContestantComment, deleteContestantComment } from "/scripts/admin/judgingAPI.js";
import { showToast } from "/scripts/utils/uiUtils.js";

let currentEventId = null;
let currentEventData = null;
let contestantsList = [];
let criteriaList = [];
let judgeScoresMap = {};
let selectedContestantId = null;
let activeCriterionId = null;
let contestantScoresState = {}; // { [contestantId]: { [critId]: { score: number, sub_scores: { [subId]: number } } } }
let currentJudgeId = '';
let currentJudgeUsername = '';
let currentSettings = {};

function formatScore(val, overridePrecision = null) {
    const p = overridePrecision !== null ? overridePrecision : (parseInt(currentSettings?.judging?.decimalPrecision ?? 2));
    return parseFloat(val || 0).toFixed(p);
}

const TIER_CONFIG = {
    5: { label: 'Outstanding', defaultDesc: 'Exemplary performance exceeding all standards with exceptional mastery and creativity.' },
    4: { label: 'Very Good', defaultDesc: 'Strong and consistent execution meeting standards with commendable precision.' },
    3: { label: 'Good', defaultDesc: 'Competent and adequate performance meeting core criteria with minor inconsistencies.' },
    2: { label: 'Fair', defaultDesc: 'Incomplete or inconsistent execution requiring noticeable improvement in key areas.' },
    1: { label: 'Poor', defaultDesc: 'Lacks fundamental execution, coherence, or technique.' }
};

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
    activeCriterionId = null;
    contestantScoresState = {};

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
    currentSettings = res.settings || {};
    currentJudgeId = res.judge_id || document.body.dataset.userId || '';
    currentJudgeUsername = res.judge_username || document.body.dataset.username || '';
    contestantsList = res.contestants || [];
    criteriaList = res.criteria || [];
    judgeScoresMap = res.scores || {};

    // Initialize in-memory scores state for all contestants
    contestantScoresState = {};
    contestantsList.forEach(c => {
        contestantScoresState[c.id] = {};
        const existingScore = judgeScoresMap[c.id];

        criteriaList.forEach(cr => {
            let matchedCriteriaScore = null;
            if (existingScore && Array.isArray(existingScore.criteria_scores)) {
                matchedCriteriaScore = existingScore.criteria_scores.find(cs => String(cs.criteria_id) === String(cr.id));
            }

            const rawScore = matchedCriteriaScore ? parseFloat(matchedCriteriaScore.score) : 0;
            const hasScore = matchedCriteriaScore && (matchedCriteriaScore.score !== undefined && matchedCriteriaScore.score !== null && matchedCriteriaScore.score !== '');

            contestantScoresState[c.id][cr.id] = {
                score: !isNaN(rawScore) ? rawScore : 0,
                rating_id: matchedCriteriaScore?.rating_id || '',
                rating_name: matchedCriteriaScore?.rating_name || '',
                category_id: matchedCriteriaScore?.category_id || '',
                is_scored: Boolean(hasScore && (rawScore > 0 || matchedCriteriaScore?.rating_id)),
                sub_scores: matchedCriteriaScore?.sub_scores ? { ...matchedCriteriaScore.sub_scores } : {}
            };
        });
    });

    // Update Judging Period state badge in modal header
    const judgingStatusBadge = document.getElementById('judge-event-status-badge');
    if (judgingStatusBadge) {
        const jStatus = currentEventData.judgingStatus || 'Not Yet Started';
        judgingStatusBadge.textContent = jStatus;
        if (jStatus === 'In Progress') {
            judgingStatusBadge.className = 'px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse';
        } else if (jStatus === 'Finished') {
            judgingStatusBadge.className = 'px-3 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700';
        } else {
            judgingStatusBadge.className = 'px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300';
        }
    }

    // Default active criterion to first criterion
    if (criteriaList.length > 0) {
        activeCriterionId = criteriaList[0].id;
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
        let statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Unscored</span>';
        let scorePill = '';

        if (scoreEntry) {
            if (scoreEntry.status === 'submitted') {
                statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1"><i class="fa-solid fa-circle-check"></i> Submitted</span>';
                scorePill = `<span class="text-xs font-black text-emerald-700 dark:text-emerald-400">${formatScore(scoreEntry.total_score)}%</span>`;
            } else if (scoreEntry.status === 'draft') {
                statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1"><i class="fa-solid fa-pen-ruler"></i> Draft</span>';
                scorePill = `<span class="text-xs font-bold text-amber-700 dark:text-amber-400">${formatScore(scoreEntry.total_score)}%</span>`;
            }
        }

        const isSelected = selectedContestantId === c.id;

        return `
            <div class="judge-contestant-item p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                isSelected 
                    ? 'active bg-amber-50/80 hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-slate-800 border-buksu-gold dark:border-buksu-gold shadow-sm ring-2 ring-buksu-gold/40 text-slate-900 dark:text-white' 
                    : 'bg-white hover:bg-slate-50 dark:bg-slate-850 dark:hover:bg-slate-800 border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-2xs'
            }" data-id="${c.id}" data-selected="${isSelected}">
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${
                        isSelected 
                            ? 'bg-buksu-navy text-buksu-gold font-black shadow-xs border border-buksu-gold/30 dark:bg-buksu-gold dark:text-buksu-navy' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-bold'
                    }">
                        #${c.contestant_number}
                    </div>
                    <div class="overflow-hidden">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <h5 class="font-extrabold text-xs truncate ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-200'}">${escapeHtml(c.name)}</h5>
                            ${c.entry_type === 'team' ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">Team</span>` : ''}
                            ${c.comments && c.comments.length > 0 ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800"><i class="fa-solid fa-award"></i> ${c.comments.length}</span>` : ''}
                        </div>
                        <p class="text-[10px] truncate ${isSelected ? 'text-slate-600 dark:text-slate-300 font-semibold' : 'text-slate-500 dark:text-slate-400'}">${escapeHtml(c.department_or_org || 'General')}</p>
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
    const scoringBody = document.getElementById('judge-scoring-form-body');
    if (scoringBody) {
        delete scoringBody.dataset.unlocked;
    }
    renderJudgeContestants();

    const contestant = contestantsList.find(c => c.id === contestantId);
    if (!contestant) return;

    if (!activeCriterionId && criteriaList.length > 0) {
        activeCriterionId = criteriaList[0].id;
    }

    renderScoringSheet();
}

function renderScoringSheet() {
    const scoringBody = document.getElementById('judge-scoring-form-body');
    const contestant = contestantsList.find(c => c.id === selectedContestantId);
    if (!scoringBody || !contestant) return;

    const isPeriodActive = (currentEventData.judgingStatus === 'In Progress');
    const scoreEntry = judgeScoresMap[selectedContestantId];
    const isSubmitted = scoreEntry && scoreEntry.status === 'submitted';
    const isUnlocked = scoringBody.dataset.unlocked === "true";
    const isInputsDisabled = (!isPeriodActive || (isSubmitted && !isUnlocked));

    const totalScore = calculateContestantTotal(selectedContestantId);

    // Calculate completed criteria count
    let completedCriteriaCount = 0;
    const contestantScores = contestantScoresState[selectedContestantId] || {};

    criteriaList.forEach(cr => {
        const critState = contestantScores[cr.id];
        if (critState && (critState.score > 0 || critState.rating_id || critState.is_scored)) {
            completedCriteriaCount++;
        }
    });

    let html = `
        <!-- Contestant Header Banner -->
        <div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-buksu-navy to-buksu-navy-light text-white flex items-center justify-between flex-wrap gap-4 shadow-md">
            <div class="flex items-center gap-3.5">
                <div class="w-13 h-13 rounded-2xl bg-buksu-gold text-buksu-navy flex items-center justify-center font-black text-xl shadow-md border-2 border-buksu-gold/40">
                    #${contestant.contestant_number}
                </div>
                <div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-[10px] uppercase font-bold tracking-wider text-buksu-gold">Evaluating Contestant</span>
                        ${contestant.entry_type === 'team' ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white/10 text-slate-200 border border-white/20"><i class="fa-solid fa-users-line me-1"></i> Team-Based</span>` : `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white/10 text-slate-300 border border-white/20"><i class="fa-solid fa-user me-1"></i> Individual</span>`}
                        <span id="judge-header-criteria-count" class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${completedCriteriaCount === criteriaList.length ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}">
                            ${completedCriteriaCount} / ${criteriaList.length} Criteria Scored
                        </span>
                    </div>
                    <h3 class="font-black text-lg sm:text-xl leading-tight mt-0.5">${escapeHtml(contestant.name)}</h3>
                    <p class="text-xs text-slate-200 mt-0.5">${escapeHtml(contestant.department_or_org || 'Independent')} ${contestant.description ? `&bull; <span class="italic text-slate-300">${escapeHtml(contestant.description)}</span>` : ''}</p>
                    ${contestant.team_members && contestant.team_members.length > 0 ? `
                        <div class="mt-1 text-xs text-slate-300 flex items-center gap-1.5 flex-wrap">
                            <span class="font-bold text-white"><i class="fa-solid fa-people-group me-1"></i>Roster:</span>
                            <span>${escapeHtml(contestant.team_members.join(', '))}</span>
                        </div>
                    ` : ''}
                    <div id="judge-header-citations-container" class="mt-2 flex items-center gap-1.5 flex-wrap">
                        ${renderHeaderCitationsHtml(contestant)}
                    </div>
                </div>
            </div>
            <div class="text-right bg-buksu-navy-dark/40 px-4 py-2.5 rounded-2xl border border-white/10 backdrop-blur-xs">
                <span class="block text-[10px] font-extrabold text-slate-300 uppercase tracking-wider">Overall Event Score</span>
                <span id="judge-live-total-score" class="font-black text-3xl text-buksu-gold tracking-tight">
                    ${formatScore(totalScore)}%
                </span>
            </div>
        </div>
    `;

    // Status / Lock alerts
    if (!isPeriodActive) {
        html += `
            <div class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5">
                <i class="fa-solid fa-lock text-base text-amber-600 shrink-0"></i>
                <span>Judging period is currently <strong>${escapeHtml(currentEventData.judgingStatus || 'Not Yet Started')}</strong>. Scoring is locked until an administrator starts the session.</span>
            </div>
        `;
    } else if (isSubmitted && !isUnlocked) {
        const unlockPolicy = currentSettings?.judging?.unlockPolicy || 'admin_approval';
        let lockActionHtml = '';
        if (unlockPolicy === 'judge_self_unlock') {
            lockActionHtml = `
                <button type="button" id="unlockScoreEditBtn" class="px-3.5 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl text-xs cursor-pointer shadow-2xs flex items-center gap-1.5 transition-colors">
                    <i class="fa-solid fa-pen-to-square"></i> Edit Evaluation (Scores &amp; Awards)
                </button>
            `;
        } else if (unlockPolicy === 'admin_approval') {
            lockActionHtml = `
                <div class="px-3 py-1.5 bg-slate-100/90 border border-slate-300/80 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5">
                    <i class="fa-solid fa-lock text-slate-500"></i> Locked by Policy (Ask Tabulator/Admin to unlock)
                </div>
            `;
        } else {
            lockActionHtml = `
                <div class="px-3 py-1.5 bg-slate-100/90 border border-slate-300/80 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5">
                    <i class="fa-solid fa-lock text-slate-500"></i> Final & Strictly Locked
                </div>
            `;
        }

        html += `
            <div class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-3 flex-wrap shadow-2xs">
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-circle-check text-base text-emerald-600 shrink-0"></i>
                    <span>Evaluation (Scores &amp; Special Awards) for this contestant has been <strong>Submitted</strong> to the Tabulation Board.</span>
                </div>
                ${lockActionHtml}
            </div>
        `;
    } else if (isSubmitted && isUnlocked) {
        html += `
            <div class="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-3 flex-wrap animate-fade-in shadow-2xs">
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-pen-to-square text-amber-600 text-base shrink-0"></i>
                    <span><strong>Editing Mode Active:</strong> You are modifying both criteria scores and special awards/citations as a whole. Click <strong>"Submit Final Score"</strong> when done to re-submit and lock.</span>
                </div>
                <span class="px-2.5 py-1 rounded-lg bg-amber-200/90 text-amber-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <i class="fa-solid fa-circle-dot text-amber-600 animate-pulse"></i> Editing Whole Evaluation
                </span>
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

    // -------------------------------------------------------------
    // CRITERIA SELECTION CARDS DECK (Bright, High-Contrast Cards)
    // -------------------------------------------------------------
    html += `
        <div class="space-y-2.5">
            <div class="flex items-center justify-between text-xs font-extrabold text-slate-500 uppercase tracking-wider px-1">
                <span class="flex items-center gap-1.5">
                    <i class="fa-solid fa-layer-group text-buksu-navy"></i> Select Criteria to Score
                </span>
                <span class="text-slate-500 font-bold text-[11px]">Click any criteria card to score</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3" id="criteria-cards-deck">
                ${criteriaList.map((cr) => {
                    const isActive = String(cr.id) === String(activeCriterionId);
                    const critState = contestantScores[cr.id] || { score: 0, category_id: '' };
                    const isComplete = (critState.score > 0) || (critState.rating_id && critState.rating_id !== '') || Boolean(critState.is_scored);
                    const weightedScore = (critState.score / cr.max_points) * cr.percentage;
                    const isCategory = (cr.scoring_type === 'category');
                    const isRubric = !isCategory;

                    const categories = (Array.isArray(cr.scoring_categories) && cr.scoring_categories.length > 0)
                        ? cr.scoring_categories
                        : (isCategory ? getDefaultScoringCategories(cr.max_points) : []);
                    const scoredCatsCount = isCategory ? Object.keys(critState.sub_scores || {}).filter(k => critState.sub_scores[k] !== undefined && critState.sub_scores[k] !== null && critState.sub_scores[k] !== '').length : 0;

                    return `
                        <div class="criterion-deck-card p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between h-full ${
                            isActive 
                                ? 'bg-white dark:bg-amber-950/30 border-2 border-buksu-gold shadow-md ring-2 ring-buksu-gold/30 text-slate-800 dark:text-slate-100' 
                                : 'bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600'
                        }" data-crit-id="${cr.id}">
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between gap-1.5 mb-1 flex-wrap">
                                    <div class="flex items-center gap-1 flex-wrap">
                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-black ${
                                            isActive 
                                                ? 'bg-buksu-navy text-buksu-gold font-black shadow-2xs' 
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                        }">
                                            ${cr.percentage}% Weight
                                        </span>
                                        ${isCategory ? `
                                            <span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-0.5">
                                                <i class="fa-solid fa-layer-group text-[8px] text-slate-500"></i> Category
                                            </span>
                                        ` : `
                                            <span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-0.5">
                                                <i class="fa-solid fa-list-check text-[8px]"></i> Criteria-Based
                                            </span>
                                        `}
                                    </div>
                                    <span class="deck-crit-status-badge px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shrink-0 ${
                                        isComplete 
                                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                    }">
                                        ${isComplete ? '<i class="fa-solid fa-circle-check text-xs text-emerald-600 dark:text-emerald-400"></i> Completed' : '<i class="fa-solid fa-circle-dot text-xs text-amber-500"></i> Pending Score'}
                                    </span>
                                </div>
                                <h4 class="font-extrabold text-sm truncate ${isActive ? 'text-buksu-navy dark:text-buksu-gold' : 'text-slate-800 dark:text-slate-100'}">
                                    ${escapeHtml(cr.title)}
                                </h4>
                                ${isCategory ? `
                                    <div class="deck-crit-category-pill ${scoredCatsCount > 0 ? '' : 'hidden'} inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                                        <i class="fa-solid fa-layer-group text-buksu-navy dark:text-buksu-gold"></i> <span class="deck-category-count-text">${scoredCatsCount}/${categories.length} Categories Scored</span>
                                    </div>
                                ` : `
                                    <div class="deck-crit-rating-pill ${critState.rating_name ? '' : 'hidden'} inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                                        <i class="fa-solid fa-award text-amber-600 dark:text-amber-400"></i> <span class="deck-rating-name-text">${escapeHtml(critState.rating_name || '')}</span>
                                    </div>
                                `}
                                <p class="text-[11px] truncate ${isActive ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-400'}">
                                    ${escapeHtml(cr.description || (isCategory ? `${categories.length} Categories (${scoredCatsCount}/${categories.length} scored)` : isRubric ? 'Predefined rubric rating' : `Range: ${cr.min_points || 0} - ${cr.max_points} pts`))}
                                </p>
                            </div>

                            <div class="mt-3 pt-2.5 border-t ${isActive ? 'border-amber-200/80 dark:border-amber-800/60' : 'border-slate-100 dark:border-slate-700'} flex items-center justify-between gap-2">
                                <div class="flex items-center gap-1.5 min-w-0">
                                    <span class="deck-crit-score text-sm font-black text-buksu-navy dark:text-buksu-gold leading-none">
                                        ${critState.score > 0 ? critState.score.toFixed(1) : (critState.is_scored ? '0.0' : '0.0')}
                                    </span>
                                    <span class="text-[11px] font-bold text-slate-400 leading-none">/ ${cr.max_points} pts</span>
                                    <span class="deck-weighted-pill text-[10px] font-extrabold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 leading-none">
                                        (${formatScore(weightedScore)}%)
                                    </span>
                                </div>
                                <span class="text-[10px] font-bold flex items-center gap-1 shrink-0 ${isActive ? 'text-amber-800 dark:text-amber-400 font-extrabold' : 'text-slate-400'}">
                                    ${isActive ? `<i class="fa-solid fa-eye text-amber-600 dark:text-amber-400"></i> ${isCategory ? 'Active Category' : isRubric ? 'Active Rubric' : 'Active Console'}` : 'Click to score <i class="fa-solid fa-chevron-right text-[9px]"></i>'}
                                </span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    // -------------------------------------------------------------
    // GOOGLE CLASSROOM-STYLE ACTIVE RUBRIC SCORING CARD CONTAINER
    // -------------------------------------------------------------
    html += `<div id="gc-active-rubric-card-container" class="mt-3"></div>`;

    // -------------------------------------------------------------
    // SPECIAL AWARDS & MEMBER CITATIONS (JUDGE ASSIGNMENT)
    // -------------------------------------------------------------
    html += `<div id="judge-special-awards-container" class="mt-5"></div>`;

    scoringBody.innerHTML = html;

    // Render active rubric card into the container and bind events
    renderActiveRubricSection();

    // Render special awards assignment section and bind events
    renderJudgeAwardsSection(contestant, isInputsDisabled);

    // Bind Deck Card Clicks
    document.querySelectorAll('.criterion-deck-card').forEach(card => {
        card.addEventListener('click', () => {
            const critId = card.dataset.critId;
            if (critId && critId !== activeCriterionId) {
                activeCriterionId = critId;
                renderScoringSheet();
                document.getElementById('gc-active-rubric-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    });

    // Bind Unlock Score Edit Button
    document.getElementById('unlockScoreEditBtn')?.addEventListener('click', () => {
        if (scoringBody) {
            scoringBody.dataset.unlocked = "true";
            renderScoringSheet();
        }
    });

    const canSubmit = isPeriodActive && (!isSubmitted || isUnlocked);
    toggleActionButtons(canSubmit);
}

function renderActiveRubricSection() {
    const container = document.getElementById('gc-active-rubric-card-container');
    if (!container) return;

    const scoringBody = document.getElementById('judge-scoring-form-body');
    const isPeriodActive = (currentEventData.judgingStatus === 'In Progress');
    const scoreEntry = judgeScoresMap[selectedContestantId];
    const isSubmitted = scoreEntry && scoreEntry.status === 'submitted';
    const isUnlocked = scoringBody?.dataset.unlocked === "true";
    const isInputsDisabled = (!isPeriodActive || (isSubmitted && !isUnlocked));

    const activeCriterion = criteriaList.find(cr => String(cr.id) === String(activeCriterionId)) || criteriaList[0];
    if (!activeCriterion) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = renderActiveRubricCard(activeCriterion, isInputsDisabled);

    bindCategoryCardInputs(container, activeCriterion, isInputsDisabled);

    // Bind Navigation buttons
    document.getElementById('gcPrevCriterionBtn')?.addEventListener('click', () => {
        const critIndex = criteriaList.findIndex(c => String(c.id) === String(activeCriterionId));
        if (critIndex > 0) {
            activeCriterionId = criteriaList[critIndex - 1].id;
            renderScoringSheet();
            document.getElementById('gc-active-rubric-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });

    document.getElementById('gcNextCriterionBtn')?.addEventListener('click', () => {
        const critIndex = criteriaList.findIndex(c => String(c.id) === String(activeCriterionId));
        if (critIndex < criteriaList.length - 1) {
            activeCriterionId = criteriaList[critIndex + 1].id;
            renderScoringSheet();
            document.getElementById('gc-active-rubric-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            // Last criterion: Scroll to Submit button
            document.getElementById('submitFinalScoreBtn')?.scrollIntoView({ behavior: 'smooth' });
            showToast('All criteria reviewed! You can now save draft or submit score.', 'info');
        }
    });
}

function getDefaultRubricRatingsList(maxPoints = 40) {
    const max = parseFloat(maxPoints) || 40;
    return [
        { id: 'rate-5', name: 'Outstanding', score: max, description: 'Exemplary performance exceeding all standards with exceptional mastery and creativity.' },
        { id: 'rate-4', name: 'Very Good', score: Math.round(max * 0.8 * 10) / 10, description: 'Strong and consistent execution meeting standards with commendable precision.' },
        { id: 'rate-3', name: 'Good', score: Math.round(max * 0.6 * 10) / 10, description: 'Competent and adequate performance meeting core criteria with minor inconsistencies.' },
        { id: 'rate-2', name: 'Fair', score: Math.round(max * 0.4 * 10) / 10, description: 'Incomplete or inconsistent execution requiring noticeable improvement.' },
        { id: 'rate-1', name: 'Poor', score: Math.round(max * 0.2 * 10) / 10, description: 'Lacks fundamental execution, coherence, or technique.' }
    ];
}

function bindCategoryCardInputs(container, activeCriterion, isInputsDisabled) {
    if (isInputsDisabled) return;

    const critId = activeCriterion.id;
    const maxPts = parseFloat(activeCriterion.max_points) || 100;
    const minPts = parseFloat(activeCriterion.min_points) || 0;
    const isCategory = (activeCriterion.scoring_type === 'category');

    if (isCategory) {
        // Category-Based Scoring — Bind Sub-Category Inputs & Steppers
        const categories = (Array.isArray(activeCriterion.scoring_categories) && activeCriterion.scoring_categories.length > 0)
            ? activeCriterion.scoring_categories
            : getDefaultScoringCategories(maxPts);

        const updateCategorySubScore = (catId, rawVal) => {
            if (!selectedContestantId) return;
            if (!contestantScoresState[selectedContestantId]) {
                contestantScoresState[selectedContestantId] = {};
            }
            if (!contestantScoresState[selectedContestantId][critId]) {
                contestantScoresState[selectedContestantId][critId] = { score: 0, sub_scores: {} };
            }

            const critState = contestantScoresState[selectedContestantId][critId];
            if (!critState.sub_scores) critState.sub_scores = {};

            const cat = categories.find(c => String(c.id) === String(catId));
            const catMax = cat ? (parseFloat(cat.points ?? cat.max_score) || 10) : 10;

            let val = parseFloat(rawVal);
            if (isNaN(val)) val = 0;
            if (val < 0) val = 0;
            if (val > catMax) val = catMax;
            val = Math.round(val * 10) / 10;

            critState.sub_scores[catId] = val;

            // Recalculate total score as sum of sub_scores
            let sum = 0;
            categories.forEach(c => {
                const cVal = parseFloat(critState.sub_scores[c.id]);
                if (!isNaN(cVal)) sum += cVal;
            });
            sum = Math.min(maxPts, Math.round(sum * 10) / 10);
            critState.score = sum;
            critState.rating_id = '';
            critState.rating_name = '';
            critState.is_scored = true;

            // Update DOM element for this category card
            const catCard = container.querySelector(`.category-scoring-card[data-cat-id="${catId}"]`);
            if (catCard) {
                const input = catCard.querySelector('.category-score-input');
                if (input && document.activeElement !== input) {
                    input.value = val;
                }
                const statusBadge = catCard.querySelector('.cat-card-status');
                if (statusBadge) {
                    statusBadge.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #16a34a; margin-right: 3px;"></i> ${val.toFixed(1)} pts`;
                    statusBadge.style.color = '#031527';
                }
            }

            // Update live category sum header in active card
            const liveSumDisplay = container.querySelector('#gc-category-live-sum');
            if (liveSumDisplay) {
                liveSumDisplay.textContent = sum.toFixed(1);
            }

            // Update footer text
            const footerScoreText = document.getElementById('gc-footer-score-text');
            if (footerScoreText) {
                footerScoreText.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-600 me-1"></i> Sub-scores total: <strong>${sum.toFixed(1)}</strong> / ${maxPts} pts`;
            }

            updateLiveDisplays();
        };

        container.querySelectorAll('.category-score-input').forEach(input => {
            input.addEventListener('input', () => updateCategorySubScore(input.dataset.catId, input.value));
            input.addEventListener('change', () => {
                updateCategorySubScore(input.dataset.catId, input.value);
                const critState = contestantScoresState[selectedContestantId]?.[critId];
                if (critState?.sub_scores?.[input.dataset.catId] !== undefined) {
                    input.value = critState.sub_scores[input.dataset.catId];
                }
            });
            input.addEventListener('blur', () => {
                const critState = contestantScoresState[selectedContestantId]?.[critId];
                if (critState?.sub_scores?.[input.dataset.catId] !== undefined) {
                    input.value = critState.sub_scores[input.dataset.catId];
                }
            });
        });

        container.querySelectorAll('.cat-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const catId = btn.dataset.catId;
                const targetVal = parseFloat(btn.dataset.val) || 0;
                updateCategorySubScore(catId, targetVal);
            });
        });

        return;
    }

    // Criteria-Based ('rubric') Scoring — Bind Rating Cards
    container.querySelectorAll('.rubric-rating-card').forEach(card => {
        card.addEventListener('click', () => {
            const ratingId = card.dataset.ratingId;
            const ratingScore = parseFloat(card.dataset.ratingScore) || 0;
            const ratingName = card.dataset.ratingName || '';

            if (!selectedContestantId) return;
            if (!contestantScoresState[selectedContestantId]) {
                contestantScoresState[selectedContestantId] = {};
            }
            if (!contestantScoresState[selectedContestantId][critId]) {
                contestantScoresState[selectedContestantId][critId] = { score: 0, sub_scores: {} };
            }

            const critState = contestantScoresState[selectedContestantId][critId];
            critState.score = ratingScore;
            critState.rating_id = ratingId;
            critState.rating_name = ratingName;
            critState.is_scored = true;

            // Visual update on all rating cards
            container.querySelectorAll('.rubric-rating-card').forEach(c => {
                const isSelected = String(c.dataset.ratingId) === String(ratingId);
                if (isSelected) {
                    c.classList.add('border-buksu-navy', 'dark:border-buksu-gold', 'bg-slate-50/90', 'dark:bg-slate-800/90', 'ring-2', 'ring-buksu-navy/20', 'dark:ring-buksu-gold/30', 'shadow-md', '-translate-y-0.5');
                    c.classList.remove('border-slate-200/90', 'dark:border-slate-700', 'bg-white', 'dark:bg-slate-800/90', 'shadow-2xs');
                    const icon = c.querySelector('.rubric-radio-icon');
                    if (icon) icon.className = 'rubric-radio-icon fa-solid fa-circle-check text-buksu-navy dark:text-buksu-gold text-base';
                    const badge = c.querySelector('.rubric-score-badge');
                    if (badge) badge.className = 'rubric-score-badge px-2.5 py-1 rounded-xl text-xs font-black shrink-0 bg-buksu-navy text-buksu-gold shadow-xs';
                    const status = c.querySelector('.rubric-card-status');
                    if (status) {
                        status.innerHTML = '<i class="fa-solid fa-check-double text-buksu-navy dark:text-buksu-gold me-1"></i> Selected Rating';
                        status.className = 'rubric-card-status text-[11px] font-bold text-buksu-navy dark:text-buksu-gold';
                    }
                } else {
                    c.classList.remove('border-buksu-navy', 'dark:border-buksu-gold', 'bg-slate-50/90', 'dark:bg-slate-800/90', 'ring-2', 'ring-buksu-navy/20', 'dark:ring-buksu-gold/30', 'shadow-md', '-translate-y-0.5');
                    c.classList.add('border-slate-200/90', 'dark:border-slate-700', 'bg-white', 'dark:bg-slate-800/90', 'shadow-2xs');
                    const icon = c.querySelector('.rubric-radio-icon');
                    if (icon) icon.className = 'rubric-radio-icon fa-regular fa-circle text-slate-300 text-base';
                    const badge = c.querySelector('.rubric-score-badge');
                    if (badge) badge.className = 'rubric-score-badge px-2.5 py-1 rounded-xl text-xs font-black shrink-0 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
                    const status = c.querySelector('.rubric-card-status');
                    if (status) {
                        status.innerHTML = '<i class="fa-regular fa-hand-pointer text-slate-400 me-1"></i> Tap to select';
                        status.className = 'rubric-card-status text-[11px] font-bold text-slate-400';
                    }
                }
            });

            const awardedBadge = container.querySelector('#gc-rubric-awarded-badge');
            if (awardedBadge) {
                awardedBadge.textContent = ratingName;
                awardedBadge.className = 'px-2.5 py-0.5 rounded-md text-xs font-black bg-buksu-navy text-buksu-gold shadow-xs';
            }

            const footerScoreText = document.getElementById('gc-footer-score-text');
            if (footerScoreText) {
                footerScoreText.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-600 me-1"></i> Selected rating: <strong>${escapeHtml(ratingName)}</strong> (${ratingScore.toFixed(1)} / ${maxPts} pts)`;
            }

            updateLiveDisplays();
        });
    });
}

function getDefaultScoringCategories(totalMax = 30) {
    const max = parseFloat(totalMax) || 30;
    const perCat = Math.round((max / 3) * 10) / 10;
    const remainder = Math.round((max - (perCat * 2)) * 10) / 10;
    return [
        { id: 'cat-1', name: 'Stance uniqueness', points: perCat, max_score: perCat, description: 'Beautiful stance and unique positioning' },
        { id: 'cat-2', name: 'Pose preference', points: perCat, max_score: perCat, description: 'Wonderful preference, alignment, and visual poise' },
        { id: 'cat-3', name: 'Crowd impact', points: remainder, max_score: remainder, description: 'Crowds shout continuously, powerful audience connection' }
    ];
}

function renderActiveRubricCard(cr, isInputsDisabled) {
    const contestantScores = contestantScoresState[selectedContestantId] || {};
    const critState = contestantScores[cr.id] || { score: 0, rating_id: '', rating_name: '', sub_scores: {} };
    if (!critState.sub_scores) critState.sub_scores = {};

    const critIndex = criteriaList.findIndex(c => String(c.id) === String(cr.id));
    const maxPts = parseFloat(cr.max_points) || 100;
    const minPts = parseFloat(cr.min_points) || 0;
    const scoreStep = parseFloat(cr.score_step) || 0.5;
    const weightedScore = (critState.score / maxPts) * cr.percentage;
    const isComplete = (critState.score > 0) || (critState.rating_id && critState.rating_id !== '') || Boolean(critState.is_scored);

    const isCategory = (cr.scoring_type === 'category');
    const isRubric = !isCategory;

    let cardHtml = `
        <div id="gc-active-rubric-card" class="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 shadow-md space-y-6 animate-fade-in relative">
            <!-- Active Card Header -->
            <div class="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-700/80 pb-4 flex-wrap bg-slate-50/80 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                <div class="space-y-1.5 max-w-xl">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-buksu-navy text-buksu-gold shadow-2xs">
                            Criterion ${critIndex + 1} of ${criteriaList.length}
                        </span>
                        <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            ${cr.percentage}% Weight
                        </span>
                        ${isCategory ? `
                            <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                                <i class="fa-solid fa-layer-group text-buksu-navy dark:text-buksu-gold"></i> Category-Based Scoring (${maxPts} pts total)
                            </span>
                        ` : `
                            <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                                <i class="fa-solid fa-list-check"></i> Criteria-Based Scoring
                            </span>
                        `}
                        <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold ${isComplete ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1' : 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'}">
                            ${isComplete ? '<i class="fa-solid fa-circle-check text-xs text-emerald-600 dark:text-emerald-400"></i> Evaluated' : 'Pending Evaluation'}
                        </span>
                    </div>
                    <h3 class="font-black text-slate-800 dark:text-slate-100 text-lg sm:text-xl leading-snug">
                        ${escapeHtml(cr.title)}
                    </h3>
                    ${cr.description ? `<p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">${escapeHtml(cr.description)}</p>` : ''}
                    ${cr.instructions ? `
                        <div class="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2 mt-2">
                            <i class="fa-solid fa-lightbulb text-amber-600 dark:text-amber-400 mt-0.5 shrink-0"></i>
                            <div>
                                <span class="font-bold">Guidelines for Judges:</span> ${escapeHtml(cr.instructions)}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <div class="text-right shrink-0 bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-xs">
                    <span class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Criterion Total</span>
                    <div class="inline-flex items-baseline gap-1 mt-0.5">
                        <span id="gc-crit-pts-display" class="text-2xl font-black text-buksu-navy dark:text-buksu-gold">${critState.score > 0 ? critState.score.toFixed(1) : (critState.is_scored ? '0.0' : '0.0')}</span>
                        <span class="text-xs font-bold text-slate-400">/ ${maxPts} pts</span>
                    </div>
                    <span class="block text-[11px] font-black text-slate-700 dark:text-slate-300 mt-0.5">
                        <span id="gc-crit-weighted-display">${formatScore(weightedScore)}</span>% toward final
                    </span>
                </div>
            </div>
    `;

    if (isCategory) {
        // CHOICE 3: CATEGORY-BASED SCORING — Score each sub-category
        const categories = (Array.isArray(cr.scoring_categories) && cr.scoring_categories.length > 0)
            ? cr.scoring_categories
            : getDefaultScoringCategories(maxPts);

        cardHtml += `
            <div class="space-y-4">
                <div class="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <h5 class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                            <i class="fa-solid fa-layer-group text-buksu-navy dark:text-buksu-gold"></i> Score Categories (${categories.length} Categories &bull; Total ${maxPts} pts)
                        </h5>
                        <p class="text-[11px] text-slate-500 dark:text-slate-400">Score each individual category up to its configured max score. Sub-scores dynamically sum to form this criterion's score.</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center px-3 py-1 rounded-xl text-xs font-black bg-buksu-navy text-buksu-gold border border-buksu-gold/30 shadow-xs">
                            Category Total:&nbsp;<span id="gc-category-live-sum" class="font-black">${critState.score > 0 ? critState.score.toFixed(1) : (critState.is_scored ? '0.0' : '0.0')}</span>&nbsp;/ ${maxPts} pts
                        </span>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-${Math.min(categories.length, 3)} gap-4">
                    ${categories.map((cat, idx) => {
                        const catId = cat.id || ('cat-' + (idx + 1));
                        const catMax = parseFloat(cat.points ?? cat.max_score) || 10;
                        const subScore = critState.sub_scores?.[catId] !== undefined ? parseFloat(critState.sub_scores[catId]) : null;
                        const hasSubScore = (subScore !== null && !isNaN(subScore));
                        const currentVal = hasSubScore ? subScore : '';
                        const halfVal = Math.round((catMax / 2) * 10) / 10;

                        return `
                            <div class="category-scoring-card p-4 sm:p-5 rounded-2xl border-2 border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800/90 hover:border-slate-400 transition-all flex flex-col justify-between space-y-3.5 shadow-2xs ${
                                isInputsDisabled ? 'opacity-60 pointer-events-none' : ''
                            }" data-cat-id="${catId}">
                                <div class="space-y-2">
                                    <div class="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-700/80">
                                        <div class="space-y-0.5 flex-1">
                                            <div class="flex items-center gap-1.5 flex-wrap">
                                                <span class="w-5 h-5 rounded-md bg-buksu-navy text-white flex items-center justify-center font-black text-[10px] shrink-0">
                                                    #${idx + 1}
                                                </span>
                                                <h6 class="font-black text-sm text-slate-800 dark:text-slate-100 leading-tight">
                                                    ${escapeHtml(cat.name)}
                                                </h6>
                                            </div>
                                        </div>
                                        <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-black bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                                            Max ${catMax} pts
                                        </span>
                                    </div>
                                    ${cat.description ? `
                                        <p class="text-xs text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
                                            ${escapeHtml(cat.description)}
                                        </p>
                                    ` : ''}
                                </div>

                                <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid #f1f5f9;">
                                    <!-- Direct Clean User Input for Category Score -->
                                    <div style="margin-bottom: 8px;">
                                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                            <span style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.04em;">
                                                Enter Score
                                            </span>
                                            <span style="font-size: 11px; font-weight: 700; color: #94a3b8;">
                                                0 &ndash; ${catMax} pts
                                            </span>
                                        </div>
                                        <input type="number" 
                                            step="any" 
                                            min="0" 
                                            max="${catMax}" 
                                            class="category-score-input"
                                            style="display: block; width: 100%; height: 46px; padding: 0 16px; font-size: 18px; font-weight: 800; color: #0f172a; background: #ffffff; border: 2px solid #cbd5e1; border-radius: 12px; outline: none; text-align: center; box-sizing: border-box; transition: all 0.2s ease;"
                                            onfocus="this.style.borderColor='#031527'; this.style.boxShadow='0 0 0 3px rgba(3, 21, 39, 0.15)';"
                                            onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none';"
                                            placeholder="0 - ${catMax}" 
                                            value="${currentVal}" 
                                            data-cat-id="${catId}"
                                            ${isInputsDisabled ? 'disabled' : ''}>
                                    </div>

                                    <!-- Quick Presets & Status -->
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; padding-top: 2px;">
                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            <button type="button" class="cat-preset-btn" data-cat-id="${catId}" data-val="0" style="padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; cursor: pointer; transition: background 0.15s ease;" title="Score 0">
                                                0
                                            </button>
                                            <button type="button" class="cat-preset-btn" data-cat-id="${catId}" data-val="${halfVal}" style="padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; cursor: pointer; transition: background 0.15s ease;" title="Half score">
                                                Half (${halfVal})
                                            </button>
                                            <button type="button" class="cat-preset-btn" data-cat-id="${catId}" data-val="${catMax}" style="padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; background: #031527; color: #f5b800; border: 1px solid rgba(245, 184, 0, 0.3); cursor: pointer; transition: background 0.15s ease;" title="Max score">
                                                Max (${catMax})
                                            </button>
                                        </div>
                                        <span class="cat-card-status" style="font-size: 11px; font-weight: 800; color: ${hasSubScore ? '#031527' : '#94a3b8'};">
                                            ${hasSubScore ? `<i class="fa-solid fa-circle-check" style="color: #16a34a; margin-right: 3px;"></i> ${subScore.toFixed(1)} pts` : '<i class="fa-regular fa-circle" style="color: #cbd5e1; margin-right: 3px;"></i> Pending'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    } else {
        // Criteria-Based ('rubric') Scoring — Select predefined rating with fixed score and description
        const ratings = (Array.isArray(cr.rubric_ratings) && cr.rubric_ratings.length > 0)
            ? cr.rubric_ratings
            : getDefaultRubricRatingsList(maxPts);

        cardHtml += `
            <div class="space-y-4">
                <div class="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <h5 class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                            <i class="fa-solid fa-list-check text-amber-600 dark:text-amber-400"></i> Predefined Ratings (${ratings.length} Rating Levels)
                        </h5>
                        <p class="text-[11px] text-slate-500 dark:text-slate-400">Select one predefined rating below. The fixed score is awarded automatically.</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[11px] font-extrabold text-slate-500 dark:text-slate-400">Awarded Rating:</span>
                        <span id="gc-rubric-awarded-badge" class="px-2.5 py-0.5 rounded-md text-xs font-black ${critState.rating_name ? 'bg-buksu-navy text-buksu-gold shadow-xs' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}">
                            ${escapeHtml(critState.rating_name || 'None Selected')}
                        </span>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(ratings.length, 4)} gap-3.5">
                    ${ratings.map(r => {
                        const rScore = parseFloat(r.score) || 0;
                        const isSelected = String(critState.rating_id) === String(r.id) || (!critState.rating_id && critState.score === rScore && rScore > 0);

                        return `
                            <div class="rubric-rating-card p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                                isInputsDisabled ? 'opacity-60 pointer-events-none' : ''
                            } ${
                                isSelected 
                                    ? 'border-buksu-navy dark:border-buksu-gold bg-slate-50/90 dark:bg-slate-800/90 ring-2 ring-buksu-navy/20 dark:ring-buksu-gold/30 shadow-md transform -translate-y-0.5' 
                                    : 'border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800/90 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 shadow-2xs'
                            }" data-rating-id="${r.id}" data-rating-score="${rScore}" data-rating-name="${escapeHtml(r.name)}">
                                <div class="space-y-2">
                                    <div class="flex items-start justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-700/80">
                                        <div class="flex items-center gap-2">
                                            <i class="rubric-radio-icon fa-${isSelected ? 'solid fa-circle-check text-buksu-navy dark:text-buksu-gold' : 'regular fa-circle text-slate-300'} text-base"></i>
                                            <h6 class="font-black text-sm text-slate-800 dark:text-slate-100 leading-tight">
                                                ${escapeHtml(r.name)}
                                            </h6>
                                        </div>
                                        <span class="rubric-score-badge px-2.5 py-1 rounded-xl text-xs font-black shrink-0 ${
                                            isSelected ? 'bg-buksu-navy text-buksu-gold shadow-xs' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                        }">
                                            ${rScore.toFixed(1)} pts
                                        </span>
                                    </div>
                                    ${r.description ? `
                                        <p class="text-xs text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
                                            ${escapeHtml(r.description)}
                                        </p>
                                    ` : ''}
                                </div>

                                <div class="pt-2 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between text-xs">
                                    <span class="rubric-card-status text-[11px] font-bold ${isSelected ? 'text-buksu-navy dark:text-buksu-gold' : 'text-slate-400'}">
                                        ${isSelected ? '<i class="fa-solid fa-check-double text-buksu-navy dark:text-buksu-gold me-1"></i> Selected Rating' : '<i class="fa-regular fa-hand-pointer text-slate-400 me-1"></i> Tap to select'}
                                    </span>
                                    <span class="text-[10px] font-extrabold text-slate-400">
                                        Fixed: ${rScore} pts
                                    </span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // Navigation Controls within the Card
    const hasPrev = critIndex > 0;
    const hasNext = critIndex < criteriaList.length - 1;

    cardHtml += `
            <!-- Card Footer Navigation -->
            <div class="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between flex-wrap gap-3">
                <button type="button" id="gcPrevCriterionBtn" 
                    class="px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                        hasPrev 
                            ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer shadow-2xs' 
                            : 'bg-slate-50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 cursor-not-allowed pointer-events-none'
                    }">
                    <i class="fa-solid fa-arrow-left"></i> Previous Criterion
                </button>

                <span id="gc-footer-score-text" class="text-xs text-slate-400 font-semibold">
                    ${isComplete ? `<i class="fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400 me-1"></i> Current score: ${critState.score.toFixed(1)} / ${maxPts} pts` : 'No score entered for this criterion'}
                </span>

                <button type="button" id="gcNextCriterionBtn" 
                    class="px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                        hasNext 
                            ? 'bg-buksu-navy hover:bg-buksu-navy-light text-white cursor-pointer shadow-xs' 
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs'
                    }">
                    ${hasNext ? 'Next Criterion <i class="fa-solid fa-arrow-right"></i>' : 'Review & Submit <i class="fa-solid fa-check"></i>'}
                </button>
            </div>
        </div>
    `;

    return cardHtml;
}

function calculateContestantTotal(contestantId) {
    const contestantScores = contestantScoresState[contestantId] || {};
    let total = 0.0;

    criteriaList.forEach(cr => {
        const critState = contestantScores[cr.id];
        if (critState && critState.score > 0) {
            const weighted = (critState.score / cr.max_points) * cr.percentage;
            total += weighted;
        }
    });

    return Math.round(total * 100) / 100;
}

function updateLiveDisplays() {
    if (!selectedContestantId) return;
    const contestantScores = contestantScoresState[selectedContestantId] || {};

    // 1. Update overall event total score
    const totalScore = calculateContestantTotal(selectedContestantId);
    const totalDisplay = document.getElementById('judge-live-total-score');
    if (totalDisplay) {
        totalDisplay.textContent = `${formatScore(totalScore)}%`;
    }

    // 2. Update active criterion header display
    if (activeCriterionId) {
        const activeCrit = criteriaList.find(c => String(c.id) === String(activeCriterionId));
        const critState = contestantScores[activeCriterionId] || { score: 0, sub_scores: {} };
        if (activeCrit) {
            const ptsDisplay = document.getElementById('gc-crit-pts-display');
            const weightedDisplay = document.getElementById('gc-crit-weighted-display');
            const weightedScore = (critState.score / activeCrit.max_points) * activeCrit.percentage;

            if (ptsDisplay) ptsDisplay.textContent = critState.score > 0 ? critState.score.toFixed(1) : (critState.is_scored ? '0.0' : '0.0');
            if (weightedDisplay) weightedDisplay.textContent = formatScore(weightedScore);
        }
    }

    // 3. Update deck card preview for the active criterion
    if (activeCriterionId) {
        const deckCard = document.querySelector(`.criterion-deck-card[data-crit-id="${activeCriterionId}"]`);
        if (deckCard) {
            const activeCrit = criteriaList.find(c => String(c.id) === String(activeCriterionId));
            const critState = contestantScores[activeCriterionId] || { score: 0, sub_scores: {} };
            const weightedScore = (critState.score / activeCrit.max_points) * activeCrit.percentage;

            const scoreDisplay = deckCard.querySelector('.deck-crit-score') || deckCard.querySelector('.text-sm.font-black');
            if (scoreDisplay) scoreDisplay.textContent = critState.score > 0 ? critState.score.toFixed(1) : (critState.is_scored ? '0.0' : '0.0');

            const weightedPill = deckCard.querySelector('.deck-weighted-pill') || deckCard.querySelector('.text-\\[10px\\].font-extrabold');
            if (weightedPill) weightedPill.textContent = `(${formatScore(weightedScore)}%)`;

            // Update rating pill if present
            const ratingPill = deckCard.querySelector('.deck-crit-rating-pill');
            if (ratingPill) {
                if (critState.rating_name) {
                    ratingPill.innerHTML = `<i class="fa-solid fa-award text-amber-500"></i> <span class="deck-rating-name-text">${escapeHtml(critState.rating_name)}</span>`;
                    ratingPill.classList.remove('hidden');
                } else {
                    ratingPill.classList.add('hidden');
                }
            }

            // Update category pill if present
            const categoryPill = deckCard.querySelector('.deck-crit-category-pill');
            if (categoryPill && activeCrit?.scoring_type === 'category') {
                const categories = (Array.isArray(activeCrit.scoring_categories) && activeCrit.scoring_categories.length > 0)
                    ? activeCrit.scoring_categories
                    : getDefaultScoringCategories(activeCrit.max_points);
                const scoredCats = Object.keys(critState.sub_scores || {}).filter(k => critState.sub_scores[k] !== undefined && critState.sub_scores[k] !== null && critState.sub_scores[k] !== '').length;
                if (scoredCats > 0) {
                    categoryPill.innerHTML = `<i class="fa-solid fa-layer-group text-buksu-navy dark:text-buksu-gold"></i> <span class="deck-category-count-text">${scoredCats}/${categories.length} Categories Scored</span>`;
                    categoryPill.classList.remove('hidden');
                } else {
                    categoryPill.classList.add('hidden');
                }
            }

            // Update status badge
            const isComplete = (critState.score > 0) || (critState.rating_id && critState.rating_id !== '') || Boolean(critState.is_scored);
            const statusBadge = deckCard.querySelector('.deck-crit-status-badge');
            if (statusBadge) {
                statusBadge.innerHTML = isComplete 
                    ? '<i class="fa-solid fa-circle-check text-xs text-emerald-600 dark:text-emerald-400"></i> Completed'
                    : '<i class="fa-solid fa-circle-dot text-xs text-amber-500"></i> Pending Score';
                statusBadge.className = `deck-crit-status-badge px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shrink-0 ${isComplete ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`;
            }
        }
    }

    // 4. Update criteria scored count in contestant header banner
    let completedCriteriaCount = 0;
    criteriaList.forEach(cr => {
        const cs = contestantScores[cr.id];
        if (cs && (cs.score > 0 || cs.rating_id || cs.is_scored)) {
            completedCriteriaCount++;
        }
    });
    const headerCountBadge = document.getElementById('judge-header-criteria-count');
    if (headerCountBadge) {
        headerCountBadge.textContent = `${completedCriteriaCount} / ${criteriaList.length} Criteria Scored`;
        headerCountBadge.className = `px-2 py-0.5 rounded-full text-[10px] font-extrabold ${completedCriteriaCount === criteriaList.length ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`;
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

    const contestantScores = contestantScoresState[selectedContestantId] || {};
    const criteriaScoresPayload = [];
    let firstIncompleteCrit = null;

    for (const cr of criteriaList) {
        const critState = contestantScores[cr.id] || { score: 0, sub_scores: {} };
        const isCategory = (cr.scoring_type === 'category');
        let isComplete = (critState.score > 0) || (critState.rating_id && critState.rating_id !== '') || Boolean(critState.is_scored);

        if (isCategory && action === 'submit') {
            const categories = (Array.isArray(cr.scoring_categories) && cr.scoring_categories.length > 0)
                ? cr.scoring_categories
                : getDefaultScoringCategories(cr.max_points);
            const scoredCats = Object.keys(critState.sub_scores || {}).filter(k => critState.sub_scores[k] !== undefined && critState.sub_scores[k] !== null && critState.sub_scores[k] !== '');
            if (scoredCats.length < categories.length) {
                isComplete = false;
            }
        }

        if (!isComplete && !firstIncompleteCrit) {
            firstIncompleteCrit = cr;
        }

        criteriaScoresPayload.push({
            criteria_id: cr.id,
            max: cr.max_points,
            score: critState.score || 0,
            rating_id: critState.rating_id || '',
            rating_name: critState.rating_name || '',
            sub_scores: critState.sub_scores || {}
        });
    }

    if (firstIncompleteCrit && action === 'submit') {
        const isCategory = (firstIncompleteCrit.scoring_type === 'category');
        const actionPrompt = isCategory ? 'score all categories' : 'select a rating';
        showToast(`Please ${actionPrompt} for "${firstIncompleteCrit.title}" before submitting.`, 'warning');
        activeCriterionId = firstIncompleteCrit.id;
        renderScoringSheet();
        document.getElementById('gc-active-rubric-card')?.scrollIntoView({ behavior: 'smooth' });
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
        criteria_scores: criteriaScoresPayload,
        action: action
    });

    if (btn) btn.disabled = false;

    if (res.success) {
        showToast(action === 'submit' ? 'Final Score Submitted!' : 'Draft Score Saved!', res.message || 'Your score has been recorded.', 'success');

        // Update local cache
        judgeScoresMap[selectedContestantId] = {
            id: res.score_id,
            contestant_id: selectedContestantId,
            criteria_scores: criteriaScoresPayload,
            total_score: res.total_score,
            status: action === 'submit' ? 'submitted' : 'draft',
            submitted_at: new Date().toISOString()
        };

        const scoringBody = document.getElementById('judge-scoring-form-body');
        if (scoringBody) delete scoringBody.dataset.unlocked;

        renderJudgeContestants();
        renderScoringSheet();

        // Close the modal / popup for feedback as requested by user
        document.getElementById('judge-scoring-modal')?.classList.add('hidden');

        // Refresh events list on the dashboard
        document.getElementById('refreshUserEventsBtn')?.click();
        document.getElementById('refreshEventsBtn')?.click();
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

function renderHeaderCitationsHtml(contestant) {
    const comments = Array.isArray(contestant?.comments) ? contestant.comments : [];
    if (comments.length === 0) return '';

    return comments.map(c => `
        <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-400 text-buksu-navy shadow-xs flex items-center gap-1.5 animate-fade-in">
            <i class="fa-solid fa-award text-amber-900"></i> ${escapeHtml(c.text || c.award_title || '')}
        </span>
    `).join('');
}

function updateHeaderAwardsDisplay(contestant) {
    const container = document.getElementById('judge-header-citations-container');
    if (container) {
        container.innerHTML = renderHeaderCitationsHtml(contestant);
    }
}

function renderJudgeAwardsSection(contestant, isInputsDisabled) {
    const container = document.getElementById('judge-special-awards-container');
    if (!container || !contestant) return;

    const scoringBody = document.getElementById('judge-scoring-form-body');
    const isPeriodActive = (currentEventData?.judgingStatus === 'In Progress');
    const scoreEntry = judgeScoresMap[selectedContestantId];
    const isSubmitted = scoreEntry && scoreEntry.status === 'submitted';
    const isUnlocked = scoringBody?.dataset.unlocked === "true";

    if (typeof isInputsDisabled === 'undefined') {
        isInputsDisabled = (!isPeriodActive || (isSubmitted && !isUnlocked));
    }

    const isTeam = contestant.entry_type === 'team';
    const members = Array.isArray(contestant.team_members) ? contestant.team_members : [];

    let lockBannerHtml = '';
    if (isInputsDisabled) {
        if (!isPeriodActive) {
            lockBannerHtml = `
                <div class="p-3.5 rounded-2xl bg-amber-100/90 border border-amber-300 text-amber-900 text-xs flex items-center gap-2.5 shadow-2xs animate-fade-in">
                    <div class="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm shrink-0 shadow-2xs font-bold">
                        <i class="fa-solid fa-lock"></i>
                    </div>
                    <div>
                        <p class="font-extrabold text-slate-900">Special Awards &amp; Citations Locked</p>
                        <p class="text-[11px] text-amber-800 mt-0.5">Judging period is currently <strong>${escapeHtml(currentEventData?.judgingStatus || 'Not Active')}</strong>. Awards and scoring cannot be modified until an administrator starts the session.</p>
                    </div>
                </div>
            `;
        } else if (isSubmitted && !isUnlocked) {
            const unlockPolicy = currentSettings?.judging?.unlockPolicy || 'admin_approval';
            if (unlockPolicy === 'admin_approval') {
                lockBannerHtml = `
                    <div class="p-3.5 rounded-2xl bg-slate-100/90 border border-slate-300 text-slate-800 text-xs flex items-center gap-2.5 shadow-2xs animate-fade-in">
                        <div class="w-8 h-8 rounded-xl bg-slate-400 text-white flex items-center justify-center text-sm shrink-0 shadow-2xs font-bold">
                            <i class="fa-solid fa-lock"></i>
                        </div>
                        <div>
                            <p class="font-extrabold text-slate-900">Special Awards &amp; Citations Locked (Read-Only)</p>
                            <p class="text-[11px] text-slate-600 mt-0.5">Evaluation is locked together with scoring. Under system policy, ask an Administrator or Tabulator to unlock this contestant's evaluation from the Tabulation Board to revise.</p>
                        </div>
                    </div>
                `;
            } else if (unlockPolicy === 'judge_self_unlock') {
                lockBannerHtml = `
                    <div class="p-3.5 rounded-2xl bg-amber-100/90 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-3 flex-wrap shadow-2xs animate-fade-in">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm shrink-0 shadow-2xs font-bold">
                                <i class="fa-solid fa-lock"></i>
                            </div>
                            <div>
                                <p class="font-extrabold text-slate-900">Special Awards &amp; Citations Locked</p>
                                <p class="text-[11px] text-amber-800 mt-0.5">Evaluation has been submitted. Click <strong>"Edit Evaluation"</strong> to unlock both scoring and citations as a whole.</p>
                            </div>
                        </div>
                        <button type="button" class="unified-edit-eval-trigger px-3.5 py-2 bg-white border border-amber-400 hover:bg-amber-50 text-amber-950 font-black rounded-xl text-xs cursor-pointer shadow-xs flex items-center gap-1.5 transition-all hover:scale-[1.02]">
                            <i class="fa-solid fa-pen-to-square text-amber-600"></i> Edit Evaluation (Scores &amp; Awards)
                        </button>
                    </div>
                `;
            } else {
                lockBannerHtml = `
                    <div class="p-3.5 rounded-2xl bg-slate-100/90 border border-slate-300 text-slate-800 text-xs flex items-center gap-2.5 shadow-2xs animate-fade-in">
                        <div class="w-8 h-8 rounded-xl bg-slate-400 text-white flex items-center justify-center text-sm shrink-0 shadow-2xs font-bold">
                            <i class="fa-solid fa-lock"></i>
                        </div>
                        <div>
                            <p class="font-extrabold text-slate-900">Special Awards &amp; Citations Strictly Locked</p>
                            <p class="text-[11px] text-slate-600 mt-0.5">This evaluation has been finalized and strictly locked. Edits to scores and citations are disabled.</p>
                        </div>
                    </div>
                `;
            }
        }
    }

    container.innerHTML = `
        <div id="judge-awards-card" class="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-800/90 border ${
            isInputsDisabled 
                ? 'border-slate-200/90 dark:border-slate-700/80' 
                : 'border-amber-200/90 dark:border-amber-900/40'
        } shadow-sm space-y-4 transition-all">
            <div class="flex items-start justify-between gap-3 flex-wrap border-b ${isInputsDisabled ? 'border-slate-200 dark:border-slate-700' : 'border-amber-200/70 dark:border-amber-900/40'} pb-3">
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-xl ${isInputsDisabled ? 'bg-slate-400' : 'bg-amber-500'} text-white flex items-center justify-center font-bold text-sm shadow-xs transition-colors">
                        <i class="fa-solid ${isInputsDisabled ? 'fa-lock' : 'fa-award'}"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <h4 class="font-black text-slate-800 dark:text-slate-100 text-sm">Special Awards &amp; Member Citations</h4>
                            ${isInputsDisabled ? `
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 flex items-center gap-1">
                                    <i class="fa-solid fa-lock text-[9px]"></i> Read-Only (Inactive)
                                </span>
                            ` : `
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                    <i class="fa-solid fa-pen text-[9px]"></i> Editing Active
                                </span>
                            `}
                        </div>
                        <p class="text-[11px] text-slate-600 dark:text-slate-300">
                            ${isTeam 
                                ? 'Recognize standout individual performers within this team (e.g. "Best Keyboardist", "Best Lead Vocalist")' 
                                : 'Award exclusive special citations for this contestant (e.g. "Best Costume", "Judges\' Choice Award")'}
                        </p>
                    </div>
                </div>
                ${isTeam && members.length > 0 ? `
                    <span class="px-2.5 py-1 rounded-xl text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                        <i class="fa-solid fa-users me-1"></i> ${members.length} Team Members
                    </span>
                ` : ''}
            </div>

            ${lockBannerHtml}

            <!-- Form to Assign New Award -->
            <form id="judgeAssignAwardForm" onsubmit="return false;" class="p-4 rounded-2xl border transition-all space-y-3 ${
                isInputsDisabled 
                    ? 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/90 dark:border-slate-700/80 select-none' 
                    : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 shadow-2xs'
            }">
                <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                    ${isTeam ? `
                    <div class="sm:col-span-5">
                        <label class="block font-bold ${isInputsDisabled ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'} mb-1">
                            Target Member <span class="text-slate-400 dark:text-slate-500 font-normal">(on this team)</span>
                        </label>
                        ${members.length > 0 ? `
                            <select id="judge-award-member-select" ${isInputsDisabled ? 'disabled' : ''} class="w-full px-3 py-2 ${
                                isInputsDisabled 
                                    ? 'bg-slate-200/70 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-400 cursor-not-allowed' 
                                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500'
                            } rounded-xl text-xs font-bold">
                                <option value="">-- Choose Member or Entire Team --</option>
                                <option value="Entire Team">Entire Team / Group</option>
                                ${members.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}
                            </select>
                        ` : `
                            <input type="text" id="judge-award-member-input" ${isInputsDisabled ? 'disabled' : ''} placeholder="${isInputsDisabled ? 'Editing locked' : 'e.g. Keyboardist or Member Name'}" class="w-full px-3 py-2 ${
                                isInputsDisabled 
                                    ? 'bg-slate-200/70 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-400 cursor-not-allowed placeholder-slate-400' 
                                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500'
                            } rounded-xl text-xs font-bold">
                        `}
                    </div>
                    ` : ''}

                    <div class="${isTeam ? 'sm:col-span-5' : 'sm:col-span-8'}">
                        <label class="block font-bold ${isInputsDisabled ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'} mb-1">Award / Citation Title</label>
                        <input type="text" id="judge-award-title-input" ${isInputsDisabled ? 'disabled' : 'required'} placeholder="${
                            isInputsDisabled 
                                ? 'Editing locked — click \'Edit Score\' above to assign awards' 
                                : 'e.g. Best Keyboardist, Best Soloist, Exceptional Execution'
                        }" class="w-full px-3 py-2 ${
                            isInputsDisabled 
                                ? 'bg-slate-200/70 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-400 cursor-not-allowed placeholder-slate-400' 
                                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500'
                        } rounded-xl text-xs font-bold">
                    </div>

                    <div class="${isTeam ? 'sm:col-span-2' : 'sm:col-span-4'} flex items-end">
                        <button type="${isInputsDisabled ? 'button' : 'submit'}" id="judgeAssignAwardBtn" ${isInputsDisabled ? 'disabled' : ''} class="w-full py-2 px-3 ${
                            isInputsDisabled 
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 border border-slate-300/80 dark:border-slate-700 cursor-not-allowed shadow-none' 
                                : 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-xs transition-colors'
                        } font-black text-xs rounded-xl flex items-center justify-center gap-1.5">
                            <i class="fa-solid ${isInputsDisabled ? 'fa-lock' : 'fa-award'}"></i> ${isInputsDisabled ? 'Locked' : 'Assign'}
                        </button>
                    </div>
                </div>

                <!-- Quick suggestion pills for rapid selection -->
                <div class="flex items-center gap-1.5 flex-wrap pt-1">
                    <span class="text-[10px] font-bold ${isInputsDisabled ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}">Quick Suggestions:</span>
                    ${(isTeam ? [
                        'Best Keyboardist', 'Best Drummer', 'Best Lead Guitarist', 'Best Vocalist', 'Best Bassist', 'Outstanding Soloist', 'Crowd Favorite'
                    ] : [
                        'Best Costume', 'Outstanding Technique', 'Judges\' Choice Award', 'Best Stage Presence', 'Most Creative Concept'
                    ]).map(sug => `
                        <button type="button" class="judge-quick-sug-btn px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors ${
                            isInputsDisabled 
                                ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-400 border border-slate-300/60 dark:border-slate-700 cursor-not-allowed opacity-60 pointer-events-none' 
                                : 'bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-slate-600 dark:text-slate-300 hover:text-amber-800 dark:hover:text-amber-300 cursor-pointer'
                        }" ${isInputsDisabled ? 'disabled' : ''} data-text="${sug}">
                            + ${sug}
                        </button>
                    `).join('')}
                </div>
            </form>

            <!-- List of Currently Assigned Citations/Awards -->
            <div class="space-y-2 pt-1">
                <h5 class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Citations &amp; Awards Assigned for this Contestant</h5>
                <div id="judge-assigned-awards-container" class="space-y-2"></div>
            </div>
        </div>
    `;

    // Render list of awards
    renderJudgeAssignedAwards(contestant, isInputsDisabled);

    // Bind form submit
    document.getElementById('judgeAssignAwardForm')?.addEventListener('submit', handleAssignJudgeAward);

    // Bind unified edit trigger inside awards card if present
    container.querySelectorAll('.unified-edit-eval-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
            const topEditBtn = document.getElementById('unlockScoreEditBtn');
            if (topEditBtn) {
                topEditBtn.click();
            } else if (scoringBody) {
                scoringBody.dataset.unlocked = "true";
                renderScoringSheet();
            }
        });
    });

    // Bind quick suggestions
    document.querySelectorAll('.judge-quick-sug-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (isInputsDisabled) return;
            const titleInput = document.getElementById('judge-award-title-input');
            if (titleInput) {
                titleInput.value = btn.dataset.text;
                titleInput.focus();
            }
        });
    });
}

function renderJudgeAssignedAwards(contestant, isInputsDisabled) {
    const container = document.getElementById('judge-assigned-awards-container');
    if (!container) return;

    if (typeof isInputsDisabled === 'undefined') {
        const scoringBody = document.getElementById('judge-scoring-form-body');
        const isPeriodActive = (currentEventData?.judgingStatus === 'In Progress');
        const scoreEntry = judgeScoresMap[selectedContestantId];
        const isSubmitted = scoreEntry && scoreEntry.status === 'submitted';
        const isUnlocked = scoringBody?.dataset.unlocked === "true";
        isInputsDisabled = (!isPeriodActive || (isSubmitted && !isUnlocked));
    }

    const comments = Array.isArray(contestant.comments) ? contestant.comments : [];

    if (comments.length === 0) {
        container.innerHTML = `
            <div class="py-5 text-center text-slate-400 dark:text-slate-500 text-xs border border-dashed border-amber-200/80 dark:border-slate-700 rounded-2xl bg-white/70 dark:bg-slate-800/40">
                <i class="fa-solid fa-award text-slate-300 dark:text-slate-600 text-xl mb-1.5"></i>
                <p class="font-bold text-slate-600 dark:text-slate-300">No special awards or member citations assigned yet</p>
                <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Use the form above to recognize outstanding members on this team.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = comments.map(c => {
        const isMine = (c.judge_id && String(c.judge_id) === String(currentJudgeId)) || 
                       (c.author && String(c.author).toLowerCase() === String(currentJudgeUsername).toLowerCase()) ||
                       document.body.dataset.role === 'admin';

        return `
            <div class="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-amber-200/80 dark:border-slate-700 flex items-center justify-between gap-3 text-xs shadow-2xs hover:border-amber-300 dark:hover:border-slate-600 transition-all">
                <div class="flex items-start gap-2.5 overflow-hidden">
                    <div class="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 flex items-center justify-center font-black text-sm shrink-0 border border-amber-300 dark:border-amber-800 mt-0.5">
                        <i class="fa-solid fa-award"></i>
                    </div>
                    <div class="overflow-hidden space-y-0.5">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <h5 class="font-black text-slate-800 dark:text-slate-100 text-xs">${escapeHtml(c.award_title || c.text)}</h5>
                            ${c.member_name && c.member_name !== 'Entire Team' ? `
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 flex items-center gap-1">
                                    <i class="fa-solid fa-user text-slate-500 dark:text-slate-400"></i> ${escapeHtml(c.member_name)}
                                </span>
                            ` : (c.member_name === 'Entire Team' ? `
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 flex items-center gap-1">
                                    <i class="fa-solid fa-users text-slate-500 dark:text-slate-400"></i> Entire Team
                                </span>
                            ` : '')}
                            ${isMine ? `
                                <span class="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                    Assigned by You
                                </span>
                            ` : `
                                <span class="text-[10px] text-slate-400 dark:text-slate-400 font-medium">
                                    Assigned by ${escapeHtml(c.author || 'Judge')}
                                </span>
                            `}
                        </div>
                        ${c.comment && c.comment !== c.award_title && c.comment !== c.text ? `
                            <p class="text-[11px] text-slate-500 dark:text-slate-400 italic font-normal line-clamp-1">${escapeHtml(c.comment)}</p>
                        ` : ''}
                        <span class="text-[10px] text-slate-400 dark:text-slate-500 block">${c.created_at ? escapeHtml(c.created_at) : ''}</span>
                    </div>
                </div>
                ${isMine ? (
                    isInputsDisabled ? `
                        <span class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-400 text-[10px] font-extrabold border border-slate-200 dark:border-slate-600 flex items-center gap-1 cursor-not-allowed shrink-0 select-none" title="Unlock score above to remove this award">
                            <i class="fa-solid fa-lock text-[9px]"></i> Locked
                        </span>
                    ` : `
                        <button type="button" class="delete-judge-award-btn p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0 text-xs" 
                            data-id="${c.id}" 
                            title="Remove this award">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    `
                ) : ''}
            </div>
        `;
    }).join('');

    if (!isInputsDisabled) {
        container.querySelectorAll('.delete-judge-award-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const commentId = btn.dataset.id;
                handleDeleteJudgeAward(commentId);
            });
        });
    }
}

async function handleAssignJudgeAward(e) {
    e.preventDefault();
    const contestant = contestantsList.find(c => c.id === selectedContestantId);
    if (!contestant) return;

    const scoringBody = document.getElementById('judge-scoring-form-body');
    const isPeriodActive = (currentEventData?.judgingStatus === 'In Progress');
    const scoreEntry = judgeScoresMap[selectedContestantId];
    const isSubmitted = scoreEntry && scoreEntry.status === 'submitted';
    const isUnlocked = scoringBody?.dataset.unlocked === "true";
    const isInputsDisabled = (!isPeriodActive || (isSubmitted && !isUnlocked));

    if (isInputsDisabled) {
        showToast('Action Locked', 'Evaluation is currently locked. Modifying awards requires unlocking the evaluation as a whole.', 'warning');
        return;
    }

    const memberSelect = document.getElementById('judge-award-member-select');
    const memberInput = document.getElementById('judge-award-member-input');
    const titleInput = document.getElementById('judge-award-title-input');
    const btn = document.getElementById('judgeAssignAwardBtn');

    const memberName = (memberSelect ? memberSelect.value : memberInput?.value || '').trim();
    const awardTitle = titleInput?.value.trim() || '';

    if (!awardTitle) {
        showToast('Please enter an award or citation title.', 'warning');
        return;
    }

    if (btn) btn.disabled = true;

    const res = await addContestantComment(selectedContestantId, awardTitle, memberName, awardTitle);

    if (btn) btn.disabled = false;

    if (res.success && res.comment) {
        if (!Array.isArray(contestant.comments)) contestant.comments = [];
        contestant.comments.push(res.comment);

        showToast('Special Award Assigned!', `Assigned "${awardTitle}" ${memberName ? 'to ' + memberName : ''}.`, 'create');

        // Reset form
        if (titleInput) titleInput.value = '';
        if (memberSelect) memberSelect.value = '';
        if (memberInput) memberInput.value = '';

        // Re-render awards container & header
        renderJudgeAssignedAwards(contestant, false);
        updateHeaderAwardsDisplay(contestant);
        renderJudgeContestants();
    } else {
        showToast(res.message || 'Failed to assign award.', 'error');
    }
}

async function handleDeleteJudgeAward(commentId) {
    const contestant = contestantsList.find(c => c.id === selectedContestantId);
    if (!contestant) return;

    const scoringBody = document.getElementById('judge-scoring-form-body');
    const isPeriodActive = (currentEventData?.judgingStatus === 'In Progress');
    const scoreEntry = judgeScoresMap[selectedContestantId];
    const isSubmitted = scoreEntry && scoreEntry.status === 'submitted';
    const isUnlocked = scoringBody?.dataset.unlocked === "true";
    const isInputsDisabled = (!isPeriodActive || (isSubmitted && !isUnlocked));

    if (isInputsDisabled) {
        showToast('Action Locked', 'Evaluation is currently locked. Removing awards requires unlocking the evaluation as a whole.', 'warning');
        return;
    }

    if (!confirm('Are you sure you want to remove this special award/citation?')) return;

    const res = await deleteContestantComment(selectedContestantId, commentId);
    if (res.success) {
        contestant.comments = (contestant.comments || []).filter(c => c.id !== commentId);
        showToast('Award Removed', 'Special award citation removed.', 'archive');
        renderJudgeAssignedAwards(contestant, false);
        updateHeaderAwardsDisplay(contestant);
        renderJudgeContestants();
    } else {
        showToast(res.message || 'Failed to remove award.', 'error');
    }
}
