import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/auth';

interface Props { children: ReactNode }

export function RequireAuth({ children }: Props) {
  const { hydrating, user } = useAuth(s => ({ hydrating: s.hydrating, user: s.user }));
  const loc = useLocation();
  if (hydrating) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-0)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'var(--grad-brand)',
            display: 'grid', placeItems: 'center',
            fontWeight: 800, fontSize: 24, color: '#fff', letterSpacing: '-0.04em',
          }}>N</div>
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Securing your session…</div>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return <>{children}</>;
}

export function RedirectIfAuthed({ children }: Props) {
  const { hydrating, user } = useAuth(s => ({ hydrating: s.hydrating, user: s.user }));
  if (hydrating) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
