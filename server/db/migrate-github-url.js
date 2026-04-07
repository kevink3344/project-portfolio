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
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('projects') AND name = 'github_url')
      ALTER TABLE projects ADD github_url NVARCHAR(500) NULL;
  `);

  console.log('Migration complete: github_url column added');
  await pool.close();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
