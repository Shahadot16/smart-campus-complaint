const mongoose = require('mongoose');
const { Complaint } = require('../models');
const ApiError = require('./ApiError');

const idOf = (value) => (value && value._id ? value._id : value);

function sameId(a, b) {
  if (!a || !b) return false;
  return String(idOf(a)) === String(idOf(b));
}

function isOwner(user, complaint) {
  return sameId(complaint.student, user._id);
}

function isAssignedStaff(user, complaint) {
  return user.role === 'staff' && sameId(complaint.assignedStaff, user._id);
}

function isDepartmentHead(user, complaint) {
  return user.role === 'dept_head' && Boolean(user.department) && complaint.department === user.department;
}

/** Admins see everything, students only their own, staff their assignments, heads their department. */
function canAccessComplaint(user, complaint) {
  if (user.role === 'admin') return true;
  if (user.role === 'dept_head') return isDepartmentHead(user, complaint);
  if (user.role === 'student') return isOwner(user, complaint);
  if (user.role === 'staff') return isAssignedStaff(user, complaint);
  return false;
}

function assertObjectId(id, label = 'id') {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest(`Invalid ${label}`);
}

/** Loads a complaint and verifies the current user may access it. */
async function loadAccessibleComplaint(id, user) {
  assertObjectId(id, 'complaint id');
  const complaint = await Complaint.findById(id);
  if (!complaint) throw ApiError.notFound('Complaint not found');
  if (!canAccessComplaint(user, complaint)) {
    throw ApiError.forbidden('You are not allowed to access this complaint');
  }
  return complaint;
}

module.exports = { sameId, isOwner, isAssignedStaff, isDepartmentHead, canAccessComplaint, assertObjectId, loadAccessibleComplaint };
