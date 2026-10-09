import { clearLoginForm, togglePasswordVisibility, showNotice } from "../utils/index.js";
import { verifyInviteToken, acceptInvitation, resetPassword } from "../auth/authAPI.js";

// Module scripts are deferred — DOM is ready by the time this runs
initLandingPage();

function initLandingPage() {
    const loginCard = document.getElementById('login-card');
    const acceptInviteCard = document.getElementById('accept-invitation-card');
    const resetTokenCard = document.getElementById('reset-token-card');
    const registerCard = document.getElementById('register-admin-card');

    const togglePasswordBtn = document.getElementById('toggle-password-btn');
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => togglePasswordVisibility('password-input', 'toggle-password-icon'));
    }

    const openRegisterBtn = document.getElementById('open-register-admin-btn');
    if (openRegisterBtn) {
        openRegisterBtn.addEventListener('click', showRegisterAdminCard);
    }

    const backFromRegisterBtn = document.getElementById('back-from-register-btn');
    if (backFromRegisterBtn) {
        backFromRegisterBtn.addEventListener('click', hideRegisterAdminCard);
    }

    // Password visibility toggles for invite & reset forms
    document.getElementById('toggle-invite-password-btn')?.addEventListener('click', () => {
        togglePasswordVisibility('invite-password-input', 'toggle-invite-password-icon');
    });
    document.getElementById('toggle-invite-confirm-pw-btn')?.addEventListener('click', () => {
        togglePasswordVisibility('invite-confirm-password-input', 'toggle-invite-confirm-pw-icon');
    });

    document.getElementById('toggle-reset-token-pw-btn')?.addEventListener('click', () => {
        togglePasswordVisibility('reset-token-password-input', 'toggle-reset-token-pw-icon');
    });
    document.getElementById('toggle-reset-token-confirm-pw-btn')?.addEventListener('click', () => {
        togglePasswordVisibility('reset-token-confirm-pw-input', 'toggle-reset-token-confirm-pw-icon');
    });

    // Check URL query parameters for tokens
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite_token') || urlParams.get('token');
    const resetToken = urlParams.get('reset_token');

    if (inviteToken && acceptInviteCard) {
        if (loginCard) loginCard.classList.add('hidden');
        if (registerCard) registerCard.classList.add('hidden');
        acceptInviteCard.classList.remove('hidden');
        acceptInviteCard.classList.add('animate-fade-in');

        const tokenInput = document.getElementById('invite-token-input');
        if (tokenInput) tokenInput.value = inviteToken;
        checkInviteToken(inviteToken);
    } else if (resetToken && resetTokenCard) {
        if (loginCard) loginCard.classList.add('hidden');
        if (registerCard) registerCard.classList.add('hidden');
        resetTokenCard.classList.remove('hidden');
        resetTokenCard.classList.add('animate-fade-in');

        const tokenInput = document.getElementById('reset-token-input');
        if (tokenInput) tokenInput.value = resetToken;
        checkResetToken(resetToken);
    }

    // Accept invitation form submit
    const acceptInviteForm = document.getElementById('acceptInviteForm');
    if (acceptInviteForm) {
        acceptInviteForm.addEventListener('submit', handleAcceptInvite);
    }

    // Complete password reset form submit
    const completeResetForm = document.getElementById('completeResetForm');
    if (completeResetForm) {
        completeResetForm.addEventListener('submit', handleCompleteReset);
    }
}

