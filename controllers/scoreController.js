const { collections } = require('../config/db');
const { logSystemAction } = require('../utils/logger');
const { triggerPusherEvent } = require('../utils/pusher');
const { getIdFilter, getEventIdQuery } = require('../utils/dbHelpers');

/**
 * Helper to build score filter
 */
function getScoreQuery(eventId, contestantId, judgeId) {
    const conditions = [];

    const strEv = String(eventId);
    const strCt = String(contestantId);
    const strJg = String(judgeId);

    conditions.push({ event_id: strEv, contestant_id: strCt, judge_id: strJg });

    const numEv = Number(eventId);
    if (!isNaN(numEv) && Number.isInteger(numEv)) {
        conditions.push({ event_id: numEv, contestant_id: strCt, judge_id: strJg });
    }

    return conditions.length === 1 ? conditions[0] : { $or: conditions };
}

/**
 * Helper to record immutable MVCC version snapshot in score_versions collection
 */
async function recordScoreVersion({
    scoreId,
    version,
    eventId,
    contestantId,
    judgeId,
    judgeName,
    criteriaScores,
    totalScore,
    comments,
    status,
    isLocked,
    isVerified,
    verifiedBy,
    verifiedAt,
    action,
    changeSummary,
    modifiedBy,
    now
}) {
    try {
        if (!collections.score_versions) return;
        const snapshot = {
            score_id: String(scoreId),
            version: Number(version),
            event_id: String(eventId),
            contestant_id: String(contestantId),
            judge_id: String(judgeId),
            judge_name: judgeName || 'Judge',
            criteria_scores: Array.isArray(criteriaScores) ? criteriaScores : [],
            total_score: typeof totalScore === 'number' ? totalScore : (parseFloat(totalScore) || 0),
            comments: comments || '',
            status: status || 'draft',
            is_locked: Boolean(isLocked),
            is_verified: Boolean(isVerified),
            verified_by: verifiedBy || null,
            verified_at: verifiedAt || null,
            action: action || 'VERSION_RECORDED',
            change_summary: changeSummary || `Score updated to v${version}`,
            modified_by: {
                id: String(modifiedBy?.id || judgeId),
                username: modifiedBy?.username || judgeName || 'Unknown',
                role: (modifiedBy?.role || 'judge').toLowerCase()
            },
            created_at: now || new Date().toISOString()
        };
        await collections.score_versions.insertOne(snapshot);
    } catch (err) {
        console.error('[MVCC] Failed to write score version snapshot:', err.message);
    }
}

/**
 * Submit / Update Judge Score (Draft or Official Submission with MVCC OCC)
 */
