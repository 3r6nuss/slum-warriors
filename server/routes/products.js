import express from 'express';
export const router = express.Router();
import db from '../db.js';

// GET /api/products – list all products
router.get('/', (req, res) => {
    const products = db.prepare('SELECT * FROM products WHERE archived = 0 ORDER BY sort_order ASC, name ASC').all();
    res.json(products);
});

// POST /api/products – add new product
router.post('/', (req, res) => {
    const { name, warehouseIds, is_stackable } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Produktname ist erforderlich' });
    }

    try {
        const stackable = is_stackable === undefined ? 1 : (is_stackable ? 1 : 0);
        const result = db.prepare('INSERT INTO products (name, is_stackable) VALUES (?, ?)').run(name.trim(), stackable);
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
    const { name, is_stackable } = req.body;

    // Allow updating just stackable without name
    if (is_stackable !== undefined && !name) {
        try {
            db.prepare('UPDATE products SET is_stackable = ? WHERE id = ?').run(is_stackable ? 1 : 0, id);
            return res.json({ success: true });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Produktname ist erforderlich' });
    }

    try {
        const stackable = is_stackable === undefined ? undefined : (is_stackable ? 1 : 0);
        if (stackable !== undefined) {
            db.prepare('UPDATE products SET name = ?, is_stackable = ? WHERE id = ?').run(name.trim(), stackable, id);
        } else {
            db.prepare('UPDATE products SET name = ? WHERE id = ?').run(name.trim(), id);
        }
        res.json({ success: true, name: name.trim() });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Ein Produkt mit diesem Namen existiert bereits' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/products/:id/warehouses - update warehouse assignments
router.put('/:id/warehouses', (req, res) => {
    const { id } = req.params;
    const { warehouseIds } = req.body;

    if (!Array.isArray(warehouseIds)) {
        return res.status(400).json({ error: 'warehouseIds must be an array' });
    }

    try {
        const transaction = db.transaction(() => {
            // Get current assignments
            const currentInventory = db.prepare('SELECT warehouse_id FROM inventory WHERE product_id = ?').all(id);
            const currentIds = currentInventory.map(i => i.warehouse_id);

            // Determine what to add and what to remove
            const toAdd = warehouseIds.filter(wid => !currentIds.includes(wid));
            const toRemove = currentIds.filter(wid => !warehouseIds.includes(wid));

            // Remove unselected warehouses
            if (toRemove.length > 0) {
                const placeholders = toRemove.map(() => '?').join(',');
                db.prepare(`DELETE FROM inventory WHERE product_id = ? AND warehouse_id IN (${placeholders})`).run(id, ...toRemove);
            }

            // Add new warehouses
            if (toAdd.length > 0) {
                const insertInv = db.prepare('INSERT INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, 0)');
                for (const wid of toAdd) {
                    insertInv.run(wid, id);
                }
            }
        });

        transaction();
        res.json({ success: true });
    } catch (err) {
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

// PUT /api/products/bulk/warehouses - batch assign warehouses to all products
router.put('/bulk/warehouses', (req, res) => {
    const { warehouseIds } = req.body;
    if (!Array.isArray(warehouseIds)) {
        return res.status(400).json({ error: 'warehouseIds must be an array' });
    }

    try {
        const products = db.prepare('SELECT id FROM products').all();
        const insertInv = db.prepare('INSERT OR IGNORE INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, 0)');

        const transaction = db.transaction(() => {
            for (const prod of products) {
                for (const wid of warehouseIds) {
                    insertInv.run(wid, prod.id);
                }
            }
        });

        transaction();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
