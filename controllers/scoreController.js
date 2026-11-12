const { collections } = require('../config/db');
const { logSystemAction } = require('../utils/logger');
const { triggerPusherEvent } = require('../utils/pusher');
const { getIdFilter, getEventIdQuery } = require('../utils/dbHelpers');
const { generateTabulationPDF } = require('../utils/tabulationPdfGenerator');

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
 * Submit / Update Judge Score (Draft or Official Submission)
 */
async function submitScore(req, res, next) {
    try {
        const { event_id, contestant_id, criteria_scores, comments, is_locked, action } = req.body;
        
        // Security: Prevent judge impersonation. Only admins may specify a custom judge_id or judge_name
        const isAdmin = req.user && req.user.role === 'admin';
        const judgeId = (isAdmin && req.body.judge_id) ? String(req.body.judge_id) : String(req.user.id);
        const judgeName = (isAdmin && req.body.judge_name) ? String(req.body.judge_name) : (req.user.full_name || req.user.username);

        if (!event_id || !contestant_id || !criteria_scores) {
            return res.status(400).json({ success: false, message: 'Missing required scoring payload fields.' });
        }

        // Check if competition event exists and is open
        const evQuery = getIdFilter(event_id);
        const event = await collections.events.findOne(evQuery);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Competition event not found.' });
        }

        // Security: Verify judge is actually assigned to this competition event
        if (!isAdmin) {
            const assigned = Array.isArray(event.assignedjudges) 
                ? event.assignedjudges 
                : (Array.isArray(event.assigned_judges) ? event.assigned_judges : []);
            const isAssigned = assigned.some(j => {
                const jId = typeof j === 'object' && j !== null ? String(j.id || j._id) : String(j);
                return jId === String(req.user.id);
            });
            if (!isAssigned) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. You are not an assigned official judge for this event.'
                });
            }
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

        // Fetch criteria for calculating weighted score
        const critQuery = getEventIdQuery(event_id);
        const criteriaList = await collections.criteria.find(critQuery).toArray();

        let totalScore = 0;
        let normalizedScoresArray = [];

        // Handle criteria_scores as array or object with strict boundary & sanity validation
        if (Array.isArray(criteria_scores)) {
            normalizedScoresArray = criteria_scores;
            for (const item of criteria_scores) {
                const crit = criteriaList.find(c => String(c._id) === String(item.criteria_id));
                const rawScore = parseFloat(item.score);
                if (isNaN(rawScore) || !isFinite(rawScore)) {
                    return res.status(400).json({ success: false, message: 'Invalid score value provided.' });
                }
                const maxScore = parseFloat(crit?.max_points !== undefined ? crit.max_points : (crit?.max_score !== undefined ? crit.max_score : 100)) || 100;
                if (rawScore < 0 || rawScore > maxScore) {
                    return res.status(400).json({
                        success: false,
                        message: `Score for criterion "${crit?.name || crit?.title || 'Criteria'}" must be between 0 and ${maxScore}.`
                    });
                }
                if (crit) {
                    const weightPct = parseFloat(crit.percentage !== undefined ? crit.percentage : (crit.weight !== undefined ? crit.weight : 0)) || 0;
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

                if (isNaN(rawVal) || !isFinite(rawVal)) {
                    return res.status(400).json({ success: false, message: 'Invalid score value provided.' });
                }
                const maxScore = parseFloat(crit.max_points !== undefined ? crit.max_points : (crit.max_score !== undefined ? crit.max_score : 100)) || 100;
                if (rawVal < 0 || rawVal > maxScore) {
                    return res.status(400).json({
                        success: false,
                        message: `Score for criterion "${crit.name || crit.title}" must be between 0 and ${maxScore}.`
                    });
                }
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
        let finalVersion = 1;

        if (!existingScore) {
            scoreDoc.version = 1;
            scoreDoc.created_at = now;
            const insertRes = await collections.scores.insertOne(scoreDoc);
            scoreId = String(insertRes.insertedId);
            finalVersion = 1;

            if (collections.score_versions) {
                await collections.score_versions.insertOne({
                    score_id: scoreId,
                    version: 1,
                    event_id: String(event_id),
                    contestant_id: String(contestant_id),
                    judge_id: judgeId,
                    judge_name: judgeName,
                    criteria_scores: normalizedScoresArray,
                    total_score: totalScore,
                    comments: scoreDoc.comments,
                    status: scoreDoc.status,
                    is_locked: scoreDoc.is_locked,
                    is_verified: scoreDoc.is_verified,
                    action: isSubmit ? 'submit' : 'draft_create',
                    modified_by: {
                        id: String(req.user.id),
                        username: req.user.username,
                        role: req.user.role
                    },
                    created_at: now
                });
            }
        } else {
            // MVCC: Concurrency Conflict Detection
            const currentVersion = Number(existingScore.version || 1);
            const clientVersion = req.body.version !== undefined ? Number(req.body.version) : (req.body.expected_version !== undefined ? Number(req.body.expected_version) : null);

            if (clientVersion !== null && !isNaN(clientVersion) && clientVersion !== currentVersion) {
                return res.status(409).json({
                    success: false,
                    conflict: true,
                    code: 'CONCURRENCY_CONFLICT',
                    message: `Concurrency Conflict: This score was updated in another session (current version: v${currentVersion}, submitted: v${clientVersion}). Please reload the latest score before submitting.`,
                    current_version: currentVersion,
                    submitted_version: clientVersion,
                    current_score: {
                        ...existingScore,
                        id: String(existingScore._id),
                        version: currentVersion
                    }
                });
            }

            finalVersion = currentVersion + 1;
            scoreDoc.version = finalVersion;

            // Atomic conditional update ensuring no concurrent write modified this score in parallel
            const updateFilter = {
                _id: existingScore._id,
                $or: [
                    { version: currentVersion },
                    { version: { $exists: false } }
                ]
            };

            const updateRes = await collections.scores.updateOne(updateFilter, { $set: scoreDoc });
            if (updateRes.matchedCount === 0) {
                // Another concurrent write updated this score between find and update!
                const latestScore = await collections.scores.findOne(scoreQuery);
                return res.status(409).json({
                    success: false,
                    conflict: true,
                    code: 'CONCURRENCY_CONFLICT',
                    message: `Concurrency Conflict: Score was concurrently modified by another transaction. Current version is v${latestScore?.version || 'unknown'}. Please reload.`,
                    current_version: latestScore?.version || finalVersion,
                    current_score: latestScore ? { ...latestScore, id: String(latestScore._id) } : null
                });
            }

            scoreId = String(existingScore._id);

            if (collections.score_versions) {
                await collections.score_versions.insertOne({
                    score_id: scoreId,
                    version: finalVersion,
                    event_id: String(event_id),
                    contestant_id: String(contestant_id),
                    judge_id: judgeId,
                    judge_name: judgeName,
                    criteria_scores: normalizedScoresArray,
                    total_score: totalScore,
                    comments: scoreDoc.comments,
                    status: scoreDoc.status,
                    is_locked: scoreDoc.is_locked,
                    is_verified: scoreDoc.is_verified,
                    action: isSubmit ? 'submit' : 'draft_update',
                    modified_by: {
                        id: String(req.user.id),
                        username: req.user.username,
                        role: req.user.role
                    },
                    created_at: now
                });
            }
        }

        // Broadcast update via Pusher with version info
        await triggerPusherEvent(`event-${event_id}`, 'score-updated', {
            event_id,
            contestant_id,
            judge_id: judgeId,
            judge_name: judgeName,
            total_score: totalScore,
            version: finalVersion,
            status: scoreDoc.status,
            is_locked: scoreDoc.is_locked,
            is_verified: scoreDoc.is_verified,
            timestamp: now
        });

        res.json({
            success: true,
            message: isSubmit ? 'Score successfully submitted and finalized!' : 'Score saved as in-progress draft.',
            score_id: scoreId,
            version: finalVersion,
            total_score: totalScore,
            score: { ...scoreDoc, id: scoreId, version: finalVersion }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Lock Judge Score
 */
async function lockScore(req, res, next) {
    try {
        const { event_id, contestant_id } = req.body;
        const judgeId = String(req.user.id);

        const scoreQuery = getScoreQuery(event_id, contestant_id, judgeId);
        const existing = await collections.scores.findOne(scoreQuery);
        const now = new Date().toISOString();

        if (existing) {
            const nextVersion = (existing.version || 1) + 1;
            await collections.scores.updateOne(scoreQuery, {
                $set: { is_locked: true, status: 'submitted', locked_at: now, updated_at: now, version: nextVersion }
            });

            if (collections.score_versions) {
                await collections.score_versions.insertOne({
                    score_id: String(existing._id),
                    version: nextVersion,
                    event_id: String(existing.event_id),
                    contestant_id: String(existing.contestant_id),
                    judge_id: String(existing.judge_id),
                    judge_name: existing.judge_name,
                    criteria_scores: existing.criteria_scores,
                    total_score: existing.total_score,
                    comments: existing.comments,
                    status: 'submitted',
                    is_locked: true,
                    is_verified: Boolean(existing.is_verified),
                    action: 'lock',
                    modified_by: { id: String(req.user.id), username: req.user.username, role: req.user.role },
                    created_at: now
                });
            }
        }

        res.json({ success: true, message: 'Score locked successfully.' });
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
 * Approve / Reject Score Unlock (Admin & Tabulator Action)
 */
async function approveUnlock(req, res, next) {
    try {
        const { event_id, contestant_id, judge_id, approve } = req.body;

        const scoreQuery = getScoreQuery(event_id, contestant_id, judge_id);
        const existing = await collections.scores.findOne(scoreQuery);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Score record not found.' });
        }

        const isApprove = approve !== false;
        const nextVersion = (existing.version || 1) + 1;
        const now = new Date().toISOString();

        const updateFields = isApprove ? {
            is_locked: false,
            status: 'draft',
            unlock_requested: false,
            is_verified: false,
            verified_by: null,
            verified_at: null,
            version: nextVersion,
            updated_at: now
        } : {
            unlock_requested: false,
            version: nextVersion,
            updated_at: now
        };

        await collections.scores.updateOne({ _id: existing._id }, { $set: updateFields });

        if (collections.score_versions) {
            await collections.score_versions.insertOne({
                score_id: String(existing._id),
                version: nextVersion,
                event_id: String(existing.event_id),
                contestant_id: String(existing.contestant_id),
                judge_id: String(existing.judge_id),
                judge_name: existing.judge_name,
                criteria_scores: existing.criteria_scores,
                total_score: existing.total_score,
                comments: existing.comments,
                status: isApprove ? 'draft' : existing.status,
                is_locked: isApprove ? false : existing.is_locked,
                is_verified: false,
                action: isApprove ? 'unlock' : 'reject_unlock',
                modified_by: { id: String(req.user.id), username: req.user.username, role: req.user.role },
                created_at: now
            });
        }

        await triggerPusherEvent(`event-${event_id}`, 'score-unlocked', {
            event_id,
            contestant_id,
            judge_id,
            version: nextVersion,
            is_locked: !isApprove,
            status: isApprove ? 'draft' : 'submitted'
        });

        await logSystemAction(
            req.user.id,
            req.user.username,
            req.user.role,
            isApprove ? 'APPROVE_SCORE_UNLOCK' : 'REJECT_SCORE_UNLOCK',
            `Score unlock ${isApprove ? 'approved' : 'rejected'} for contestant ${contestant_id} (Judge ${judge_id}).`,
            req
        );

        res.json({
            success: true,
            message: isApprove ? 'Score unlocked. Judge may now revise entries.' : 'Unlock request rejected.',
            version: nextVersion
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Self Unlock Score (Judge Action under 'judge_self_unlock' policy)
 */
async function selfUnlock(req, res, next) {
    try {
        const { event_id, contestant_id } = req.body;
        const judgeId = String(req.user.id);

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

        const now = new Date().toISOString();
        const nextVersion = (existingScore.version || 1) + 1;

        await collections.scores.updateOne(scoreQuery, {
            $set: {
                is_locked: false,
                status: 'draft',
                unlock_requested: false,
                is_verified: false,
                verified_by: null,
                verified_at: null,
                version: nextVersion,
                updated_at: now
            }
        });

        if (collections.score_versions) {
            await collections.score_versions.insertOne({
                score_id: String(existingScore._id),
                version: nextVersion,
                event_id: String(existingScore.event_id),
                contestant_id: String(existingScore.contestant_id),
                judge_id: String(existingScore.judge_id),
                judge_name: existingScore.judge_name,
                criteria_scores: existingScore.criteria_scores,
                total_score: existingScore.total_score,
                comments: existingScore.comments,
                status: 'draft',
                is_locked: false,
                is_verified: false,
                action: 'self_unlock',
                modified_by: { id: String(req.user.id), username: req.user.username, role: req.user.role },
                created_at: now
            });
        }

        await triggerPusherEvent(`event-${event_id}`, 'score-unlocked', {
            event_id,
            contestant_id,
            judge_id: judgeId,
            version: nextVersion,
            is_locked: false,
            status: 'draft'
        });

        await logSystemAction(
            req.user.id,
            req.user.username,
            req.user.role,
            'JUDGE_SELF_UNLOCK',
            `Judge self-unlocked score for contestant ${contestant_id}.`,
            req
        );

        res.json({ success: true, message: 'Score unlocked for revision.', version: nextVersion });
    } catch (err) {
        next(err);
    }
}

/**
 * Verify Score (Tabulator Action)
 */
async function verifyScore(req, res, next) {
    try {
        const { event_id, contestant_id, judge_id, verify_all } = req.body;
        const tabulatorName = req.user.full_name || req.user.username;
        const now = new Date().toISOString();

        if (verify_all) {
            const evScoresQuery = getEventIdQuery(event_id);
            const targetQuery = {
                ...evScoresQuery,
                $or: [{ status: 'submitted' }, { is_locked: true }]
            };

            await collections.scores.updateMany(targetQuery, {
                $set: {
                    is_verified: true,
                    verified_by: tabulatorName,
                    verified_at: now,
                    updated_at: now
                },
                $inc: { version: 1 }
            });

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
        const existing = await collections.scores.findOne(scoreQuery);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Score record not found.' });
        }

        const nextVersion = (existing.version || 1) + 1;
        await collections.scores.updateOne({ _id: existing._id }, {
            $set: {
                is_verified: true,
                verified_by: tabulatorName,
                verified_at: now,
                version: nextVersion,
                updated_at: now
            }
        });

        if (collections.score_versions) {
            await collections.score_versions.insertOne({
                score_id: String(existing._id),
                version: nextVersion,
                event_id: String(existing.event_id),
                contestant_id: String(existing.contestant_id),
                judge_id: String(existing.judge_id),
                judge_name: existing.judge_name,
                criteria_scores: existing.criteria_scores,
                total_score: existing.total_score,
                comments: existing.comments,
                status: existing.status,
                is_locked: existing.is_locked,
                is_verified: true,
                action: 'verify',
                modified_by: { id: String(req.user.id), username: req.user.username, role: req.user.role },
                created_at: now
            });
        }

        await logSystemAction(req.user.id, tabulatorName, req.user.role, 'VERIFY_SCORE', `Tabulator verified score for contestant ${contestant_id} by judge ${judge_id}.`, req);

        await triggerPusherEvent(`event-${event_id}`, 'score-verified', {
            event_id,
            contestant_id,
            judge_id,
            version: nextVersion,
            is_verified: true,
            verified_by: tabulatorName,
            verified_at: now
        });

        res.json({
            success: true,
            message: 'Score successfully verified.',
            version: nextVersion,
            verified_by: tabulatorName,
            verified_at: now
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Unverify Score (Tabulator Action)
 */
async function unverifyScore(req, res, next) {
    try {
        const { event_id, contestant_id, judge_id } = req.body;
        const scoreQuery = getScoreQuery(event_id, contestant_id, judge_id);
        const existing = await collections.scores.findOne(scoreQuery);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Score record not found.' });
        }

        const now = new Date().toISOString();
        const nextVersion = (existing.version || 1) + 1;

        await collections.scores.updateOne({ _id: existing._id }, {
            $set: {
                is_verified: false,
                verified_by: null,
                verified_at: null,
                version: nextVersion,
                updated_at: now
            }
        });

        if (collections.score_versions) {
            await collections.score_versions.insertOne({
                score_id: String(existing._id),
                version: nextVersion,
                event_id: String(existing.event_id),
                contestant_id: String(existing.contestant_id),
                judge_id: String(existing.judge_id),
                judge_name: existing.judge_name,
                criteria_scores: existing.criteria_scores,
                total_score: existing.total_score,
                comments: existing.comments,
                status: existing.status,
                is_locked: existing.is_locked,
                is_verified: false,
                action: 'unverify',
                modified_by: { id: String(req.user.id), username: req.user.username, role: req.user.role },
                created_at: now
            });
        }

        await triggerPusherEvent(`event-${event_id}`, 'score-verified', {
            event_id,
            contestant_id,
            judge_id,
            version: nextVersion,
            is_verified: false,
            verified_by: null,
            verified_at: null
        });

        res.json({ success: true, message: 'Score verification status reverted.', version: nextVersion });
    } catch (err) {
        next(err);
    }
}

/**
 * Get MVCC Version History of Scores
 */
async function getScoreVersions(req, res, next) {
    try {
        const { event_id, contestant_id, judge_id, score_id } = req.query;
        let filter = {};
        if (score_id) {
            filter = { score_id: String(score_id) };
        } else if (event_id && contestant_id) {
            filter = { event_id: String(event_id), contestant_id: String(contestant_id) };
            if (judge_id) filter.judge_id = String(judge_id);
        } else {
            return res.status(400).json({ success: false, message: 'Event ID and contestant ID (or score ID) are required.' });
        }

        const versions = await collections.score_versions
            ? await collections.score_versions.find(filter).sort({ version: -1, created_at: -1 }).toArray()
            : [];

        // Also fetch current score
        let currentScore = null;
        if (score_id) {
            currentScore = await collections.scores.findOne(getIdFilter(score_id));
        } else if (event_id && contestant_id) {
            const jId = judge_id || req.user.id;
            currentScore = await collections.scores.findOne(getScoreQuery(event_id, contestant_id, jId));
        }

        res.json({
            success: true,
            current_version: currentScore?.version || (versions[0]?.version || 1),
            total_versions: versions.length,
            versions
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Get Tabulation Matrix & Live Rankings
 */
/**
 * Internal Helper: Fetch and compute the full tabulation matrix data
 */
async function fetchAndComputeTabulationData(eventId) {
    const evQuery = getIdFilter(eventId);
    const event = await collections.events.findOne(evQuery);
    if (!event) return null;

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
                    status: isSubmitted ? 'submitted' : 'draft',
                    total_score: totalScore,
                    version: scoreRecord.version || 1,
                    is_locked: isSubmitted,
                    is_verified: isVerified,
                    verified_by: scoreRecord.verified_by || null,
                    verified_at: scoreRecord.verified_at || null,
                    criteria_scores: scoreRecord.criteria_scores || [],
                    comments: scoreRecord.comments || ''
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
            average_score: finalAverage,
            final_score: finalAverage,
            submitted_count: contestantSubmitted,
            verified_count: contestantVerified,
            is_olympic_trimmed: isOlympicTrimmed
        };
    });

    // 1. Ordinal Ranking computation across judges (if enabled)
    if (tabMethod === 'ordinal_ranking') {
        for (const judge of assignedJudges) {
            const jId = String(judge.id);
            const evaluatedRows = [];
            for (const row of matrixData) {
                const entry = row.judge_scores[jId];
                if (entry && (entry.status === 'submitted' || entry.is_locked) && entry.total_score !== null) {
                    evaluatedRows.push({ row, score: entry.total_score });
                }
            }
            evaluatedRows.sort((a, b) => b.score - a.score);

            let i = 0;
            while (i < evaluatedRows.length) {
                let j = i;
                while (j < evaluatedRows.length && Math.abs(evaluatedRows[j].score - evaluatedRows[i].score) < 0.00001) {
                    j++;
                }
                const avgRank = ((i + 1) + j) / 2;
                for (let k = i; k < j; k++) {
                    evaluatedRows[k].row.judge_scores[jId].rank = avgRank;
                }
                i = j;
            }
        }

        for (const row of matrixData) {
            let sum = 0;
            let count = 0;
            for (const judge of assignedJudges) {
                const jId = String(judge.id);
                const entry = row.judge_scores[jId];
                if (entry && typeof entry.rank === 'number') {
                    sum += entry.rank;
                    count++;
                }
            }
            row.rank_sum = count > 0 ? parseFloat(sum.toFixed(precision)) : null;
        }
    }

    // 2. Precompute criteria score averages per contestant for tie-breaking
    const sortedCriteriaForTieBreaker = [...criteria].sort((a, b) => {
        const weightA = parseFloat(a.percentage !== undefined ? a.percentage : (a.weight || 0)) || 0;
        const weightB = parseFloat(b.percentage !== undefined ? b.percentage : (b.weight || 0)) || 0;
        if (Math.abs(weightB - weightA) > 0.00001) return weightB - weightA;
        const orderA = parseInt(a.order ?? 0, 10);
        const orderB = parseInt(b.order ?? 0, 10);
        return orderA - orderB;
    });

    for (const row of matrixData) {
        row.criterion_averages = {};
        const cId = String(row.contestant_id);
        for (const cr of sortedCriteriaForTieBreaker) {
            const critId = String(cr._id);
            let sumCrit = 0;
            let countCrit = 0;
            for (const judge of assignedJudges) {
                const jId = String(judge.id);
                const scoreRec = scoreLookup[`${cId}_${jId}`];
                if (scoreRec && (scoreRec.status === 'submitted' || scoreRec.is_locked) && Array.isArray(scoreRec.criteria_scores)) {
                    const cs = scoreRec.criteria_scores.find(x => String(x.criteria_id) === critId);
                    if (cs && cs.score !== undefined && cs.score !== null && cs.score !== '') {
                        sumCrit += parseFloat(cs.score) || 0;
                        countCrit++;
                    }
                }
            }
            row.criterion_averages[critId] = countCrit > 0 ? (sumCrit / countCrit) : 0;
        }
    }

    // 3. Contestant comparator with tie-breaker resolutions
    function compareContestants(a, b) {
        if (a.submitted_count > 0 && b.submitted_count === 0) return -1;
        if (b.submitted_count > 0 && a.submitted_count === 0) return 1;
        if (a.submitted_count === 0 && b.submitted_count === 0) {
            return a.contestant_number - b.contestant_number;
        }

        if (tabMethod === 'ordinal_ranking') {
            const rankSumA = a.rank_sum !== null ? a.rank_sum : 999999;
            const rankSumB = b.rank_sum !== null ? b.rank_sum : 999999;
            if (Math.abs(rankSumA - rankSumB) > 0.00001) {
                return rankSumA - rankSumB; // Lower rank sum is better
            }
            if (Math.abs(b.average_score - a.average_score) > 0.00001) {
                return b.average_score - a.average_score;
            }
        } else {
            if (Math.abs(b.average_score - a.average_score) > 0.00001) {
                return b.average_score - a.average_score;
            }
        }

        // Exact tie on primary evaluation metrics
        if (tieBreakerRule === 'split_award') {
            return 0;
        }

        if (tieBreakerRule === 'judge_majority_vote') {
            let votesA = 0;
            let votesB = 0;
            for (const judge of assignedJudges) {
                const jId = String(judge.id);
                const scoreA = (a.judge_scores[jId]?.status === 'submitted' || a.judge_scores[jId]?.is_locked)
                    ? a.judge_scores[jId].total_score : null;
                const scoreB = (b.judge_scores[jId]?.status === 'submitted' || b.judge_scores[jId]?.is_locked)
                    ? b.judge_scores[jId].total_score : null;
                if (scoreA !== null && scoreB !== null) {
                    if (scoreA > scoreB) votesA++;
                    else if (scoreB > scoreA) votesB++;
                }
            }
            if (votesA > votesB) {
                a._tieBreakerReason = 'Judge Majority Vote';
                return -1;
            } else if (votesB > votesA) {
                b._tieBreakerReason = 'Judge Majority Vote';
                return 1;
            }
        }

        // Highest weight criterion (default or fallback if majority vote is split)
        for (const cr of sortedCriteriaForTieBreaker) {
            const critId = String(cr._id);
            const avgA = a.criterion_averages[critId] || 0;
            const avgB = b.criterion_averages[critId] || 0;
            if (Math.abs(avgA - avgB) > 0.00001) {
                if (avgA > avgB) {
                    a._tieBreakerReason = 'Highest Weight Criterion';
                    return -1;
                } else {
                    b._tieBreakerReason = 'Highest Weight Criterion';
                    return 1;
                }
            }
        }

        return 0; // Truly tied
    }

    matrixData.sort(compareContestants);

    let currentRank = 1;
    let rankIdx = 0;
    while (rankIdx < matrixData.length) {
        if (matrixData[rankIdx].submitted_count === 0) {
            matrixData[rankIdx].rank = matrixData.length;
            matrixData[rankIdx].is_tie = false;
            matrixData[rankIdx].tie_broken_by = null;
            rankIdx++;
            continue;
        }

        let nextIdx = rankIdx;
        while (nextIdx < matrixData.length && matrixData[nextIdx].submitted_count > 0 && compareContestants(matrixData[rankIdx], matrixData[nextIdx]) === 0) {
            nextIdx++;
        }

        const countInTie = nextIdx - rankIdx;
        const isTie = countInTie > 1;

        for (let k = rankIdx; k < nextIdx; k++) {
            matrixData[k].rank = currentRank;
            matrixData[k].is_tie = isTie;
            if (matrixData[k]._tieBreakerReason) {
                matrixData[k].tie_broken_by = matrixData[k]._tieBreakerReason;
                delete matrixData[k]._tieBreakerReason;
            } else {
                matrixData[k].tie_broken_by = null;
            }
        }

        currentRank += countInTie;
        rankIdx = nextIdx;
    }

    matrixData.forEach(row => {
        delete row._tieBreakerReason;
    });

    const totalExpected = contestants.length * assignedJudges.length;
    const stats = {
        total_contestants: contestants.length,
        total_judges: assignedJudges.length,
        total_submitted: totalSubmittedCount,
        total_verified: totalVerifiedCount,
        total_expected: totalExpected,
        is_completed: totalExpected > 0 && totalSubmittedCount >= totalExpected,
        is_all_verified: totalExpected > 0 && totalVerifiedCount >= totalExpected
    };

    const evName = event.eventName || event.name || event.title || `Competition #${event._id}`;
    const jStatus = event.judgingStatus || event.judging_status || 'Not Yet Started';

    return {
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
        matrix: matrixData,
        stats,
        settings: settingsDoc || {}
    };
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

        // If the requesting user is a JUDGE, check Blind Judging mode enforcement
        if (req.user && req.user.role === 'judge') {
            const evQuery = getIdFilter(event_id);
            const event = await collections.events.findOne(evQuery);
            if (!event) {
                return res.status(404).json({ success: false, message: 'Event not found.' });
            }

            const settingsDoc = await collections.settings.findOne({ _id: 'system_settings' });
            const isBlindJudging = event.blindJudging !== undefined
                ? Boolean(event.blindJudging)
                : (settingsDoc?.judging?.blindJudging !== false);

            const judgeId = String(req.user.id);

            // If Blind Judging is disabled (false), the judge is permitted to view the live standings and full tabulation matrix
            if (!isBlindJudging) {
                const tabData = await fetchAndComputeTabulationData(event_id);
                if (!tabData) {
                    return res.status(404).json({ success: false, message: 'Event not found.' });
                }

                const judgeScoresMap = {};
                for (const s of (await collections.scores.find(getEventIdQuery(event._id)).toArray())) {
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
                    is_blind_judging: false,
                    judge_id: judgeId,
                    judge_username: req.user.username,
                    event: tabData.event,
                    contestants: tabData.contestants,
                    criteria: tabData.criteria,
                    scores: judgeScoresMap,
                    matrix: tabData.matrix,
                    judges: tabData.judges,
                    stats: tabData.stats,
                    settings: settingsDoc || {}
                });
            }

            // Otherwise, Blind Judging is active (true):
            // Strictly isolate evaluations; hide other judges' ratings and live standings
            const idMatch = getEventIdQuery(event._id);
            const [contestants, criteria, scores] = await Promise.all([
                collections.contestants.find(idMatch).sort({ number: 1, contestant_number: 1 }).toArray(),
                collections.criteria.find(idMatch).sort({ order: 1, created_at: 1 }).toArray(),
                collections.scores.find(idMatch).toArray()
            ]);

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
                is_blind_judging: true,
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
        const tabData = await fetchAndComputeTabulationData(event_id);
        if (!tabData) {
            return res.status(404).json({ success: false, message: 'Event not found.' });
        }

        return res.json({
            success: true,
            role: req.user ? req.user.role : '',
            ...tabData
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Export official tabulation scoring matrix PDF using pdfmake npm
 */
async function exportTabulationPDF(req, res, next) {
    try {
        const { event_id, action = 'download' } = req.query;
        if (!event_id) {
            return res.status(400).json({ success: false, message: 'Event ID is required.' });
        }

        const tabData = await fetchAndComputeTabulationData(event_id);
        if (!tabData) {
            return res.status(404).json({ success: false, message: 'Event not found.' });
        }

        const userRole = req.user ? req.user.role : '';
        const isAllVerified = Boolean(tabData.stats.is_all_verified);

        const isBlindJudging = tabData.event.blindJudging !== undefined
            ? Boolean(tabData.event.blindJudging)
            : (tabData.settings?.judging?.blindJudging !== false);

        if (userRole === 'judge') {
            return res.status(403).json({
                success: false,
                message: 'Official tabulation results export is restricted to Administrators and Tabulators.'
            });
        }

        // Security check: Only allow unverified export if admin/tabulator
        if (!isAllVerified && userRole !== 'admin' && userRole !== 'tabulator') {
            return res.status(403).json({
                success: false,
                message: 'Official PDF export is locked until all final scores are verified by tabulators.'
            });
        }

        const protocol = req.protocol || 'http';
        const host = req.get('host') || 'localhost:5000';
        const baseUrl = `${protocol}://${host}`;

        const pdfBuffer = await generateTabulationPDF({
            event: tabData.event,
            judges: tabData.judges,
            matrix: tabData.matrix,
            stats: tabData.stats,
            settings: tabData.settings,
            baseUrl
        });

        const safeTitle = (tabData.event.eventName || `Competition_${event_id}`)
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .replace(/_+/g, '_');
        const filename = `BukSU_Tabulation_${safeTitle}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `${action === 'preview' ? 'inline' : 'attachment'}; filename="${filename}"`
        );
        res.setHeader('Content-Length', pdfBuffer.length);
        return res.send(pdfBuffer);
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
    exportTabulationPDF,
    getScoreVersions
};
