import { 
    getSettings, 
    saveSettings, 
    exportBackup, 
    clearLogs, 
    resetSettingsDefaults,
    requestSecurityChange,
    confirmSecurityChange,
    resendSecurityCode,
    verifyAdminPin,
    saveApiKeys
} from "/scripts/admin/settingsAPI.js";
import { showToast, formatDateTime } from "/scripts/utils/uiUtils.js";

let cachedSettings = null;
let apiKeysUnlockToken = null;
let cachedMaskedKeys = {};

export async function loadSystemSettings() {
    const loadingEl = document.getElementById('settings-loading-state');
    const contentEl = document.getElementById('settings-content-wrapper');

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (contentEl) contentEl.classList.add('opacity-40', 'pointer-events-none');

    const res = await getSettings();

    if (loadingEl) loadingEl.classList.add('hidden');
    if (contentEl) contentEl.classList.remove('opacity-40', 'pointer-events-none');

    if (!res.success) {
        showToast("Error", res.message || "Could not load settings.", "error");
        return;
    }

    cachedSettings = res.settings;
    populateSettingsForm(res.settings);
    populateDiagnostics(res.diagnostics);
    if (res.api_keys) {
        populateApiKeysForm(res.api_keys);
    }
}

function populateSettingsForm(settings) {
    if (!settings) return;

    const branding = settings.branding || {};
    const judging = settings.judging || {};
    const backup = settings.backup || {};

    // Branding fields
    const instName = document.getElementById('setting-institution-name');
    const campusUnit = document.getElementById('setting-campus-unit');
    const sysTitle = document.getElementById('setting-system-title');
    const headerSub = document.getElementById('setting-header-subtitle');
    const showWatermark = document.getElementById('setting-show-watermark');

    if (instName) instName.value = branding.institutionName || 'Bukidnon State University';
    if (campusUnit) campusUnit.value = branding.campusUnit || '';
    if (sysTitle) sysTitle.value = branding.systemTitle || 'JudgeTab - Digitalized Judging System';
    if (headerSub) headerSub.value = branding.headerSubtitle || '';
    if (showWatermark) showWatermark.checked = (branding.showWatermark !== false);

    // Signatories
    const signatories = Array.isArray(branding.signatories) ? branding.signatories : [];
    for (let i = 0; i < 3; i++) {
        const sig = signatories[i] || { name: '', title: '' };
        const nameInput = document.getElementById(`setting-sig-name-${i}`);
        const titleInput = document.getElementById(`setting-sig-title-${i}`);
        if (nameInput) nameInput.value = sig.name || '';
        if (titleInput) titleInput.value = sig.title || '';
    }

    // Judging rules fields
    const precisionSelect = document.getElementById('setting-decimal-precision');
    const tabMethodSelect = document.getElementById('setting-tabulation-method');
    const tieBreakerSelect = document.getElementById('setting-tie-breaker');
    const unlockPolicySelect = document.getElementById('setting-unlock-policy');
    const blindJudgingCheckbox = document.getElementById('setting-blind-judging');

    if (precisionSelect) precisionSelect.value = String(judging.decimalPrecision || 2);
    if (tabMethodSelect) tabMethodSelect.value = judging.tabulationMethod || 'standard_average';
    if (tieBreakerSelect) tieBreakerSelect.value = judging.tieBreakerRule || 'highest_weight_criterion';
    if (unlockPolicySelect) unlockPolicySelect.value = judging.unlockPolicy || 'admin_approval';
    if (blindJudgingCheckbox) blindJudgingCheckbox.checked = (judging.blindJudging !== false);

    // Backup timestamp
    const lastBackupEl = document.getElementById('setting-last-backup-badge');
    if (lastBackupEl) {
        lastBackupEl.textContent = backup.lastBackupAt ? `Last Backup: ${formatDateTime(backup.lastBackupAt)}` : 'No backups recorded yet';
    }

    // Security controls
    const security = settings.security || {};
    const googleAuthToggle = document.getElementById('setting-toggle-google-auth');
    const recaptchaToggle = document.getElementById('setting-toggle-recaptcha');
    const emailToggle = document.getElementById('setting-toggle-email');
    const qrcodeToggle = document.getElementById('setting-toggle-qrcode');
    const cloudinaryToggle = document.getElementById('setting-toggle-cloudinary');
    const websocketToggle = document.getElementById('setting-toggle-websocket');

    if (googleAuthToggle) {
        googleAuthToggle.checked = (security.googleAuthEnabled !== false);
        updateSecurityToggleBadge('google-auth-status-badge', googleAuthToggle.checked);
    }

    if (recaptchaToggle) {
        recaptchaToggle.checked = (security.recaptchaEnabled !== false);
        updateSecurityToggleBadge('recaptcha-status-badge', recaptchaToggle.checked);
    }

    if (emailToggle) {
        emailToggle.checked = (security.emailServiceEnabled !== false);
        updateSecurityToggleBadge('email-status-badge', emailToggle.checked);
    }

    if (qrcodeToggle) {
        qrcodeToggle.checked = (security.qrCodeEnabled !== false);
        updateSecurityToggleBadge('qrcode-status-badge', qrcodeToggle.checked);
    }

    if (cloudinaryToggle) {
        cloudinaryToggle.checked = (security.cloudinaryEnabled !== false);
        updateSecurityToggleBadge('cloudinary-status-badge', cloudinaryToggle.checked);
    }

    if (websocketToggle) {
        websocketToggle.checked = (security.websocketEnabled !== false);
        updateSecurityToggleBadge('websocket-status-badge', websocketToggle.checked);
    }

    // Update live banner preview & logo previews
    updateBrandingPreview(branding);
    updateLogoPreviewUI(branding.logoUrl);
}

