import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Skeleton } from '@/components/primitives/Skeleton';
import { EmptyState } from '@/components/primitives/EmptyState';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queryClient';
import { fmtDate } from '@/lib/format';
import { toast } from '@/store/ui';
import { UserIcon, LogoutIcon } from '@/icons/Icon';

export function Devices() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: qk.devices,
    queryFn: () => api.get<{ devices: any[] }>('/devices'),
  });

  async function revoke(id: string) {
    try {
      await api.del(`/devices/${id}`);
      qc.invalidateQueries({ queryKey: qk.devices });
    } catch (err) { toast.error('Could not revoke', err instanceof ApiError ? err.message : ''); }
  }
  async function revokeAll() {
    if (!confirm('Sign out of all sessions? You will need to log in again.')) return;
    try {
      await api.post('/devices/revoke-all');
      window.location.href = '/login';
    } catch (err) { toast.error('Could not revoke', err instanceof ApiError ? err.message : ''); }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }} className="stack-5">
      <div className="row-sb">
        <div>
          <h2 className="h2">Active sessions</h2>
          <p className="muted" style={{ marginTop: 4 }}>One refresh token = one signed-in device.</p>
        </div>
        <Button variant="danger" iconLeft={<LogoutIcon size={14} />} onClick={revokeAll}>Sign out everywhere</Button>
      </div>

      {list.isLoading ? (
        <Card><div className="stack-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={64} />)}</div></Card>
      ) : !list.data?.devices?.length ? (
        <Card><EmptyState icon={<UserIcon />} title="No active sessions" /></Card>
      ) : (
        <Card>
          <div className="stack-3">
            {list.data.devices.map((d: any) => (
              <div key={d.id} className="row-sb" style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{d.label || 'web'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {(d.userAgent || '').slice(0, 80)}{d.userAgent && d.userAgent.length > 80 ? '…' : ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Last used {fmtDate(d.lastUsedAt, { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => revoke(d.id)}>Revoke</Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
