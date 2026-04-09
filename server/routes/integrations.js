const express = require('express');
const multer = require('multer');
const { getPool, sql } = require('../db/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const IS_SQLITE = process.env.USE_SQLITE === 'true';
let integrationsTableReadyPromise;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

async function ensureIntegrationsTable(pool) {
  if (!integrationsTableReadyPromise) {
    integrationsTableReadyPromise = (async () => {
      if (IS_SQLITE) {
        await pool.request().query(`
          CREATE TABLE IF NOT EXISTS integrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            icon_data BLOB NOT NULL,
            icon_mime TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
          )
        `);
        await pool.request().query(
          'CREATE INDEX IF NOT EXISTS idx_integrations_sort ON integrations(sort_order, id)'
        );
      } else {
        await pool.request().query(`
          IF OBJECT_ID('integrations', 'U') IS NULL
          BEGIN
            CREATE TABLE integrations (
              id INT IDENTITY(1,1) PRIMARY KEY,
              title NVARCHAR(200) NOT NULL,
              description NVARCHAR(MAX) NOT NULL,
              icon_data VARBINARY(MAX) NOT NULL,
              icon_mime NVARCHAR(100) NULL,
              sort_order INT NOT NULL DEFAULT 0,
              created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
              updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
            );
            CREATE INDEX IX_integrations_sort
              ON integrations(sort_order, id);
          END
        `);
      }
    })().catch((err) => {
      integrationsTableReadyPromise = null;
      throw err;
    });
  }

  await integrationsTableReadyPromise;
}

// GET /api/integrations — public, fetch all integrations
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    await ensureIntegrationsTable(pool);

    const result = await pool
      .request()
      .query('SELECT id, title, description, icon_mime, sort_order FROM integrations ORDER BY sort_order ASC, id ASC');

    const integrations = result.recordset.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      iconUrl: `/api/integrations/${row.id}/icon`,
      mime: row.icon_mime,
    }));

    res.json(integrations);
  } catch (err) {
    console.error('GET /api/integrations error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch integrations', details: err.message });
  }
});

// GET /api/integrations/:id/icon — public, serve icon binary
router.get('/:id/icon', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid integration id' });
  }

  try {
    const pool = await getPool();
    await ensureIntegrationsTable(pool);

    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('SELECT icon_data, icon_mime FROM integrations WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Integration icon not found' });
    }

    const row = result.recordset[0];
    const mime = row.icon_mime || 'application/octet-stream';
    res.set('Content-Type', mime);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(row.icon_data);
  } catch (err) {
    console.error('GET /api/integrations/:id/icon error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to retrieve icon', details: err.message });
  }
});

// POST /api/integrations — admin only, create integration
router.post('/', authMiddleware, upload.single('icon'), async (req, res) => {
  const { title, description } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Icon is required' });
  }

  try {
    const pool = await getPool();
    await ensureIntegrationsTable(pool);

    const maxOrderResult = await pool.request().query('SELECT MAX(sort_order) as maxOrder FROM integrations');
    const nextOrder = (maxOrderResult.recordset[0]?.maxOrder ?? -1) + 1;

    if (IS_SQLITE) {
      const result = await pool
        .request()
        .input('title', sql.NVarChar, title.trim())
        .input('description', sql.NVarChar, description.trim())
        .input('icon_data', sql.VarBinary, req.file.buffer)
        .input('icon_mime', sql.NVarChar, req.file.mimetype)
        .input('sort_order', sql.Int, nextOrder)
        .query(
          `INSERT INTO integrations (title, description, icon_data, icon_mime, sort_order)
           VALUES (@title, @description, @icon_data, @icon_mime, @sort_order);
           SELECT last_insert_rowid() as id`
        );
      const id = result.recordset[0].id;
      res.status(201).json({ id, title: title.trim(), description: description.trim() });
    } else {
      const result = await pool
        .request()
        .input('title', sql.NVarChar, title.trim())
        .input('description', sql.NVarChar, description.trim())
        .input('icon_data', sql.VarBinary, req.file.buffer)
        .input('icon_mime', sql.NVarChar, req.file.mimetype)
        .input('sort_order', sql.Int, nextOrder)
        .query(
          `INSERT INTO integrations (title, description, icon_data, icon_mime, sort_order)
           OUTPUT INSERTED.id
           VALUES (@title, @description, @icon_data, @icon_mime, @sort_order)`
        );
      const id = result.recordset[0].id;
      res.status(201).json({ id, title: title.trim(), description: description.trim() });
    }
  } catch (err) {
    console.error('POST /api/integrations error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to create integration', details: err.message });
  }
});

