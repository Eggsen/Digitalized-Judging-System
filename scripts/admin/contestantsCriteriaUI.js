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

    // Open Weights Modal
    document.getElementById('openConfigureWeightsBtn')?.addEventListener('click', openAdjustWeightsModal);

    // Open Rubric Builder for New Criterion
    document.getElementById('openNewCriterionRubricBtn')?.addEventListener('click', () => openCriterionRubricModal());
    document.getElementById('openCustomRubricBuilderBtn')?.addEventListener('click', () => openCriterionRubricModal());

    // Form: Configure Weights Modal
    document.getElementById('saveWeightsBtn')?.addEventListener('click', handleSaveWeights);

    // Rubric Modal: Add Category Button
    document.getElementById('rubricAddCategoryBtn')?.addEventListener('click', () => {
        addCategoryRow();
    });
    document.getElementById('rubricAddIndicatorBtn')?.addEventListener('click', () => {
        addCategoryRow();
    });

    // Rubric Modal: Auto Distribute Points Button
    document.getElementById('rubricAutoDistributeBtn')?.addEventListener('click', autoDistributeCategoryPoints);

    // Rubric Modal: Max points input change listener (scale categories)
    document.getElementById('rubric-modal-max-input')?.addEventListener('input', handleRubricMaxPointsChange);

    // Form: Save Criterion & Rubric
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
        const categories = Array.isArray(cr.scoring_categories) && cr.scoring_categories.length > 0 
            ? cr.scoring_categories 
            : (Array.isArray(cr.sub_criteria) && cr.sub_criteria.length > 0 ? getDefaultScoringCategories(cr.max_points) : []);
        const catCount = categories.length;

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
                            ${catCount > 0 
                                ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0"><i class="fa-solid fa-layer-group me-1"></i>${catCount} Score Categories</span>` 
                                : '<span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">No Categories</span>'}
                        </div>
                        ${cr.description ? `<p class="text-xs text-slate-500 font-normal leading-relaxed line-clamp-2">${escapeHtml(cr.description)}</p>` : ''}
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    ${catCount > 0 ? `
                        <button type="button" class="toggle-rubric-view-btn px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] cursor-pointer transition-colors flex items-center gap-1" data-id="${cr.id}">
                            <i class="fa-solid fa-eye text-xs"></i> <span>View Rubric</span>
                        </button>
                    ` : ''}
                    <button class="edit-criterion-btn px-2.5 py-1.5 rounded-xl bg-slate-200/70 hover:bg-buksu-navy hover:text-buksu-gold text-slate-700 font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1" 
                        data-id="${cr.id}" 
                        title="Edit Criterion & Scoring Rubric">
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

            <!-- Collapsible Rubric Categories Matrix Preview -->
            ${catCount > 0 ? `
                <div id="rubric-preview-${cr.id}" class="hidden pt-3 border-t border-slate-200/70 space-y-2.5 text-xs">
                    <div class="flex items-center justify-between text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                        <span>Scoring Rubric (${catCount} categories)</span>
                        <span class="text-indigo-600 font-bold normal-case">Scores scale to ${cr.max_points} pts</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${Math.min(catCount, 4)} gap-2">
                        ${categories.map(cat => `
                            <div class="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1 shadow-2xs">
                                <div class="flex items-center justify-between gap-1">
                                    <span class="font-extrabold text-slate-800 text-xs truncate">${escapeHtml(cat.name)}</span>
                                    <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                                        Max: ${cat.points} pts
                                    </span>
                                </div>
                                ${cat.description ? `<p class="text-[11px] text-slate-500 font-normal leading-tight mt-1 line-clamp-3">${escapeHtml(cat.description)}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
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
                if (span) span.textContent = preview.classList.contains('hidden') ? 'View Rubric' : 'Hide Rubric';
            }
        });
    });

    // Edit criterion & rubric modal
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

export function openCriterionRubricModal(criterionId) {
    const modal = document.getElementById('criterion-rubric-modal');
    if (!modal) return;

    const critIdInput = document.getElementById('rubric-modal-crit-id');
    const titleInput = document.getElementById('rubric-modal-title-input');
    const pctInput = document.getElementById('rubric-modal-pct-input');
    const maxInput = document.getElementById('rubric-modal-max-input');
    const descInput = document.getElementById('rubric-modal-desc-input');
    const container = document.getElementById('rubric-categories-container') || document.getElementById('rubric-subcriteria-container');
    const modalTitle = document.getElementById('rubric-modal-title');
    const maxBadge = document.getElementById('rubric-max-points-badge');

    if (!container) return;
    container.innerHTML = '';

    const criterion = cachedCriteria.find(c => String(c.id) === String(criterionId));
    let initialMax = 50;
    let categories = [];

    if (criterion) {
        modalTitle.textContent = `Edit Rubric: ${criterion.title}`;
        critIdInput.value = criterion.id;
        titleInput.value = criterion.title || '';
        pctInput.value = criterion.percentage || 0;
        initialMax = parseInt(criterion.max_points) || 50;
        maxInput.value = initialMax;
        descInput.value = criterion.description || '';

        categories = (Array.isArray(criterion.scoring_categories) && criterion.scoring_categories.length > 0)
            ? criterion.scoring_categories
            : getDefaultScoringCategories(initialMax);
    } else {
        modalTitle.textContent = 'Add New Judging Criterion & Rubric';
        critIdInput.value = '';
        titleInput.value = '';
        pctInput.value = 0;
        initialMax = 50;
        maxInput.value = initialMax;
        descInput.value = '';

        categories = getDefaultScoringCategories(initialMax);
    }

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

    maxInput.dataset.previousMax = initialMax;
    if (maxBadge) maxBadge.textContent = `${initialMax} pts`;

    categories.forEach((cat, idx) => addCategoryRow(cat, initialMax, idx));

    modal.classList.remove('hidden');
}

export function getDefaultScoringCategories(maxPoints = 40) {
    const max = parseFloat(maxPoints) || 40;
    const count = 4;
    const perCat = roundScore(max / count);
    return [
        {
            id: 'cat-' + Math.random().toString(36).substring(2, 7),
            name: 'Difficulty & Variety',
            description: 'Complexity, variety of movements, and creative staging variations.',
            points: perCat
        },
        {
            id: 'cat-' + Math.random().toString(36).substring(2, 7),
            name: 'Synchronization & Timing',
            description: 'Precision, unison among dancers, and micro-timing accuracy.',
            points: perCat
        },
        {
            id: 'cat-' + Math.random().toString(36).substring(2, 7),
            name: 'Technique & Form',
            description: 'Body control, posture, extension, lines, and movement cleanliness.',
            points: perCat
        },
        {
            id: 'cat-' + Math.random().toString(36).substring(2, 7),
            name: 'Transitions & Staging',
            description: 'Fluidity between routine sections, formations, and spatial coverage.',
            points: perCat
        }
    ];
}

function roundScore(val) {
    return Math.round(val * 10) / 10;
}

function handleRubricMaxPointsChange() {
    const maxInput = document.getElementById('rubric-modal-max-input');
    const maxBadge = document.getElementById('rubric-max-points-badge');
    if (!maxInput) return;

    const newMax = parseFloat(maxInput.value) || 1;
    const prevMax = parseFloat(maxInput.dataset.previousMax) || newMax;
    maxInput.dataset.previousMax = newMax;

    if (maxBadge) maxBadge.textContent = `${newMax} pts`;

    const container = document.getElementById('rubric-categories-container') || document.getElementById('rubric-subcriteria-container');
    if (!container) return;

    const rows = container.querySelectorAll('.rubric-category-item');
    const ratio = prevMax > 0 ? (newMax / prevMax) : 1;

    rows.forEach(row => {
        const pointsInput = row.querySelector('.cat-points-input');
        if (pointsInput) {
            const currentVal = parseFloat(pointsInput.value) || 0;
            const scaled = Math.min(newMax, roundScore(currentVal * ratio));
            pointsInput.value = scaled;
            pointsInput.max = newMax;
        }
        updateCategoryRowIndicators(row, newMax);
    });

    updateRubricCategoriesSum();
}

function autoDistributeCategoryPoints() {
    const maxInput = document.getElementById('rubric-modal-max-input');
    const container = document.getElementById('rubric-categories-container') || document.getElementById('rubric-subcriteria-container');
    if (!maxInput || !container) return;

    const max = parseFloat(maxInput.value) || 50;
    const rows = container.querySelectorAll('.rubric-category-item');
    const count = rows.length;
    if (count === 0) return;

    const perCategory = roundScore(max / count);

    rows.forEach((row) => {
        const pointsInput = row.querySelector('.cat-points-input');
        if (pointsInput) {
            pointsInput.value = perCategory;
            pointsInput.max = max;
        }
        updateCategoryRowIndicators(row, max);
    });

    updateRubricCategoriesSum();
    showToast(`Divided ${max} max points evenly: ${perCategory} pts per category.`, 'info');
}

function addCategoryRow(cat = null, maxPoints = null, index = null) {
    const container = document.getElementById('rubric-categories-container') || document.getElementById('rubric-subcriteria-container');
    const maxInput = document.getElementById('rubric-modal-max-input');
    if (!container) return;

    const max = maxPoints !== null ? maxPoints : (parseFloat(maxInput?.value) || 50);
    const existingRows = container.querySelectorAll('.rubric-category-item');
    const nextIdx = index !== null ? index : existingRows.length;

    let defaultPts = roundScore(max / Math.max(1, existingRows.length + 1));
    if (cat && typeof cat.points !== 'undefined') {
        defaultPts = parseFloat(cat.points);
    }

    const catId = cat?.id || ('cat-' + Math.random().toString(36).substring(2, 7));
    const catName = cat?.name || '';
    const catDesc = cat?.description || '';

    const row = document.createElement('div');
    row.className = 'rubric-category-item p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3 transition-all hover:border-slate-300 shadow-2xs';
    row.dataset.catId = catId;

    row.innerHTML = `
        <div class="flex items-center justify-between gap-3 border-b border-slate-200/70 pb-2.5">
            <div class="flex items-center gap-2.5 flex-1 flex-wrap sm:flex-nowrap">
                <span class="category-index-badge w-7 h-7 rounded-lg bg-buksu-navy text-buksu-gold flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                    #${nextIdx + 1}
                </span>
                <div class="flex-1 min-w-[180px]">
                    <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-0.5">Category Name / Title</label>
                    <input type="text" class="cat-name-input w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Difficulty, Form, Synchronization..." value="${escapeHtml(catName)}" required>
                </div>
                <div class="shrink-0">
                    <label class="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-0.5">Max Score (pts)</label>
                    <div class="flex items-center gap-1.5">
                        <input type="number" step="0.5" min="0" max="${max}" class="cat-points-input w-20 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-black text-xs text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" value="${defaultPts}">
                        <span class="text-xs font-bold text-slate-500 whitespace-nowrap">
                            pts max
                        </span>
                        <span class="cat-ratio-badge px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 whitespace-nowrap">
                            ${Math.round((defaultPts / max) * 100)}%
                        </span>
                    </div>
                </div>
            </div>
            <button type="button" class="remove-category-btn px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl text-xs cursor-pointer font-bold flex items-center gap-1 transition-colors" title="Remove Category">
                <i class="fa-solid fa-trash-can"></i> <span class="hidden sm:inline">Remove</span>
            </button>
        </div>

        <div>
            <label class="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">Scoring Description &amp; Guidelines</label>
            <textarea class="cat-desc-input w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-normal leading-relaxed" rows="2" placeholder="Describe the evaluation guidelines, criteria, and observable behavior required for this category...">${escapeHtml(catDesc)}</textarea>
        </div>
    `;

    // Bind points input change to update ratio badge and sum
    const pointsInput = row.querySelector('.cat-points-input');
    pointsInput?.addEventListener('input', () => {
        updateCategoryRowIndicators(row, parseFloat(maxInput?.value) || max);
    });

    // Bind remove button
    row.querySelector('.remove-category-btn')?.addEventListener('click', () => {
        const remaining = container.querySelectorAll('.rubric-category-item');
        if (remaining.length <= 1) {
            showToast('A criterion must have at least one scoring category.', 'warning');
            return;
        }
        row.remove();
        container.querySelectorAll('.rubric-category-item').forEach((item, idx) => {
            const badge = item.querySelector('.category-index-badge');
            if (badge) badge.textContent = `#${idx + 1}`;
        });
        updateRubricCategoriesSum();
    });

    container.appendChild(row);
    updateRubricCategoriesSum();
}

