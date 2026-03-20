import express from 'express';
import db from '../db.js';
import { broadcastInventory } from '../websocket.js';
import { sendSystemAlert } from '../lib/discord.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/bot/products?q=...  –  Product search (autocomplete)
// ---------------------------------------------------------------------------
router.get('/products', (req, res) => {
    const q = (req.query.q || '').trim();

    let products;
    if (q) {
        products = db.prepare(
            `SELECT id, name FROM products WHERE archived = 0 AND name LIKE ? ORDER BY name ASC`
        ).all(`%${q}%`);
    } else {
        products = db.prepare(
            `SELECT id, name FROM products WHERE archived = 0 ORDER BY name ASC`
        ).all();
    }

    res.json(products);
});

// ---------------------------------------------------------------------------
// GET /api/bot/warehouses  –  List all warehouses
// ---------------------------------------------------------------------------
router.get('/warehouses', (_req, res) => {
    const warehouses = db.prepare('SELECT id, name, type FROM warehouses ORDER BY name ASC').all();
    res.json(warehouses);
});

// ---------------------------------------------------------------------------
// GET /api/bot/inventory?warehouse_id=&product_id=  –  Query stock
// ---------------------------------------------------------------------------
router.get('/inventory', (req, res) => {
    const { warehouse_id, product_id } = req.query;

    let query = `
        SELECT
            i.warehouse_id,
            w.name  AS warehouse_name,
            i.product_id,
            p.name  AS product_name,
            i.quantity
        FROM inventory i
        JOIN warehouses w ON i.warehouse_id = w.id
        JOIN products   p ON i.product_id  = p.id
        WHERE p.archived = 0
    `;
    const params = [];

    if (warehouse_id) {
        query += ' AND i.warehouse_id = ?';
        params.push(Number(warehouse_id));
    }
    if (product_id) {
        query += ' AND i.product_id = ?';
        params.push(Number(product_id));
    }

    query += ' ORDER BY w.name ASC, p.name ASC';

    const rows = db.prepare(query).all(...params);
    res.json(rows);
});

// ---------------------------------------------------------------------------
// POST /api/bot/checkin   –  Store items
// POST /api/bot/checkout  –  Retrieve items
// ---------------------------------------------------------------------------
function handleTransaction(type) {
    return (req, res) => {
        const { warehouse_id, product_id, person_name, quantity } = req.body;

        // --- Validation ---
        if (!warehouse_id || !product_id || !person_name || !quantity) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['warehouse_id', 'product_id', 'person_name', 'quantity'],
            });
        }
        const qty = Number(quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
            return res.status(400).json({ error: 'quantity must be a positive number' });
        }

        // Check product exists
        const product = db.prepare('SELECT id, name FROM products WHERE id = ? AND archived = 0').get(product_id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Check warehouse exists
        const warehouse = db.prepare('SELECT id, name FROM warehouses WHERE id = ?').get(warehouse_id);
        if (!warehouse) {
            return res.status(404).json({ error: 'Warehouse not found' });
        }

        // For checkout: verify stock
        if (type === 'checkout') {
            const current = db.prepare(
                'SELECT quantity FROM inventory WHERE warehouse_id = ? AND product_id = ?'
            ).get(warehouse_id, product_id);

            if (!current || current.quantity < qty) {
                return res.status(400).json({
                    error: `Insufficient stock. Available: ${current ? current.quantity : 0}`,
                });
            }
        }

        try {
            const txn = db.transaction(() => {
                const result = db.prepare(
                    'INSERT INTO transactions (warehouse_id, product_id, person_name, type, quantity) VALUES (?, ?, ?, ?, ?)'
                ).run(warehouse_id, product_id, person_name, type, qty);

                const delta = type === 'checkin' ? qty : -qty;
                db.prepare(`
                    INSERT INTO inventory (warehouse_id, product_id, quantity)
                    VALUES (?, ?, ?)
                    ON CONFLICT(warehouse_id, product_id) DO UPDATE SET quantity = quantity + ?
                `).run(warehouse_id, product_id, Math.max(0, delta), delta);

                return result;
            });

            const result = txn();
            broadcastInventory();

            // --- Alerts (same logic as transactions.js) ---
            try {
                const newStock = db.prepare(
                    'SELECT quantity FROM inventory WHERE warehouse_id = ? AND product_id = ?'
                ).get(warehouse_id, product_id);

                if (qty >= 50) {
                    sendSystemAlert(
                        '⚠️ Große Transaktion (Bot)',
                        `**${person_name}** hat via Bot eine große Menge bewegt:\n**Menge:** ${qty}x ${product.name}\n**Aktion:** ${type === 'checkin' ? 'Einlagern' : 'Auslagern'}\n**Lager:** ${warehouse.name}`,
                        0xe67e22
                    );
                }

                if (type === 'checkout' && newStock && newStock.quantity < 5) {
                    sendSystemAlert(
                        '📉 Niedriger Bestand',
                        `Der Bestand von **${product.name}** im **${warehouse.name}** ist kritisch niedrig!\n**Aktueller Bestand:** ${newStock.quantity} Stück`,
                        0xe74c3c
                    );
                }
            } catch (alertErr) {
                console.error('[Bot API] Alert error:', alertErr);
            }

            // Fetch updated stock for response
            const updatedStock = db.prepare(
                'SELECT quantity FROM inventory WHERE warehouse_id = ? AND product_id = ?'
            ).get(warehouse_id, product_id);

            res.status(201).json({
                success: true,
                transaction_id: Number(result.lastInsertRowid),
                type,
                product: product.name,
                warehouse: warehouse.name,
                quantity: qty,
                new_stock: updatedStock ? updatedStock.quantity : 0,
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
}

router.post('/checkin', handleTransaction('checkin'));
router.post('/checkout', handleTransaction('checkout'));

export default router;
