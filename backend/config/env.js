const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const isProduction = process.env.NODE_ENV === 'production';

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction,
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'memory',
  jwtSecret: process.env.JWT_SECRET,
  // Short-lived access token + long-lived, rotating refresh token (stored server-side as a session).
  accessTokenTtl: process.env.JWT_ACCESS_TTL || '15m',
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 7,
  cookieName: 'scc_token',
  refreshCookieName: 'scc_refresh',
  maxFailedLogins: 5,
  lockMinutes: 15,
  cookieSameSite: process.env.COOKIE_SAMESITE || (isProduction ? 'none' : 'lax'),
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  uploadDir: path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'),
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB) || 5,
  maxFilesPerUpload: Number(process.env.MAX_FILES_PER_UPLOAD) || 5,
  maxAttachmentsPerComplaint: 10,
  // Public URL of the React app, used for links in emails.
  appUrl: process.env.APP_URL || (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim(),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  mailFrom: process.env.MAIL_FROM || 'IUBAT Smart Campus <no-reply@iubat.edu>',
};

if (!config.jwtSecret) {
  if (isProduction) {
    throw new Error('JWT_SECRET must be set in production');
  }
  config.jwtSecret = 'dev-only-insecure-secret-change-me';
}

module.exports = config;
