const jwt = require('jsonwebtoken');

/**
 * Optional authentication:
 * If an Authorization header is provided, verifies it and sets req.userId.
 * If not provided or invalid, proceeds with req.userId = null.
 */
module.exports = function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    req.userId = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
  } catch {
    req.userId = null;
  }
  next();
};

