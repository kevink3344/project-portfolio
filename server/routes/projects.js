const express = require('express');
const multer = require('multer');
const { getPool, sql } = require('../db/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const VALID_APP_TYPES = new Set(['Code Apps', 'Model-Driven Apps', 'Canvas Apps']);

// Memory storage — store uploaded file buffer directly in the DB
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

// GET /api/projects — public (returns metadata only, not binary image data)
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT id, title, description, app_type, tech_tags, project_category, github_url, site_url,
              CASE WHEN thumbnail_image IS NOT NULL THEN 1 ELSE 0 END AS has_image,
              created_at,
              updated_at
       FROM projects
       ORDER BY created_at DESC`
    );
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /api/projects/:id/image — public, serves the stored image binary
router.get('/:id/image', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('SELECT thumbnail_image, thumbnail_mime FROM projects WHERE id = @id');

    const row = result.recordset[0];
    if (!row || !row.thumbnail_image) {
      return res.status(404).json({ error: 'No image found' });
    }

    res.set('Content-Type', row.thumbnail_mime || 'application/octet-stream');
    res.set('Cache-Control', 'no-store');
    res.send(row.thumbnail_image);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve image' });
  }
});

// POST /api/projects — admin only
router.post('/', authMiddleware, upload.single('thumbnail'), async (req, res) => {
  const { title, description, app_type, tech_tags, project_category, github_url, site_url } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'title and description are required' });
  }
  if (!VALID_APP_TYPES.has(app_type)) {
    return res.status(400).json({ error: 'app_type must be Code Apps, Model-Driven Apps, or Canvas Apps' });
  }

  try {
    const pool = await getPool();
    const request = pool
      .request()
      .input('title', sql.NVarChar(200), title)
      .input('description', sql.NVarChar(sql.MAX), description)
      .input('app_type', sql.NVarChar(50), app_type)
      .input('tech_tags', sql.NVarChar(500), tech_tags || '')
      .input('project_category', sql.NVarChar(100), project_category || null)
      .input('github_url', sql.NVarChar(500), github_url || null)
      .input('site_url', sql.NVarChar(500), site_url || null)
      .input('thumbnail_image', sql.VarBinary(sql.MAX), req.file ? req.file.buffer : null)
      .input('thumbnail_mime', sql.NVarChar(100), req.file ? req.file.mimetype : null);

    const result = await request.query(
            `INSERT INTO projects (title, description, app_type, tech_tags, project_category, github_url, site_url, thumbnail_image, thumbnail_mime)
        OUTPUT INSERTED.id, INSERTED.title, INSERTED.description, INSERTED.app_type, INSERTED.tech_tags, INSERTED.project_category, INSERTED.github_url, INSERTED.site_url,
              CASE WHEN INSERTED.thumbnail_image IS NOT NULL THEN 1 ELSE 0 END AS has_image,
              INSERTED.created_at, INSERTED.updated_at
        VALUES (@title, @description, @app_type, @tech_tags, @project_category, @github_url, @site_url, @thumbnail_image, @thumbnail_mime)`
    );
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /api/projects/:id — admin only
router.put('/:id', authMiddleware, upload.single('thumbnail'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, description, app_type, tech_tags, project_category, github_url, site_url } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'title and description are required' });
  }
  if (!VALID_APP_TYPES.has(app_type)) {
    return res.status(400).json({ error: 'app_type must be Code Apps, Model-Driven Apps, or Canvas Apps' });
  }

  try {
    const pool = await getPool();

    // Build query — only update image columns if a new file was uploaded
    let query;
    const request = pool
      .request()
      .input('id', sql.Int, id)
      .input('title', sql.NVarChar(200), title)
      .input('description', sql.NVarChar(sql.MAX), description)
      .input('app_type', sql.NVarChar(50), app_type)
      .input('tech_tags', sql.NVarChar(500), tech_tags || '')
      .input('project_category', sql.NVarChar(100), project_category || null)
      .input('github_url', sql.NVarChar(500), github_url || null)
      .input('site_url', sql.NVarChar(500), site_url || null);

    if (req.file) {
      request
        .input('thumbnail_image', sql.VarBinary(sql.MAX), req.file.buffer)
        .input('thumbnail_mime', sql.NVarChar(100), req.file.mimetype);
      query = `
        UPDATE projects
        SET title = @title, description = @description, app_type = @app_type, tech_tags = @tech_tags,
            project_category = @project_category,
            github_url = @github_url,
          site_url = @site_url,
            thumbnail_image = @thumbnail_image, thumbnail_mime = @thumbnail_mime,
            updated_at = SYSUTCDATETIME()
        OUTPUT INSERTED.id, INSERTED.title, INSERTED.description, INSERTED.app_type, INSERTED.tech_tags, INSERTED.project_category, INSERTED.github_url, INSERTED.site_url,
               CASE WHEN INSERTED.thumbnail_image IS NOT NULL THEN 1 ELSE 0 END AS has_image,
           INSERTED.created_at, INSERTED.updated_at
        WHERE id = @id`;
    } else {
      query = `
        UPDATE projects
        SET title = @title, description = @description, app_type = @app_type, tech_tags = @tech_tags,
            project_category = @project_category,
            github_url = @github_url,
          site_url = @site_url,
            updated_at = SYSUTCDATETIME()
        OUTPUT INSERTED.id, INSERTED.title, INSERTED.description, INSERTED.app_type, INSERTED.tech_tags, INSERTED.project_category, INSERTED.github_url, INSERTED.site_url,
               CASE WHEN INSERTED.thumbnail_image IS NOT NULL THEN 1 ELSE 0 END AS has_image,
           INSERTED.created_at, INSERTED.updated_at
        WHERE id = @id`;
    }

    const result = await request.query(query);
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id — admin only
router.delete('/:id', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM projects OUTPUT DELETED.id WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ deleted: id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
