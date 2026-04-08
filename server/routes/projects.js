const express = require('express');
const multer = require('multer');
const { getPool, sql } = require('../db/connection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const VALID_APP_TYPES = new Set(['Pro-Code Apps', 'Model-Driven Apps', 'Canvas Apps', 'Prototype Apps']);
const IS_SQLITE = process.env.USE_SQLITE === 'true';
let imageTableReadyPromise;

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

const uploadImages = upload.fields([
  { name: 'images', maxCount: 20 },
  { name: 'thumbnail', maxCount: 1 },
]);

async function ensureImageTable(pool) {
  if (!imageTableReadyPromise) {
    imageTableReadyPromise = (async () => {
      if (IS_SQLITE) {
        await pool.request().query(`
          CREATE TABLE IF NOT EXISTS project_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            image_data BLOB NOT NULL,
            image_mime TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
          )
        `);
        await pool.request().query(
          'CREATE INDEX IF NOT EXISTS idx_project_images_project_sort ON project_images(project_id, sort_order, id)'
        );
      } else {
        await pool.request().query(`
          IF OBJECT_ID('project_images', 'U') IS NULL
          BEGIN
            CREATE TABLE project_images (
              id INT IDENTITY(1,1) PRIMARY KEY,
              project_id INT NOT NULL,
              image_data VARBINARY(MAX) NOT NULL,
              image_mime NVARCHAR(100) NULL,
              sort_order INT NOT NULL DEFAULT 0,
              created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
              CONSTRAINT FK_project_images_projects FOREIGN KEY (project_id)
                REFERENCES projects(id) ON DELETE CASCADE
            );
            CREATE INDEX IX_project_images_project_sort
              ON project_images(project_id, sort_order, id);
          END
        `);
      }
    })().catch((err) => {
      imageTableReadyPromise = null;
      throw err;
    });
  }

  await imageTableReadyPromise;
}

function getUploadedImages(req) {
  const images = req.files?.images || [];
  const thumbnail = req.files?.thumbnail || [];
  return [...images, ...thumbnail].filter((file) => file && file.buffer);
}

async function getProjectWithImageFlag(pool, id) {
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query(
      `SELECT id, title, description, app_type, tech_tags, project_category, github_url, site_url,
              CASE
                WHEN thumbnail_image IS NOT NULL
                  OR EXISTS (SELECT 1 FROM project_images pi WHERE pi.project_id = projects.id)
                THEN 1
                ELSE 0
              END AS has_image,
              created_at,
              updated_at
       FROM projects
       WHERE id = @id`
    );
  return result.recordset[0] || null;
}

async function appendProjectImages(pool, projectId, files) {
  if (!files.length) return;

  const maxSortResult = await pool
    .request()
    .input('project_id', sql.Int, projectId)
    .query('SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM project_images WHERE project_id = @project_id');

  let nextSort = (maxSortResult.recordset[0]?.max_sort ?? -1) + 1;

  for (const file of files) {
    await pool
      .request()
      .input('project_id', sql.Int, projectId)
      .input('image_data', sql.VarBinary(sql.MAX), file.buffer)
      .input('image_mime', sql.NVarChar(100), file.mimetype || null)
      .input('sort_order', sql.Int, nextSort)
      .query(
        `INSERT INTO project_images (project_id, image_data, image_mime, sort_order)
         VALUES (@project_id, @image_data, @image_mime, @sort_order)`
      );
    nextSort += 1;
  }
}

// GET /api/projects — public (returns metadata only, not binary image data)
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    await ensureImageTable(pool);
    const result = await pool.request().query(
      `SELECT id, title, description, app_type, tech_tags, project_category, github_url, site_url,
              CASE
                WHEN thumbnail_image IS NOT NULL
                  OR EXISTS (SELECT 1 FROM project_images pi WHERE pi.project_id = projects.id)
                THEN 1
                ELSE 0
              END AS has_image,
              created_at,
              updated_at
       FROM projects
       ORDER BY created_at DESC`
    );
    res.json(result.recordset);
  } catch (err) {
    console.error('GET /api/projects error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch projects', details: err.message });
  }
});

