import { Card } from '@/components/primitives/Card';
import { HelpIcon } from '@/icons/Icon';

const FAQ = [
  { q: 'How long does an IMPS / UPI transfer take?', a: 'Instant. NEFT/RTGS settle within minutes during banking hours.' },
  { q: 'Is my money safe?', a: 'Every transfer goes through an atomic database transaction with a server-side balance check, so debits and credits can never split.' },
  { q: 'Can I freeze my virtual card?', a: 'Yes — go to Cards and tap Freeze. You can unfreeze instantly.' },
  { q: 'What is the daily transfer limit?', a: 'IMPS up to ₹5L, UPI up to ₹1L, NEFT up to ₹10L, RTGS minimum ₹2L up to ₹1Cr.' },
  { q: 'How do I get the cashback?', a: '0.5 % on transfers over ₹10k and 1 % on bills lands in Rewards instantly.' },
];

export function Support() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }} className="stack-5">
      <Card>
        <h2 className="h2">We’re here to help</h2>
        <p className="muted" style={{ marginTop: 4 }}>Email <b>support@nexbank.local</b> · Live chat coming soon.</p>
      </Card>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <HelpIcon size={20} /><h3 className="h3">FAQs</h3>
        </div>
        <div className="stack-3">
          {FAQ.map(f => (
            <details key={f.q} style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{f.q}</summary>
              <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>{f.a}</p>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}
