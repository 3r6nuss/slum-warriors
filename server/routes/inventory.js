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
      i.quantity
    FROM inventory i
    JOIN warehouses w ON i.warehouse_id = w.id
    JOIN products p ON i.product_id = p.id
    WHERE i.warehouse_id = ?
    ORDER BY p.name
  `).all(warehouseId);
    res.json(inventory);
});

// GET /api/warehouses – list warehouses
router.get('/warehouses/list', (req, res) => {
    const warehouses = db.prepare('SELECT * FROM warehouses').all();
    res.json(warehouses);
});

module.exports = router;
