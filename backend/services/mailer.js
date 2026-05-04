'use strict';

// Stub mailer — logs to console in dev, ready to be wired to SMTP/SendGrid by
// swapping the `send` implementation. We never block the user-facing flow on
// mail delivery; the caller awaits this only to surface hard errors.

const provider = (process.env.MAIL_PROVIDER || 'console').toLowerCase();

async function sendConsole({ to, subject, text }) {
  console.log(`[mailer:console] → ${to}\n  ${subject}\n  ${text}\n`);
  return { ok: true, channel: 'console' };
}

async function send({ to, subject, text, html }) {
  if (!to || !subject) throw new Error('mailer: to + subject required');
  if (provider === 'console') return sendConsole({ to, subject, text });
  // Future: hook SMTP / SendGrid / Resend here. We keep the surface area small
  // so the consumers don't need to change.
  throw new Error(`mailer: unknown provider ${provider}`);
}

module.exports = { send };
