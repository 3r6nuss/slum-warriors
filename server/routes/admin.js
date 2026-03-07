const express = require('express');
const router = express.Router();
const db = require('../db');
const { getLogs } = require('../logger');
const { requireAdmin } = require('./auth');
const { getConnectedCount } = require('../websocket');

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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/audit/admin – return admin action logs
router.get('/audit/admin', requireAdmin, (req, res) => {
    try {
        const logs = db.prepare('SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 200').all();
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/admin/audit/auth – return authentication logs
router.get('/audit/auth', requireAdmin, (req, res) => {
    try {
        const logs = db.prepare('SELECT * FROM auth_logs ORDER BY created_at DESC LIMIT 200').all();
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
