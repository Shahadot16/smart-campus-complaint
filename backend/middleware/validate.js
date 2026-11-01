const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/** Runs express-validator chains and returns a 400 with field errors. */
const validate = (chains) => [
  ...chains,
  (req, _res, next) => {
    const result = validationResult(req);
    if (result.isEmpty()) return next();
    const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
    next(ApiError.badRequest(errors[0].message, errors));
  },
];

module.exports = validate;
