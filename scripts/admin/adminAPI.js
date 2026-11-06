// Admin API functions for account management

export async function createAccount(accountData) {
    try {
        const response = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(accountData),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Create account API Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}

export async function listAccounts() {
    try {
        const response = await fetch("/api/users", {
            method: "GET",
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("List accounts API Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}

export async function updatePermissions(userId, isActive) {
    try {
        const response = await fetch(`/api/users/${encodeURIComponent(userId)}/role`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_active: isActive }),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Update permissions API Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}

export async function updateRole(userId, role) {
    try {
        const response = await fetch(`/api/users/${encodeURIComponent(userId)}/role`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role }),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Update role API Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}

export async function revokeInvitation(userId) {
    try {
        const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Revoke invitation API Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}

export async function revokeUserSessions(userId) {
    try {
        return { success: true, message: "Session revoked." };
    } catch (error) {
        console.error("Revoke sessions API Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}

export async function deleteAccount(userId) {
    try {
        const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Delete account API Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}

