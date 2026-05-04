import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { Modal } from '@/components/primitives/Modal';
import { EmptyState } from '@/components/primitives/EmptyState';
import { Skeleton } from '@/components/primitives/Skeleton';
import { useAuth } from '@/store/auth';
import { api, ApiError } from '@/lib/api';
import { toast, useUI } from '@/store/ui';
import { qk } from '@/lib/queryClient';
import { formatINR, fmtDate } from '@/lib/format';
import { ChartIcon, PlusIcon } from '@/icons/Icon';

export function Investments() {
  const qc = useQueryClient();
  const accounts = useAuth(s => s.accounts);
  const primary = accounts[0];
  const [creating, setCreating] = useState(false);
  const fireConfetti = useUI(s => s.fireConfetti);

  const list = useQuery({
    queryKey: qk.fds,
    queryFn: () => api.get<{ fixedDeposits: any[] }>('/accounts/fd/list'),
  });

  async function breakFD(id: string) {
    if (!confirm('Break this FD? A 1% penalty applies.')) return;
    try {
      await api.post(`/accounts/fd/${id}/break`);
      toast.success('FD closed');
      qc.invalidateQueries({ queryKey: qk.fds });
      qc.invalidateQueries({ queryKey: qk.accounts });
    } catch (err) { toast.error('Could not break FD', err instanceof ApiError ? err.message : ''); }
  }

  return (
    <div className="stack-5">
      <div className="row-sb">
        <div>
          <h2 className="h2">Investments</h2>
          <p className="muted" style={{ marginTop: 4 }}>Fixed Deposits with compound interest. Calculators coming.</p>
        </div>
        <Button iconLeft={<PlusIcon size={16} />} onClick={() => setCreating(true)}>Open FD</Button>
      </div>

      {list.isLoading ? (
        <div className="grid-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} height={140} />)}</div>
      ) : !list.data?.fixedDeposits?.length ? (
        <Card><EmptyState icon={<ChartIcon />} title="No deposits yet"
          description="Open a Fixed Deposit at 6.5% p.a."
          action={<Button onClick={() => setCreating(true)} iconLeft={<PlusIcon size={16} />}>Open your first FD</Button>}
        /></Card>
      ) : (
        <div className="grid-2">
          {list.data.fixedDeposits.map((fd: any) => (
            <Card key={fd._id}>
              <div className="row-sb">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{fd.fdNumber}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {fd.tenureMonths} months · {fd.interestRate}%
                  </div>
                </div>
                <span className={`chip chip-${fd.status === 'active' ? 'success' : 'warning'}`}>{fd.status}</span>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Principal</div>
                <div style={{ fontWeight: 700 }}>{formatINR(fd.principalAmount)}</div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8 }}>Maturity</div>
                <div style={{ fontWeight: 700, color: 'var(--success)' }}>{formatINR(fd.maturityAmount)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{fmtDate(fd.maturityDate)}</div>
              </div>
              {fd.status === 'active' && (
                <div style={{ marginTop: 12 }}>
                  <Button size="sm" variant="secondary" onClick={() => breakFD(fd._id)}>Break early (1% penalty)</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <CreateFDModal
        open={creating}
        onClose={() => setCreating(false)}
        accountId={primary?._id}
        onCreated={() => { qc.invalidateQueries({ queryKey: qk.fds }); qc.invalidateQueries({ queryKey: qk.accounts }); fireConfetti(); }}
      />
    </div>
  );
}

function CreateFDModal({ open, onClose, accountId, onCreated }: { open: boolean; onClose: () => void; accountId?: string; onCreated: () => void }) {
  const [amount, setAmount] = useState('');
  const [tenure, setTenure] = useState('12');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    setBusy(true);
    try {
      await api.post('/accounts/fd/create', { accountId, amount: parseFloat(amount), tenureMonths: parseInt(tenure, 10) });
      toast.success('FD opened');
      onCreated(); onClose(); setAmount('');
    } catch (err) { toast.error('Could not open FD', err instanceof ApiError ? err.message : ''); }
    finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Open Fixed Deposit">
      <form onSubmit={submit} className="stack-4">
        <Input label="Principal (₹)" inputMode="decimal" required value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} hint="Minimum ₹1,000" />
        <Input label="Tenure (months)" inputMode="numeric" required value={tenure}
          onChange={(e) => setTenure(e.target.value.replace(/\D/g, ''))} />
        <Button type="submit" loading={busy} block>Open FD at 6.5% p.a.</Button>
      </form>
    </Modal>
  );
}