function updateLogoPreviewUI(logoUrl) {
    const previewImg = document.getElementById('setting-logo-preview-img');
    const bannerPreviewImg = document.getElementById('setting-preview-logo-img');
    const badge = document.getElementById('setting-logo-storage-badge');
    const hiddenInput = document.getElementById('setting-logo-url-hidden');

    const defaultLogo = '/assets/logo/DJS Logo.png';
    const effectiveUrl = (logoUrl && logoUrl.trim()) ? logoUrl.trim() : defaultLogo;

    if (previewImg) previewImg.src = effectiveUrl;
    if (bannerPreviewImg) bannerPreviewImg.src = effectiveUrl;
    if (hiddenInput) {
        hiddenInput.value = (logoUrl && logoUrl.trim() && logoUrl !== defaultLogo) ? logoUrl.trim() : '';
    }

    if (badge) {
        if (!logoUrl || logoUrl === defaultLogo) {
            badge.textContent = 'Default Logo';
            badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700';
        } else if (logoUrl.includes('cloudinary.com')) {
            badge.textContent = 'Cloudinary CDN';
            badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300';
        } else {
            badge.textContent = 'Local Server Storage';
            badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300';
        }
    }
}

function updateBrandingPreview(branding) {
    const previewInst = document.getElementById('setting-preview-inst');
    const previewUnit = document.getElementById('setting-preview-unit');
    const previewTitle = document.getElementById('setting-preview-title');

    if (previewInst) previewInst.textContent = branding.institutionName || 'Bukidnon State University';
    if (previewUnit) previewUnit.textContent = branding.campusUnit || 'Malaybalay City, Bukidnon';
    if (previewTitle) previewTitle.textContent = branding.systemTitle || 'JudgeTab';
}

function populateDiagnostics(diag) {
    if (!diag) return;

    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setTxt('diag-db-status', diag.connection || 'Connected');
    setTxt('diag-db-name', diag.database || 'djs_db');
    setTxt('diag-events-count', diag.counts?.events ?? 0);
    setTxt('diag-contestants-count', diag.counts?.contestants ?? 0);
    setTxt('diag-criteria-count', diag.counts?.criteria ?? 0);
    setTxt('diag-scores-count', diag.counts?.scores ?? 0);
    setTxt('diag-users-count', diag.counts?.users ?? 0);
    setTxt('diag-logs-count', diag.counts?.logs ?? 0);
    setTxt('diag-server-time', diag.serverTime || new Date().toLocaleString());
    setTxt('diag-php-version', diag.nodeVersion ? `Node.js ${diag.nodeVersion}` : 'Node.js Runtime');
    setTxt('diag-system-version', diag.systemVersion || 'v2.4');
}

export function initSettingsPanel() {
    initSubTabs();
    initSettingsForm();
    initLogoUploader();
    initLogoLibraryModal();
    initSecuritySettings();
    initBackupAndMaintenance();
    initApiKeysSettings();
    loadSystemSettings();
}

export function activateSettingsSubtab(target) {
    const subTabBtns = document.querySelectorAll('.settings-subtab-btn');
    const subTabContents = document.querySelectorAll('.settings-subtab-content');

    subTabBtns.forEach(b => {
        const isMatch = b.dataset.subtab === target;
        const icon = b.querySelector('i');
        if (isMatch) {
            b.className = 'settings-subtab-btn px-4 py-2 text-xs font-bold rounded-xl bg-buksu-navy text-white shadow-xs transition-all cursor-pointer border border-buksu-gold/30';
            if (icon) {
                icon.classList.remove('text-slate-400', 'text-slate-500', 'text-emerald-500', 'text-amber-500');
                icon.classList.add('text-buksu-gold');
            }
        } else {
            b.className = 'settings-subtab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:text-buksu-navy hover:bg-slate-100 transition-all cursor-pointer border border-transparent';
            if (icon) {
                icon.classList.remove('text-buksu-gold', 'text-emerald-500', 'text-amber-500');
                icon.classList.add('text-slate-400');
            }
        }
    });

    subTabContents.forEach(c => c.classList.add('hidden'));
    const activeSection = document.getElementById(target);
    if (activeSection) {
        activeSection.classList.remove('hidden');
        activeSection.classList.add('animate-fade-in');
    }
}

function initSubTabs() {
    const subTabBtns = document.querySelectorAll('.settings-subtab-btn');

    subTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.subtab;
            if (target) activateSettingsSubtab(target);
        });
    });
}

function initSettingsForm() {
    const form = document.getElementById('systemSettingsForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const saveBtn = document.getElementById('saveSettingsBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1.5"></i> Saving...';
        }

        const signatories = [];
        for (let i = 0; i < 3; i++) {
            const name = document.getElementById(`setting-sig-name-${i}`)?.value.trim() || '';
            const title = document.getElementById(`setting-sig-title-${i}`)?.value.trim() || '';
            if (name || title) {
                signatories.push({ name, title });
            }
        }

        const hiddenLogoInput = document.getElementById('setting-logo-url-hidden');
        const activeLogoUrl = (hiddenLogoInput && hiddenLogoInput.value.trim() !== '')
            ? hiddenLogoInput.value.trim()
            : (cachedSettings?.branding?.logoUrl || null);

        const payload = {
            branding: {
                institutionName: document.getElementById('setting-institution-name')?.value.trim() || 'Bukidnon State University',
                campusUnit: document.getElementById('setting-campus-unit')?.value.trim() || '',
                systemTitle: document.getElementById('setting-system-title')?.value.trim() || 'JudgeTab - Digitalized Judging System',
                headerSubtitle: document.getElementById('setting-header-subtitle')?.value.trim() || '',
                logoUrl: activeLogoUrl,
                showWatermark: document.getElementById('setting-show-watermark')?.checked ?? true,
                signatories: signatories
            },
            judging: {
                decimalPrecision: parseInt(document.getElementById('setting-decimal-precision')?.value || '2', 10),
                tabulationMethod: document.getElementById('setting-tabulation-method')?.value || 'standard_average',
                tieBreakerRule: document.getElementById('setting-tie-breaker')?.value || 'highest_weight_criterion',
                unlockPolicy: document.getElementById('setting-unlock-policy')?.value || 'admin_approval',
                blindJudging: document.getElementById('setting-blind-judging')?.checked ?? true
            }
        };

        const res = await saveSettings(payload);

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1.5 text-buksu-gold"></i> Save All Settings';
        }

        if (res.success) {
            showToast("Settings Saved", "System configuration and branding updated successfully.", "create");
            if (res.settings) {
                cachedSettings = res.settings;
                populateSettingsForm(res.settings);
            }
        } else {
            showToast("Save Failed", res.message || "Failed to update settings.", "error");
        }
    });

    // Real-time branding preview inputs
    ['setting-institution-name', 'setting-campus-unit', 'setting-system-title'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            updateBrandingPreview({
                institutionName: document.getElementById('setting-institution-name')?.value,
                campusUnit: document.getElementById('setting-campus-unit')?.value,
                systemTitle: document.getElementById('setting-system-title')?.value
            });
        });
    });

    // Refresh settings button
    document.getElementById('refreshSettingsBtn')?.addEventListener('click', loadSystemSettings);
}

