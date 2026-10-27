import { 
    getContestants, 
    createContestant, 
    editContestant, 
    deleteContestant,
    addContestantComment,
    deleteContestantComment,
    updateTeamMembers,
    getCriteria, 
    createCriterion, 
    editCriterion, 
    updateCriteriaWeights, 
    deleteCriterion 
} from "/scripts/admin/judgingAPI.js";
import { showToast } from "/scripts/utils/uiUtils.js";

let currentEventId = null;
let currentEventName = '';
let cachedCriteria = [];
let cachedContestants = [];

export function initContestantsCriteriaUI() {
    const modal = document.getElementById('manage-event-setup-modal');
    if (!modal) return;

    // Tab buttons inside setup modal
    document.querySelectorAll('.setup-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchSetupTab(tabName);
        });
    });

    // Form: Create Contestant
    document.getElementById('createContestantForm')?.addEventListener('submit', handleAddContestant);

    // Entry type radio toggle for contestant form
    document.querySelectorAll('input[name="contestant_entry_type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const isTeam = e.target.value === 'team';
            const teamMembersGroup = document.getElementById('new-contestant-team-members-group');
            const nameLabel = document.getElementById('new-contestant-name-label');
            const nameInput = document.getElementById('new-contestant-name');

            if (isTeam) {
                teamMembersGroup?.classList.remove('hidden');
                if (nameLabel) nameLabel.textContent = 'Team / Group Name';
                if (nameInput) nameInput.placeholder = 'e.g. The Velocity Band or Team Alpha';
            } else {
                teamMembersGroup?.classList.add('hidden');
                if (nameLabel) nameLabel.textContent = 'Full Name / Entry Title';
                if (nameInput) nameInput.placeholder = 'e.g. John Doe';
            }
        });
    });

    // Contestant Citations & Comments modal handlers
    document.getElementById('addContestantCommentForm')?.addEventListener('submit', handleAddCitation);
    document.getElementById('saveContestantMembersBtn')?.addEventListener('click', handleSaveTeamMembers);

    // Form: Create Criterion
    document.getElementById('createCriterionForm')?.addEventListener('submit', handleAddCriterion);

    // Quick Add: Scoring Choice Radio Toggle (Manual, Rubric-Based, Category-Based)
    document.querySelectorAll('input[name="quick_scoring_type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            const rangeFields = document.getElementById('quick-manual-range-fields');
            const rubricBox = document.getElementById('quick-rubric-info-box');
            const categoryBox = document.getElementById('quick-category-info-box');
            const manualCard = document.getElementById('quick-scoring-manual-card');
            const rubricCard = document.getElementById('quick-scoring-rubric-card');
            const categoryCard = document.getElementById('quick-scoring-category-card');
            const maxLabel = document.getElementById('new-criterion-max-label');

            if (val === 'manual') {
                rangeFields?.classList.remove('hidden');
                rubricBox?.classList.add('hidden');
                categoryBox?.classList.add('hidden');
                manualCard?.classList.add('border-indigo-500', 'bg-indigo-50/40');
                rubricCard?.classList.remove('border-amber-500', 'bg-amber-50/40');
                categoryCard?.classList.remove('border-purple-500', 'bg-purple-50/40');
                if (maxLabel) maxLabel.textContent = 'Max Score (pts)';
            } else if (val === 'rubric') {
                rangeFields?.classList.add('hidden');
                rubricBox?.classList.remove('hidden');
                categoryBox?.classList.add('hidden');
                rubricCard?.classList.add('border-amber-500', 'bg-amber-50/40');
                manualCard?.classList.remove('border-indigo-500', 'bg-indigo-50/40');
                categoryCard?.classList.remove('border-purple-500', 'bg-purple-50/40');
                if (maxLabel) maxLabel.textContent = 'Top Rating Score (pts)';
            } else {
                // Category-Based
                rangeFields?.classList.add('hidden');
                rubricBox?.classList.add('hidden');
                categoryBox?.classList.remove('hidden');
                categoryCard?.classList.add('border-purple-500', 'bg-purple-50/40');
                manualCard?.classList.remove('border-indigo-500', 'bg-indigo-50/40');
                rubricCard?.classList.remove('border-amber-500', 'bg-amber-50/40');
                if (maxLabel) maxLabel.textContent = 'Total Category Points (pts)';
            }
        });
    });

    // Open Weights Modal
    document.getElementById('openConfigureWeightsBtn')?.addEventListener('click', openAdjustWeightsModal);

    // Open Rubric / Scoring Builder for New Criterion
    document.getElementById('openNewCriterionRubricBtn')?.addEventListener('click', () => openCriterionRubricModal());
    document.getElementById('openCustomRubricBuilderBtn')?.addEventListener('click', () => openCriterionRubricModal());

    // Form: Configure Weights Modal
    document.getElementById('saveWeightsBtn')?.addEventListener('click', handleSaveWeights);

    // Modal: Scoring Method Radio Toggle (Manual vs Rubric-Based vs Category-Based)
    document.querySelectorAll('input[name="modal_scoring_type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            setModalScoringType(e.target.value);
        });
    });

    // Modal: Manual Range Inputs Live Summary
    const updateManualRangeSummary = () => {
        const minVal = parseFloat(document.getElementById('rubric-modal-min-input')?.value) || 0;
        const maxVal = parseFloat(document.getElementById('rubric-modal-max-input')?.value) || 100;
        const badge = document.getElementById('manual-range-summary-badge');
        if (badge) {
            badge.textContent = `Allowed Range: ${minVal} - ${maxVal} pts`;
        }
    };
    document.getElementById('rubric-modal-min-input')?.addEventListener('input', updateManualRangeSummary);
    document.getElementById('rubric-modal-max-input')?.addEventListener('input', updateManualRangeSummary);

    // Modal: Rubric Rating Buttons
    document.getElementById('rubricAddRatingBtn')?.addEventListener('click', () => addRatingRow());
    document.getElementById('rubricLoad4TierPresetBtn')?.addEventListener('click', load4TierPreset);
    document.getElementById('rubricLoad5TierPresetBtn')?.addEventListener('click', load5TierPreset);

    // Modal: Category-Based Buttons
    document.getElementById('categoryAddRowBtn')?.addEventListener('click', () => addCategoryRow());
    document.getElementById('categoryLoadStylePresetBtn')?.addEventListener('click', loadStyleCategoryPreset);
    document.getElementById('categoryLoad4TierPresetBtn')?.addEventListener('click', load4CategoryPreset);

    // Form: Save Criterion & Scoring Setup
    document.getElementById('criterionRubricForm')?.addEventListener('submit', handleSaveRubricCriterion);

    // Live validation: Quick Add Weight input (cannot exceed remaining to 100%)
    document.getElementById('new-criterion-pct')?.addEventListener('input', (e) => {
        const input = e.target;
        const entered = parseInt(input.value) || 0;
        const currentTotal = cachedCriteria.reduce((sum, c) => sum + (parseInt(c.percentage) || 0), 0);
        const remaining = Math.max(0, 100 - currentTotal);
        if (entered > remaining) {
            showToast('Weight Limit Exceeded', `Total criteria weight cannot exceed 100%! Only ${remaining}% is available.`, 'warning');
            input.value = remaining;
        }
    });

    // Live validation: Rubric Modal Weight input (cannot exceed remaining to 100%)
    document.getElementById('rubric-modal-pct-input')?.addEventListener('input', (e) => {
        const input = e.target;
        const entered = parseInt(input.value) || 0;
        const critId = document.getElementById('rubric-modal-crit-id')?.value;
        let otherTotal = 0;
        if (critId) {
            otherTotal = cachedCriteria.filter(c => String(c.id) !== String(critId)).reduce((sum, c) => sum + (parseInt(c.percentage) || 0), 0);
        } else {
            otherTotal = cachedCriteria.reduce((sum, c) => sum + (parseInt(c.percentage) || 0), 0);
        }
        const maxAllowed = Math.max(0, 100 - otherTotal);
        if (entered > maxAllowed) {
            showToast('Weight Limit Exceeded', `Total criteria weight cannot exceed 100%! Only ${maxAllowed}% is available for this criterion.`, 'warning');
            input.value = maxAllowed;
        }
    });

    // Close button for child modals: close ONLY that child modal
    document.querySelectorAll('#adjust-weights-modal .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('adjust-weights-modal')?.classList.add('hidden');
        });
    });

    document.querySelectorAll('#criterion-rubric-modal .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('criterion-rubric-modal')?.classList.add('hidden');
        });
    });

    document.querySelectorAll('#contestant-comments-modal .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('contestant-comments-modal')?.classList.add('hidden');
        });
    });

    // Close button for main manage setup modal: closes setup modal and child modals
    document.querySelectorAll('#manage-event-setup-modal .close-modal-btn').forEach(btn => {
        if (btn.closest('#adjust-weights-modal') || btn.closest('#criterion-rubric-modal') || btn.closest('#contestant-comments-modal')) {
            return;
        }
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            modal.classList.add('hidden');
            document.getElementById('adjust-weights-modal')?.classList.add('hidden');
            document.getElementById('criterion-rubric-modal')?.classList.add('hidden');
            document.getElementById('contestant-comments-modal')?.classList.add('hidden');
        });
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    const weightsModal = document.getElementById('adjust-weights-modal');
    weightsModal?.addEventListener('click', (e) => {
        if (e.target === weightsModal) weightsModal.classList.add('hidden');
    });

    const rubricModal = document.getElementById('criterion-rubric-modal');
    rubricModal?.addEventListener('click', (e) => {
        if (e.target === rubricModal) rubricModal.classList.add('hidden');
    });

    const commentsModal = document.getElementById('contestant-comments-modal');
    commentsModal?.addEventListener('click', (e) => {
        if (e.target === commentsModal) commentsModal.classList.add('hidden');
    });
}

