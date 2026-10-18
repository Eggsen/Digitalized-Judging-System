import { 
    getContestants, 
    createContestant, 
    editContestant, 
    deleteContestant,
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

    // Form: Create Criterion
    document.getElementById('createCriterionForm')?.addEventListener('submit', handleAddCriterion);

    // Open Weights Modal
    document.getElementById('openConfigureWeightsBtn')?.addEventListener('click', openAdjustWeightsModal);

    // Form: Configure Weights Modal
    document.getElementById('saveWeightsBtn')?.addEventListener('click', handleSaveWeights);

    // Close buttons for manage-event-setup-modal and adjust-weights-modal
    document.querySelectorAll('#manage-event-setup-modal .close-modal-btn, #adjust-weights-modal .close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.classList.add('hidden');
            document.getElementById('adjust-weights-modal')?.classList.add('hidden');
        });
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    const weightsModal = document.getElementById('adjust-weights-modal');
    weightsModal?.addEventListener('click', (e) => {
        if (e.target === weightsModal) weightsModal.classList.add('hidden');
    });
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
                <span class="text-[10px] text-slate-400 font-medium">Max Points: ${cr.max_points} pts</span>
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

    container.innerHTML = cachedContestants.map(c => `
        <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 hover:bg-white hover:border-slate-300 transition-all">
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="w-10 h-10 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center font-extrabold text-sm shrink-0 border border-buksu-gold/30 shadow-xs">
                    #${c.contestant_number}
                </div>
                <div class="overflow-hidden">
                    <h5 class="font-extrabold text-slate-800 text-xs truncate">${escapeHtml(c.name)}</h5>
                    <p class="text-[11px] text-slate-500 font-medium truncate">${escapeHtml(c.department_or_org || 'Independent / General')}</p>
                    ${c.description ? `<p class="text-[10px] text-slate-400 line-clamp-1 italic">${escapeHtml(c.description)}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button class="edit-contestant-btn p-2 rounded-xl text-slate-500 hover:text-buksu-navy hover:bg-slate-100 transition-colors cursor-pointer text-xs" 
                    data-id="${c.id}" 
                    data-num="${c.contestant_number}" 
                    data-name="${escapeHtml(c.name)}" 
                    data-dept="${escapeHtml(c.department_or_org)}" 
                    data-desc="${escapeHtml(c.description)}"
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
    `).join('');

    bindContestantRowActions();
}

function bindContestantRowActions() {
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
                    showToast('Contestant updated successfully!', 'success');
                    loadContestantsList();
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
                    showToast('Contestant removed.', 'success');
                    loadContestantsList();
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
    const btn = document.getElementById('addContestantBtn');

    const contestantNumber = parseInt(numInput?.value);
    const name = nameInput?.value.trim();
    const departmentOrOrg = deptInput?.value.trim();
    const description = descInput?.value.trim();

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
        description
    });

    if (btn) btn.disabled = false;

    if (res.success) {
        showToast(res.message, 'success');
        if (nameInput) nameInput.value = '';
        if (deptInput) deptInput.value = '';
        if (descInput) descInput.value = '';
        loadContestantsList();
    } else {
        showToast(res.message || 'Failed to add contestant.', 'error');
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

    // Update weight indicator
    if (weightBadge) {
        weightBadge.textContent = `${totalWeight}% / 100% Total`;
        if (totalWeight === 100) {
            weightBadge.className = 'px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300';
        } else if (totalWeight > 100) {
            weightBadge.className = 'px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300';
        } else {
            weightBadge.className = 'px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300';
        }
    }

    if (weightBar) {
        weightBar.style.width = `${Math.min(totalWeight, 100)}%`;
        weightBar.className = `h-full rounded-full transition-all duration-300 ${totalWeight === 100 ? 'bg-emerald-500' : totalWeight > 100 ? 'bg-rose-500' : 'bg-amber-500'}`;
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

    container.innerHTML = cachedCriteria.map(cr => `
        <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 hover:bg-white hover:border-slate-300 transition-all">
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="w-12 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex flex-col items-center justify-center font-extrabold text-xs shrink-0 border border-indigo-200">
                    <span>${cr.percentage}%</span>
                    <span class="text-[9px] font-normal text-slate-400">weight</span>
                </div>
                <div class="overflow-hidden">
                    <h5 class="font-extrabold text-slate-800 text-xs truncate flex items-center gap-2">
                        ${escapeHtml(cr.title)}
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200/60 text-slate-600">Max: ${cr.max_points} pts</span>
                    </h5>
                    ${cr.description ? `<p class="text-[11px] text-slate-500 font-normal line-clamp-1 mt-0.5">${escapeHtml(cr.description)}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button class="edit-criterion-btn p-2 rounded-xl text-slate-500 hover:text-buksu-navy hover:bg-slate-100 transition-colors cursor-pointer text-xs" 
                    data-id="${cr.id}" 
                    data-title="${escapeHtml(cr.title)}" 
                    data-desc="${escapeHtml(cr.description)}" 
                    data-max="${cr.max_points}" 
                    data-pct="${cr.percentage}"
                    title="Edit Criterion">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="delete-criterion-btn p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer text-xs" 
                    data-id="${cr.id}" 
                    data-title="${escapeHtml(cr.title)}"
                    title="Delete Criterion">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>
    `).join('');

    bindCriteriaRowActions();
}

function bindCriteriaRowActions() {
    // Edit criterion
    document.querySelectorAll('.edit-criterion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const currentTitle = btn.dataset.title;
            const currentDesc = btn.dataset.desc;
            const currentMax = btn.dataset.max;
            const currentPct = btn.dataset.pct;

            const newTitle = prompt(`Edit Criterion Title:`, currentTitle);
            if (newTitle === null || !newTitle.trim()) return;
            const newDesc = prompt(`Edit Description:`, currentDesc);
            if (newDesc === null) return;
            const newMax = prompt(`Edit Maximum Points:`, currentMax);
            if (newMax === null) return;
            const newPct = prompt(`Edit Weight / Percentage (%):`, currentPct);
            if (newPct === null) return;

            (async () => {
                const res = await editCriterion({
                    id,
                    title: newTitle.trim(),
                    description: newDesc.trim(),
                    max_points: parseInt(newMax) || 100,
                    percentage: parseInt(newPct) || 0
                });

                if (res.success) {
                    showToast('Criterion updated successfully!', 'success');
                    loadCriteriaList();
                } else {
                    showToast(res.message || 'Failed to update criterion.', 'error');
                }
            })();
        });
    });

    // Delete criterion
    document.querySelectorAll('.delete-criterion-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const title = btn.dataset.title;

            if (confirm(`Are you sure you want to remove criterion "${title}"?`)) {
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
    const maxPoints = parseInt(maxInput?.value) || 100;
    const percentage = parseInt(pctInput?.value) || 0;

    if (!title) {
        showToast('Please provide a criterion title.', 'warning');
        return;
    }

    if (btn) btn.disabled = true;

    const res = await createCriterion({
        event_id: currentEventId,
        title,
        description,
        max_points: maxPoints,
        percentage
    });

    if (btn) btn.disabled = false;

    if (res.success) {
        showToast(res.message, 'success');
        if (titleInput) titleInput.value = '';
        if (descInput) descInput.value = '';
        if (pctInput) pctInput.value = '';
        loadCriteriaList();
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

    const res = await updateCriteriaWeights(currentEventId, weights);
    if (res.success) {
        showToast(res.message, 'success');
        document.getElementById('adjust-weights-modal')?.classList.add('hidden');
        loadCriteriaList();
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