function initLogoUploader() {
    const triggerBtn = document.getElementById('triggerLogoUploadBtn');
    const fileInput = document.getElementById('setting-logo-file-input');
    const resetBtn = document.getElementById('resetLogoDefaultBtn');

    triggerBtn?.addEventListener('click', () => {
        fileInput?.click();
    });

    fileInput?.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;

        const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
            showToast("Invalid File", "Only PNG, JPG, WebP, or SVG images are supported.", "error");
            fileInput.value = '';
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showToast("File Too Large", "Maximum image size is 5MB.", "error");
            fileInput.value = '';
            return;
        }

        const originalBtnHtml = triggerBtn.innerHTML;
        triggerBtn.disabled = true;
        triggerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-buksu-gold"></i> Uploading...';

        const formData = new FormData();
        formData.append('logo_file', file);

        try {
            const resp = await fetch('/api/settings/upload-logo', {
                method: 'POST',
                body: formData
            });
            const data = await resp.json();

            const newLogoUrl = data.logoUrl || data.logo_url;
            if (data.success && newLogoUrl) {
                if (!cachedSettings) cachedSettings = {};
                if (!cachedSettings.branding) cachedSettings.branding = {};
                cachedSettings.branding.logoUrl = newLogoUrl;
                updateLogoPreviewUI(newLogoUrl);
                const storageMethod = data.storage === 'cloudinary' ? 'Cloudinary CDN' : 'Local Storage';
                showToast("Logo Uploaded", `Institution logo saved via ${storageMethod}.`, "create");

                const modal = document.getElementById('logo-library-modal');
                if (modal && !modal.classList.contains('hidden')) {
                    loadLogoLibrary();
                }
            } else {
                showToast("Upload Failed", data.message || "Failed to upload institution logo.", "error");
            }
        } catch (err) {
            console.error("Logo upload error:", err);
            showToast("Network Error", "Could not complete logo upload.", "error");
        } finally {
            triggerBtn.disabled = false;
            triggerBtn.innerHTML = originalBtnHtml;
            fileInput.value = '';
        }
    });

    resetBtn?.addEventListener('click', async () => {
        if (!confirm("Are you sure you want to reset the institution logo to the default BukSU seal?")) {
            return;
        }

        const originalBtnHtml = resetBtn.innerHTML;
        resetBtn.disabled = true;
        resetBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[11px]"></i> Resetting...';

        const formData = new FormData();
        formData.append('action', 'reset_default_logo');

        try {
            const resp = await fetch('/api/settings/upload-logo', {
                method: 'POST',
                body: formData
            });
            const data = await resp.json();

            if (data.success) {
                if (!cachedSettings) cachedSettings = {};
                if (!cachedSettings.branding) cachedSettings.branding = {};
                cachedSettings.branding.logoUrl = null;
                updateLogoPreviewUI(null);
                showToast("Logo Reset", "Reverted to default institution seal.", "archive");

                const modal = document.getElementById('logo-library-modal');
                if (modal && !modal.classList.contains('hidden')) {
                    loadLogoLibrary();
                }
            } else {
                showToast("Reset Failed", data.message || "Could not reset logo.", "error");
            }
        } catch (err) {
            console.error("Logo reset error:", err);
            showToast("Network Error", "Could not complete logo reset.", "error");
        } finally {
            resetBtn.disabled = false;
            resetBtn.innerHTML = originalBtnHtml;
        }
    });
}

function initLogoLibraryModal() {
    const modal = document.getElementById('logo-library-modal');
    const openBtn = document.getElementById('openLogoLibraryBtn');
    const closeBtn = document.getElementById('closeLogoLibraryModalBtn');
    const closeFooterBtn = document.getElementById('closeLogoLibraryModalFooterBtn');
    const refreshBtn = document.getElementById('refreshLogoLibraryBtn');
    const uploadBtn = document.getElementById('uploadFromLibraryModalBtn');
    const fileInput = document.getElementById('setting-logo-file-input');

    const closeModal = () => {
        if (modal) modal.classList.add('hidden');
    };

    const openModal = () => {
        if (modal) {
            modal.classList.remove('hidden');
            loadLogoLibrary();
        }
    };

    openBtn?.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    closeFooterBtn?.addEventListener('click', closeModal);

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    refreshBtn?.addEventListener('click', () => {
        loadLogoLibrary();
    });

    uploadBtn?.addEventListener('click', () => {
        fileInput?.click();
    });
}