async function submitScore(req, res, next) {
    try {
        const { event_id, contestant_id, criteria_scores, comments, is_locked, action } = req.body;
        const judgeId = String(req.body.judge_id || req.user.id);
        const judgeName = req.body.judge_name || req.user.full_name || req.user.username;

        // Parse optional expected version for Optimistic Concurrency Control (OCC)
        const expectedVersion = req.body.expected_version !== undefined 
            ? parseInt(req.body.expected_version, 10) 
            : (req.body.version !== undefined ? parseInt(req.body.version, 10) : null);

        if (!event_id || !contestant_id || !criteria_scores) {
            return res.status(400).json({ success: false, message: 'Missing required scoring payload fields.' });
        }

        // Check if competition event exists and is open
        const evQuery = getIdFilter(event_id);
        const event = await collections.events.findOne(evQuery);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Competition event not found.' });
        }

        const jStatus = event.judgingStatus || event.judging_status;
        if (jStatus === 'Finished' || event.status === 'Completed') {
            return res.status(403).json({ success: false, message: 'Judging period is officially finished for this event.' });
        }

        // Find existing score
        const scoreQuery = getScoreQuery(event_id, contestant_id, judgeId);
        const existingScore = await collections.scores.findOne(scoreQuery);

        const settings = await collections.settings.findOne({ _id: 'system_settings' });
        const rawPolicy = String(settings?.judging?.unlockPolicy || '').trim().toLowerCase();
        const isSelfUnlock = rawPolicy === 'judge_self_unlock' || rawPolicy === 'judge-self-unlock' || rawPolicy.includes('self_unlock');

        if (existingScore && existingScore.is_locked && !req.body.force_admin_override && req.user.role !== 'admin') {
            if (!isSelfUnlock) {
                return res.status(403).json({ success: false, message: 'Your score has been submitted and locked. Request an unlock to make changes.' });
            }
        }

        // MVCC Concurrency Check: Verify expected version against existing score
        if (existingScore && expectedVersion !== null && !isNaN(expectedVersion)) {
            const currentVer = parseInt(existingScore.version || 1, 10);
            if (expectedVersion !== currentVer) {
                return res.status(409).json({
                    success: false,
                    conflict: true,
                    code: 'VERSION_CONFLICT',
                    message: `Score concurrency conflict: This evaluation has been modified by another action (v${currentVer}). Your submission was based on v${expectedVersion}. Please reload to inspect latest state.`,
                    current_version: currentVer,
                    expected_version: expectedVersion
                });
            }
        }

        // Fetch criteria for calculating weighted score
        const critQuery = getEventIdQuery(event_id);
        const criteriaList = await collections.criteria.find(critQuery).toArray();

        let totalScore = 0;
        let normalizedScoresArray = [];

        // Handle criteria_scores as array or object
        if (Array.isArray(criteria_scores)) {
            normalizedScoresArray = criteria_scores;
            for (const item of criteria_scores) {
                const crit = criteriaList.find(c => String(c._id) === String(item.criteria_id));
                const rawScore = parseFloat(item.score) || 0;
                if (crit) {
                    const weightPct = parseFloat(crit.percentage !== undefined ? crit.percentage : (crit.weight !== undefined ? crit.weight : 0)) || 0;
                    const maxScore = parseFloat(crit.max_points !== undefined ? crit.max_points : (crit.max_score !== undefined ? crit.max_score : 100)) || 100;
                    if (maxScore > 0 && weightPct > 0) {
                        totalScore += (rawScore / maxScore) * weightPct;
                    } else {
                        totalScore += rawScore;
                    }
                } else {
                    totalScore += rawScore;
                }
            }
        } else if (typeof criteria_scores === 'object') {
            for (const crit of criteriaList) {
                const critId = String(crit._id);
                const rawVal = criteria_scores[critId] !== undefined 
                    ? parseFloat(criteria_scores[critId]) 
                    : (parseFloat(criteria_scores[crit.name || crit.title]) || 0);

                const maxScore = parseFloat(crit.max_points !== undefined ? crit.max_points : (crit.max_score !== undefined ? crit.max_score : 100)) || 100;
                const weightPct = parseFloat(crit.percentage !== undefined ? crit.percentage : (crit.weight !== undefined ? crit.weight : 0)) || 0;

                normalizedScoresArray.push({
                    criteria_id: critId,
                    score: rawVal,
                    max: maxScore
                });

                if (maxScore > 0 && weightPct > 0) {
                    totalScore += (rawVal / maxScore) * weightPct;
                } else {
                    totalScore += rawVal;
                }
            }
        }

        if (totalScore === 0 && req.body.total_score !== undefined && parseFloat(req.body.total_score) > 0) {
            totalScore = parseFloat(req.body.total_score);
        }

        // Precision
        const precision = parseInt(settings?.judging?.decimalPrecision ?? 2, 10);
        totalScore = parseFloat(totalScore.toFixed(precision));

        const isSubmit = action === 'submit' || Boolean(is_locked);
        const now = new Date().toISOString();

        const scoreDoc = {
            event_id: String(event_id),
            contestant_id: String(contestant_id),
            judge_id: judgeId,
            judge_name: judgeName,
            criteria_scores: normalizedScoresArray,
            total_score: totalScore,
            comments: comments || existingScore?.comments || '',
            status: isSubmit ? 'submitted' : 'draft',
            is_locked: isSubmit,
            locked_at: isSubmit ? now : null,
            unlock_requested: false,
            is_verified: false,
            verified_by: null,
            verified_at: null,
            updated_at: now
        };

        let scoreId;
        if (!existingScore) {
            scoreDoc.created_at = now;
            scoreDoc.version = 1;
            const insertRes = await collections.scores.insertOne(scoreDoc);
            scoreId = String(insertRes.insertedId);
        } else {
            const currentVer = parseInt(existingScore.version || 1, 10);
            const nextVersion = currentVer + 1;
            scoreDoc.version = nextVersion;

            // Atomic conditional update for Optimistic Concurrency Control
            const updateFilter = {
                _id: existingScore._id,
                $or: [
                    { version: currentVer },
                    { version: { $exists: false } }
                ]
            };

            const updateRes = await collections.scores.updateOne(updateFilter, { $set: scoreDoc });
            if (updateRes.matchedCount === 0) {
                const latest = await collections.scores.findOne({ _id: existingScore._id });
                const latestVer = latest?.version || (currentVer + 1);
                return res.status(409).json({
                    success: false,
                    conflict: true,
                    code: 'VERSION_CONFLICT',
                    message: `Score concurrency conflict: Score was concurrently updated to v${latestVer}. Please reload to avoid lost updates.`,
                    current_version: latestVer,
                    expected_version: currentVer
                });
            }
            scoreId = String(existingScore._id);
        }

        // Record MVCC version snapshot
        const actionType = isSubmit 
            ? (existingScore ? 'OFFICIAL_SUBMISSION' : 'INITIAL_SUBMISSION') 
            : (existingScore ? 'DRAFT_UPDATED' : 'DRAFT_CREATED');
        const summaryText = isSubmit 
            ? `Final evaluation submitted with total ${totalScore}% by ${judgeName} (v${scoreDoc.version})` 
            : `Draft evaluation saved with total ${totalScore}% by ${judgeName} (v${scoreDoc.version})`;

        await recordScoreVersion({
            scoreId,
            version: scoreDoc.version,
            eventId: event_id,
            contestantId: contestant_id,
            judgeId,
            judgeName,
            criteriaScores: normalizedScoresArray,
            totalScore,
            comments: scoreDoc.comments,
            status: scoreDoc.status,
            isLocked: scoreDoc.is_locked,
            isVerified: scoreDoc.is_verified,
            verifiedBy: scoreDoc.verified_by,
            verifiedAt: scoreDoc.verified_at,
            action: actionType,
            changeSummary: summaryText,
            modifiedBy: {
                id: req.user ? req.user.id : judgeId,
                username: req.user ? (req.user.full_name || req.user.username) : judgeName,
                role: req.user ? req.user.role : 'judge'
            },
            now
        });

        // Broadcast update via Pusher
        await triggerPusherEvent(`event-${event_id}`, 'score-updated', {
            event_id,
            contestant_id,
            judge_id: judgeId,
            judge_name: judgeName,
            total_score: totalScore,
            status: scoreDoc.status,
            is_locked: scoreDoc.is_locked,
            is_verified: scoreDoc.is_verified,
            version: scoreDoc.version,
            timestamp: now
        });

        res.json({
            success: true,
            message: isSubmit ? 'Score successfully submitted and finalized!' : 'Score saved as in-progress draft.',
            score_id: scoreId,
            version: scoreDoc.version,
            total_score: totalScore,
            score: { ...scoreDoc, id: scoreId }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Lock Judge Score (with MVCC versioning)
 */
async function lockScore(req, res, next) {
    try {
        const { event_id, contestant_id, expected_version } = req.body;
        const judgeId = String(req.user.id);
        const judgeName = req.user.full_name || req.user.username;

        const scoreQuery = getScoreQuery(event_id, contestant_id, judgeId);
        const score = await collections.scores.findOne(scoreQuery);
        if (!score) {
            return res.status(404).json({ success: false, message: 'Score record not found.' });
        }

        const curVer = parseInt(score.version || 1, 10);
        if (expected_version !== undefined && expected_version !== null) {
            const expVer = parseInt(expected_version, 10);
            if (!isNaN(expVer) && expVer !== curVer) {
                return res.status(409).json({
                    success: false,
                    conflict: true,
                    code: 'VERSION_CONFLICT',
                    message: `Score conflict: score was modified to v${curVer}.`,
                    current_version: curVer,
                    expected_version: expVer
                });
            }
        }

        const nextVer = curVer + 1;
        const now = new Date().toISOString();

        const updateRes = await collections.scores.updateOne(
            { _id: score._id, $or: [{ version: curVer }, { version: { $exists: false } }] },
            { $set: { is_locked: true, status: 'submitted', locked_at: now, updated_at: now, version: nextVer } }
        );

        if (updateRes.matchedCount === 0) {
            return res.status(409).json({
                success: false,
                conflict: true,
                code: 'VERSION_CONFLICT',
                message: 'Score conflict: modified concurrently by another operation.'
            });
        }

        await recordScoreVersion({
            scoreId: String(score._id),
            version: nextVer,
            eventId: event_id,
            contestantId: contestant_id,
            judgeId,
            judgeName,
            criteriaScores: score.criteria_scores,
            totalScore: score.total_score,
            comments: score.comments,
            status: 'submitted',
            isLocked: true,
            isVerified: score.is_verified,
            verifiedBy: score.verified_by,
            verifiedAt: score.verified_at,
            action: 'SCORE_LOCKED',
            changeSummary: `Score locked by Judge ${judgeName} (v${nextVer})`,
            modifiedBy: { id: req.user.id, username: judgeName, role: req.user.role },
            now
        });

        res.json({ success: true, message: 'Score locked successfully.', version: nextVer });
    } catch (err) {
        next(err);
    }
}

/**
 * Request Score Unlock (Judge Action)
 */
async function requestUnlock(req, res, next) {
    try {
        const { event_id, contestant_id, reason } = req.body;
        const judgeId = String(req.user.id);

        const scoreQuery = getScoreQuery(event_id, contestant_id, judgeId);

        await collections.scores.updateOne(scoreQuery, {
            $set: { unlock_requested: true, unlock_reason: reason || 'Correction needed', updated_at: new Date().toISOString() }
        });

        await logSystemAction(req.user.id, req.user.username, req.user.role, 'REQUEST_SCORE_UNLOCK', `Judge requested unlock for contestant ${contestant_id}.`, req);

        res.json({ success: true, message: 'Unlock request submitted to tabulators.' });
    } catch (err) {
        next(err);
    }
}

/**
 * Approve / Reject Score Unlock (Admin & Tabulator Action with MVCC)
 */
async function approveUnlock(req, res, next) {
    try {
        const { event_id, contestant_id, judge_id, approve, expected_version } = req.body;

        const scoreQuery = getScoreQuery(event_id, contestant_id, judge_id);
        const score = await collections.scores.findOne(scoreQuery);
        if (!score) {
            return res.status(404).json({ success: false, message: 'Score record not found.' });
        }

        const curVer = parseInt(score.version || 1, 10);
        if (expected_version !== undefined && expected_version !== null) {
            const expVer = parseInt(expected_version, 10);
            if (!isNaN(expVer) && expVer !== curVer) {
                return res.status(409).json({
                    success: false,
                    conflict: true,
                    code: 'VERSION_CONFLICT',
                    message: `Score conflict: score was modified to v${curVer}.`,
                    current_version: curVer,
                    expected_version: expVer
                });
            }
        }

        const isApprove = approve !== false;
        const nextVer = curVer + 1;
        const now = new Date().toISOString();

        const updateFields = isApprove ? {
            is_locked: false,
            status: 'draft',
            unlock_requested: false,
            is_verified: false,
            verified_by: null,
            verified_at: null,
            version: nextVer,
            updated_at: now
        } : {
            unlock_requested: false,
            version: nextVer,
            updated_at: now
        };

        const result = await collections.scores.updateOne(
            { _id: score._id, $or: [{ version: curVer }, { version: { $exists: false } }] },
            { $set: updateFields }
        );

        if (result.matchedCount === 0) {
            return res.status(409).json({
                success: false,
                conflict: true,
                code: 'VERSION_CONFLICT',
                message: 'Score conflict: modified concurrently by another operation.'
            });
        }

        await recordScoreVersion({
            scoreId: String(score._id),
            version: nextVer,
            eventId: event_id,
            contestantId: contestant_id,
            judgeId: judge_id,
            judgeName: score.judge_name,
            criteriaScores: score.criteria_scores,
            totalScore: score.total_score,
            comments: score.comments,
            status: isApprove ? 'draft' : score.status,
            isLocked: isApprove ? false : score.is_locked,
            isVerified: isApprove ? false : score.is_verified,
            verifiedBy: null,
            verifiedAt: null,
            action: isApprove ? 'ADMIN_UNLOCKED' : 'UNLOCK_REJECTED',
            changeSummary: isApprove 
                ? `Score unlocked by ${req.user.role} ${req.user.username} to allow revisions (v${nextVer})` 
                : `Unlock request rejected by ${req.user.role} ${req.user.username} (v${nextVer})`,
            modifiedBy: { id: req.user.id, username: req.user.username, role: req.user.role },
            now
        });

        await triggerPusherEvent(`event-${event_id}`, 'score-unlocked', {
            event_id,
            contestant_id,
            judge_id,
            is_locked: !isApprove,
            status: isApprove ? 'draft' : 'submitted',
            version: nextVer
        });

        await logSystemAction(
            req.user.id,
            req.user.username,
            req.user.role,
            isApprove ? 'APPROVE_SCORE_UNLOCK' : 'REJECT_SCORE_UNLOCK',
            `Score unlock ${isApprove ? 'approved' : 'rejected'} for contestant ${contestant_id} (Judge ${judge_id}) - v${nextVer}.`,
            req
        );

        res.json({
            success: true,
            version: nextVer,
            message: isApprove ? 'Score unlocked. Judge may now revise entries.' : 'Unlock request rejected.'
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Self Unlock Score (Judge Action under 'judge_self_unlock' policy with MVCC)
 */
async function selfUnlock(req, res, next) {
    try {
        const { event_id, contestant_id, expected_version } = req.body;
        const judgeId = String(req.user.id);
        const judgeName = req.user.full_name || req.user.username;

        if (!event_id || !contestant_id) {
            return res.status(400).json({ success: false, message: 'Missing event_id or contestant_id.' });
        }

        const settings = await collections.settings.findOne({ _id: 'system_settings' });
        const rawPolicy = String(settings?.judging?.unlockPolicy || '').trim().toLowerCase();
        const isSelfUnlock = rawPolicy === 'judge_self_unlock' || rawPolicy === 'judge-self-unlock' || rawPolicy.includes('self_unlock');

        if (!isSelfUnlock && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Self-unlock is not permitted under current judging policy.' });
        }

        const scoreQuery = getScoreQuery(event_id, contestant_id, judgeId);
        const existingScore = await collections.scores.findOne(scoreQuery);

        if (!existingScore) {
            return res.status(404).json({ success: false, message: 'Score record not found.' });
        }

        const curVer = parseInt(existingScore.version || 1, 10);
        if (expected_version !== undefined && expected_version !== null) {
            const expVer = parseInt(expected_version, 10);
            if (!isNaN(expVer) && expVer !== curVer) {
                return res.status(409).json({
                    success: false,
                    conflict: true,
                    code: 'VERSION_CONFLICT',
                    message: `Score conflict: score was modified to v${curVer}.`,
                    current_version: curVer,
                    expected_version: expVer
                });
            }
        }

        const nextVer = curVer + 1;
        const now = new Date().toISOString();

        const updateRes = await collections.scores.updateOne(
            { _id: existingScore._id, $or: [{ version: curVer }, { version: { $exists: false } }] },
            {
                $set: {
                    is_locked: false,
                    status: 'draft',
                    unlock_requested: false,
                    is_verified: false,
                    verified_by: null,
                    verified_at: null,
                    version: nextVer,
                    updated_at: now
                }
            }
        );

        if (updateRes.matchedCount === 0) {
            return res.status(409).json({
                success: false,
                conflict: true,
                code: 'VERSION_CONFLICT',
                message: 'Score conflict: modified concurrently by another operation.'
            });
        }

        await recordScoreVersion({
            scoreId: String(existingScore._id),
            version: nextVer,
            eventId: event_id,
            contestantId: contestant_id,
            judgeId,
            judgeName,
            criteriaScores: existingScore.criteria_scores,
            totalScore: existingScore.total_score,
            comments: existingScore.comments,
            status: 'draft',
            isLocked: false,
            isVerified: false,
            verifiedBy: null,
            verifiedAt: null,
            action: 'SELF_UNLOCKED_BY_JUDGE',
            changeSummary: `Judge ${judgeName} self-unlocked score for revision (v${nextVer})`,
            modifiedBy: { id: req.user.id, username: judgeName, role: req.user.role },
            now
        });

        await triggerPusherEvent(`event-${event_id}`, 'score-unlocked', {
            event_id,
            contestant_id,
            judge_id: judgeId,
            is_locked: false,
            status: 'draft',
            version: nextVer
        });

        await logSystemAction(
            req.user.id,
            judgeName,
            req.user.role,
            'JUDGE_SELF_UNLOCK',
            `Judge self-unlocked score for contestant ${contestant_id} (v${nextVer}).`,
            req
        );

        res.json({ success: true, version: nextVer, message: 'Score unlocked for revision.' });
    } catch (err) {
        next(err);
    }
}

/**
 * Verify Score (Tabulator Action with MVCC)
 */
async function verifyScore(req, res, next) {
    try {
        const { event_id, contestant_id, judge_id, verify_all, expected_version } = req.body;
        const tabulatorName = req.user.full_name || req.user.username;
        const now = new Date().toISOString();

        if (verify_all) {
            const evScoresQuery = getEventIdQuery(event_id);
            const targetQuery = {
                ...evScoresQuery,
                $or: [{ status: 'submitted' }, { is_locked: true }]
            };

            const submittedScores = await collections.scores.find(targetQuery).toArray();
            for (const s of submittedScores) {
                const curVer = parseInt(s.version || 1, 10);
                const nextVer = curVer + 1;
                await collections.scores.updateOne(
                    { _id: s._id },
                    {
                        $set: {
                            is_verified: true,
                            verified_by: tabulatorName,
                            verified_at: now,
                            version: nextVer,
                            updated_at: now
                        }
                    }
                );
                await recordScoreVersion({
                    scoreId: String(s._id),
                    version: nextVer,
                    eventId: s.event_id,
                    contestantId: s.contestant_id,
                    judgeId: s.judge_id,
                    judgeName: s.judge_name,
                    criteriaScores: s.criteria_scores,
                    totalScore: s.total_score,
                    comments: s.comments,
                    status: s.status,
                    isLocked: s.is_locked,
                    isVerified: true,
                    verifiedBy: tabulatorName,
                    verifiedAt: now,
                    action: 'VERIFIED_BY_TABULATOR',
                    changeSummary: `Score verified & certified by Tabulator ${tabulatorName} (v${nextVer})`,
                    modifiedBy: { id: req.user.id, username: tabulatorName, role: req.user.role },
                    now
                });
            }

            await logSystemAction(req.user.id, tabulatorName, req.user.role, 'VERIFY_ALL_SCORES', `Tabulator verified all submitted final scores for event #${event_id}.`, req);

            await triggerPusherEvent(`event-${event_id}`, 'all-scores-verified', {
                event_id,
                is_verified: true,
                verified_by: tabulatorName,
                verified_at: now
            });

            return res.json({ success: true, message: 'All submitted scores verified successfully.' });
        }

        if (!event_id || !contestant_id || !judge_id) {
            return res.status(400).json({ success: false, message: 'Event ID, contestant ID, and judge ID are required.' });
        }

        const scoreQuery = getScoreQuery(event_id, contestant_id, judge_id);
        const score = await collections.scores.findOne(scoreQuery);
        if (!score) {
            return res.status(404).json({ success: false, message: 'Score record not found.' });
        }

        const curVer = parseInt(score.version || 1, 10);
        if (expected_version !== undefined && expected_version !== null) {
            const expVer = parseInt(expected_version, 10);
            if (!isNaN(expVer) && expVer !== curVer) {
                return res.status(409).json({
                    success: false,
                    conflict: true,
                    code: 'VERSION_CONFLICT',
                    message: `Score conflict: score was modified to v${curVer}.`,
                    current_version: curVer,
                    expected_version: expVer
                });
            }
        }

        const nextVer = curVer + 1;
        const result = await collections.scores.updateOne(
            { _id: score._id, $or: [{ version: curVer }, { version: { $exists: false } }] },
            {
                $set: {
                    is_verified: true,
                    verified_by: tabulatorName,
                    verified_at: now,
                    version: nextVer,
                    updated_at: now
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(409).json({
                success: false,
                conflict: true,
                code: 'VERSION_CONFLICT',
                message: 'Score conflict: modified concurrently by another operation.'
            });
        }

        await recordScoreVersion({
            scoreId: String(score._id),
            version: nextVer,
            eventId: event_id,
            contestantId: contestant_id,
            judgeId: judge_id,
            judgeName: score.judge_name,
            criteriaScores: score.criteria_scores,
            totalScore: score.total_score,
            comments: score.comments,
            status: score.status,
            isLocked: score.is_locked,
            isVerified: true,
            verifiedBy: tabulatorName,
            verifiedAt: now,
            action: 'VERIFIED_BY_TABULATOR',
            changeSummary: `Score verified & certified by Tabulator ${tabulatorName} (v${nextVer})`,
            modifiedBy: { id: req.user.id, username: tabulatorName, role: req.user.role },
            now
        });

        await logSystemAction(req.user.id, tabulatorName, req.user.role, 'VERIFY_SCORE', `Tabulator verified score for contestant ${contestant_id} by judge ${judge_id} (v${nextVer}).`, req);

        await triggerPusherEvent(`event-${event_id}`, 'score-verified', {
            event_id,
            contestant_id,
            judge_id,
            is_verified: true,
            verified_by: tabulatorName,
            verified_at: now,
            version: nextVer
        });

        res.json({
            success: true,
            version: nextVer,
            message: 'Score successfully verified.',
            verified_by: tabulatorName,
            verified_at: now
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Unverify Score (Tabulator Action with MVCC)
 */
async function unverifyScore(req, res, next) {
    try {
        const { event_id, contestant_id, judge_id, expected_version } = req.body;
        const scoreQuery = getScoreQuery(event_id, contestant_id, judge_id);
        const score = await collections.scores.findOne(scoreQuery);
        if (!score) {
            return res.status(404).json({ success: false, message: 'Score record not found.' });
        }

        const curVer = parseInt(score.version || 1, 10);
        if (expected_version !== undefined && expected_version !== null) {
            const expVer = parseInt(expected_version, 10);
            if (!isNaN(expVer) && expVer !== curVer) {
                return res.status(409).json({
                    success: false,
                    conflict: true,
                    code: 'VERSION_CONFLICT',
                    message: `Score conflict: score was modified to v${curVer}.`,
                    current_version: curVer,
                    expected_version: expVer
                });
            }
        }

        const nextVer = curVer + 1;
        const now = new Date().toISOString();

        const result = await collections.scores.updateOne(
            { _id: score._id, $or: [{ version: curVer }, { version: { $exists: false } }] },
            {
                $set: {
                    is_verified: false,
                    verified_by: null,
                    verified_at: null,
                    version: nextVer,
                    updated_at: now
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(409).json({
                success: false,
                conflict: true,
                code: 'VERSION_CONFLICT',
                message: 'Score conflict: modified concurrently by another operation.'
            });
        }

        await recordScoreVersion({
            scoreId: String(score._id),
            version: nextVer,
            eventId: event_id,
            contestantId: contestant_id,
            judgeId: judge_id,
            judgeName: score.judge_name,
            criteriaScores: score.criteria_scores,
            totalScore: score.total_score,
            comments: score.comments,
            status: score.status,
            isLocked: score.is_locked,
            isVerified: false,
            verifiedBy: null,
            verifiedAt: null,
            action: 'UNVERIFIED_BY_TABULATOR',
            changeSummary: `Score verification revoked by Tabulator ${req.user.username} (v${nextVer})`,
            modifiedBy: { id: req.user.id, username: req.user.username, role: req.user.role },
            now
        });

        await triggerPusherEvent(`event-${event_id}`, 'score-verified', {
            event_id,
            contestant_id,
            judge_id,
            is_verified: false,
            verified_by: null,
            verified_at: null,
            version: nextVer
        });

        res.json({ success: true, version: nextVer, message: 'Score verification status reverted.' });
    } catch (err) {
        next(err);
    }
}

/**
 * Helper: Evaluate tie-break resolution between two contestants
 * Supports:
 *  - 'highest_weight_criterion': Compare criteria scores starting with highest weight descending
 *  - 'judge_majority_vote': Head-to-head judge preference (majority decision)
 *  - 'split_award' / 'shared_rank': Standard competition shared rank (equal co-winners)
 */
function evaluateContestantTie(a, b, tieBreakerRule, sortedCriteria, assignedJudges) {
    if ((a.submitted_count || 0) === 0 && (b.submitted_count || 0) === 0) {
        return { isEqualScore: true, winner: null, loser: null, method: null, reason: 'No submissions recorded' };
    }
    if ((a.submitted_count || 0) === 0) {
        return { isEqualScore: false, winner: b, loser: a, method: null, reason: 'No submissions' };
    }
    if ((b.submitted_count || 0) === 0) {
        return { isEqualScore: false, winner: a, loser: b, method: null, reason: 'No submissions' };
    }

    const scoreDiff = b.average_score - a.average_score;
    if (Math.abs(scoreDiff) > 0.0001) {
        return {
            isEqualScore: false,
            winner: scoreDiff > 0 ? b : a,
            loser: scoreDiff > 0 ? a : b,
            method: null,
            reason: null
        };
    }

    // Both contestants have submitted scores and have identical average score!
    const rule = (tieBreakerRule === 'shared_rank' || tieBreakerRule === 'split_award') 
        ? 'split_award' 
        : (tieBreakerRule || 'highest_weight_criterion');

    if (rule === 'highest_weight_criterion') {
        for (const crit of sortedCriteria) {
            const critId = String(crit._id);
            const avgA = a.criteria_averages?.[critId] !== undefined ? a.criteria_averages[critId] : 0;
            const avgB = b.criteria_averages?.[critId] !== undefined ? b.criteria_averages[critId] : 0;
            const diff = avgB - avgA;
            if (Math.abs(diff) > 0.0001) {
                const critName = crit.name || crit.title || 'Primary Criterion';
                const weight = crit.percentage !== undefined ? crit.percentage : (crit.weight || 0);
                const winner = diff > 0 ? b : a;
                const loser = diff > 0 ? a : b;
                const winAvg = (winner === a ? avgA : avgB).toFixed(2);
                const loseAvg = (loser === a ? avgA : avgB).toFixed(2);
                return {
                    isEqualScore: true,
                    winner,
                    loser,
                    method: 'highest_weight_criterion',
                    reason: `Decided by highest-weighted criterion "${critName}" (${weight}%): ${winAvg} vs ${loseAvg}`
                };
            }
        }
        return {
            isEqualScore: true,
            winner: null,
            loser: null,
            method: 'highest_weight_criterion',
            reason: 'Identical average scores and equal on all criteria'
        };
    }

    if (rule === 'judge_majority_vote') {
        let votesA = 0;
        let votesB = 0;
        for (const judge of assignedJudges) {
            const jId = String(judge.id);
            const sA = a.judge_scores?.[jId];
            const sB = b.judge_scores?.[jId];
            if (sA && sB && sA.total_score !== null && sB.total_score !== null) {
                const valA = parseFloat(sA.total_score) || 0;
                const valB = parseFloat(sB.total_score) || 0;
                if (valA > valB) votesA++;
                else if (valB > valA) votesB++;
            }
        }
        if (votesA !== votesB) {
            const winner = votesA > votesB ? a : b;
            const loser = votesA > votesB ? b : a;
            const winVotes = Math.max(votesA, votesB);
            const loseVotes = Math.min(votesA, votesB);
            return {
                isEqualScore: true,
                winner,
                loser,
                method: 'judge_majority_vote',
                reason: `Decided by head-to-head judge preference: ${winVotes} judge(s) vs ${loseVotes} judge(s)`
            };
        }
        // Fallback to highest-weighted criterion if judge votes are split
        for (const crit of sortedCriteria) {
            const critId = String(crit._id);
            const avgA = a.criteria_averages?.[critId] !== undefined ? a.criteria_averages[critId] : 0;
            const avgB = b.criteria_averages?.[critId] !== undefined ? b.criteria_averages[critId] : 0;
            const diff = avgB - avgA;
            if (Math.abs(diff) > 0.0001) {
                const critName = crit.name || crit.title || 'Primary Criterion';
                const weight = crit.percentage !== undefined ? crit.percentage : (crit.weight || 0);
                const winner = diff > 0 ? b : a;
                const loser = diff > 0 ? a : b;
                const winAvg = (winner === a ? avgA : avgB).toFixed(2);
                const loseAvg = (loser === a ? avgA : avgB).toFixed(2);
                return {
                    isEqualScore: true,
                    winner,
                    loser,
                    method: 'highest_weight_criterion_fallback',
                    reason: `Judges split evenly (${votesA}-${votesB}); decided by highest-weighted criterion "${critName}" (${weight}%): ${winAvg} vs ${loseAvg}`
                };
            }
        }
        return {
            isEqualScore: true,
            winner: null,
            loser: null,
            method: 'judge_majority_vote',
            reason: `Even judge vote split (${votesA}-${votesB}) and equal across all criteria`
        };
    }

    // Default: 'split_award' / 'shared_rank'
    return {
        isEqualScore: true,
        winner: null,
        loser: null,
        method: 'split_award',
        reason: 'Standard Competition Shared Rank (Equal co-winners)'
    };
}

/**
 * Compute official rankings with automated tie-breaking and standard competition shared ranking (1, 1, 3, 4)
 */
function computeTabulationRanking(matrixData, tieBreakerRule, sortedCriteria, assignedJudges) {
    const active = matrixData.filter(r => (r.submitted_count || 0) > 0);
    const pending = matrixData.filter(r => (r.submitted_count || 0) === 0);

    // 1. Sort active contestants according to score and tie-breaker rule
    active.sort((a, b) => {
        const evalRes = evaluateContestantTie(a, b, tieBreakerRule, sortedCriteria, assignedJudges);
        if (!evalRes.isEqualScore) {
            return b.average_score - a.average_score;
        }
        if (evalRes.winner) {
            return evalRes.winner === a ? -1 : 1;
        }
        // Truly tied: deterministic secondary sort by contestant number
        return (a.contestant_number || 0) - (b.contestant_number || 0);
    });

    // 2. Assign standard competition ranking (e.g. 1, 1, 3, 4)
    let currentRank = 1;
    let i = 0;
    while (i < active.length) {
        let j = i + 1;
        while (j < active.length) {
            const evalAdj = evaluateContestantTie(active[i], active[j], tieBreakerRule, sortedCriteria, assignedJudges);
            if (evalAdj.isEqualScore && !evalAdj.winner) {
                j++;
            } else {
                break;
            }
        }

        const groupSize = j - i;
        const isSharedTie = groupSize > 1;

        for (let k = i; k < j; k++) {
            active[k].rank = currentRank;
            active[k].is_tied = isSharedTie;
            if (isSharedTie) {
                active[k].tie_broken = false;
                active[k].tie_breaker_applied = null;
                active[k].tie_break_detail = `Shared Rank ${currentRank} (${groupSize}-way tie)`;
            }
        }

        currentRank += groupSize;
        i = j;
    }

    // 3. Annotate tie-broken contestants who had identical average scores but were separated by rule
    for (let k = 0; k < active.length; k++) {
        const contestant = active[k];
        if (contestant.is_tied) continue;

        const sameScorePeers = active.filter((other, oIdx) =>
            oIdx !== k && Math.abs(other.average_score - contestant.average_score) < 0.0001
        );

        if (sameScorePeers.length > 0) {
            contestant.tie_broken = true;
            const peer = sameScorePeers[0];
            const res = evaluateContestantTie(contestant, peer, tieBreakerRule, sortedCriteria, assignedJudges);
            contestant.tie_breaker_applied = res.method;
            if (res.winner === contestant) {
                contestant.tie_break_detail = `Won tie-breaker (Rank #${contestant.rank}): ${res.reason}`;
            } else {
                contestant.tie_break_detail = `Placed by tie-breaker (Rank #${contestant.rank}): ${res.reason}`;
            }
        } else {
            contestant.tie_broken = false;
            contestant.tie_breaker_applied = null;
            contestant.tie_break_detail = null;
        }
    }

    // 4. Pending contestants (no submissions yet)
    pending.sort((a, b) => (a.contestant_number || 0) - (b.contestant_number || 0));
    pending.forEach(c => {
        c.rank = currentRank++;
        c.is_tied = false;
        c.tie_broken = false;
        c.tie_breaker_applied = null;
        c.tie_break_detail = null;
    });

    return [...active, ...pending];
}

/**
 * Get Tabulation Matrix & Live Rankings
 */
async function getTabulationMatrix(req, res, next) {
    try {
        const { event_id } = req.query;
        if (!event_id) {
            return res.status(400).json({ success: false, message: 'Event ID is required.' });
        }

        const evQuery = getIdFilter(event_id);
        const event = await collections.events.findOne(evQuery);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found.' });
        }

        const idMatch = getEventIdQuery(event._id);

        const [contestants, criteria, scores, settingsDoc] = await Promise.all([
            collections.contestants.find(idMatch).sort({ number: 1, contestant_number: 1 }).toArray(),
            collections.criteria.find(idMatch).sort({ order: 1, created_at: 1 }).toArray(),
            collections.scores.find(idMatch).toArray(),
            collections.settings.findOne({ _id: 'system_settings' })
        ]);

        const precision = parseInt(settingsDoc?.judging?.decimalPrecision ?? 2, 10);
        const tabMethod = settingsDoc?.judging?.tabulationMethod || 'standard_average';
        const tieBreakerRule = settingsDoc?.judging?.tieBreakerRule || 'highest_weight_criterion';

        // Pre-sort criteria descending by weight/percentage for highest-weight criterion tie breaking
        const sortedCriteria = [...criteria].sort((a, b) => {
            const wA = parseFloat(a.percentage !== undefined ? a.percentage : (a.weight || 0)) || 0;
            const wB = parseFloat(b.percentage !== undefined ? b.percentage : (b.weight || 0)) || 0;
            if (Math.abs(wB - wA) > 0.0001) {
                return wB - wA; // Highest weight first
            }
            const orderA = parseInt(a.order ?? 0, 10);
            const orderB = parseInt(b.order ?? 0, 10);
            return orderA - orderB;
        });

        const rawJudges = Array.isArray(event.assignedjudges) 
            ? event.assignedjudges 
            : (Array.isArray(event.assigned_judges) ? event.assigned_judges : []);

        const allUsers = await collections.users.find({}).toArray();
        const userMap = {};
        for (const u of allUsers) {
            userMap[String(u._id)] = u;
        }

        const assignedJudges = rawJudges.map(item => {
            const jId = typeof item === 'object' && item !== null ? String(item.id || item._id) : String(item);
            const userObj = userMap[jId];
            return {
                id: jId,
                username: userObj?.username || (typeof item === 'object' && item.username) || 'Judge',
                name: userObj?.full_name || userObj?.username || (typeof item === 'object' && item.name) || 'Judge',
                full_name: userObj?.full_name || userObj?.username || '',
                role: 'judge'
            };
        });

        // If the requesting user is a JUDGE, provide the Judge Scoring Sheet payload
        if (req.user && req.user.role === 'judge') {
            const judgeId = String(req.user.id);
            const judgeScoresMap = {};

            for (const s of scores) {
                if (String(s.judge_id) === judgeId) {
                    const cId = String(s.contestant_id);
                    judgeScoresMap[cId] = {
                        ...s,
                        id: String(s._id),
                        version: s.version || 1,
                        status: s.status || (s.is_locked ? 'submitted' : 'draft'),
                        criteria_scores: Array.isArray(s.criteria_scores) ? s.criteria_scores : []
                    };
                }
            }

            return res.json({
                success: true,
                role: 'judge',
                judge_id: judgeId,
                judge_username: req.user.username,
                event: {
                    id: String(event._id),
                    _id: event._id,
                    eventName: event.eventName || event.name || event.title,
                    judgingStatus: event.judgingStatus || event.judging_status || 'Not Yet Started',
                    judging_status: event.judgingStatus || event.judging_status || 'Not Yet Started'
                },
                contestants: contestants.map(c => ({
                    ...c,
                    id: String(c._id),
                    contestant_number: c.contestant_number !== undefined ? c.contestant_number : c.number,
                    number: c.number !== undefined ? c.number : c.contestant_number
                })),
                criteria: criteria.map(c => {
                    const weightVal = parseFloat(c.percentage !== undefined ? c.percentage : (c.weight || 0)) || 0;
                    const maxVal = parseFloat(c.max_points !== undefined ? c.max_points : (c.max_score || 100)) || 100;
                    return {
                        ...c,
                        id: String(c._id),
                        name: c.name || c.title,
                        title: c.title || c.name,
                        max_points: maxVal,
                        max_score: maxVal,
                        weight: weightVal,
                        percentage: weightVal
                    };
                }),
                scores: judgeScoresMap,
                settings: settingsDoc || {}
            });
        }

        // Otherwise (ADMIN & TABULATOR): Build the Full Tabulation Live Matrix
        const scoreLookup = {};
        for (const s of scores) {
            const cId = String(s.contestant_id);
            const jId = String(s.judge_id);
            scoreLookup[`${cId}_${jId}`] = s;
        }

        let totalSubmittedCount = 0;
        let totalVerifiedCount = 0;

        const matrixData = contestants.map(contestant => {
            const cId = String(contestant._id);
            const judgeScores = {};
            const rawScoresList = [];
            let contestantSubmitted = 0;
            let contestantVerified = 0;

            for (const judge of assignedJudges) {
                const jId = String(judge.id);
                const scoreRecord = scoreLookup[`${cId}_${jId}`];

                if (scoreRecord) {
                    let totalScore = parseFloat(scoreRecord.total_score) || 0;

                    // Auto-heal if total_score is 0 or NaN but criteria_scores exists
                    if ((!totalScore || totalScore === 0) && Array.isArray(scoreRecord.criteria_scores) && scoreRecord.criteria_scores.length > 0) {
                        const critMap = new Map(criteria.map(c => [String(c._id), c]));
                        let recomputed = 0;
                        for (const cs of scoreRecord.criteria_scores) {
                            const crit = critMap.get(String(cs.criteria_id));
                            if (crit) {
                                const raw = parseFloat(cs.score) || 0;
                                const weightPct = parseFloat(crit.percentage !== undefined ? crit.percentage : (crit.weight !== undefined ? crit.weight : 0)) || 0;
                                const maxPts = parseFloat(crit.max_points !== undefined ? crit.max_points : (crit.max_score || 100)) || 100;
                                if (maxPts > 0) {
                                    recomputed += (raw / maxPts) * weightPct;
                                }
                            }
                        }
                        if (recomputed > 0) {
                            totalScore = parseFloat(recomputed.toFixed(precision));
                            collections.scores.updateOne({ _id: scoreRecord._id }, { $set: { total_score: totalScore } }).catch(e => console.error('Auto-heal score error:', e));
                        }
                    }

                    const isSubmitted = scoreRecord.status === 'submitted' || Boolean(scoreRecord.is_locked);
                    const isVerified = Boolean(scoreRecord.is_verified);

                    if (isSubmitted) {
                        rawScoresList.push(totalScore);
                        contestantSubmitted++;
                        totalSubmittedCount++;
                        if (isVerified) {
                            contestantVerified++;
                            totalVerifiedCount++;
                        }
                    }

                    judgeScores[jId] = {
                        id: String(scoreRecord._id),
                        version: scoreRecord.version || 1,
                        status: isSubmitted ? 'submitted' : 'draft',
                        total_score: totalScore,
                        is_locked: isSubmitted,
                        is_verified: isVerified,
                        verified_by: scoreRecord.verified_by || null,
                        verified_at: scoreRecord.verified_at || null,
                        criteria_scores: scoreRecord.criteria_scores || [],
                        comments: scoreRecord.comments || '',
                        updated_at: scoreRecord.updated_at || null
                    };
                } else {
                    judgeScores[jId] = {
                        status: 'pending',
                        total_score: null,
                        is_locked: false,
                        is_verified: false,
                        verified_by: null,
                        verified_at: null,
                        criteria_scores: [],
                        comments: ''
                    };
                }
            }

            // Calculate average score
            let finalAverage = 0;
            let isOlympicTrimmed = false;

            if (rawScoresList.length > 0) {
                if (tabMethod === 'olympic_trimming' && rawScoresList.length >= 4) {
                    isOlympicTrimmed = true;
                    const sorted = [...rawScoresList].sort((a, b) => a - b);
                    const trimmed = sorted.slice(1, -1);
                    finalAverage = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
                } else {
                    finalAverage = rawScoresList.reduce((a, b) => a + b, 0) / rawScoresList.length;
                }
            }

            finalAverage = parseFloat(finalAverage.toFixed(precision));

            // Calculate criteria averages across submitted judge scores for tie-breaking
            const criteriaAverages = {};
            for (const crit of criteria) {
                const critId = String(crit._id);
                let critSum = 0;
                let critCount = 0;
                for (const judge of assignedJudges) {
                    const jId = String(judge.id);
                    const scoreRecord = scoreLookup[`${cId}_${jId}`];
                    if (scoreRecord && (scoreRecord.status === 'submitted' || scoreRecord.is_locked)) {
                        if (Array.isArray(scoreRecord.criteria_scores)) {
                            const cs = scoreRecord.criteria_scores.find(x => String(x.criteria_id) === critId);
                            if (cs && cs.score !== undefined && !isNaN(parseFloat(cs.score))) {
                                critSum += parseFloat(cs.score);
                                critCount++;
                            }
                        }
                    }
                }
                criteriaAverages[critId] = critCount > 0 ? (critSum / critCount) : 0;
            }

            return {
                contestant_id: cId,
                id: cId,
                name: contestant.name,
                contestant_number: contestant.contestant_number !== undefined ? contestant.contestant_number : (contestant.number || 1),
                number: contestant.number !== undefined ? contestant.number : (contestant.contestant_number || 1),
                entry_type: contestant.entry_type || 'individual',
                department_or_org: contestant.representation || contestant.department_or_org || '',
                representation: contestant.representation || '',
                photo_url: contestant.photo_url || null,
                team_members: contestant.team_members || [],
                comments: contestant.comments || [],
                judge_scores: judgeScores,
                criteria_averages: criteriaAverages,
                average_score: finalAverage,
                final_score: finalAverage,
                submitted_count: contestantSubmitted,
                verified_count: contestantVerified,
                is_olympic_trimmed: isOlympicTrimmed
            };
        });

        // Compute official rankings with automated tie-breaking & standard competition shared ranks
        const finalMatrixData = computeTabulationRanking(matrixData, tieBreakerRule, sortedCriteria, assignedJudges);

        const totalExpected = contestants.length * assignedJudges.length;
        const hasTies = finalMatrixData.some(r => r.is_tied && (r.submitted_count || 0) > 0);
        const tiedRanks = [...new Set(finalMatrixData.filter(r => r.is_tied && (r.submitted_count || 0) > 0).map(r => r.rank))];
        const stats = {
            total_contestants: contestants.length,
            total_judges: assignedJudges.length,
            total_submitted: totalSubmittedCount,
            total_verified: totalVerifiedCount,
            total_expected: totalExpected,
            is_completed: totalExpected > 0 && totalSubmittedCount >= totalExpected,
            is_all_verified: totalExpected > 0 && totalVerifiedCount >= totalExpected,
            has_ties: hasTies,
            tied_ranks: tiedRanks,
            tie_breaker_rule: tieBreakerRule
        };

        const evName = event.eventName || event.name || event.title || `Competition #${event._id}`;
        const jStatus = event.judgingStatus || event.judging_status || 'Not Yet Started';

        res.json({
            success: true,
            role: req.user.role,
            event: {
                id: String(event._id),
                _id: event._id,
                eventName: evName,
                name: evName,
                title: evName,
                judgingStatus: jStatus,
                judging_status: jStatus,
                status: event.status || 'Upcoming'
            },
            judges: assignedJudges,
            contestants: contestants.map(c => ({
                ...c,
                id: String(c._id)
            })),
            criteria: criteria.map(c => {
                const weightVal = parseFloat(c.percentage !== undefined ? c.percentage : (c.weight || 0)) || 0;
                const maxVal = parseFloat(c.max_points !== undefined ? c.max_points : (c.max_score || 100)) || 100;
                return {
                    ...c,
                    id: String(c._id),
                    name: c.name || c.title,
                    title: c.title || c.name,
                    weight: weightVal,
                    percentage: weightVal,
                    max_points: maxVal,
                    max_score: maxVal
                };
            }),
            matrix: finalMatrixData,
            stats,
            settings: settingsDoc || {}
        });
    } catch (err) {
        next(err);
    }
}

/**
 * MVCC: Get complete version history and audit trail for a score
 */
async function getScoreHistory(req, res, next) {
    try {
        const { event_id, contestant_id, judge_id, score_id } = req.query;
        let targetScore = null;

        if (score_id) {
            targetScore = await collections.scores.findOne(getIdFilter(score_id));
        } else if (event_id && contestant_id) {
            const jId = (req.user.role === 'judge') ? String(req.user.id) : String(judge_id || req.user.id);
            const scoreQuery = getScoreQuery(event_id, contestant_id, jId);
            targetScore = await collections.scores.findOne(scoreQuery);
        }

        if (!targetScore) {
            return res.status(404).json({ success: false, message: 'Score record not found.' });
        }

        // Judge access rule: judges can only inspect their own score history
        if (req.user.role === 'judge' && String(targetScore.judge_id) !== String(req.user.id)) {
            return res.status(403).json({ success: false, message: 'Unauthorized to view score history for another judge.' });
        }

        const sId = String(targetScore._id);
        const versions = await collections.score_versions.find({
            $or: [
                { score_id: sId },
                {
                    event_id: String(targetScore.event_id),
                    contestant_id: String(targetScore.contestant_id),
                    judge_id: String(targetScore.judge_id)
                }
            ]
        }).sort({ version: 1, created_at: 1 }).toArray();

        // If no versions exist in score_versions collection yet (pre-MVCC legacy score), synthesize baseline v1
        if (versions.length === 0) {
            const initialVer = parseInt(targetScore.version || 1, 10);
            versions.push({
                score_id: sId,
                version: initialVer,
                event_id: String(targetScore.event_id),
                contestant_id: String(targetScore.contestant_id),
                judge_id: String(targetScore.judge_id),
                judge_name: targetScore.judge_name || 'Judge',
                criteria_scores: targetScore.criteria_scores || [],
                total_score: targetScore.total_score,
                comments: targetScore.comments || '',
                status: targetScore.status || (targetScore.is_locked ? 'submitted' : 'draft'),
                is_locked: Boolean(targetScore.is_locked),
                is_verified: Boolean(targetScore.is_verified),
                verified_by: targetScore.verified_by || null,
                verified_at: targetScore.verified_at || null,
                action: targetScore.is_locked ? 'OFFICIAL_SUBMISSION' : 'DRAFT_CREATED',
                change_summary: `Initial score baseline evaluated at ${targetScore.total_score}% (v${initialVer})`,
                modified_by: {
                    id: String(targetScore.judge_id),
                    username: targetScore.judge_name || 'Judge',
                    role: 'judge'
                },
                created_at: targetScore.updated_at || targetScore.created_at || new Date().toISOString()
            });
        }

        res.json({
            success: true,
            score_id: sId,
            current_version: targetScore.version || 1,
            total_versions: versions.length,
            current_score: {
                total_score: targetScore.total_score,
                status: targetScore.status,
                is_locked: targetScore.is_locked,
                is_verified: targetScore.is_verified,
                verified_by: targetScore.verified_by,
                verified_at: targetScore.verified_at,
                version: targetScore.version || 1,
                updated_at: targetScore.updated_at
            },
            history: versions
        });
    } catch (err) {
        next(err);
    }
}

/**
 * MVCC: Get a specific point-in-time version snapshot
 */
async function getScoreVersionSnapshot(req, res, next) {
    try {
        const { version } = req.params;
        const { event_id, contestant_id, judge_id, score_id } = req.query;
        const verNum = parseInt(version, 10);

        if (isNaN(verNum)) {
            return res.status(400).json({ success: false, message: 'Invalid version number parameter.' });
        }

        let query = { version: verNum };
        if (score_id) {
            query.score_id = String(score_id);
        } else if (event_id && contestant_id && judge_id) {
            query.event_id = String(event_id);
            query.contestant_id = String(contestant_id);
            query.judge_id = String(judge_id);
        } else {
            return res.status(400).json({ success: false, message: 'Specify score_id or event_id, contestant_id, judge_id.' });
        }

        const snapshot = await collections.score_versions.findOne(query);
        if (!snapshot) {
            return res.status(404).json({ success: false, message: `Version ${verNum} snapshot not found.` });
        }

        if (req.user.role === 'judge' && String(snapshot.judge_id) !== String(req.user.id)) {
            return res.status(403).json({ success: false, message: 'Unauthorized to view version snapshot for another judge.' });
        }

        res.json({
            success: true,
            version: verNum,
            snapshot
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    submitScore,
    lockScore,
    requestUnlock,
    approveUnlock,
    selfUnlock,
    verifyScore,
    unverifyScore,
    getTabulationMatrix,
    getScoreHistory,
    getScoreVersionSnapshot,
    evaluateContestantTie,
    computeTabulationRanking
};
