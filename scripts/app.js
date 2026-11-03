import { loginUser } from "./auth/authAPI.js";
import { showNotice, togglePasswordVisibility, getRecaptchaResponse, resetRecaptchaWidget, renderRecaptchaWidget } from "./utils/index.js";

document.addEventListener("DOMContentLoaded", () => {
    // Ensure primary login recaptcha is rendered as early as possible
    renderRecaptchaWidget('login-recaptcha');

    const loginForm = document.getElementById("loginForm");
    const noticeText = document.getElementById("notice-text");

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const usernameInput = document.getElementById("username-input");
            const passwordInput = document.getElementById("password-input");

            const identifier = usernameInput ? usernameInput.value.trim() : "";
            const password = passwordInput ? passwordInput.value : "";

            if (!identifier || !password) {
                showNotice(noticeText, "Please enter your username/email and password.", "warning");
                return;
            }

            const recaptchaToken = getRecaptchaResponse('login-recaptcha');
            if (window.RECAPTCHA_SITE_KEY && window.RECAPTCHA_ENABLED !== false && !recaptchaToken) {
                showNotice(noticeText, "Please verify that you are not a robot.", "warning");
                return;
            }

            // Disable submit button during request
            const submitBtn = loginForm.querySelector("button[type='submit']");
            if (submitBtn) submitBtn.disabled = true;

            showNotice(noticeText, "Signing in...", "info");

            const response = await loginUser({ identifier, password, recaptcha_response: recaptchaToken });

            if (submitBtn) submitBtn.disabled = false;

            if (response && response.success) {
                showNotice(noticeText, response.message || "Login successful! Redirecting...", "success");
                setTimeout(() => {
                    window.location.href = response.redirect || "/dashboard.php";
                }, 700);
            } else {
                resetRecaptchaWidget('login-recaptcha');
                showNotice(noticeText, response ? response.message : "Authentication failed.", "error");
            }
        });
    }

    document.getElementById('toggle-password-btn')?.addEventListener('click', () => {
        togglePasswordVisibility('password-input', 'toggle-password-icon');
    });
});
