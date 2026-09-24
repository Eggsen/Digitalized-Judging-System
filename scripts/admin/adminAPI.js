// Admin API functions for account management

export async function createAccount(accountData) {
    try {
        const response = await fetch("/backend/user/create_account.php", {
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
        const response = await fetch("/backend/user/list_accounts.php", {
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
        const response = await fetch("/backend/user/update_permissions.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId, is_active: isActive }),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Update permissions API Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}
