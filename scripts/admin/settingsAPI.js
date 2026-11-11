// Settings API functions for System Settings Hub

export async function getSettings() {
    try {
        const response = await fetch("/api/settings", {
            method: "GET",
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Get Settings API Error: ", error);
        return { success: false, message: "Unable to retrieve settings from server." };
    }
}

export async function saveSettings(settingsData) {
    try {
        const response = await fetch("/api/settings/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settingsData),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Save Settings API Error: ", error);
        return { success: false, message: "Unable to save settings to server." };
    }
}

export async function exportBackup() {
    try {
        const response = await fetch("/api/settings/export-backup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Export Backup API Error: ", error);
        return { success: false, message: "Unable to generate backup." };
    }
}

export async function clearLogs(confirmation = "Confirm") {
    try {
        const response = await fetch("/api/settings/clear-logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirmation }),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Clear Logs API Error: ", error);
        return { success: false, message: "Unable to clear logs." };
    }
}

export async function resetSettingsDefaults() {
    try {
        const response = await fetch("/api/settings/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reset_defaults" }),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Reset Settings API Error: ", error);
        return { success: false, message: "Unable to reset settings." };
    }
}

export async function requestSecurityChange(securityData, unlockToken = null) {
    try {
        const headers = { "Content-Type": "application/json" };
        if (unlockToken) {
            headers["x-unlock-token"] = unlockToken;
        }
        const payload = unlockToken ? { ...securityData, unlock_token: unlockToken } : securityData;
        const response = await fetch("/api/settings/security-controls", {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Request Security Change API Error: ", error);
        return { success: false, message: "Unable to request security change." };
    }
}

export async function confirmSecurityChange(code) {
    try {
        const response = await fetch("/api/settings/security-controls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Confirm Security Change API Error: ", error);
        return { success: false, message: "Unable to confirm security code." };
    }
}

export async function resendSecurityCode() {
    try {
        const response = await fetch("/api/settings/security-controls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "resend_security_code" }),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Resend Security Code API Error: ", error);
        return { success: false, message: "Unable to resend confirmation code." };
    }
}

export async function verifyAdminPin(pin) {
    try {
        const response = await fetch("/api/settings/verify-admin-pin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin }),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Verify Admin PIN API Error: ", error);
        return { success: false, message: "Unable to verify Admin PIN." };
    }
}

export async function saveApiKeys(apiKeysData, unlockToken = null) {
    try {
        const headers = { "Content-Type": "application/json" };
        if (unlockToken) {
            headers["x-unlock-token"] = unlockToken;
        }
        const response = await fetch("/api/settings/api-keys", {
            method: "POST",
            headers,
            body: JSON.stringify({ api_keys: apiKeysData, unlock_token: unlockToken }),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Save API Keys Error: ", error);
        return { success: false, message: "Unable to save API keys to server." };
    }
}


