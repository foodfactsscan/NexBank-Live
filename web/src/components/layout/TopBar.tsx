import { useNavigate } from 'react-router-dom';
import { BellIcon, UserIcon } from '@/icons/Icon';
import { useAuth } from '@/store/auth';
import { initials } from '@/lib/format';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryClient';

interface Props { title: string }

export function TopBar({ title }: Props) {
  const user = useAuth(s => s.user);
  const nav = useNavigate();
  const notif = useQuery({
    queryKey: qk.notifications,
    queryFn: () => api.get<{ notifications: any[]; unreadCount: number }>('/notifications?limit=1'),
    refetchInterval: 60_000,
  });
  const unread = notif.data?.unreadCount || 0;

  return (
    <header style={{
      height: 'var(--topbar-h)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 var(--s-6)',
      borderBottom: '1px solid var(--line)',
      background: 'rgba(10, 14, 26, 0.6)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    }}>
      <div className="h2" style={{ fontSize: 20 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => nav('/notifications')}
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
          style={{
            position: 'relative',
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--bg-2)', border: '1px solid var(--line)',
            color: 'var(--text-1)', cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}
        >
          <BellIcon size={18} />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: 8, right: 8,
              minWidth: 16, height: 16, padding: '0 4px',
              background: 'var(--danger)', color: '#fff',
              fontSize: 10, fontWeight: 700,
              display: 'grid', placeItems: 'center', borderRadius: 10,
            }}>{unread > 9 ? '9+' : unread}</span>
          )}
        </button>
        <button
          onClick={() => nav('/profile')}
          aria-label="Profile"
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--grad-brand)', color: '#fff',
            fontWeight: 700, fontSize: 14, letterSpacing: '-0.04em',
            border: 'none', cursor: 'pointer',
          }}
        >
          {user ? initials(`${user.firstName} ${user.lastName}`) : <UserIcon size={18} />}
        </button>
      </div>
    </header>
  );
}
