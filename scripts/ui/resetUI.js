import { resetPassword } from "/scripts/auth/authAPI.js";
import { togglePasswordVisibility } from "/scripts/utils/index.js";

initResetUI();

function initResetUI() {
    // Forgot password link — triggers the reset card
    document.getElementById('forgot-password-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        showForgotPasswordCard();
    });

    // Back to login button — hides reset card, shows login card
    document.getElementById('back-to-login-btn')?.addEventListener('click', () => {
        hideForgotPasswordCard();
    });

    // Password visibility toggles on step 2
    document.getElementById('toggle-reset-new-pw-btn')?.addEventListener('click', () => {
        togglePasswordVisibility('reset-new-password', 'toggle-reset-new-pw-icon');
    });

    document.getElementById('toggle-reset-confirm-pw-btn')?.addEventListener('click', () => {
        togglePasswordVisibility('reset-confirm-password', 'toggle-reset-confirm-pw-icon');
    });

    // Step 1: verify username form
    document.getElementById('resetVerifyForm')?.addEventListener('submit', handleVerifySubmit);

    // Step 2: set new password form
    document.getElementById('resetPasswordForm')?.addEventListener('submit', handleResetSubmit);
}

// ---- Show the forgot password card ----
function showForgotPasswordCard() {
    const role = window.getSelectedRole ? window.getSelectedRole() : 'judge';

    // Update the role badge on the reset card
    const badgeText = document.getElementById('reset-role-badge-text');
    const badgeIcon = document.getElementById('reset-role-badge-icon');
    if (badgeText) badgeText.textContent = role === 'judge' ? 'Judge Portal' : 'Tabulator Portal';
    if (badgeIcon) badgeIcon.setAttribute('class', role === 'judge' ? 'fa-solid fa-gavel' : 'fa-solid fa-calculator');

    resetForgotPasswordForm();

    document.getElementById('login-card').classList.add('hidden');
    document.getElementById('forgot-password-card').classList.remove('hidden');
    document.getElementById('forgot-password-card').classList.add('animate-fade-in');
}

// ---- Hide the forgot password card and return to login ----
function hideForgotPasswordCard() {
    resetForgotPasswordForm();
    document.getElementById('forgot-password-card').classList.add('hidden');
    document.getElementById('login-card').classList.remove('hidden');
    document.getElementById('login-card').classList.add('animate-fade-in');
}

// ---- Reset the forgot password form to its initial state ----
function resetForgotPasswordForm() {
    document.getElementById('reset-step-1').classList.remove('hidden');
    document.getElementById('reset-step-2').classList.add('hidden');

    const usernameInput   = document.getElementById('reset-username');
    const newPwInput      = document.getElementById('reset-new-password');
    const confirmPwInput  = document.getElementById('reset-confirm-password');
    if (usernameInput)  usernameInput.value = '';
    if (newPwInput)     newPwInput.value = '';
    if (confirmPwInput) confirmPwInput.value = '';

    const noticeWrap = document.getElementById('reset-notice-wrap');
    if (noticeWrap) noticeWrap.classList.add('hidden');

    const verifyBtnText = document.getElementById('reset-verify-btn-text');
    if (verifyBtnText) verifyBtnText.textContent = 'Verify Account';
}

// ---- Helper: show a notice in the reset card ----
function showResetNotice(type, message) {
    const noticeWrap = document.getElementById('reset-notice-wrap');
    const notice     = document.getElementById('reset-notice');
    if (!noticeWrap || !notice) return;

    const colorMap = {
        error:   'text-rose-600 bg-rose-50 border border-rose-200',
        success: 'text-emerald-600 bg-emerald-50 border border-emerald-200',
        warning: 'text-amber-600 bg-amber-50 border border-amber-200'
    };
    const iconMap = {
        error:   'fa-triangle-exclamation',
        success: 'fa-circle-check',
        warning: 'fa-circle-exclamation'
    };

    noticeWrap.className = `mb-4 px-3 py-2 rounded-xl text-xs font-semibold ${colorMap[type] || colorMap.error}`;
    notice.innerHTML = `<i class="fa-solid ${iconMap[type] || iconMap.error} me-1.5"></i>${message}`;
    noticeWrap.classList.remove('hidden');
}

// ---- Step 1: Verify the username exists for the selected role ----
async function handleVerifySubmit() {
    const usernameInput = document.getElementById('reset-username');
    const username = usernameInput ? usernameInput.value.trim() : '';
    const role = window.getSelectedRole ? window.getSelectedRole() : 'judge';

    if (!username) {
        showResetNotice('warning', 'Please enter your username.');
        return;
    }

    const btn     = document.getElementById('resetVerifyBtn');
    const btnText = document.getElementById('reset-verify-btn-text');
    btn.disabled = true;
    btnText.textContent = 'Verifying...';

    const res = await resetPassword({ action: 'verify_user', username, role });

    btn.disabled = false;
    btnText.textContent = 'Verify Account';

    if (res.success) {
        document.getElementById('reset-notice-wrap').classList.add('hidden');
        document.getElementById('reset-step-1').classList.add('hidden');
        document.getElementById('reset-step-2').classList.remove('hidden');

        const displayEl = document.getElementById('reset-verified-username-display');
        if (displayEl) displayEl.textContent = 'Account verified: ' + username;
    } else {
        showResetNotice('error', res.message || 'Verification failed.');
    }
}

// ---- Step 2: Submit the new password ----
async function handleResetSubmit() {
    const newPassword    = document.getElementById('reset-new-password')?.value ?? '';
    const confirmPassword = document.getElementById('reset-confirm-password')?.value ?? '';

    if (!newPassword || !confirmPassword) {
        showResetNotice('warning', 'Please fill in both password fields.');
        return;
    }

    if (newPassword !== confirmPassword) {
        showResetNotice('error', 'Passwords do not match.');
        return;
    }

    const btn     = document.getElementById('resetSubmitBtn');
    const btnText = document.getElementById('reset-submit-btn-text');
    btn.disabled = true;
    btnText.textContent = 'Resetting...';

    const res = await resetPassword({
        action: 'reset',
        new_password: newPassword,
        confirm_password: confirmPassword
    });

    btn.disabled = false;
    btnText.textContent = 'Reset Password';

    if (res.success) {
        showResetNotice('success', res.message);

        setTimeout(() => {
            hideForgotPasswordCard();
        }, 2000);
    } else {
        showResetNotice('error', res.message || 'Reset failed. Please try again.');
    }
}
