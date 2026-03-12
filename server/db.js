const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'lagerverwaltung.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK(type IN ('leadership', 'normal'))
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 0,
    UNIQUE(warehouse_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    person_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('checkin', 'checkout')),
    quantity INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    person_name TEXT NOT NULL,
    old_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    difference INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS warehouse_edits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    person_name TEXT NOT NULL,
    reason TEXT,
    state_before TEXT NOT NULL,
    state_after TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS ws_connection_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connected_clients INTEGER NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    avatar TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS admin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    admin_name TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id INTEGER,
    target_name TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS auth_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('login', 'logout', 'register')),
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL DEFAULT 'error',
    message TEXT NOT NULL,
    stack TEXT,
    context TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Migration: Add 'approved' column to users table if missing
const userColumns = db.prepare("PRAGMA table_info(users)").all();
if (!userColumns.find(c => c.name === 'approved')) {
  db.exec(`ALTER TABLE users ADD COLUMN approved INTEGER NOT NULL DEFAULT 0`);
  // Auto-approve all existing users so they aren't locked out
  db.exec(`UPDATE users SET approved = 1`);
}

// Migration: Add 'display_name' column to users table if missing
if (!userColumns.find(c => c.name === 'display_name')) {
  db.exec(`ALTER TABLE users ADD COLUMN display_name TEXT DEFAULT NULL`);
}

// Migration: Add 'archived' column to products table if missing
const productCols = db.prepare("PRAGMA table_info(products)").all();
if (!productCols.find(c => c.name === 'archived')) {
  db.exec(`ALTER TABLE products ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`);
}

// Migration: Add 'sort_order' column to products table if missing
if (!productCols.find(c => c.name === 'sort_order')) {
  db.exec(`ALTER TABLE products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
}

// Migration: Add 'is_stackable' column to products table if missing
if (!productCols.find(c => c.name === 'is_stackable')) {
  db.exec(`ALTER TABLE products ADD COLUMN is_stackable INTEGER NOT NULL DEFAULT 1`);
}

// Migration: Add 'sort_order' column to inventory table if missing
const inventoryCols = db.prepare("PRAGMA table_info(inventory)").all();
if (!inventoryCols.find(c => c.name === 'sort_order')) {
  db.exec(`ALTER TABLE inventory ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
}

// Seed Settings
const webhookSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('webhook_enabled');
if (!webhookSetting) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('webhook_enabled', 'true');
}

// Seed warehouses if they don't exist
const warehouseNames = db.prepare('SELECT name FROM warehouses').all().map(w => w.name);
const insertWarehouse = db.prepare('INSERT INTO warehouses (name, type) VALUES (?, ?)');

if (!warehouseNames.includes('Führungslager')) {
  insertWarehouse.run('Führungslager', 'leadership');
}
if (!warehouseNames.includes('Normales Lager')) {
  insertWarehouse.run('Normales Lager', 'normal');
}
if (!warehouseNames.includes('Waffenlager')) {
  insertWarehouse.run('Waffenlager', 'normal');
}
if (!warehouseNames.includes('Führungswaffenlager')) {
  insertWarehouse.run('Führungswaffenlager', 'leadership');
}

// Ensure all products have inventory records in all warehouses
const allWarehouses = db.prepare('SELECT id FROM warehouses').all();
const allProducts = db.prepare('SELECT id FROM products').all();
const insertMissingInventory = db.prepare('INSERT OR IGNORE INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, 0)');

for (const wh of allWarehouses) {
  for (const prod of allProducts) {
    insertMissingInventory.run(wh.id, prod.id);
  }
}

// Seed default products if not exist
const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
if (productCount.count === 0) {
  const insertProduct = db.prepare('INSERT INTO products (name) VALUES (?)');
  const defaultProducts = [
    'Kokain', 'Meth', 'Weed', 'Waffen', 'Munition',
    'Schutzwesten', 'Lockpicks', 'Handys', 'Bargeld', 'Schmuck'
  ];
  for (const product of defaultProducts) {
    insertProduct.run(product);
  }

  // Initialize inventory for all products in all warehouses
  const warehouses = db.prepare('SELECT id FROM warehouses').all();
  const products = db.prepare('SELECT id FROM products').all();
  const insertInventory = db.prepare('INSERT OR IGNORE INTO inventory (warehouse_id, product_id, quantity) VALUES (?, ?, 0)');

  for (const wh of warehouses) {
    for (const prod of products) {
      insertInventory.run(wh.id, prod.id);
    }
  }
}

module.exports = db;
