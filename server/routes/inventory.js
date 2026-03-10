const express = require('express');
const router = express.Router();
const db = require('../db');
const { getFullInventory } = require('../websocket');

// GET /api/inventory – full inventory
router.get('/', (req, res) => {
  const inventory = getFullInventory();
  res.json(inventory);
});

// GET /api/inventory/:warehouseId – per warehouse
router.get('/:warehouseId', (req, res) => {
  const { warehouseId } = req.params;
  const inventory = db.prepare(`
    SELECT 
      i.id,
      i.warehouse_id,
      w.name as warehouse_name,
      w.type as warehouse_type,
      i.product_id,
      p.name as product_name,
      p.is_stackable,
      i.quantity
    FROM inventory i
    JOIN warehouses w ON i.warehouse_id = w.id
    JOIN products p ON i.product_id = p.id
    WHERE i.warehouse_id = ?
    ORDER BY i.sort_order ASC, p.name ASC
  `).all(warehouseId);
  res.json(inventory);
});

// PUT /api/inventory/:warehouseId/reorder – update inventory sort_order for a specific warehouse
router.put('/:warehouseId/reorder', (req, res) => {
  const { warehouseId } = req.params;
  const { order } = req.body; // array of { product_id, sort_order }

  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'Ungültiges Format für die Sortierung' });
  }

  try {
    const updateOrder = db.prepare('UPDATE inventory SET sort_order = ? WHERE product_id = ? AND warehouse_id = ?');

    // Use a transaction for atomic batch update
    const reorderTransaction = db.transaction((items) => {
      for (const item of items) {
        if (item.product_id && typeof item.sort_order === 'number') {
          updateOrder.run(item.sort_order, item.product_id, warehouseId);
        }
      }
    });

    reorderTransaction(order);
    res.json({ success: true });

    // Broadcast the new, full inventory with updated order
    const { broadcastInventory } = require('../websocket');
    broadcastInventory();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/warehouses – list warehouses
router.get('/warehouses/list', (req, res) => {
  const warehouses = db.prepare('SELECT * FROM warehouses').all();
  res.json(warehouses);
});

module.exports = router;
