// When USE_SQLITE=true, use the local SQLite adapter instead of Azure SQL.
if (process.env.USE_SQLITE === 'true') {
  module.exports = require('./sqlite-connection');
} else {

const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: true,            // Required for Azure SQL
    trustServerCertificate: false,
  },
};

let pool;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

module.exports = { getPool, sql };

} // end else (Azure SQL)
