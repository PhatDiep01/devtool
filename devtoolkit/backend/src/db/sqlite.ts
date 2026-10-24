// @ts-ignore
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { getDataDir } from '../services/file-manager';

let db: any = null;

/**
 * Get or create the singleton SQLite database instance using Node 22/24 built-in node:sqlite.
 * Zero external native C++ compilation needed!
 */
export function getDb(): any {
  if (db) return db;

  const dataDir = getDataDir();
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, 'devtoolkit.db');
  db = new DatabaseSync(dbPath);

  // Enable WAL mode & foreign keys
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA synchronous = NORMAL;');

  runMigrations(db);

  return db;
}

/**
 * Close database connection
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function runMigrations(database: any): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT '📁',
      color TEXT DEFAULT '#3b82f6',
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS screens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      file_path TEXT NOT NULL,
      author TEXT,
      status TEXT DEFAULT 'Draft',
      tags TEXT DEFAULT '[]',
      jira_key TEXT,
      overview TEXT,
      raw_content TEXT,
      parsed_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (module_id) REFERENCES modules(id),
      UNIQUE(module_id, slug)
    );

    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      screen_id INTEGER,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (screen_id) REFERENCES screens(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      category TEXT DEFAULT 'general'
    );

    CREATE TABLE IF NOT EXISTS jira_sessions (
      token TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      base_url TEXT NOT NULL,
      api_token TEXT NOT NULL,
      auth_type TEXT DEFAULT 'basic',
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_jira_sessions_expires ON jira_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_screens_module_id ON screens(module_id);
    CREATE INDEX IF NOT EXISTS idx_screens_slug ON screens(slug);
    CREATE INDEX IF NOT EXISTS idx_screens_status ON screens(status);
    CREATE INDEX IF NOT EXISTS idx_screens_updated_at ON screens(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_images_screen_id ON images(screen_id);

    -- Full-text search FTS5 table
    CREATE VIRTUAL TABLE IF NOT EXISTS screens_fts USING fts5(
      title, author, tags, overview, raw_content,
      content='screens',
      content_rowid='id'
    );

    -- Triggers to sync screens with FTS index
    CREATE TRIGGER IF NOT EXISTS screens_ai AFTER INSERT ON screens BEGIN
      INSERT INTO screens_fts(rowid, title, author, tags, overview, raw_content)
      VALUES (new.id, new.title, new.author, new.tags, new.overview, new.raw_content);
    END;

    CREATE TRIGGER IF NOT EXISTS screens_ad AFTER DELETE ON screens BEGIN
      INSERT INTO screens_fts(screens_fts, rowid, title, author, tags, overview, raw_content)
      VALUES ('delete', old.id, old.title, old.author, old.tags, old.overview, old.raw_content);
    END;

    CREATE TRIGGER IF NOT EXISTS screens_au AFTER UPDATE ON screens BEGIN
      INSERT INTO screens_fts(screens_fts, rowid, title, author, tags, overview, raw_content)
      VALUES ('delete', old.id, old.title, old.author, old.tags, old.overview, old.raw_content);
      INSERT INTO screens_fts(rowid, title, author, tags, overview, raw_content)
      VALUES (new.id, new.title, new.author, new.tags, new.overview, new.raw_content);
    END;

    -- Bug Tracker Table
    CREATE TABLE IF NOT EXISTS bugs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      us_key TEXT,
      us_link TEXT,
      type TEXT NOT NULL DEFAULT 'FE',
      status TEXT NOT NULL DEFAULT 'todo',
      severity TEXT DEFAULT 'medium',
      description TEXT,
      fix_solution TEXT,
      attachments TEXT DEFAULT '[]',
      created_by TEXT,
      assigned_to TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_bugs_status ON bugs(status);
    CREATE INDEX IF NOT EXISTS idx_bugs_type ON bugs(type);
    CREATE INDEX IF NOT EXISTS idx_bugs_us_key ON bugs(us_key);
    CREATE INDEX IF NOT EXISTS idx_bugs_updated_at ON bugs(updated_at DESC);

    -- Seed essential modules
    INSERT OR IGNORE INTO modules (name, slug, icon, sort_order) VALUES ('Survey Management', 'survey-management', '📊', 1);
    INSERT OR IGNORE INTO modules (name, slug, icon, sort_order) VALUES ('General', 'general', '📁', 2);
  `);

  // Safe migration for existing DB
  try {
    database.exec("ALTER TABLE jira_sessions ADD COLUMN auth_type TEXT DEFAULT 'basic';");
  } catch {}
  try {
    database.exec("ALTER TABLE modules ADD COLUMN description TEXT;");
  } catch {}
  try {
    database.exec("ALTER TABLE modules ADD COLUMN color TEXT DEFAULT '#3b82f6';");
  } catch {}
}
