'use strict';

let PDFDocument = null;
try { PDFDocument = require('pdfkit'); } catch { /* optional dep */ }

function fmtAmount(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Streams an account statement PDF to the supplied `stream`. Caller is
// responsible for setting the response Content-Type/Disposition and piping.
function streamStatement({ stream, account, user, transactions, fromDate, toDate }) {
  if (!PDFDocument) throw new Error('pdfkit not installed');

  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  doc.pipe(stream);

  // Header
  doc.fillColor('#0A0E1A').rect(0, 0, doc.page.width, 96).fill();
  doc.fillColor('#F8FAFC').fontSize(22).text('NexBank', 48, 36);
  doc.fontSize(10).fillColor('#94A3B8').text('Account Statement', 48, 64);

  doc.moveDown(2);
  doc.fillColor('#0A0E1A').fontSize(11);
  doc.text(`Account holder: ${user.firstName} ${user.lastName}`, 48, 120);
  doc.text(`Account number: ${account.accountNumber}`);
  doc.text(`IFSC: ${account.ifscCode || 'NEXB0001234'}`);
  doc.text(`Branch: ${account.branch || 'Digital Branch'}`);
  doc.text(`Period: ${fromDate.toLocaleDateString('en-IN')} – ${toDate.toLocaleDateString('en-IN')}`);
  doc.text(`Closing balance: ₹${fmtAmount(account.balance)}`);

  // Table header
  doc.moveDown(1.5);
  const tableTop = doc.y;
  const cols = [
    { label: 'Date', x: 48, w: 70 },
    { label: 'Description', x: 120, w: 220 },
    { label: 'Mode', x: 342, w: 50 },
    { label: 'Debit', x: 396, w: 70, align: 'right' },
    { label: 'Credit', x: 470, w: 70, align: 'right' }
  ];
  doc.fontSize(10).fillColor('#64748B');
  for (const c of cols) doc.text(c.label, c.x, tableTop, { width: c.w, align: c.align });
  doc.moveTo(48, tableTop + 14).lineTo(540, tableTop + 14).strokeColor('#E2E8F0').stroke();

  // Rows
  doc.fillColor('#0A0E1A');
  let y = tableTop + 22;
  for (const t of transactions) {
    if (y > 760) { doc.addPage(); y = 48; }
    const isCredit = t.toAccountId === account._id.toString();
    const date = new Date(t.createdAt).toLocaleDateString('en-IN');
    doc.text(date, 48, y, { width: 70 });
    doc.text(t.description || t.type, 120, y, { width: 220 });
    doc.text(t.mode || '-', 342, y, { width: 50 });
    doc.text(isCredit ? '' : fmtAmount(t.amount), 396, y, { width: 70, align: 'right' });
    doc.text(isCredit ? fmtAmount(t.amount) : '', 470, y, { width: 70, align: 'right' });
    y += 20;
  }

  doc.moveDown(2);
  doc.fontSize(8).fillColor('#94A3B8').text(
    'This is a computer-generated statement and does not require a signature. For queries, contact support@nexbank.local.',
    48, Math.max(y + 24, 760), { width: 500, align: 'center' }
  );

  doc.end();
}

module.exports = { streamStatement };
