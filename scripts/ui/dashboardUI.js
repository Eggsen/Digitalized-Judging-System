import { logoutUser } from "/scripts/auth/authAPI.js";

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await logoutUser();
    window.location.reload();
});
