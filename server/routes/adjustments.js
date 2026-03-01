const express = require('express');
const router = express.Router();
const db = require('../db');
const { broadcastInventory } = require('../websocket');

// POST /api/adjustments – manual stock adjustment
router.post('/', (req, res) => {
    const { warehouse_id, product_id, new_quantity, person_name, reason } = req.body;

    if (!warehouse_id || !product_id || new_quantity === undefined || !person_name) {
        return res.status(400).json({ error: 'Alle Felder sind erforderlich' });
    }
    if (new_quantity < 0) {
        return res.status(400).json({ error: 'Menge darf nicht negativ sein' });
    }

    try {
        const txn = db.transaction(() => {
            // Get current quantity
            const current = db.prepare(
                'SELECT quantity FROM inventory WHERE warehouse_id = ? AND product_id = ?'
            ).get(warehouse_id, product_id);

            const oldQuantity = current ? current.quantity : 0;
            const difference = new_quantity - oldQuantity;

            // Log the adjustment
            db.prepare(
                'INSERT INTO adjustments (warehouse_id, product_id, person_name, old_quantity, new_quantity, difference, reason) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).run(warehouse_id, product_id, person_name, oldQuantity, new_quantity, difference, reason || null);

            // Update inventory
            db.prepare(`
        INSERT INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, ?)
        ON CONFLICT(warehouse_id, product_id) DO UPDATE SET quantity = ?
      `).run(warehouse_id, product_id, new_quantity, new_quantity);

            return { oldQuantity, newQuantity: new_quantity, difference };
        });

        const result = txn();
        broadcastInventory();

        res.status(201).json({
            message: 'Bestand angepasst',
            ...result
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/adjustments – adjustment history
router.get('/', (req, res) => {
    const { warehouse, product, limit } = req.query;
    let query = `
    SELECT a.*, w.name as warehouse_name, p.name as product_name
    FROM adjustments a
    JOIN warehouses w ON a.warehouse_id = w.id
    JOIN products p ON a.product_id = p.id
    WHERE 1=1
  `;
    const params = [];

    if (warehouse) {
        query += ' AND a.warehouse_id = ?';
        params.push(warehouse);
    }
    if (product) {
        query += ' AND a.product_id = ?';
        params.push(product);
    }

    query += ' ORDER BY a.created_at DESC';

    if (limit) {
        query += ' LIMIT ?';
        params.push(parseInt(limit));
    }

    const adjustments = db.prepare(query).all(...params);
    res.json(adjustments);
});

module.exports = router;
