const { collections } = require('../config/db');
const { logSystemAction } = require('../utils/logger');
const { getIdFilter, getEventIdQuery } = require('../utils/dbHelpers');

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
                    min_points: minVal
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
        const { event_id, name, title, description, weight, max_score, min_score, category, order } = req.body;

        const criterionName = (name || title || '').trim();
        if (!event_id || !criterionName) {
            return res.status(400).json({ success: false, message: 'Event ID and criterion name are required.' });
        }

        const criterionWeight = parseFloat(weight !== undefined ? weight : req.body.percentage) || 0;
        const maxScoreVal = parseFloat(max_score !== undefined ? max_score : req.body.max_points) || 100;
        const minScoreVal = parseFloat(min_score !== undefined ? min_score : req.body.min_points) || 0;

        const numEventId = Number(event_id);
        const storedEventId = (!isNaN(numEventId) && Number.isInteger(numEventId)) ? numEventId : String(event_id);

        const newCriterion = {
            event_id: storedEventId,
            name: criterionName,
            title: criterionName,
            description: (description || '').trim(),
            weight: criterionWeight,
            percentage: criterionWeight,
            max_score: maxScoreVal,
            max_points: maxScoreVal,
            min_score: minScoreVal,
            min_points: minScoreVal,
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
        const { name, title, description, weight, max_score, min_score, category, order } = req.body;

        const query = getIdFilter(id);

        const updateDoc = { updated_at: new Date().toISOString() };
        if (name !== undefined || title !== undefined) {
            updateDoc.name = (name || title || '').trim();
            updateDoc.title = updateDoc.name;
        }
        if (description !== undefined) updateDoc.description = description.trim();
        if (weight !== undefined || req.body.percentage !== undefined) {
            const w = parseFloat(weight !== undefined ? weight : req.body.percentage) || 0;
            updateDoc.weight = w;
            updateDoc.percentage = w;
        }
        if (max_score !== undefined || req.body.max_points !== undefined) {
            const m = parseFloat(max_score !== undefined ? max_score : req.body.max_points) || 100;
            updateDoc.max_score = m;
            updateDoc.max_points = m;
        }
        if (min_score !== undefined || req.body.min_points !== undefined) {
            const mn = parseFloat(min_score !== undefined ? min_score : req.body.min_points) || 0;
            updateDoc.min_score = mn;
            updateDoc.min_points = mn;
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
        const { criteria = [] } = req.body; // array of { id, weight }

        for (const item of criteria) {
            if (item.id) {
                const query = getIdFilter(item.id);
                const w = parseFloat(item.percentage !== undefined ? item.percentage : (item.weight || 0)) || 0;
                await collections.criteria.updateOne(query, {
                    $set: { weight: w, percentage: w, updated_at: new Date().toISOString() }
                });
            }
        }

        res.json({ success: true, message: 'Criteria weights updated successfully.' });
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
