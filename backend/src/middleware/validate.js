const { validationResult } = require('express-validator');

module.exports = (validations) => async (req, res, next) => {
  await Promise.all(validations.map((v) => v.run(req)));
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  res.status(422).json({
    error: 'Validation failed',
    details: errors.array().map((e) => ({ field: e.path, message: e.msg }))
  });
};
