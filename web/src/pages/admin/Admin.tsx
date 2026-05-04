import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Skeleton } from '@/components/primitives/Skeleton';
import { Stat } from '@/components/primitives/Stat';
import { useAuth } from '@/store/auth';
import { api, ApiError } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { toast } from '@/store/ui';
import { BankIcon, UserIcon, ChartIcon, ShieldIcon } from '@/icons/Icon';

export function Admin() {
  const user = useAuth(s => s.user);
  const qc = useQueryClient();
  if (user && user.role !== 'admin') return <Navigate to="/" replace />;

  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api.get<any>('/admin/stats') });
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api.get<{ users: any[] }>('/admin/users') });

  async function block(id: string) {
    try {
      await api.post(`/admin/users/${id}/block`);
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    } catch (err) { toast.error('Could not update', err instanceof ApiError ? err.message : ''); }
  }

  return (
    <div className="stack-5">
      <h2 className="h2">Admin console</h2>

      <div className="grid-4">
        <Stat label="Total balance"  value={stats.isLoading ? <Skeleton width="60%" height={28} /> : formatINR(stats.data?.totalBalance || 0)} icon={<BankIcon size={18} />} />
        <Stat label="Users"           value={stats.isLoading ? <Skeleton width="60%" height={28} /> : (stats.data?.totalUsers || 0)} icon={<UserIcon size={18} />} />
        <Stat label="Active loans"    value={stats.isLoading ? <Skeleton width="60%" height={28} /> : (stats.data?.activeLoans || 0)} icon={<ShieldIcon size={18} />} />
        <Stat label="Transactions"    value={stats.isLoading ? <Skeleton width="60%" height={28} /> : (stats.data?.totalTransactions || 0)} icon={<ChartIcon size={18} />} />
      </div>

      <Card>
        <h3 className="h3" style={{ marginBottom: 12 }}>Users</h3>
        {users.isLoading ? (
          <div className="stack-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={52} />)}</div>
        ) : (
          <div className="stack-3">
            {users.data?.users.map((u: any) => (
              <div key={u.id} className="row-sb" style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{u.email} · {u.accountNumber}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`chip chip-${u.status === 'active' ? 'success' : 'warning'}`}>{u.status}</span>
                  <span style={{ fontWeight: 700 }}>{formatINR(u.balance)}</span>
                  <Button size="sm" variant="secondary" onClick={() => block(u.id)}>{u.status === 'blocked' ? 'Unblock' : 'Block'}</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