export function updateWeightsModalState(triggerWarningToast = false) {
    const inputs = document.querySelectorAll('.weight-adjust-input');
    const badge = document.getElementById('weights-modal-total-badge');
    const bar = document.getElementById('weights-modal-total-bar');
    const warningAlert = document.getElementById('weights-modal-warning-alert');
    const warningText = document.getElementById('weights-modal-warning-text');
    const saveBtn = document.getElementById('saveWeightsBtn');

    let total = 0;
    inputs.forEach(input => {
        let val = parseInt(input.value);
        if (isNaN(val) || val < 0) {
            val = 0;
        }
        total += val;
    });

    if (badge) {
        if (total > 100) {
            badge.textContent = `${total}% / 100% (Exceeds by ${total - 100}%)`;
            badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse';
        } else if (total === 100) {
            badge.textContent = `100% / 100% (Balanced)`;
            badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300';
        } else {
            badge.textContent = `${total}% / 100% (${100 - total}% remaining)`;
            badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300';
        }
    }

    if (bar) {
        bar.style.width = `${Math.min(total, 100)}%`;
        if (total > 100) {
            bar.className = 'h-full bg-rose-500 rounded-full transition-all duration-300';
        } else if (total === 100) {
            bar.className = 'h-full bg-emerald-500 rounded-full transition-all duration-300';
        } else {
            bar.className = 'h-full bg-amber-500 rounded-full transition-all duration-300';
        }
    }

    if (total > 100) {
        if (warningAlert) warningAlert.classList.remove('hidden');
        if (warningText) {
            warningText.textContent = `Total weight cannot exceed 100%! Current total is ${total}% (exceeds limit by ${total - 100}%). Please decrease one or more criteria weights.`;
        }
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
            saveBtn.title = 'Cannot save: Total weight exceeds 100%';
        }
        if (triggerWarningToast) {
            showToast('Weight Limit Exceeded', `Total criteria weight is ${total}%, exceeding 100% by ${total - 100}%.`, 'warning');
        }
    } else {
        if (warningAlert) warningAlert.classList.add('hidden');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            saveBtn.title = '';
        }
    }

    return total;
}

export function openAdjustWeightsModal() {
    const weightsModal = document.getElementById('adjust-weights-modal');
    const container = document.getElementById('weights-adjust-container');
    if (!weightsModal || !container) return;

    if (cachedCriteria.length === 0) {
        showToast('Please add at least one criterion before configuring weights.', 'warning');
        return;
    }

    container.innerHTML = cachedCriteria.map(cr => `
        <div class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div class="overflow-hidden">
                <h5 class="font-extrabold text-xs text-slate-800 truncate">${escapeHtml(cr.title)}</h5>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
                <input type="number" 
                    class="weight-adjust-input w-20 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-extrabold text-xs text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min="0" max="100" 
                    value="${cr.percentage}"
                    data-id="${cr.id}">
                <span class="text-xs font-bold text-slate-500">%</span>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.weight-adjust-input').forEach(input => {
        input.addEventListener('input', () => {
            updateWeightsModalState(true);
        });
    });

    updateWeightsModalState(false);
    weightsModal.classList.remove('hidden');
}

export async function openManageSetupModal(eventId, eventName) {
    const modal = document.getElementById('manage-event-setup-modal');
    if (!modal) return;

    currentEventId = parseInt(eventId);
    currentEventName = eventName || `Competition #${eventId}`;

    document.getElementById('setup-modal-event-title').textContent = currentEventName;
    document.getElementById('setup-modal-event-id-badge').textContent = `Event #${currentEventId}`;

    modal.classList.remove('hidden');

    // Default to contestants tab
    switchSetupTab('setup-contestants-tab');

    // Load both datasets
    await Promise.all([
        loadContestantsList(),
        loadCriteriaList()
    ]);
}

function switchSetupTab(tabId) {
    document.querySelectorAll('.setup-tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabId) {
            btn.className = 'setup-tab-btn px-4 py-2 text-xs font-bold rounded-xl bg-buksu-navy text-white shadow-xs transition-all cursor-pointer';
        } else {
            btn.className = 'setup-tab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-100 hover:text-buksu-navy transition-all cursor-pointer';
        }
    });

    document.querySelectorAll('.setup-tab-content').forEach(content => {
        content.classList.add('hidden');
    });

    const activeContent = document.getElementById(tabId);
    if (activeContent) activeContent.classList.remove('hidden');
}

/* -------------------------------------------------------------
 * CONTESTANTS LOGIC
 * ------------------------------------------------------------- */