// GET /api/projects/:id — public, returns one project record
router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid project id' });
  }

  try {
    const pool = await getPool();
    await ensureImageTable(pool);
    const row = await getProjectWithImageFlag(pool, id);
    if (!row) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(row);
  } catch (err) {
    console.error('GET /api/projects/:id error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch project', details: err.message });
  }
});

// GET /api/projects/:id/images — public, returns gallery metadata
router.get('/:id/images', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid project id' });
  }

  try {
    const pool = await getPool();
    await ensureImageTable(pool);

    const imagesResult = await pool
      .request()
      .input('project_id', sql.Int, id)
      .query(
        `SELECT id, image_mime, sort_order, created_at
         FROM project_images
         WHERE project_id = @project_id
         ORDER BY sort_order ASC, id ASC`
      );

    const images = imagesResult.recordset.map((image) => ({
      id: image.id,
      mime: image.image_mime,
      sort_order: image.sort_order,
      created_at: image.created_at,
      url: `/api/projects/${id}/images/${image.id}`,
    }));

    if (images.length === 0) {
      const legacy = await pool
        .request()
        .input('id', sql.Int, id)
        .query('SELECT thumbnail_image, thumbnail_mime FROM projects WHERE id = @id');
      const legacyRow = legacy.recordset[0];
      if (legacyRow && legacyRow.thumbnail_image) {
        images.push({
          id: 'legacy',
          mime: legacyRow.thumbnail_mime,
          sort_order: 0,
          created_at: null,
          url: `/api/projects/${id}/images/legacy`,
        });
      }
    }

    res.json(images);
  } catch (err) {
    console.error('GET /api/projects/:id/images error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch project images', details: err.message });
  }
});

// GET /api/projects/:id/images/:imageId — public, serves one gallery image binary
router.get('/:id/images/:imageId', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { imageId } = req.params;

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid project id' });
  }

  try {
    const pool = await getPool();
    await ensureImageTable(pool);

    if (imageId === 'legacy') {
      const legacy = await pool
        .request()
        .input('id', sql.Int, id)
        .query('SELECT thumbnail_image, thumbnail_mime FROM projects WHERE id = @id');
      const legacyRow = legacy.recordset[0];
      if (!legacyRow || !legacyRow.thumbnail_image) {
        return res.status(404).json({ error: 'No image found' });
      }
      res.set('Content-Type', legacyRow.thumbnail_mime || 'application/octet-stream');
      res.set('Cache-Control', 'no-store');
      return res.send(legacyRow.thumbnail_image);
    }

    const parsedImageId = parseInt(imageId, 10);
    if (Number.isNaN(parsedImageId)) {
      return res.status(400).json({ error: 'Invalid image id' });
    }

    const result = await pool
      .request()
      .input('project_id', sql.Int, id)
      .input('image_id', sql.Int, parsedImageId)
      .query(
        `SELECT image_data, image_mime
         FROM project_images
         WHERE project_id = @project_id AND id = @image_id`
      );

    const row = result.recordset[0];
    if (!row || !row.image_data) {
      return res.status(404).json({ error: 'No image found' });
    }

    res.set('Content-Type', row.image_mime || 'application/octet-stream');
    res.set('Cache-Control', 'no-store');
    res.send(row.image_data);
  } catch (err) {
    console.error('GET /api/projects/:id/images/:imageId error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to retrieve image', details: err.message });
  }
});

