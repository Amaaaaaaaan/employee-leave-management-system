const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { requireAuth, requireManager } = require('../config/auth');
const {
  createLeave,
  findByUser,
  findAllWithUser,
  approveLeave,
  rejectLeave,
  getApprovedLeaves,
} = require('../models/leave');

router.get('/new', requireAuth, async (req, res) => {
  const [rows] = await pool.execute('SELECT type, balance FROM leave_balances WHERE user_id = ?', [req.user.id]);
  const balances = rows.reduce((acc, r) => { acc[r.type] = Number(r.balance); return acc; }, {});
  res.render('leave/new', { user: req.user, error: null, balances });
});

router.post('/new', requireAuth, async (req, res) => {
  try {
    const { type, start_date, end_date, reason } = req.body;
   
    if (!type || !start_date || !end_date) {
      const [rows] = await pool.execute('SELECT type, balance FROM leave_balances WHERE user_id = ?', [req.user.id]);
      const balances = rows.reduce((acc, r) => { acc[r.type] = Number(r.balance); return acc; }, {});
      return res.render('leave/new', { user: req.user, error: 'Please fill all required fields', balances });
    }

    const start = new Date(start_date);
    const end = new Date(end_date);
    if (end < start) {
      const [rows] = await pool.execute('SELECT type, balance FROM leave_balances WHERE user_id = ?', [req.user.id]);
      const balances = rows.reduce((acc, r) => { acc[r.type] = Number(r.balance); return acc; }, {});
      return res.render('leave/new', { user: req.user, error: 'End date must be the same or after start date', balances });
    }

    
    const msPerDay = 24 * 60 * 60 * 1000;
    const days = Math.round((end - start) / msPerDay) + 1;
    const [balRows] = await pool.execute('SELECT * FROM leave_balances WHERE user_id = ? AND type = ?', [req.user.id, type]);
    const bal = balRows[0];
    if (!bal || Number(bal.balance) < days) {
      const [rows] = await pool.execute('SELECT type, balance FROM leave_balances WHERE user_id = ?', [req.user.id]);
      const balances = rows.reduce((acc, r) => { acc[r.type] = Number(r.balance); return acc; }, {});
      return res.render('leave/new', { user: req.user, error: 'Insufficient leave balance for selected type/dates', balances });
    }

    await createLeave({ user_id: req.user.id, type, start_date, end_date, reason });
    res.redirect('/leave');
  } catch (err) {
    console.error(err);
    res.render('leave/new', { user: req.user, error: 'Could not create leave' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    let leaves;
    if (req.user.role === 'manager') {
      leaves = await findAllWithUser();
    } else {
      leaves = await findByUser(req.user.id);
    }

    res.render('leave/index', { leaves, user: req.user, message: req.query.message || null, error: req.query.error || null });
  } catch (err) {
    console.error(err);
    res.render('leave/index', { leaves: [], user: req.user, message: null, error: 'Failed to load leaves' });
  }
});

router.post('/:id/approve', requireManager, async (req, res) => {
  const { id } = req.params;
  try {
    await approveLeave(id, req.body.comment || null);
    res.redirect('/leave?message=Leave+approved');
  } catch (err) {
    console.error('Approve error:', err.message);
    if (err.message === 'INSUFFICIENT_BALANCE') return res.redirect('/leave?error=Insufficient+balance+to+approve');
    res.redirect('/leave?error=Could+not+approve');
  }
});

router.post('/:id/reject', requireManager, async (req, res) => {
  const { id } = req.params;
  try {
    await rejectLeave(id, req.body.comment || null);
    res.redirect('/leave?message=Leave+rejected');
  } catch (err) {
    console.error('Reject error:', err.message);
    res.redirect('/leave?error=Could+not+reject');
  }
});


router.get('/calendar', requireAuth, async (req, res) => {
  try {
    // Employees see only their own data, managers see all
    const user_id = req.user.role === 'employee' ? req.user.id : null;
    const events = await getApprovedLeaves(user_id);
    res.render('calendar', { events, user: req.user });
  } catch (err) {
    console.error('Calendar error:', err.message);
    res.render('calendar', { events: [], user: req.user, error: 'Could not load calendar' });
  }
});

module.exports = router;