async function loadContestantsList() {
    const container = document.getElementById('setup-contestants-list');
    if (!container || !currentEventId) return;

    container.innerHTML = `<div class="py-6 text-center text-slate-400 text-xs"><i class="fa-solid fa-spinner fa-spin me-1.5"></i> Loading contestants...</div>`;

    const res = await getContestants(currentEventId);
    if (!res.success || !res.contestants) {
        container.innerHTML = `<div class="py-6 text-center text-rose-500 text-xs">${res.message || 'Failed to load contestants.'}</div>`;
        return;
    }

    cachedContestants = res.contestants;

    // Suggest next contestant number in add form
    const nextNum = cachedContestants.length > 0 
        ? Math.max(...cachedContestants.map(c => c.contestant_number)) + 1 
        : 1;
    const numInput = document.getElementById('new-contestant-num');
    if (numInput) numInput.value = nextNum;

    if (cachedContestants.length === 0) {
        container.innerHTML = `
            <div class="py-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                <i class="fa-solid fa-users text-2xl text-slate-300 mb-2"></i>
                <p class="text-xs font-bold text-slate-600">No contestants registered yet</p>
                <p class="text-[11px] text-slate-400 mt-1">Use the form to register Contestant #1.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = cachedContestants.map(c => {
        const isTeam = c.entry_type === 'team';
        const members = Array.isArray(c.team_members) ? c.team_members : [];
        const comments = Array.isArray(c.comments) ? c.comments : [];

        return `
        <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-3 hover:bg-white hover:border-slate-300 transition-all">
            <div class="flex items-start gap-3 overflow-hidden">
                <div class="w-10 h-10 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center font-extrabold text-sm shrink-0 border border-buksu-gold/30 shadow-xs mt-0.5">
                    #${c.contestant_number}
                </div>
                <div class="overflow-hidden space-y-1 flex-1 min-w-[180px]">
                    <div class="flex items-center gap-2 flex-wrap">
                        <h5 class="font-extrabold text-slate-800 text-sm leading-tight">${escapeHtml(c.name)}</h5>
                        ${isTeam 
                            ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0"><i class="fa-solid fa-users-line me-1"></i> Team</span>` 
                            : `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/80 shrink-0"><i class="fa-solid fa-user me-1"></i> Individual</span>`
                        }
                        ${comments.length > 0 
                            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 inline-flex items-center gap-1 shrink-0"><i class="fa-solid fa-award text-amber-500"></i> ${comments.length} Citation${comments.length > 1 ? 's' : ''}</span>` 
                            : ''
                        }
                    </div>
                    <p class="text-xs text-slate-500 font-medium">${escapeHtml(c.department_or_org || 'Independent / General')}</p>
                    ${isTeam && members.length > 0 ? `
                        <p class="text-[11px] text-indigo-900/90 font-medium flex items-center gap-1 line-clamp-1">
                            <i class="fa-solid fa-people-group text-indigo-500"></i> Members: ${escapeHtml(members.join(', '))}
                        </p>
                    ` : ''}
                    ${c.description ? `<p class="text-[11px] text-slate-400 line-clamp-2 italic leading-relaxed">${escapeHtml(c.description)}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button class="contestant-citations-btn p-2 rounded-xl text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer text-xs" 
                    data-id="${c.id}" 
                    title="Citations & Member Comments">
                    <i class="fa-solid fa-award"></i>
                </button>
                <button class="edit-contestant-btn p-2 rounded-xl text-slate-500 hover:text-buksu-navy hover:bg-slate-100 transition-colors cursor-pointer text-xs" 
                    data-id="${c.id}" 
                    data-num="${c.contestant_number}" 
                    data-name="${escapeHtml(c.name)}" 
                    data-dept="${escapeHtml(c.department_or_org)}" 
                    data-desc="${escapeHtml(c.description)}"
                    data-type="${c.entry_type || 'individual'}"
                    title="Edit Contestant">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="delete-contestant-btn p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer text-xs" 
                    data-id="${c.id}" 
                    data-num="${c.contestant_number}" 
                    data-name="${escapeHtml(c.name)}"
                    title="Remove Contestant">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');

    bindContestantRowActions();
}

function bindContestantRowActions() {
    // Citations & Comments button
    document.querySelectorAll('.contestant-citations-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            openContestantCommentsModal(id);
        });
    });

    // Edit contestant
    document.querySelectorAll('.edit-contestant-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const currentNum = btn.dataset.num;
            const currentName = btn.dataset.name;
            const currentDept = btn.dataset.dept;
            const currentDesc = btn.dataset.desc;

            const newNum = prompt(`Edit Contestant Number for "${currentName}":`, currentNum);
            if (newNum === null) return;
            const newName = prompt(`Edit Contestant Name:`, currentName);
            if (newName === null || !newName.trim()) return;
            const newDept = prompt(`Edit Department / Organization:`, currentDept);
            if (newDept === null) return;
            const newDesc = prompt(`Edit Description / Entry details:`, currentDesc);
            if (newDesc === null) return;

            (async () => {
                const res = await editContestant({
                    id,
                    contestant_number: parseInt(newNum) || currentNum,
                    name: newName.trim(),
                    department_or_org: newDept.trim(),
                    description: newDesc.trim()
                });

                if (res.success) {
                    showToast('Contestant Updated!', 'Contestant details updated successfully.', 'edit');
                    document.getElementById('manage-event-setup-modal')?.classList.add('hidden');
                    document.getElementById('refreshEventsBtn')?.click();
                } else {
                    showToast(res.message || 'Failed to update contestant.', 'error');
                }
            })();
        });
    });

    // Delete contestant
    document.querySelectorAll('.delete-contestant-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const num = btn.dataset.num;
            const name = btn.dataset.name;

            if (confirm(`Are you sure you want to remove Contestant #${num} "${name}"? Any related scores will also be deleted.`)) {
                const res = await deleteContestant(id);
                if (res.success) {
                    showToast('Contestant Removed!', 'Contestant record removed successfully.', 'archive');
                    document.getElementById('manage-event-setup-modal')?.classList.add('hidden');
                    document.getElementById('refreshEventsBtn')?.click();
                } else {
                    showToast(res.message || 'Failed to delete contestant.', 'error');
                }
            }
        });
    });
}

async function handleAddContestant(e) {
    e.preventDefault();
    if (!currentEventId) return;

    const numInput = document.getElementById('new-contestant-num');
    const nameInput = document.getElementById('new-contestant-name');
    const deptInput = document.getElementById('new-contestant-dept');
    const descInput = document.getElementById('new-contestant-desc');
    const membersInput = document.getElementById('new-contestant-members');
    const commentInput = document.getElementById('new-contestant-comment');
    const entryTypeRadio = document.querySelector('input[name="contestant_entry_type"]:checked');
    const btn = document.getElementById('addContestantBtn');

    const contestantNumber = parseInt(numInput?.value);
    const name = nameInput?.value.trim();
    const departmentOrOrg = deptInput?.value.trim();
    const description = descInput?.value.trim();
    const entryType = entryTypeRadio?.value || 'individual';
    const teamMembers = membersInput?.value.trim();
    const initialComment = commentInput?.value.trim();

    if (!contestantNumber || !name) {
        showToast('Please provide a contestant number and name.', 'warning');
        return;
    }

    if (btn) btn.disabled = true;

    const res = await createContestant({
        event_id: currentEventId,
        contestant_number: contestantNumber,
        name,
        department_or_org: departmentOrOrg,
        description,
        entry_type: entryType,
        team_members: teamMembers,
        initial_comment: initialComment
    });

    if (btn) btn.disabled = false;

    if (res.success) {
        showToast('Contestant Added!', res.message || `Contestant #${contestantNumber} registered successfully.`, 'create');
        if (nameInput) nameInput.value = '';
        if (deptInput) deptInput.value = '';
        if (descInput) descInput.value = '';
        if (membersInput) membersInput.value = '';
        if (commentInput) commentInput.value = '';
        
        // Modal must NOT disappear when adding contestants as requested!
        // Instead, reload the contestants list dynamically and pre-fill next number
        await loadContestantsList();
        document.getElementById('refreshEventsBtn')?.click();
    } else {
        showToast(res.message || 'Failed to add contestant.', 'error');
    }
}

function openContestantCommentsModal(contestantId) {
    const modal = document.getElementById('contestant-comments-modal');
    if (!modal) return;

    const contestant = cachedContestants.find(c => c.id === contestantId);
    if (!contestant) return;

    document.getElementById('contestant-comments-modal-id').value = contestantId;
    document.getElementById('contestant-comments-modal-title').textContent = 
        `Citations & Comments: #${contestant.contestant_number} ${contestant.name}`;
    document.getElementById('contestant-comments-modal-sub').textContent = 
        `${contestant.entry_type === 'team' ? 'Team-based Entry' : 'Individual Contestant'} • ${contestant.department_or_org || 'General'}`;

    const teamSection = document.getElementById('contestant-modal-team-section');
    const membersInput = document.getElementById('contestant-modal-members-input');
    if (contestant.entry_type === 'team') {
        teamSection?.classList.remove('hidden');
        if (membersInput) {
            membersInput.value = (contestant.team_members || []).join('\n');
        }
    } else {
        teamSection?.classList.add('hidden');
    }

    renderModalCommentsList(contestant);
    modal.classList.remove('hidden');
}

function renderModalCommentsList(contestant) {
    const container = document.getElementById('contestant-comments-list');
    if (!container) return;

    const comments = Array.isArray(contestant.comments) ? contestant.comments : [];

    if (comments.length === 0) {
        container.innerHTML = `
            <div class="py-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                <i class="fa-solid fa-award text-slate-300 text-lg mb-1"></i>
                <p>No special citations or member notes added yet.</p>
                <p class="text-[10px] text-slate-400 mt-0.5">Use the input above to add one (e.g. "Best Keyboardist - Jane Doe").</p>
            </div>
        `;
        return;
    }

    container.innerHTML = comments.map(c => `
        <div class="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 flex items-center justify-between gap-2.5 text-xs">
            <div class="flex items-start gap-2 overflow-hidden">
                <i class="fa-solid fa-award text-amber-600 mt-0.5 shrink-0"></i>
                <div class="overflow-hidden">
                    <p class="font-bold text-slate-800 break-words">${escapeHtml(c.text)}</p>
                    <span class="text-[10px] text-slate-400 font-medium">Added by ${escapeHtml(c.author || 'Admin')} ${c.created_at ? '• ' + escapeHtml(c.created_at) : ''}</span>
                </div>
            </div>
            <button type="button" class="delete-citation-btn p-1.5 rounded-lg text-rose-500 hover:bg-rose-100 transition-colors cursor-pointer shrink-0 text-xs" 
                data-contestant-id="${contestant.id}" 
                data-comment-id="${c.id}" 
                title="Remove Citation">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `).join('');

    container.querySelectorAll('.delete-citation-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const cId = btn.dataset.contestantId;
            const commentId = btn.dataset.commentId;
            const res = await deleteContestantComment(cId, commentId);
            if (res.success) {
                showToast('Citation Removed', 'Special citation / note removed successfully.', 'archive');
                await loadContestantsList();
                const updated = cachedContestants.find(c => c.id === cId);
                if (updated) renderModalCommentsList(updated);
            } else {
                showToast(res.message || 'Failed to remove citation.', 'error');
            }
        });
    });
}

