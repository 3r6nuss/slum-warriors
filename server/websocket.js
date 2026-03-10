const { WebSocketServer } = require('ws');
const db = require('./db');
const { log } = require('./logger');

let wss = null;
let statsInterval = null;

function initWebSocket(server) {
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        log('WS', `Client connected (total: ${wss.clients.size})`);

        // Send current inventory immediately on connect
        const inventory = getFullInventory();
        ws.send(JSON.stringify({ type: 'inventory_update', data: inventory }));

        ws.on('close', () => {
            log('WS', `Client disconnected (total: ${wss.clients.size})`);
        });
    });

    // Record WS connection count every 5 minutes
    statsInterval = setInterval(() => {
        const count = getConnectedCount();
        try {
            db.prepare(
                'INSERT INTO ws_connection_stats (connected_clients) VALUES (?)'
            ).run(count);
            log('WS', `Stats snapshot: ${count} connected client(s)`);
        } catch (err) {
            log('WS', `Failed to record stats: ${err.message}`, 'ERROR');
        }
    }, 5 * 60 * 1000); // 5 minutes

    // Record an initial snapshot on startup
    try {
        db.prepare(
            'INSERT INTO ws_connection_stats (connected_clients) VALUES (?)'
        ).run(0);
    } catch (_) { /* ignore */ }

    log('WS', 'WebSocket server initialized');
}

function getConnectedCount() {
    return wss ? wss.clients.size : 0;
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
      p.is_stackable,
      i.quantity
    FROM inventory i
    JOIN warehouses w ON i.warehouse_id = w.id
    JOIN products p ON i.product_id = p.id
    ORDER BY w.id, i.sort_order ASC, p.name ASC
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

module.exports = { initWebSocket, broadcastInventory, getFullInventory, getConnectedCount };
