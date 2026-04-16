export default function up(db) {
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

    CREATE TABLE IF NOT EXISTS kits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS kit_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kit_id INTEGER NOT NULL REFERENCES kits(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      UNIQUE(kit_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS discord_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      display_name TEXT,
      avatar TEXT,
      discord_roles TEXT DEFAULT '[]',
      custom_name TEXT,
      system_role TEXT,
      joined_at TEXT,
      last_synced TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS discord_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      color INTEGER DEFAULT 0,
      position INTEGER DEFAULT 0,
      last_synced TEXT NOT NULL DEFAULT (datetime('now','localtime'))
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

  // Migration: Add login_token columns for backup auth if missing
  if (!userColumns.find(c => c.name === 'login_token')) {
    db.exec(`ALTER TABLE users ADD COLUMN login_token TEXT`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_token ON users (login_token)`);
    db.exec(`ALTER TABLE users ADD COLUMN login_token_expires_at TEXT`);
  }

  // Migration: Add 'has_paid_quota' column to users table if missing
  if (!userColumns.find(c => c.name === 'has_paid_quota')) {
    db.exec(`ALTER TABLE users ADD COLUMN has_paid_quota INTEGER NOT NULL DEFAULT 0`);
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

  // Migration: Add 'green_threshold' column to products table if missing
  if (!productCols.find(c => c.name === 'green_threshold')) {
    db.exec(`ALTER TABLE products ADD COLUMN green_threshold INTEGER NOT NULL DEFAULT 10`);
  }

  // Migration: Add 'yellow_threshold' column to products table if missing
  if (!productCols.find(c => c.name === 'yellow_threshold')) {
    db.exec(`ALTER TABLE products ADD COLUMN yellow_threshold INTEGER NOT NULL DEFAULT 1`);
  }

  // Migration: Add 'sort_order' column to inventory table if missing
  const inventoryCols = db.prepare("PRAGMA table_info(inventory)").all();
  if (!inventoryCols.find(c => c.name === 'sort_order')) {
    db.exec(`ALTER TABLE inventory ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`);
  }
}
