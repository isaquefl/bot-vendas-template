/**
 * KYOTO BOT - DATABASE MANAGER
 * Gerenciador de banco de dados com backup automático
 * Versão: 2.0.0
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const Logger = require('./logger');
const Config = require('./config');

class Database {
  static instance = null;

  constructor() {
    if (Database.instance) {
      return Database.instance;
    }
    Database.instance = this;
    
    this.logger = Logger.getInstance();
    this.config = Config.getInstance();
    this.db = null;
    this.backupInterval = null;
    this.cacheCleanupInterval = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      const dbDir = path.dirname(this.config.database.path);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.config.database.path, (err) => {
        if (err) {
          this.logger.error('DATABASE', 'Failed to connect', err);
          reject(err);
          return;
        }
        this.logger.system('Database connected', { path: this.config.database.path });
        this._applyPragmas()
          .then(() => this._createTables())
          .then(resolve)
          .catch(reject);
      });
    });
  }

  async _applyPragmas() {
    const pragmas = [
      'PRAGMA journal_mode = WAL',
      'PRAGMA synchronous = NORMAL',
      'PRAGMA foreign_keys = ON',
      'PRAGMA busy_timeout = 5000'
    ];

    for (const sql of pragmas) {
      await this.run(sql).catch(() => {});
    }
  }

  async _createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS verified_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        discord_tag TEXT,
        access_token TEXT,
        refresh_token TEXT,
        verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_access DATETIME DEFAULT CURRENT_TIMESTAMP,
        redirect_key TEXT UNIQUE
      )`,
      `CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        product_type TEXT,
        product_name TEXT,
        quantity INTEGER,
        amount REAL,
        status TEXT DEFAULT 'pending',
        pix_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      )`,
      `CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        user_tag TEXT,
        category TEXT,
        subcategory TEXT,
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME
      )`,
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL DEFAULT 0,
        image_url TEXT,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT UNIQUE,
        channel_id TEXT,
        product_id INTEGER,
        title TEXT,
        description TEXT,
        image_url TEXT,
        base_price REAL,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )`,
      `CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        user_id TEXT,
        user_tag TEXT,
        action TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT,
        expires_at DATETIME
      )`
    ];

    for (const sql of tables) {
      await this.run(sql);
    }

    await this._runMigrations();
    this.logger.system('Database tables initialized');
    this._startBackupSchedule();
  }

  async _runMigrations() {
    try {
      const columns = await this.all("PRAGMA table_info(products)");
      const hasPrice = columns.some(c => c.name === 'price');
      const hasBasePrice = columns.some(c => c.name === 'base_price');
      
      if (hasBasePrice && !hasPrice) {
        await this.run('ALTER TABLE products ADD COLUMN price REAL DEFAULT 0');
        await this.run('UPDATE products SET price = base_price WHERE price = 0 OR price IS NULL');
        this.logger.system('Migration: products.base_price -> price completed');
      }
    } catch (error) {
      this.logger.warn('DATABASE', 'Migration check skipped (new install)', { error: error.message });
    }
  }

  _startBackupSchedule() {
    if (this.backupInterval) clearInterval(this.backupInterval);
    
    this.backupInterval = setInterval(() => {
      this.backup();
    }, this.config.database.backupInterval);

    if (this.cacheCleanupInterval) clearInterval(this.cacheCleanupInterval);
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanExpiredCache().catch(() => {});
    }, 10 * 60 * 1000);

    this.logger.system('Backup schedule started', { 
      interval: `${this.config.database.backupInterval / 3600000}h` 
    });
  }

  async backup() {
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup_${timestamp}.db`);

    try {
      fs.copyFileSync(this.config.database.path, backupPath);
      this.logger.system('Database backup created', { path: backupPath });
      this._cleanOldBackups(backupDir);
    } catch (error) {
      this.logger.error('DATABASE', 'Backup failed', error);
    }
  }

  _cleanOldBackups(backupDir) {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_'))
      .map(f => ({ name: f, path: path.join(backupDir, f), time: fs.statSync(path.join(backupDir, f)).mtime }))
      .sort((a, b) => b.time - a.time);

    if (files.length > this.config.database.maxBackups) {
      files.slice(this.config.database.maxBackups).forEach(f => {
        fs.unlinkSync(f.path);
        this.logger.debug('DATABASE', `Old backup removed: ${f.name}`);
      });
    }
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async setCache(key, value, ttlSeconds = 300) {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await this.run(
      'INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)',
      [key, JSON.stringify(value), expiresAt]
    );
  }

  async getCache(key) {
    const row = await this.get(
      'SELECT value FROM cache WHERE key = ? AND expires_at > datetime("now")',
      [key]
    );
    return row ? JSON.parse(row.value) : null;
  }

  async cleanExpiredCache() {
    await this.run('DELETE FROM cache WHERE expires_at <= datetime("now")');
  }

  close() {
    if (this.backupInterval) clearInterval(this.backupInterval);
    if (this.cacheCleanupInterval) clearInterval(this.cacheCleanupInterval);
    return new Promise((resolve) => {
      this.db.close((err) => {
        if (err) this.logger.error('DATABASE', 'Close error', err);
        else this.logger.system('Database connection closed');
        resolve();
      });
    });
  }

  static getInstance() {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }
}

module.exports = Database;
