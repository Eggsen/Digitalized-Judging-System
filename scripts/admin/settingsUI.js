import { 
    getSettings, 
    saveSettings, 
    exportBackup, 
    clearLogs, 
    resetSettingsDefaults,
    requestSecurityChange,
    confirmSecurityChange,
    resendSecurityCode
} from "/scripts/admin/settingsAPI.js";
import { showToast } from "/scripts/utils/uiUtils.js";

const userRole = document.body.dataset.role;

if (userRole === 'admin') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSettingsPanel);
    } else {
        initSettingsPanel();
    }
}

let cachedSettings = null;

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
        lastBackupEl.textContent = backup.lastBackupAt ? `Last Backup: ${backup.lastBackupAt}` : 'No backups recorded yet';
    }

    // Security controls
    const security = settings.security || {};
    const googleAuthToggle = document.getElementById('setting-toggle-google-auth');
    const recaptchaToggle = document.getElementById('setting-toggle-recaptcha');

    if (googleAuthToggle) {
        googleAuthToggle.checked = (security.googleAuthEnabled !== false);
        updateSecurityToggleBadge('google-auth-status-badge', googleAuthToggle.checked);
    }

    if (recaptchaToggle) {
        recaptchaToggle.checked = (security.recaptchaEnabled !== false);
        updateSecurityToggleBadge('recaptcha-status-badge', recaptchaToggle.checked);
    }

    // Update live banner preview
    updateBrandingPreview(branding);
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
    setTxt('diag-php-version', `PHP ${diag.phpVersion || '8.2'}`);
    setTxt('diag-system-version', diag.systemVersion || 'v2.4');
}

export function initSettingsPanel() {
    initSubTabs();
    initSettingsForm();
    initSecuritySettings();
    initBackupAndMaintenance();
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

        const payload = {
            branding: {
                institutionName: document.getElementById('setting-institution-name')?.value.trim() || 'Bukidnon State University',
                campusUnit: document.getElementById('setting-campus-unit')?.value.trim() || '',
                systemTitle: document.getElementById('setting-system-title')?.value.trim() || 'JudgeTab - Digitalized Judging System',
                headerSubtitle: document.getElementById('setting-header-subtitle')?.value.trim() || '',
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
                lastBackupEl.textContent = `Last Backup: ${res.lastBackupAt}`;
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
    const applyBtn = document.getElementById('applySecurityTogglesBtn');

    const newGoogleAuth = googleAuthToggle ? googleAuthToggle.checked : true;
    const newRecaptcha = recaptchaToggle ? recaptchaToggle.checked : true;

    const currSec = cachedSettings?.security || { googleAuthEnabled: true, recaptchaEnabled: true };
    const currGoogle = currSec.googleAuthEnabled !== false;
    const currRecaptcha = currSec.recaptchaEnabled !== false;

    if (newGoogleAuth === currGoogle && newRecaptcha === currRecaptcha) {
        showToast("Notice", "No changes were made to security controls.", "info");
        return;
    }

    if (applyBtn) {
        applyBtn.disabled = true;
        applyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1.5"></i> Sending Verification Email...';
    }

    const res = await requestSecurityChange({
        googleAuthEnabled: newGoogleAuth,
        recaptchaEnabled: newRecaptcha
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
            newRecaptcha
        });
    } else if (res.success) {
        showToast("Success", res.message || "Security settings updated.", "success");
    } else {
        showToast("Error", res.message || "Failed to initiate security changes.", "error");
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
            <div class="flex items-center justify-between py-1">
                <span>Google reCAPTCHA v2:</span>
                <span class="font-bold">${diff.currRecaptcha ? '<span class="text-emerald-600">Enabled</span>' : '<span class="text-rose-600">Disabled</span>'} &rarr; ${diff.newRecaptcha ? '<span class="text-emerald-600">Enabled</span>' : '<span class="text-rose-600">Disabled</span>'}</span>
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
        const googleAuthToggle = document.getElementById('setting-toggle-google-auth');
        const recaptchaToggle = document.getElementById('setting-toggle-recaptcha');
        if (googleAuthToggle) {
            googleAuthToggle.checked = (cachedSettings.security.googleAuthEnabled !== false);
            updateSecurityToggleBadge('google-auth-status-badge', googleAuthToggle.checked);
        }
        if (recaptchaToggle) {
            recaptchaToggle.checked = (cachedSettings.security.recaptchaEnabled !== false);
            updateSecurityToggleBadge('recaptcha-status-badge', recaptchaToggle.checked);
        }
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