export async function loadLogoLibrary() {
    const grid = document.getElementById('logo-library-grid');
    const countText = document.getElementById('logo-library-count-text');
    if (!grid) return;

    grid.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400 text-xs">
            <i class="fa-solid fa-spinner fa-spin text-xl text-buksu-navy mb-2 block"></i>
            Loading logo repository...
        </div>
    `;

    try {
        const resp = await fetch('/api/settings/logo-library', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        const data = await resp.json();

        if (!data.success || !Array.isArray(data.items)) {
            grid.innerHTML = `
                <div class="col-span-full py-8 text-center text-rose-500 text-xs">
                    <i class="fa-solid fa-circle-exclamation text-lg mb-1 block"></i>
                    ${data.message || 'Failed to load logo repository.'}
                </div>
            `;
            if (countText) countText.textContent = 'Error loading library';
            return;
        }

        const items = data.items;
        if (countText) {
            const count = items.length;
            countText.textContent = `${count} ${count === 1 ? 'item' : 'items'} in repository`;
        }

        if (items.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full py-10 text-center text-slate-400 text-xs">
                    <i class="fa-solid fa-images text-2xl text-slate-300 mb-2 block"></i>
                    No logos uploaded yet. Click "Upload New Logo" to add your institution logo.
                </div>
            `;
            return;
        }

        grid.innerHTML = '';
        items.forEach(item => {
            const card = document.createElement('div');
            const isActive = !!item.isActive;
            const isDefault = !!item.isDefault;

            let badgeHtml = '';
            if (isDefault) {
                badgeHtml = '<span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">System Default</span>';
            } else if (item.storage === 'cloudinary') {
                badgeHtml = '<span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-sky-100 text-sky-800 border border-sky-300"><i class="fa-solid fa-cloud me-1"></i>Cloud CDN</span>';
            } else {
                badgeHtml = '<span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300"><i class="fa-solid fa-server me-1"></i>Local</span>';
            }

            card.className = `p-3 rounded-2xl flex flex-col justify-between items-center transition-all relative ${
                isActive 
                    ? 'border-2 border-emerald-500 bg-emerald-50/20 shadow-xs' 
                    : 'border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
            }`;

            card.innerHTML = `
                <div class="w-full flex items-center justify-between gap-1 mb-2">
                    ${badgeHtml}
                    ${!isDefault ? `
                        <button type="button" class="btn-delete-logo text-slate-400 hover:text-rose-600 p-1 text-xs cursor-pointer transition-colors rounded-lg hover:bg-rose-50" data-id="${item.id}" data-filename="${encodeURIComponent(item.filename || 'logo')}" title="Delete logo from library">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    ` : ''}
                </div>

                <div class="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center p-1.5 bg-white rounded-xl border border-slate-100 shadow-2xs my-1">
                    <img src="${item.url}" alt="${item.filename}" class="max-w-full max-h-full object-contain">
                </div>

                <div class="w-full mt-2 text-center">
                    <div class="text-[11px] font-bold text-slate-800 truncate" title="${item.filename}">
                        ${item.filename}
                    </div>
                    <div class="text-[10px] text-slate-400 mt-0.5">
                        ${item.uploadedAt || ''}
                    </div>
                </div>

                <div class="w-full mt-2.5">
                    ${isActive ? `
                        <div class="w-full py-1.5 px-2 text-center rounded-xl bg-emerald-100 text-emerald-800 font-extrabold text-[11px] border border-emerald-300 flex items-center justify-center gap-1.5 shadow-2xs">
                            <i class="fa-solid fa-check"></i>
                            <span>Active Logo</span>
                        </div>
                    ` : `
                        <button type="button" class="btn-select-logo w-full py-1.5 px-2 rounded-xl bg-buksu-navy hover:bg-buksu-navy-light text-white font-bold text-[11px] shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-buksu-gold/30" data-url="${item.url}">
                            <i class="fa-solid fa-circle-check text-buksu-gold"></i>
                            <span>Use This Logo</span>
                        </button>
                    `}
                </div>
            `;

            grid.appendChild(card);
        });

        // Attach event listeners for buttons inside the cards
        grid.querySelectorAll('.btn-select-logo').forEach(btn => {
            btn.addEventListener('click', async () => {
                const url = btn.dataset.url;
                if (!url) return;
                await selectLogoFromLibrary(url, btn);
            });
        });

        grid.querySelectorAll('.btn-delete-logo').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const filename = decodeURIComponent(btn.dataset.filename || 'this logo');
                if (!id) return;
                await deleteLogoFromLibrary(id, filename, btn);
            });
        });

    } catch (err) {
        console.error("Load logo library error:", err);
        grid.innerHTML = `
            <div class="col-span-full py-8 text-center text-rose-500 text-xs">
                <i class="fa-solid fa-triangle-exclamation text-lg mb-1 block"></i>
                Could not connect to logo repository.
            </div>
        `;
        if (countText) countText.textContent = 'Connection error';
    }
}

