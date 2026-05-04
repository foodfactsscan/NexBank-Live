// Money + date formatting. INR-first, but currency is parameterized so a
// future multi-currency feature only needs to thread the right code through.

export function formatINR(n: number, opts: { fractionDigits?: number; sign?: boolean } = {}) {
  const { fractionDigits = 2, sign } = opts;
  const v = Math.abs(n);
  const s = v.toLocaleString('en-IN', {
    style: 'currency', currency: 'INR',
    minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits,
  });
  if (sign) return (n < 0 ? '-' : '+') + s.replace('₹', '₹ ').replace(/\s+/g, ' ');
  return s;
}

export function formatCompactINR(n: number) {
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n}`;
}

export function maskAccount(num: string, visible = 4) {
  if (!num) return '';
  const tail = num.slice(-visible);
  return `••• ${tail}`;
}

export function maskCard(num: string) {
  if (!num) return '';
  const tail = num.slice(-4);
  return `•••• •••• •••• ${tail}`;
}

export function relativeTime(input: string | Date) {
  const d = typeof input === 'string' ? new Date(input) : input;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function fmtDate(input: string | Date, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }) {
  const d = typeof input === 'string' ? new Date(input) : input;
  return d.toLocaleDateString('en-IN', opts);
}

export function initials(name: string) {
  return name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}
