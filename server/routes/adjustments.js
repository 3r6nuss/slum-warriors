const express = require('express');
const router = express.Router();
const db = require('../db');
const { broadcastInventory } = require('../websocket');
const { sendSystemAlert } = require('../lib/discord');

// POST /api/adjustments/batch - bulk inventory update logging entire warehouse state
router.post('/batch', (req, res) => {
    const { warehouse_id, person_name, reason, changes } = req.body;

    if (!warehouse_id || !person_name || !changes || !Array.isArray(changes) || changes.length === 0) {
        return res.status(400).json({ error: 'Ungültige Anfrage oder keine Änderungen' });
    }

    try {
        const txn = db.transaction(() => {
            // 1. Get current state of entire warehouse
            const currentStateRows = db.prepare(`
                SELECT i.product_id, p.name, i.quantity 
                FROM inventory i
                JOIN products p ON i.product_id = p.id
                WHERE i.warehouse_id = ?
            `).all(warehouse_id);

            const stateBefore = {};
            currentStateRows.forEach(row => {
                stateBefore[row.product_id] = { name: row.name, quantity: row.quantity };
            });

            let actualChanges = 0;

            // 2. Apply all changes
            for (const change of changes) {
                const { product_id, new_quantity } = change;
                if (new_quantity < 0) throw new Error('Menge darf nicht negativ sein');

                const currentQty = stateBefore[product_id] ? stateBefore[product_id].quantity : 0;
                const difference = new_quantity - currentQty;

                if (difference !== 0) {
                    actualChanges++;
                    // Log individual adjustment (backward compatibility)
                    db.prepare(
                        'INSERT INTO adjustments (warehouse_id, product_id, person_name, old_quantity, new_quantity, difference, reason) VALUES (?, ?, ?, ?, ?, ?, ?)'
                    ).run(warehouse_id, product_id, person_name, currentQty, new_quantity, difference, reason || null);

                    // Update inventory
                    db.prepare(`
                        INSERT INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, ?)
                        ON CONFLICT(warehouse_id, product_id) DO UPDATE SET quantity = ?
                    `).run(warehouse_id, product_id, new_quantity, new_quantity);
                }
            }

            if (actualChanges === 0) {
                return 0; // No changes needed
            }

            // 3. Get new state of entire warehouse
            const newStateRows = db.prepare(`
                SELECT i.product_id, p.name, i.quantity 
                FROM inventory i
                JOIN products p ON i.product_id = p.id
                WHERE i.warehouse_id = ?
            `).all(warehouse_id);

            const stateAfter = {};
            newStateRows.forEach(row => {
                stateAfter[row.product_id] = { name: row.name, quantity: row.quantity };
            });

            // 4. Record the batch edit with JSON snapshots
            db.prepare(
                'INSERT INTO warehouse_edits (warehouse_id, person_name, reason, state_before, state_after) VALUES (?, ?, ?, ?, ?)'
            ).run(warehouse_id, person_name, reason || null, JSON.stringify(stateBefore), JSON.stringify(stateAfter));

            return actualChanges;
        });

        const updatedCount = txn();

        if (updatedCount > 0) {
            broadcastInventory();

            // --- Discord Alert ---
            try {
                const wh = db.prepare('SELECT name FROM warehouses WHERE id = ?').get(warehouse_id);
                sendSystemAlert(
                    '📝 Lagerbestand manuell bearbeitet',
                    `**${person_name}** hat **${updatedCount}** Produkte im **${wh?.name}** manuell verändert.\n**Grund:** ${reason || 'Kein Grund angegeben'}\n\nEine genaue Liste der Änderungen ist im Admin-Bereich einsehbar.`,
                    0x3498db // Blue
                );
            } catch (alertErr) {
                console.error('Failed to send batch edit alert:', alertErr);
            }
        }

        res.status(201).json({ message: `${updatedCount} Produkte aktualisiert.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/adjustments/edits - get warehouse edit history
router.get('/edits', (req, res) => {
    const { warehouse, limit } = req.query;
    let query = `
        SELECT e.*, w.name as warehouse_name 
        FROM warehouse_edits e
        JOIN warehouses w ON e.warehouse_id = w.id
        WHERE 1=1
    `;
    const params = [];

    if (warehouse) {
        query += ' AND e.warehouse_id = ?';
        params.push(warehouse);
    }

    query += ' ORDER BY e.created_at DESC';

    if (limit) {
        query += ' LIMIT ?';
        params.push(parseInt(limit));
    }

    try {
        const edits = db.prepare(query).all(...params);
        res.json(edits.map(e => ({
            ...e,
            state_before: JSON.parse(e.state_before),
            state_after: JSON.parse(e.state_after)
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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

        // --- Discord Alert ---
        try {
            if (Math.abs(result.difference) >= 50) {
                const product = db.prepare('SELECT name FROM products WHERE id = ?').get(product_id);
                const wh = db.prepare('SELECT name FROM warehouses WHERE id = ?').get(warehouse_id);
                sendSystemAlert(
                    '⚠️ Große Bestandsanpassung',
                    `**${person_name}** hat den Bestand von **${product?.name}** im **${wh?.name}** drastisch geändert:\n**Von:** ${result.oldQuantity} **Auf:** ${new_quantity} (Differenz: ${result.difference > 0 ? '+' : ''}${result.difference})\n**Grund:** ${reason || 'Keine Angabe'}`,
                    0xe67e22 // Orange
                );
            }
        } catch (alertErr) {
            console.error('Failed to send adjustment alert:', alertErr);
        }

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
