import { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div style={{
      padding: 'var(--s-7)', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    }}>
      {icon && (
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(6,182,212,0.18))',
          display: 'grid', placeItems: 'center',
          color: 'var(--accent)',
        }}>
          {icon}
        </div>
      )}
      <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
      {description && <div style={{ color: 'var(--text-2)', maxWidth: 360 }}>{description}</div>}
      {action}
    </div>
  );
}
