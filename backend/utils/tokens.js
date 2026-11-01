const crypto = require('crypto');

/** Cryptographically random URL-safe token. */
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

/** Tokens are stored as SHA-256 hashes so a database leak cannot be replayed. */
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

module.exports = { randomToken, hashToken };
