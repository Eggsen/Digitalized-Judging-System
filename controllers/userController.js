const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { collections } = require('../config/db');
const { logSystemAction } = require('../utils/logger');
const { sendSystemEmail } = require('../utils/mailer');
const { getIdFilter } = require('../utils/dbHelpers');
const { canUserCreateAdmin, isEmailAuthorizedAdminCreator } = require('../utils/authHelpers');

/**
 * List System Users / Accounts
 */
async function listUsers(req, res, next) {
    try {
        const { role, search } = req.query;
        const query = {};

        if (role && role !== 'all') {
            query.role = role.toLowerCase();
        }

        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            query.$or = [
                { username: regex },
                { email: regex },
                { full_name: regex },
                { first_name: regex },
                { last_name: regex }
            ];
        }

        const users = await collections.users.find(query, {
            projection: { password: 0, admin_pin: 0, reset_token: 0, reset_token_expires_at: 0 }
        }).sort({ created_at: -1 }).toArray();

        const protocol = req.protocol;
        const host = req.get('host');
        const isRequesterAuthorized = await canUserCreateAdmin(req.user);

        const formatted = users.map(u => {
            const idStr = String(u._id);
            const fullName = (u.full_name || u.name || '').trim();
            const firstName = u.first_name || (fullName ? fullName.split(' ')[0] : (u.username || ''));
            const lastName = u.last_name || (fullName ? fullName.split(' ').slice(1).join(' ') : '');
            const inviteLink = u.invite_token ? `${protocol}://${host}/auth/accept-invitation?token=${u.invite_token}` : null;
            const isActive = u.is_active !== false && u.status !== 'disabled';
            const userEmail = (u.email || '').toLowerCase().trim();
            const isUserAdminCreator = (u.role === 'admin') && Boolean(
                u.can_create_admin === true ||
                u.is_super_admin === true ||
                isEmailAuthorizedAdminCreator(userEmail)
            );

            return {
                id: idStr,
                _id: u._id,
                username: u.username,
                email: u.email || '',
                first_name: firstName,
                last_name: lastName,
                name: fullName || `${firstName} ${lastName}`.trim() || u.username,
                full_name: fullName || `${firstName} ${lastName}`.trim() || u.username,
                role: u.role || 'judge',
                can_create_admin: isUserAdminCreator,
                status: u.status || (isActive ? 'active' : 'disabled'),
                is_active: isActive,
                has_admin_pin: Boolean(u.admin_pin),
                invite_token: u.invite_token || null,
                invite_link: inviteLink,
                created_at: u.created_at || null,
                activated_at: u.activated_at || null
            };
        });

        res.json({
            success: true,
            accounts: formatted,
            users: formatted,
            can_create_admin: isRequesterAuthorized
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Create User / Send Invitation
 */
async function createUser(req, res, next) {
    try {
        const { username, email, full_name, first_name, last_name, role = 'judge', password, send_invitation, admin_pin } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email address is required.' });
        }

        const cleanEmail = email.toLowerCase().trim();
        const cleanRole = (role || 'judge').toLowerCase().trim();

        // RBAC: Verify if requester has permission to create an Administrator account
        if (cleanRole === 'admin') {
            const isAuthorized = await canUserCreateAdmin(req.user);
            if (!isAuthorized) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. You do not have privilege to create or invite Administrator accounts. Only selective authorized accounts (e.g. 2401108432@student.buksu.edu.ph) are permitted to create administrators.'
                });
            }
        }

        const existing = await collections.users.findOne({ email: cleanEmail });
        if (existing) {
            return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
        }

        const cleanUsername = (username || cleanEmail.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '');
        let hashedPassword = null;
        let inviteToken = null;
        let inviteExpires = null;

        if (send_invitation || !password) {
            inviteToken = crypto.randomBytes(24).toString('hex');
            inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48 hours
        } else {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        let hashedAdminPin = null;
        let assignedAdminPin = null;

        if (cleanRole === 'admin') {
            if (admin_pin && String(admin_pin).trim() !== '') {
                assignedAdminPin = String(admin_pin).trim();
            } else {
                assignedAdminPin = String(crypto.randomInt(100000, 999999));
            }
            hashedAdminPin = await bcrypt.hash(assignedAdminPin, 10);
        }

        const effectiveFullName = (full_name || `${first_name || ''} ${last_name || ''}`.trim() || cleanUsername).trim();

        const newUser = {
            username: cleanUsername,
            email: cleanEmail,
            full_name: effectiveFullName,
            first_name: first_name || effectiveFullName.split(' ')[0],
            last_name: last_name || effectiveFullName.split(' ').slice(1).join(' '),
            role: cleanRole,
            can_create_admin: cleanRole === 'admin' ? isEmailAuthorizedAdminCreator(cleanEmail) : false,
            status: inviteToken ? 'pending' : 'active',
            is_active: true,
            password: hashedPassword,
            admin_pin: hashedAdminPin,
            invite_token: inviteToken,
            invite_token_expires_at: inviteExpires,
            created_at: new Date().toISOString()
        };

        const result = await collections.users.insertOne(newUser);

        if (inviteToken) {
            const protocol = req.protocol;
            const host = req.get('host');
            const inviteLink = `${protocol}://${host}/auth/accept-invitation?token=${inviteToken}`;

            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 550px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
                    <h2 style="color: #0F2C59;">Invitation to BukSU JudgeTab</h2>
                    <p style="color: #475569; font-size: 14px;">You have been invited to join BukSU JudgeTab as an official <strong>${role.toUpperCase()}</strong>.</p>
                    ${role.toLowerCase() === 'admin' && assignedAdminPin ? `
                    <div style="background-color: #fefce8; border: 1px solid #fde047; border-radius: 12px; padding: 14px; margin: 18px 0; text-align: center;">
                        <p style="margin: 0; font-size: 11px; color: #854d0e; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Your Exclusive Admin PIN</p>
                        <p style="margin: 6px 0 0; font-size: 22px; font-weight: 900; font-family: monospace; color: #0F2C59; letter-spacing: 4px;">${assignedAdminPin}</p>
                        <p style="margin: 6px 0 0; font-size: 11px; color: #713f12;">Keep this PIN private. It is required to unlock elevated system configuration and API credentials.</p>
                    </div>
                    ` : ''}
                    <div style="text-align: center; margin: 28px 0;">
                        <a href="${inviteLink}" style="padding: 12px 28px; background-color: #0F2C59; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px;">Accept Invitation & Set Password</a>
                    </div>
                    <p style="font-size: 12px; color: #94a3b8;">This invitation link will expire in 48 hours.</p>
                </div>
            `;
            await sendSystemEmail(cleanEmail, `Invitation to join as ${role.toUpperCase()} - BukSU JudgeTab`, html);
        }

        await logSystemAction(
            req.user.id,
            req.user.username,
            req.user.role,
            'CREATE_USER',
            `Admin created user account "${cleanUsername}" with role ${role}.`,
            req
        );

        res.status(201).json({
            success: true,
            message: inviteToken ? 'Invitation email dispatched successfully.' : 'User account created successfully.',
            invite_link: inviteToken ? `${req.protocol}://${req.get('host')}/auth/accept-invitation?token=${inviteToken}` : null,
            user: {
                ...newUser,
                _id: result.insertedId,
                id: String(result.insertedId),
                admin_pin: assignedAdminPin
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Update User Role or Permissions (is_active)
 */
async function updateRole(req, res, next) {
    try {
        const { id } = req.params;
        const { role, is_active } = req.body;
        const query = getIdFilter(id);

        const targetUser = await collections.users.findOne(query);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User account not found.' });
        }

        const isRequesterAuthorized = await canUserCreateAdmin(req.user);

        const updateDoc = { updated_at: new Date().toISOString() };
        if (role !== undefined) {
            const cleanRole = role.toLowerCase().trim();
            if (!['admin', 'tabulator', 'judge'].includes(cleanRole)) {
                return res.status(400).json({ success: false, message: 'Invalid role assignment.' });
            }

            // Only authorized admin creators can assign or promote to 'admin'
            if (cleanRole === 'admin' && !isRequesterAuthorized) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. You do not have privilege to assign the Administrator role. Only selective authorized accounts can make an admin account.'
                });
            }

            updateDoc.role = cleanRole;
        }

        // Non-authorized admins cannot modify role or active status of Administrator accounts
        if (targetUser.role === 'admin' && !isRequesterAuthorized && String(targetUser._id) !== String(req.user.id)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You do not have privilege to modify Administrator accounts.'
            });
        }

        if (is_active !== undefined) {
            updateDoc.is_active = Boolean(is_active);
            updateDoc.status = updateDoc.is_active ? 'active' : 'disabled';
        }

        await collections.users.updateOne(query, {
            $set: updateDoc,
            $inc: { token_version: 1 }
        });

        res.json({
            success: true,
            message: 'User permissions/role updated successfully.'
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Delete User / Revoke Account
 */
async function deleteUser(req, res, next) {
    try {
        const { id } = req.params;

        if (id === req.user.id) {
            return res.status(400).json({ success: false, message: 'You cannot delete your own active administrator account.' });
        }

        const query = getIdFilter(id);
        const targetUser = await collections.users.findOne(query);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User account not found.' });
        }

        // Non-authorized admins cannot delete Administrator accounts
        if (targetUser.role === 'admin') {
            const isRequesterAuthorized = await canUserCreateAdmin(req.user);
            if (!isRequesterAuthorized) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. You do not have privilege to delete Administrator accounts.'
                });
            }
        }

        await collections.users.deleteOne(query);

        res.json({ success: true, message: 'User account removed.' });
    } catch (err) {
        next(err);
    }
}

