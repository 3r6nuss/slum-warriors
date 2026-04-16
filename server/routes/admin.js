import express from 'express';
export const router = express.Router();
import db from '../db.js';
import { getLogs } from '../logger.js';
import { requireAdmin } from './auth.js';
import { getConnectedCount } from '../websocket.js';

// GET /api/admin/logs – return log entries from ring buffer
router.get('/logs', requireAdmin, (req, res) => {
    const { limit, since, category } = req.query;
    const logs = getLogs({
        since,
        limit: limit ? parseInt(limit) : 200,
        category,
    });
    res.json(logs);
});

// GET /api/admin/ws-stats – return WS connection history
router.get('/ws-stats', requireAdmin, (req, res) => {
    const hours = parseInt(req.query.hours) || 24;

    try {
        const stats = db.prepare(`
            SELECT id, connected_clients, recorded_at
            FROM ws_connection_stats
            WHERE recorded_at >= datetime('now', 'localtime', ?)
            ORDER BY recorded_at ASC
        `).all(`-${hours} hours`);

        res.json({
            current: getConnectedCount(),
            history: stats,
        });
    } catch {
        res.status(500).json({ error: 'Failed to access ws-stats' });
    }
});

// GET /api/admin/audit/admin – return admin action logs
router.get('/audit/admin', requireAdmin, (req, res) => {
    try {
        const logs = db.prepare('SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 200').all();
        res.json(logs);
    } catch {
        res.status(500).json({ error: 'Failed to access admin audit logs' });
    }
});

// GET /api/admin/audit/auth – return authentication logs
router.get('/audit/auth', requireAdmin, (req, res) => {
    try {
        const logs = db.prepare('SELECT * FROM auth_logs ORDER BY created_at DESC LIMIT 200').all();
        res.json(logs);
    } catch {
        res.status(500).json({ error: 'Failed to access auth audit logs' });
    }
});

// GET /api/admin/settings - get all global settings
router.get('/settings', requireAdmin, (req, res) => {
    try {
        const settings = db.prepare('SELECT * FROM settings').all();
        // Convert array of {key, value} to an object
        const settingsObj = {};
        for (const s of settings) {
            settingsObj[s.key] = s.value;
        }
        res.json(settingsObj);
    } catch {
        res.status(500).json({ error: 'Failed to load settings' });
    }
});

// PUT /api/admin/settings - update a global setting
router.put('/settings', requireAdmin, (req, res) => {
    const { key, value } = req.body;
    if (!key || value === undefined) {
        return res.status(400).json({ error: 'Missing key or value' });
    }

    try {
        db.prepare(`
            INSERT INTO settings (key, value) 
            VALUES (?, ?) 
            ON CONFLICT(key) DO UPDATE SET value = ?
        `).run(key, value.toString(), value.toString());

        // Log the change
        const adminStr = req.user ? (req.user.display_name || req.user.username) : 'System';
        db.prepare(`
            INSERT INTO admin_logs (admin_id, admin_name, action, target_name, details)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.user ? req.user.id : null, adminStr, 'UPDATE_SETTING', key, `Changed to ${value}`);

        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// GET /api/admin/discord-roles – return synced Discord roles (for role mapping UI)
router.get('/discord-roles', requireAdmin, (req, res) => {
    try {
        const roles = db.prepare('SELECT role_id, name, color, position FROM discord_roles ORDER BY position DESC').all();
        res.json(roles);
    } catch {
        res.status(500).json({ error: 'Failed to load Discord roles' });
    }
});

// GET /api/admin/export/csv/:table - export a database table as CSV
router.get('/export/csv/:table', requireAdmin, (req, res) => {
    const { table } = req.params;
    
    // Whitelist allowed tables to prevent SQL injection or reading sensitive tables (like sqlite_master)
    const allowedTables = ['inventory', 'transactions', 'products', 'warehouses', 'users', 'adjustments', 'admin_logs', 'auth_logs', 'error_logs', 'kits', 'discord_members'];
    if (!allowedTables.includes(table)) {
        return res.status(400).json({ error: 'Ungültiger Tabellenname für Export' });
    }

    try {
        const rows = db.prepare(`SELECT * FROM ${table}`).all();
        
        if (rows.length === 0) {
             return res.send('Keine Daten vorhanden');
        }

        const escapeCSV = (val) => {
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headers = Object.keys(rows[0]);
        let csv = headers.map(escapeCSV).join(',') + '\n';
        
        for (const row of rows) {
            csv += headers.map(h => escapeCSV(row[h])).join(',') + '\n';
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="export_${table}_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send('\uFEFF' + csv); // Add BOM for Excel compatibility
    } catch (err) {
        res.status(500).json({ error: 'Export fehlgeschlagen: ' + err.message });
    }
});

export default router;
