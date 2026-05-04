import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/primitives/Card';
import { Input } from '@/components/primitives/Input';
import { Button } from '@/components/primitives/Button';
import { EmptyState } from '@/components/primitives/EmptyState';
import { useAuth } from '@/store/auth';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { toast } from '@/store/ui';
import { formatINR, relativeTime } from '@/lib/format';
import { qk } from '@/lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';
import { InboxIcon, SendIcon } from '@/icons/Icon';

export function RequestMoney() {
  const accounts = useAuth(s => s.accounts);
  const primary = accounts[0];
  const qc = useQueryClient();

  const [username, setUsername] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const list = useQuery({
    queryKey: qk.moneyRequests,
    queryFn: () => api.get<{ incoming: any[]; outgoing: any[] }>('/money-requests'),
    refetchInterval: 30_000,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!primary) return;
    setBusy(true);
    try {
      await api.post('/money-requests', {
        username: username.trim().toLowerCase(),
        amount: parseFloat(amount),
        fromAccountId: primary._id,
        note,
      });
      toast.success('Request sent', `Asked @${username} for ${formatINR(parseFloat(amount))}`);
      setUsername(''); setAmount(''); setNote('');
      qc.invalidateQueries({ queryKey: qk.moneyRequests });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Request failed';
      toast.error('Could not send request', msg);
    } finally { setBusy(false); }
  }

  async function pay(id: string) {
    if (!primary) return;
    try {
      await api.post(`/money-requests/${id}/pay`,
        { fromAccountId: primary._id },
        { idempotencyKey: newIdempotencyKey() });
      toast.success('Paid');
      qc.invalidateQueries({ queryKey: qk.moneyRequests });
      qc.invalidateQueries({ queryKey: qk.accounts });
      qc.invalidateQueries({ queryKey: qk.transactions });
    } catch (err) {
      toast.error('Payment failed', err instanceof ApiError ? err.message : 'Try again');
    }
  }
  async function decline(id: string) {
    try { await api.post(`/money-requests/${id}/decline`); qc.invalidateQueries({ queryKey: qk.moneyRequests }); }
    catch (err) { toast.error('Could not decline', err instanceof ApiError ? err.message : ''); }
  }
  async function cancel(id: string) {
    try { await api.post(`/money-requests/${id}/cancel`); qc.invalidateQueries({ queryKey: qk.moneyRequests }); }
    catch (err) { toast.error('Could not cancel', err instanceof ApiError ? err.message : ''); }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }} className="stack-5">
      <Card>
        <h3 className="h3" style={{ marginBottom: 12 }}>Request money</h3>
        <form onSubmit={submit} className="stack-4">
          <Input label="Username" placeholder="@friend" value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^a-z0-9_.]/gi, ''))} required />
          <Input label="Amount (₹)" inputMode="decimal" value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} required />
          <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" loading={busy} iconLeft={<SendIcon size={16} />}>Send request</Button>
        </form>
      </Card>

      <Card>
        <h3 className="h3" style={{ marginBottom: 12 }}>Incoming</h3>
        {!list.data?.incoming?.length ? (
          <EmptyState icon={<InboxIcon />} title="No requests" description="Money people ask you for shows up here." />
        ) : (
          <div className="stack-3">
            {list.data.incoming.map(r => (
              <div key={r._id} style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <div className="row-sb">
                  <div>
                    <div style={{ fontWeight: 600 }}>{formatINR(r.amount)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.note || 'No note'} · {relativeTime(r.createdAt)}</div>
                  </div>
                  {r.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" onClick={() => pay(r._id)}>Pay</Button>
                      <Button size="sm" variant="ghost" onClick={() => decline(r._id)}>Decline</Button>
                    </div>
                  ) : <span className="chip">{r.status}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="h3" style={{ marginBottom: 12 }}>You requested</h3>
        {!list.data?.outgoing?.length ? (
          <EmptyState icon={<SendIcon />} title="None yet" />
        ) : (
          <div className="stack-3">
            {list.data.outgoing.map(r => (
              <div key={r._id} style={{ padding: 14, background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--line)' }}>
                <div className="row-sb">
                  <div>
                    <div style={{ fontWeight: 600 }}>{formatINR(r.amount)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.note || 'No note'} · {relativeTime(r.createdAt)}</div>
                  </div>
                  {r.status === 'pending'
                    ? <Button size="sm" variant="ghost" onClick={() => cancel(r._id)}>Cancel</Button>
                    : <span className="chip">{r.status}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
