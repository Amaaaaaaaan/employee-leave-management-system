require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 3000;


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use((req, res, next) => {
  const token = (req.cookies && req.cookies.token) || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'change_me_jwt');
    req.user = { id: payload.id, username: payload.username, role: payload.role };
  } catch (e) {
   
  }
  next();
});


app.use('/', require('./routes/auth'));
app.use('/leave', require('./routes/leave'));

app.get('/', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.redirect('/login');
});

const { findPending } = require('./models/leave');

app.get('/dashboard', async (req, res) => {
  if (!req.user) return res.redirect('/login');

  if (req.user.role === 'manager') {
    try {
      const pending = await findPending();
      return res.render('manager-dashboard', { user: req.user, pending, pendingCount: pending.length });
    } catch (err) {
      console.error('Failed to load manager dashboard:', err);
      return res.render('dashboard', { user: req.user });
    }
  }

  try {
    const pool = require('./config/db');
    const [rows] = await pool.execute('SELECT type, balance FROM leave_balances WHERE user_id = ?', [req.user.id]);
    const balances = rows.reduce((acc, r) => { acc[r.type] = Number(r.balance); return acc; }, {});
    return res.render('dashboard', { user: req.user, balances });
  } catch (err) {
    console.error('Failed to load balances:', err);
    return res.render('dashboard', { user: req.user });
  }
});


if (require.main === module) {
  
  app.listen(process.env.PORT || 3000);
}

module.exports = app;