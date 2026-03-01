const { WebSocketServer } = require('ws');
const db = require('./db');

let wss = null;

function initWebSocket(server) {
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        console.log('[WS] Client connected');

        // Send current inventory immediately on connect
        const inventory = getFullInventory();
        ws.send(JSON.stringify({ type: 'inventory_update', data: inventory }));

        ws.on('close', () => {
            console.log('[WS] Client disconnected');
        });
    });

    console.log('[WS] WebSocket server initialized');
}

function getFullInventory() {
    return db.prepare(`
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
    ORDER BY w.id, p.name
  `).all();
}

function broadcastInventory() {
    if (!wss) return;

    const inventory = getFullInventory();
    const message = JSON.stringify({ type: 'inventory_update', data: inventory });

    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
        }
    });
}

module.exports = { initWebSocket, broadcastInventory, getFullInventory };
