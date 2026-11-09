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
        const judgeId = String(req.body.judge_id || req.user.id);
        const judgeName = req.body.judge_name || req.user.full_name || req.user.username;

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
            const insertRes = await collections.scores.insertOne(scoreDoc);
            scoreId = String(insertRes.insertedId);
        } else {
            await collections.scores.updateOne({ _id: existingScore._id }, { $set: scoreDoc });
            scoreId = String(existingScore._id);
        }

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
            timestamp: now
        });

        res.json({
            success: true,
            message: isSubmit ? 'Score successfully submitted and finalized!' : 'Score saved as in-progress draft.',
            score_id: scoreId,
            total_score: totalScore,
            score: { ...scoreDoc, id: scoreId }
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
        const now = new Date().toISOString();

        await collections.scores.updateOne(scoreQuery, {
            $set: { is_locked: true, status: 'submitted', locked_at: now, updated_at: now }
        });

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

        const isApprove = approve !== false;
        const updateFields = isApprove ? {
            is_locked: false,
            status: 'draft',
            unlock_requested: false,
            is_verified: false,
            verified_by: null,
            verified_at: null,
            updated_at: new Date().toISOString()
        } : {
            unlock_requested: false,
            updated_at: new Date().toISOString()
        };

        const result = await collections.scores.updateOne(scoreQuery, { $set: updateFields });
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Score record not found.' });
        }

        await triggerPusherEvent(`event-${event_id}`, 'score-unlocked', {
            event_id,
            contestant_id,
            judge_id,
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
            message: isApprove ? 'Score unlocked. Judge may now revise entries.' : 'Unlock request rejected.'
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
        await collections.scores.updateOne(scoreQuery, {
            $set: {
                is_locked: false,
                status: 'draft',
                unlock_requested: false,
                is_verified: false,
                verified_by: null,
                verified_at: null,
                updated_at: now
            }
        });

        await triggerPusherEvent(`event-${event_id}`, 'score-unlocked', {
            event_id,
            contestant_id,
            judge_id: judgeId,
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

        res.json({ success: true, message: 'Score unlocked for revision.' });
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
                }
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
        const result = await collections.scores.updateOne(scoreQuery, {
            $set: {
                is_verified: true,
                verified_by: tabulatorName,
                verified_at: now,
                updated_at: now
            }
        });

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Score record not found.' });
        }

        await logSystemAction(req.user.id, tabulatorName, req.user.role, 'VERIFY_SCORE', `Tabulator verified score for contestant ${contestant_id} by judge ${judge_id}.`, req);

        await triggerPusherEvent(`event-${event_id}`, 'score-verified', {
            event_id,
            contestant_id,
            judge_id,
            is_verified: true,
            verified_by: tabulatorName,
            verified_at: now
        });

        res.json({
            success: true,
            message: 'Score successfully verified.',
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

        const now = new Date().toISOString();
        await collections.scores.updateOne(scoreQuery, {
            $set: {
                is_verified: false,
                verified_by: null,
                verified_at: null,
                updated_at: now
            }
        });

        await triggerPusherEvent(`event-${event_id}`, 'score-verified', {
            event_id,
            contestant_id,
            judge_id,
            is_verified: false,
            verified_by: null,
            verified_at: null
        });

        res.json({ success: true, message: 'Score verification status reverted.' });
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

    // Compute rankings
    matrixData.sort((a, b) => b.average_score - a.average_score);
    matrixData.forEach((row, idx) => {
        row.rank = idx + 1;
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

        // If the requesting user is a JUDGE, provide the Judge Scoring Sheet payload
        if (req.user && req.user.role === 'judge') {
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

            const judgeId = String(req.user.id);
            const judgeScoresMap = {};

            for (const s of scores) {
                if (String(s.judge_id) === judgeId) {
                    const cId = String(s.contestant_id);
                    judgeScoresMap[cId] = {
                        ...s,
                        id: String(s._id),
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
    exportTabulationPDF
};
