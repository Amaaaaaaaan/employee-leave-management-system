const pool = require('../config/db');

async function createLeave({ user_id, type, start_date, end_date, reason, status = 'pending' }) {
  const [result] = await pool.execute(
    'INSERT INTO leaves (user_id, type, start_date, end_date, reason, status) VALUES (?,?,?,?,?,?)',
    [user_id, type, start_date, end_date, reason, status]
  );
  return result.insertId;
}

async function findByUser(user_id) {
  const [rows] = await pool.execute('SELECT l.*, u.username FROM leaves l JOIN users u ON l.user_id = u.id WHERE user_id = ? ORDER BY l.created_at DESC', [user_id]);
  return rows;
}

async function findAllWithUser() {
  const [rows] = await pool.execute(
    `SELECT l.*, u.username FROM leaves l JOIN users u ON l.user_id = u.id ORDER BY l.created_at DESC`
  );
  return rows;
}

async function findPending() {
  const [rows] = await pool.execute(
    `SELECT l.*, u.username FROM leaves l JOIN users u ON l.user_id = u.id WHERE l.status = 'pending' ORDER BY l.created_at DESC`
  );
  return rows;
}

async function getById(id) {
  const [rows] = await pool.execute(
    `SELECT l.*, u.username FROM leaves l JOIN users u ON l.user_id = u.id WHERE l.id = ?`,
    [id]
  );
  return rows[0];
}

async function getApprovedLeaves(user_id = null) {
  let query = `SELECT l.*, u.username FROM leaves l JOIN users u ON l.user_id = u.id WHERE l.status = 'approved'`;
  let params = [];
  
  if (user_id) {
    query += ` AND l.user_id = ?`;
    params.push(user_id);
  }
  
  query += ` ORDER BY l.start_date`;
  
  const [rows] = await pool.execute(query, params);
  return rows;
}

async function approveLeave(id, manager_comment = null) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute('SELECT * FROM leaves WHERE id = ? FOR UPDATE', [id]);
    const leave = rows[0];
    if (!leave) throw new Error('NOT_FOUND');
    if (leave.status !== 'pending') throw new Error('NOT_PENDING');

   
    const start = new Date(leave.start_date);
    const end = new Date(leave.end_date);
    const msPerDay = 24 * 60 * 60 * 1000;
    const days = Math.round((end - start) / msPerDay) + 1;
    if (days <= 0) throw new Error('INVALID_DATES');

    // lock balance row
    const [balRows] = await conn.execute('SELECT * FROM leave_balances WHERE user_id = ? AND type = ? FOR UPDATE', [leave.user_id, leave.type]);
    const bal = balRows[0];
    if (!bal || Number(bal.balance) < days) {
      throw new Error('INSUFFICIENT_BALANCE');
    }

    // deduct
    await conn.execute('UPDATE leave_balances SET balance = balance - ? WHERE id = ?', [days, bal.id]);

    // update leave status and mark as deducted
    await conn.execute('UPDATE leaves SET status = ?, manager_comment = ?, balance_deducted = 1 WHERE id = ?', ['approved', manager_comment, id]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function rejectLeave(id, manager_comment = null) {
  await pool.execute('UPDATE leaves SET status = ?, manager_comment = ? WHERE id = ?', ['rejected', manager_comment, id]);
}

module.exports = {
  createLeave,
  findByUser,
  findAllWithUser,
  findPending,
  getById,
  getApprovedLeaves,
  approveLeave,
  rejectLeave,
};