// GET /api/projects/:id/image — public, serves the stored image binary
router.get('/:id/image', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const pool = await getPool();
    await ensureImageTable(pool);

    const galleryResult = await pool
      .request()
      .input('project_id', sql.Int, id)
      .query(
        `SELECT id, image_data, image_mime
         FROM project_images
         WHERE project_id = @project_id
         ORDER BY sort_order ASC, id ASC`
      );

    const firstGallery = galleryResult.recordset[0];
    if (firstGallery && firstGallery.image_data) {
      res.set('Content-Type', firstGallery.image_mime || 'application/octet-stream');
      res.set('Cache-Control', 'no-store');
      return res.send(firstGallery.image_data);
    }

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
router.post('/', authMiddleware, uploadImages, async (req, res) => {
  const { title, description, app_type, tech_tags, project_category, github_url, site_url } = req.body;
  const uploadedImages = getUploadedImages(req);

  if (!title || !description) {
    return res.status(400).json({ error: 'title and description are required' });
  }
  if (!VALID_APP_TYPES.has(app_type)) {
    return res.status(400).json({ error: 'app_type must be Code Apps, Model-Driven Apps, or Canvas Apps' });
  }

  try {
    const pool = await getPool();
    await ensureImageTable(pool);
    const request = pool
      .request()
      .input('title', sql.NVarChar(200), title)
      .input('description', sql.NVarChar(sql.MAX), description)
      .input('app_type', sql.NVarChar(50), app_type)
      .input('tech_tags', sql.NVarChar(500), tech_tags || '')
      .input('project_category', sql.NVarChar(100), project_category || null)
      .input('github_url', sql.NVarChar(500), github_url || null)
      .input('site_url', sql.NVarChar(500), site_url || null)
      .input('thumbnail_image', sql.VarBinary(sql.MAX), null)
      .input('thumbnail_mime', sql.NVarChar(100), null);

    const result = await request.query(
            `INSERT INTO projects (title, description, app_type, tech_tags, project_category, github_url, site_url, thumbnail_image, thumbnail_mime)
        OUTPUT INSERTED.id, INSERTED.title, INSERTED.description, INSERTED.app_type, INSERTED.tech_tags, INSERTED.project_category, INSERTED.github_url, INSERTED.site_url,
              CASE WHEN INSERTED.thumbnail_image IS NOT NULL THEN 1 ELSE 0 END AS has_image,
              INSERTED.created_at, INSERTED.updated_at
        VALUES (@title, @description, @app_type, @tech_tags, @project_category, @github_url, @site_url, @thumbnail_image, @thumbnail_mime)`
    );

    const created = result.recordset[0];
    await appendProjectImages(pool, created.id, uploadedImages);
    const refreshed = await getProjectWithImageFlag(pool, created.id);

    res.status(201).json(refreshed || created);
  } catch (err) {
    console.error('POST /api/projects error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to create project', details: err.message });
  }
});

// PUT /api/projects/:id — admin only
router.put('/:id', authMiddleware, uploadImages, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, description, app_type, tech_tags, project_category, github_url, site_url } = req.body;
  const uploadedImages = getUploadedImages(req);

  if (!title || !description) {
    return res.status(400).json({ error: 'title and description are required' });
  }
  if (!VALID_APP_TYPES.has(app_type)) {
    return res.status(400).json({ error: 'app_type must be Code Apps, Model-Driven Apps, or Canvas Apps' });
  }

  try {
    const pool = await getPool();
    await ensureImageTable(pool);

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

    const result = await request.query(`
      UPDATE projects
      SET title = @title, description = @description, app_type = @app_type, tech_tags = @tech_tags,
          project_category = @project_category,
          github_url = @github_url,
          site_url = @site_url,
          updated_at = SYSUTCDATETIME()
      OUTPUT INSERTED.id, INSERTED.title, INSERTED.description, INSERTED.app_type, INSERTED.tech_tags, INSERTED.project_category, INSERTED.github_url, INSERTED.site_url,
             CASE WHEN INSERTED.thumbnail_image IS NOT NULL THEN 1 ELSE 0 END AS has_image,
             INSERTED.created_at, INSERTED.updated_at
      WHERE id = @id
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await appendProjectImages(pool, id, uploadedImages);
    const refreshed = await getProjectWithImageFlag(pool, id);

    res.json(refreshed || result.recordset[0]);
  } catch (err) {
    console.error('PUT /api/projects/:id error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to update project', details: err.message });
  }
});

// DELETE /api/projects/:id — admin only
router.delete('/:id', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const pool = await getPool();
    await ensureImageTable(pool);

    await pool
      .request()
      .input('project_id', sql.Int, id)
      .query('DELETE FROM project_images WHERE project_id = @project_id');

    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM projects OUTPUT DELETED.id WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ deleted: id });
  } catch (err) {
    console.error('DELETE /api/projects/:id error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to delete project', details: err.message });
  }
});

module.exports = router;
