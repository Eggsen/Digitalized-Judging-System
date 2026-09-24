import { loginUser } from "./auth/authAPI.js";

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

            const noticeContainer = noticeText ? noticeText.parentElement : null;

            if (!identifier || !password) {
                showNotice("Please enter your username/email and password.", "warning");
                return;
            }

            // Disable submit button during request
            const submitBtn = loginForm.querySelector("button[type='submit']");
            if (submitBtn) submitBtn.disabled = true;

            showNotice("Signing in...", "info");

            const response = await loginUser({ identifier, password, role });

            if (submitBtn) submitBtn.disabled = false;

            if (response && response.success) {
                showNotice(response.message || "Login successful! Redirecting...", "success");
                setTimeout(() => {
                    window.location.href = response.redirect || "index.php";
                }, 700);
            } else {
                showNotice(response ? response.message : "Authentication failed.", "error");
            }
        });
    }

    function showNotice(message, type = "error") {
        if (!noticeText) return;
        const container = noticeText.parentElement;

        let icon = "fa-triangle-exclamation";
        let colorClass = "text-rose-600 bg-rose-50 border border-rose-200";

        if (type === "success") {
            icon = "fa-circle-check";
            colorClass = "text-emerald-600 bg-emerald-50 border border-emerald-200";
        } else if (type === "info") {
            icon = "fa-spinner fa-spin";
            colorClass = "text-buksu-navy bg-slate-100 border border-slate-200";
        } else if (type === "warning") {
            icon = "fa-circle-exclamation";
            colorClass = "text-amber-600 bg-amber-50 border border-amber-200";
        }

        noticeText.innerHTML = `<i class="fa-solid ${icon} me-1.5"></i> ${message}`;
        if (container) {
            container.className = `text-center px-3 py-2 rounded-xl text-xs font-semibold ${colorClass} transition-all duration-200 block`;
        }
    }
});
