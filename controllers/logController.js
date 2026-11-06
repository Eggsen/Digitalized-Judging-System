const { collections } = require('../config/db');

/**
 * List System Audit Activity Logs
 * - Admins can inspect all logs across the system.
 * - Judges and Tabulators only inspect their own personal activity logs.
 */
async function listLogs(req, res, next) {
    try {
        const user = req.user;
        const page = Math.max(parseInt(req.query.page || '1', 10), 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 10), 200);
        const skip = (page - 1) * limit;

        const { search, role, action } = req.query;
        const baseQuery = {};

        // Non-admin users are strictly constrained to their own audit logs
        if (user && user.role !== 'admin') {
            baseQuery.$or = [
                { username: user.username },
                { userId: user.id },
                { user_id: user.id }
            ];
        } else if (role && role !== 'all') {
            baseQuery.role = role.toLowerCase();
        }

        if (action && action !== 'all') {
            baseQuery.action = action;
        }

        const query = { ...baseQuery };

        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            const searchConditions = [
                { username: regex },
                { details: regex },
                { message: regex },
                { action: regex },
                { ip_address: regex }
            ];

            if (baseQuery.$or) {
                query.$and = [
                    { $or: baseQuery.$or },
                    { $or: searchConditions }
                ];
                delete query.$or;
            } else {
                query.$or = searchConditions;
            }
        }

        const [unfilteredTotal, total, logs] = await Promise.all([
            collections.logs.countDocuments(baseQuery),
            collections.logs.countDocuments(query),
            collections.logs.find(query).sort({ timestamp: -1, created_at: -1 }).skip(skip).limit(limit).toArray()
        ]);

        const totalPages = Math.ceil(total / limit) || 1;
        const start = total === 0 ? 0 : skip + 1;
        const end = Math.min(skip + limit, total);

        res.json({
            success: true,
            logs: logs.map(l => ({
                ...l,
                id: String(l._id),
                timestamp: l.timestamp || l.created_at || new Date().toISOString(),
                username: l.username || 'System',
                role: l.role || 'user',
                action: l.action || 'ACTIVITY',
                details: l.details || l.message || ''
            })),
            total,
            unfilteredTotal,
            page,
            limit,
            totalPages,
            start,
            end,
            pagination: {
                page,
                limit,
                total,
                pages: totalPages
            }
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    listLogs
};
