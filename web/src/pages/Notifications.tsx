import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/primitives/Card';
import { Skeleton } from '@/components/primitives/Skeleton';
import { Button } from '@/components/primitives/Button';
import { EmptyState } from '@/components/primitives/EmptyState';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryClient';
import { relativeTime } from '@/lib/format';
import { BellIcon } from '@/icons/Icon';

export function Notifications() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: qk.notifications,
    queryFn: () => api.get<{ notifications: any[]; unreadCount: number }>('/notifications?limit=50'),
  });

  async function markAll() {
    await api.put('/notifications/read-all/mark');
    qc.invalidateQueries({ queryKey: qk.notifications });
  }

  return (
    <div className="stack-5">
      <div className="row-sb">
        <div>
          <h2 className="h2">Notifications</h2>
          <p className="muted" style={{ marginTop: 4 }}>{list.data?.unreadCount || 0} unread</p>
        </div>
        <Button variant="secondary" onClick={markAll}>Mark all read</Button>
      </div>

      {list.isLoading ? (
        <Card><div className="stack-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={56} />)}</div></Card>
      ) : !list.data?.notifications?.length ? (
        <Card><EmptyState icon={<BellIcon />} title="All caught up" description="You'll see transactions, security and system alerts here." /></Card>
      ) : (
        <Card>
          <div className="stack-3">
            {list.data.notifications.map((n: any) => (
              <div key={n._id} style={{
                padding: 14, background: 'var(--bg-2)',
                borderRadius: 12,
                border: `1px solid ${n.read ? 'var(--line)' : 'var(--accent)'}`,
              }}>
                <div className="row-sb">
                  <div style={{ fontWeight: 700 }}>{n.title}</div>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{relativeTime(n.createdAt)}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 14, color: 'var(--text-2)' }}>{n.message}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