async function handleAddCitation(e) {
    e.preventDefault();
    const contestantId = document.getElementById('contestant-comments-modal-id')?.value;
    const textInput = document.getElementById('new-citation-text');
    const text = textInput?.value.trim();

    if (!contestantId || !text) {
        showToast('Please enter citation or comment text.', 'warning');
        return;
    }

    const btn = document.getElementById('addCitationBtn');
    if (btn) btn.disabled = true;

    const res = await addContestantComment(contestantId, text);
    if (btn) btn.disabled = false;

    if (res.success) {
        showToast('Citation Added!', 'Special citation recorded successfully.', 'create');
        if (textInput) textInput.value = '';
        await loadContestantsList();
        const updated = cachedContestants.find(c => c.id === contestantId);
        if (updated) renderModalCommentsList(updated);
    } else {
        showToast(res.message || 'Failed to add citation.', 'error');
    }
}

async function handleSaveTeamMembers() {
    const contestantId = document.getElementById('contestant-comments-modal-id')?.value;
    const membersInput = document.getElementById('contestant-modal-members-input');
    const members = membersInput?.value || '';

    if (!contestantId) return;

    const res = await updateTeamMembers(contestantId, members);
    if (res.success) {
        showToast('Team Members Updated!', 'Team member roster saved.', 'edit');
        await loadContestantsList();
    } else {
        showToast(res.message || 'Failed to update members.', 'error');
    }
}

/* -------------------------------------------------------------
 * CRITERIA & WEIGHTS LOGIC
 * ------------------------------------------------------------- */
async function loadCriteriaList() {
    const container = document.getElementById('setup-criteria-list');
    const weightBar = document.getElementById('setup-criteria-weight-bar');
    const weightBadge = document.getElementById('setup-criteria-weight-badge');
    if (!container || !currentEventId) return;

    container.innerHTML = `<div class="py-6 text-center text-slate-400 text-xs"><i class="fa-solid fa-spinner fa-spin me-1.5"></i> Loading criteria...</div>`;

    const res = await getCriteria(currentEventId);
    if (!res.success || !res.criteria) {
        container.innerHTML = `<div class="py-6 text-center text-rose-500 text-xs">${res.message || 'Failed to load criteria.'}</div>`;
        return;
    }

    cachedCriteria = res.criteria;
    const totalWeight = res.total_weight || 0;
    const remainingWeight = Math.max(0, 100 - totalWeight);

    // Update weight indicator
    if (weightBadge) {
        if (totalWeight === 100) {
            weightBadge.textContent = '100% / 100% (Balanced)';
            weightBadge.className = 'px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300';
        } else if (totalWeight > 100) {
            weightBadge.textContent = `${totalWeight}% / 100% (Exceeds by ${totalWeight - 100}%)`;
            weightBadge.className = 'px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse';
        } else {
            weightBadge.textContent = `${totalWeight}% / 100% (${remainingWeight}% available)`;
            weightBadge.className = 'px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300';
        }
    }

    if (weightBar) {
        weightBar.style.width = `${Math.min(totalWeight, 100)}%`;
        weightBar.className = `h-full rounded-full transition-all duration-300 ${totalWeight === 100 ? 'bg-emerald-500' : totalWeight > 100 ? 'bg-rose-500' : 'bg-amber-500'}`;
    }

    // Update Quick Add form hint and max attribute
    const quickAddPctInput = document.getElementById('new-criterion-pct');
    const quickAddHint = document.getElementById('new-criterion-weight-hint');
    if (quickAddPctInput) {
        quickAddPctInput.max = remainingWeight;
        quickAddPctInput.placeholder = remainingWeight > 0 ? `Max ${remainingWeight}%` : '0% left';
    }
    if (quickAddHint) {
        if (remainingWeight > 0) {
            quickAddHint.textContent = `${remainingWeight}% available`;
            quickAddHint.className = 'text-[10px] font-bold text-emerald-600';
        } else {
            quickAddHint.textContent = `0% available (100% reached)`;
            quickAddHint.className = 'text-[10px] font-bold text-rose-500';
        }
    }

    if (cachedCriteria.length === 0) {
        container.innerHTML = `
            <div class="py-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                <i class="fa-solid fa-list-check text-2xl text-slate-300 mb-2"></i>
                <p class="text-xs font-bold text-slate-600">No judging criteria configured</p>
                <p class="text-[11px] text-slate-400 mt-1">Add criteria below to establish judging guidelines.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = cachedCriteria.map(cr => {
        const isCategory = (cr.scoring_type === 'category');
        const isRubric = (cr.scoring_type === 'rubric');
        const rubricRatings = Array.isArray(cr.rubric_ratings) && cr.rubric_ratings.length > 0 
            ? cr.rubric_ratings 
            : (isRubric ? getDefaultRubricRatings(cr.max_points) : []);
        const categories = (Array.isArray(cr.scoring_categories) && cr.scoring_categories.length > 0)
            ? cr.scoring_categories
            : (isCategory ? getDefaultScoringCategories(cr.max_points) : []);
        const minPts = typeof cr.min_points !== 'undefined' ? parseFloat(cr.min_points) : 0;

        return `
        <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:border-slate-300 transition-all space-y-3">
            <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="w-12 h-10 rounded-xl bg-buksu-navy text-buksu-gold flex flex-col items-center justify-center font-black text-xs shrink-0 shadow-xs border border-buksu-gold/30">
                        <span>${cr.percentage}%</span>
                        <span class="text-[8px] font-bold text-slate-200 uppercase">weight</span>
                    </div>
                    <div class="overflow-hidden space-y-1 flex-1 min-w-[200px]">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h5 class="font-extrabold text-slate-800 text-sm leading-tight">${escapeHtml(cr.title)}</h5>
                            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200/70 text-slate-700 shrink-0">Max: ${cr.max_points} pts</span>
                            ${isCategory
                                ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-50 text-purple-800 border border-purple-200 shrink-0 flex items-center gap-1"><i class="fa-solid fa-layer-group"></i> Category-Based (${categories.length} Categories, ${cr.max_points} pts total)</span>`
                                : isRubric 
                                    ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 shrink-0 flex items-center gap-1"><i class="fa-solid fa-list-check"></i> Rubric-Based (${rubricRatings.length} Ratings)</span>` 
                                    : `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 flex items-center gap-1"><i class="fa-solid fa-calculator"></i> Manual Scoring (${minPts} — ${cr.max_points} pts)</span>`}
                        </div>
                        ${cr.description ? `<p class="text-xs text-slate-500 font-normal leading-relaxed line-clamp-2">${escapeHtml(cr.description)}</p>` : ''}
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" class="toggle-rubric-view-btn px-2.5 py-1.5 rounded-xl bg-slate-200/70 hover:bg-slate-300 text-slate-700 font-bold text-[11px] cursor-pointer transition-colors flex items-center gap-1" data-id="${cr.id}">
                        <i class="fa-solid fa-eye text-xs"></i> <span>View Details</span>
                    </button>
                    <button class="edit-criterion-btn px-2.5 py-1.5 rounded-xl bg-slate-200/70 hover:bg-buksu-navy hover:text-buksu-gold text-slate-700 font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1" 
                        data-id="${cr.id}" 
                        title="Edit Criterion & Scoring Setup">
                        <i class="fa-solid fa-pen text-xs"></i> <span>Edit</span>
                    </button>
                    <button class="delete-criterion-btn p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer text-xs" 
                        data-id="${cr.id}" 
                        data-title="${escapeHtml(cr.title)}"
                        title="Delete Criterion">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>

            <!-- Collapsible Scoring Details Preview -->
            <div id="rubric-preview-${cr.id}" class="hidden pt-3 border-t border-slate-200/70 space-y-2.5 text-xs">
                ${isCategory ? `
                    <div class="flex items-center justify-between text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                        <span>Score Categories (${categories.length} Categories &bull; Total ${cr.max_points} pts)</span>
                        <span class="text-purple-700 font-bold normal-case">Each sub-category scored up to its configured max score</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${Math.min(categories.length, 4)} gap-2">
                        ${categories.map(cat => `
                            <div class="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1 shadow-2xs">
                                <div class="flex items-center justify-between gap-1">
                                    <span class="font-extrabold text-slate-800 text-xs truncate">${escapeHtml(cat.name)}</span>
                                    <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-50 text-purple-800 border border-purple-200 shrink-0">
                                        Max ${cat.points || cat.max_score} pts
                                    </span>
                                </div>
                                ${cat.description ? `<p class="text-[11px] text-slate-500 font-normal leading-tight mt-1 line-clamp-3">${escapeHtml(cat.description)}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : isRubric ? `
                    <div class="flex items-center justify-between text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                        <span>Predefined Rubric Ratings (${rubricRatings.length} options)</span>
                        <span class="text-amber-700 font-bold normal-case">Judge selects one predefined rating</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${Math.min(rubricRatings.length, 4)} gap-2">
                        ${rubricRatings.map(r => `
                            <div class="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1 shadow-2xs">
                                <div class="flex items-center justify-between gap-1">
                                    <span class="font-extrabold text-slate-800 text-xs truncate">${escapeHtml(r.name)}</span>
                                    <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                        ${r.score} pts
                                    </span>
                                </div>
                                ${r.description ? `<p class="text-[11px] text-slate-500 font-normal leading-tight mt-1 line-clamp-3">${escapeHtml(r.description)}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="flex items-center justify-between text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                        <span>Manual Scoring Setup</span>
                        <span class="text-indigo-600 font-bold normal-case">Judge enters a numerical score</span>
                    </div>
                    <div class="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-2">
                        <div class="flex items-center gap-3 text-xs flex-wrap">
                            <span class="font-bold text-slate-700">Allowed Score Range:</span>
                            <span class="font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                                ${minPts} — ${cr.max_points} pts
                            </span>
                            <span class="text-slate-400 font-semibold text-[11px]">(Step: ${cr.score_step || 0.5} pts)</span>
                        </div>
                        <p class="text-xs text-slate-600 font-normal leading-relaxed">${escapeHtml(cr.description || cr.instructions || 'The judge enters any numerical score within the allowed range.')}</p>
                    </div>
                `}
            </div>
        </div>
        `;
    }).join('');

    bindCriteriaRowActions();
}

function bindCriteriaRowActions() {
    // Toggle rubric preview
    document.querySelectorAll('.toggle-rubric-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const preview = document.getElementById(`rubric-preview-${id}`);
            if (preview) {
                preview.classList.toggle('hidden');
                const span = btn.querySelector('span');
                if (span) span.textContent = preview.classList.contains('hidden') ? 'View Details' : 'Hide Details';
            }
        });
    });

    // Edit criterion & scoring setup modal
    document.querySelectorAll('.edit-criterion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            openCriterionRubricModal(btn.dataset.id);
        });
    });

    // Delete criterion
    document.querySelectorAll('.delete-criterion-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const title = btn.dataset.title;

            if (confirm(`Are you sure you want to remove criterion "${title}"? Any related scores will also be deleted.`)) {
                const res = await deleteCriterion(id);
                if (res.success) {
                    showToast('Criterion removed.', 'success');
                    loadCriteriaList();
                } else {
                    showToast(res.message || 'Failed to delete criterion.', 'error');
                }
            }
        });
    });
}

