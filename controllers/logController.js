const { collections } = require('../config/db');

/**
 * List System Audit Activity Logs
 * - Admins can inspect all logs across the system with filtering by role, exact date, and search keyword.
 * - Supports date sorting in ascending or descending order.
 * - Judges and Tabulators only inspect their own personal activity logs.
 */
async function listLogs(req, res, next) {
    try {
        const user = req.user;
        const page = Math.max(parseInt(req.query.page || '1', 10), 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 10), 200);
        const skip = (page - 1) * limit;

        const { search, role, action, date } = req.query;
        const sortOrder = (req.query.sort || req.query.sort_order || req.query.order || 'desc').toLowerCase();
        const sortDir = sortOrder === 'asc' ? 1 : -1;

        const baseConditions = [];
        const andConditions = [];

        // Non-admin users are strictly constrained to their own audit logs
        if (user && user.role !== 'admin') {
            baseConditions.push({
                $or: [
                    { username: user.username },
                    { userId: String(user.id) },
                    { user_id: String(user.id) }
                ]
            });
        }

        const baseQuery = baseConditions.length > 0 ? { $and: baseConditions } : {};
        if (baseConditions.length > 0) {
            andConditions.push(...baseConditions);
        }

        // Role filter (Case-insensitive: tabulator, judge, admin)
        if (user && user.role === 'admin' && role && role !== 'all') {
            const escapedRole = role.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            andConditions.push({
                role: { $regex: new RegExp(`^${escapedRole}$`, 'i') }
            });
        }

        // Action filter
        if (action && action !== 'all') {
            const escapedAction = action.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            andConditions.push({
                action: { $regex: new RegExp(`^${escapedAction}$`, 'i') }
            });
        }

        // Exact Date filter (matches YYYY-MM-DD)
        if (date && date.trim()) {
            const trimmedDate = date.trim();
            const dateRegex = new RegExp(`^${trimmedDate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
            const dateConditions = [
                { timestamp: { $regex: dateRegex } },
                { created_at: { $regex: dateRegex } },
                { date: { $regex: dateRegex } }
            ];

            const parsedDate = new Date(trimmedDate);
            if (!isNaN(parsedDate.getTime())) {
                const startOfDay = new Date(`${trimmedDate}T00:00:00.000Z`);
                const endOfDay = new Date(`${trimmedDate}T23:59:59.999Z`);
                dateConditions.push(
                    { timestamp: { $gte: startOfDay, $lte: endOfDay } },
                    { created_at: { $gte: startOfDay, $lte: endOfDay } }
                );
            }

            andConditions.push({ $or: dateConditions });
        }

        // Text search across multiple fields
        if (search && search.trim()) {
            const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedSearch, 'i');
            andConditions.push({
                $or: [
                    { username: regex },
                    { role: regex },
                    { details: regex },
                    { message: regex },
                    { action: regex },
                    { ip_address: regex }
                ]
            });
        }

        const query = andConditions.length > 0 ? { $and: andConditions } : {};

        const [unfilteredTotal, total, logs] = await Promise.all([
            collections.logs.countDocuments(baseQuery),
            collections.logs.countDocuments(query),
            collections.logs
                .find(query)
                .sort({ timestamp: sortDir, created_at: sortDir, _id: sortDir })
                .skip(skip)
                .limit(limit)
                .toArray()
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
            sort: sortOrder,
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