function updateCategoryRowIndicators(row, maxPoints) {
    const pointsInput = row.querySelector('.cat-points-input');
    const ratioBadge = row.querySelector('.cat-ratio-badge');

    const pts = parseFloat(pointsInput?.value) || 0;
    const max = parseFloat(maxPoints) || 1;
    const pct = Math.round((pts / max) * 100);

    if (ratioBadge) {
        ratioBadge.textContent = `${pct}%`;
    }
    updateRubricCategoriesSum();
}

function updateRubricCategoriesSum() {
    const maxInput = document.getElementById('rubric-modal-max-input');
    const container = document.getElementById('rubric-categories-container') || document.getElementById('rubric-subcriteria-container');
    const sumIndicator = document.getElementById('rubric-categories-sum-indicator');
    if (!maxInput || !container) return;

    const max = parseFloat(maxInput.value) || 50;
    let sum = 0;
    container.querySelectorAll('.cat-points-input').forEach(inp => {
        sum += parseFloat(inp.value) || 0;
    });
    sum = roundScore(sum);

    if (sumIndicator) {
        if (Math.abs(sum - max) < 0.05) {
            sumIndicator.className = 'text-[11px] font-black px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200';
            sumIndicator.innerHTML = `<i class="fa-solid fa-check me-1"></i> Sum: ${sum} / ${max} pts`;
        } else {
            sumIndicator.className = 'text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200';
            sumIndicator.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-1"></i> Sum: ${sum} / ${max} pts (Diff: ${(max - sum).toFixed(1)})`;
        }
    }
}

