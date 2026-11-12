// Notification API client functions

export async function fetchNotifications() {
    try {
        const response = await fetch("/api/notifications", {
            method: "GET",
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Fetch notifications Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}

export async function respondToInvitation(notificationId, action) {
    try {
        const response = await fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notification_id: notificationId, action: action }),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Respond invitation Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}

export async function markNotificationsRead() {
    try {
        const response = await fetch("/api/notifications/all/read", {
            method: "PATCH",
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Mark read Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}

export async function updateNotificationRead(notificationId, isRead = true) {
    try {
        const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_read: isRead }),
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Update notification read Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}
