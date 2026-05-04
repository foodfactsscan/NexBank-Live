import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '@/store/ui';

const accent = (k: string) => ({
  success: 'var(--success)', error: 'var(--danger)', warning: 'var(--warning)', info: 'var(--info)',
})[k] || 'var(--accent)';

const icon = (k: string) => ({
  success: '✓', error: '!', warning: '!', info: 'i',
})[k] || '•';

export function Toaster() {
  const toasts = useUI(s => s.toasts);
  const dismiss = useUI(s => s.dismissToast);
  return (
    <div
      style={{
        position: 'fixed', top: 16, right: 16, zIndex: 400,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence initial={false}>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 30, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 30, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            role="status"
            style={{ pointerEvents: 'auto', minWidth: 280, maxWidth: 380 }}
          >
            <div style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              background: 'var(--bg-1)',
              border: '1px solid var(--line-strong)',
              borderLeft: `3px solid ${accent(t.kind)}`,
              borderRadius: 'var(--r-md)', padding: 14,
              boxShadow: 'var(--shadow-2)',
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%',
                background: accent(t.kind), color: '#fff',
                display: 'grid', placeItems: 'center',
                fontWeight: 800, fontSize: 14, flexShrink: 0,
              }} aria-hidden>{icon(t.kind)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)' }}>{t.title}</div>
                {t.message && <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>{t.message}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 0, fontSize: 18 }}
              >×</button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
