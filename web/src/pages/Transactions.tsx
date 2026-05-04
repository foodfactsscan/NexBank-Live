import { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Card } from '@/components/primitives/Card';
import { Input } from '@/components/primitives/Input';
import { Button } from '@/components/primitives/Button';
import { Skeleton } from '@/components/primitives/Skeleton';
import { EmptyState } from '@/components/primitives/EmptyState';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { formatINR, fmtDate } from '@/lib/format';
import { SearchIcon, FilterIcon, HistoryIcon, TrendUpIcon, SendIcon } from '@/icons/Icon';

export function Transactions() {
  const accounts = useAuth(s => s.accounts);
  const primaryId = accounts[0]?._id;

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');

  const query = useInfiniteQuery({
    queryKey: ['transactions-paged'],
    initialPageParam: null as string | null,
    getNextPageParam: (last: any) => last.nextCursor || undefined,
    queryFn: async ({ pageParam }) => {
      const url = `/transactions?limit=30${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`;
      return api.get<{ transactions: any[]; nextCursor: string | null }>(url);
    },
  });

  const all = useMemo(() => query.data?.pages.flatMap(p => p.transactions) ?? [], [query.data]);

  const filtered = useMemo(() => {
    return all.filter(t => {
      if (filter !== 'all') {
        const isCredit = t.toAccountId === primaryId;
        if (filter === 'credit' && !isCredit) return false;
        if (filter === 'debit' && isCredit) return false;
      }
      if (!q) return true;
      const lc = q.toLowerCase();
      return [t.fromAccountHolderName, t.toAccountHolderName, t.description, t.transactionId, t.mode, t.category]
        .some((x: string) => (x || '').toLowerCase().includes(lc));
    });
  }, [all, q, filter, primaryId]);

  return (
    <div className="stack-4">
      <Card>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Input placeholder="Search transactions" value={q} onChange={(e) => setQ(e.target.value)} iconLeft={<SearchIcon size={16} />} />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: 4, background: 'var(--bg-2)', borderRadius: 12 }}>
            {(['all', 'credit', 'debit'] as const).map(k => (
              <button key={k} onClick={() => setFilter(k)} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: filter === k ? 'var(--bg-1)' : 'transparent',
                color: filter === k ? 'var(--text-1)' : 'var(--text-3)',
                border: 'none', cursor: 'pointer',
              }}>
                {k === 'all' ? <span><FilterIcon size={14} /> All</span> : k}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {query.isLoading ? (
        <Card><div className="stack-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={56} />)}</div></Card>
      ) : !filtered.length ? (
        <Card><EmptyState icon={<HistoryIcon />} title="No transactions" description={q ? 'No match for your search.' : 'Your activity will appear here.'} /></Card>
      ) : (
        <Card>
          <div className="stack-3">
            {filtered.map((t: any) => {
              const isCredit = t.toAccountId === primaryId;
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
                      {t.category || t.mode} · {fmtDate(t.createdAt, { day: '2-digit', month: 'short', year: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: isCredit ? 'var(--success)' : 'var(--text-1)' }}>
                      {isCredit ? '+' : '-'} {formatINR(t.amount)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{t.transactionId}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {query.hasNextPage && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Button variant="secondary" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Load more</Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
