import express from 'express';
export const router = express.Router();
import db from '../db.js';
import https from 'https';
import querystring from 'querystring';
import { sendSystemAlert } from '../lib/discord.js';
import { fetchGuildMember } from '../lib/discordBot.js';
import { log } from '../logger.js';

// Discord OAuth2 Config
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1477714942647079074';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'A-mHq0cHPnOaIIh03GvCi1rebJn3ciu8';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173/auth/callback';
const ADMIN_DISCORD_ID = '823276402320998450';

// System role priority (higher = more privileged)
const ROLE_PRIORITY = { admin: 5, 'führung': 4, moderator: 3, member: 2, viewer: 1 };

/**
 * Resolves a system role for a user based on their Discord server roles.
 * Returns { role, approved, display_name } or null if not on server / no mapping.
 */
async function resolveDiscordRole(discordId) {
    try {
        const guildMember = await fetchGuildMember(discordId);
        if (!guildMember) {
            log('AUTH', `User ${discordId} is not on the Discord server`);
            return null;
        }

        // Load role mappings from settings
        const mappingSetting = db.prepare("SELECT value FROM settings WHERE key = 'role_mappings'").get();
        if (!mappingSetting) {
            log('AUTH', `No role_mappings configured, skipping auto-role for ${discordId}`);
            return { role: null, approved: false, display_name: guildMember.display_name };
        }

        let mappings;
        try {
            mappings = JSON.parse(mappingSetting.value);
        } catch {
            log('ERROR', `Invalid role_mappings JSON in settings`);
            return { role: null, approved: false, display_name: guildMember.display_name };
        }

        // mappings is an array of { discord_role_id, system_role }
        // Find the highest priority matching role
        let bestRole = null;
        let bestPriority = -1;

        for (const mapping of mappings) {
            if (guildMember.roles.includes(mapping.discord_role_id)) {
                const priority = ROLE_PRIORITY[mapping.system_role] || 0;
                if (priority > bestPriority) {
                    bestPriority = priority;
                    bestRole = mapping.system_role;
                }
            }
        }

        if (bestRole) {
            log('AUTH', `Auto-assigned role "${bestRole}" to user ${discordId} (display: ${guildMember.display_name})`);
        }

        return {
            role: bestRole,
            approved: !!bestRole,
            display_name: guildMember.display_name,
        };
    } catch (err) {
        log('ERROR', `Failed to resolve Discord role for ${discordId}: ${err.message}`);
        return null;
    }
}

// Helper: HTTPS request as promise
function httpsRequest(url, options, postData) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    reject(new Error('Failed to parse response: ' + data));
                }
            });
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

// GET /api/auth/login – redirect to Discord OAuth2
router.get('/login', (req, res) => {
    if (!DISCORD_CLIENT_ID) {
        return res.status(500).json({ error: 'Discord Client ID nicht konfiguriert. Setze DISCORD_CLIENT_ID Umgebungsvariable.' });
    }
    const params = querystring.stringify({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify',
    });
    res.json({ url: `https://discord.com/api/oauth2/authorize?${params}` });
});

