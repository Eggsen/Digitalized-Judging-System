const { ObjectId } = require('mongodb');
const { collections } = require('../config/db');
const { logSystemAction } = require('../utils/logger');
const { generateQRCodeDataURL } = require('../utils/qrcode');
const { triggerPusherEvent } = require('../utils/pusher');
const { getIdFilter, getEventIdQuery } = require('../utils/dbHelpers');

/**
 * Helper to normalize judge array into objects { id, username, email }
 */
async function resolveJudgeObjects(judgeIdsOrObjects, defaultRole = 'judge') {
    if (!Array.isArray(judgeIdsOrObjects)) return [];

    const ids = judgeIdsOrObjects.map(item => {
        if (typeof item === 'object' && item !== null) {
            return String(item.id || item._id);
        }
        return String(item);
    }).filter(Boolean);

    if (ids.length === 0) return [];

    const users = await collections.users.find({}).toArray();
    const userMap = {};
    for (const u of users) {
        userMap[String(u._id)] = u;
    }

    return ids.map(id => {
        const u = userMap[id];
        return {
            id: id,
            username: u?.username || 'User',
            email: u?.email || '',
            role: u?.role || defaultRole
        };
    });
}

/**
 * Helper to dispatch event invitations to newly assigned judges and tabulators
 */
async function dispatchEventInvitations(eventId, eventName, judges, tabulators) {
    const numericEventId = Number(eventId);
    const eventQueryIds = [eventId, String(eventId)];
    if (!isNaN(numericEventId)) eventQueryIds.push(numericEventId);

    // Find all existing event_invitation notifications for this event
    const existingNotifs = await collections.notifications.find({
        event_id: { $in: eventQueryIds },
        type: 'event_invitation'
    }).toArray();

    const notifUserMap = new Map();
    for (const n of existingNotifs) {
        notifUserMap.set(String(n.user_id), n);
    }

    const currentJudgeIds = new Set();
    const currentTabIds = new Set();

    // 1. Process Judges
    for (const j of judges) {
        const jId = String(j.id || j._id || j);
        currentJudgeIds.add(jId);

        let jObjId = null;
        try { jObjId = new ObjectId(jId); } catch (e) {}

        const hasNotif = notifUserMap.has(jId) || (jObjId && notifUserMap.has(String(jObjId)));
        if (!hasNotif) {
            await collections.notifications.insertOne({
                user_id: jObjId || jId,
                type: 'event_invitation',
                title: 'Event Invitation',
                message: `You have been invited to participate as a Judge in event "${eventName}". Please accept to confirm your participation.`,
                event_id: isNaN(numericEventId) ? eventId : numericEventId,
                role: 'judge',
                status: 'pending',
                is_read: false,
                created_at: new Date()
            });
        }
    }

    // 2. Process Tabulators
    for (const t of tabulators) {
        const tId = String(t.id || t._id || t);
        currentTabIds.add(tId);

        let tObjId = null;
        try { tObjId = new ObjectId(tId); } catch (e) {}

        const hasNotif = notifUserMap.has(tId) || (tObjId && notifUserMap.has(String(tObjId)));
        if (!hasNotif) {
            await collections.notifications.insertOne({
                user_id: tObjId || tId,
                type: 'event_invitation',
                title: 'Event Invitation',
                message: `You have been invited to participate as a Tabulator in event "${eventName}". Please accept to confirm your participation.`,
                event_id: isNaN(numericEventId) ? eventId : numericEventId,
                role: 'tabulator',
                status: 'pending',
                is_read: false,
                created_at: new Date()
            });
        }
    }

    // 3. Clean up pending invitations for users that were unassigned
    for (const n of existingNotifs) {
        if (n.status === 'pending') {
            const uidStr = String(n.user_id);
            if (n.role === 'judge' && !currentJudgeIds.has(uidStr)) {
                await collections.notifications.deleteOne({ _id: n._id });
            } else if (n.role === 'tabulator' && !currentTabIds.has(uidStr)) {
                await collections.notifications.deleteOne({ _id: n._id });
            }
        }
    }
}

/**
 * List all events (with role-based filtering)
 */
