class ApiError extends Error {
  constructor(statusCode, message, errors) {
    super(message);
    this.statusCode = statusCode;
    if (errors) this.errors = errors;
  }

  static badRequest(msg = 'Invalid request', errors) {
    return new ApiError(400, msg, errors);
  }
  static unauthorized(msg = 'Authentication required') {
    return new ApiError(401, msg);
  }
  static paymentRequired(msg = 'This action requires a higher subscription plan') {
    return new ApiError(402, msg);
  }
  static forbidden(msg = 'You are not allowed to perform this action') {
    return new ApiError(403, msg);
  }
  static notFound(msg = 'Resource not found') {
    return new ApiError(404, msg);
  }
  static conflict(msg = 'Conflict') {
    return new ApiError(409, msg);
  }
}

module.exports = ApiError;
