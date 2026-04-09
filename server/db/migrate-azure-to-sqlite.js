'use strict';

require('dotenv').config();

const path = require('path');
const sql = require('mssql');
const Database = require('better-sqlite3');

const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, 'portfolio.sqlite');

const mssqlConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

function assertAzureEnv() {
  const required = ['DB_SERVER', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required Azure SQL env vars: ${missing.join(', ')}`);
  }
}

function ensureSqliteSchema(db) {
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

async function fetchAzureProjects() {
  const pool = await sql.connect(mssqlConfig);
  try {
    const metaResult = await pool.request().query(`
      SELECT id, title, description, app_type, tech_tags, project_category, github_url, site_url,
             CASE WHEN thumbnail_image IS NOT NULL THEN 1 ELSE 0 END AS has_image,
             thumbnail_mime, created_at, updated_at
      FROM projects
      ORDER BY id ASC
    `);

    const rows = [];
    for (const meta of metaResult.recordset) {
      let imageBuffer = null;
      if (meta.has_image === 1) {
        let lastBlobErr;
        for (let attempt = 1; attempt <= 4; attempt += 1) {
          try {
            const blobResult = await pool
              .request()
              .input('id', sql.Int, meta.id)
              .query('SELECT thumbnail_image FROM projects WHERE id = @id');
            imageBuffer = blobResult.recordset[0]?.thumbnail_image || null;
            lastBlobErr = null;
            break;
          } catch (err) {
            lastBlobErr = err;
            if (attempt < 4) {
              await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
            }
          }
        }
        if (lastBlobErr) {
          throw new Error(`Failed to fetch image for project id=${meta.id}: ${lastBlobErr.message}`);
        }
      }

      rows.push({
        id: meta.id,
        title: meta.title,
        description: meta.description,
        app_type: meta.app_type,
        tech_tags: meta.tech_tags,
        project_category: meta.project_category,
        github_url: meta.github_url,
        site_url: meta.site_url,
        thumbnail_image: imageBuffer,
        thumbnail_mime: meta.thumbnail_mime,
        created_at: meta.created_at,
        updated_at: meta.updated_at,
      });
    }

    return rows;
  } finally {
    await pool.close();
  }
}

async function fetchAzureProjectsWithRetry(maxAttempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchAzureProjects();
    } catch (err) {
      lastError = err;
      const isLast = attempt === maxAttempts;
      if (isLast) break;
      const delayMs = attempt * 1500;
      console.warn(
        `Azure SQL read failed (attempt ${attempt}/${maxAttempts}): ${err.message}. Retrying in ${delayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function upsertIntoSqlite(rows) {
  const db = new Database(SQLITE_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  ensureSqliteSchema(db);

  const upsert = db.prepare(`
    INSERT INTO projects (
      id, title, description, app_type, tech_tags, project_category, github_url, site_url,
      thumbnail_image, thumbnail_mime, created_at, updated_at
    ) VALUES (
      @id, @title, @description, @app_type, @tech_tags, @project_category, @github_url, @site_url,
      @thumbnail_image, @thumbnail_mime, @created_at, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      app_type = excluded.app_type,
      tech_tags = excluded.tech_tags,
      project_category = excluded.project_category,
      github_url = excluded.github_url,
      site_url = excluded.site_url,
      thumbnail_image = excluded.thumbnail_image,
      thumbnail_mime = excluded.thumbnail_mime,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
  `);

  const tx = db.transaction((records) => {
    for (const r of records) {
      upsert.run({
        id: r.id,
        title: r.title,
        description: r.description,
        app_type: r.app_type || '',
        tech_tags: r.tech_tags || '',
        project_category: r.project_category ?? null,
        github_url: r.github_url ?? null,
        site_url: r.site_url ?? null,
        thumbnail_image: r.thumbnail_image ?? null,
        thumbnail_mime: r.thumbnail_mime ?? null,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      });
    }
  });

  tx(rows);

  const sqliteCount = db.prepare('SELECT COUNT(*) AS c FROM projects').get().c;
  const sqliteImages = db
    .prepare('SELECT COUNT(*) AS c FROM projects WHERE thumbnail_image IS NOT NULL')
    .get().c;

  db.close();
  return { sqliteCount, sqliteImages };
}

async function main() {
  assertAzureEnv();

  console.log(`Reading projects from Azure SQL: ${process.env.DB_SERVER}/${process.env.DB_NAME}`);
  const rows = await fetchAzureProjectsWithRetry();
  const azureCount = rows.length;
  const azureImages = rows.filter((r) => r.thumbnail_image).length;

  console.log(`Writing ${azureCount} projects to SQLite: ${SQLITE_PATH}`);
  const { sqliteCount, sqliteImages } = upsertIntoSqlite(rows);

  console.log('Migration complete.');
  console.log(`Azure count: ${azureCount} | Azure with images: ${azureImages}`);
  console.log(`SQLite count: ${sqliteCount} | SQLite with images: ${sqliteImages}`);
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
});