async function selectLogoFromLibrary(url, btn) {
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-buksu-gold"></i> Selecting...';

    try {
        const resp = await fetch('/api/settings/logo-library', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'select_logo', url: url })
        });
        const data = await resp.json();

        if (data.success) {
            if (!cachedSettings) cachedSettings = {};
            if (!cachedSettings.branding) cachedSettings.branding = {};
            cachedSettings.branding.logoUrl = data.logoUrl;

            updateLogoPreviewUI(data.logoUrl);
            await loadLogoLibrary();
            showToast("Active Logo Updated", data.message || "Institution logo updated from library.", "create");
        } else {
            showToast("Selection Failed", data.message || "Could not select logo.", "error");
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    } catch (err) {
        console.error("Select logo error:", err);
        showToast("Network Error", "Could not complete logo selection.", "error");
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

async function deleteLogoFromLibrary(id, filename, btn) {
    if (!confirm(`Are you sure you want to delete "${filename}" from the repository?`)) {
        return;
    }

    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const resp = await fetch('/api/settings/logo-library', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_logo', id: id })
        });
        const data = await resp.json();

        if (data.success) {
            if (data.wasActive) {
                if (!cachedSettings) cachedSettings = {};
                if (!cachedSettings.branding) cachedSettings.branding = {};
                cachedSettings.branding.logoUrl = null;
                updateLogoPreviewUI(null);
            }
            await loadLogoLibrary();
            showToast("Logo Deleted", data.message || "Logo deleted from repository.", "archive");
        } else {
            showToast("Delete Failed", data.message || "Could not delete logo.", "error");
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    } catch (err) {
        console.error("Delete logo error:", err);
        showToast("Network Error", "Could not complete logo deletion.", "error");
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

function initBackupAndMaintenance() {
    // One-Click Backup Export
    const backupBtn = document.getElementById('downloadBackupBtn');
    backupBtn?.addEventListener('click', async () => {
        backupBtn.disabled = true;
        backupBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1.5"></i> Exporting Database...';

        const res = await exportBackup();

        backupBtn.disabled = false;
        backupBtn.innerHTML = '<i class="fa-solid fa-download me-1.5 text-buksu-gold"></i> Download Full Database Backup (.json)';

        if (res.success && res.data) {
            // Trigger client browser file download
            const jsonString = JSON.stringify(res.data, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = res.filename || `judgetab_backup_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast("Backup Complete", `Exported system database successfully to ${a.download}.`, "create");

            const lastBackupEl = document.getElementById('setting-last-backup-badge');
            if (lastBackupEl && res.lastBackupAt) {
                lastBackupEl.textContent = `Last Backup: ${formatDateTime(res.lastBackupAt)}`;
            }
        } else {
            showToast("Backup Failed", res.message || "Could not generate backup.", "error");
        }
    });

    // Clear Logs Button
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    clearLogsBtn?.addEventListener('click', async () => {
        if (!confirm("Are you sure you want to clear all system audit logs? This action will purge all historical activity records.")) {
            return;
        }

        clearLogsBtn.disabled = true;
        clearLogsBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1.5"></i> Purging...';

        const res = await clearLogs();

        clearLogsBtn.disabled = false;
        clearLogsBtn.innerHTML = '<i class="fa-solid fa-trash-can me-1.5"></i> Purge Activity Logs';

        if (res.success) {
            showToast("Logs Purged", res.message || "Audit logs purged successfully.", "archive");
            loadSystemSettings();
        } else {
            showToast("Action Failed", res.message || "Failed to purge logs.", "error");
        }
    });

    // Reset Defaults Button
    const resetBtn = document.getElementById('resetSettingsBtn');
    resetBtn?.addEventListener('click', async () => {
        if (!confirm("Reset all settings to factory defaults? This will revert branding, judging rules, and signatories.")) {
            return;
        }

        resetBtn.disabled = true;
        resetBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1.5"></i> Resetting...';

        const res = await resetSettingsDefaults();

        resetBtn.disabled = false;
        resetBtn.innerHTML = '<i class="fa-solid fa-arrow-rotate-left me-1.5"></i> Reset to System Defaults';

        if (res.success) {
            showToast("Settings Reset", "All system settings restored to default values.", "archive");
            if (res.settings) {
                populateSettingsForm(res.settings);
            }
        } else {
            showToast("Reset Failed", res.message || "Failed to reset settings.", "error");
        }
    });
}

function updateSecurityToggleBadge(badgeId, isEnabled) {
    const badge = document.getElementById(badgeId);
    if (!badge) return;
    if (isEnabled) {
        badge.textContent = 'Active';
        badge.className = 'inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800';
    } else {
        badge.textContent = 'Disabled';
        badge.className = 'inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800';
    }
}

function initSecuritySettings() {
    const googleAuthToggle = document.getElementById('setting-toggle-google-auth');
    const recaptchaToggle = document.getElementById('setting-toggle-recaptcha');
    const emailToggle = document.getElementById('setting-toggle-email');
    const qrcodeToggle = document.getElementById('setting-toggle-qrcode');
    const cloudinaryToggle = document.getElementById('setting-toggle-cloudinary');
    const applyBtn = document.getElementById('applySecurityTogglesBtn');

    if (googleAuthToggle) {
        googleAuthToggle.addEventListener('change', () => {
            updateSecurityToggleBadge('google-auth-status-badge', googleAuthToggle.checked);
        });
    }

    if (recaptchaToggle) {
        recaptchaToggle.addEventListener('change', () => {
            updateSecurityToggleBadge('recaptcha-status-badge', recaptchaToggle.checked);
        });
    }

    if (emailToggle) {
        emailToggle.addEventListener('change', () => {
            updateSecurityToggleBadge('email-status-badge', emailToggle.checked);
        });
    }

    if (qrcodeToggle) {
        qrcodeToggle.addEventListener('change', () => {
            updateSecurityToggleBadge('qrcode-status-badge', qrcodeToggle.checked);
        });
    }

    if (cloudinaryToggle) {
        cloudinaryToggle.addEventListener('change', () => {
            updateSecurityToggleBadge('cloudinary-status-badge', cloudinaryToggle.checked);
        });
    }

    const websocketToggle = document.getElementById('setting-toggle-websocket');
    if (websocketToggle) {
        websocketToggle.addEventListener('change', () => {
            updateSecurityToggleBadge('websocket-status-badge', websocketToggle.checked);
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', handleApplySecurityChanges);
    }

    // Modal controls
    const confirmForm = document.getElementById('securityConfirmForm');
    const resendBtn = document.getElementById('resendSecurityOtpBtn');
    const closeBtn = document.getElementById('closeSecurityModalBtn');

    if (confirmForm) {
        confirmForm.addEventListener('submit', handleConfirmSecurityOtp);
    }

    if (resendBtn) {
        resendBtn.addEventListener('click', handleResendSecurityOtp);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeSecurityConfirmModal);
    }
}

async function handleApplySecurityChanges() {
    const googleAuthToggle = document.getElementById('setting-toggle-google-auth');
    const recaptchaToggle = document.getElementById('setting-toggle-recaptcha');
    const emailToggle = document.getElementById('setting-toggle-email');
    const qrcodeToggle = document.getElementById('setting-toggle-qrcode');
    const cloudinaryToggle = document.getElementById('setting-toggle-cloudinary');
    const websocketToggle = document.getElementById('setting-toggle-websocket');
    const applyBtn = document.getElementById('applySecurityTogglesBtn');

    const newGoogleAuth = googleAuthToggle ? googleAuthToggle.checked : true;
    const newRecaptcha = recaptchaToggle ? recaptchaToggle.checked : true;
    const newEmail = emailToggle ? emailToggle.checked : true;
    const newQrCode = qrcodeToggle ? qrcodeToggle.checked : true;
    const newCloudinary = cloudinaryToggle ? cloudinaryToggle.checked : true;
    const newWebsocket = websocketToggle ? websocketToggle.checked : true;

    const currSec = cachedSettings?.security || {
        googleAuthEnabled: true,
        recaptchaEnabled: true,
        emailServiceEnabled: true,
        qrCodeEnabled: true,
        cloudinaryEnabled: true,
        websocketEnabled: true
    };
    const currGoogle = currSec.googleAuthEnabled !== false;
    const currRecaptcha = currSec.recaptchaEnabled !== false;
    const currEmail = currSec.emailServiceEnabled !== false;
    const currQrCode = currSec.qrCodeEnabled !== false;
    const currCloudinary = currSec.cloudinaryEnabled !== false;
    const currWebsocket = currSec.websocketEnabled !== false;

    if (newGoogleAuth === currGoogle && 
        newRecaptcha === currRecaptcha && 
        newEmail === currEmail && 
        newQrCode === currQrCode && 
        newCloudinary === currCloudinary &&
        newWebsocket === currWebsocket) {
        showToast("Notice", "No changes were made to security controls.", "info");
        return;
    }

    if (applyBtn) {
        applyBtn.disabled = true;
        applyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1.5"></i> Updating Security Controls...';
    }

    const res = await requestSecurityChange({
        googleAuthEnabled: newGoogleAuth,
        recaptchaEnabled: newRecaptcha,
        emailServiceEnabled: newEmail,
        qrCodeEnabled: newQrCode,
        cloudinaryEnabled: newCloudinary,
        websocketEnabled: newWebsocket
    });

    if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.innerHTML = '<i class="fa-solid fa-paper-plane text-emerald-200"></i> Update Security Controls';
    }

    if (res.success && res.requires_confirmation) {
        openSecurityConfirmModal(res.masked_email, {
            currGoogle,
            newGoogleAuth,
            currRecaptcha,
            newRecaptcha,
            currEmail,
            newEmail,
            currQrCode,
            newQrCode,
            currCloudinary,
            newCloudinary
        });
    } else if (res.success) {
        if (res.security) {
            cachedSettings.security = res.security;
            applySecurityToggleStates(res.security);
        }
        showToast("Success", res.message || "Security settings updated.", "success");
    } else {
        showToast("Error", res.message || "Failed to update security controls.", "error");
    }
}

function applySecurityToggleStates(sec) {
    if (!sec) return;
    const gToggle = document.getElementById('setting-toggle-google-auth');
    const rToggle = document.getElementById('setting-toggle-recaptcha');
    const eToggle = document.getElementById('setting-toggle-email');
    const qToggle = document.getElementById('setting-toggle-qrcode');
    const cToggle = document.getElementById('setting-toggle-cloudinary');
    const wToggle = document.getElementById('setting-toggle-websocket');

    if (gToggle) {
        gToggle.checked = (sec.googleAuthEnabled !== false);
        updateSecurityToggleBadge('google-auth-status-badge', gToggle.checked);
    }
    if (rToggle) {
        rToggle.checked = (sec.recaptchaEnabled !== false);
        updateSecurityToggleBadge('recaptcha-status-badge', rToggle.checked);
    }
    if (eToggle) {
        eToggle.checked = (sec.emailServiceEnabled !== false);
        updateSecurityToggleBadge('email-status-badge', eToggle.checked);
    }
    if (qToggle) {
        qToggle.checked = (sec.qrCodeEnabled !== false);
        updateSecurityToggleBadge('qrcode-status-badge', qToggle.checked);
    }
    if (cToggle) {
        cToggle.checked = (sec.cloudinaryEnabled !== false);
        updateSecurityToggleBadge('cloudinary-status-badge', cToggle.checked);
    }
    if (wToggle) {
        wToggle.checked = (sec.websocketEnabled !== false);
        updateSecurityToggleBadge('websocket-status-badge', wToggle.checked);
    }
}

function openSecurityConfirmModal(maskedEmail, diff) {
    const modal = document.getElementById('security-confirm-modal');
    const emailEl = document.getElementById('security-modal-masked-email');
    const diffList = document.getElementById('security-modal-diff-list');
    const noticeEl = document.getElementById('security-confirm-notice');
    const otpInput = document.getElementById('security-otp-input');

    if (emailEl) emailEl.textContent = maskedEmail || "your admin email";
    if (noticeEl) noticeEl.className = 'hidden';

    if (diffList) {
        diffList.innerHTML = `
            <div class="flex items-center justify-between py-1 border-b border-slate-100">
                <span>Google OAuth 2.0:</span>
                <span class="font-bold">${diff.currGoogle ? '<span class="text-emerald-600">Enabled</span>' : '<span class="text-rose-600">Disabled</span>'} &rarr; ${diff.newGoogleAuth ? '<span class="text-emerald-600">Enabled</span>' : '<span class="text-rose-600">Disabled</span>'}</span>
            </div>
            <div class="flex items-center justify-between py-1 border-b border-slate-100">
                <span>Google reCAPTCHA v2:</span>
                <span class="font-bold">${diff.currRecaptcha ? '<span class="text-emerald-600">Enabled</span>' : '<span class="text-rose-600">Disabled</span>'} &rarr; ${diff.newRecaptcha ? '<span class="text-emerald-600">Enabled</span>' : '<span class="text-rose-600">Disabled</span>'}</span>
            </div>
            <div class="flex items-center justify-between py-1 border-b border-slate-100">
                <span>Gmail / Email Service:</span>
                <span class="font-bold">${diff.currEmail ? '<span class="text-emerald-600">Enabled</span>' : '<span class="text-rose-600">Disabled</span>'} &rarr; ${diff.newEmail ? '<span class="text-emerald-600">Enabled</span>' : '<span class="text-rose-600">Disabled</span>'}</span>
            </div>
            <div class="flex items-center justify-between py-1 border-b border-slate-100">
                <span>QR Code Generator API:</span>
                <span class="font-bold">${diff.currQrCode ? '<span class="text-emerald-600">Enabled</span>' : '<span class="text-rose-600">Disabled</span>'} &rarr; ${diff.newQrCode ? '<span class="text-emerald-600">Enabled</span>' : '<span class="text-rose-600">Disabled</span>'}</span>
            </div>
            <div class="flex items-center justify-between py-1 border-b border-slate-100">
                <span>Cloudinary Media API:</span>
                <span class="font-bold">${diff.currCloudinary ? '<span class="text-emerald-600">Enabled</span>' : '<span class="text-rose-600">Disabled</span>'} &rarr; ${diff.newCloudinary ? '<span class="text-emerald-600">Enabled</span>' : '<span class="text-rose-600">Disabled</span>'}</span>
            </div>
            <div class="flex items-center justify-between py-1">
                <span>Real-Time WebSockets:</span>
                <span class="font-bold">${diff.currWebsocket ? '<span class="text-emerald-600">Enabled</span>' : '<span class="text-rose-600">Disabled</span>'} &rarr; ${diff.newWebsocket ? '<span class="text-emerald-600">Enabled</span>' : '<span class="text-rose-600">Disabled</span>'}</span>
            </div>
        `;
    }

    if (otpInput) {
        otpInput.value = '';
    }

    if (modal) {
        modal.classList.remove('hidden');
        if (otpInput) setTimeout(() => otpInput.focus(), 150);
    }
}

function closeSecurityConfirmModal() {
    const modal = document.getElementById('security-confirm-modal');
    if (modal) modal.classList.add('hidden');

    // Reset toggles to cached state
    if (cachedSettings?.security) {
        applySecurityToggleStates(cachedSettings.security);
    }
}

async function handleConfirmSecurityOtp(e) {
    e.preventDefault();
    const otpInput = document.getElementById('security-otp-input');
    const noticeEl = document.getElementById('security-confirm-notice');
    const submitBtn = document.getElementById('confirmSecurityOtpBtn');
    const btnText = document.getElementById('confirm-otp-btn-text');

    const code = otpInput?.value.trim() || '';
    if (code.length !== 6) {
        if (noticeEl) {
            noticeEl.className = 'p-2.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 block';
            noticeEl.innerHTML = '<i class="fa-solid fa-circle-exclamation me-1"></i> Please enter the full 6-digit confirmation code.';
        }
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.textContent = "Verifying...";

    const res = await confirmSecurityChange(code);

    if (submitBtn) submitBtn.disabled = false;
    if (btnText) btnText.textContent = "Verify & Apply Changes";

    if (res.success) {
        if (cachedSettings) {
            cachedSettings.security = res.security;
        }
        if (res.security) {
            applySecurityToggleStates(res.security);
        }
        const modal = document.getElementById('security-confirm-modal');
        if (modal) modal.classList.add('hidden');
        showToast("Success", res.message || "Security settings updated successfully!", "success");
    } else {
        if (noticeEl) {
            noticeEl.className = 'p-2.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 block';
            noticeEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-1"></i> ${res.message || 'Verification failed.'}`;
        }
    }
}

async function handleResendSecurityOtp() {
    const resendBtn = document.getElementById('resendSecurityOtpBtn');
    const noticeEl = document.getElementById('security-confirm-notice');

    if (resendBtn) {
        resendBtn.disabled = true;
        resendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[11px]"></i> Resending...';
    }

    const res = await resendSecurityCode();

    if (resendBtn) {
        resendBtn.disabled = false;
        resendBtn.innerHTML = '<i class="fa-solid fa-rotate-right text-[11px]"></i> Resend Code';
    }

    if (noticeEl) {
        if (res.success) {
            noticeEl.className = 'p-2.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 block';
            noticeEl.innerHTML = `<i class="fa-solid fa-circle-check me-1"></i> ${res.message || 'New code sent.'}`;
        } else {
            noticeEl.className = 'p-2.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 block';
            noticeEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-1"></i> ${res.message || 'Failed to resend code.'}`;
        }
    }
}

const ENV_KEY_FIELDS = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'RECAPTCHA_SITE_KEY',
    'RECAPTCHA_SECRET_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_FOLDER',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USERNAME',
    'SMTP_PASSWORD',
    'SMTP_FROM_EMAIL',
    'SMTP_FROM_NAME',
    'PUSHER_APP_ID',
    'PUSHER_CLUSTER',
    'PUSHER_KEY',
    'PUSHER_SECRET'
];

function populateApiKeysForm(apiKeys) {
    if (!apiKeys || typeof apiKeys !== 'object') return;

    if (!apiKeysUnlockToken) {
        cachedMaskedKeys = { ...apiKeys };
    }

    ENV_KEY_FIELDS.forEach(key => {
        const input = document.getElementById(`setting-env-${key}`);
        if (input && apiKeys[key] !== undefined) {
            input.value = apiKeys[key];
        }
    });
}

function lockApiKeysInputs() {
    apiKeysUnlockToken = null;

    ENV_KEY_FIELDS.forEach(key => {
        const input = document.getElementById(`setting-env-${key}`);
        if (input) {
            input.disabled = true;
            input.classList.add('bg-slate-100', 'cursor-not-allowed', 'text-slate-500');
            input.classList.remove('bg-white', 'text-slate-800');
        }
    });

    const unlockTop = document.getElementById('unlockApiKeysBtnTop');
    const cancelTop = document.getElementById('cancelApiKeysBtnTop');
    const saveTop = document.getElementById('saveApiKeysBtnTop');
    const unlockBtm = document.getElementById('unlockApiKeysBtnBtm');
    const cancelBtm = document.getElementById('cancelApiKeysBtnBtm');
    const saveBtm = document.getElementById('saveApiKeysBtn');
    const statusBadge = document.getElementById('apiKeysLockStatusBadge');
    const lockNotice = document.getElementById('apiKeysLockNotice');

    if (unlockTop) unlockTop.classList.remove('hidden');
    if (cancelTop) cancelTop.classList.add('hidden');
    if (saveTop) saveTop.classList.add('hidden');

    if (unlockBtm) unlockBtm.classList.remove('hidden');
    if (cancelBtm) cancelBtm.classList.add('hidden');
    if (saveBtm) saveBtm.classList.add('hidden');

    if (statusBadge) {
        statusBadge.className = 'px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1';
        statusBadge.innerHTML = '<i class="fa-solid fa-lock text-amber-400"></i> Locked (Protected)';
    }

    if (lockNotice) {
        lockNotice.innerHTML = 'Inputs are protected and read-only. Click <strong>Edit Credentials</strong> and verify your exclusive Admin PIN to modify keys.';
    }
}

function unlockApiKeysInputs() {
    ENV_KEY_FIELDS.forEach(key => {
        const input = document.getElementById(`setting-env-${key}`);
        if (input) {
            input.disabled = false;
            input.classList.remove('bg-slate-100', 'cursor-not-allowed', 'text-slate-500');
            input.classList.add('bg-white', 'text-slate-800');
        }
    });

    const unlockTop = document.getElementById('unlockApiKeysBtnTop');
    const cancelTop = document.getElementById('cancelApiKeysBtnTop');
    const saveTop = document.getElementById('saveApiKeysBtnTop');
    const unlockBtm = document.getElementById('unlockApiKeysBtnBtm');
    const cancelBtm = document.getElementById('cancelApiKeysBtnBtm');
    const saveBtm = document.getElementById('saveApiKeysBtn');
    const statusBadge = document.getElementById('apiKeysLockStatusBadge');
    const lockNotice = document.getElementById('apiKeysLockNotice');

    if (unlockTop) unlockTop.classList.add('hidden');
    if (cancelTop) cancelTop.classList.remove('hidden');
    if (saveTop) saveTop.classList.remove('hidden');

    if (unlockBtm) unlockBtm.classList.add('hidden');
    if (cancelBtm) cancelBtm.classList.remove('hidden');
    if (saveBtm) saveBtm.classList.remove('hidden');

    if (statusBadge) {
        statusBadge.className = 'px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1';
        statusBadge.innerHTML = '<i class="fa-solid fa-lock-open text-emerald-400"></i> Unlocked for Editing';
    }

    if (lockNotice) {
        lockNotice.innerHTML = '<span class="text-emerald-600 font-bold"><i class="fa-solid fa-check me-1"></i>Unlocked for editing.</span> Changes will be saved to <code class="font-mono">.env</code> and cloud database.';
    }
}

function openAdminPinModal() {
    const modal = document.getElementById('admin-pin-modal');
    const input = document.getElementById('admin-pin-input');
    const notice = document.getElementById('admin-pin-modal-notice');
    if (!modal) return;

    if (notice) {
        notice.className = 'hidden';
        notice.textContent = '';
    }
    if (input) {
        input.value = '';
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
        input?.focus();
    }, 100);
}

function closeAdminPinModal() {
    const modal = document.getElementById('admin-pin-modal');
    if (modal) modal.classList.add('hidden');
}

function initApiKeysSettings() {
    // Start locked by default
    lockApiKeysInputs();

    // Unlock buttons click -> open modal
    document.getElementById('unlockApiKeysBtnTop')?.addEventListener('click', openAdminPinModal);
    document.getElementById('unlockApiKeysBtnBtm')?.addEventListener('click', openAdminPinModal);

    // Cancel modal buttons
    document.getElementById('closeAdminPinModalBtn')?.addEventListener('click', closeAdminPinModal);
    document.getElementById('cancelAdminPinModalBtn')?.addEventListener('click', closeAdminPinModal);

    // Modal background click to close
    document.getElementById('admin-pin-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'admin-pin-modal') {
            closeAdminPinModal();
        }
    });

    // Cancel editing / Re-lock handlers
    const handleCancelApiKeys = () => {
        lockApiKeysInputs();
        if (cachedMaskedKeys && Object.keys(cachedMaskedKeys).length > 0) {
            populateApiKeysForm(cachedMaskedKeys);
        }
        showToast("Editing Locked", "API keys inputs have been locked.", "archive");
    };
    document.getElementById('cancelApiKeysBtnTop')?.addEventListener('click', handleCancelApiKeys);
    document.getElementById('cancelApiKeysBtnBtm')?.addEventListener('click', handleCancelApiKeys);

    // PIN Form submission
    const pinForm = document.getElementById('adminPinVerifyForm');
    pinForm?.addEventListener('submit', async () => {
        const pinInput = document.getElementById('admin-pin-input');
        const pin = (pinInput?.value || '').trim();
        const notice = document.getElementById('admin-pin-modal-notice');
        const btn = document.getElementById('confirmAdminPinBtn');
        const btnText = document.getElementById('confirm-admin-pin-btn-text');

        if (!pin) {
            if (notice) {
                notice.className = 'p-2.5 rounded-xl text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-600';
                notice.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-1.5"></i>Please enter your Admin PIN.';
                notice.classList.remove('hidden');
            }
            return;
        }

        btn.disabled = true;
        btnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Verifying...';

        const res = await verifyAdminPin(pin);

        btn.disabled = false;
        btnText.textContent = 'Verify & Unlock';

        if (res.success) {
            apiKeysUnlockToken = res.unlock_token;
            if (res.api_keys) {
                populateApiKeysForm(res.api_keys);
            }
            closeAdminPinModal();
            unlockApiKeysInputs();
            showToast("Access Granted", "Admin PIN verified. Credentials unlocked for editing.", "create");
        } else {
            if (notice) {
                let errorMsg = res.message || 'Incorrect Admin PIN.';
                if (errorMsg.includes('API endpoint not found') || errorMsg.includes('Cannot POST')) {
                    errorMsg = 'Verification service not recognized. Please restart your Node.js server to register the new endpoint.';
                }
                notice.className = 'p-2.5 rounded-xl text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-600';
                notice.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-1.5"></i>${errorMsg}`;
                notice.classList.remove('hidden');
            }
            if (pinInput) {
                pinInput.value = '';
                pinInput.focus();
            }
        }
    });

    // Save API keys handler
    const handleSaveApiKeys = async () => {
        if (!apiKeysUnlockToken) {
            openAdminPinModal();
            return;
        }

        const topBtn = document.getElementById('saveApiKeysBtnTop');
        const btmBtn = document.getElementById('saveApiKeysBtn');
        const buttons = [topBtn, btmBtn].filter(Boolean);

        buttons.forEach(b => {
            b.disabled = true;
            b.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1.5"></i> Saving...';
        });

        const payload = {};
        ENV_KEY_FIELDS.forEach(key => {
            const input = document.getElementById(`setting-env-${key}`);
            if (input) {
                payload[key] = input.value.trim();
            }
        });

        const res = await saveApiKeys(payload, apiKeysUnlockToken);

        buttons.forEach(b => {
            b.disabled = false;
        });
        if (topBtn) {
            topBtn.innerHTML = '<i class="fa-solid fa-floppy-disk me-1.5"></i> Save .env Keys';
        }
        if (btmBtn) {
            btmBtn.innerHTML = '<i class="fa-solid fa-floppy-disk text-buksu-gold me-1.5"></i> Save API Keys to .env';
        }

        if (res.success) {
            showToast("Credentials Saved", res.message || "API keys written to .env and synchronized.", "create");
            if (res.api_keys) {
                cachedMaskedKeys = { ...res.api_keys };
                populateApiKeysForm(res.api_keys);
            }
            lockApiKeysInputs();
        } else {
            showToast("Save Failed", res.message || "Failed to update API credentials.", "error");
            if (res.message && res.message.toLowerCase().includes('pin')) {
                lockApiKeysInputs();
                openAdminPinModal();
            }
        }
    };

    document.getElementById('saveApiKeysBtn')?.addEventListener('click', handleSaveApiKeys);
    document.getElementById('saveApiKeysBtnTop')?.addEventListener('click', handleSaveApiKeys);
}

const userRole = document.body.dataset.role;

if (userRole === 'admin') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSettingsPanel);
    } else {
        initSettingsPanel();
    }
}

