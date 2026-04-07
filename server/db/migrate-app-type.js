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

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('projects') AND name = 'app_type')
      ALTER TABLE projects ADD app_type NVARCHAR(50) NULL;
  `);

  await pool.request().query(`
    UPDATE projects
    SET app_type = 'Code Apps'
    WHERE app_type IS NULL;
  `);

  await pool.request().query(`
    IF EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('projects') AND name = 'app_type' AND is_nullable = 1
    )
      ALTER TABLE projects ALTER COLUMN app_type NVARCHAR(50) NOT NULL;
  `);

  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = 'CK_projects_app_type'
    )
      ALTER TABLE projects
      ADD CONSTRAINT CK_projects_app_type
      CHECK (app_type IN ('Code Apps', 'Model-Driven Apps', 'Canvas Apps'));
  `);

  console.log('Migration complete: app_type column added and constrained');
  await pool.close();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