// POST /api/auth/callback – exchange code for token, get user info
router.post('/callback', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code fehlt' });

    try {
        // Exchange code for access token
        const tokenData = querystring.stringify({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: DISCORD_REDIRECT_URI,
        });

        const tokenResult = await httpsRequest('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(tokenData),
            },
        }, tokenData);

        if (tokenResult.error) {
            return res.status(400).json({ error: 'Token-Austausch fehlgeschlagen: ' + tokenResult.error_description });
        }

        // Get user info from Discord
        const userInfo = await httpsRequest('https://discord.com/api/users/@me', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tokenResult.access_token}`,
            },
        });

        if (!userInfo.id) {
            return res.status(400).json({ error: 'Benutzerinfo konnte nicht abgerufen werden' });
        }

        // Upsert user in DB
        const existingUser = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(userInfo.id);
        const isAdmin = userInfo.id === ADMIN_DISCORD_ID;

        if (existingUser) {
            // Existing user: update username/avatar, and refresh display_name from Discord if not manually set
            const discordInfo = await resolveDiscordRole(userInfo.id);
            const updateDisplayName = discordInfo?.display_name && !existingUser.display_name
                ? discordInfo.display_name : existingUser.display_name;

            db.prepare(
                `UPDATE users SET username = ?, avatar = ?, display_name = COALESCE(?, display_name), updated_at = datetime('now','localtime') WHERE discord_id = ?`
            ).run(userInfo.username, userInfo.avatar, updateDisplayName, userInfo.id);

            // Log login
            db.prepare('INSERT INTO auth_logs (user_id, username, action, ip_address) VALUES (?, ?, ?, ?)').run(existingUser.id, userInfo.username, 'login', req.ip);
        } else {
            // New user: try to auto-assign role based on Discord server roles
            let defaultRole = isAdmin ? 'admin' : 'pending';
            let defaultApproved = isAdmin ? 1 : 0;
            let displayName = null;

            if (!isAdmin) {
                const discordInfo = await resolveDiscordRole(userInfo.id);
                if (discordInfo) {
                    displayName = discordInfo.display_name;
                    if (discordInfo.role) {
                        defaultRole = discordInfo.role;
                        defaultApproved = 1;
                        log('AUTH', `New user ${userInfo.username} auto-assigned role "${defaultRole}" based on Discord roles`);
                    }
                }
            }

            const insertResult = db.prepare(
                'INSERT INTO users (discord_id, username, avatar, role, approved, display_name) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(userInfo.id, userInfo.username, userInfo.avatar, defaultRole, defaultApproved, displayName);

            // Log registration and initial login
            db.prepare('INSERT INTO auth_logs (user_id, username, action, ip_address) VALUES (?, ?, ?, ?)').run(insertResult.lastInsertRowid, userInfo.username, 'register', req.ip);
            db.prepare('INSERT INTO auth_logs (user_id, username, action, ip_address) VALUES (?, ?, ?, ?)').run(insertResult.lastInsertRowid, userInfo.username, 'login', req.ip);

            // Discord Alert
            if (defaultRole === 'pending') {
                sendSystemAlert(
                    '👤 Neuer Benutzer Registriert',
                    `**${userInfo.username}** hat sich angemeldet.\nBitte im Admin-Bereich die Rolle zuweisen und den Benutzer freischalten.`,
                    0x2ecc71
                );
            } else {
                sendSystemAlert(
                    '✅ Benutzer automatisch freigeschaltet',
                    `**${userInfo.username}** wurde automatisch als **${defaultRole}** freigeschaltet (Discord-Rolle erkannt).`,
                    0x3498db
                );
            }
        }

        // Get the full user record
        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(userInfo.id);

        // Force admin role for hard-coded admin ID
        if (isAdmin && user.role !== 'admin') {
            db.prepare('UPDATE users SET role = ?, approved = 1 WHERE discord_id = ?').run('admin', userInfo.id);
            user.role = 'admin';
            user.approved = 1;
        }

        // Store user in session
        req.session.user = {
            id: user.id,
            discord_id: user.discord_id,
            username: user.username,
            display_name: user.display_name || null,
            avatar: user.avatar,
            role: user.role,
            approved: user.approved,
        };

        res.json({ user: req.session.user });
    } catch (err) {
        console.error('[Auth] Error:', err);
        res.status(500).json({ error: 'Authentifizierung fehlgeschlagen: ' + err.message });
    }
});

// GET /api/auth/me – get current user
router.get('/me', (req, res) => {
    if (req.session.user) {
        // Refresh from DB
        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(req.session.user.discord_id);
        if (user) {
            req.session.user = {
                id: user.id,
                discord_id: user.discord_id,
                username: user.username,
                display_name: user.display_name || null,
                avatar: user.avatar,
                role: user.role,
                approved: user.approved,
            };
            return res.json({ user: req.session.user });
        }
    }
    res.json({ user: null });
});

// POST /api/auth/login-with-token – Login using a backup token
router.post('/login-with-token', (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token fehlt' });

    try {
        const user = db.prepare(`SELECT * FROM users WHERE login_token = ? AND login_token_expires_at > datetime('now', 'localtime')`).get(token);
        
        if (!user) {
            return res.status(401).json({ error: 'Ungültiger oder abgelaufener Token' });
        }

        if (!user.approved && user.role !== 'admin') {
             return res.status(403).json({ error: 'Benutzer ist noch nicht freigeschaltet' });
        }

        // Establish session
        req.session.user = {
            id: user.id,
            discord_id: user.discord_id,
            username: user.username,
            display_name: user.display_name || null,
            avatar: user.avatar,
            role: user.role,
            approved: user.approved,
        };

        // Extend expiration by 30 days and clear old session logic
        db.prepare(`UPDATE users SET login_token_expires_at = datetime('now', '+30 days', 'localtime'), updated_at = datetime('now', 'localtime') WHERE id = ?`).run(user.id);
        
        // Log action
        db.prepare('INSERT INTO auth_logs (user_id, username, action, ip_address) VALUES (?, ?, ?, ?)').run(user.id, user.username, 'login', req.ip);

        res.json({ success: true, user: req.session.user });

    } catch (err) {
        log('ERROR', `Token login failed: ${err.message}`);
        res.status(500).json({ error: 'Systemfehler beim Token-Login' });
    }
});

// POST /api/auth/logout – clear session
router.post('/logout', (req, res) => {
    if (req.session.user) {
        db.prepare('INSERT INTO auth_logs (user_id, username, action, ip_address) VALUES (?, ?, ?, ?)').run(req.session.user.id, req.session.user.username, 'logout', req.ip);
    }
    req.session.destroy();
    res.json({ success: true });
});

// ---- Admin Routes ----

// Middleware: require admin role
export function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Zugriff verweigert – nur für Admins' });
    }
    next();
}

// GET /api/auth/users – list all users (admin only)
router.get('/users', requireAdmin, (req, res) => {
    const users = db.prepare('SELECT id, discord_id, username, display_name, avatar, role, created_at, updated_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
});

// PUT /api/auth/users/:id/role – update user role (admin only)
router.put('/users/:id/role', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'führung', 'moderator', 'member', 'viewer', 'pending'].includes(role)) {
        return res.status(400).json({ error: 'Ungültige Rolle' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    // Prevent removing admin role from hard-coded admin
    if (user.discord_id === ADMIN_DISCORD_ID && role !== 'admin') {
        return res.status(403).json({ error: 'Admin-Rolle kann für den Hauptadmin nicht geändert werden' });
    }

    db.prepare(`UPDATE users SET role = ?, updated_at = datetime('now','localtime') WHERE id = ?`).run(role, id);

    // Log Admin Action
    const adminUser = req.session.user;
    db.prepare('INSERT INTO admin_logs (admin_id, admin_name, action, target_id, target_name, details) VALUES (?, ?, ?, ?, ?, ?)')
        .run(adminUser.id, adminUser.username, 'change_role', user.id, user.username, `Role changed from ${user.role} to ${role}`);

    // Discord Alert
    sendSystemAlert(
        '🛡️ Rolle geändert',
        `Admin **${adminUser.username}** hat die Rolle von **${user.username}** auf **${role}** geändert.`,
        0xf1c40f
    );

    res.json({ success: true, message: `Rolle auf "${role}" geändert` });
});

// PUT /api/auth/users/:id/approve – approve a pending user and assign role (admin only)
router.put('/users/:id/approve', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    const targetRole = role || 'member';
    if (!['admin', 'führung', 'moderator', 'member', 'viewer'].includes(targetRole)) {
        return res.status(400).json({ error: 'Ungültige Rolle' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    db.prepare(`UPDATE users SET role = ?, approved = 1, updated_at = datetime('now','localtime') WHERE id = ?`).run(targetRole, id);

    // Log Admin Action
    const adminUser = req.session.user;
    db.prepare('INSERT INTO admin_logs (admin_id, admin_name, action, target_id, target_name, details) VALUES (?, ?, ?, ?, ?, ?)')
        .run(adminUser.id, adminUser.username, 'approve_user', user.id, user.username, `Approved with role: ${targetRole}`);

    // Discord Alert
    sendSystemAlert(
        '✅ Benutzer freigeschaltet',
        `Admin **${adminUser.username}** hat den Benutzer **${user.username}** freigeschaltet (Rolle: **${targetRole}**).`,
        0x2ecc71
    );

    res.json({ success: true, message: `Benutzer freigeschaltet mit Rolle "${targetRole}"` });
});

// PUT /api/auth/users/:id/revoke – revoke approval, set user back to pending (admin only)
router.put('/users/:id/revoke', requireAdmin, (req, res) => {
    const { id } = req.params;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    // Prevent revoking the hard-coded admin
    if (user.discord_id === ADMIN_DISCORD_ID) {
        return res.status(403).json({ error: 'Der Hauptadmin kann nicht gesperrt werden' });
    }

    db.prepare(`UPDATE users SET role = 'pending', approved = 0, updated_at = datetime('now','localtime') WHERE id = ?`).run(id);

    // Log Admin Action
    const adminUser = req.session.user;
    db.prepare('INSERT INTO admin_logs (admin_id, admin_name, action, target_id, target_name, details) VALUES (?, ?, ?, ?, ?, ?)')
        .run(adminUser.id, adminUser.username, 'revoke_user', user.id, user.username, `Revoked approval. Back to pending.`);

    // Discord Alert
    sendSystemAlert(
        '🛑 Benutzer gesperrt / zurückgesetzt',
        `Admin **${adminUser.username}** hat die Freischaltung für den Benutzer **${user.username}** zurückgezogen.`,
        0xe74c3c
    );

    res.json({ success: true, message: `Freischaltung für "${user.username}" wurde zurückgesetzt` });
});

// PUT /api/auth/users/:id/display-name – set display name (admin only)
router.put('/users/:id/display-name', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { display_name } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const trimmedName = display_name ? display_name.trim() : null;
    db.prepare(`UPDATE users SET display_name = ?, updated_at = datetime('now','localtime') WHERE id = ?`).run(trimmedName, id);

    const adminUser = req.session.user;
    db.prepare('INSERT INTO admin_logs (admin_id, admin_name, action, target_id, target_name, details) VALUES (?, ?, ?, ?, ?, ?)')
        .run(adminUser.id, adminUser.username, 'set_display_name', user.id, user.username, `Changed display name from ${user.display_name} to ${trimmedName}`);

    res.json({ success: true, message: `Klarname auf "${trimmedName || '(entfernt)'}" gesetzt` });
});

export default router;
