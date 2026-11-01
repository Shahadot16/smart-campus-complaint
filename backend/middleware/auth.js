const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');

function readToken(req) {
  const cookieToken = req.cookies?.[config.cookieName];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/**
 * Authenticates the request from the HttpOnly cookie (or a Bearer token for
 * API clients such as Postman). The user is re-loaded on every request so
 * deactivated accounts and role changes take effect immediately.
 */
async function auth(req, _res, next) {
  const token = readToken(req);
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Session expired or invalid. Please log in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('Account not found or deactivated');

  req.user = user;
  next();
}

module.exports = auth;
