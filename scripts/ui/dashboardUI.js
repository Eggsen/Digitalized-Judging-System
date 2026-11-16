import { logoutUser } from "/scripts/auth/authAPI.js";

// MVCC: Global Session Concurrency Interceptor
// Detects when the current session was superseded by another device and redirects gracefully
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    if (response.status === 401) {
        try {
            const clone = response.clone();
            const data = await clone.json();
            if (data && (data.code === 'SESSION_SUPERSEDED' || data.session_expired)) {
                window.location.href = '/auth/login?error=session_superseded';
            }
        } catch (e) {}
    }
    return response;
};

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await logoutUser();
    window.location.href = '/auth/login';
});
