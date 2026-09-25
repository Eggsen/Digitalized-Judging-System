import { loginUser, registerAdmin } from "./auth/authAPI.js";
import { showNotice, togglePasswordVisibility } from "./utils/index.js";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const noticeText = document.getElementById("notice-text");

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const usernameInput = document.getElementById("username-input");
            const passwordInput = document.getElementById("password-input");

            const identifier = usernameInput ? usernameInput.value.trim() : "";
            const password = passwordInput ? passwordInput.value : "";
            const role = window.getSelectedRole ? window.getSelectedRole() : "admin";

            if (!identifier || !password) {
                showNotice(noticeText, "Please enter your username/email and password.", "warning");
                return;
            }

            // Disable submit button during request
            const submitBtn = loginForm.querySelector("button[type='submit']");
            if (submitBtn) submitBtn.disabled = true;

            showNotice(noticeText, "Signing in...", "info");

            const response = await loginUser({ identifier, password, role });

            if (submitBtn) submitBtn.disabled = false;

            if (response && response.success) {
                showNotice(noticeText, response.message || "Login successful! Redirecting...", "success");
                setTimeout(() => {
                    window.location.href = response.redirect || "index.php";
                }, 700);
            } else {
                showNotice(noticeText, response ? response.message : "Authentication failed.", "error");
            }
        });
    }

    const registerAdminForm = document.getElementById("registerAdminForm");
    const regNoticeText = document.getElementById("register-notice-text");

    if (registerAdminForm) {
        registerAdminForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const username = document.getElementById("reg-username-input")?.value.trim() || "";
            const email = document.getElementById("reg-email-input")?.value.trim() || "";
            const password = document.getElementById("reg-password-input")?.value || "";
            const confirmPassword = document.getElementById("reg-confirm-password-input")?.value || "";

            if (!username || !password) {
                showNotice(regNoticeText, "Username and password are required.", "warning");
                return;
            }

            if (password.length < 6) {
                showNotice(regNoticeText, "Password must be at least 6 characters long.", "warning");
                return;
            }

            if (password !== confirmPassword) {
                showNotice(regNoticeText, "Passwords do not match.", "error");
                return;
            }

            const regBtn = document.getElementById("registerAdminBtn");
            const regBtnText = document.getElementById("reg-btn-text");
            if (regBtn) regBtn.disabled = true;
            if (regBtnText) regBtnText.textContent = "Registering...";

            showNotice(regNoticeText, "Creating Admin account...", "info");

            const response = await registerAdmin({ username, email, password, confirm_password: confirmPassword });

            if (regBtn) regBtn.disabled = false;
            if (regBtnText) regBtnText.textContent = "Register Admin Account";

            if (response && response.success) {
                showNotice(regNoticeText, response.message || "Admin registered successfully!", "success");
                setTimeout(() => {
                    // Populate login username input and switch back to login card
                    const usernameInput = document.getElementById("username-input");
                    if (usernameInput) usernameInput.value = username;

                    const loginCard = document.getElementById("login-card");
                    const registerCard = document.getElementById("register-admin-card");
                    if (loginCard && registerCard) {
                        registerCard.classList.add("hidden");
                        loginCard.classList.remove("hidden");
                        loginCard.classList.add("animate-fade-in");
                    }
                }, 1200);
            } else {
                showNotice(regNoticeText, response ? response.message : "Registration failed.", "error");
            }
        });
    }

    document.getElementById('toggle-password-btn')?.addEventListener('click', () => {
        togglePasswordVisibility('password-input', 'toggle-password-icon');
    });

    document.getElementById('toggle-reg-password-btn')?.addEventListener('click', () => {
        togglePasswordVisibility('reg-password-input', 'toggle-reg-password-icon');
    });

    document.getElementById('toggle-reg-confirm-pw-btn')?.addEventListener('click', () => {
        togglePasswordVisibility('reg-confirm-password-input', 'toggle-reg-confirm-pw-icon');
    });
});
