import { loginUser, verifyLoginPin } from "./auth/authAPI.js";
import { showNotice, togglePasswordVisibility, getRecaptchaResponse, resetRecaptchaWidget, renderRecaptchaWidget } from "./utils/index.js";

document.addEventListener("DOMContentLoaded", () => {
    // Ensure primary login recaptcha is rendered as early as possible
    renderRecaptchaWidget('login-recaptcha');

    const loginForm = document.getElementById("loginForm");
    const noticeText = document.getElementById("notice-text");
    const usernameInput = document.getElementById("username-input");
    const passwordInput = document.getElementById("password-input");
    const adminPinGroup = document.getElementById("login-admin-pin-group");
    const adminPinInput = document.getElementById("login-admin-pin-input");
    const cancelPinBtn = document.getElementById("cancel-admin-pin-btn");
    const loginBtnText = document.getElementById("login-btn-text");
    const submitBtn = loginForm ? loginForm.querySelector("button[type='submit']") : null;
    const googleBtn = document.getElementById("google-login-btn");
    const googleDivider = document.getElementById("google-or-divider");
    const recaptchaWrapper = document.getElementById("login-recaptcha-wrapper");
    const forgotPasswordLink = document.getElementById("forgot-password-link");

    let activeChallengeToken = null;

    function switchToPinChallenge(challengeToken, message) {
        activeChallengeToken = challengeToken;
        if (usernameInput) usernameInput.disabled = true;
        if (passwordInput) {
            passwordInput.disabled = true;
            passwordInput.closest('.relative')?.parentElement?.classList.add('hidden');
        }
        if (googleBtn) googleBtn.classList.add('hidden');
        if (googleDivider) googleDivider.classList.add('hidden');
        if (recaptchaWrapper) recaptchaWrapper.classList.add('hidden');
        if (forgotPasswordLink) forgotPasswordLink.classList.add('hidden');

        if (adminPinGroup) adminPinGroup.classList.remove('hidden');
        if (adminPinInput) {
            adminPinInput.value = '';
            adminPinInput.disabled = false;
        }
        if (loginBtnText) loginBtnText.textContent = "Verify Admin PIN & Sign In";
        if (submitBtn) submitBtn.disabled = false;

        if (message) {
            showNotice(noticeText, message, "warning");
        }
        setTimeout(() => adminPinInput?.focus(), 100);
    }

    function resetPinChallenge() {
        activeChallengeToken = null;
        if (adminPinGroup) adminPinGroup.classList.add('hidden');
        if (adminPinInput) {
            adminPinInput.value = '';
            adminPinInput.disabled = false;
        }
        if (usernameInput) usernameInput.disabled = false;
        if (passwordInput) {
            passwordInput.disabled = false;
            passwordInput.closest('.relative')?.parentElement?.classList.remove('hidden');
        }
        if (googleBtn) googleBtn.classList.remove('hidden');
        if (googleDivider) googleDivider.classList.remove('hidden');
        if (recaptchaWrapper) recaptchaWrapper.classList.remove('hidden');
        if (forgotPasswordLink) forgotPasswordLink.classList.remove('hidden');
        if (loginBtnText) loginBtnText.textContent = "Sign In";
        if (submitBtn) submitBtn.disabled = false;

        showNotice(noticeText, "Sign in with your email and password.", "info");
    }

    if (cancelPinBtn) {
        cancelPinBtn.addEventListener("click", () => {
            resetPinChallenge();
        });
    }

    // Check if redirected from Google OAuth with an Admin PIN 2FA challenge
    const urlParams = new URLSearchParams(window.location.search);
    const googleChallenge = urlParams.get('admin_pin_challenge');
    const googleEmail = urlParams.get('email');

    if (googleChallenge) {
        if (googleEmail && usernameInput) {
            usernameInput.value = googleEmail;
        }
        switchToPinChallenge(googleChallenge, "Google account verified. Please enter your exclusive Admin PIN to continue.");
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            // 1. PIN Challenge Mode
            if (activeChallengeToken) {
                const enteredPin = adminPinInput ? adminPinInput.value.trim() : "";
                if (!enteredPin) {
                    showNotice(noticeText, "Please enter your exclusive Admin PIN.", "warning");
                    adminPinInput?.focus();
                    return;
                }

                if (submitBtn) submitBtn.disabled = true;
                showNotice(noticeText, "Verifying Admin PIN...", "info");

                const response = await verifyLoginPin({
                    challenge_token: activeChallengeToken,
                    admin_pin: enteredPin
                });

                if (response && response.success) {
                    if (adminPinInput) adminPinInput.disabled = true;
                    showNotice(noticeText, response.message || "Admin verification successful! Redirecting...", "success");
                    setTimeout(() => {
                        const searchParams = new URLSearchParams(window.location.search);
                        const redirectTo = searchParams.get('redirect_to');
                        if (redirectTo && redirectTo.startsWith('/')) {
                            window.location.href = redirectTo;
                        } else {
                            window.location.href = response.redirect || "/dashboard";
                        }
                    }, 700);
                    return;
                }

                // Verification failed - check for account lockout
                if (response && response.is_locked) {
                    showNotice(noticeText, response.message || "This admin account has been locked due to too many failed attempts.", "error");
                    if (submitBtn) submitBtn.disabled = true;
                    if (adminPinInput) adminPinInput.disabled = true;
                    return;
                }

                if (submitBtn) submitBtn.disabled = false;

                // Check for expired challenge token
                if (response && (response.message?.includes("expired") || response.message?.includes("Invalid challenge"))) {
                    showNotice(noticeText, response.message, "error");
                    setTimeout(() => resetPinChallenge(), 2000);
                    return;
                }

                // Incorrect PIN with remaining attempts
                showNotice(noticeText, response ? response.message : "Incorrect Admin PIN.", "error");
                if (adminPinInput) {
                    adminPinInput.value = "";
                    adminPinInput.focus();
                }
                return;
            }

            // 2. Standard Email + Password Mode
            const identifier = usernameInput ? usernameInput.value.trim() : "";
            const password = passwordInput ? passwordInput.value : "";

            if (!identifier || !password) {
                showNotice(noticeText, "Please enter your email and password.", "warning");
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(identifier)) {
                showNotice(noticeText, "Please enter a valid email address.", "warning");
                return;
            }

            const recaptchaToken = getRecaptchaResponse('login-recaptcha');
            if (window.RECAPTCHA_ENABLED === true && window.RECAPTCHA_SITE_KEY && !recaptchaToken) {
                showNotice(noticeText, "Please verify that you are not a robot.", "warning");
                return;
            }

            // Disable submit button during request
            if (submitBtn) submitBtn.disabled = true;
            showNotice(noticeText, "Signing in...", "info");

            const response = await loginUser({
                email: identifier,
                identifier,
                password,
                recaptcha_response: recaptchaToken
            });

            // Administrator PIN verification challenge returned by backend
            if (response && response.require_admin_pin) {
                switchToPinChallenge(
                    response.challenge_token,
                    response.message || "Administrator verification required: Please enter your exclusive Admin PIN."
                );
                return;
            }

            if (response && response.success) {
                showNotice(noticeText, response.message || "Login successful! Redirecting...", "success");
                setTimeout(() => {
                    const searchParams = new URLSearchParams(window.location.search);
                    const redirectTo = searchParams.get('redirect_to');
                    if (redirectTo && redirectTo.startsWith('/')) {
                        window.location.href = redirectTo;
                    } else {
                        window.location.href = response.redirect || "/dashboard";
                    }
                }, 700);
                return;
            }

            // Account locked on password attempts
            if (response && response.is_locked) {
                showNotice(noticeText, response.message, "error");
                if (submitBtn) submitBtn.disabled = true;
                if (usernameInput) usernameInput.disabled = true;
                if (passwordInput) passwordInput.disabled = true;
                return;
            }

            if (submitBtn) submitBtn.disabled = false;
            resetRecaptchaWidget('login-recaptcha');
            showNotice(noticeText, response ? response.message : "Authentication failed.", "error");
        });
    }
});