export function setModalScoringType(type) {
    const isManual = (type === 'manual');
    const isRubric = (type === 'rubric');
    const isCategory = (type === 'category');

    const manualRadio = document.getElementById('modal-scoring-type-manual');
    const rubricRadio = document.getElementById('modal-scoring-type-rubric');
    const categoryRadio = document.getElementById('modal-scoring-type-category');

    const manualCard = document.getElementById('modal-scoring-card-manual');
    const rubricCard = document.getElementById('modal-scoring-card-rubric');
    const categoryCard = document.getElementById('modal-scoring-card-category');

    const manualSection = document.getElementById('modal-manual-config-section');
    const rubricSection = document.getElementById('modal-rubric-config-section');
    const categorySection = document.getElementById('modal-category-config-section');

    if (manualRadio && rubricRadio && categoryRadio) {
        manualRadio.checked = isManual;
        rubricRadio.checked = isRubric;
        categoryRadio.checked = isCategory;
    }

    if (isManual) {
        manualSection?.classList.remove('hidden');
        rubricSection?.classList.add('hidden');
        categorySection?.classList.add('hidden');

        manualCard?.classList.add('border-indigo-500', 'bg-indigo-50/50', 'shadow-2xs');
        manualCard?.classList.remove('border-slate-200', 'bg-white');
        rubricCard?.classList.remove('border-amber-500', 'bg-amber-50/50', 'shadow-2xs');
        rubricCard?.classList.add('border-slate-200', 'bg-white');
        categoryCard?.classList.remove('border-purple-500', 'bg-purple-50/50', 'shadow-2xs');
        categoryCard?.classList.add('border-slate-200', 'bg-white');
    } else if (isRubric) {
        manualSection?.classList.add('hidden');
        rubricSection?.classList.remove('hidden');
        categorySection?.classList.add('hidden');

        rubricCard?.classList.add('border-amber-500', 'bg-amber-50/50', 'shadow-2xs');
        rubricCard?.classList.remove('border-slate-200', 'bg-white');
        manualCard?.classList.remove('border-indigo-500', 'bg-indigo-50/50', 'shadow-2xs');
        manualCard?.classList.add('border-slate-200', 'bg-white');
        categoryCard?.classList.remove('border-purple-500', 'bg-purple-50/50', 'shadow-2xs');
        categoryCard?.classList.add('border-slate-200', 'bg-white');

        // If ratings container is empty, populate default ratings
        const container = document.getElementById('rubric-ratings-container');
        if (container && container.querySelectorAll('.rubric-rating-item').length === 0) {
            const maxPts = parseFloat(document.getElementById('rubric-modal-max-input')?.value) || 100;
            const defaults = getDefaultRubricRatings(maxPts);
            defaults.forEach((r, idx) => addRatingRow(r, idx));
        }
    } else {
        // isCategory
        manualSection?.classList.add('hidden');
        rubricSection?.classList.add('hidden');
        categorySection?.classList.remove('hidden');

        categoryCard?.classList.add('border-purple-500', 'bg-purple-50/50', 'shadow-2xs');
        categoryCard?.classList.remove('border-slate-200', 'bg-white');
        manualCard?.classList.remove('border-indigo-500', 'bg-indigo-50/50', 'shadow-2xs');
        manualCard?.classList.add('border-slate-200', 'bg-white');
        rubricCard?.classList.remove('border-amber-500', 'bg-amber-50/50', 'shadow-2xs');
        rubricCard?.classList.add('border-slate-200', 'bg-white');

        // If category container is empty, load style preset
        const container = document.getElementById('category-rows-container');
        if (container && container.querySelectorAll('.category-row-item').length === 0) {
            loadStyleCategoryPreset();
        } else {
            updateCategorySum();
        }
    }
}

export function updateCategorySum() {
    const container = document.getElementById('category-rows-container');
    const badge = document.getElementById('category-sum-total-badge');
    const maxInput = document.getElementById('rubric-modal-max-input');
    if (!container) return 0;

    const items = container.querySelectorAll('.category-row-item');
    let sum = 0;
    items.forEach(item => {
        const pts = parseFloat(item.querySelector('.cat-points-input')?.value) || 0;
        sum += pts;
    });

    sum = Math.round(sum * 10) / 10;

    if (badge) {
        badge.textContent = `Total: ${sum} pts (${items.length} Categories)`;
    }
    if (maxInput) {
        maxInput.value = sum;
    }
    return sum;
}

