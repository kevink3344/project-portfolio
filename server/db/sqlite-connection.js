'use strict';

const path = require('path');

let Database;
try {
  Database = require('better-sqlite3');
} catch {
  throw new Error(
    'better-sqlite3 is not installed. Run: npm install --save-dev better-sqlite3'
  );
}

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, 'portfolio.sqlite');

let _db;

function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      title            TEXT    NOT NULL,
      description      TEXT    NOT NULL,
      app_type         TEXT    NOT NULL DEFAULT '',
      tech_tags        TEXT    NOT NULL DEFAULT '',
      project_category TEXT,
      github_url       TEXT,
      site_url         TEXT,
      thumbnail_image  BLOB,
      thumbnail_mime   TEXT,
      created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);
}

// Type stubs — SQLite does not use typed parameters; these are accepted and ignored.
const sql = {
  Int: 'int',
  NVarChar: () => 'nvarchar',
  VarBinary: () => 'varbinary',
  MAX: -1,
};

// Columns returned after INSERT / UPDATE to match the mssql OUTPUT shape.
const FIND_BY_ID = `
  SELECT id, title, description, app_type, tech_tags, project_category, github_url, site_url,
         CASE WHEN thumbnail_image IS NOT NULL THEN 1 ELSE 0 END AS has_image,
         created_at, updated_at
  FROM projects WHERE id = ?
`;

class SqliteRequest {
  constructor(db) {
    this._db = db;
    this._params = {};
  }

  // Mimic mssql's chainable .input(name, type, value) — type is ignored.
  input(name, _type, value) {
    this._params[name] = value;
    return this;
  }

  // Execute the SQL, rewriting Azure SQL-specific syntax to SQLite as needed.
  // Returns a Promise<{ recordset: rows[] }> to preserve the mssql async API.
  query(sqlText) {
    const db = this._db;
    const params = this._params;

    // --- INSERT ... OUTPUT INSERTED ... VALUES ---
    if (/^\s*INSERT/i.test(sqlText) && /OUTPUT\s+INSERTED/i.test(sqlText)) {
      const stripped = sqlText.replace(
        /\s+OUTPUT\s+[\s\S]+?\s+(?=VALUES\s*\()/i,
        ' '
      );
      const info = db.prepare(stripped).run(params);
      const row = db.prepare(FIND_BY_ID).get(info.lastInsertRowid);
      return Promise.resolve({ recordset: row ? [row] : [] });
    }

    // --- UPDATE ... OUTPUT INSERTED ... WHERE ---
    // Also replaces SYSUTCDATETIME() which is Azure SQL-specific.
    if (/^\s*UPDATE/i.test(sqlText) && /OUTPUT\s+INSERTED/i.test(sqlText)) {
      const stripped = sqlText
        .replace(/\s+OUTPUT\s+[\s\S]+?\s+(?=WHERE\s+)/i, ' ')
        .replace(/SYSUTCDATETIME\(\)/gi, "strftime('%Y-%m-%dT%H:%M:%fZ','now')");
      db.prepare(stripped).run(params);
      const row = db.prepare(FIND_BY_ID).get(params.id);
      return Promise.resolve({ recordset: row ? [row] : [] });
    }

    // --- DELETE ... OUTPUT DELETED.col WHERE ---
    if (/^\s*DELETE/i.test(sqlText) && /OUTPUT\s+DELETED/i.test(sqlText)) {
      const stripped = sqlText.replace(/\s+OUTPUT\s+DELETED\.[^\s]+/i, '');
      const info = db.prepare(stripped).run(params);
      return Promise.resolve({
        recordset: info.changes > 0 ? [{ id: params.id }] : [],
      });
    }

    // --- Regular SELECT ---
    if (/^\s*SELECT/i.test(sqlText)) {
      const rows = db.prepare(sqlText).all(params);
      return Promise.resolve({ recordset: rows });
    }

    // --- Other DML (no OUTPUT) ---
    db.prepare(sqlText).run(params);
    return Promise.resolve({ recordset: [] });
  }
}

async function getPool() {
  return {
    request: () => new SqliteRequest(getDb()),
  };
}

module.exports = { getPool, sql };
