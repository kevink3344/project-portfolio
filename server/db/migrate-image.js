require('dotenv').config();
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: { encrypt: true, trustServerCertificate: false },
};

(async () => {
  const pool = await sql.connect(config);

  // Drop any DEFAULT constraints on the thumbnail column
  const dcResult = await pool.request().query(`
    SELECT dc.name AS constraint_name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE c.object_id = OBJECT_ID('projects') AND c.name = 'thumbnail'
  `);
  console.log('Default constraints:', JSON.stringify(dcResult.recordset));
  for (const row of dcResult.recordset) {
    console.log('Dropping default constraint:', row.constraint_name);
    await pool.request().query(`ALTER TABLE projects DROP CONSTRAINT [${row.constraint_name}]`);
  }

  // Find any non-clustered indexes blocking the column drop
  const idxResult = await pool.request().query(`
    SELECT i.name AS index_name, i.type_desc
    FROM sys.index_columns ic
    JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE c.object_id = OBJECT_ID('projects') AND c.name = 'thumbnail'
      AND i.is_primary_key = 0
  `);
  for (const row of idxResult.recordset) {
    console.log('Dropping index:', row.index_name);
    await pool.request().query(`DROP INDEX [${row.index_name}] ON projects`);
  }

  await pool.request().query(`
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('projects') AND name = 'thumbnail')
      ALTER TABLE projects DROP COLUMN thumbnail;
  `);
  console.log('Dropped thumbnail column');

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('projects') AND name = 'thumbnail_image')
      ALTER TABLE projects ADD thumbnail_image VARBINARY(MAX) NULL;
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('projects') AND name = 'thumbnail_mime')
      ALTER TABLE projects ADD thumbnail_mime NVARCHAR(100) NULL;
  `);

  console.log('Migration complete');
  await pool.close();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
