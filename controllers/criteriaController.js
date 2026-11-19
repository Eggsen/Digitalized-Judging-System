const { collections } = require('../config/db');
const { logSystemAction } = require('../utils/logger');
const { getIdFilter, getEventIdQuery } = require('../utils/dbHelpers');

/**
 * Check if an event is completed or locked
 */
function isEventCompletedOrLocked(event) {
    if (!event) return false;
    const st = String(event.status || '').trim().toLowerCase();
    const jSt = String(event.judgingStatus || event.judging_status || '').trim().toLowerCase();
    return st === 'completed' || st === 'archived' || jSt === 'finished';
}

/**
 * List Criteria for an Event
 */
async function listCriteria(req, res, next) {
    try {
        const { event_id } = req.query;
        if (!event_id) {
            return res.status(400).json({ success: false, message: 'Event ID is required.' });
        }

        const query = getEventIdQuery(event_id);
        const criteria = await collections.criteria
            .find(query)
            .sort({ order: 1, created_at: 1 })
            .toArray();

        const totalWeight = criteria.reduce((sum, c) => sum + (parseFloat(c.percentage !== undefined ? c.percentage : (c.weight || 0)) || 0), 0);

        res.json({
            success: true,
            criteria: criteria.map(c => {
                const weightVal = parseFloat(c.percentage !== undefined ? c.percentage : (c.weight || 0)) || 0;
                const maxVal = parseFloat(c.max_points !== undefined ? c.max_points : (c.max_score || 100)) || 100;
                const minVal = parseFloat(c.min_points !== undefined ? c.min_points : (c.min_score || 0)) || 0;
                const scoringTypeVal = c.scoring_type || (Array.isArray(c.scoring_categories) && c.scoring_categories.length > 0 ? 'category' : 'rubric');

                return {
                    ...c,
                    id: String(c._id),
                    name: c.name || c.title || '',
                    title: c.title || c.name || '',
                    weight: weightVal,
                    percentage: weightVal,
                    max_score: maxVal,
                    max_points: maxVal,
                    min_score: minVal,
                    min_points: minVal,
                    scoring_type: scoringTypeVal,
                    rubric_ratings: Array.isArray(c.rubric_ratings) ? c.rubric_ratings : [],
                    scoring_categories: Array.isArray(c.scoring_categories) ? c.scoring_categories : [],
                    instructions: c.instructions || c.description || '',
                    score_step: parseFloat(c.score_step) || 0.5
                };
            }),
            total_weight: totalWeight,
            is_valid_total: Math.abs(totalWeight - 100) < 0.01
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Create Criterion
 */
async function createCriterion(req, res, next) {
    try {
        // If weights array was submitted directly to this endpoint (from updateCriteriaWeights)
        if (Array.isArray(req.body.weights) || (Array.isArray(req.body.criteria) && !req.body.name && !req.body.title)) {
            return batchUpdateWeights(req, res, next);
        }

        const {
            event_id,
            name,
            title,
            description,
            instructions,
            weight,
            percentage,
            max_score,
            max_points,
            min_score,
            min_points,
            score_step,
            scoring_type,
            rubric_ratings,
            scoring_categories,
            category,
            order
        } = req.body;

        const criterionName = (title || name || '').trim();
        if (!event_id || !criterionName) {
            return res.status(400).json({ success: false, message: 'Event ID and criterion name are required.' });
        }

        // Enforce: Cannot add criteria to completed or locked events
        const evQuery = getIdFilter(event_id);
        const parentEvent = await collections.events.findOne(evQuery);
        if (!parentEvent) {
            return res.status(404).json({ success: false, message: 'Event not found.' });
        }
        if (isEventCompletedOrLocked(parentEvent)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot add judging criteria: this competition is already completed and locked.'
            });
        }
        if (criterionName.length > 100) {
            return res.status(400).json({ success: false, message: 'Criterion title cannot exceed 100 characters.' });
        }

        const criterionDesc = (description || instructions || '').trim();
        if (criterionDesc.length > 500) {
            return res.status(400).json({ success: false, message: 'Criterion description cannot exceed 500 characters.' });
        }

        const criterionWeight = parseFloat(percentage !== undefined ? percentage : (weight !== undefined ? weight : 0)) || 0;
        const maxScoreVal = parseFloat(max_points !== undefined ? max_points : (max_score !== undefined ? max_score : 100)) || 100;
        const minScoreVal = parseFloat(min_points !== undefined ? min_points : (min_score !== undefined ? min_score : 0)) || 0;

        const numEventId = Number(event_id);
        const storedEventId = (!isNaN(numEventId) && Number.isInteger(numEventId)) ? numEventId : String(event_id);

        const scoringTypeVal = (scoring_type === 'category') ? 'category' : 'rubric';

        const cleanRubricRatings = Array.isArray(rubric_ratings) ? rubric_ratings.map((r, idx) => ({
            id: r.id || `rate-${idx + 1}`,
            name: (r.name || r.title || '').trim(),
            score: parseFloat(r.score !== undefined ? r.score : (r.points || 0)) || 0,
            description: (r.description || '').trim()
        })).filter(r => r.name.length > 0) : [];

        const cleanScoringCategories = Array.isArray(scoring_categories) ? scoring_categories.map((c, idx) => {
            const pts = parseFloat(c.points !== undefined ? c.points : (c.max_score || 0)) || 0;
            return {
                id: c.id || `cat-${idx + 1}`,
                name: (c.name || c.title || '').trim(),
                points: pts,
                max_score: pts,
                description: (c.description || '').trim()
            };
        }).filter(c => c.name.length > 0) : [];

        let calculatedMax = maxScoreVal;
        if (scoringTypeVal === 'rubric' && cleanRubricRatings.length > 0) {
            const highestRating = Math.max(...cleanRubricRatings.map(r => r.score));
            if (highestRating > 0) calculatedMax = highestRating;
        } else if (scoringTypeVal === 'category' && cleanScoringCategories.length > 0) {
            const sumCats = cleanScoringCategories.reduce((s, c) => s + (c.points || 0), 0);
            if (sumCats > 0) calculatedMax = Math.round(sumCats * 100) / 100;
        }

        const newCriterion = {
            event_id: storedEventId,
            name: criterionName,
            title: criterionName,
            description: (description || instructions || '').trim(),
            instructions: (instructions || description || '').trim(),
            weight: criterionWeight,
            percentage: criterionWeight,
            max_score: calculatedMax,
            max_points: calculatedMax,
            min_score: minScoreVal,
            min_points: minScoreVal,
            score_step: parseFloat(score_step) || 0.5,
            scoring_type: scoringTypeVal,
            rubric_ratings: cleanRubricRatings,
            scoring_categories: cleanScoringCategories,
            category: (category || 'General').trim(),
            order: parseInt(order || '1', 10),
            created_at: new Date().toISOString()
        };

        const result = await collections.criteria.insertOne(newCriterion);

        await logSystemAction(
            req.user.id,
            req.user.username,
            req.user.role,
            'CREATE_CRITERION',
            `Added judging criterion: "${criterionName}" (${criterionWeight}%)`,
            req
        );

        res.status(201).json({
            success: true,
            message: 'Criterion added successfully.',
            criterion: {
                ...newCriterion,
                _id: result.insertedId,
                id: String(result.insertedId)
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Update Criterion
 */
async function updateCriterion(req, res, next) {
    try {
        const { id } = req.params;
        const {
            name,
            title,
            description,
            instructions,
            weight,
            percentage,
            max_score,
            max_points,
            min_score,
            min_points,
            score_step,
            scoring_type,
            rubric_ratings,
            scoring_categories,
            category,
            order
        } = req.body;

        const query = getIdFilter(id);
        const existingCriterion = await collections.criteria.findOne(query);
        if (!existingCriterion) {
            return res.status(404).json({ success: false, message: 'Criterion not found.' });
        }

        // Enforce: Cannot edit criterion if event is completed or locked
        if (existingCriterion.event_id) {
            const evQuery = getIdFilter(existingCriterion.event_id);
            const parentEvent = await collections.events.findOne(evQuery);
            if (parentEvent && isEventCompletedOrLocked(parentEvent)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot edit criterion: this competition is already completed and locked.'
                });
            }
        }

        const updateDoc = { updated_at: new Date().toISOString() };
        if (title !== undefined || name !== undefined) {
            const trimmedTitle = (title || name || '').trim();
            if (trimmedTitle.length > 100) {
                return res.status(400).json({ success: false, message: 'Criterion title cannot exceed 100 characters.' });
            }
            updateDoc.name = trimmedTitle;
            updateDoc.title = trimmedTitle;
        }
        if (description !== undefined) {
            const trimmedDesc = description.trim();
            if (trimmedDesc.length > 500) {
                return res.status(400).json({ success: false, message: 'Description cannot exceed 500 characters.' });
            }
            updateDoc.description = trimmedDesc;
        }
        if (instructions !== undefined) {
            updateDoc.instructions = instructions.trim();
        } else if (description !== undefined) {
            updateDoc.instructions = description.trim();
        }
        if (percentage !== undefined || weight !== undefined) {
            const w = parseFloat(percentage !== undefined ? percentage : weight) || 0;
            updateDoc.weight = w;
            updateDoc.percentage = w;
        }
        if (max_points !== undefined || max_score !== undefined) {
            const m = parseFloat(max_points !== undefined ? max_points : max_score) || 100;
            updateDoc.max_score = m;
            updateDoc.max_points = m;
        }
        if (min_points !== undefined || min_score !== undefined) {
            const mn = parseFloat(min_points !== undefined ? min_points : min_score) || 0;
            updateDoc.min_score = mn;
            updateDoc.min_points = mn;
        }
        if (score_step !== undefined) {
            updateDoc.score_step = parseFloat(score_step) || 0.5;
        }
        if (scoring_type !== undefined) {
            updateDoc.scoring_type = (scoring_type === 'category') ? 'category' : 'rubric';
        }
        if (Array.isArray(rubric_ratings)) {
            updateDoc.rubric_ratings = rubric_ratings.map((r, idx) => ({
                id: r.id || `rate-${idx + 1}`,
                name: (r.name || r.title || '').trim(),
                score: parseFloat(r.score !== undefined ? r.score : (r.points || 0)) || 0,
                description: (r.description || '').trim()
            })).filter(r => r.name.length > 0);
        }
        if (Array.isArray(scoring_categories)) {
            updateDoc.scoring_categories = scoring_categories.map((c, idx) => {
                const pts = parseFloat(c.points !== undefined ? c.points : (c.max_score || 0)) || 0;
                return {
                    id: c.id || `cat-${idx + 1}`,
                    name: (c.name || c.title || '').trim(),
                    points: pts,
                    max_score: pts,
                    description: (c.description || '').trim()
                };
            }).filter(c => c.name.length > 0);
        }

        // Automatic max points calculation
        const effectiveScoringType = updateDoc.scoring_type;
        if (effectiveScoringType === 'rubric' && Array.isArray(updateDoc.rubric_ratings) && updateDoc.rubric_ratings.length > 0) {
            const highestRating = Math.max(...updateDoc.rubric_ratings.map(r => r.score));
            if (highestRating > 0) {
                updateDoc.max_score = highestRating;
                updateDoc.max_points = highestRating;
            }
        } else if (effectiveScoringType === 'category' && Array.isArray(updateDoc.scoring_categories) && updateDoc.scoring_categories.length > 0) {
            const sumCats = updateDoc.scoring_categories.reduce((s, c) => s + (c.points || 0), 0);
            if (sumCats > 0) {
                const rounded = Math.round(sumCats * 100) / 100;
                updateDoc.max_score = rounded;
                updateDoc.max_points = rounded;
            }
        }
        if (category !== undefined) updateDoc.category = category.trim();
        if (order !== undefined) updateDoc.order = parseInt(order, 10);

        await collections.criteria.updateOne(query, { $set: updateDoc });

        res.json({ success: true, message: 'Criterion updated successfully.' });
    } catch (err) {
        next(err);
    }
}

/**
 * Delete Criterion
 */
async function deleteCriterion(req, res, next) {
    try {
        const { id } = req.params;
        const query = getIdFilter(id);

        const existingCriterion = await collections.criteria.findOne(query);
        if (!existingCriterion) {
            return res.status(404).json({ success: false, message: 'Criterion not found.' });
        }

        // Enforce: Cannot delete criterion if event is completed or locked
        if (existingCriterion.event_id) {
            const evQuery = getIdFilter(existingCriterion.event_id);
            const parentEvent = await collections.events.findOne(evQuery);
            if (parentEvent && isEventCompletedOrLocked(parentEvent)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete criterion: this competition is already completed and locked.'
                });
            }
        }

        await collections.criteria.deleteOne(query);

        res.json({ success: true, message: 'Criterion removed successfully.' });
    } catch (err) {
        next(err);
    }
}

/**
 * Batch Update Criteria Weights
 */
async function batchUpdateWeights(req, res, next) {
    try {
        const items = Array.isArray(req.body) ? req.body : (req.body.weights || req.body.criteria || []);
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'No criteria weights provided.' });
        }

        // Enforce: Cannot adjust weights if event is completed or locked
        const eventId = req.body.event_id || (items[0] && items[0].event_id);
        if (eventId) {
            const evQuery = getIdFilter(eventId);
            const parentEvent = await collections.events.findOne(evQuery);
            if (parentEvent && isEventCompletedOrLocked(parentEvent)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot adjust criteria weights: this competition is already completed and locked.'
                });
            }
        } else if (items[0]) {
            const firstId = items[0].id || items[0]._id || items[0].criterion_id;
            if (firstId) {
                const sampleCrit = await collections.criteria.findOne(getIdFilter(firstId));
                if (sampleCrit && sampleCrit.event_id) {
                    const parentEvent = await collections.events.findOne(getIdFilter(sampleCrit.event_id));
                    if (parentEvent && isEventCompletedOrLocked(parentEvent)) {
                        return res.status(400).json({
                            success: false,
                            message: 'Cannot adjust criteria weights: this competition is already completed and locked.'
                        });
                    }
                }
            }
        }

        let updatedCount = 0;
        for (const item of items) {
            const rawId = item.id || item._id || item.criterion_id;
            if (rawId) {
                const query = getIdFilter(rawId);
                const w = parseFloat(item.percentage !== undefined ? item.percentage : (item.weight || 0)) || 0;
                await collections.criteria.updateOne(query, {
                    $set: { weight: w, percentage: w, updated_at: new Date().toISOString() }
                });
                updatedCount++;
            }
        }

        if (req.user) {
            const eventId = req.body.event_id || (items[0] && items[0].event_id) || '';
            await logSystemAction(
                req.user.id,
                req.user.username,
                req.user.role,
                'UPDATE_CRITERIA_WEIGHTS',
                `Updated weights for ${updatedCount} criteria in competition "${eventId}".`,
                req
            );
        }

        res.json({ success: true, message: 'Criteria weights updated successfully.', count: updatedCount });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    listCriteria,
    createCriterion,
    updateCriterion,
    deleteCriterion,
    batchUpdateWeights
};
