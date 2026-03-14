import express from 'express';
export const router = express.Router();
import db from '../db.js';
import https from 'https';
import querystring from 'querystring';
import { sendSystemAlert } from '../lib/discord.js';

// Discord OAuth2 Config
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1477714942647079074';
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || 'A-mHq0cHPnOaIIh03GvCi1rebJn3ciu8';
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173/auth/callback';
const ADMIN_DISCORD_ID = '823276402320998450';

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
            db.prepare(
                `UPDATE users SET username = ?, avatar = ?, updated_at = datetime('now','localtime') WHERE discord_id = ?`
            ).run(userInfo.username, userInfo.avatar, userInfo.id);

            // Log login
            db.prepare('INSERT INTO auth_logs (user_id, username, action, ip_address) VALUES (?, ?, ?, ?)').run(existingUser.id, userInfo.username, 'login', req.ip);
        } else {
            // New user: admin gets auto-approved, everyone else is pending
            const defaultRole = isAdmin ? 'admin' : 'pending';
            const defaultApproved = isAdmin ? 1 : 0;
            const res = db.prepare(
                'INSERT INTO users (discord_id, username, avatar, role, approved) VALUES (?, ?, ?, ?, ?)'
            ).run(userInfo.id, userInfo.username, userInfo.avatar, defaultRole, defaultApproved);

            // Log registration and initial login
            db.prepare('INSERT INTO auth_logs (user_id, username, action, ip_address) VALUES (?, ?, ?, ?)').run(res.lastInsertRowid, userInfo.username, 'register', req.ip);
            db.prepare('INSERT INTO auth_logs (user_id, username, action, ip_address) VALUES (?, ?, ?, ?)').run(res.lastInsertRowid, userInfo.username, 'login', req.ip);

            // Discord Alert
            if (!isAdmin) {
                sendSystemAlert(
                    '👤 Neuer Benutzer Registriert',
                    `**${userInfo.username}** hat sich angemeldet.\nBitte im Admin-Bereich die Rolle zuweisen und den Benutzer freischalten.`,
                    0x2ecc71
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
