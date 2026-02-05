module.exports = {
  requireAuth: (req, res, next) => {
    if (req.user) return next();
    res.redirect('/login');
  },

  requireManager: (req, res, next) => {
    if (req.user && req.user.role === 'manager') return next();
    res.status(403).send('Forbidden');
  },
};
