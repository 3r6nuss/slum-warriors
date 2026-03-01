const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/products – list all products
router.get('/', (req, res) => {
    const products = db.prepare('SELECT * FROM products ORDER BY name').all();
    res.json(products);
});

// POST /api/products – add new product
router.post('/', (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Produktname ist erforderlich' });
    }

    try {
        const result = db.prepare('INSERT INTO products (name) VALUES (?)').run(name.trim());

        // Initialize inventory for new product in all warehouses
        const warehouses = db.prepare('SELECT id FROM warehouses').all();
        const insertInventory = db.prepare('INSERT OR IGNORE INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, 0)');
        for (const wh of warehouses) {
            insertInventory.run(wh.id, result.lastInsertRowid);
        }

        res.status(201).json({ id: result.lastInsertRowid, name: name.trim() });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Produkt existiert bereits' });
        }
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
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