export function addCategoryRow(category = null, index = null) {
    const container = document.getElementById('category-rows-container');
    if (!container) return;

    const existingRows = container.querySelectorAll('.category-row-item');
    const nextIdx = index !== null ? index : existingRows.length;

    const cId = category?.id || ('cat-' + Math.random().toString(36).substring(2, 7));
    const cName = category?.name || (nextIdx === 0 ? 'Stance uniqueness' : nextIdx === 1 ? 'Pose preference' : nextIdx === 2 ? 'Crowd impact' : 'Execution quality');
    const cPoints = (category && (category.points !== undefined || category.max_score !== undefined))
        ? parseFloat(category.points ?? category.max_score)
        : 10;
    const cDesc = category?.description || '';

    const row = document.createElement('div');
    row.className = 'category-row-item p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5 transition-all hover:border-slate-300 shadow-2xs';
    row.dataset.catId = cId;

    row.innerHTML = `
        <div class="flex items-center justify-between gap-3 border-b border-slate-200/70 pb-2">
            <div class="flex items-center gap-2 flex-1 flex-wrap sm:flex-nowrap">
                <span class="cat-index-badge w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                    #${nextIdx + 1}
                </span>
                <div class="flex-1 min-w-[160px]">
                    <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-0.5">Category Name / Aspect</label>
                    <input type="text" class="cat-name-input w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="e.g. Stance uniqueness, Pose preference..." value="${escapeHtml(cName)}" required>
                </div>
                <div class="shrink-0">
                    <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-0.5">Max Points (pts)</label>
                    <div class="flex items-center gap-1.5">
                        <input type="number" step="0.5" min="0.5" class="cat-points-input w-24 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-black text-xs text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500" value="${cPoints}" required>
                        <span class="text-xs font-bold text-slate-500">pts</span>
                    </div>
                </div>
            </div>
            <button type="button" class="remove-cat-btn px-2 py-1 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl text-xs cursor-pointer font-bold flex items-center gap-1 transition-colors" title="Remove Category">
                <i class="fa-solid fa-trash-can"></i> <span class="hidden sm:inline">Delete</span>
            </button>
        </div>

        <div>
            <label class="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-0.5">Category Description &amp; Performance Standards</label>
            <textarea class="cat-desc-input w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 font-normal leading-relaxed" rows="2" placeholder="e.g. Beautiful stance and positioning, flawless poise...">${escapeHtml(cDesc)}</textarea>
        </div>
    `;

    // Live update sum when points change
    row.querySelector('.cat-points-input')?.addEventListener('input', updateCategorySum);

    // Remove button handler
    row.querySelector('.remove-cat-btn')?.addEventListener('click', () => {
        const remaining = container.querySelectorAll('.category-row-item');
        if (remaining.length <= 2) {
            showToast('A category-based criterion must have at least 2 categories.', 'warning');
            return;
        }
        row.remove();
        container.querySelectorAll('.category-row-item').forEach((item, idx) => {
            const badge = item.querySelector('.cat-index-badge');
            if (badge) badge.textContent = `#${idx + 1}`;
        });
        updateCategorySum();
    });

    container.appendChild(row);
    updateCategorySum();
}

export function loadStyleCategoryPreset() {
    const container = document.getElementById('category-rows-container');
    if (!container) return;
    container.innerHTML = '';
    const stylePresets = [
        { id: 'cat-1', name: 'Stance uniqueness', points: 10, max_score: 10, description: 'Beautiful stance, unique positioning, and expressive balance' },
        { id: 'cat-2', name: 'Pose preference', points: 10, max_score: 10, description: 'Wonderful preference, alignment, and visual poise' },
        { id: 'cat-3', name: 'Crowd impact', points: 10, max_score: 10, description: 'Crowds shout continuously, powerful audience connection and charisma' }
    ];
    stylePresets.forEach((p, idx) => addCategoryRow(p, idx));
    updateCategorySum();
    showToast('Loaded Style Example (30 pts)', 'info');
}

export function load4CategoryPreset() {
    const container = document.getElementById('category-rows-container');
    if (!container) return;
    container.innerHTML = '';
    const presets = [
        { id: 'cat-1', name: 'Execution & Technique', points: 10, max_score: 10, description: 'Precision, posture, body control, and clean technical execution' },
        { id: 'cat-2', name: 'Artistry & Musicality', points: 10, max_score: 10, description: 'Rhythm adherence, emotional nuance, musical interpretation' },
        { id: 'cat-3', name: 'Difficulty & Variety', points: 10, max_score: 10, description: 'Complex combinations, diverse transitions, and movement variety' },
        { id: 'cat-4', name: 'Overall Stage Presence', points: 10, max_score: 10, description: 'Audience connection, confidence, projection, and performance energy' }
    ];
    presets.forEach((p, idx) => addCategoryRow(p, idx));
    updateCategorySum();
    showToast('Loaded 4 Standard Categories (40 pts)', 'info');
}

export function addRatingRow(rating = null, index = null) {
    const container = document.getElementById('rubric-ratings-container');
    if (!container) return;

    const existingRows = container.querySelectorAll('.rubric-rating-item');
    const nextIdx = index !== null ? index : existingRows.length;

    const rId = rating?.id || ('rate-' + Math.random().toString(36).substring(2, 7));
    const rName = rating?.name || (nextIdx === 0 ? 'Excellent' : nextIdx === 1 ? 'Very Good' : nextIdx === 2 ? 'Good' : 'Needs Improvement');
    const rScore = (rating && typeof rating.score !== 'undefined') ? parseFloat(rating.score) : Math.max(0, 100 - (nextIdx * 25));
    const rDesc = rating?.description || '';

    const row = document.createElement('div');
    row.className = 'rubric-rating-item p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5 transition-all hover:border-slate-300 shadow-2xs';
    row.dataset.rateId = rId;

    row.innerHTML = `
        <div class="flex items-center justify-between gap-3 border-b border-slate-200/70 pb-2">
            <div class="flex items-center gap-2 flex-1 flex-wrap sm:flex-nowrap">
                <span class="rating-index-badge w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                    #${nextIdx + 1}
                </span>
                <div class="flex-1 min-w-[160px]">
                    <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-0.5">Rating Label / Title</label>
                    <input type="text" class="rate-name-input w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="e.g. Excellent, Very Good, Fair..." value="${escapeHtml(rName)}" required>
                </div>
                <div class="shrink-0">
                    <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-0.5">Fixed Score (pts)</label>
                    <div class="flex items-center gap-1.5">
                        <input type="number" step="0.5" min="0" class="rate-score-input w-24 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-black text-xs text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500" value="${rScore}" required>
                        <span class="text-xs font-bold text-slate-500">pts</span>
                    </div>
                </div>
            </div>
            <button type="button" class="remove-rating-btn px-2 py-1 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl text-xs cursor-pointer font-bold flex items-center gap-1 transition-colors" title="Remove Rating Option">
                <i class="fa-solid fa-trash-can"></i> <span class="hidden sm:inline">Delete</span>
            </button>
        </div>

        <div>
            <label class="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-0.5">Description &amp; Performance Standard</label>
            <textarea class="rate-desc-input w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 font-normal leading-relaxed" rows="2" placeholder="Specific observable characteristics and criteria required to earn this rating...">${escapeHtml(rDesc)}</textarea>
        </div>
    `;

    // Remove button handler
    row.querySelector('.remove-rating-btn')?.addEventListener('click', () => {
        const remaining = container.querySelectorAll('.rubric-rating-item');
        if (remaining.length <= 2) {
            showToast('A rubric-based criterion must have at least 2 predefined ratings.', 'warning');
            return;
        }
        row.remove();
        container.querySelectorAll('.rubric-rating-item').forEach((item, idx) => {
            const badge = item.querySelector('.rating-index-badge');
            if (badge) badge.textContent = `#${idx + 1}`;
        });
    });

    container.appendChild(row);
}

export function load4TierPreset() {
    const container = document.getElementById('rubric-ratings-container');
    if (!container) return;
    container.innerHTML = '';
    const maxPts = parseFloat(document.getElementById('rubric-modal-max-input')?.value) || 100;
    const presets = getDefaultRubricRatings(maxPts);
    presets.forEach((p, idx) => addRatingRow(p, idx));
    showToast('Loaded 4-tier rubric preset.', 'info');
}

export function load5TierPreset() {
    const container = document.getElementById('rubric-ratings-container');
    if (!container) return;
    container.innerHTML = '';
    const maxPts = parseFloat(document.getElementById('rubric-modal-max-input')?.value) || 100;
    const presets = [
        { id: 'rate-1', name: 'Superior / Masterful', score: roundScore(maxPts * 1.0), description: 'Extraordinary artistry, flawless technique, and innovative stage presence.' },
        { id: 'rate-2', name: 'Excellent / High Distinction', score: roundScore(maxPts * 0.8), description: 'Superior execution with remarkable precision and minimal errors.' },
        { id: 'rate-3', name: 'Proficient / Above Average', score: roundScore(maxPts * 0.6), description: 'Well-executed with solid timing and commendable choreography.' },
        { id: 'rate-4', name: 'Satisfactory / Competent', score: roundScore(maxPts * 0.4), description: 'Meets minimum competition standards; noticeable inconsistency.' },
        { id: 'rate-5', name: 'Developing / Needs Support', score: roundScore(maxPts * 0.2), description: 'Frequent performance breaks, lack of synchronization, or incomplete.' }
    ];
    presets.forEach((p, idx) => addRatingRow(p, idx));
    showToast('Loaded 5-tier rubric preset.', 'info');
}

