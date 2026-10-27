async function parseResponse(response, defaultError = "Unable to connect to server.") {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        // Fallback: Check if valid JSON object is embedded within text (e.g. if PHP emitted warnings/notices)
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            try {
                return JSON.parse(text.substring(jsonStart, jsonEnd + 1));
            } catch (innerError) {
                // Ignore and fall through to error reporting
            }
        }

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
        const response = await fetch("/backend/auth/login.php", {
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
            message: "Unable to connect to authentication server. Please verify your network and ensure PHP server is running on localhost:8000."
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
        return await parseResponse(response, "Network error during logout.");
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
        return await parseResponse(response, "Check session failed.");
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
        return await parseResponse(response, "Password reset failed.");
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
        return await parseResponse(response, "Admin registration failed.");
    } catch (error) {
        console.error("Register Admin API Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}

export async function verifyInviteToken(token) {
    try {
        const response = await fetch(`/backend/auth/accept_invitation.php?token=${encodeURIComponent(token)}`, {
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
        const response = await fetch("/backend/auth/accept_invitation.php", {
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