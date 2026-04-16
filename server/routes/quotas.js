import express from 'express';
export const router = express.Router();
import db from '../db.js';
import { requireAdmin } from './auth.js';
import { sendSystemAlert } from '../lib/discord.js';
import { log } from '../logger.js';

// Middleware: Require Moderator or Admin
function requireModerator(req, res, next) {
    if (!req.session.user || !['admin', 'führung', 'moderator'].includes(req.session.user.role)) {
        return res.status(403).json({ error: 'Zugriff verweigert – nur für Moderatoren oder höher' });
    }
    next();
}

// GET /api/quotas – Get global quota goal and list of users with their status
router.get('/', requireModerator, (req, res) => {
    try {
        const goal = db.prepare("SELECT value FROM settings WHERE key = 'current_quota'").get()?.value || '';
        const users = db.prepare('SELECT id, discord_id, username, display_name, avatar, role, has_paid_quota FROM users ORDER BY username COLLATE NOCASE ASC').all();
        
        res.json({ goal, users });
    } catch (err) {
        log('ERROR', `GET /api/quotas failed: ${err.message}`);
        res.status(500).json({ error: 'Fehler beim Laden der Abgaben' });
    }
});

// PUT /api/quotas/goal – Update global quota goal
router.put('/goal', requireModerator, (req, res) => {
    const { goal } = req.body;
    
    if (typeof goal !== 'string') {
        return res.status(400).json({ error: 'Ungültiges Ziel' });
    }

    try {
        db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(goal.trim(), 'current_quota');
        
        const actionUser = req.session.user;
        db.prepare('INSERT INTO admin_logs (admin_name, action, details) VALUES (?, ?, ?)')
            .run(actionUser.username, 'update_quota_goal', `Neues Abgabenziel gesetzt: ${goal.trim()}`);
            
        sendSystemAlert(
            '📝 Neues Abgabenziel gesetzt',
            `**${actionUser.username}** hat ein neues Pflichtabgabe-Ziel definiert:\n\`\`\`\n${goal.trim() || 'Kein Ziel'}\n\`\`\``,
            0x3498db
        );

        res.json({ success: true, message: 'Abgabenziel aktualisiert' });
    } catch (err) {
        log('ERROR', `PUT /api/quotas/goal failed: ${err.message}`);
        res.status(500).json({ error: 'Fehler beim Aktualisieren des Ziels' });
    }
});

// PUT /api/quotas/:id/toggle – Toggle a user's quota completion status
router.put('/:id/toggle', requireModerator, (req, res) => {
    const { id } = req.params;
    const { has_paid } = req.body; // boolean

    try {
        const user = db.prepare('SELECT username FROM users WHERE id = ?').get(id);
        if (!user) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        const newValue = has_paid ? 1 : 0;
        db.prepare(`UPDATE users SET has_paid_quota = ?, updated_at = datetime('now','localtime') WHERE id = ?`).run(newValue, id);

        const actionUser = req.session.user;
        const statusText = has_paid ? 'als "erledigt" markiert' : 'als "offen" markiert';
        
        db.prepare('INSERT INTO admin_logs (admin_name, action, target_id, target_name, details) VALUES (?, ?, ?, ?, ?)')
            .run(actionUser.username, 'toggle_quota', id, user.username, `Abgabe für ${user.username} ${statusText}`);

        res.json({ success: true });
    } catch (err) {
        log('ERROR', `PUT /api/quotas/:id/toggle failed: ${err.message}`);
        res.status(500).json({ error: 'Fehler beim Ändern des Status' });
    }
});

// POST /api/quotas/reset – Reset all users' quota completion status
router.post('/reset', requireModerator, (req, res) => {
    try {
        db.prepare("UPDATE users SET has_paid_quota = 0, updated_at = datetime('now','localtime')").run();

        const actionUser = req.session.user;
        db.prepare('INSERT INTO admin_logs (admin_name, action, details) VALUES (?, ?, ?)')
            .run(actionUser.username, 'reset_quotas', 'Alle Abgaben wurden zurückgesetzt');
            
        sendSystemAlert(
            '🔄 Abgaben zurückgesetzt',
            `**${actionUser.username}** hat alle Pflichtabgaben für die neue Woche zurückgesetzt.`,
            0xe67e22
        );

        res.json({ success: true, message: 'Alle Abgaben wurden zurückgesetzt' });
    } catch (err) {
        log('ERROR', `POST /api/quotas/reset failed: ${err.message}`);
        res.status(500).json({ error: 'Fehler beim Zurücksetzen der Abgaben' });
    }
});

export default router;
