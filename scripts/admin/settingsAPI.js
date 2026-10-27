// Settings API functions for System Settings Hub

export async function getSettings() {
    try {
        const response = await fetch("/backend/crud/settings.php", {
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
        const response = await fetch("/backend/crud/settings.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "save", ...settingsData }),
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
        const response = await fetch("/backend/crud/settings.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "export_backup" }),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Export Backup API Error: ", error);
        return { success: false, message: "Unable to generate backup." };
    }
}

export async function clearLogs() {
    try {
        const response = await fetch("/backend/crud/settings.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "clear_logs" }),
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
        const response = await fetch("/backend/crud/settings.php", {
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

export async function requestSecurityChange(securityData) {
    try {
        const response = await fetch("/backend/crud/settings.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "request_security_change", ...securityData }),
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
        const response = await fetch("/backend/crud/settings.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "confirm_security_change", code }),
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
        const response = await fetch("/backend/crud/settings.php", {
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