export function getDefaultRubricRatings(maxPoints = 100) {
    const max = parseFloat(maxPoints) || 100;
    return [
        { id: 'rate-1', name: 'Excellent / Outstanding', score: roundScore(max * 1.0), description: 'Exemplary performance, flawless execution, and superior technical mastery.' },
        { id: 'rate-2', name: 'Very Good / Proficient', score: roundScore(max * 0.75), description: 'High-level proficiency with solid technique and only minor, isolated errors.' },
        { id: 'rate-3', name: 'Good / Competent', score: roundScore(max * 0.50), description: 'Meets standard expectations; demonstrated ability with noticeable room for improvement.' },
        { id: 'rate-4', name: 'Fair / Needs Improvement', score: roundScore(max * 0.25), description: 'Below standard; frequent inconsistencies, technical flaws, or lack of refinement.' }
    ];
}

export function getDefaultScoringCategories(totalMax = 30) {
    const max = parseFloat(totalMax) || 30;
    const perCat = Math.round((max / 3) * 10) / 10;
    const remainder = Math.round((max - (perCat * 2)) * 10) / 10;
    return [
        { id: 'cat-1', name: 'Stance uniqueness', points: perCat, max_score: perCat, description: 'Beautiful stance and unique positioning' },
        { id: 'cat-2', name: 'Pose preference', points: perCat, max_score: perCat, description: 'Wonderful preference, alignment, and visual poise' },
        { id: 'cat-3', name: 'Crowd impact', points: remainder, max_score: remainder, description: 'Crowds shout continuously, powerful audience connection' }
    ];
}

function roundScore(val) {
    return Math.round(val * 10) / 10;
}

export function openCriterionRubricModal(criterionId) {
    const modal = document.getElementById('criterion-rubric-modal');
    if (!modal) return;

    const critIdInput = document.getElementById('rubric-modal-crit-id');
    const titleInput = document.getElementById('rubric-modal-title-input');
    const pctInput = document.getElementById('rubric-modal-pct-input');
    const minInput = document.getElementById('rubric-modal-min-input');
    const maxInput = document.getElementById('rubric-modal-max-input');
    const stepInput = document.getElementById('rubric-modal-step-input');
    const descInput = document.getElementById('rubric-modal-desc-input');
    const ratingsContainer = document.getElementById('rubric-ratings-container');
    const categoryContainer = document.getElementById('category-rows-container');
    const modalTitle = document.getElementById('rubric-modal-title');

    if (ratingsContainer) ratingsContainer.innerHTML = '';
    if (categoryContainer) categoryContainer.innerHTML = '';

    const criterion = cachedCriteria.find(c => String(c.id) === String(criterionId));
    let scoringType = 'manual';
    let initialMin = 0;
    let initialMax = 100;
    let initialStep = 0.5;
    let rubricRatings = [];
    let scoringCategories = [];

    if (criterion) {
        modalTitle.textContent = `Edit Criterion: ${criterion.title}`;
        critIdInput.value = criterion.id;
        titleInput.value = criterion.title || '';
        pctInput.value = criterion.percentage || 0;
        scoringType = criterion.scoring_type || (criterion.scoring_categories?.length > 0 ? 'category' : (criterion.rubric_ratings?.length > 0 ? 'rubric' : 'manual'));
        initialMin = typeof criterion.min_points !== 'undefined' ? parseFloat(criterion.min_points) : 0;
        initialMax = parseFloat(criterion.max_points) || 100;
        initialStep = parseFloat(criterion.score_step) || 0.5;
        descInput.value = criterion.description || criterion.instructions || '';
        rubricRatings = (Array.isArray(criterion.rubric_ratings) && criterion.rubric_ratings.length > 0)
            ? criterion.rubric_ratings
            : getDefaultRubricRatings(initialMax);
        scoringCategories = (Array.isArray(criterion.scoring_categories) && criterion.scoring_categories.length > 0)
            ? criterion.scoring_categories
            : getDefaultScoringCategories(initialMax);
    } else {
        modalTitle.textContent = 'Add Judging Criterion & Scoring Method';
        critIdInput.value = '';
        titleInput.value = '';
        pctInput.value = 0;
        scoringType = 'manual';
        initialMin = 0;
        initialMax = 100;
        initialStep = 0.5;
        descInput.value = '';
        rubricRatings = getDefaultRubricRatings(initialMax);
        scoringCategories = getDefaultScoringCategories(30);
    }

    if (minInput) minInput.value = initialMin;
    if (maxInput) maxInput.value = initialMax;
    if (stepInput) stepInput.value = initialStep;

    const summaryBadge = document.getElementById('manual-range-summary-badge');
    if (summaryBadge) summaryBadge.textContent = `Allowed Range: ${initialMin} - ${initialMax} pts`;

    // Populate predefined ratings into container
    rubricRatings.forEach((r, idx) => addRatingRow(r, idx));

    // Populate category rows into container if category-based
    if (scoringType === 'category') {
        scoringCategories.forEach((c, idx) => addCategoryRow(c, idx));
        updateCategorySum();
    }

    // Toggle scoring type selection in modal
    setModalScoringType(scoringType);

    // Set weight remaining bounds and hint in Rubric Modal
    let otherCriteriaTotal = 0;
    if (criterion) {
        otherCriteriaTotal = cachedCriteria.filter(c => String(c.id) !== String(criterion.id)).reduce((sum, c) => sum + (parseInt(c.percentage) || 0), 0);
    } else {
        otherCriteriaTotal = cachedCriteria.reduce((sum, c) => sum + (parseInt(c.percentage) || 0), 0);
    }
    const maxAllowedForThis = Math.max(0, 100 - otherCriteriaTotal);

    const rubricPctHint = document.getElementById('rubric-modal-weight-hint');
    if (pctInput) {
        pctInput.max = maxAllowedForThis;
        pctInput.placeholder = maxAllowedForThis > 0 ? `Max ${maxAllowedForThis}%` : '0% left';
        if (!criterion) {
            pctInput.value = Math.min(25, maxAllowedForThis);
        }
    }
    if (rubricPctHint) {
        if (maxAllowedForThis > 0) {
            rubricPctHint.textContent = `Max ${maxAllowedForThis}% available`;
            rubricPctHint.className = 'text-[10px] font-bold text-emerald-600';
        } else {
            rubricPctHint.textContent = `0% available (100% reached)`;
            rubricPctHint.className = 'text-[10px] font-bold text-rose-500';
        }
    }

    modal.classList.remove('hidden');
}

