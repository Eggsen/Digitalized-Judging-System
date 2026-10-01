import { resetPassword } from "/scripts/auth/authAPI.js";

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
}

async function handleResetRequestSubmit() {
    const identifier = document.getElementById('reset-identifier-input')?.value.trim() || '';
    const btn = document.getElementById('resetRequestBtn');
    const btnText = document.getElementById('reset-request-btn-text');
    const noticeWrap = document.getElementById('reset-notice-wrap');
    const notice = document.getElementById('reset-notice');

    if (!identifier) {
        showResetNotice('warning', 'Please enter your registered email address or username.');
        return;
    }

    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Sending Reset Link...';

    const res = await resetPassword({
        action: 'request_reset',
        identifier
    });

    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Send Reset Link';

    if (res.success) {
        if (noticeWrap && notice) {
            noticeWrap.className = 'mb-4 p-3 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200';
            notice.innerHTML = `
                <div class="mb-1 font-bold"><i class="fa-solid fa-circle-check text-emerald-500 me-1"></i> ${res.message}</div>
                ${res.reset_link ? `
                    <div class="text-[11px] font-normal text-slate-600 mt-2 mb-1">Testing reset link:</div>
                    <div class="flex items-center gap-1.5">
                        <input type="text" readonly value="${res.reset_link}" id="demo-reset-link" class="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-mono text-slate-800 focus:outline-none" />
                        <a href="${res.reset_link}" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[11px] transition-colors shrink-0">Open Link</a>
                    </div>
                ` : ''}
            `;
            noticeWrap.classList.remove('hidden');
        }
    } else {
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
