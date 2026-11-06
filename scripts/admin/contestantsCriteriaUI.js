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
import { showToast, formatDateTime } from "/scripts/utils/uiUtils.js";

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

    // Form: Edit Contestant
    document.getElementById('editContestantForm')?.addEventListener('submit', handleEditContestantSubmit);

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

    // Entry type radio toggle for edit contestant form
    document.querySelectorAll('input[name="edit_contestant_entry_type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const isTeam = e.target.value === 'team';
            const teamMembersGroup = document.getElementById('edit-contestant-team-members-group');
            const nameLabel = document.getElementById('edit-contestant-name-label');
            const nameInput = document.getElementById('edit-contestant-name');

            if (isTeam) {
                teamMembersGroup?.classList.remove('hidden');
                if (nameLabel) nameLabel.textContent = 'Team / Group Name';
                if (nameInput) nameInput.placeholder = 'e.g. The Velocity Band or Team Alpha';
            } else {
                teamMembersGroup?.classList.add('hidden');
                if (nameLabel) nameLabel.textContent = 'Contestant Name / Entry Title';
                if (nameInput) nameInput.placeholder = 'e.g. Juan Dela Cruz';
            }
        });
    });

    // Team members save handler in modal
    document.getElementById('saveContestantMembersBtn')?.addEventListener('click', handleSaveTeamMembers);

    // Open Weights Modal
    document.getElementById('openConfigureWeightsBtn')?.addEventListener('click', openAdjustWeightsModal);

    // Open Advanced Scoring Builder for New Criterion
    document.getElementById('openNewCriterionRubricBtn')?.addEventListener('click', () => openCriterionRubricModal());
    document.getElementById('openCustomRubricBuilderBtn')?.addEventListener('click', () => openCriterionRubricModal());

    // Form: Configure Weights Modal
    document.getElementById('saveWeightsBtn')?.addEventListener('click', handleSaveWeights);

    // Modal: Scoring Method Radio Toggle (Criteria-Based vs Category-Based)
    document.querySelectorAll('input[name="modal_scoring_type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            setModalScoringType(e.target.value);
        });
    });

    // Modal: Rubric Rating Buttons
    document.getElementById('rubricAddRatingBtn')?.addEventListener('click', () => addRatingRow());

    // Modal: Category-Based Buttons
    document.getElementById('categoryAddRowBtn')?.addEventListener('click', () => addCategoryRow());

    // Modal: Criterion Max Score change listener (divides points evenly across items)
    document.getElementById('rubric-modal-max-input')?.addEventListener('input', () => {
        const scoringType = document.querySelector('input[name="modal_scoring_type"]:checked')?.value || 'rubric';
        if (scoringType === 'category') {
            rebalanceCategoryPoints();
        } else {
            rebalanceRubricPoints();
        }
    });

    // Form: Save Criterion & Scoring Setup
    document.getElementById('criterionRubricForm')?.addEventListener('submit', handleSaveRubricCriterion);

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

    document.querySelectorAll('#edit-contestant-modal .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('edit-contestant-modal')?.classList.add('hidden');
        });
    });

    // Close button for main manage setup modal: closes setup modal and child modals
    document.querySelectorAll('#manage-event-setup-modal .close-modal-btn').forEach(btn => {
        if (btn.closest('#adjust-weights-modal') || btn.closest('#criterion-rubric-modal') || btn.closest('#contestant-comments-modal') || btn.closest('#edit-contestant-modal')) {
            return;
        }
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            modal.classList.add('hidden');
            document.getElementById('adjust-weights-modal')?.classList.add('hidden');
            document.getElementById('criterion-rubric-modal')?.classList.add('hidden');
            document.getElementById('contestant-comments-modal')?.classList.add('hidden');
            document.getElementById('edit-contestant-modal')?.classList.add('hidden');
        });
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    const weightsModal = document.getElementById('adjust-weights-modal');
    weightsModal?.addEventListener('click', (e) => {
        if (e.target === weightsModal) weightsModal.classList.add('hidden');
    });

    const editContestantModal = document.getElementById('edit-contestant-modal');
    editContestantModal?.addEventListener('click', (e) => {
        if (e.target === editContestantModal) editContestantModal.classList.add('hidden');
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
                    class="weight-adjust-input w-20 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-extrabold text-xs text-buksu-navy focus:outline-none focus:ring-2 focus:ring-buksu-navy"
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
        const isMatch = btn.dataset.tab === tabId;
        const icon = btn.querySelector('i');
        if (isMatch) {
            btn.className = 'setup-tab-btn px-4 py-2 text-xs font-bold rounded-xl bg-buksu-navy text-white shadow-xs transition-all cursor-pointer';
            if (icon) {
                icon.classList.remove('text-slate-400');
                icon.classList.add('text-buksu-gold');
            }
        } else {
            btn.className = 'setup-tab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-100 hover:text-buksu-navy transition-all cursor-pointer';
            if (icon) {
                icon.classList.remove('text-buksu-gold');
                icon.classList.add('text-slate-400');
            }
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
                            ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-buksu-navy border border-slate-200/80 shrink-0"><i class="fa-solid fa-users-line me-1 text-slate-400"></i> Team</span>` 
                            : `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/80 shrink-0"><i class="fa-solid fa-user me-1 text-slate-400"></i> Individual</span>`
                        }
                        ${comments.length > 0 
                            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 inline-flex items-center gap-1 shrink-0"><i class="fa-solid fa-award text-amber-500"></i> ${comments.length} Citation${comments.length > 1 ? 's' : ''}</span>` 
                            : ''
                        }
                    </div>
                    <p class="text-xs text-slate-500 font-medium">${escapeHtml(c.department_or_org || 'Independent / General')}</p>
                    ${isTeam && members.length > 0 ? `
                        <p class="text-[11px] text-slate-700 font-medium flex items-center gap-1 line-clamp-1">
                            <i class="fa-solid fa-people-group text-buksu-navy"></i> Members: ${escapeHtml(members.join(', '))}
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
            openEditContestantModal(id);
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

function openEditContestantModal(contestantId) {
    const modal = document.getElementById('edit-contestant-modal');
    if (!modal) return;

    const contestant = cachedContestants.find(c => String(c.id) === String(contestantId));
    if (!contestant) return;

    document.getElementById('edit-contestant-id').value = contestant.id;
    document.getElementById('edit-contestant-num').value = contestant.contestant_number || '';
    document.getElementById('edit-contestant-name').value = contestant.name || '';
    document.getElementById('edit-contestant-dept').value = contestant.department_or_org || contestant.college || '';
    document.getElementById('edit-contestant-desc').value = contestant.description || '';

    const isTeam = contestant.entry_type === 'team';
    const radioInd = document.querySelector('input[name="edit_contestant_entry_type"][value="individual"]');
    const radioTeam = document.querySelector('input[name="edit_contestant_entry_type"][value="team"]');
    if (isTeam && radioTeam) {
        radioTeam.checked = true;
    } else if (radioInd) {
        radioInd.checked = true;
    }

    const teamGroup = document.getElementById('edit-contestant-team-members-group');
    const nameLabel = document.getElementById('edit-contestant-name-label');
    const nameInput = document.getElementById('edit-contestant-name');
    const membersInput = document.getElementById('edit-contestant-members');

    if (teamGroup) teamGroup.classList.toggle('hidden', !isTeam);
    if (nameLabel) nameLabel.textContent = isTeam ? 'Team / Group Name' : 'Contestant Name / Entry Title';
    if (nameInput) nameInput.placeholder = isTeam ? 'e.g. The Velocity Band or Team Alpha' : 'e.g. Juan Dela Cruz';
    if (membersInput) membersInput.value = Array.isArray(contestant.team_members) ? contestant.team_members.join(', ') : (contestant.team_members || '');

    document.getElementById('edit-contestant-modal-title').textContent = `Edit Contestant: #${contestant.contestant_number} ${contestant.name}`;

    modal.classList.remove('hidden');
}

async function handleEditContestantSubmit(e) {
    if (e) e.preventDefault();

    const id = document.getElementById('edit-contestant-id')?.value;
    const numInput = document.getElementById('edit-contestant-num');
    const nameInput = document.getElementById('edit-contestant-name');
    const deptInput = document.getElementById('edit-contestant-dept');
    const descInput = document.getElementById('edit-contestant-desc');
    const membersInput = document.getElementById('edit-contestant-members');
    const entryTypeRadio = document.querySelector('input[name="edit_contestant_entry_type"]:checked');
    const btn = document.getElementById('saveEditContestantBtn');

    const contestantNumber = parseInt(numInput?.value);
    const name = nameInput?.value?.trim();
    const dept = deptInput?.value?.trim() || '';
    const desc = descInput?.value?.trim() || '';
    const entryType = entryTypeRadio?.value || 'individual';
    const membersRaw = membersInput?.value?.trim() || '';

    if (!id || !contestantNumber || !name) {
        showToast('Please provide a contestant number and name.', 'warning');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1.5"></i> Saving...';
    }

    const payload = {
        id,
        contestant_number: contestantNumber,
        name: name,
        department_or_org: dept,
        college: dept,
        description: desc,
        entry_type: entryType
    };

    if (entryType === 'team') {
        payload.team_members = membersRaw ? membersRaw.split(/[\r\n,]+/).map(m => m.trim()).filter(Boolean) : [];
    } else {
        payload.team_members = [];
    }

    const res = await editContestant(payload);

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk text-buksu-gold"></i> Save Changes';
    }

    if (res.success) {
        showToast('Contestant Updated!', res.message || `Contestant #${contestantNumber} updated successfully.`, 'edit');
        document.getElementById('edit-contestant-modal')?.classList.add('hidden');
        await loadContestantsList();
        document.getElementById('refreshEventsBtn')?.click();
    } else {
        showToast(res.message || 'Failed to update contestant.', 'error');
    }
}

async function handleAddContestant(e) {
    e.preventDefault();
    if (!currentEventId) return;

    const numInput = document.getElementById('new-contestant-num');
    const nameInput = document.getElementById('new-contestant-name');
    const deptInput = document.getElementById('new-contestant-dept');
    const descInput = document.getElementById('new-contestant-desc');
    const membersInput = document.getElementById('new-contestant-members');
    const entryTypeRadio = document.querySelector('input[name="contestant_entry_type"]:checked');
    const btn = document.getElementById('addContestantBtn');

    const contestantNumber = parseInt(numInput?.value);
    const name = nameInput?.value.trim();
    const departmentOrOrg = deptInput?.value.trim();
    const description = descInput?.value.trim();
    const entryType = entryTypeRadio?.value || 'individual';
    const teamMembers = membersInput?.value.trim();

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
        team_members: teamMembers
    });

    if (btn) btn.disabled = false;

    if (res.success) {
        showToast('Contestant Added!', res.message || `Contestant #${contestantNumber} registered successfully.`, 'create');
        if (nameInput) nameInput.value = '';
        if (deptInput) deptInput.value = '';
        if (descInput) descInput.value = '';
        if (membersInput) membersInput.value = '';
        
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
                    <span class="text-[10px] text-slate-400 font-medium">Added by ${escapeHtml(c.author || 'Admin')} ${c.created_at ? '• ' + escapeHtml(formatDateTime(c.created_at)) : ''}</span>
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
        const rubricRatings = Array.isArray(cr.rubric_ratings) ? cr.rubric_ratings : [];
        const categories = Array.isArray(cr.scoring_categories) ? cr.scoring_categories : [];

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
                                ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 shrink-0 flex items-center gap-1"><i class="fa-solid fa-layer-group text-buksu-navy dark:text-buksu-gold"></i> Category-Based (${categories.length} Categories, ${cr.max_points} pts total)</span>`
                                : `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 shrink-0 flex items-center gap-1"><i class="fa-solid fa-list-check text-amber-600"></i> Criteria-Based (${rubricRatings.length} Ratings)</span>`}
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
                        <span class="text-slate-600 dark:text-slate-400 font-bold normal-case">Each sub-category scored up to its configured max score</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${Math.min(categories.length, 4)} gap-2">
                        ${categories.map(cat => `
                            <div class="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1 shadow-2xs">
                                <div class="flex items-center justify-between gap-1">
                                    <span class="font-extrabold text-slate-800 text-xs truncate">${escapeHtml(cat.name)}</span>
                                    <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-200 shrink-0">
                                        Max ${cat.points || cat.max_score} pts
                                    </span>
                                </div>
                                ${cat.description ? `<p class="text-[11px] text-slate-500 font-normal leading-tight mt-1 line-clamp-3">${escapeHtml(cat.description)}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="flex items-center justify-between text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                        <span>Predefined Criteria Ratings (${rubricRatings.length} options)</span>
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

export function setModalScoringType(type, preserveExisting = false) {
    const isCategory = (type === 'category');

    const rubricRadio = document.getElementById('modal-scoring-type-rubric');
    const categoryRadio = document.getElementById('modal-scoring-type-category');

    const rubricCard = document.getElementById('modal-scoring-card-rubric');
    const categoryCard = document.getElementById('modal-scoring-card-category');

    const rubricSection = document.getElementById('modal-rubric-config-section');
    const categorySection = document.getElementById('modal-category-config-section');

    if (rubricRadio && categoryRadio) {
        rubricRadio.checked = !isCategory;
        categoryRadio.checked = isCategory;
    }

    if (!isCategory) {
        // Criteria-Based ('rubric')
        rubricSection?.classList.remove('hidden');
        categorySection?.classList.add('hidden');

        rubricCard?.classList.add('border-amber-500', 'bg-amber-50/50', 'shadow-2xs');
        rubricCard?.classList.remove('border-slate-200', 'bg-white');
        categoryCard?.classList.remove('border-buksu-navy', 'bg-slate-100/70', 'shadow-2xs');
        categoryCard?.classList.add('border-slate-200', 'bg-white');

        if (!preserveExisting) {
            rebalanceRubricPoints();
        }
    } else {
        // Category-Based
        rubricSection?.classList.add('hidden');
        categorySection?.classList.remove('hidden');

        categoryCard?.classList.add('border-buksu-navy', 'bg-slate-100/70', 'shadow-2xs');
        categoryCard?.classList.remove('border-slate-200', 'bg-white');
        rubricCard?.classList.remove('border-amber-500', 'bg-amber-50/50', 'shadow-2xs');
        rubricCard?.classList.add('border-slate-200', 'bg-white');

        if (!preserveExisting) {
            rebalanceCategoryPoints();
        }
    }
}

export function rebalanceCategoryPoints() {
    const container = document.getElementById('category-rows-container');
    const badge = document.getElementById('category-sum-total-badge');
    const maxInput = document.getElementById('rubric-modal-max-input');
    if (!container) return;

    const rows = container.querySelectorAll('.category-row-item');
    const count = rows.length;
    const maxPts = parseFloat(maxInput?.value) || 0;

    let emptyMsg = container.querySelector('.empty-category-placeholder');
    if (count === 0) {
        if (!emptyMsg) {
            container.innerHTML = `
                <div class="empty-category-placeholder py-8 px-4 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                    <i class="fa-solid fa-layer-group text-slate-300 text-2xl mb-2 block"></i>
                    <p class="text-xs font-bold text-slate-600">No score categories added yet</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">Click <strong class="text-buksu-navy font-bold">"+ Add Category"</strong> above to add categories. At least 2 categories are required.</p>
                </div>
            `;
        }
        if (badge) badge.textContent = `Total: ${maxPts} pts (0 Categories)`;
        return;
    } else if (emptyMsg) {
        emptyMsg.remove();
    }

    const perItem = count > 0 ? (Math.round((maxPts / count) * 100) / 100) : 0;

    rows.forEach((row, idx) => {
        const badgeElem = row.querySelector('.cat-index-badge');
        if (badgeElem) badgeElem.textContent = `#${idx + 1}`;

        const ptsInput = row.querySelector('.cat-points-input');
        if (ptsInput) {
            ptsInput.value = perItem;
        }
    });

    if (badge) {
        badge.textContent = `Total: ${maxPts} pts (${count} Categories - ${perItem} pts each)`;
    }
}

export function rebalanceRubricPoints() {
    const container = document.getElementById('rubric-ratings-container');
    const maxInput = document.getElementById('rubric-modal-max-input');
    if (!container) return;

    const rows = container.querySelectorAll('.rubric-rating-item');
    const count = rows.length;
    const maxPts = parseFloat(maxInput?.value) || 0;

    let emptyMsg = container.querySelector('.empty-rating-placeholder');
    if (count === 0) {
        if (!emptyMsg) {
            container.innerHTML = `
                <div class="empty-rating-placeholder py-8 px-4 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                    <i class="fa-solid fa-list-check text-slate-300 text-2xl mb-2 block"></i>
                    <p class="text-xs font-bold text-slate-600">No predefined ratings added yet</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">Click <strong class="text-amber-600 font-bold">"+ Add Predefined Rating"</strong> above to add ratings. At least 2 ratings are required.</p>
                </div>
            `;
        }
        return;
    } else if (emptyMsg) {
        emptyMsg.remove();
    }

    const perItem = count > 0 ? (Math.round((maxPts / count) * 100) / 100) : 0;

    rows.forEach((row, idx) => {
        const badgeElem = row.querySelector('.rating-index-badge');
        if (badgeElem) badgeElem.textContent = `#${idx + 1}`;

        const scoreInput = row.querySelector('.rate-score-input');
        if (scoreInput) {
            scoreInput.value = perItem;
        }
    });
}

export function updateCategorySum() {
    return rebalanceCategoryPoints();
}

export function addCategoryRow(category = null, index = null) {
    const container = document.getElementById('category-rows-container');
    if (!container) return;

    container.querySelector('.empty-category-placeholder')?.remove();

    const existingRows = container.querySelectorAll('.category-row-item');
    const nextIdx = index !== null ? index : existingRows.length;

    const cId = category?.id || ('cat-' + Math.random().toString(36).substring(2, 7));
    const cName = category?.name || '';
    const cPoints = (category && (category.points !== undefined || category.max_score !== undefined))
        ? parseFloat(category.points ?? category.max_score)
        : 0;
    const cDesc = category?.description || '';

    const row = document.createElement('div');
    row.className = 'category-row-item p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5 transition-all hover:border-slate-300 shadow-2xs';
    row.dataset.catId = cId;

    row.innerHTML = `
        <div class="flex items-center justify-between gap-3 border-b border-slate-200/70 pb-2">
            <div class="flex items-center gap-2 flex-1 flex-wrap sm:flex-nowrap">
                <span class="cat-index-badge w-6 h-6 rounded-lg bg-buksu-navy text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                    #${nextIdx + 1}
                </span>
                <div class="flex-1 min-w-[160px]">
                    <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-0.5">Category Name / Aspect</label>
                    <input type="text" class="cat-name-input w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-buksu-navy" placeholder="e.g. Execution, Artistry, Technique..." value="${escapeHtml(cName)}" required>
                </div>
                <div class="shrink-0">
                    <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-0.5">Max Points (pts)</label>
                    <div class="flex items-center gap-1.5">
                        <input type="number" step="any" min="0.1" class="cat-points-input w-24 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-black text-xs text-buksu-navy focus:outline-none focus:ring-2 focus:ring-buksu-navy" value="${cPoints}" required>
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
            <textarea class="cat-desc-input w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-buksu-navy font-normal leading-relaxed" rows="2" placeholder="Describe expectations and scoring guidelines for this category...">${escapeHtml(cDesc)}</textarea>
        </div>
    `;

    row.querySelector('.cat-points-input')?.addEventListener('input', () => {
        const rows = container.querySelectorAll('.category-row-item');
        let sum = 0;
        rows.forEach(r => {
            sum += parseFloat(r.querySelector('.cat-points-input')?.value) || 0;
        });
        sum = Math.round(sum * 100) / 100;
        const badge = document.getElementById('category-sum-total-badge');
        if (badge) {
            badge.textContent = `Total: ${sum} pts (${rows.length} Categories)`;
        }
    });

    row.querySelector('.remove-cat-btn')?.addEventListener('click', () => {
        row.remove();
        rebalanceCategoryPoints();
    });

    container.appendChild(row);

    if (!category || category.points === undefined) {
        rebalanceCategoryPoints();
    }
}

export function addRatingRow(rating = null, index = null) {
    const container = document.getElementById('rubric-ratings-container');
    if (!container) return;

    container.querySelector('.empty-rating-placeholder')?.remove();

    const existingRows = container.querySelectorAll('.rubric-rating-item');
    const nextIdx = index !== null ? index : existingRows.length;

    const rId = rating?.id || ('rate-' + Math.random().toString(36).substring(2, 7));
    const rName = rating?.name || '';
    const rScore = (rating && typeof rating.score !== 'undefined') ? parseFloat(rating.score) : 0;
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
                        <input type="number" step="any" min="0" class="rate-score-input w-24 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-black text-xs text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500" value="${rScore}" required>
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

    row.querySelector('.remove-rating-btn')?.addEventListener('click', () => {
        row.remove();
        rebalanceRubricPoints();
    });

    container.appendChild(row);

    if (!rating || rating.score === undefined) {
        rebalanceRubricPoints();
    }
}

export function openCriterionRubricModal(criterionId) {
    const modal = document.getElementById('criterion-rubric-modal');
    if (!modal) return;

    const critIdInput = document.getElementById('rubric-modal-crit-id');
    const titleInput = document.getElementById('rubric-modal-title-input');
    const pctInput = document.getElementById('rubric-modal-pct-input');
    const maxInput = document.getElementById('rubric-modal-max-input');
    const descInput = document.getElementById('rubric-modal-desc-input');
    const ratingsContainer = document.getElementById('rubric-ratings-container');
    const categoryContainer = document.getElementById('category-rows-container');
    const modalTitle = document.getElementById('rubric-modal-title');

    if (ratingsContainer) ratingsContainer.innerHTML = '';
    if (categoryContainer) categoryContainer.innerHTML = '';

    const criterion = cachedCriteria.find(c => String(c.id) === String(criterionId));
    let scoringType = 'rubric';
    let initialMax = 100;
    let rubricRatings = [];
    let scoringCategories = [];

    if (criterion) {
        modalTitle.textContent = `Edit Criterion: ${criterion.title}`;
        critIdInput.value = criterion.id;
        titleInput.value = criterion.title || '';
        pctInput.value = criterion.percentage || 0;
        scoringType = criterion.scoring_type === 'category' ? 'category' : 'rubric';
        initialMax = parseFloat(criterion.max_points) || 100;
        descInput.value = criterion.description || criterion.instructions || '';
        rubricRatings = Array.isArray(criterion.rubric_ratings) ? criterion.rubric_ratings : [];
        scoringCategories = Array.isArray(criterion.scoring_categories) ? criterion.scoring_categories : [];
    } else {
        modalTitle.textContent = 'Add Judging Criterion & Scoring Method';
        critIdInput.value = '';
        titleInput.value = '';
        pctInput.value = 0;
        scoringType = 'rubric';
        initialMax = 100;
        descInput.value = '';
        rubricRatings = [];
        scoringCategories = [];
    }

    if (maxInput) maxInput.value = initialMax;

    // Populate existing ratings if any
    rubricRatings.forEach((r, idx) => addRatingRow(r, idx));

    // Populate existing category rows if any
    scoringCategories.forEach((c, idx) => addCategoryRow(c, idx));

    // Toggle scoring type selection in modal (preserves existing points if editing)
    setModalScoringType(scoringType, Boolean(criterion));

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
    const scoringType = document.querySelector('input[name="modal_scoring_type"]:checked')?.value === 'category' ? 'category' : 'rubric';
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
    let maxPoints = parseFloat(document.getElementById('rubric-modal-max-input')?.value) || 100;
    let scoreStep = 0.5;
    let rubricRatings = [];
    let scoringCategories = [];

    if (scoringType === 'rubric') {
        // Criteria-Based Scoring
        const container = document.getElementById('rubric-ratings-container');
        const items = container?.querySelectorAll('.rubric-rating-item') || [];

        if (items.length < 2) {
            showToast('Ratings Incomplete', 'A criterion must have at least 2 predefined ratings before saving. Please add at least 2 ratings.', 'warning');
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

        maxPoints = parseFloat(document.getElementById('rubric-modal-max-input')?.value) || (highest > 0 ? highest : 100);
        minPoints = 0;
    } else {
        // Category-Based Scoring
        const container = document.getElementById('category-rows-container');
        const items = container?.querySelectorAll('.category-row-item') || [];

        if (items.length < 2) {
            showToast('Categories Incomplete', 'A criterion must have at least 2 score categories before saving. Please add at least 2 categories.', 'warning');
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

        maxPoints = parseFloat(document.getElementById('rubric-modal-max-input')?.value) || Math.round(sumPoints * 100) / 100;
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