async function handleSaveRubricCriterion(e) {
    e.preventDefault();
    if (!currentEventId) return;

    const critId = document.getElementById('rubric-modal-crit-id')?.value;
    const title = document.getElementById('rubric-modal-title-input')?.value.trim();
    const pct = parseInt(document.getElementById('rubric-modal-pct-input')?.value) || 0;
    const desc = document.getElementById('rubric-modal-desc-input')?.value.trim();
    const scoringType = document.querySelector('input[name="modal_scoring_type"]:checked')?.value || 'manual';
    const saveBtn = document.getElementById('saveRubricCriterionBtn');

    if (!title) {
        showToast('Please enter a criterion title.', 'warning');
        return;
    }

    // Weight validation: ensure total event weight does not exceed 100%
    let otherTotal = 0;
    if (critId) {
        otherTotal = cachedCriteria.filter(c => String(c.id) !== String(critId)).reduce((sum, c) => sum + (parseInt(c.percentage) || 0), 0);
    } else {
        otherTotal = cachedCriteria.reduce((sum, c) => sum + (parseInt(c.percentage) || 0), 0);
    }
    const maxAllowed = Math.max(0, 100 - otherTotal);
    if (pct > maxAllowed) {
        showToast('Weight Limit Exceeded', `Cannot save: Weight of ${pct}% causes total event weight (${otherTotal + pct}%) to exceed 100%. Only ${maxAllowed}% is available.`, 'warning');
        return;
    }

    let minPoints = 0;
    let maxPoints = 100;
    let scoreStep = 0.5;
    let rubricRatings = [];
    let scoringCategories = [];

    if (scoringType === 'manual') {
        minPoints = parseFloat(document.getElementById('rubric-modal-min-input')?.value);
        if (isNaN(minPoints) || minPoints < 0) minPoints = 0;
        maxPoints = parseFloat(document.getElementById('rubric-modal-max-input')?.value);
        if (isNaN(maxPoints) || maxPoints <= 0) maxPoints = 100;
        scoreStep = parseFloat(document.getElementById('rubric-modal-step-input')?.value) || 0.5;

        if (minPoints >= maxPoints) {
            showToast('Invalid Range', 'Minimum allowed score must be strictly less than maximum score.', 'warning');
            return;
        }
    } else if (scoringType === 'rubric') {
        // Rubric-Based Scoring
        const container = document.getElementById('rubric-ratings-container');
        const items = container?.querySelectorAll('.rubric-rating-item') || [];

        if (items.length < 2) {
            showToast('Rubric Configuration', 'Please configure at least 2 predefined rating options.', 'warning');
            return;
        }

        let hasInvalid = false;
        let highest = 0;
        items.forEach((item, idx) => {
            const name = item.querySelector('.rate-name-input')?.value.trim();
            const score = parseFloat(item.querySelector('.rate-score-input')?.value);
            const rDesc = item.querySelector('.rate-desc-input')?.value.trim() || '';
            const id = item.dataset.rateId || ('rate-' + (idx + 1));

            if (!name || isNaN(score) || score < 0) {
                hasInvalid = true;
                return;
            }

            if (score > highest) highest = score;

            rubricRatings.push({
                id,
                name,
                score,
                description: rDesc
            });
        });

        if (hasInvalid) {
            showToast('Incomplete Rating', 'Please provide a valid name and score for all predefined ratings.', 'warning');
            return;
        }

        maxPoints = highest > 0 ? highest : 100;
        minPoints = 0;
    } else {
        // Category-Based Scoring
        const container = document.getElementById('category-rows-container');
        const items = container?.querySelectorAll('.category-row-item') || [];

        if (items.length < 2) {
            showToast('Category Configuration', 'Please configure at least 2 score categories.', 'warning');
            return;
        }

        let hasInvalid = false;
        let sumPoints = 0;
        items.forEach((item, idx) => {
            const name = item.querySelector('.cat-name-input')?.value.trim();
            const pts = parseFloat(item.querySelector('.cat-points-input')?.value);
            const cDesc = item.querySelector('.cat-desc-input')?.value.trim() || '';
            const id = item.dataset.catId || ('cat-' + (idx + 1));

            if (!name || isNaN(pts) || pts <= 0) {
                hasInvalid = true;
                return;
            }

            sumPoints += pts;

            scoringCategories.push({
                id,
                name,
                points: pts,
                max_score: pts,
                description: cDesc
            });
        });

        if (hasInvalid) {
            showToast('Incomplete Category', 'Please provide a valid name and max score greater than 0 for all categories.', 'warning');
            return;
        }

        maxPoints = Math.round(sumPoints * 10) / 10;
        minPoints = 0;
    }

    if (saveBtn) saveBtn.disabled = true;

    const payload = {
        title,
        description: desc,
        scoring_type: scoringType,
        min_points: minPoints,
        max_points: maxPoints,
        score_step: scoreStep,
        instructions: desc,
        percentage: pct,
        rubric_ratings: rubricRatings,
        scoring_categories: scoringCategories
    };

    let res;
    if (critId) {
        res = await editCriterion({ id: critId, ...payload });
    } else {
        res = await createCriterion({ event_id: currentEventId, ...payload });
    }

    if (saveBtn) saveBtn.disabled = false;

    if (res.success) {
        showToast(critId ? 'Criterion Updated!' : 'Criterion Created!', res.message || 'Judging criterion saved successfully.', 'create');
        document.getElementById('criterion-rubric-modal')?.classList.add('hidden');
        loadCriteriaList();
        document.getElementById('refreshEventsBtn')?.click();
    } else {
        showToast(res.message || 'Failed to save criterion.', 'error');
    }
}

async function handleAddCriterion(e) {
    e.preventDefault();
    if (!currentEventId) return;

    const titleInput = document.getElementById('new-criterion-title');
    const descInput = document.getElementById('new-criterion-desc');
    const maxInput = document.getElementById('new-criterion-max');
    const minInput = document.getElementById('new-criterion-min');
    const stepInput = document.getElementById('new-criterion-step');
    const pctInput = document.getElementById('new-criterion-pct');
    const btn = document.getElementById('addCriterionBtn');

    const scoringType = document.querySelector('input[name="quick_scoring_type"]:checked')?.value || 'manual';
    const title = titleInput?.value.trim();
    const description = descInput?.value.trim();
    const maxPoints = parseFloat(maxInput?.value) || 100;
    const minPoints = parseFloat(minInput?.value) || 0;
    const scoreStep = parseFloat(stepInput?.value) || 0.5;
    const percentage = parseInt(pctInput?.value) || 0;

    if (!title) {
        showToast('Please provide a criterion title.', 'warning');
        return;
    }

    if (scoringType === 'manual' && minPoints >= maxPoints) {
        showToast('Invalid Range', 'Minimum score must be less than maximum score.', 'warning');
        return;
    }

    // Weight validation: ensure total event weight does not exceed 100%
    const currentTotal = cachedCriteria.reduce((sum, c) => sum + (parseInt(c.percentage) || 0), 0);
    const remaining = Math.max(0, 100 - currentTotal);
    if ((currentTotal + percentage) > 100) {
        showToast('Weight Limit Exceeded', `Cannot add criterion: Weight of ${percentage}% causes total event weight (${currentTotal + percentage}%) to exceed 100%. Only ${remaining}% is available.`, 'warning');
        return;
    }

    if (btn) btn.disabled = true;

    let rubricRatings = [];
    let scoringCategories = [];
    if (scoringType === 'rubric') {
        rubricRatings = getDefaultRubricRatings(maxPoints);
    } else if (scoringType === 'category') {
        scoringCategories = getDefaultScoringCategories(maxPoints);
    }

    const res = await createCriterion({
        event_id: currentEventId,
        title,
        description,
        scoring_type: scoringType,
        min_points: minPoints,
        max_points: maxPoints,
        score_step: scoreStep,
        instructions: description,
        percentage,
        rubric_ratings: rubricRatings,
        scoring_categories: scoringCategories
    });

    if (btn) btn.disabled = false;

    if (res.success) {
        const typeName = scoringType === 'rubric' ? 'Rubric-Based' : scoringType === 'category' ? 'Category-Based' : 'Manual Scoring';
        showToast('Criterion Added!', `Criterion '${title}' added with ${typeName}!`, 'create');
        if (titleInput) titleInput.value = '';
        if (descInput) descInput.value = '';
        if (pctInput) pctInput.value = '';
        loadCriteriaList();
        document.getElementById('refreshEventsBtn')?.click();
    } else {
        showToast(res.message || 'Failed to add criterion.', 'error');
    }
}

async function handleSaveWeights() {
    if (!currentEventId || cachedCriteria.length === 0) return;

    const weightInputs = document.querySelectorAll('.weight-adjust-input');
    const weights = [];
    let totalPct = 0;

    weightInputs.forEach(input => {
        const id = input.dataset.id;
        const pct = parseInt(input.value) || 0;
        totalPct += pct;
        weights.push({ id, percentage: pct });
    });

    if (totalPct > 100) {
        showToast('Weight Limit Exceeded', `Cannot save weights: Total is ${totalPct}%, which exceeds the 100% maximum limit by ${totalPct - 100}%. Please adjust weights so they do not exceed 100%.`, 'warning');
        updateWeightsModalState(false);
        return;
    }

    const saveBtn = document.getElementById('saveWeightsBtn');
    if (saveBtn) saveBtn.disabled = true;

    const res = await updateCriteriaWeights(currentEventId, weights);
    if (saveBtn) saveBtn.disabled = false;

    if (res.success) {
        showToast('Weights Configured!', res.message || 'Criteria weights updated successfully.', 'edit');
        document.getElementById('adjust-weights-modal')?.classList.add('hidden');
        loadCriteriaList();
        document.getElementById('refreshEventsBtn')?.click();
    } else {
        showToast(res.message || 'Failed to configure weights.', 'error');
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
