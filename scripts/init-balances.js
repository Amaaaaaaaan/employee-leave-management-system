require('dotenv').config();
const pool = require('../config/db');

async function run() {
  try {
    const [users] = await pool.query('SELECT id FROM users');
    for (const u of users) {
      
      await pool.execute(
        `INSERT INTO leave_balances (user_id, type, balance) VALUES (?,?,?) ON DUPLICATE KEY UPDATE balance = VALUES(balance)`,
        [u.id, 'vacation', 20]
      );

      await pool.execute(
        `INSERT INTO leave_balances (user_id, type, balance) VALUES (?,?,?) ON DUPLICATE KEY UPDATE balance = VALUES(balance)`,
        [u.id, 'sick', 10]
      );
    }
    console.log(`Balances initialized for ${users.length} users.`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to initialize balances:', err.message || err);
    process.exit(1);
  }
}

run();
