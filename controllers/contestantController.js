const crypto = require('crypto');
const { collections } = require('../config/db');
const { logSystemAction } = require('../utils/logger');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { getIdFilter, getEventIdQuery } = require('../utils/dbHelpers');

/**
 * List Contestants for an Event
 */
async function listContestants(req, res, next) {
    try {
        const { event_id } = req.query;
        if (!event_id) {
            return res.status(400).json({ success: false, message: 'Event ID is required.' });
        }

        const query = getEventIdQuery(event_id);
        const contestants = await collections.contestants
            .find(query)
            .sort({ number: 1, contestant_number: 1 })
            .toArray();

        res.json({
            success: true,
            contestants: contestants.map(c => ({
                ...c,
                id: String(c._id),
                contestant_number: c.contestant_number !== undefined ? c.contestant_number : c.number,
                number: c.number !== undefined ? c.number : c.contestant_number
            }))
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Create Contestant
 */
async function createContestant(req, res, next) {
    try {
        const { event_id, name, contestant_number, number, representation, photo_url, photo_base64, details } = req.body;

        if (!event_id || !name) {
            return res.status(400).json({ success: false, message: 'Event ID and contestant name are required.' });
        }

        let effectivePhoto = photo_url || null;

        // If base64 photo provided, attempt Cloudinary upload
        if (photo_base64) {
            const uploadRes = await uploadToCloudinary(photo_base64, 'contestants');
            if (uploadRes.success) {
                effectivePhoto = uploadRes.url;
            }
        }

        const finalNumber = parseInt(number || contestant_number || '1', 10);
        const numEventId = Number(event_id);
        const storedEventId = (!isNaN(numEventId) && Number.isInteger(numEventId)) ? numEventId : String(event_id);

        const newContestant = {
            event_id: storedEventId,
            name: name.trim(),
            number: finalNumber,
            contestant_number: finalNumber,
            representation: (representation || '').trim(),
            photo_url: effectivePhoto,
            details: details || '',
            created_at: new Date().toISOString()
        };

        const result = await collections.contestants.insertOne(newContestant);

        await logSystemAction(
            req.user.id,
            req.user.username,
            req.user.role,
            'CREATE_CONTESTANT',
            `Added contestant #${finalNumber} "${name}" to event.`,
            req
        );

        res.status(201).json({
            success: true,
            message: 'Contestant added successfully.',
            contestant: {
                ...newContestant,
                _id: result.insertedId,
                id: String(result.insertedId)
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Update Contestant
 */
async function updateContestant(req, res, next) {
    try {
        const { id } = req.params;
        const { name, number, contestant_number, representation, photo_url, photo_base64, details, award_title, commentText, comment_id, commentId } = req.body;

        // If request is made by a judge, handle citation/award assignments and deletions
        if (req.user.role === 'judge') {
            if (award_title !== undefined || details !== undefined || commentText !== undefined) {
                return addComment(req, res, next);
            }
            if (comment_id !== undefined || commentId !== undefined) {
                return deleteComment(req, res, next);
            }
            return res.status(403).json({ success: false, message: 'Access denied. Requires one of the following roles: admin.' });
        }

        const query = getIdFilter(id);

        const updateDoc = { updated_at: new Date().toISOString() };
        if (name !== undefined) updateDoc.name = name.trim();
        if (number !== undefined || contestant_number !== undefined) {
            const num = parseInt(number || contestant_number, 10);
            updateDoc.number = num;
            updateDoc.contestant_number = num;
        }
        if (representation !== undefined) updateDoc.representation = representation.trim();
        if (details !== undefined) updateDoc.details = details;

        if (photo_base64) {
            const uploadRes = await uploadToCloudinary(photo_base64, 'contestants');
            if (uploadRes.success) {
                updateDoc.photo_url = uploadRes.url;
            }
        } else if (photo_url !== undefined) {
            updateDoc.photo_url = photo_url;
        }

        await collections.contestants.updateOne(query, { $set: updateDoc });

        res.json({ success: true, message: 'Contestant updated successfully.' });
    } catch (err) {
        next(err);
    }
}

/**
 * Add Comment / Special Citation to Contestant (Admin & Judge)
 */
async function addComment(req, res, next) {
    try {
        const { id } = req.params;
        const { commentText, text, details, comment, member_name, award_title } = req.body;

        const effectiveText = (award_title || details || text || commentText || comment || '').trim();
        const effectiveTitle = (award_title || text || details || commentText || comment || 'Special Citation').trim();
        const effectiveMember = (member_name || '').trim();

        if (!effectiveText) {
            return res.status(400).json({ success: false, message: 'Citation text or award title is required.' });
        }

        const query = getIdFilter(id);
        const contestant = await collections.contestants.findOne(query);
        if (!contestant) {
            return res.status(404).json({ success: false, message: 'Contestant not found.' });
        }

        // If judge, ensure competition event is active
        if (req.user.role === 'judge') {
            const evQuery = getIdFilter(contestant.event_id);
            const event = await collections.events.findOne(evQuery);
            const jStatus = event?.judgingStatus || event?.judging_status;
            if (jStatus === 'Finished' || event?.status === 'Completed') {
                return res.status(403).json({ success: false, message: 'Judging period is finished for this event.' });
            }
        }

        const commentId = 'citation-' + crypto.randomBytes(6).toString('hex');
        const now = new Date().toISOString();

        const newComment = {
            id: commentId,
            text: effectiveText,
            award_title: effectiveTitle,
            member_name: effectiveMember,
            comment: (comment || details || text || effectiveText).trim(),
            judge_id: String(req.user.id),
            judge_name: req.user.full_name || req.user.username,
            author: req.user.full_name || req.user.username,
            author_role: req.user.role,
            created_at: now
        };

        await collections.contestants.updateOne(query, {
            $push: { comments: newComment },
            $set: { updated_at: now }
        });

        await logSystemAction(
            req.user.id,
            req.user.username,
            req.user.role,
            'ASSIGN_SPECIAL_AWARD',
            `Assigned citation "${effectiveTitle}" ${effectiveMember ? `(${effectiveMember}) ` : ''}to contestant #${contestant.number || contestant.contestant_number || ''} ${contestant.name}.`,
            req
        );

        res.json({
            success: true,
            message: 'Special award / citation assigned successfully.',
            comment: newComment
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Delete Comment / Special Citation from Contestant (Admin & Judge)
 */
async function deleteComment(req, res, next) {
    try {
        const { id, commentId } = req.params;
        const targetCommentId = commentId || req.body.comment_id || req.body.commentId;

        if (!targetCommentId) {
            return res.status(400).json({ success: false, message: 'Comment ID is required.' });
        }

        const query = getIdFilter(id);
        const contestant = await collections.contestants.findOne(query);
        if (!contestant) {
            return res.status(404).json({ success: false, message: 'Contestant not found.' });
        }

        const comments = Array.isArray(contestant.comments) ? contestant.comments : [];
        const target = comments.find(c => String(c.id) === String(targetCommentId));

        if (!target) {
            return res.status(404).json({ success: false, message: 'Citation record not found.' });
        }

        // Judges can only delete their own citations, admins can delete any
        if (req.user.role === 'judge') {
            const isOwner = (target.judge_id && String(target.judge_id) === String(req.user.id)) ||
                            (target.author && String(target.author).toLowerCase() === String(req.user.username).toLowerCase());
            if (!isOwner) {
                return res.status(403).json({ success: false, message: 'You can only remove awards you personally assigned.' });
            }
        }

        const now = new Date().toISOString();
        await collections.contestants.updateOne(query, {
            $pull: { comments: { id: targetCommentId } },
            $set: { updated_at: now }
        });

        await logSystemAction(
            req.user.id,
            req.user.username,
            req.user.role,
            'REMOVE_SPECIAL_AWARD',
            `Removed citation "${target.award_title || target.text}" from contestant #${contestant.number || contestant.contestant_number || ''} ${contestant.name}.`,
            req
        );

        res.json({
            success: true,
            message: 'Special award citation removed successfully.'
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Delete Contestant
 */
async function deleteContestant(req, res, next) {
    try {
        const { id } = req.params;
        const query = getIdFilter(id);

        await collections.contestants.deleteOne(query);

        // Also delete scores for this contestant
        const strId = String(id);
        await collections.scores.deleteMany({
            $or: [
                { contestant_id: strId },
                { contestant_id: id }
            ]
        });

        res.json({ success: true, message: 'Contestant removed successfully.' });
    } catch (err) {
        next(err);
    }
}

/**
 * Reorder Contestants
 */
async function reorderContestants(req, res, next) {
    try {
        const { order = [] } = req.body; // array of { id, number }

        for (const item of order) {
            if (item.id) {
                const query = getIdFilter(item.id);
                const num = parseInt(item.number, 10);
                await collections.contestants.updateOne(query, {
                    $set: { number: num, contestant_number: num }
                });
            }
        }

        res.json({ success: true, message: 'Contestants reordered successfully.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    listContestants,
    createContestant,
    updateContestant,
    deleteContestant,
    reorderContestants,
    addComment,
    deleteComment
};
