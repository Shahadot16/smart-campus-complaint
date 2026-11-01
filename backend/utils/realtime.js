/**
 * Thin wrapper around the Socket.IO server so services can emit events without
 * depending on how the server is started. Every emit is a no-op until init()
 * runs (e.g. in tests), so business logic never depends on websockets.
 *
 * Rooms: user:<id> (personal), role:<role>, complaint:<id> (people viewing it).
 */
let io = null;
const online = new Map(); // userId -> number of open sockets

function init(server) {
  io = server;
}

const idOf = (v) => String(v?._id || v);

function toUsers(userIds, event, payload) {
  if (!io) return;
  for (const id of new Set(userIds.filter(Boolean).map(idOf))) io.to(`user:${id}`).emit(event, payload);
}

function toRole(role, event, payload) {
  if (io) io.to(`role:${role}`).emit(event, payload);
}

function toComplaint(complaintId, event, payload) {
  if (io) io.to(`complaint:${idOf(complaintId)}`).emit(event, payload);
}

function setOnline(userId, delta) {
  const id = idOf(userId);
  const next = (online.get(id) || 0) + delta;
  if (next > 0) online.set(id, next);
  else online.delete(id);
  return next > 0;
}

const onlineUserIds = () => [...online.keys()];
const isOnline = (userId) => online.has(idOf(userId));

module.exports = { init, toUsers, toRole, toComplaint, setOnline, onlineUserIds, isOnline };
