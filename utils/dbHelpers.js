const { ObjectId } = require('mongodb');

/**
 * Safely parse a value into an ObjectId if valid 24-character hex string,
 * or return null.
 */
function toObjectId(val) {
    if (!val) return null;
    if (val instanceof ObjectId) return val;
    const str = String(val).trim();
    if (/^[0-9a-fA-F]{24}$/.test(str)) {
        try {
            return new ObjectId(str);
        } catch (e) {
            return null;
        }
    }
    return null;
}

/**
 * Return a MongoDB filter for finding a document by its _id.
 * Accurately matches integer IDs (1, 2, 3), string IDs, and ObjectIds.
 */
function getIdFilter(id) {
    if (id === undefined || id === null) {
        return { _id: null };
    }

    if (id instanceof ObjectId) {
        return { _id: id };
    }

    const conditions = [];
    const strId = String(id).trim();

    // 1. Direct string match
    conditions.push({ _id: strId });

    // 2. Numeric integer match
    const num = Number(strId);
    if (!isNaN(num) && Number.isInteger(num)) {
        conditions.push({ _id: num });
    }

    // 3. 24-hex ObjectId match
    const oid = toObjectId(strId);
    if (oid) {
        conditions.push({ _id: oid });
    }

    return conditions.length === 1 ? conditions[0] : { $or: conditions };
}

/**
 * Return a MongoDB query for filtering records by event_id.
 * Matches event_id as integer (1), string ("1"), or ObjectId.
 */
function getEventIdQuery(eventId) {
    if (eventId === undefined || eventId === null) {
        return { event_id: null };
    }

    if (eventId instanceof ObjectId) {
        return { $or: [{ event_id: eventId }, { event_id: String(eventId) }] };
    }

    const conditions = [];
    const strId = String(eventId).trim();

    // 1. String match
    conditions.push({ event_id: strId });

    // 2. Numeric match
    const num = Number(strId);
    if (!isNaN(num) && Number.isInteger(num)) {
        conditions.push({ event_id: num });
    }

    // 3. 24-hex ObjectId match
    const oid = toObjectId(strId);
    if (oid) {
        conditions.push({ event_id: oid });
    }

    return conditions.length === 1 ? conditions[0] : { $or: conditions };
}

/**
 * Mask an email address for privacy in verification prompts.
 * Example: 'username@student.buksu.edu.ph' -> 'u***e@s***u.edu.ph'
 */
function maskEmail(email) {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return 'your registered email';
    }
    const [name, domain] = email.split('@');
    const maskedName = name.length <= 2 
        ? name[0] + '***' 
        : name[0] + '***' + name[name.length - 1];
    
    const domainParts = domain.split('.');
    const maskedDomain = domainParts.map((part, idx) => {
        if (idx === domainParts.length - 1) return part;
        return part.length <= 2 ? part[0] + '*' : part[0] + '***' + part[part.length - 1];
    }).join('.');

    return `${maskedName}@${maskedDomain}`;
}

module.exports = {
    toObjectId,
    getIdFilter,
    getEventIdQuery,
    maskEmail
};