async function handleSaveRubricCriterion(e) {
    e.preventDefault();
    if (!currentEventId) return;

    const critId = document.getElementById('rubric-modal-crit-id')?.value;
    const title = document.getElementById('rubric-modal-title-input')?.value.trim();
    const pct = parseInt(document.getElementById('rubric-modal-pct-input')?.value) || 0;
    const max = parseInt(document.getElementById('rubric-modal-max-input')?.value) || 50;
    const desc = document.getElementById('rubric-modal-desc-input')?.value.trim();
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

    const container = document.getElementById('rubric-categories-container') || document.getElementById('rubric-subcriteria-container');
    const items = container?.querySelectorAll('.rubric-category-item') || [];

    if (items.length === 0) {
        showToast('Please configure at least one score category.', 'warning');
        return;
    }

    const scoringCategories = [];
    let hasInvalidName = false;

    items.forEach((item, idx) => {
        const name = item.querySelector('.cat-name-input')?.value.trim();
        if (!name) {
            hasInvalidName = true;
            return;
        }
        const pts = parseFloat(item.querySelector('.cat-points-input')?.value);
        const catDesc = item.querySelector('.cat-desc-input')?.value.trim() || '';
        const id = item.dataset.catId || ('cat-' + (idx + 1));

        scoringCategories.push({
            id,
            name,
            points: isNaN(pts) ? 0 : Math.min(max, Math.max(0, pts)),
            description: catDesc
        });
    });

    if (hasInvalidName) {
        showToast('Please provide a name for each scoring category.', 'warning');
        return;
    }

    if (saveBtn) saveBtn.disabled = true;

    let res;
    if (critId) {
        res = await editCriterion({
            id: critId,
            title,
            description: desc,
            max_points: max,
            percentage: pct,
            scoring_categories: scoringCategories
        });
    } else {
        res = await createCriterion({
            event_id: currentEventId,
            title,
            description: desc,
            max_points: max,
            percentage: pct,
            scoring_categories: scoringCategories
        });
    }

    if (saveBtn) saveBtn.disabled = false;

    if (res.success) {
        showToast(critId ? 'Criterion Updated!' : 'Criterion Created!', res.message || 'Judging criterion and scoring rubric saved.', 'create');
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
    const pctInput = document.getElementById('new-criterion-pct');
    const btn = document.getElementById('addCriterionBtn');

    const title = titleInput?.value.trim();
    const description = descInput?.value.trim();
    const maxPoints = parseInt(maxInput?.value) || 50;
    const percentage = parseInt(pctInput?.value) || 0;

    if (!title) {
        showToast('Please provide a criterion title.', 'warning');
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

    const defaultCategories = getDefaultScoringCategories(maxPoints);

    const res = await createCriterion({
        event_id: currentEventId,
        title,
        description,
        max_points: maxPoints,
        percentage,
        scoring_categories: defaultCategories
    });

    if (btn) btn.disabled = false;

    if (res.success) {
        showToast('Criterion Added!', `Criterion '${title}' added with custom scoring rubric!`, 'create');
        if (titleInput) titleInput.value = '';
        if (descInput) descInput.value = '';
        if (pctInput) pctInput.value = '';
        document.getElementById('manage-event-setup-modal')?.classList.add('hidden');
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
