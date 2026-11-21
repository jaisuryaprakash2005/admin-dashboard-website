const mongoose = require('mongoose');
const User = require('../models/User');
const { getIsConnected } = require('../config/db');

/**
 * Run AFTER requireAuth / optionalAuth. Sets req.isAdmin = true when the
 * signed-in user's role is 'admin' or 'superadmin'.
 * Sets req.isSuperAdmin = true when the role is 'superadmin'.
 */
module.exports = async function attachAdmin(req, res, next) {
  req.isAdmin = false;
  req.isSuperAdmin = false;

  const superEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@probridge.com').toLowerCase().trim();
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@probridge.com').toLowerCase().trim();

  // 1. Direct role check from token or known staff IDs/emails
  if (req.userEmail === superEmail || req.tokenRole === 'superadmin' || req.userId === 'superadmin_id') {
    req.isAdmin = true;
    req.isSuperAdmin = true;
    req.userRole = 'superadmin';
    return next();
  }
  if (req.userEmail === adminEmail || req.tokenRole === 'admin' || req.userId === 'admin_id' || req.userId === 'admin') {
    req.isAdmin = true;
    req.isSuperAdmin = false;
    req.userRole = 'admin';
    return next();
  }

  // 2. Database check for MongoDB users
  try {
    if (req.userId && getIsConnected() && mongoose.Types.ObjectId.isValid(req.userId)) {
      const u = await User.findById(req.userId).select('role email').lean();
      if (u) {
        const uEmail = (u.email || '').toLowerCase();
        req.userRole = u.role;
        req.isAdmin = u.role === 'admin' || u.role === 'superadmin' || uEmail === superEmail || uEmail === adminEmail;
        req.isSuperAdmin = u.role === 'superadmin' || uEmail === superEmail;
      }
    }
  } catch {
    // DB error
  }
  next();
};
