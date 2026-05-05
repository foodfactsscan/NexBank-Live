import { ReactNode } from 'react';

interface Props { children: ReactNode }

export function AuthShell({ children }: Props) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      background: 'var(--bg-0)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        background: 'var(--grad-mesh)',
        opacity: 0.85,
      }} />

      <aside
        style={{
          position: 'relative', zIndex: 1,
          padding: 'var(--s-7)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          color: '#fff',
        }}
        className="auth-hero-side"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--grad-brand)',
            display: 'grid', placeItems: 'center',
            fontWeight: 800, fontSize: 22, letterSpacing: '-0.04em',
          }}>N</div>
          <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>NexBank</div>
        </div>

        <div>
          <h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em', margin: 0 }}>
            Banking that keeps up with you.
          </h1>
          <p style={{ marginTop: 16, color: 'var(--text-2)', fontSize: 16, maxWidth: 460, lineHeight: 1.55 }}>
            Instant transfers, savings goals that actually work, virtual cards
            you can freeze on a tap, and insights that help you spend smarter.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: 12 }}>
          <span>🔒</span><span>256-bit AES encryption · Atomic ledger · 2FA-ready</span>
        </div>
      </aside>

      <div style={{
        position: 'relative', zIndex: 1,
        display: 'grid', placeItems: 'center', padding: 'var(--s-5)',
      }}>
        <div style={{
          width: '100%', maxWidth: 440,
          background: 'rgba(17, 23, 42, 0.65)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-xl)',
          padding: 'var(--s-6)',
          backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          boxShadow: 'var(--shadow-2)',
        }}>
          {children}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .auth-hero-side { display: none; }
          [data-auth-grid] { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
