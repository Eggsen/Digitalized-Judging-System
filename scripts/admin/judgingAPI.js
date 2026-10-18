/**
 * API module for Contestants, Judging Criteria, Judging Period, and Scores
 */

// -------------------------------------------------------------
// CONTESTANTS API
// -------------------------------------------------------------
export async function getContestants(eventId) {
    try {
        const res = await fetch(`/backend/crud/contestants.php?event_id=${encodeURIComponent(eventId)}`, { credentials: "include" });
        return await res.json();
    } catch (e) {
        console.error("getContestants error: ", e);
        return { success: false, message: "Network error loading contestants." };
    }
}

export async function createContestant(data) {
    try {
        const res = await fetch("/backend/crud/contestants.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "create", ...data }),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("createContestant error: ", e);
        return { success: false, message: "Network error adding contestant." };
    }
}

export async function editContestant(data) {
    try {
        const res = await fetch("/backend/crud/contestants.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "edit", ...data }),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("editContestant error: ", e);
        return { success: false, message: "Network error updating contestant." };
    }
}

export async function deleteContestant(id) {
    try {
        const res = await fetch("/backend/crud/contestants.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete", id }),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("deleteContestant error: ", e);
        return { success: false, message: "Network error deleting contestant." };
    }
}

// -------------------------------------------------------------
// CRITERIA API
// -------------------------------------------------------------
export async function getCriteria(eventId) {
    try {
        const res = await fetch(`/backend/crud/criteria.php?event_id=${encodeURIComponent(eventId)}`, { credentials: "include" });
        return await res.json();
    } catch (e) {
        console.error("getCriteria error: ", e);
        return { success: false, message: "Network error loading criteria." };
    }
}

export async function createCriterion(data) {
    try {
        const res = await fetch("/backend/crud/criteria.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "create", ...data }),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("createCriterion error: ", e);
        return { success: false, message: "Network error adding criterion." };
    }
}

export async function editCriterion(data) {
    try {
        const res = await fetch("/backend/crud/criteria.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "edit", ...data }),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("editCriterion error: ", e);
        return { success: false, message: "Network error updating criterion." };
    }
}

export async function updateCriteriaWeights(eventId, weights) {
    try {
        const res = await fetch("/backend/crud/criteria.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "update_weights", event_id: eventId, weights }),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("updateCriteriaWeights error: ", e);
        return { success: false, message: "Network error configuring weights." };
    }
}

export async function deleteCriterion(id) {
    try {
        const res = await fetch("/backend/crud/criteria.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete", id }),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("deleteCriterion error: ", e);
        return { success: false, message: "Network error deleting criterion." };
    }
}

// -------------------------------------------------------------
// JUDGING PERIOD API
// -------------------------------------------------------------
export async function toggleJudgingPeriod(eventId, action) {
    try {
        const res = await fetch("/backend/crud/judging_period.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event_id: eventId, action }),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("toggleJudgingPeriod error: ", e);
        return { success: false, message: "Network error controlling judging period." };
    }
}

// -------------------------------------------------------------
// SCORES API
// -------------------------------------------------------------
export async function getScores(eventId) {
    try {
        const res = await fetch(`/backend/crud/scores.php?event_id=${encodeURIComponent(eventId)}`, { credentials: "include" });
        return await res.json();
    } catch (e) {
        console.error("getScores error: ", e);
        return { success: false, message: "Network error retrieving scores." };
    }
}

export async function submitScore(data) {
    try {
        const res = await fetch("/backend/crud/scores.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("submitScore error: ", e);
        return { success: false, message: "Network error submitting score." };
    }
}
