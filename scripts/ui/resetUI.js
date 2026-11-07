import { resetPassword } from "/scripts/auth/authAPI.js";
import { renderRecaptchaWidget, getRecaptchaResponse, resetRecaptchaWidget } from "/scripts/utils/index.js";

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

    // Request reset form
    document.getElementById('resetRequestForm')?.addEventListener('submit', handleResetRequestSubmit);
}

function showForgotPasswordCard() {
    document.getElementById('login-card')?.classList.add('hidden');
    const forgotCard = document.getElementById('forgot-password-card');
    if (forgotCard) {
        forgotCard.classList.remove('hidden');
        forgotCard.classList.add('animate-fade-in');

        // Render reCAPTCHA widget into reset-recaptcha container if enabled
        if (window.RECAPTCHA_ENABLED === true) {
            const resetWrap = document.getElementById('reset-recaptcha-wrapper');
            if (resetWrap) {
                resetWrap.classList.remove('hidden');
                resetWrap.style.display = '';
            }
            renderRecaptchaWidget('reset-recaptcha');
        } else {
            const resetWrap = document.getElementById('reset-recaptcha-wrapper');
            if (resetWrap) {
                resetWrap.classList.add('hidden');
                resetWrap.style.display = 'none';
            }
        }

        if (window.EMAIL_SERVICE_ENABLED === false) {
            showResetNotice('warning', 'The administrator has disabled email notifications. Password reset links cannot be emailed.');
            const btn = document.getElementById('resetRequestBtn');
            if (btn) btn.disabled = true;
        }
    }
}

function hideForgotPasswordCard() {
    const identifierInput = document.getElementById('reset-identifier-input');
    if (identifierInput) identifierInput.value = '';

    const noticeWrap = document.getElementById('reset-notice-wrap');
    if (noticeWrap) noticeWrap.classList.add('hidden');

    document.getElementById('forgot-password-card')?.classList.add('hidden');
    document.getElementById('login-card')?.classList.remove('hidden');
    document.getElementById('login-card')?.classList.add('animate-fade-in');
    if (window.RECAPTCHA_ENABLED === true) {
        renderRecaptchaWidget('login-recaptcha');
    }
}

async function handleResetRequestSubmit() {
    if (window.EMAIL_SERVICE_ENABLED === false) {
        showResetNotice('error', 'The email notification service has been disabled by the administrator. You cannot receive a password reset email at this time.');
        return;
    }

    const identifier = document.getElementById('reset-identifier-input')?.value.trim() || '';
    const btn = document.getElementById('resetRequestBtn');
    const btnText = document.getElementById('reset-request-btn-text');
    const noticeWrap = document.getElementById('reset-notice-wrap');
    const notice = document.getElementById('reset-notice');

    if (!identifier) {
        showResetNotice('warning', 'Please enter your registered email address.');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(identifier)) {
        showResetNotice('warning', 'Please enter a valid email address.');
        return;
    }

    const recaptchaToken = getRecaptchaResponse('reset-recaptcha');
    if (window.RECAPTCHA_ENABLED === true && !recaptchaToken) {
        showResetNotice('warning', 'Please complete the reCAPTCHA verification challenge.');
        return;
    }

    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Sending Reset Link...';

    const res = await resetPassword({
        action: 'request_reset',
        email: identifier,
        identifier,
        recaptcha_response: recaptchaToken
    });

    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Send Reset Link';

    if (res.success) {
        if (noticeWrap && notice) {
            noticeWrap.className = 'mb-4 p-3.5 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 space-y-1';
            notice.innerHTML = `
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-circle-check text-emerald-600 text-sm shrink-0"></i>
                    <span>${res.message || 'Password reset link sent to your email.'}</span>
                </div>
                <p class="text-[11px] font-normal text-emerald-800 ps-6">Please check your inbox or spam folder for password reset instructions.</p>
            `;
            noticeWrap.classList.remove('hidden');
        }
        const form = document.getElementById('resetRequestForm');
        if (form) form.reset();
        resetRecaptchaWidget('reset-recaptcha');
    } else {
        resetRecaptchaWidget('reset-recaptcha');
        showResetNotice('error', res.message || 'Failed to send reset link.');
    }
}

function showResetNotice(type, message) {
    const noticeWrap = document.getElementById('reset-notice-wrap');
    const notice = document.getElementById('reset-notice');
    if (!noticeWrap || !notice) return;

    const colorMap = {
        error: 'text-rose-600 bg-rose-50 border border-rose-200',
        success: 'text-emerald-600 bg-emerald-50 border border-emerald-200',
        warning: 'text-amber-600 bg-amber-50 border border-amber-200'
    };
    const iconMap = {
        error: 'fa-triangle-exclamation',
        success: 'fa-circle-check',
        warning: 'fa-circle-exclamation'
    };

    noticeWrap.className = `mb-4 px-3 py-2 rounded-xl text-xs font-semibold ${colorMap[type] || colorMap.error}`;
    notice.innerHTML = `<i class="fa-solid ${iconMap[type] || iconMap.error} me-1.5"></i>${message}`;
    noticeWrap.classList.remove('hidden');
}