/**
 * Get Current User Preferences
 */
async function getUserPreferences(req, res, next) {
    try {
        const query = getIdFilter(req.user.id);
        const user = await collections.users.findOne(query, { projection: { preferences: 1 } });
        res.json({
            success: true,
            preferences: user?.preferences || { theme: 'light', colorRule: 'normal', navPlacement: 'top' }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Save Current User Preferences
 */
async function saveUserPreferences(req, res, next) {
    try {
        const { theme, colorRule, navPlacement } = req.body;
        const prefs = {
            theme: ['dark', 'light'].includes(theme) ? theme : 'light',
            colorRule: ['three-color', 'normal'].includes(colorRule) ? colorRule : 'normal',
            navPlacement: ['sidebar', 'top'].includes(navPlacement) ? navPlacement : 'top',
            updated_at: new Date().toISOString()
        };

        const query = getIdFilter(req.user.id);
        await collections.users.updateOne(query, { $set: { preferences: prefs } });

        res.json({ success: true, message: 'Preferences saved.', preferences: prefs });
    } catch (err) {
        next(err);
    }
}

/**
 * Reset / Set Admin PIN (POST /api/users/:id/reset-pin)
 */
async function resetAdminPin(req, res, next) {
    try {
        const { id } = req.params;
        const { new_pin } = req.body;
        const query = getIdFilter(id);

        const targetUser = await collections.users.findOne(query);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User account not found.' });
        }

        if (targetUser.role !== 'admin') {
            return res.status(400).json({ success: false, message: 'Admin PINs are exclusive to administrator accounts.' });
        }

        const isSelf = String(targetUser._id) === String(req.user.id);
        const isRequesterAuthorized = await canUserCreateAdmin(req.user);

        if (!isSelf && !isRequesterAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only authorized administrators can reset Admin PINs for other administrators.'
            });
        }

        const generatedPin = (new_pin && String(new_pin).trim()) || String(crypto.randomInt(100000, 999999));
        const hashedPin = await bcrypt.hash(generatedPin, 10);

        await collections.users.updateOne(query, {
            $set: {
                admin_pin: hashedPin,
                pin_failed_attempts: 0,
                pin_locked_until: null,
                updated_at: new Date().toISOString()
            },
            $inc: { token_version: 1 }
        });

        await logSystemAction(
            req.user.id,
            req.user.username,
            req.user.role,
            'RESET_ADMIN_PIN',
            `Admin reset exclusive Admin PIN for administrator "${targetUser.username}".`,
            req
        );

        res.json({
            success: true,
            message: `Admin PIN reset successfully for ${targetUser.username}.`,
            admin_pin: generatedPin
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Revoke Active User Sessions (Admin Action - MVCC Session Invalidation)
 * POST /api/users/:id/revoke-sessions
 */
async function revokeUserSessions(req, res, next) {
    try {
        const { id } = req.params;
        const query = getIdFilter(id);

        const targetUser = await collections.users.findOne(query);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User account not found.' });
        }

        const nextVersion = (targetUser.token_version || 1) + 1;
        await collections.users.updateOne(query, {
            $set: {
                token_version: nextVersion,
                updated_at: new Date().toISOString()
            }
        });

        await logSystemAction(
            req.user.id,
            req.user.username,
            req.user.role,
            'REVOKE_USER_SESSIONS',
            `Admin revoked all active login sessions for user "${targetUser.username}" (token version bumped to v${nextVersion}).`,
            req
        );

        res.json({
            success: true,
            message: `All active sessions for "${targetUser.username}" have been terminated. They will be required to log in again.`,
            token_version: nextVersion
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    listUsers,
    createUser,
    updateRole,
    deleteUser,
    resetAdminPin,
    revokeUserSessions,
    getUserPreferences,
    saveUserPreferences
};