async function listEvents(req, res, next) {
    try {
        const user = req.user;
        const query = {};

        // Explicit status filter if requested
        if (req.query.status && req.query.status !== 'ALL') {
            query.status = req.query.status;
        } else if (user && user.role !== 'admin' && req.query.include_archived !== 'true') {
            // Judges and tabulators only see non-archived competitions
            query.status = { $ne: 'Archived' };
        }
        // Admins see all competitions (including Archived) so they can view, filter, and manage them

        const allEvents = await collections.events.find(query).sort({ created_at: -1 }).toArray();

        // Build invitation status map for assigned personnel
        const allEventInvitations = await collections.notifications.find({ type: 'event_invitation' }).toArray();
        const invitationStatusMap = {};
        for (const notif of allEventInvitations) {
            const eKey = `${String(notif.event_id)}_${String(notif.user_id)}`;
            invitationStatusMap[eKey] = notif.status || 'pending';
        }

        // Fetch users to populate details
        const allUsers = await collections.users.find({}, { projection: { password: 0 } }).toArray();
        const userMap = {};
        for (const u of allUsers) {
            userMap[String(u._id)] = u;
        }

        // Enhance events with counts, resolved personnel, and invitation status
        const enhancedEvents = await Promise.all(allEvents.map(async (ev) => {
            const evId = String(ev._id);
            const countQuery = getEventIdQuery(ev._id);

            const contestantsCount = await collections.contestants.countDocuments(countQuery);
            const criteriaCount = await collections.criteria.countDocuments(countQuery);

            const rawJudges = Array.isArray(ev.assignedjudges) 
                ? ev.assignedjudges 
                : (Array.isArray(ev.assigned_judges) ? ev.assigned_judges : []);
            
            const rawTabs = Array.isArray(ev.tabulators) ? ev.tabulators : [];

            const confirmedSet = new Set(
                (Array.isArray(ev.confirmed_users) ? ev.confirmed_users : []).map(u => {
                    return typeof u === 'object' && u !== null ? String(u.id || u._id) : String(u);
                })
            );

            const assignedJudges = rawJudges.map(item => {
                const idStr = typeof item === 'object' && item !== null ? String(item.id || item._id) : String(item);
                const u = userMap[idStr];
                const notifStatus = invitationStatusMap[`${evId}_${idStr}`];
                const isConfirmed = confirmedSet.has(idStr);
                return {
                    id: idStr,
                    username: u?.username || item.username || 'Judge',
                    email: u?.email || item.email || '',
                    role: u?.role || 'judge',
                    invitation_status: notifStatus || (isConfirmed ? 'accepted' : 'pending')
                };
            });

            const tabulators = rawTabs.map(item => {
                const idStr = typeof item === 'object' && item !== null ? String(item.id || item._id) : String(item);
                const u = userMap[idStr];
                const notifStatus = invitationStatusMap[`${evId}_${idStr}`];
                const isConfirmed = confirmedSet.has(idStr);
                return {
                    id: idStr,
                    username: u?.username || item.username || 'Tabulator',
                    email: u?.email || item.email || '',
                    role: u?.role || 'tabulator',
                    invitation_status: notifStatus || (isConfirmed ? 'accepted' : 'pending')
                };
            });

            const eventName = ev.eventName || ev.name || ev.title || `Competition #${evId}`;
            const eventType = ev.type || ev.category || 'Pageant';
            const status = ev.status || 'Upcoming';
            const judgingStatus = ev.judgingStatus || ev.judging_status || 'Not Yet Started';

            return {
                ...ev,
                id: evId,
                _id: ev._id,
                eventName,
                name: eventName,
                title: eventName,
                type: eventType,
                category: eventType,
                venue: ev.venue || '',
                date: ev.date || '',
                status,
                judgingStatus,
                judging_status: judgingStatus,
                assignedjudges: assignedJudges,
                assigned_judges: assignedJudges,
                tabulators,
                confirmed_users: Array.from(confirmedSet),
                contestants_count: contestantsCount,
                criteria_count: criteriaCount,
                judges_count: assignedJudges.length,
                tabulators_count: tabulators.length,
                description: ev.description || ''
            };
        }));

        // Role-based filtering:
        // Judges and tabulators MUST accept an invitation first before the event is displayed!
        let filteredEvents = enhancedEvents;
        if (user && (user.role === 'judge' || user.role === 'tabulator')) {
            const userId = String(user.id);
            let userObjId = null;
            try { userObjId = new ObjectId(userId); } catch (e) {}

            const acceptedNotifs = await collections.notifications.find({
                $or: [
                    { user_id: userId },
                    ...(userObjId ? [{ user_id: userObjId }] : [])
                ],
                type: 'event_invitation',
                status: 'accepted'
            }).toArray();

            const acceptedEventIds = new Set(acceptedNotifs.map(n => String(n.event_id)));

            filteredEvents = enhancedEvents.filter(ev => {
                const evIdStr = String(ev.id || ev._id);
                const isConfirmed = Array.isArray(ev.confirmed_users) && ev.confirmed_users.some(u => {
                    const uIdStr = typeof u === 'object' && u !== null ? String(u.id || u._id) : String(u);
                    return uIdStr === userId || (userObjId && uIdStr === String(userObjId));
                });

                const hasAccepted = acceptedEventIds.has(evIdStr) || isConfirmed;
                if (!hasAccepted) {
                    return false; // MUST receive and accept invitation first!
                }

                if (user.role === 'judge') {
                    return (ev.assignedjudges || []).some(j => String(j.id) === userId);
                }

                if (user.role === 'tabulator') {
                    return (ev.tabulators || []).some(t => String(t.id) === userId);
                }

                return false;
            });
        }

        res.json({
            success: true,
            events: filteredEvents
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Get Single Event
 */
async function getEvent(req, res, next) {
    try {
        const { id } = req.params;
        const query = getIdFilter(id);

        const event = await collections.events.findOne(query);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found.' });
        }

        const evId = String(event._id);
        const eventName = event.eventName || event.name || event.title || `Competition #${evId}`;
        const eventType = event.type || event.category || 'General';

        res.json({
            success: true,
            event: {
                ...event,
                id: evId,
                eventName,
                name: eventName,
                title: eventName,
                type: eventType,
                category: eventType,
                judgingStatus: event.judgingStatus || event.judging_status || 'Not Yet Started',
                judging_status: event.judgingStatus || event.judging_status || 'Not Yet Started'
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Create Event (Admin Only)
 */
async function createEvent(req, res, next) {
    try {
        const {
            name,
            title,
            eventName,
            type,
            category,
            venue,
            date,
            start_time,
            description,
            banner_url,
            assignedjudges,
            tabulators
        } = req.body;

        const finalTitle = (eventName || title || name || '').trim();
        if (!finalTitle) {
            return res.status(400).json({ success: false, message: 'Event name/title is required.' });
        }

        // Auto-increment integer ID to match MongoDB Atlas schema
        const allEvents = await collections.events.find({}, { projection: { _id: 1 } }).toArray();
        let maxId = 0;
        for (const ev of allEvents) {
            const num = Number(ev._id);
            if (!isNaN(num) && Number.isInteger(num) && num > maxId) {
                maxId = num;
            }
        }
        const nextId = maxId > 0 ? maxId + 1 : 1;

        const resolvedJudges = await resolveJudgeObjects(assignedjudges || []);
        const resolvedTabs = await resolveJudgeObjects(tabulators || []);

        const eventType = (type || category || 'Pageant').trim();

        const newEvent = {
            _id: nextId,
            eventName: finalTitle,
            name: finalTitle,
            title: finalTitle,
            type: eventType,
            category: eventType,
            description: (description || '').trim(),
            venue: (venue || '').trim(),
            date: date || new Date().toISOString().split('T')[0],
            start_time: start_time || '08:00',
            banner_url: banner_url || null,
            status: 'Upcoming',
            judgingStatus: 'Not Yet Started',
            judging_status: 'Not Yet Started',
            assignedjudges: resolvedJudges,
            assigned_judges: resolvedJudges,
            tabulators: resolvedTabs,
            created_by: req.user.username,
            created_at: new Date().toISOString()
        };

        await collections.events.insertOne(newEvent);

        if (resolvedJudges.length > 0 || resolvedTabs.length > 0) {
            await dispatchEventInvitations(nextId, finalTitle, resolvedJudges, resolvedTabs);
        }

        await logSystemAction(
            req.user.id,
            req.user.username,
            req.user.role,
            'CREATE_EVENT',
            `Created competition #${nextId}: "${finalTitle}"`,
            req
        );

        res.status(201).json({
            success: true,
            message: 'Event created successfully.',
            event: { ...newEvent, id: String(nextId) }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Update Event (Admin Only)
 */
async function updateEvent(req, res, next) {
    try {
        const { id } = req.params;
        const {
            eventName,
            title,
            name,
            type,
            category,
            venue,
            date,
            start_time,
            status,
            judgingStatus,
            judging_status,
            description,
            banner_url
        } = req.body;

        const query = getIdFilter(id);
        const existing = await collections.events.findOne(query);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Event not found.' });
        }

        const updateDoc = { updated_at: new Date().toISOString() };
        if (eventName !== undefined || title !== undefined || name !== undefined) {
            const finalName = (eventName || title || name || '').trim();
            updateDoc.eventName = finalName;
            updateDoc.name = finalName;
            updateDoc.title = finalName;
        }
        if (type !== undefined || category !== undefined) {
            const finalType = (type || category || '').trim();
            updateDoc.type = finalType;
            updateDoc.category = finalType;
        }
        if (venue !== undefined) updateDoc.venue = venue.trim();
        if (date !== undefined) updateDoc.date = date;
        if (start_time !== undefined) updateDoc.start_time = start_time;
        if (status !== undefined) updateDoc.status = status;
        if (judgingStatus !== undefined || judging_status !== undefined) {
            const jStatus = judgingStatus || judging_status;
            updateDoc.judgingStatus = jStatus;
            updateDoc.judging_status = jStatus;
        }
        if (description !== undefined) updateDoc.description = description.trim();
        if (banner_url !== undefined) updateDoc.banner_url = banner_url;

        await collections.events.updateOne(query, { $set: updateDoc });

        await logSystemAction(
            req.user.id,
            req.user.username,
            req.user.role,
            'UPDATE_EVENT',
            `Updated details for event: "${updateDoc.eventName || existing.eventName || existing.name}"`,
            req
        );

        res.json({
            success: true,
            message: 'Event updated successfully.'
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Delete Event (Admin Only)
 */
async function deleteEvent(req, res, next) {
    try {
        const { id } = req.params;
        const query = getIdFilter(id);

        const existing = await collections.events.findOne(query);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Event not found.' });
        }

        const eventIdQuery = getEventIdQuery(existing._id);

        // Delete associated contestants, criteria, and scores
        await collections.events.deleteOne(query);
        await collections.contestants.deleteMany(eventIdQuery);
        await collections.criteria.deleteMany(eventIdQuery);
        await collections.scores.deleteMany(eventIdQuery);
        if (collections.score_versions) {
            await collections.score_versions.deleteMany(eventIdQuery);
        }

        await logSystemAction(
            req.user.id,
            req.user.username,
            req.user.role,
            'DELETE_EVENT',
            `Deleted event: "${existing.eventName || existing.title || existing.name}" and purged related records.`,
            req
        );

        res.json({
            success: true,
            message: 'Event and related data deleted successfully.'
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Archive / Unarchive Event
 */
async function archiveEvent(req, res, next) {
    try {
        const { id } = req.params;
        const { archive = true, status } = req.body;

        const query = getIdFilter(id);
        const newStatus = status ? status : (archive ? 'Archived' : 'Upcoming');

        await collections.events.updateOne(query, {
            $set: { status: newStatus, updated_at: new Date().toISOString() }
        });

        if (req.user) {
            await logSystemAction(
                req.user.id,
                req.user.username,
                req.user.role,
                newStatus === 'Archived' ? 'ARCHIVE_EVENT' : 'UNARCHIVE_EVENT',
                `Competition "${id}" marked as ${newStatus}.`,
                req
            );
        }

        res.json({
            success: true,
            message: `Event has been marked as ${newStatus} successfully.`
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Assign Judges & Tabulators to Event
 */
async function assignJudges(req, res, next) {
    try {
        const { id } = req.params;
        const { assignedjudges, judges, tabulators } = req.body;

        const query = getIdFilter(id);
        const existing = await collections.events.findOne(query);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Event not found.' });
        }

        const judgeList = assignedjudges || judges || [];
        const tabList = tabulators || [];

        const resolvedJudges = await resolveJudgeObjects(judgeList);
        const resolvedTabs = await resolveJudgeObjects(tabList);

        await collections.events.updateOne(query, {
            $set: {
                assignedjudges: resolvedJudges,
                assigned_judges: resolvedJudges,
                tabulators: resolvedTabs,
                updated_at: new Date().toISOString()
            }
        });

        const eventName = existing.eventName || existing.name || `Competition #${id}`;
        await dispatchEventInvitations(existing._id, eventName, resolvedJudges, resolvedTabs);

        await logSystemAction(
            req.user.id,
            req.user.username,
            req.user.role,
            'ASSIGN_PERSONNEL',
            `Updated assigned personnel for event #${id} (${resolvedJudges.length} judges, ${resolvedTabs.length} tabulators).`,
            req
        );

        res.json({
            success: true,
            message: 'Personnel assigned successfully.',
            assigned_count: resolvedJudges.length,
            tabulator_count: resolvedTabs.length
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Update Judging Period (Start / Stop / Reset)
 */
async function updateJudgingPeriod(req, res, next) {
    try {
        const { id } = req.params;
        const actionInput = (req.body.action || req.body.judging_status || req.body.judgingStatus || '').trim().toLowerCase();

        let judgingStatus = 'Not Yet Started';
        let eventStatus = 'Upcoming';

        if (actionInput === 'start' || actionInput === 'open' || actionInput === 'in progress') {
            judgingStatus = 'In Progress';
            eventStatus = 'Ongoing';
        } else if (actionInput === 'stop' || actionInput === 'closed' || actionInput === 'finished') {
            judgingStatus = 'Finished';
            eventStatus = 'Completed';
        } else if (actionInput === 'reset' || actionInput === 'pending' || actionInput === 'not yet started') {
            judgingStatus = 'Not Yet Started';
            eventStatus = 'Upcoming';
        } else {
            return res.status(400).json({
                success: false,
                message: `Invalid action "${actionInput}". Permitted actions: start, stop, reset.`
            });
        }

        const query = getIdFilter(id);
        const existing = await collections.events.findOne(query);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Event not found.' });
        }

        await collections.events.updateOne(query, {
            $set: {
                judgingStatus,
                judging_status: judgingStatus,
                status: eventStatus,
                updated_at: new Date().toISOString()
            }
        });

        // Trigger real-time broadcast via Pusher
        await triggerPusherEvent(`event-${id}`, 'judging-status-changed', {
            event_id: id,
            judgingStatus,
            judging_status: judgingStatus,
            status: eventStatus,
            updated_by: req.user.username,
            timestamp: new Date().toISOString()
        });

        await logSystemAction(
            req.user.id,
            req.user.username,
            req.user.role,
            'TOGGLE_JUDGING',
            `Judging period set to "${judgingStatus}" (Event: ${eventStatus}) for event #${id}.`,
            req
        );

        res.json({
            success: true,
            message: `Judging period is now "${judgingStatus}".`,
            judgingStatus,
            judging_status: judgingStatus,
            status: eventStatus
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Generate Event Access QR Code
 */
async function getEventQR(req, res, next) {
    try {
        const { id } = req.params;
        const query = getIdFilter(id);

        const existing = await collections.events.findOne(query);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Event not found.' });
        }

        const protocol = req.protocol;
        const host = req.get('host');
        const eventUrl = `${protocol}://${host}/dashboard?event=${encodeURIComponent(id)}`;

        const qrDataUrl = await generateQRCodeDataURL(eventUrl);

        res.json({
            success: true,
            qr_code_url: qrDataUrl,
            qr_url: qrDataUrl,
            qr_code_data_url: qrDataUrl,
            target_url: eventUrl,
            url: eventUrl
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    listEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    archiveEvent,
    assignJudges,
    updateJudgingPeriod,
    getEventQR
};
