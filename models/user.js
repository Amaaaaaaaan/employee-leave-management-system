const pool = require('../config/db');
const bcrypt = require('bcrypt');

async function createUser(username, password, role = 'employee') {
  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.execute(
    'INSERT INTO users (username, password, role) VALUES (?,?,?)',
    [username, hash, role]
  );
  return result.insertId;
}

async function findByUsername(username) {
  const [rows] = await pool.execute(
    'SELECT id, username, password, role FROM users WHERE username = ?',
    [username]
  );
  return rows[0];
}

module.exports = { createUser, findByUsername };
