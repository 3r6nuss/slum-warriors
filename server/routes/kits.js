import express from 'express';
export const router = express.Router();
import db from '../db.js';
import { broadcastInventory } from '../websocket.js';

// Helper: load a kit with its items and product names
function getKitWithItems(kitId) {
    const kit = db.prepare('SELECT * FROM kits WHERE id = ?').get(kitId);
    if (!kit) return null;

    kit.items = db.prepare(`
        SELECT ki.*, p.name as product_name
        FROM kit_items ki
        JOIN products p ON ki.product_id = p.id
        WHERE ki.kit_id = ?
        ORDER BY p.name ASC
    `).all(kitId);

    return kit;
}

// GET /api/kits – list all kits with their items
router.get('/', (req, res) => {
    try {
        const kits = db.prepare('SELECT * FROM kits ORDER BY name ASC').all();

        const loadItems = db.prepare(`
            SELECT ki.*, p.name as product_name
            FROM kit_items ki
            JOIN products p ON ki.product_id = p.id
            WHERE ki.kit_id = ?
            ORDER BY p.name ASC
        `);

        for (const kit of kits) {
            kit.items = loadItems.all(kit.id);
        }

        res.json(kits);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/kits/:id – single kit with items
router.get('/:id', (req, res) => {
    try {
        const kit = getKitWithItems(req.params.id);
        if (!kit) return res.status(404).json({ error: 'Kit nicht gefunden' });
        res.json(kit);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/kits – create a new kit
router.post('/', (req, res) => {
    const { name, description, items } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Kit-Name ist erforderlich' });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Mindestens ein Produkt ist erforderlich' });
    }

    // Validate items
    for (const item of items) {
        if (!item.product_id || !item.quantity || item.quantity < 1) {
            return res.status(400).json({ error: 'Ungültiges Item: product_id und quantity (≥1) erforderlich' });
        }
    }

    try {
        const result = db.transaction(() => {
            const kitResult = db.prepare(
                'INSERT INTO kits (name, description) VALUES (?, ?)'
            ).run(name.trim(), (description || '').trim());

            const kitId = kitResult.lastInsertRowid;

            const insertItem = db.prepare(
                'INSERT INTO kit_items (kit_id, product_id, quantity) VALUES (?, ?, ?)'
            );

            for (const item of items) {
                insertItem.run(kitId, item.product_id, item.quantity);
            }

            return kitId;
        })();

        const kit = getKitWithItems(result);
        res.status(201).json(kit);
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Ein Kit mit diesem Namen existiert bereits' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/kits/:id – update kit
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { name, description, items } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Kit-Name ist erforderlich' });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Mindestens ein Produkt ist erforderlich' });
    }

    for (const item of items) {
        if (!item.product_id || !item.quantity || item.quantity < 1) {
            return res.status(400).json({ error: 'Ungültiges Item: product_id und quantity (≥1) erforderlich' });
        }
    }

    try {
        const existing = db.prepare('SELECT id FROM kits WHERE id = ?').get(id);
        if (!existing) return res.status(404).json({ error: 'Kit nicht gefunden' });

        db.transaction(() => {
            db.prepare('UPDATE kits SET name = ?, description = ? WHERE id = ?')
                .run(name.trim(), (description || '').trim(), id);

            // Replace all items
            db.prepare('DELETE FROM kit_items WHERE kit_id = ?').run(id);

            const insertItem = db.prepare(
                'INSERT INTO kit_items (kit_id, product_id, quantity) VALUES (?, ?, ?)'
            );
            for (const item of items) {
                insertItem.run(id, item.product_id, item.quantity);
            }
        })();

        const kit = getKitWithItems(id);
        res.json(kit);
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Ein Kit mit diesem Namen existiert bereits' });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/kits/:id
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    try {
        const existing = db.prepare('SELECT id FROM kits WHERE id = ?').get(id);
        if (!existing) return res.status(404).json({ error: 'Kit nicht gefunden' });

        db.prepare('DELETE FROM kits WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/kits/:id/craft – craft a kit (batch checkout)
router.post('/:id/craft', (req, res) => {
    const { id } = req.params;
    const { warehouse_id, person_name } = req.body;

    if (!warehouse_id || !person_name || !person_name.trim()) {
        return res.status(400).json({ error: 'warehouse_id und person_name sind erforderlich' });
    }

    try {
        const kit = getKitWithItems(id);
        if (!kit) return res.status(404).json({ error: 'Kit nicht gefunden' });
        if (kit.items.length === 0) return res.status(400).json({ error: 'Kit hat keine Items' });

        // Check stock for all items
        const shortages = [];
        for (const item of kit.items) {
            const inv = db.prepare(
                'SELECT quantity FROM inventory WHERE warehouse_id = ? AND product_id = ?'
            ).get(warehouse_id, item.product_id);

            const available = inv ? inv.quantity : 0;
            if (available < item.quantity) {
                shortages.push({
                    product_name: item.product_name,
                    required: item.quantity,
                    available,
                });
            }
        }

        if (shortages.length > 0) {
            const details = shortages.map(s =>
                `${s.product_name}: benötigt ${s.required}, verfügbar ${s.available}`
            ).join('; ');
            return res.status(400).json({
                error: `Nicht genügend Bestand: ${details}`,
                shortages,
            });
        }

        // Perform batch checkout in a transaction
        db.transaction(() => {
            const insertTx = db.prepare(
                'INSERT INTO transactions (warehouse_id, product_id, person_name, type, quantity) VALUES (?, ?, ?, ?, ?)'
            );
            const updateInv = db.prepare(
                'UPDATE inventory SET quantity = quantity - ? WHERE warehouse_id = ? AND product_id = ?'
            );

            for (const item of kit.items) {
                insertTx.run(warehouse_id, item.product_id, person_name.trim(), 'checkout', item.quantity);
                updateInv.run(item.quantity, warehouse_id, item.product_id);
            }
        })();

        broadcastInventory();

        res.status(201).json({
            success: true,
            message: `Kit "${kit.name}" wurde gecraftet`,
            kit_name: kit.name,
            items_used: kit.items.map(i => ({ product_name: i.product_name, quantity: i.quantity })),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
