const { Server } = require('socket.io');
const config = require('../config/env');
const { authenticateToken } = require('../middleware/auth');
const { canAccessComplaint } = require('../utils/access');
const { Complaint } = require('../models');
const realtime = require('../utils/realtime');

/** Minimal cookie header parser (only the auth cookie is needed). */
function readCookie(header = '', name) {
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/**
 * Starts Socket.IO on the HTTP server. Sockets authenticate with the same
 * HttpOnly access cookie as the REST API.
 */
function initSockets(httpServer) {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: config.clientOrigins, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, config.cookieName) || socket.handshake.auth?.token;
      const { user } = await authenticateToken(token);
      socket.user = user;
      next();
    } catch (err) {
      next(new Error(err.message || 'Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    const uid = String(user._id);
    socket.join(`user:${uid}`);
    socket.join(`role:${user.role}`);

    if (realtime.setOnline(uid, 1)) realtime.toRole('admin', 'presence:update', { userId: uid, online: true });

    // Viewing a complaint: join its room after an access check.
    socket.on('complaint:join', async (complaintId, ack) => {
      try {
        const complaint = await Complaint.findById(complaintId).select('student assignedStaff');
        if (!complaint || !canAccessComplaint(user, complaint)) throw new Error('Not allowed');
        socket.join(`complaint:${complaintId}`);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });

    socket.on('complaint:leave', (complaintId) => socket.leave(`complaint:${complaintId}`));

    // Typing indicator, only relayed to rooms the socket has joined.
    socket.on('chat:typing', ({ complaintId, typing } = {}) => {
      const room = `complaint:${complaintId}`;
      if (!socket.rooms.has(room)) return;
      socket.to(room).emit('chat:typing', { complaintId, userId: uid, name: user.name, typing: Boolean(typing) });
    });

    socket.on('disconnect', () => {
      if (!realtime.setOnline(uid, -1)) realtime.toRole('admin', 'presence:update', { userId: uid, online: false });
    });
  });

  realtime.init(io);
  return io;
}

module.exports = initSockets;
