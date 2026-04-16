import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'lagerverwaltung.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

import fs from 'fs';

// Create schema_migrations table to track what ran
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_name TEXT NOT NULL UNIQUE,
    run_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

// Simple Migration Runner
const migrationsDir = path.join(__dirname, 'migrations');
if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();
    for (const file of files) {
        const row = db.prepare('SELECT id FROM schema_migrations WHERE migration_name = ?').get(file);
        if (!row) {
            console.log(`[DB] Running migration: ${file}`);
            try {
                // To support ES modules, we dynamically import the migration using file:// URL on Windows
                const migrationUrl = new URL(`file:///${path.join(migrationsDir, file).replace(/\\/g, '/')}`).href;
                const migration = await import(migrationUrl);
                
                // Run in a transaction if possible, though schema changes sometimes cannot be transactioned easily in SQLite
                migration.default(db);
                
                db.prepare('INSERT INTO schema_migrations (migration_name) VALUES (?)').run(file);
                console.log(`[DB] Migration ${file} completed successfully.`);
            } catch (err) {
                console.error(`[DB] Migration ${file} failed:`, err);
                process.exit(1); // Stop server if a migration fails
            }
        }
    }
} else {
    console.warn(`[DB] Migrations directory not found at ${migrationsDir}`);
}

// Seed Settings
const webhookSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('webhook_enabled');
if (!webhookSetting) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('webhook_enabled', 'true');
}

const quotaSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('current_quota');
if (!quotaSetting) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('current_quota', 'Kein Abgabenziel definiert');
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
if (!warehouseNames.includes('Erweitertes Führungslager')) {
  insertWarehouse.run('Erweitertes Führungslager', 'normal');
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

export default db;
