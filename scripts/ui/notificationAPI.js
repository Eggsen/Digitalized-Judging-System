// Notification API client functions

export async function fetchNotifications() {
    try {
        const response = await fetch("/backend/notifications/list_notifications.php", {
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
        const response = await fetch("/backend/notifications/respond_invitation.php", {
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
        const response = await fetch("/backend/notifications/mark_read.php", {
            method: "POST",
            credentials: "include"
        });
        return await response.json();
    } catch (error) {
        console.error("Mark read Error: ", error);
        return { success: false, message: "Unable to connect to server." };
    }
}