async function checkInviteToken(token) {
    const usernameDisplay = document.getElementById('invite-username-display');
    const roleDisplay = document.getElementById('invite-role-display');
    const noticeWrap = document.getElementById('invite-notice-wrap');
    const notice = document.getElementById('invite-notice');
    const btn = document.getElementById('acceptInviteBtn');

    if (usernameDisplay) usernameDisplay.textContent = "Verifying invitation...";

    const res = await verifyInviteToken(token);

    if (res.success) {
        if (usernameDisplay) usernameDisplay.textContent = `Account: ${res.username}`;
        if (roleDisplay) roleDisplay.textContent = `Role: Official ${res.role.charAt(0).toUpperCase() + res.role.slice(1)}`;
        if (noticeWrap) noticeWrap.classList.add('hidden');
        if (btn) btn.disabled = false;
    } else {
        if (usernameDisplay) usernameDisplay.textContent = "Invalid Invitation";
        if (roleDisplay) roleDisplay.textContent = "This link may be invalid, used, or expired.";
        if (btn) btn.disabled = true;

        if (noticeWrap && notice) {
            noticeWrap.className = 'my-4 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200';
            notice.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-1.5"></i>${res.message}`;
            noticeWrap.classList.remove('hidden');
        }
    }
}

async function handleAcceptInvite() {
    const token = document.getElementById('invite-token-input')?.value || '';
    const password = document.getElementById('invite-password-input')?.value || '';
    const confirmPassword = document.getElementById('invite-confirm-password-input')?.value || '';
    const btn = document.getElementById('acceptInviteBtn');
    const btnText = document.getElementById('invite-btn-text');

    if (!password || !confirmPassword) {
        showInviteNotice('warning', 'Please fill in both password fields.');
        return;
    }

    if (password !== confirmPassword) {
        showInviteNotice('error', 'Passwords do not match.');
        return;
    }

    if (password.length < 6) {
        showInviteNotice('warning', 'Password must be at least 6 characters long.');
        return;
    }

    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = "Saving Password...";

    const res = await acceptInvitation({
        token,
        password,
        confirm_password: confirmPassword
    });

    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = "Save Password & Activate";

    if (res.success) {
        showInviteNotice('success', res.message || "Password updated successfully!");

        setTimeout(() => {
            const usernameInput = document.getElementById('username-input');
            if (usernameInput && res.username) usernameInput.value = res.username;

            window.history.replaceState({}, document.title, window.location.pathname);

            const loginCard = document.getElementById('login-card');
            const acceptInviteCard = document.getElementById('accept-invitation-card');
            if (acceptInviteCard && loginCard) {
                acceptInviteCard.classList.add('hidden');
                loginCard.classList.remove('hidden');
                loginCard.classList.add('animate-fade-in');
            } else {
                window.location.href = '/auth/login.php';
            }
        }, 1500);
    } else {
        showInviteNotice('error', res.message || "Failed to save password.");
    }
}

async function checkResetToken(token) {
    const usernameDisplay = document.getElementById('reset-token-username-display');
    const noticeWrap = document.getElementById('reset-token-notice-wrap');
    const notice = document.getElementById('reset-token-notice');
    const btn = document.getElementById('completeResetBtn');

    if (usernameDisplay) usernameDisplay.textContent = "Verifying reset link...";

    try {
        const response = await fetch(`/backend/auth/reset_password.php?token=${encodeURIComponent(token)}`);
        const res = await response.json();

        if (res.success) {
            if (usernameDisplay) usernameDisplay.textContent = `Account: ${res.username} (${res.email || res.role})`;
            if (noticeWrap) noticeWrap.classList.add('hidden');
            if (btn) btn.disabled = false;
        } else {
            if (usernameDisplay) usernameDisplay.textContent = "Invalid or Expired Link";
            if (btn) btn.disabled = true;

            if (noticeWrap && notice) {
                noticeWrap.className = 'my-4 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200';
                notice.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-1.5"></i>${res.message}`;
                noticeWrap.classList.remove('hidden');
            }
        }
    } catch (e) {
        if (usernameDisplay) usernameDisplay.textContent = "Error verifying link.";
    }
}

