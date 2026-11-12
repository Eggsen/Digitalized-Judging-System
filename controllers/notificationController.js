const { ObjectId } = require('mongodb');
const { collections } = require('../config/db');
const { logSystemAction } = require('../utils/logger');
const { getEventIdQuery } = require('../utils/dbHelpers');

function formatNotificationDate(val) {
    if (!val) return 'Just now';
    try {
        const dt = new Date(val);
        if (isNaN(dt.getTime())) return 'Just now';
        return dt.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }) + ' ' + dt.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch (e) {
        return 'Just now';
    }
}

/**
 * List User Notifications (GET /api/notifications)
 */
async function listNotifications(req, res, next) {
    try {
        const userId = String(req.user.id);
        const role = (req.user.role || '').toLowerCase();

        let userObjId = null;
        try { userObjId = new ObjectId(userId); } catch (e) {}

        const userFilter = [
            { user_id: userId },
            ...(userObjId ? [{ user_id: userObjId }] : [])
        ];

        let query;
        if (role === 'admin') {
            query = {
                $or: [
                    ...userFilter,
                    { target_role: 'admin' },
                    { recipient_role: 'admin' },
                    { recipient_role: 'all' }
                ]
            };
        } else {
            query = {
                $or: userFilter
            };
        }

        const rawList = await collections.notifications
            .find(query)
            .sort({ created_at: -1 })
            .limit(50)
            .toArray();

        let unreadCount = 0;
        const formatted = rawList.map(n => {
            const isRead = Boolean(n.is_read);
            if (!isRead) unreadCount++;

            return {
                id: String(n._id),
                _id: n._id,
                type: n.type || 'system',
                title: n.title || 'Notification',
                message: n.message || '',
                event_id: n.event_id || null,
                role: n.role || null,
                status: n.status || 'pending',
                is_read: isRead,
                created_at: formatNotificationDate(n.created_at)
            };
        });

        res.json({
            success: true,
            unread_count: unreadCount,
            notifications: formatted
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Respond to Event Invitation (POST /api/notifications or POST /api/notifications/respond)
 */
async function respondToInvitation(req, res, next) {
    try {
        const notifId = (req.body.notification_id || req.body.id || '').trim();
        const action = (req.body.action || '').toLowerCase().trim();

        if (!notifId || !['accept', 'decline'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Valid notification_id and action (accept or decline) are required.'
            });
        }

        const userId = String(req.user.id);
        let userObjId = null;
        try { userObjId = new ObjectId(userId); } catch (e) {}

        let notifObjId = null;
        try { notifObjId = new ObjectId(notifId); } catch (e) {}

        const notifQuery = {
            $and: [
                {
                    $or: [
                        { _id: notifId },
                        ...(notifObjId ? [{ _id: notifObjId }] : [])
                    ]
                },
                {
                    $or: [
                        { user_id: userId },
                        ...(userObjId ? [{ user_id: userObjId }] : [])
                    ]
                },
                { type: 'event_invitation' }
            ]
        };

        const notif = await collections.notifications.findOne(notifQuery);
        if (!notif) {
            return res.status(404).json({
                success: false,
                message: 'Event invitation notification not found.'
            });
        }

        const eventId = notif.event_id;
        const eventDoc = await collections.events.findOne(getEventIdQuery(eventId));
        const eventName = eventDoc?.eventName || eventDoc?.name || `Competition #${eventId}`;
        const userDisplayName = req.user.full_name || req.user.username || 'User';
        const userRoleDisplay = req.user.role ? (req.user.role.charAt(0).toUpperCase() + req.user.role.slice(1)) : 'User';

        if (action === 'accept') {
            // Update notification
            await collections.notifications.updateOne(
                { _id: notif._id },
                {
                    $set: {
                        status: 'accepted',
                        is_read: true,
                        read_at: new Date(),
                        updated_at: new Date()
                    }
                }
            );

            // Add user to event's confirmed_users
            const addConfirmed = [userId];
            if (userObjId) addConfirmed.push(userObjId);

            await collections.events.updateOne(
                getEventIdQuery(eventId),
                {
                    $addToSet: {
                        confirmed_users: { $each: addConfirmed }
                    }
                }
            );

            // Send notification to Admin
            await collections.notifications.insertOne({
                target_role: 'admin',
                type: 'invitation_accepted',
                title: 'Event Invitation Accepted',
                message: `${userDisplayName} (${userRoleDisplay}) accepted the invitation to event "${eventName}".`,
                event_id: eventId,
                user_id: userObjId || userId,
                is_read: false,
                created_at: new Date()
            });

            await logSystemAction(
                req.user.id,
                req.user.username,
                req.user.role,
                'ACCEPT_EVENT_INVITATION',
                `Accepted invitation to event "${eventName}".`,
                req
            );

            return res.json({
                success: true,
                message: `Invitation accepted! Competition "${eventName}" is now active on your dashboard.`
            });
        } else {
            // Decline invitation
            await collections.notifications.updateOne(
                { _id: notif._id },
                {
                    $set: {
                        status: 'declined',
                        is_read: true,
                        read_at: new Date(),
                        updated_at: new Date()
                    }
                }
            );

            // Remove user from event assigned arrays
            const ev = await collections.events.findOne(getEventIdQuery(eventId));
            if (ev) {
                const filterOutUser = (arr) => {
                    if (!Array.isArray(arr)) return [];
                    return arr.filter(item => {
                        const iId = typeof item === 'object' && item !== null
                            ? String(item.id || item._id)
                            : String(item);
                        return iId !== userId && (userObjId ? iId !== String(userObjId) : true);
                    });
                };

                const newJudges = filterOutUser(ev.assignedjudges);
                const newTabs = filterOutUser(ev.tabulators);
                const newConfirmed = filterOutUser(ev.confirmed_users);

                await collections.events.updateOne(
                    getEventIdQuery(eventId),
                    {
                        $set: {
                            assignedjudges: newJudges,
                            assigned_judges: newJudges,
                            tabulators: newTabs,
                            confirmed_users: newConfirmed,
                            updated_at: new Date().toISOString()
                        }
                    }
                );
            }

            // Send notification to Admin
            await collections.notifications.insertOne({
                target_role: 'admin',
                type: 'invitation_declined',
                title: 'Event Invitation Declined',
                message: `${userDisplayName} (${userRoleDisplay}) declined the invitation to event "${eventName}".`,
                event_id: eventId,
                user_id: userObjId || userId,
                is_read: false,
                created_at: new Date()
            });

            await logSystemAction(
                req.user.id,
                req.user.username,
                req.user.role,
                'DECLINE_EVENT_INVITATION',
                `Declined invitation to event "${eventName}".`,
                req
            );

            return res.json({
                success: true,
                message: `Invitation declined for event "${eventName}".`
            });
        }
    } catch (err) {
        next(err);
    }
}

/**
 * Mark Single Notification as Read (PATCH /api/notifications/:id/read)
 */
async function markRead(req, res, next) {
    try {
        const { id } = req.params;
        let notifObjId = null;
        try { notifObjId = new ObjectId(id); } catch (e) {}

        const query = {
            $or: [
                { _id: id },
                ...(notifObjId ? [{ _id: notifObjId }] : [])
            ]
        };

        let targetRead = true;
        if (req.body && req.body.is_read !== undefined) {
            targetRead = Boolean(req.body.is_read);
        } else if (req.body && req.body.toggle) {
            const existing = await collections.notifications.findOne(query);
            targetRead = existing ? !existing.is_read : true;
        }

        await collections.notifications.updateOne(query, {
            $set: { is_read: targetRead, read_at: targetRead ? new Date() : null, updated_at: new Date() }
        });

        res.json({
            success: true,
            is_read: targetRead,
            message: targetRead ? 'Notification marked as read.' : 'Notification marked as unread.'
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Mark All Notifications as Read (PATCH /api/notifications/all/read)
 */
async function markAllRead(req, res, next) {
    try {
        const userId = String(req.user.id);
        const role = (req.user.role || '').toLowerCase();

        let userObjId = null;
        try { userObjId = new ObjectId(userId); } catch (e) {}

        const userFilter = [
            { user_id: userId },
            ...(userObjId ? [{ user_id: userObjId }] : [])
        ];

        let query;
        if (role === 'admin') {
            query = {
                $or: [
                    ...userFilter,
                    { target_role: 'admin' },
                    { recipient_role: 'admin' },
                    { recipient_role: 'all' }
                ]
            };
        } else {
            query = { $or: userFilter };
        }

        await collections.notifications.updateMany(query, {
            $set: { is_read: true, read_at: new Date() }
        });

        res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    listNotifications,
    respondToInvitation,
    markRead,
    markAllRead
};
