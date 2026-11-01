const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { User, Session } = require('../models');
const ApiError = require('../utils/ApiError');

function readToken(req) {
  const cookieToken = req.cookies?.[config.cookieName];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/**
 * Resolves an access token to an active user and session. Shared by the HTTP
 * middleware and the Socket.IO handshake.
 */
async function authenticateToken(token) {
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === 'TokenExpiredError' ? 'Access token expired' : 'Session expired or invalid. Please log in again.'
    );
  }

  // A signed-out device must lose access immediately, even before its token expires.
  if (payload.sid) {
    const session = await Session.exists({ _id: payload.sid, revokedAt: null });
    if (!session) throw ApiError.unauthorized('This session has been signed out. Please log in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('Account not found or deactivated');
  return { user, sessionId: payload.sid || null };
}

/**
 * Authenticates the request from the HttpOnly cookie (or a Bearer token for
 * API clients such as Postman). The user is re-loaded on every request so
 * deactivated accounts and role changes take effect immediately.
 */
async function auth(req, _res, next) {
  const { user, sessionId } = await authenticateToken(readToken(req));
  req.user = user;
  req.sessionId = sessionId;
  next();
}

module.exports = auth;
module.exports.authenticateToken = authenticateToken;