async function handleCompleteReset() {
    const token = document.getElementById('reset-token-input')?.value || '';
    const newPassword = document.getElementById('reset-token-password-input')?.value || '';
    const confirmPassword = document.getElementById('reset-token-confirm-pw-input')?.value || '';
    const btn = document.getElementById('completeResetBtn');
    const btnText = document.getElementById('complete-reset-btn-text');

    if (!newPassword || !confirmPassword) {
        showResetTokenNotice('warning', 'Please fill in both password fields.');
        return;
    }

    if (newPassword !== confirmPassword) {
        showResetTokenNotice('error', 'Passwords do not match.');
        return;
    }

    if (newPassword.length < 6) {
        showResetTokenNotice('warning', 'Password must be at least 6 characters long.');
        return;
    }

    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = "Saving Password...";

    const res = await resetPassword({
        action: 'complete_reset',
        reset_token: token,
        new_password: newPassword,
        confirm_password: confirmPassword
    });

    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = "Save New Password";

    if (res.success) {
        showResetTokenNotice('success', res.message || "Password updated successfully!");

        setTimeout(() => {
            const usernameInput = document.getElementById('username-input');
            if (usernameInput && res.username) usernameInput.value = res.username;

            window.history.replaceState({}, document.title, window.location.pathname);

            const loginCard = document.getElementById('login-card');
            const resetTokenCard = document.getElementById('reset-token-card');
            if (resetTokenCard && loginCard) {
                resetTokenCard.classList.add('hidden');
                loginCard.classList.remove('hidden');
                loginCard.classList.add('animate-fade-in');
            } else {
                window.location.href = '/auth/login.php';
            }
        }, 1500);
    } else {
        showResetTokenNotice('error', res.message || "Failed to save password.");
    }
}

function showInviteNotice(type, message) {
    const noticeWrap = document.getElementById('invite-notice-wrap');
    const notice = document.getElementById('invite-notice');
    if (!noticeWrap || !notice) return;

    const styles = {
        error: 'text-rose-600 bg-rose-50 border border-rose-200',
        success: 'text-emerald-600 bg-emerald-50 border border-emerald-200',
        warning: 'text-amber-600 bg-amber-50 border border-amber-200'
    };
    const icons = {
        error: 'fa-triangle-exclamation',
        success: 'fa-circle-check',
        warning: 'fa-circle-exclamation'
    };

    noticeWrap.className = `my-4 px-3 py-2 rounded-xl text-xs font-semibold ${styles[type] || styles.error}`;
    notice.innerHTML = `<i class="fa-solid ${icons[type] || icons.error} me-1.5"></i>${message}`;
    noticeWrap.classList.remove('hidden');
}

function showResetTokenNotice(type, message) {
    const noticeWrap = document.getElementById('reset-token-notice-wrap');
    const notice = document.getElementById('reset-token-notice');
    if (!noticeWrap || !notice) return;

    const styles = {
        error: 'text-rose-600 bg-rose-50 border border-rose-200',
        success: 'text-emerald-600 bg-emerald-50 border border-emerald-200',
        warning: 'text-amber-600 bg-amber-50 border border-amber-200'
    };
    const icons = {
        error: 'fa-triangle-exclamation',
        success: 'fa-circle-check',
        warning: 'fa-circle-exclamation'
    };

    noticeWrap.className = `my-4 px-3 py-2 rounded-xl text-xs font-semibold ${styles[type] || styles.error}`;
    notice.innerHTML = `<i class="fa-solid ${icons[type] || icons.error} me-1.5"></i>${message}`;
    noticeWrap.classList.remove('hidden');
}

function showRegisterAdminCard() {
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-admin-card');
    if (loginCard && registerCard) {
        loginCard.classList.add('hidden');
        registerCard.classList.remove('hidden');
        registerCard.classList.add('animate-fade-in');
    }
}

function hideRegisterAdminCard() {
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-admin-card');
    if (loginCard && registerCard) {
        registerCard.classList.add('hidden');
        loginCard.classList.remove('hidden');
        loginCard.classList.add('animate-fade-in');
    }
}
