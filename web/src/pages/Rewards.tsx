import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/primitives/Card';
import { Skeleton } from '@/components/primitives/Skeleton';
import { Stat } from '@/components/primitives/Stat';
import { EmptyState } from '@/components/primitives/EmptyState';
import { Button } from '@/components/primitives/Button';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryClient';
import { toast } from '@/store/ui';
import { formatINR, relativeTime } from '@/lib/format';
import { GiftIcon, PercentIcon } from '@/icons/Icon';

export function Rewards() {
  const balance = useQuery({ queryKey: qk.rewards, queryFn: () => api.get<{ balance: number }>('/rewards/balance') });
  const history = useQuery({ queryKey: ['rewards-history'], queryFn: () => api.get<{ rewards: any[] }>('/rewards/history') });
  const code = useQuery({ queryKey: ['referral-code'], queryFn: () => api.get<{ code: string }>('/rewards/referral-code') });

  return (
    <div className="stack-5">
      <div className="grid-2">
        <Stat label="Rewards balance" icon={<GiftIcon size={18} />}
          value={balance.isLoading ? <Skeleton width="60%" height={28} /> : formatINR(balance.data?.balance || 0)} />
        <Stat label="Referral code" icon={<PercentIcon size={18} />}
          value={code.isLoading ? <Skeleton width="60%" height={28} /> : (code.data?.code || '—')}
          hint="Share to earn"
        />
      </div>

      <Card>
        <div className="row-sb">
          <div>
            <h3 className="h3">Refer a friend</h3>
            <p className="muted" style={{ marginTop: 4 }}>Share your code. They get ₹100, you get ₹100, when they make their first transfer.</p>
          </div>
          <Button onClick={() => {
            const c = code.data?.code;
            if (!c) return;
            navigator.clipboard?.writeText(c).then(() => toast.success('Copied'));
          }}>Copy code</Button>
        </div>
      </Card>

      <Card>
        <h3 className="h3" style={{ marginBottom: 12 }}>Activity</h3>
        {history.isLoading ? (
          <div className="stack-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={48} />)}</div>
        ) : !history.data?.rewards?.length ? (
          <EmptyState icon={<GiftIcon />} title="No rewards yet" description="Earn 0.5% on transfers ≥ ₹10k and 1% on bills." />
        ) : (
          <div className="stack-3">
            {history.data.rewards.map((r: any) => (
              <div key={r._id} className="row-sb" style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.description}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{relativeTime(r.createdAt)}</div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--success)' }}>+{formatINR(r.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
