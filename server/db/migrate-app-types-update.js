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

  // Drop the old constraint
  await pool.request().query(`
    IF EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = 'CK_projects_app_type'
    )
      ALTER TABLE projects
      DROP CONSTRAINT CK_projects_app_type;
  `);

  // Update existing "Code Apps" to "Pro-Code Apps"
  await pool.request().query(`
    UPDATE projects
    SET app_type = 'Pro-Code Apps'
    WHERE app_type = 'Code Apps';
  `);

  // Add the new constraint with all four app types
  await pool.request().query(`
    ALTER TABLE projects
    ADD CONSTRAINT CK_projects_app_type
    CHECK (app_type IN ('Pro-Code Apps', 'Model-Driven Apps', 'Canvas Apps', 'Prototype Apps'));
  `);

  console.log('Migration complete: app_type renamed and new Prototype Apps type added');
  await pool.close();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