// PUT /api/integrations/:id — admin only, update integration
router.put('/:id', authMiddleware, upload.single('icon'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, description } = req.body;

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid integration id' });
  }

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  try {
    const pool = await getPool();
    await ensureIntegrationsTable(pool);

    if (req.file) {
      // Update with new icon
      await pool
        .request()
        .input('id', sql.Int, id)
        .input('title', sql.NVarChar, title.trim())
        .input('description', sql.NVarChar, description.trim())
        .input('icon_data', sql.VarBinary, req.file.buffer)
        .input('icon_mime', sql.NVarChar, req.file.mimetype)
        .query(
          `UPDATE integrations
           SET title = @title, description = @description, icon_data = @icon_data, icon_mime = @icon_mime, updated_at = ${IS_SQLITE ? "strftime('%Y-%m-%dT%H:%M:%fZ','now')" : 'SYSUTCDATETIME()'}
           WHERE id = @id`
        );
    } else {
      // Update without icon
      await pool
        .request()
        .input('id', sql.Int, id)
        .input('title', sql.NVarChar, title.trim())
        .input('description', sql.NVarChar, description.trim())
        .query(
          `UPDATE integrations
           SET title = @title, description = @description, updated_at = ${IS_SQLITE ? "strftime('%Y-%m-%dT%H:%M:%fZ','now')" : 'SYSUTCDATETIME()'}
           WHERE id = @id`
        );
    }

    res.json({ id, title: title.trim(), description: description.trim() });
  } catch (err) {
    console.error('PUT /api/integrations/:id error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to update integration', details: err.message });
  }
});

// DELETE /api/integrations/:id — admin only
router.delete('/:id', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid integration id' });
  }

  try {
    const pool = await getPool();
    await ensureIntegrationsTable(pool);

    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM integrations WHERE id = @id');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json({ id });
  } catch (err) {
    console.error('DELETE /api/integrations/:id error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to delete integration', details: err.message });
  }
});

// PATCH /api/integrations/order — admin only, update sort order
router.patch('/order', authMiddleware, async (req, res) => {
  const { integrationIds } = req.body || {};

  if (!Array.isArray(integrationIds)) {
    return res.status(400).json({ error: 'integrationIds must be an array of numeric ids' });
  }

  const parsedIds = integrationIds.map((value) => parseInt(value, 10));
  if (parsedIds.some((value) => Number.isNaN(value))) {
    return res.status(400).json({ error: 'integrationIds must contain only numeric ids' });
  }

  const deduped = new Set(parsedIds);
  if (deduped.size !== parsedIds.length) {
    return res.status(400).json({ error: 'integrationIds contains duplicate values' });
  }

  try {
    const pool = await getPool();
    await ensureIntegrationsTable(pool);

    for (let index = 0; index < parsedIds.length; index += 1) {
      await pool
        .request()
        .input('id', sql.Int, parsedIds[index])
        .input('sort_order', sql.Int, index)
        .query('UPDATE integrations SET sort_order = @sort_order WHERE id = @id');
    }

    res.json({ integrationIds: parsedIds });
  } catch (err) {
    console.error('PATCH /api/integrations/order error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to update integration order', details: err.message });
  }
});

module.exports = router;
