export async function listEvents() {
    try {
        const res = await fetch("/api/events", { credentials: "include" });
        return await res.json();
    } catch (e) {
        console.error("listEvents API error: ", e);
        return { success: false, message: "Network error listing events." };
    }
}

export async function createEvent(data) {
    try {
        const res = await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("createEvent API error: ", e);
        return { success: false, message: "Network error creating event." };
    }
}

export async function editEvent(data) {
    try {
        const eventId = data.event_id || data.id;
        const res = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("editEvent API error: ", e);
        return { success: false, message: "Network error updating event." };
    }
}

export async function assignJudges(data) {
    try {
        const eventId = data.event_id || data.id;
        const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/assign-judges`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("assignJudges API error: ", e);
        return { success: false, message: "Network error assigning judges." };
    }
}

export async function archiveEvent(data) {
    try {
        const eventId = data.event_id || data.id;
        const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/archive`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("archiveEvent API error: ", e);
        return { success: false, message: "Network error archiving event." };
    }
}

export async function deleteArchivedEvent(data) {
    try {
        const eventId = data.event_id || data.id;
        const res = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("deleteArchivedEvent API error: ", e);
        return { success: false, message: "Network error deleting archived event." };
    }
}

export async function listLogs(params = {}) {
    try {
        const query = new URLSearchParams();
        if (params.page !== undefined && params.page !== null && params.page !== '') {
            query.set('page', params.page);
        }
        if (params.limit !== undefined && params.limit !== null && params.limit !== '') {
            query.set('limit', params.limit);
        }
        if (params.search !== undefined && params.search !== null && params.search !== '') {
            query.set('search', params.search);
        }

        const qs = query.toString();
        const url = `/api/logs${qs ? `?${qs}` : ''}`;
        const res = await fetch(url, { credentials: "include" });
        return await res.json();
    } catch (e) {
        console.error("listLogs API error: ", e);
        return { success: false, message: "Network error fetching logs." };
    }
}
