import express from 'express';
export const router = express.Router();
import db from '../db.js';
import { broadcastInventory } from '../websocket.js';
import { sendSystemAlert } from '../lib/discord.js';

// POST /api/transactions – create check-in or check-out
router.post('/', (req, res) => {
    const { warehouse_id, product_id, person_name, type, quantity } = req.body;

    if (!warehouse_id || !product_id || !person_name || !type || !quantity) {
        return res.status(400).json({ error: 'Alle Felder sind erforderlich' });
    }
    if (!['checkin', 'checkout'].includes(type)) {
        return res.status(400).json({ error: 'Typ muss "checkin" oder "checkout" sein' });
    }
    if (quantity <= 0) {
        return res.status(400).json({ error: 'Menge muss größer als 0 sein' });
    }

    try {
        // Check current stock for checkout
        if (type === 'checkout') {
            const current = db.prepare(
                'SELECT quantity FROM inventory WHERE warehouse_id = ? AND product_id = ?'
            ).get(warehouse_id, product_id);

            if (!current || current.quantity < quantity) {
                return res.status(400).json({
                    error: `Nicht genügend Bestand. Verfügbar: ${current ? current.quantity : 0}`
                });
            }
        }

        const txn = db.transaction(() => {
            // Insert transaction
            const result = db.prepare(
                'INSERT INTO transactions (warehouse_id, product_id, person_name, type, quantity) VALUES (?, ?, ?, ?, ?)'
            ).run(warehouse_id, product_id, person_name, type, quantity);

            // Update inventory
            const delta = type === 'checkin' ? quantity : -quantity;
            db.prepare(`
        INSERT INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, ?)
        ON CONFLICT(warehouse_id, product_id) DO UPDATE SET quantity = quantity + ?
      `).run(warehouse_id, product_id, Math.max(0, delta), delta);

            return result;
        });

        const result = txn();
        broadcastInventory();

        // --- Logging / Alerts ---
        try {
            const product = db.prepare('SELECT name FROM products WHERE id = ?').get(product_id);
            const wh = db.prepare('SELECT name FROM warehouses WHERE id = ?').get(warehouse_id);
            const newStock = db.prepare('SELECT quantity FROM inventory WHERE warehouse_id = ? AND product_id = ?').get(warehouse_id, product_id);

            // Alert on large quantity
            if (quantity >= 50) {
                sendSystemAlert(
                    '⚠️ Große Transaktion',
                    `**${person_name}** hat eine ungewöhnlich große Menge bewegt:\n**Menge:** ${quantity}x ${product?.name}\n**Aktion:** ${type === 'checkin' ? 'Einlagern' : 'Auslagern'}\n**Lager:** ${wh?.name}`,
                    0xe67e22 // Orange
                );
            }

            // Alert on low stock (only on checkout)
            if (type === 'checkout' && newStock && newStock.quantity < 5) {
                sendSystemAlert(
                    '📉 Niedriger Bestand',
                    `Der Bestand von **${product?.name}** im **${wh?.name}** ist kritisch niedrig!\n**Aktueller Bestand:** ${newStock.quantity} Stück`,
                    0xe74c3c // Red
                );
            }
        } catch (alertErr) {
            console.error('Failed to send transaction alert:', alertErr);
        }

        res.status(201).json({
            id: result.lastInsertRowid,
            message: type === 'checkin' ? 'Eingelagert' : 'Ausgelagert'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/transactions – list all with optional filters
router.get('/', (req, res) => {
    const { person, warehouse, type, limit } = req.query;
    let query = `
    SELECT t.*, w.name as warehouse_name, p.name as product_name
    FROM transactions t
    JOIN warehouses w ON t.warehouse_id = w.id
    JOIN products p ON t.product_id = p.id
    WHERE 1=1
  `;
    const params = [];

    if (person) {
        query += ' AND t.person_name LIKE ?';
        params.push(`%${person}%`);
    }
    if (warehouse) {
        query += ' AND t.warehouse_id = ?';
        params.push(warehouse);
    }
    if (type) {
        query += ' AND t.type = ?';
        params.push(type);
    }

    query += ' ORDER BY t.created_at DESC';

    if (limit) {
        query += ' LIMIT ?';
        params.push(parseInt(limit));
    }

    const transactions = db.prepare(query).all(...params);
    res.json(transactions);
});

// GET /api/transactions/persons – list unique person names
router.get('/persons', (req, res) => {
    const persons = db.prepare(
        'SELECT DISTINCT person_name FROM transactions ORDER BY person_name'
    ).all();
    res.json(persons.map(p => p.person_name));
});

// GET /api/transactions/person/:name – per-person protocol
router.get('/person/:name', (req, res) => {
    const { name } = req.params;
    const transactions = db.prepare(`
    SELECT t.*, w.name as warehouse_name, p.name as product_name
    FROM transactions t
    JOIN warehouses w ON t.warehouse_id = w.id
    JOIN products p ON t.product_id = p.id
    WHERE t.person_name = ?
    ORDER BY t.created_at DESC
  `).all(name);
    res.json(transactions);
});

export default router;
