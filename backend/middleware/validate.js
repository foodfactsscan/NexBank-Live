'use strict';
const { validationResult } = require('express-validator');

// Returns a middleware that runs the supplied express-validator chains then
// short-circuits with a 422 if any failed. Keeps route handlers focused on
// happy-path logic.
function validate(chains) {
  const list = Array.isArray(chains) ? chains : [chains];
  return async (req, res, next) => {
    for (const chain of list) {
      // eslint-disable-next-line no-await-in-loop
      await chain.run(req);
    }
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    res.status(422).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  };
}

module.exports = validate;
