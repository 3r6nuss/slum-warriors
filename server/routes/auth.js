const express = require('express');
const router = express.Router();
const db = require('../db');
const https = require('https');
const querystring = require('querystring');

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
                } catch (e) {
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
                'UPDATE users SET username = ?, avatar = ?, updated_at = datetime("now","localtime") WHERE discord_id = ?'
            ).run(userInfo.username, userInfo.avatar, userInfo.id);
        } else {
            db.prepare(
                'INSERT INTO users (discord_id, username, avatar, role) VALUES (?, ?, ?, ?)'
            ).run(userInfo.id, userInfo.username, userInfo.avatar, isAdmin ? 'admin' : 'member');
        }

        // Get the full user record
        const user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(userInfo.id);

        // Force admin role for hard-coded ID
        if (isAdmin && user.role !== 'admin') {
            db.prepare('UPDATE users SET role = ? WHERE discord_id = ?').run('admin', userInfo.id);
            user.role = 'admin';
        }

        // Store user in session
        req.session.user = {
            id: user.id,
            discord_id: user.discord_id,
            username: user.username,
            avatar: user.avatar,
            role: user.role,
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
                avatar: user.avatar,
                role: user.role,
            };
            return res.json({ user: req.session.user });
        }
    }
    res.json({ user: null });
});

// POST /api/auth/logout – clear session
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// ---- Admin Routes ----

// Middleware: require admin role
function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Zugriff verweigert – nur für Admins' });
    }
    next();
}

// GET /api/auth/users – list all users (admin only)
router.get('/users', requireAdmin, (req, res) => {
    const users = db.prepare('SELECT id, discord_id, username, avatar, role, created_at, updated_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
});

// PUT /api/auth/users/:id/role – update user role (admin only)
router.put('/users/:id/role', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'moderator', 'member', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'Ungültige Rolle' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    // Prevent removing admin from hard-coded admin
    if (user.discord_id === ADMIN_DISCORD_ID && role !== 'admin') {
        return res.status(403).json({ error: 'Admin-Rolle kann für den Hauptadmin nicht geändert werden' });
    }

    db.prepare('UPDATE users SET role = ?, updated_at = datetime("now","localtime") WHERE id = ?').run(role, id);
    res.json({ success: true, message: `Rolle auf "${role}" geändert` });
});

module.exports = router;
module.exports.requireAdmin = requireAdmin;
