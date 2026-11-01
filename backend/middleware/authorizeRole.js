const ApiError = require('../utils/ApiError');

/** Restricts a route to the given roles. Must run after `auth`. */
const authorizeRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Your role does not have access to this resource'));
    }
    next();
  };

module.exports = authorizeRole;
