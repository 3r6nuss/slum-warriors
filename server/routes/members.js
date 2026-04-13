import express from 'express';
export const router = express.Router();
import db from '../db.js';
import { requireAdmin } from './auth.js';
import { fetchGuildMembers, fetchGuildRoles } from '../lib/discordBot.js';
import { log } from '../logger.js';

// POST /api/members/sync – Sync all Discord members + roles into DB
router.post('/sync', requireAdmin, async (req, res) => {
    try {
        log('API', 'Starting Discord member sync...');

        // Fetch roles first
        const discordRoles = await fetchGuildRoles();

        // Upsert all roles
        const upsertRole = db.prepare(`
            INSERT INTO discord_roles (role_id, name, color, position, last_synced)
            VALUES (?, ?, ?, ?, datetime('now','localtime'))
            ON CONFLICT(role_id) DO UPDATE SET
                name = excluded.name,
                color = excluded.color,
                position = excluded.position,
                last_synced = datetime('now','localtime')
        `);

        const roleTransaction = db.transaction((roles) => {
            for (const role of roles) {
                upsertRole.run(role.role_id, role.name, role.color, role.position);
            }
        });
        roleTransaction(discordRoles);

        // Fetch members
        const discordMembers = await fetchGuildMembers();

        // Filter out bots
        const realMembers = discordMembers.filter(m => !m.is_bot);

        // Upsert all members
        const upsertMember = db.prepare(`
            INSERT INTO discord_members (discord_id, username, display_name, avatar, discord_roles, joined_at, last_synced)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))
            ON CONFLICT(discord_id) DO UPDATE SET
                username = excluded.username,
                display_name = CASE
                    WHEN discord_members.display_name IS NOT NULL AND excluded.display_name IS NOT NULL THEN excluded.display_name
                    WHEN discord_members.display_name IS NULL THEN excluded.display_name
                    ELSE discord_members.display_name
                END,
                avatar = excluded.avatar,
                discord_roles = excluded.discord_roles,
                joined_at = excluded.joined_at,
                last_synced = datetime('now','localtime')
        `);

        const memberTransaction = db.transaction((members) => {
            for (const member of members) {
                upsertMember.run(
                    member.discord_id,
                    member.username,
                    member.display_name,
                    member.avatar,
                    JSON.stringify(member.roles),
                    member.joined_at
                );
            }
        });
        memberTransaction(realMembers);

        // Remove members that are no longer on the server
        const currentIds = realMembers.map(m => m.discord_id);
        if (currentIds.length > 0) {
            const placeholders = currentIds.map(() => '?').join(',');
            db.prepare(`DELETE FROM discord_members WHERE discord_id NOT IN (${placeholders})`).run(...currentIds);
        }

        log('API', `Discord sync complete: ${realMembers.length} members, ${discordRoles.length} roles`);

        res.json({
            success: true,
            members_synced: realMembers.length,
            roles_synced: discordRoles.length,
        });
    } catch (err) {
        log('ERROR', `Discord sync failed: ${err.message}`);
        res.status(500).json({ error: 'Sync fehlgeschlagen: ' + err.message });
    }
});

// GET /api/members – Get all members grouped by roles
router.get('/', requireAdmin, (req, res) => {
    try {
        const members = db.prepare('SELECT * FROM discord_members ORDER BY username COLLATE NOCASE ASC').all();
        const roles = db.prepare('SELECT * FROM discord_roles ORDER BY position DESC').all();

        res.json({ members, roles });
    } catch (err) {
        res.status(500).json({ error: 'Fehler beim Laden: ' + err.message });
    }
});

// PUT /api/members/:id/custom-name – Set custom (RP) display name
router.put('/:id/custom-name', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { custom_name } = req.body;

    const member = db.prepare('SELECT * FROM discord_members WHERE id = ?').get(id);
    if (!member) {
        return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    const trimmedName = custom_name ? custom_name.trim() : null;
    db.prepare('UPDATE discord_members SET custom_name = ? WHERE id = ?').run(trimmedName, id);

    // Log the action
    const adminUser = req.session.user;
    db.prepare('INSERT INTO admin_logs (admin_id, admin_name, action, target_name, details) VALUES (?, ?, ?, ?, ?)')
        .run(adminUser?.id, adminUser?.username || 'System', 'set_member_name', member.username, `Custom name set to "${trimmedName || '(removed)'}"`);

    res.json({ success: true, message: `Name auf "${trimmedName || '(entfernt)'}" gesetzt` });
});

// PUT /api/members/:id/system-role – Set system role for member
router.put('/:id/system-role', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { system_role } = req.body;

    const validRoles = ['admin', 'führung', 'moderator', 'member', 'viewer', null];
    if (!validRoles.includes(system_role)) {
        return res.status(400).json({ error: 'Ungültige Rolle' });
    }

    const member = db.prepare('SELECT * FROM discord_members WHERE id = ?').get(id);
    if (!member) {
        return res.status(404).json({ error: 'Mitglied nicht gefunden' });
    }

    db.prepare('UPDATE discord_members SET system_role = ? WHERE id = ?').run(system_role, id);

    // Log the action
    const adminUser = req.session.user;
    db.prepare('INSERT INTO admin_logs (admin_id, admin_name, action, target_name, details) VALUES (?, ?, ?, ?, ?)')
        .run(adminUser?.id, adminUser?.username || 'System', 'set_member_role', member.username, `System role set to "${system_role || '(none)'}"`);

    res.json({ success: true, message: `System-Rolle auf "${system_role || '(keine)'}" gesetzt` });
});

export default router;
