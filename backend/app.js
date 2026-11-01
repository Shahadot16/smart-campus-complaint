const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const config = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1); // correct client IPs behind Render/Vercel proxies
app.disable('x-powered-by');

// Attachments are auth-protected, so the frontend may load them cross-origin.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin/non-browser requests and the configured frontend origins only.
      if (!origin || config.clientOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());
if (!config.isTest) app.use(morgan(config.isProduction ? 'combined' : 'dev'));

app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    skip: () => config.isTest,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down.' },
  })
);

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Smart Campus Complaint API is running',
    data: { db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', time: new Date().toISOString() },
  });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/complaints', require('./routes/complaintRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/staff', require('./routes/staffRoutes'));
app.use('/api', require('./routes/operationsRoutes'));
app.use('/api', require('./routes/commonRoutes'));

app.use('/api', notFound);

// Optionally serve the built React app from the same server (single deployment).
const clientDist = path.join(__dirname, '..', 'frontend', 'dist');
if (config.isProduction && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
