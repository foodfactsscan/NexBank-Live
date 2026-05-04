import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/queryClient';
import { useAuth } from '@/store/auth';
import { Card } from '@/components/primitives/Card';
import { Stat } from '@/components/primitives/Stat';
import { Skeleton } from '@/components/primitives/Skeleton';
import { Button } from '@/components/primitives/Button';
import { EmptyState } from '@/components/primitives/EmptyState';
import { TrendLine } from '@/components/charts/TrendLine';
import { CategoryDonut } from '@/components/charts/CategoryDonut';
import { Sparkline } from '@/components/charts/Sparkline';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { formatINR, maskAccount, relativeTime } from '@/lib/format';
import {
  SendIcon, ReceiptIcon, ChartIcon, TargetIcon, TrendUpIcon, TrendDownIcon,
  HistoryIcon, GiftIcon,
} from '@/icons/Icon';
import { useRealtime } from '@/lib/ws';
import { useQueryClient } from '@tanstack/react-query';

export function Dashboard() {
  const user = useAuth(s => s.user);
  const accounts = useAuth(s => s.accounts);
  const primary = accounts[0];
  const qc = useQueryClient();

  const summary = useQuery({
    queryKey: qk.summary(primary?._id || ''),
    enabled: !!primary,
    queryFn: () => api.get<{ summary: any }>(`/accounts/${primary!._id}/summary`),
  });

  const txns = useQuery({
    queryKey: qk.transactions,
    queryFn: () => api.get<{ transactions: any[] }>('/transactions?limit=5'),
  });

  // Push live debit/credit balance into the auth store the moment the
  // backend broadcasts it. (Realtime hook safely no-ops if accountId is
  // missing — e.g. while the very first /me request is in flight.)
  useRealtime(primary?._id, 'transaction', () => {
    qc.invalidateQueries({ queryKey: qk.summary(primary!._id) });
    qc.invalidateQueries({ queryKey: qk.transactions });
    qc.invalidateQueries({ queryKey: qk.accounts });
  });

  const monthly = summary.data?.summary?.monthlyData || [];
  const categories = summary.data?.summary?.categoryBreakdown || {};
  const sparkSeries = monthly.map((m: any) => (m.credit - m.debit) || 0);

  return (
    <div className="stack-5">
      {/* Hero balance card */}
      <Card variant="gradient">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ opacity: 0.85, fontSize: 13, fontWeight: 500 }}>Available balance</div>
            <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 8 }}>
              {primary ? <AnimatedNumber value={primary.balance} format={(n) => formatINR(n)} /> : '—'}
            </div>
            <div style={{ opacity: 0.85, fontSize: 13, marginTop: 6 }}>
              {primary ? `${maskAccount(primary.accountNumber)} · ${primary.ifscCode}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ opacity: 0.85, fontSize: 12 }}>Hi, {user?.firstName}</div>
            <div style={{ marginTop: 6, fontSize: 11, opacity: 0.75 }}>{primary?.accountType?.toUpperCase()}</div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/transfer" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="sm" iconLeft={<SendIcon size={16} />}>Send</Button>
          </Link>
          <Link to="/request" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="sm" iconLeft={<TrendDownIcon size={16} />}>Request</Button>
          </Link>
          <Link to="/bills" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="sm" iconLeft={<ReceiptIcon size={16} />}>Pay bills</Button>
          </Link>
          <Link to="/goals" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="sm" iconLeft={<TargetIcon size={16} />}>Save</Button>
          </Link>
        </div>
      </Card>

      {/* Stats row */}
      <div className="grid-3">
        <Stat
          label="This month income"
          value={summary.isLoading ? <Skeleton width="60%" height={28} /> : formatINR(summary.data?.summary?.monthlyIncome || 0)}
          icon={<TrendUpIcon size={18} />}
        />
        <Stat
          label="This month expense"
          value={summary.isLoading ? <Skeleton width="60%" height={28} /> : formatINR(summary.data?.summary?.monthlyExpense || 0)}
          icon={<TrendDownIcon size={18} />}
        />
        <Stat
          label="Net savings"
          value={summary.isLoading ? <Skeleton width="60%" height={28} /> : formatINR(summary.data?.summary?.netSavings || 0)}
          trend={summary.data?.summary?.monthlyIncome
            ? ((summary.data.summary.netSavings / summary.data.summary.monthlyIncome) * 100)
            : undefined}
          icon={<ChartIcon size={18} />}
        />
      </div>

      {/* Insights row */}
      <div className="grid-2" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <Card>
          <div className="row-sb" style={{ marginBottom: 12 }}>
            <h3 className="h3">Cashflow — last 6 months</h3>
            <Link to="/insights" style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none' }}>See all</Link>
          </div>
          {summary.isLoading
            ? <Skeleton height={240} />
            : monthly.length
              ? <TrendLine data={monthly} />
              : <EmptyState icon={<ChartIcon />} title="No activity yet" description="As you send and receive, your trend will appear here." />
          }
        </Card>

        <Card>
          <div className="row-sb" style={{ marginBottom: 12 }}>
            <h3 className="h3">Spending by category</h3>
          </div>
          {summary.isLoading
            ? <Skeleton height={220} />
            : <CategoryDonut data={categories} />}
        </Card>
      </div>

      {/* Linked accounts strip */}
      {accounts.length > 0 && (
        <Card>
          <div className="row-sb" style={{ marginBottom: 12 }}>
            <h3 className="h3">Your accounts</h3>
            <Link to="/accounts" style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none' }}>Manage</Link>
          </div>
          <div className="grid-2">
            {accounts.map(a => (
              <div key={a._id} style={{
                padding: 16, background: 'var(--bg-2)',
                borderRadius: 'var(--r-md)', border: '1px solid var(--line)',
              }}>
                <div className="row-sb">
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{a.accountType.toUpperCase()}</span>
                  <span className="chip chip-success" style={{ fontSize: 10 }}>{a.status}</span>
                </div>
                <div style={{ fontWeight: 700, marginTop: 8, fontSize: 18 }}>{formatINR(a.balance)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{maskAccount(a.accountNumber)}</div>
                <div style={{ marginTop: 8 }}>
                  <Sparkline data={sparkSeries.length > 1 ? sparkSeries : [0, 0]} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent activity */}
      <Card>
        <div className="row-sb" style={{ marginBottom: 12 }}>
          <h3 className="h3">Recent activity</h3>
          <Link to="/transactions" style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none' }}>View all</Link>
        </div>
        {txns.isLoading ? (
          <div className="stack-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={56} />)}
          </div>
        ) : !txns.data?.transactions?.length ? (
          <EmptyState icon={<HistoryIcon />} title="No transactions yet" description="Your activity will appear here." />
        ) : (
          <div className="stack-3">
            {txns.data.transactions.slice(0, 5).map((t: any) => {
              const isCredit = t.toAccountId === primary?._id;
              return (
                <div key={t._id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                  background: 'var(--bg-2)', borderRadius: 'var(--r-md)',
                  border: '1px solid var(--line)',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: isCredit ? 'var(--success-soft)' : 'var(--bg-3)',
                    color: isCredit ? 'var(--success)' : 'var(--text-2)',
                    display: 'grid', placeItems: 'center',
                  }}>
                    {isCredit ? <TrendUpIcon size={18} /> : <SendIcon size={18} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isCredit ? t.fromAccountHolderName : t.toAccountHolderName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {t.mode || 'Transfer'} · {relativeTime(t.createdAt)}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: isCredit ? 'var(--success)' : 'var(--text-1)' }}>
                    {isCredit ? '+' : '-'} {formatINR(t.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(6,182,212,0.18))', border: '1px solid var(--line-strong)' }}>
        <div className="row-sb">
          <div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <GiftIcon size={20} />
              <h3 className="h3" style={{ margin: 0 }}>Earn while you bank</h3>
            </div>
            <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
              0.5% cashback on transfers ≥ ₹10,000 · 1% on bills · Refer friends to multiply rewards.
            </p>
          </div>
          <Link to="/rewards"><Button variant="outline" size="sm">Open rewards</Button></Link>
        </div>
      </Card>
    </div>
  );
}
