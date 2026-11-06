async function parseResponse(response, defaultError = "Unable to connect to server.") {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("Non-JSON Server Response:", text);
        const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return {
            success: false,
            message: cleanText || `${defaultError} (HTTP ${response.status})`
        };
    }
}

export async function loginUser(credentials) {
    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(credentials),
            credentials: "include"
        });

        return await parseResponse(response, "Unable to connect to authentication server.");
    } catch (error) {
        console.error("Authentication API Error: ", error);
        return {
            success: false,
            message: "Unable to connect to authentication server. Please check your network connection and try again."
        };
    }
}

// Retain loginAdmin alias for backward compatibility
export const loginAdmin = loginUser;

export async function logoutUser() {
    try {
        const response = await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include"
        });
        return await parseResponse(response, "Network error during logout.");
    } catch (error) {
        console.error("Logout API Error: ", error);
        return { success: false, message: "Network error during logout." };
    }
}

export async function checkSession() {
    try {
        const response = await fetch("/api/auth/me", {
            method: "GET",
            credentials: "include"
        });
        return await parseResponse(response, "Check session failed.");
    } catch (error) {
        console.error("Check session API Error: ", error);
        return { authenticated: false };
    }
}

export async function resetPassword(payload) {
    try {
        const response = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include"
        });
        return await parseResponse(response, "Password reset failed.");
    } catch (error) {
        console.error("Reset password API Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}

export async function registerAdmin(payload) {
    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include"
        });
        return await parseResponse(response, "Admin registration failed.");
    } catch (error) {
        console.error("Register Admin API Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}

export async function verifyInviteToken(token) {
    try {
        const response = await fetch(`/api/auth/accept-invitation?token=${encodeURIComponent(token)}`, {
            method: "GET",
            credentials: "include"
        });
        return await parseResponse(response, "Verify invitation failed.");
    } catch (error) {
        console.error("Verify Invitation API Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}

export async function acceptInvitation(payload) {
    try {
        const response = await fetch("/api/auth/accept-invitation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include"
        });
        return await parseResponse(response, "Accept invitation failed.");
    } catch (error) {
        console.error("Accept Invitation API Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}