import { loginUser } from "./auth/authAPI.js";
import { showNotice } from "./utils/index.js";

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
});
