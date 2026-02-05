
require('dotenv').config();
const fs = require('fs');
const mysql = require('mysql2/promise');

async function run() {
  try {
    const sql = fs.readFileSync('config/init.sql', 'utf8');
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
    });
    await conn.query(sql);
    console.log('Database schema applied successfully.');
    await conn.end();
  } catch (err) {
    console.error('Failed to apply schema —', err.message || err);
    console.error('Check your DB credentials and that the DB is reachable from your machine.');
    process.exit(1);
  }
}

run();