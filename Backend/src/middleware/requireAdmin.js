const requireAuth = require('./requireAuth');
const attachAdmin = require('./attachAdmin');

/** Protects a route so only users with role 'admin' can use it. */
module.exports = [
  requireAuth,
  attachAdmin,
  (req, res, next) => {
    if (!req.isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin access only' });
    }
    next();
  },
];
