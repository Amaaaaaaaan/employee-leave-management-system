const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { findByUsername, createUser } = require('../models/user');
const pool = require('../config/db');

router.get('/login', (req, res) => res.render('login', { error: null }));
router.get('/register', (req, res) => res.render('register', { error: null }));

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await findByUsername(username);
    if (!user) return res.render('login', { error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.render('login', { error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET || 'change_me_jwt', { expiresIn: '8h' });
    res.cookie('token', token, { httpOnly: true });
    return res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    return res.render('login', { error: 'Login error' });
  }
});


router.post('/register', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.render('register', { error: 'Please provide username and password' });

  try {
    const id = await createUser(username, password, role || 'employee');
  
    try {
      await pool.execute(`INSERT INTO leave_balances (user_id, type, balance) VALUES (?,?,?) ON DUPLICATE KEY UPDATE balance = VALUES(balance)`, [id, 'vacation', 20]);
      await pool.execute(`INSERT INTO leave_balances (user_id, type, balance) VALUES (?,?,?) ON DUPLICATE KEY UPDATE balance = VALUES(balance)`, [id, 'sick', 10]);
    } catch (e) {
      
      console.warn('Failed to init balances:', e.message || e);
    }

    
    const token = jwt.sign({ id, username, role: role || 'employee' }, process.env.JWT_SECRET || 'change_me_jwt', { expiresIn: '8h' });
    res.cookie('token', token, { httpOnly: true });
    return res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    if (err && err.code === 'ER_DUP_ENTRY') return res.render('register', { error: 'User already exists' });
    return res.render('register', { error: 'Registration failed' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.redirect('/login');
});

module.exports = router;
