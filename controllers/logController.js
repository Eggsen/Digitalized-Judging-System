const { collections } = require('../config/db');
const { formatActionTerm, ACTION_MAPPINGS, logSystemAction } = require('../utils/logger');
const { generateAuditLogPDF } = require('../utils/auditLogPdfGenerator');

/**
 * Shared helper: Construct MongoDB query and sort parameters for audit logs
 */
function buildLogQuery(user, queryParams = {}) {
    const { search, role, action, date } = queryParams;
    const sortOrder = (queryParams.sort || queryParams.sort_order || queryParams.order || 'desc').toLowerCase();
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    const baseConditions = [];
    const andConditions = [];

    // Non-admin users are strictly constrained to their own audit logs
    if (user && user.role !== 'admin') {
        const userIdentifierConditions = [];
        if (user.username) {
            userIdentifierConditions.push({ username: user.username });
            userIdentifierConditions.push({ username: new RegExp(`^${user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
        }
        if (user.id) {
            userIdentifierConditions.push({ user_id: String(user.id) });
            userIdentifierConditions.push({ userId: String(user.id) });
        }
        if (userIdentifierConditions.length > 0) {
            baseConditions.push({ $or: userIdentifierConditions });
        }
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

    // Action filter (Ignore file export disposition actions: 'download', 'preview')
    const logAction = queryParams.log_action || queryParams.action_filter || (
        action && action !== 'all' && action !== 'download' && action !== 'preview' ? action : null
    );
    if (logAction) {
        const escapedAction = logAction.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const actionRegex = new RegExp(`^${escapedAction}$`, 'i');
        andConditions.push({
            $or: [
                { action: actionRegex },
                { raw_action: actionRegex }
            ]
        });
    }

    // Exact Date filter (matches YYYY-MM-DD in both local timezone and UTC)
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
            const utcStart = new Date(`${trimmedDate}T00:00:00.000Z`);
            const utcEnd = new Date(`${trimmedDate}T23:59:59.999Z`);

            // Always match UTC date window
            dateConditions.push(
                { timestamp: { $gte: utcStart, $lte: utcEnd } },
                { created_at: { $gte: utcStart, $lte: utcEnd } }
            );

            // If client supplied browser timezone offset (in minutes), match local date window
            const tzOffsetMin = parseInt(queryParams.tz_offset || queryParams.timezone_offset, 10);
            if (!isNaN(tzOffsetMin) && tzOffsetMin >= -840 && tzOffsetMin <= 840) {
                const localStart = new Date(utcStart.getTime() + (tzOffsetMin * 60 * 1000));
                const localEnd = new Date(utcEnd.getTime() + (tzOffsetMin * 60 * 1000));
                dateConditions.push(
                    { timestamp: { $gte: localStart, $lte: localEnd } },
                    { created_at: { $gte: localStart, $lte: localEnd } }
                );
            }
        }

        andConditions.push({ $or: dateConditions });
    }

    // Text search across multiple fields
    if (search && search.trim()) {
        const trimmedSearch = search.trim();
        const escapedSearch = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedSearch, 'i');

        // Find matching action keys if search query matches readable descriptions
        const matchingActionKeys = [];
        if (typeof ACTION_MAPPINGS === 'object') {
            for (const [key, label] of Object.entries(ACTION_MAPPINGS)) {
                if (label.toLowerCase().includes(trimmedSearch.toLowerCase()) || key.toLowerCase().includes(trimmedSearch.toLowerCase())) {
                    matchingActionKeys.push(key);
                }
            }
        }

        const searchOr = [
            { username: regex },
            { role: regex },
            { details: regex },
            { message: regex },
            { action: regex },
            { raw_action: regex },
            { ip_address: regex }
        ];

        if (matchingActionKeys.length > 0) {
            searchOr.push({ action: { $in: matchingActionKeys } });
            searchOr.push({ raw_action: { $in: matchingActionKeys } });
        }

        andConditions.push({ $or: searchOr });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};
    return { query, baseQuery, sortDir, sortOrder };
}

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

        if (!collections.logs) {
            return res.json({
                success: true,
                logs: [],
                total: 0,
                unfilteredTotal: 0,
                page,
                limit,
                totalPages: 1,
                start: 0,
                end: 0,
                sort: 'desc',
                pagination: {
                    page,
                    limit,
                    total: 0,
                    pages: 1
                }
            });
        }

        const { query, baseQuery, sortDir, sortOrder } = buildLogQuery(user, req.query);

        const [unfilteredTotal, total, logs] = await Promise.all([
            collections.logs.countDocuments(baseQuery),
            collections.logs.countDocuments(query),
            collections.logs
                .find(query)
                .sort({ timestamp: sortDir, _id: sortDir })
                .skip(skip)
                .limit(limit)
                .toArray()
        ]);

        const totalPages = Math.ceil(total / limit) || 1;
        const start = total === 0 ? 0 : skip + 1;
        const end = Math.min(skip + limit, total);

        res.json({
            success: true,
            logs: logs.map(l => {
                const rawAction = l.raw_action || l.action || 'ACTIVITY';
                const readableAction = formatActionTerm(l.action || rawAction);
                const isoTimestamp = l.timestamp instanceof Date
                    ? l.timestamp.toISOString()
                    : (typeof l.timestamp === 'string' && l.timestamp
                        ? l.timestamp
                        : (l.created_at ? (l.created_at instanceof Date ? l.created_at.toISOString() : String(l.created_at)) : (l._id && typeof l._id.getTimestamp === 'function' ? l._id.getTimestamp().toISOString() : new Date().toISOString())));

                return {
                    ...l,
                    id: String(l._id),
                    timestamp: isoTimestamp,
                    username: l.username || 'System',
                    role: l.role || 'user',
                    rawAction: rawAction,
                    action: readableAction,
                    details: l.details || l.message || ''
                };
            }),
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

/**
 * Export System Audit Logs as CSV
 */
async function exportLogsCSV(req, res, next) {
    try {
        if (!collections.logs) {
            return res.status(503).send('Audit log database service is currently unavailable.');
        }

        const { query, sortDir } = buildLogQuery(req.user, req.query);

        const logs = await collections.logs
            .find(query)
            .sort({ timestamp: sortDir, _id: sortDir })
            .limit(5000)
            .toArray();

        const timestampTag = new Date().toISOString().slice(0, 10);
        const filename = `BukSU_Audit_Logs_${timestampTag}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Emit UTF-8 Byte Order Mark (BOM) so Excel renders all UTF-8 characters cleanly
        let csvContent = '\uFEFF';
        csvContent += '"#","Timestamp (UTC)","Timestamp (Local)","User","Role","Action Code","Action Description","Details","IP Address"\r\n';

        function escapeCSV(val) {
            if (val === null || val === undefined) return '""';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        }

        logs.forEach((l, idx) => {
            const rawAction = l.raw_action || l.action || 'ACTIVITY';
            const readableAction = formatActionTerm(l.action || rawAction);
            const isoTimestamp = l.timestamp instanceof Date
                ? l.timestamp.toISOString()
                : (typeof l.timestamp === 'string' && l.timestamp ? l.timestamp : (l.created_at ? String(l.created_at) : new Date().toISOString()));

            let localTimestamp = isoTimestamp;
            try {
                const d = new Date(isoTimestamp);
                if (!isNaN(d.getTime())) {
                    localTimestamp = d.toLocaleString('en-US');
                }
            } catch (e) {}

            csvContent += [
                escapeCSV(idx + 1),
                escapeCSV(isoTimestamp),
                escapeCSV(localTimestamp),
                escapeCSV(l.username || 'System'),
                escapeCSV((l.role || 'user').toUpperCase()),
                escapeCSV(rawAction),
                escapeCSV(readableAction),
                escapeCSV(l.details || l.message || ''),
                escapeCSV(l.ip_address || '127.0.0.1')
            ].join(',') + '\r\n';
        });

        // Record audit activity
        await logSystemAction(
            req.user?.id,
            req.user?.username,
            req.user?.role,
            'EXPORT_AUDIT_LOGS_CSV',
            `Exported ${logs.length} audit logs in CSV format`,
            req
        );

        return res.send(csvContent);
    } catch (err) {
        next(err);
    }
}

/**
 * Export System Audit Logs as Formatted PDF Report
 */
async function exportLogsPDF(req, res, next) {
    try {
        if (!collections.logs) {
            return res.status(503).json({ success: false, message: 'Audit log database service is currently unavailable.' });
        }

        const { query, sortDir, sortOrder } = buildLogQuery(req.user, req.query);

        const [logs, totalMatching, settingsDoc] = await Promise.all([
            collections.logs
                .find(query)
                .sort({ timestamp: sortDir, _id: sortDir })
                .limit(1000)
                .toArray(),
            collections.logs.countDocuments(query),
            collections.settings.findOne({ _id: 'system_settings' })
        ]);

        const formattedLogs = logs.map(l => {
            const rawAction = l.raw_action || l.action || 'ACTIVITY';
            const readableAction = formatActionTerm(l.action || rawAction);
            const isoTimestamp = l.timestamp instanceof Date
                ? l.timestamp.toISOString()
                : (typeof l.timestamp === 'string' && l.timestamp ? l.timestamp : (l.created_at ? String(l.created_at) : new Date().toISOString()));

            return {
                ...l,
                id: String(l._id),
                timestamp: isoTimestamp,
                username: l.username || 'System',
                role: l.role || 'user',
                rawAction,
                action: readableAction,
                details: l.details || l.message || '',
                ip_address: l.ip_address || '127.0.0.1'
            };
        });

        const pdfBuffer = await generateAuditLogPDF({
            logs: formattedLogs,
            filters: {
                search: req.query.search || '',
                role: req.query.role || 'all',
                date: req.query.date || '',
                sort: sortOrder,
                total: totalMatching
            },
            adminUser: req.user,
            settings: settingsDoc || {}
        });

        const dateTag = new Date().toISOString().slice(0, 10);
        const filename = `BukSU_Audit_Trail_${dateTag}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        const disposition = req.query.disposition || req.query.action || 'download';
        if (disposition === 'preview') {
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        } else {
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        }

        // Record audit activity
        await logSystemAction(
            req.user?.id,
            req.user?.username,
            req.user?.role,
            'EXPORT_AUDIT_LOGS_PDF',
            `Generated system audit trail PDF report (${formattedLogs.length} records)`,
            req
        );

        return res.send(pdfBuffer);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    listLogs,
    exportLogsCSV,
    exportLogsPDF
};
