require('dotenv').config();
const mysql = require('mysql2/promise');


const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'leave_mgmt',
  waitForConnections: true,
  connectionLimit: process.env.DB_CONN_LIMIT ? Number(process.env.DB_CONN_LIMIT) : (process.env.NODE_ENV === 'production' ? 5 : 10),
  connectTimeout: process.env.DB_CONNECT_TIMEOUT ? Number(process.env.DB_CONNECT_TIMEOUT) : 10000,
  // Optional SSL - set DB_SSL=true and DB_SSL_REJECT_UNAUTHORIZED=false if needed
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
});

module.exports = pool;
