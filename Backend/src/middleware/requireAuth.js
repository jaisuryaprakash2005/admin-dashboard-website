const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

/**
 * Protects a route. Expects: Authorization: Bearer <token>
 * On success sets req.userId, req.userEmail, req.tokenRole and calls next().
 */
module.exports = async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Missing token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'probridge_jwt_secret_dev_key_2026');
    req.userId = payload.sub;
    req.userEmail = payload.email ? payload.email.toLowerCase() : null;
    req.userName = payload.name || null;
    req.tokenRole = payload.role || null;

    // Fast-path for non-mutating /me route: let it pass so client gets their status
    if (req.path === '/me' || req.originalUrl?.endsWith('/me')) {
      return next();
    }

    // Check user account status in database if connected
    if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(req.userId)) {
      const User = mongoose.models.User || require('../models/User');
      const u = await User.findById(req.userId).select('status statusReason');
      if (u) {
        if (u.status === 'revoked') {
          return res.status(403).json({
            success: false,
            code: 'ACCOUNT_REVOKED',
            message: 'Your account has been permanently terminated (Revoked) by administration.',
          });
        }
        if (u.status === 'restricted' && req.method !== 'GET') {
          return res.status(403).json({
            success: false,
            code: 'ACCOUNT_RESTRICTED',
            message: `Your account is suspended/restricted. ${u.statusReason || ''}`.trim(),
          });
        }
      }
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    return next();
  }
};
