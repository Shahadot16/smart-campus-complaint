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
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: 'scc_token',
  cookieSameSite: process.env.COOKIE_SAMESITE || (isProduction ? 'none' : 'lax'),
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  uploadDir: path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'),
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB) || 5,
  maxFilesPerUpload: Number(process.env.MAX_FILES_PER_UPLOAD) || 5,
  maxAttachmentsPerComplaint: 10,
};

if (!config.jwtSecret) {
  if (isProduction) {
    throw new Error('JWT_SECRET must be set in production');
  }
  config.jwtSecret = 'dev-only-insecure-secret-change-me';
}

module.exports = config;
