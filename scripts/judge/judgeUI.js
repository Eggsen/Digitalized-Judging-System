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

            contestantScoresState[c.id][cr.id] = {
                score: matchedCriteriaScore ? (parseFloat(matchedCriteriaScore.score) || 0) : 0,
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
            judgingStatusBadge.className = 'px-3 py-1 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-300';
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
        let statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">Unscored</span>';
        let scorePill = '';

        if (scoreEntry) {
            if (scoreEntry.status === 'submitted') {
                statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-700 flex items-center gap-1"><i class="fa-solid fa-circle-check"></i> Submitted</span>';
                scorePill = `<span class="text-xs font-black text-emerald-700">${parseFloat(scoreEntry.total_score).toFixed(2)}%</span>`;
            } else if (scoreEntry.status === 'draft') {
                statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-700 flex items-center gap-1"><i class="fa-solid fa-pen-ruler"></i> Draft</span>';
                scorePill = `<span class="text-xs font-bold text-amber-700">${parseFloat(scoreEntry.total_score).toFixed(2)}%</span>`;
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
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <h5 class="font-extrabold text-xs truncate ${isSelected ? 'text-white' : 'text-slate-800'}">${escapeHtml(c.name)}</h5>
                            ${c.entry_type === 'team' ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}">Team</span>` : ''}
                            ${c.comments && c.comments.length > 0 ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${isSelected ? 'bg-amber-400 text-buksu-navy' : 'bg-amber-100 text-amber-800 border border-amber-300'}"><i class="fa-solid fa-award"></i> ${c.comments.length}</span>` : ''}
                        </div>
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
        if (Array.isArray(cr.sub_criteria) && cr.sub_criteria.length > 0) {
            const allRated = cr.sub_criteria.every(sc => {
                const r = critState?.sub_scores?.[sc.id];
                return r && parseInt(r) >= 1;
            });
            if (allRated) completedCriteriaCount++;
        } else if (critState && critState.score > 0) {
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
                        ${contestant.entry_type === 'team' ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30"><i class="fa-solid fa-users-line me-1"></i> Team-Based</span>` : `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white/10 text-slate-300 border border-white/20"><i class="fa-solid fa-user me-1"></i> Individual</span>`}
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${completedCriteriaCount === criteriaList.length ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}">
                            ${completedCriteriaCount} / ${criteriaList.length} Criteria Scored
                        </span>
                    </div>
                    <h3 class="font-black text-lg sm:text-xl leading-tight mt-0.5">${escapeHtml(contestant.name)}</h3>
                    <p class="text-xs text-slate-200 mt-0.5">${escapeHtml(contestant.department_or_org || 'Independent')} ${contestant.description ? `&bull; <span class="italic text-slate-300">${escapeHtml(contestant.description)}</span>` : ''}</p>
                    ${contestant.team_members && contestant.team_members.length > 0 ? `
                        <div class="mt-1 text-xs text-indigo-200 flex items-center gap-1.5 flex-wrap">
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
                    ${totalScore.toFixed(2)}%
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
        html += `
            <div class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-3 flex-wrap">
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-circle-check text-base text-emerald-600 shrink-0"></i>
                    <span>Score for this contestant has been <strong>Submitted</strong> to the Tabulation Board.</span>
                </div>
                <button type="button" id="unlockScoreEditBtn" class="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl text-xs cursor-pointer shadow-2xs flex items-center gap-1.5 transition-colors">
                    <i class="fa-solid fa-pen"></i> Edit Score
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

    // -------------------------------------------------------------
    // CRITERIA SELECTION CARDS DECK (Bright, High-Contrast Cards)
    // -------------------------------------------------------------
    html += `
        <div class="space-y-2.5">
            <div class="flex items-center justify-between text-xs font-extrabold text-slate-500 uppercase tracking-wider px-1">
                <span class="flex items-center gap-1.5">
                    <i class="fa-solid fa-layer-group text-buksu-navy"></i> Select Criteria to Score
                </span>
                <span class="text-indigo-600 font-bold text-[11px]">Click any criteria card to open its rubric card</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3" id="criteria-cards-deck">
                ${criteriaList.map((cr) => {
                    const isActive = String(cr.id) === String(activeCriterionId);
                    const critState = contestantScores[cr.id] || { score: 0, sub_scores: {} };
                    const hasSubCriteria = Array.isArray(cr.sub_criteria) && cr.sub_criteria.length > 0;
                    
                    let ratedCount = 0;
                    let totalCount = hasSubCriteria ? cr.sub_criteria.length : 1;
                    let isComplete = false;

                    if (hasSubCriteria) {
                        ratedCount = cr.sub_criteria.filter(sc => critState.sub_scores[sc.id] && parseInt(critState.sub_scores[sc.id]) >= 1).length;
                        isComplete = (ratedCount === totalCount && totalCount > 0);
                    } else {
                        isComplete = (critState.score > 0);
                        ratedCount = isComplete ? 1 : 0;
                    }

                    const weightedScore = (critState.score / cr.max_points) * cr.percentage;

                    return `
                        <div class="criterion-deck-card p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between h-full ${
                            isActive 
                                ? 'bg-amber-50/90 border-2 border-buksu-gold shadow-md ring-2 ring-buksu-gold/30 text-slate-800' 
                                : 'bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 shadow-2xs hover:border-slate-300'
                        }" data-crit-id="${cr.id}">
                            <div class="space-y-1">
                                <div class="flex items-center justify-between gap-1.5 mb-1">
                                    <span class="px-2 py-0.5 rounded-md text-[10px] font-black ${
                                        isActive 
                                            ? 'bg-buksu-navy text-buksu-gold font-black shadow-2xs' 
                                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    }">
                                        ${cr.percentage}% Weight
                                    </span>
                                    ${isComplete ? `
                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0">
                                            <i class="fa-solid fa-circle-check text-xs text-emerald-600"></i> Completed
                                        </span>
                                    ` : `
                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1 shrink-0">
                                            <i class="fa-solid fa-circle-dot text-xs text-amber-500"></i> ${ratedCount}/${totalCount} Rated
                                        </span>
                                    `}
                                </div>
                                <h4 class="font-extrabold text-sm truncate ${isActive ? 'text-buksu-navy' : 'text-slate-800'}">
                                    ${escapeHtml(cr.title)}
                                </h4>
                                <p class="text-[11px] truncate ${isActive ? 'text-slate-600' : 'text-slate-400'}">
                                    ${escapeHtml(cr.description || 'Evaluation rubrics')}
                                </p>
                            </div>

                            <div class="mt-3 pt-2.5 border-t ${isActive ? 'border-amber-200/80' : 'border-slate-100'} flex items-center justify-between gap-2">
                                <div class="flex items-center gap-1.5 min-w-0">
                                    <span class="deck-crit-score text-sm font-black text-buksu-navy leading-none">
                                        ${critState.score > 0 ? critState.score.toFixed(1) : '0.0'}
                                    </span>
                                    <span class="text-[11px] font-bold text-slate-400 leading-none">/ ${cr.max_points} pts</span>
                                    <span class="deck-weighted-pill text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/60 leading-none">
                                        (${weightedScore.toFixed(2)}%)
                                    </span>
                                </div>
                                <span class="text-[10px] font-bold flex items-center gap-1 shrink-0 ${isActive ? 'text-amber-800 font-extrabold' : 'text-slate-400'}">
                                    ${isActive ? '<i class="fa-solid fa-eye text-amber-600"></i> Active Rubric' : 'Click to score <i class="fa-solid fa-chevron-right text-[9px]"></i>'}
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

    // Bind Level Card Clicks
    container.querySelectorAll('.gc-level-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (isInputsDisabled) return;
            const critId = btn.dataset.critId;
            const subId = btn.dataset.subId;
            const rating = parseInt(btn.dataset.rating) || 1;
            handleLevelClick(critId, subId, rating);
        });
    });

    // Bind Direct numerical input (fallback)
    container.querySelectorAll('.gc-direct-score-input').forEach(input => {
        input.addEventListener('input', () => {
            const critId = input.dataset.critId;
            const maxPts = parseFloat(input.dataset.max) || 100;
            const val = Math.min(maxPts, Math.max(0, parseFloat(input.value) || 0));

            if (!contestantScoresState[selectedContestantId]) {
                contestantScoresState[selectedContestantId] = {};
            }
            if (!contestantScoresState[selectedContestantId][critId]) {
                contestantScoresState[selectedContestantId][critId] = { score: 0, sub_scores: {} };
            }

            contestantScoresState[selectedContestantId][critId].score = val;
            updateLiveDisplays();
        });
    });

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

function renderActiveRubricCard(cr, isInputsDisabled) {
    const contestantScores = contestantScoresState[selectedContestantId] || {};
    const critState = contestantScores[cr.id] || { score: 0, sub_scores: {} };
    const hasSubCriteria = Array.isArray(cr.sub_criteria) && cr.sub_criteria.length > 0;
    const critIndex = criteriaList.findIndex(c => String(c.id) === String(cr.id));
    const weightedScore = (critState.score / cr.max_points) * cr.percentage;

    let ratedCount = 0;
    let totalCount = hasSubCriteria ? cr.sub_criteria.length : 1;
    if (hasSubCriteria) {
        ratedCount = cr.sub_criteria.filter(sc => critState.sub_scores[sc.id] && parseInt(critState.sub_scores[sc.id]) >= 1).length;
    } else {
        ratedCount = critState.score > 0 ? 1 : 0;
    }

    let cardHtml = `
        <div id="gc-active-rubric-card" class="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/90 shadow-md space-y-6 animate-fade-in relative">
            <!-- Active Card Header (High-contrast, light styling) -->
            <div class="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 flex-wrap bg-gradient-to-r from-slate-50 to-indigo-50/40 p-4 rounded-2xl border border-slate-200/80">
                <div class="space-y-1.5 max-w-xl">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-buksu-navy text-buksu-gold shadow-2xs">
                            Criterion ${critIndex + 1} of ${criteriaList.length}
                        </span>
                        <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                            ${cr.percentage}% Weight
                        </span>
                        <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-white text-slate-700 border border-slate-200">
                            Max ${cr.max_points} pts
                        </span>
                        <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold ${ratedCount === totalCount ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}">
                            ${ratedCount} of ${totalCount} Indicators Evaluated
                        </span>
                    </div>
                    <h3 class="font-black text-slate-800 text-lg sm:text-xl leading-snug">
                        ${escapeHtml(cr.title)}
                    </h3>
                    ${cr.description ? `<p class="text-xs text-slate-600 leading-relaxed font-normal">${escapeHtml(cr.description)}</p>` : ''}
                </div>

                <div class="text-right shrink-0 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
                    <span class="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Criterion Score</span>
                    <div class="inline-flex items-baseline gap-1 mt-0.5">
                        <span id="gc-crit-pts-display" class="text-2xl font-black text-buksu-navy">${critState.score > 0 ? critState.score.toFixed(1) : '0.0'}</span>
                        <span class="text-xs font-bold text-slate-400">/ ${cr.max_points} pts</span>
                    </div>
                    <span class="block text-[11px] font-black text-indigo-700 mt-0.5">
                        <span id="gc-crit-weighted-display">${weightedScore.toFixed(2)}</span>% toward final
                    </span>
                </div>
            </div>
    `;

    if (hasSubCriteria) {
        cardHtml += `
            <!-- Google Classroom Performance Indicators List -->
            <div class="space-y-5">
                ${cr.sub_criteria.map((sc, scIdx) => {
                    const currentRating = critState.sub_scores[sc.id] ? String(critState.sub_scores[sc.id]) : '';
                    const levels = sc.levels || {};
                    const selectedTier = currentRating ? TIER_CONFIG[currentRating] : null;

                    return `
                        <div class="gc-sub-criterion-block p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-3.5" data-sub-id="${sc.id}">
                            <!-- Indicator Header -->
                            <div class="flex items-center justify-between gap-3 flex-wrap">
                                <div class="space-y-0.5">
                                    <h5 class="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                                        <span class="w-6 h-6 rounded-lg bg-buksu-navy text-buksu-gold text-xs font-black flex items-center justify-center shrink-0 shadow-2xs">
                                            #${scIdx + 1}
                                        </span>
                                        ${escapeHtml(sc.name)}
                                    </h5>
                                    ${sc.description ? `<p class="text-xs text-slate-500 italic pl-8">${escapeHtml(sc.description)}</p>` : ''}
                                </div>
                                <span class="gc-rating-badge px-3 py-1 rounded-xl text-xs font-black shrink-0 ${
                                    currentRating 
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs flex items-center gap-1.5' 
                                        : 'bg-slate-200/80 text-slate-600 border border-slate-300'
                                }">
                                    ${currentRating ? `<i class="fa-solid fa-circle-check text-emerald-600"></i> ${currentRating} pts • ${selectedTier?.label || ''}` : 'Not Evaluated'}
                                </span>
                            </div>

                            <!-- Google Classroom Horizontal Rubric Level Cards (5 to 1) -->
                            <div class="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                                ${[5, 4, 3, 2, 1].map(lvl => {
                                    const isSelected = String(currentRating) === String(lvl);
                                    const tier = TIER_CONFIG[lvl];
                                    const desc = levels[lvl] || levels[String(lvl)] || tier.defaultDesc;

                                    return `
                                        <button type="button" 
                                            class="gc-level-card p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[140px] group ${
                                                isSelected 
                                                    ? 'bg-amber-50/90 border-2 border-buksu-gold ring-2 ring-buksu-gold/30 shadow-sm text-slate-800 active' 
                                                    : 'bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 text-slate-700 shadow-2xs'
                                            } ${isInputsDisabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}"
                                            data-crit-id="${cr.id}"
                                            data-sub-id="${sc.id}"
                                            data-rating="${lvl}">
                                            <div>
                                                <div class="flex items-center justify-between gap-1.5 pb-2 border-b ${isSelected ? 'border-amber-200/80' : 'border-slate-100'}">
                                                    <span class="px-2 py-0.5 rounded-md text-[11px] font-black tracking-tight ${isSelected ? 'bg-buksu-navy text-buksu-gold shadow-2xs' : 'bg-slate-100 text-slate-700'}">
                                                        ${lvl} pts
                                                    </span>
                                                    ${isSelected ? `
                                                        <span class="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] shadow-2xs">
                                                            <i class="fa-solid fa-check"></i>
                                                        </span>
                                                    ` : `
                                                        <span class="w-5 h-5 rounded-full border border-slate-300 text-transparent flex items-center justify-center text-[10px] group-hover:border-slate-400">
                                                            <i class="fa-solid fa-check text-[10px]"></i>
                                                        </span>
                                                    `}
                                                </div>
                                                <h6 class="font-extrabold text-xs uppercase tracking-tight mt-2 ${isSelected ? 'text-buksu-navy font-black' : 'text-slate-800'}">
                                                    ${tier.label}
                                                </h6>
                                                <p class="text-xs leading-relaxed mt-1.5 ${isSelected ? 'text-slate-800 font-medium' : 'text-slate-600 font-normal'}">
                                                    ${escapeHtml(desc)}
                                                </p>
                                            </div>
                                        </button>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } else {
        // Direct score entry fallback
        cardHtml += `
            <div class="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                    <h5 class="font-bold text-slate-800 text-sm">Direct Numerical Scoring</h5>
                    <p class="text-xs text-slate-500 mt-0.5">Enter score directly between 0 and ${cr.max_points} points.</p>
                </div>
                <div class="flex items-center gap-2">
                    <input type="number" 
                        class="gc-direct-score-input w-28 px-3 py-2 bg-white border border-slate-200 rounded-xl text-center font-extrabold text-slate-800 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        min="0" 
                        max="${cr.max_points}" 
                        step="0.5" 
                        placeholder="0 - ${cr.max_points}"
                        data-crit-id="${cr.id}"
                        data-max="${cr.max_points}"
                        data-pct="${cr.percentage}"
                        value="${critState.score > 0 ? critState.score : ''}"
                        ${isInputsDisabled ? 'disabled' : ''}>
                    <span class="text-xs font-bold text-slate-400">/ ${cr.max_points}</span>
                </div>
            </div>
        `;
    }

    // Navigation Controls within the Card
    const hasPrev = critIndex > 0;
    const hasNext = critIndex < criteriaList.length - 1;

    cardHtml += `
            <!-- Card Footer Navigation -->
            <div class="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                <button type="button" id="gcPrevCriterionBtn" 
                    class="px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                        hasPrev 
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer shadow-2xs' 
                            : 'bg-slate-50 text-slate-300 cursor-not-allowed pointer-events-none'
                    }">
                    <i class="fa-solid fa-arrow-left"></i> Previous Criterion
                </button>

                <span class="text-xs text-slate-400 font-semibold">
                    ${ratedCount === totalCount ? '<i class="fa-solid fa-circle-check text-emerald-600 me-1"></i> All indicators complete' : `${totalCount - ratedCount} indicators left in this criterion`}
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

function handleLevelClick(critId, subId, rating) {
    if (!selectedContestantId || !contestantScoresState[selectedContestantId]) return;

    if (!contestantScoresState[selectedContestantId][critId]) {
        contestantScoresState[selectedContestantId][critId] = { score: 0, sub_scores: {} };
    }

    const critObj = criteriaList.find(c => String(c.id) === String(critId));
    if (!critObj) return;

    // 1. Update state
    contestantScoresState[selectedContestantId][critId].sub_scores[subId] = rating;

    // 2. Recalculate normalized criterion score based on all sub-criteria ratings
    const subCriteria = critObj.sub_criteria || [];
    if (subCriteria.length > 0) {
        let sumRatings = 0;
        subCriteria.forEach(sc => {
            const r = contestantScoresState[selectedContestantId][critId].sub_scores[sc.id];
            if (r) sumRatings += parseInt(r);
        });

        const maxPossibleRating = subCriteria.length * 5;
        const normalizedScore = (sumRatings / maxPossibleRating) * critObj.max_points;
        contestantScoresState[selectedContestantId][critId].score = Math.round(normalizedScore * 100) / 100;
    }

    // 3. Re-render active rubric section cleanly without fragile DOM mutations
    renderActiveRubricSection();

    // 4. Update overall displays (total score, criterion badge, deck cards)
    updateLiveDisplays();
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
        totalDisplay.textContent = `${totalScore.toFixed(2)}%`;
    }

    // 2. Update active criterion header display
    if (activeCriterionId) {
        const activeCrit = criteriaList.find(c => String(c.id) === String(activeCriterionId));
        const critState = contestantScores[activeCriterionId] || { score: 0, sub_scores: {} };
        if (activeCrit) {
            const ptsDisplay = document.getElementById('gc-crit-pts-display');
            const weightedDisplay = document.getElementById('gc-crit-weighted-display');
            const weightedScore = (critState.score / activeCrit.max_points) * activeCrit.percentage;

            if (ptsDisplay) ptsDisplay.textContent = critState.score > 0 ? critState.score.toFixed(1) : '0.0';
            if (weightedDisplay) weightedDisplay.textContent = weightedScore.toFixed(2);
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
            if (scoreDisplay) scoreDisplay.textContent = critState.score > 0 ? critState.score.toFixed(1) : '0.0';

            const weightedPill = deckCard.querySelector('.deck-weighted-pill') || deckCard.querySelector('.text-\\[10px\\].font-extrabold');
            if (weightedPill) weightedPill.textContent = `(${weightedScore.toFixed(2)}%)`;
        }
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
        const hasSub = Array.isArray(cr.sub_criteria) && cr.sub_criteria.length > 0;

        if (hasSub) {
            const unratedSub = cr.sub_criteria.find(sc => !critState.sub_scores[sc.id] || parseInt(critState.sub_scores[sc.id]) < 1);
            if (unratedSub && !firstIncompleteCrit) {
                firstIncompleteCrit = cr;
            }
        } else if (critState.score <= 0 && !firstIncompleteCrit) {
            firstIncompleteCrit = cr;
        }

        criteriaScoresPayload.push({
            criteria_id: cr.id,
            max: cr.max_points,
            score: critState.score,
            sub_scores: critState.sub_scores || {}
        });
    }

    if (firstIncompleteCrit && action === 'submit') {
        showToast(`Please complete the scoring rubric for "${firstIncompleteCrit.title}" before submitting.`, 'warning');
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
            lockBannerHtml = `
                <div class="p-3.5 rounded-2xl bg-amber-100/90 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-3 flex-wrap shadow-2xs animate-fade-in">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm shrink-0 shadow-2xs font-bold">
                            <i class="fa-solid fa-lock"></i>
                        </div>
                        <div>
                            <p class="font-extrabold text-slate-900">Special Awards &amp; Citations Locked (Read-Only)</p>
                            <p class="text-[11px] text-amber-800 mt-0.5">Score has been submitted. Click <strong>"Edit Score"</strong> to assign new awards or modify citations.</p>
                        </div>
                    </div>
                    <button type="button" class="unlock-score-awards-btn px-3.5 py-2 bg-white border border-amber-400 hover:bg-amber-50 text-amber-950 font-black rounded-xl text-xs cursor-pointer shadow-xs flex items-center gap-1.5 transition-all hover:scale-[1.02]">
                        <i class="fa-solid fa-pen text-amber-600"></i> Edit Score to Modify
                    </button>
                </div>
            `;
        }
    }

    container.innerHTML = `
        <div id="judge-awards-card" class="p-5 sm:p-6 rounded-3xl ${
            isInputsDisabled 
                ? 'bg-slate-50/70 border-slate-200/90' 
                : 'bg-amber-50/50 border-amber-200/90'
        } border shadow-sm space-y-4 transition-all">
            <div class="flex items-start justify-between gap-3 flex-wrap border-b ${isInputsDisabled ? 'border-slate-200' : 'border-amber-200/70'} pb-3">
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-xl ${isInputsDisabled ? 'bg-slate-400' : 'bg-amber-500'} text-white flex items-center justify-center font-bold text-sm shadow-xs transition-colors">
                        <i class="fa-solid ${isInputsDisabled ? 'fa-lock' : 'fa-award'}"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <h4 class="font-black text-slate-800 text-sm">Special Awards &amp; Member Citations</h4>
                            ${isInputsDisabled ? `
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1">
                                    <i class="fa-solid fa-lock text-[9px]"></i> Read-Only (Inactive)
                                </span>
                            ` : `
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                    <i class="fa-solid fa-pen text-[9px]"></i> Editing Active
                                </span>
                            `}
                        </div>
                        <p class="text-[11px] text-slate-600">
                            ${isTeam 
                                ? 'Recognize standout individual performers within this team (e.g. "Best Keyboardist", "Best Lead Vocalist")' 
                                : 'Award exclusive special citations for this contestant (e.g. "Best Costume", "Judges\' Choice Award")'}
                        </p>
                    </div>
                </div>
                ${isTeam && members.length > 0 ? `
                    <span class="px-2.5 py-1 rounded-xl text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                        <i class="fa-solid fa-users me-1"></i> ${members.length} Team Members
                    </span>
                ` : ''}
            </div>

            ${lockBannerHtml}

            <!-- Form to Assign New Award -->
            <form id="judgeAssignAwardForm" onsubmit="return false;" class="p-4 rounded-2xl border transition-all space-y-3 ${
                isInputsDisabled 
                    ? 'bg-slate-100/80 border-slate-200/90 select-none' 
                    : 'bg-white border-amber-200/80 shadow-2xs'
            }">
                <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                    ${isTeam ? `
                    <div class="sm:col-span-5">
                        <label class="block font-bold ${isInputsDisabled ? 'text-slate-500' : 'text-slate-700'} mb-1">
                            Target Member <span class="text-slate-400 font-normal">(on this team)</span>
                        </label>
                        ${members.length > 0 ? `
                            <select id="judge-award-member-select" ${isInputsDisabled ? 'disabled' : ''} class="w-full px-3 py-2 ${
                                isInputsDisabled 
                                    ? 'bg-slate-200/70 border-slate-300 text-slate-400 cursor-not-allowed' 
                                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500'
                            } rounded-xl text-xs font-bold">
                                <option value="">-- Choose Member or Entire Team --</option>
                                <option value="Entire Team">Entire Team / Group</option>
                                ${members.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}
                            </select>
                        ` : `
                            <input type="text" id="judge-award-member-input" ${isInputsDisabled ? 'disabled' : ''} placeholder="${isInputsDisabled ? 'Editing locked' : 'e.g. Keyboardist or Member Name'}" class="w-full px-3 py-2 ${
                                isInputsDisabled 
                                    ? 'bg-slate-200/70 border-slate-300 text-slate-400 cursor-not-allowed placeholder-slate-400' 
                                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500'
                            } rounded-xl text-xs font-bold">
                        `}
                    </div>
                    ` : ''}

                    <div class="${isTeam ? 'sm:col-span-5' : 'sm:col-span-8'}">
                        <label class="block font-bold ${isInputsDisabled ? 'text-slate-500' : 'text-slate-700'} mb-1">Award / Citation Title</label>
                        <input type="text" id="judge-award-title-input" ${isInputsDisabled ? 'disabled' : 'required'} placeholder="${
                            isInputsDisabled 
                                ? 'Editing locked — click \'Edit Score\' above to assign awards' 
                                : 'e.g. Best Keyboardist, Best Soloist, Exceptional Execution'
                        }" class="w-full px-3 py-2 ${
                            isInputsDisabled 
                                ? 'bg-slate-200/70 border-slate-300 text-slate-400 cursor-not-allowed placeholder-slate-400' 
                                : 'bg-slate-50 border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500'
                        } rounded-xl text-xs font-bold">
                    </div>

                    <div class="${isTeam ? 'sm:col-span-2' : 'sm:col-span-4'} flex items-end">
                        <button type="${isInputsDisabled ? 'button' : 'submit'}" id="judgeAssignAwardBtn" ${isInputsDisabled ? 'disabled' : ''} class="w-full py-2 px-3 ${
                            isInputsDisabled 
                                ? 'bg-slate-200 text-slate-400 border border-slate-300/80 cursor-not-allowed shadow-none' 
                                : 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-xs transition-colors'
                        } font-black text-xs rounded-xl flex items-center justify-center gap-1.5">
                            <i class="fa-solid ${isInputsDisabled ? 'fa-lock' : 'fa-award'}"></i> ${isInputsDisabled ? 'Locked' : 'Assign'}
                        </button>
                    </div>
                </div>

                <!-- Quick suggestion pills for rapid selection -->
                <div class="flex items-center gap-1.5 flex-wrap pt-1">
                    <span class="text-[10px] font-bold ${isInputsDisabled ? 'text-slate-400' : 'text-slate-500'}">Quick Suggestions:</span>
                    ${(isTeam ? [
                        'Best Keyboardist', 'Best Drummer', 'Best Lead Guitarist', 'Best Vocalist', 'Best Bassist', 'Outstanding Soloist', 'Crowd Favorite'
                    ] : [
                        'Best Costume', 'Outstanding Technique', 'Judges\' Choice Award', 'Best Stage Presence', 'Most Creative Concept'
                    ]).map(sug => `
                        <button type="button" class="judge-quick-sug-btn px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors ${
                            isInputsDisabled 
                                ? 'bg-slate-200/80 text-slate-400 border border-slate-300/60 cursor-not-allowed opacity-60 pointer-events-none' 
                                : 'bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 cursor-pointer'
                        }" ${isInputsDisabled ? 'disabled' : ''} data-text="${sug}">
                            + ${sug}
                        </button>
                    `).join('')}
                </div>
            </form>

            <!-- List of Currently Assigned Citations/Awards -->
            <div class="space-y-2 pt-1">
                <h5 class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Citations &amp; Awards Assigned for this Contestant</h5>
                <div id="judge-assigned-awards-container" class="space-y-2"></div>
            </div>
        </div>
    `;

    // Render list of awards
    renderJudgeAssignedAwards(contestant, isInputsDisabled);

    // Bind form submit
    document.getElementById('judgeAssignAwardForm')?.addEventListener('submit', handleAssignJudgeAward);

    // Bind unlock button inside awards card if present
    container.querySelectorAll('.unlock-score-awards-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (scoringBody) {
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
            <div class="py-5 text-center text-slate-400 text-xs border border-dashed border-amber-200/80 rounded-2xl bg-white/70">
                <i class="fa-solid fa-award text-slate-300 text-xl mb-1.5"></i>
                <p class="font-bold text-slate-600">No special awards or member citations assigned yet</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Use the form above to recognize outstanding members on this team.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = comments.map(c => {
        const isMine = (c.judge_id && String(c.judge_id) === String(currentJudgeId)) || 
                       (c.author && String(c.author).toLowerCase() === String(currentJudgeUsername).toLowerCase()) ||
                       document.body.dataset.role === 'admin';

        return `
            <div class="p-3 rounded-2xl bg-white border border-amber-200/80 flex items-center justify-between gap-3 text-xs shadow-2xs hover:border-amber-300 transition-all">
                <div class="flex items-start gap-2.5 overflow-hidden">
                    <div class="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-sm shrink-0 border border-amber-300 mt-0.5">
                        <i class="fa-solid fa-award"></i>
                    </div>
                    <div class="overflow-hidden space-y-0.5">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <h5 class="font-black text-slate-800 text-xs">${escapeHtml(c.award_title || c.text)}</h5>
                            ${c.member_name && c.member_name !== 'Entire Team' ? `
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/80 flex items-center gap-1">
                                    <i class="fa-solid fa-user text-indigo-500"></i> ${escapeHtml(c.member_name)}
                                </span>
                            ` : (c.member_name === 'Entire Team' ? `
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                                    <i class="fa-solid fa-users text-slate-500"></i> Entire Team
                                </span>
                            ` : '')}
                            ${isMine ? `
                                <span class="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                    Assigned by You
                                </span>
                            ` : `
                                <span class="text-[10px] text-slate-400 font-medium">
                                    Assigned by ${escapeHtml(c.author || 'Judge')}
                                </span>
                            `}
                        </div>
                        ${c.comment && c.comment !== c.award_title && c.comment !== c.text ? `
                            <p class="text-[11px] text-slate-500 italic font-normal line-clamp-1">${escapeHtml(c.comment)}</p>
                        ` : ''}
                        <span class="text-[10px] text-slate-400 block">${c.created_at ? escapeHtml(c.created_at) : ''}</span>
                    </div>
                </div>
                ${isMine ? (
                    isInputsDisabled ? `
                        <span class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 text-[10px] font-extrabold border border-slate-200 flex items-center gap-1 cursor-not-allowed shrink-0 select-none" title="Unlock score above to remove this award">
                            <i class="fa-solid fa-lock text-[9px]"></i> Locked
                        </span>
                    ` : `
                        <button type="button" class="delete-judge-award-btn p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer shrink-0 text-xs" 
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
        showToast('Action Locked', 'Special awards and citations are locked while not editing. Click "Edit Score" first.', 'warning');
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
        showToast('Action Locked', 'Special awards are locked while viewing submitted score. Click "Edit Score" first.', 'warning');
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
