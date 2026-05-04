import { ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// Mobile bottom-sheet primitive. On desktop it falls back to a centered modal
// look, but keeps the same trigger semantics so the same component works
// everywhere.

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'var(--bg-overlay)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          role="dialog" aria-modal="true" aria-label={title}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: '100%', maxWidth: 520,
              background: 'var(--bg-1)',
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              boxShadow: 'var(--shadow-2)',
              padding: 24,
              paddingBottom: 'calc(24px + var(--safe-bottom))',
              maxHeight: '85vh', overflow: 'auto',
            }}
          >
            <div style={{ width: 36, height: 4, background: 'var(--line-strong)', borderRadius: 2, margin: '0 auto 16px' }} aria-hidden />
            {title && <h3 className="h3" style={{ marginBottom: 12 }}>{title}</h3>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
