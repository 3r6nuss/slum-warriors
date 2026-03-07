const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/products – list all products
router.get('/', (req, res) => {
    const products = db.prepare('SELECT * FROM products WHERE archived = 0 ORDER BY sort_order ASC, name ASC').all();
    res.json(products);
});

// POST /api/products – add new product
router.post('/', (req, res) => {
    const { name, warehouseIds } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Produktname ist erforderlich' });
    }

    try {
        const result = db.prepare('INSERT INTO products (name) VALUES (?)').run(name.trim());
        const productId = result.lastInsertRowid;

        // Initialize inventory for new product only in selected warehouses
        if (warehouseIds && Array.isArray(warehouseIds)) {
            const insertInventory = db.prepare('INSERT OR IGNORE INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, 0)');
            for (const whId of warehouseIds) {
                insertInventory.run(whId, productId);
            }
        } else {
            // Fallback: all warehouses if nothing specified (for backwards compatibility if needed)
            const warehouses = db.prepare('SELECT id FROM warehouses').all();
            const insertInventory = db.prepare('INSERT OR IGNORE INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, 0)');
            for (const wh of warehouses) {
                insertInventory.run(wh.id, productId);
            }
        }

        res.status(201).json({ id: productId, name: name.trim() });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Produkt existiert bereits' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/products/:id - rename product
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Produktname ist erforderlich' });
    }

    try {
        db.prepare('UPDATE products SET name = ? WHERE id = ?').run(name.trim(), id);
        res.json({ success: true, name: name.trim() });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Ein Produkt mit diesem Namen existiert bereits' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/products/reorder - batch update sort_order
router.put('/reorder', (req, res) => {
    const { order } = req.body; // array of { id, sort_order }

    if (!Array.isArray(order)) {
        return res.status(400).json({ error: 'Ungültiges Format für die Sortierung' });
    }

    try {
        const updateOrder = db.prepare('UPDATE products SET sort_order = ? WHERE id = ?');

        // Use a transaction for atomic batch update
        const reorderTransaction = db.transaction((items) => {
            for (const item of items) {
                if (item.id && typeof item.sort_order === 'number') {
                    updateOrder.run(item.sort_order, item.id);
                }
            }
        });

        reorderTransaction(order);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/products/:id
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    try {
        db.prepare('DELETE FROM inventory WHERE product_id = ?').run(id);
        db.prepare('DELETE FROM products WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        if (err.message.includes('FOREIGN KEY')) {
            // Soft delete: set archived = 1 and append timestamp to name to free up the unique name
            const stamp = Date.now();
            db.prepare('UPDATE products SET archived = 1, name = name || ? WHERE id = ?').run(` (Archiviert ${stamp})`, id);
            return res.json({ success: true, archived: true });
        }
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
