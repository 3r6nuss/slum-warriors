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

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    avatar TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

// Seed warehouses if not exist
const warehouseCount = db.prepare('SELECT COUNT(*) as count FROM warehouses').get();
if (warehouseCount.count === 0) {
  const insertWarehouse = db.prepare('INSERT INTO warehouses (name, type) VALUES (?, ?)');
  insertWarehouse.run('Führungslager', 'leadership');
  insertWarehouse.run('Normales Lager', 'normal');
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
