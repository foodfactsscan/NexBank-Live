'use strict';
const crypto = require('crypto');

// Attaches a UUID per request and emits it on the response so any client error
// or log line can be cross-referenced with the server side.
module.exports = function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id = (typeof incoming === 'string' && /^[a-zA-Z0-9_\-]{8,128}$/.test(incoming))
    ? incoming
    : crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};
