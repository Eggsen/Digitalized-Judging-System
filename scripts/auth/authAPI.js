export async function loginUser(credentials) {
    try {
        const response = await fetch("/backend/auth/login.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(credentials),
            credentials: "include"
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Authentication API Error: ", error);
        return {
            success: false,
            message: "Unable to connect to authentication server."
        };
    }
}

// Retain loginAdmin alias for backward compatibility
export const loginAdmin = loginUser;

export async function logoutUser() {
    try {
        const response = await fetch("/backend/auth/logout.php", {
            method: "POST",
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Logout API Error: ", error);
        return { success: false, message: "Network error during logout." };
    }
}

export async function checkSession() {
    try {
        const response = await fetch("/backend/auth/check_session.php", {
            method: "GET",
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Check session API Error: ", error);
        return { authenticated: false };
    }
}

export async function resetPassword(payload) {
    try {
        const response = await fetch("/backend/auth/reset_password.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Reset password API Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}

export async function registerAdmin(payload) {
    try {
        const response = await fetch("/backend/auth/register_admin.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Register Admin API Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}