/**
 * API module for Contestants, Judging Criteria, Judging Period, and Scores
 */

// -------------------------------------------------------------
// CONTESTANTS API
// -------------------------------------------------------------
export async function getContestants(eventId) {
    try {
        const res = await fetch(`/api/contestants?event_id=${encodeURIComponent(eventId)}`, { credentials: "include" });
        return await res.json();
    } catch (e) {
        console.error("getContestants error: ", e);
        return { success: false, message: "Network error loading contestants." };
    }
}

export async function createContestant(data) {
    try {
        const res = await fetch("/api/contestants", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
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
        const id = data.id || data.contestant_id;
        const res = await fetch(`/api/contestants/${encodeURIComponent(id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
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
        const res = await fetch(`/api/contestants/${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("deleteContestant error: ", e);
        return { success: false, message: "Network error deleting contestant." };
    }
}

export async function addContestantComment(contestantId, commentText, memberName = '', awardTitle = '') {
    try {
        const res = await fetch(`/api/contestants/${encodeURIComponent(contestantId)}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                details: commentText,
                member_name: memberName,
                award_title: awardTitle || commentText
            }),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("addContestantComment error: ", e);
        return { success: false, message: "Network error adding comment." };
    }
}

export async function deleteContestantComment(contestantId, commentId) {
    try {
        const res = await fetch(`/api/contestants/${encodeURIComponent(contestantId)}/comments/${encodeURIComponent(commentId)}`, {
            method: "DELETE",
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("deleteContestantComment error: ", e);
        return { success: false, message: "Network error removing comment." };
    }
}

export async function updateTeamMembers(contestantId, teamMembers) {
    try {
        const res = await fetch(`/api/contestants/${encodeURIComponent(contestantId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ representation: teamMembers }),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("updateTeamMembers error: ", e);
        return { success: false, message: "Network error updating team members." };
    }
}

// -------------------------------------------------------------
// CRITERIA API
// -------------------------------------------------------------
export async function getCriteria(eventId) {
    try {
        const res = await fetch(`/api/criteria?event_id=${encodeURIComponent(eventId)}`, { credentials: "include" });
        return await res.json();
    } catch (e) {
        console.error("getCriteria error: ", e);
        return { success: false, message: "Network error loading criteria." };
    }
}

export async function createCriterion(data) {
    try {
        const res = await fetch("/api/criteria", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
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
        const id = data.id || data.criterion_id;
        const res = await fetch(`/api/criteria/${encodeURIComponent(id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
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
        const res = await fetch("/api/criteria/weights", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event_id: eventId, weights }),
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
        const res = await fetch(`/api/criteria/${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
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
        const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/judging-period`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ judging_status: action }),
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
        const res = await fetch(`/api/scores/matrix?event_id=${encodeURIComponent(eventId)}`, { credentials: "include" });
        return await res.json();
    } catch (e) {
        console.error("getScores error: ", e);
        return { success: false, message: "Network error retrieving scores." };
    }
}

export async function submitScore(data) {
    try {
        const res = await fetch("/api/scores/submit", {
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

export async function unlockJudgeScore(eventId, contestantId, judgeId, expectedVersion = null) {
    try {
        const payload = {
            event_id: String(eventId),
            contestant_id: contestantId,
            judge_id: judgeId,
            approve: true
        };
        if (expectedVersion !== null && expectedVersion !== undefined) {
            payload.expected_version = expectedVersion;
        }
        const res = await fetch("/api/scores/approve-unlock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("unlockJudgeScore error: ", e);
        return { success: false, message: "Network error unlocking score." };
    }
}

export async function selfUnlockJudgeScore(eventId, contestantId, expectedVersion = null) {
    try {
        const payload = {
            event_id: String(eventId),
            contestant_id: contestantId
        };
        if (expectedVersion !== null && expectedVersion !== undefined) {
            payload.expected_version = expectedVersion;
        }
        const res = await fetch("/api/scores/self-unlock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("selfUnlockJudgeScore error: ", e);
        return { success: false, message: "Network error self-unlocking score." };
    }
}

export async function verifyJudgeScore(eventId, contestantId, judgeId, expectedVersion = null) {
    try {
        const payload = {
            event_id: String(eventId),
            contestant_id: contestantId,
            judge_id: judgeId
        };
        if (expectedVersion !== null && expectedVersion !== undefined) {
            payload.expected_version = expectedVersion;
        }
        const res = await fetch("/api/scores/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("verifyJudgeScore error: ", e);
        return { success: false, message: "Network error verifying score." };
    }
}

export async function unverifyJudgeScore(eventId, contestantId, judgeId, expectedVersion = null) {
    try {
        const payload = {
            event_id: String(eventId),
            contestant_id: contestantId,
            judge_id: judgeId
        };
        if (expectedVersion !== null && expectedVersion !== undefined) {
            payload.expected_version = expectedVersion;
        }
        const res = await fetch("/api/scores/unverify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("unverifyJudgeScore error: ", e);
        return { success: false, message: "Network error revoking score verification." };
    }
}

export async function verifyAllJudgeScores(eventId) {
    try {
        const res = await fetch("/api/scores/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                event_id: String(eventId),
                verify_all: true
            }),
            credentials: "include"
        });
        return await res.json();
    } catch (e) {
        console.error("verifyAllJudgeScores error: ", e);
        return { success: false, message: "Network error verifying all scores." };
    }
}

// -------------------------------------------------------------
// MVCC SCORES VERSION HISTORY API
// -------------------------------------------------------------
export async function getScoreHistory(params = {}) {
    try {
        const q = new URLSearchParams();
        if (params.score_id) q.set('score_id', params.score_id);
        if (params.event_id) q.set('event_id', params.event_id);
        if (params.contestant_id) q.set('contestant_id', params.contestant_id);
        if (params.judge_id) q.set('judge_id', params.judge_id);

        const res = await fetch(`/api/scores/history?${q.toString()}`, { credentials: "include" });
        return await res.json();
    } catch (e) {
        console.error("getScoreHistory error: ", e);
        return { success: false, message: "Network error retrieving score history." };
    }
}

export async function getScoreVersionSnapshot(version, params = {}) {
    try {
        const q = new URLSearchParams();
        if (params.score_id) q.set('score_id', params.score_id);
        if (params.event_id) q.set('event_id', params.event_id);
        if (params.contestant_id) q.set('contestant_id', params.contestant_id);
        if (params.judge_id) q.set('judge_id', params.judge_id);

        const res = await fetch(`/api/scores/version/${encodeURIComponent(version)}?${q.toString()}`, { credentials: "include" });
        return await res.json();
    } catch (e) {
        console.error("getScoreVersionSnapshot error: ", e);
        return { success: false, message: "Network error retrieving score snapshot." };
    }
}

