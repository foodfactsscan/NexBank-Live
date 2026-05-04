import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { Modal } from '@/components/primitives/Modal';
import { Skeleton } from '@/components/primitives/Skeleton';
import { EmptyState } from '@/components/primitives/EmptyState';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/queryClient';
import { toast } from '@/store/ui';
import { formatINR } from '@/lib/format';
import { ShieldIcon, PlusIcon } from '@/icons/Icon';

const TYPES = [
  { id: 'personal',  label: 'Personal',  rate: 12.5 },
  { id: 'home',      label: 'Home',      rate: 8.5 },
  { id: 'auto',      label: 'Auto',      rate: 9.5 },
  { id: 'education', label: 'Education', rate: 10.5 },
  { id: 'gold',      label: 'Gold',      rate: 7.5 },
];

export function Loans() {
  const qc = useQueryClient();
  const [applying, setApplying] = useState(false);
  const list = useQuery({
    queryKey: qk.loans,
    queryFn: () => api.get<{ loans: any[] }>('/users/loans'),
  });

  return (
    <div className="stack-5">
      <div className="row-sb">
        <div>
          <h2 className="h2">Loans</h2>
          <p className="muted" style={{ marginTop: 4 }}>Apply, track status, see EMI breakdown.</p>
        </div>
        <Button iconLeft={<PlusIcon size={16} />} onClick={() => setApplying(true)}>Apply</Button>
      </div>

      {list.isLoading ? (
        <div className="grid-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} height={120} />)}</div>
      ) : !list.data?.loans?.length ? (
        <Card><EmptyState icon={<ShieldIcon />} title="No loans yet"
          description="Apply for a personal, home, auto, education, or gold loan."
          action={<Button onClick={() => setApplying(true)} iconLeft={<PlusIcon size={16} />}>Apply now</Button>}
        /></Card>
      ) : (
        <div className="grid-2">
          {list.data.loans.map((l: any) => (
            <Card key={l._id}>
              <div className="row-sb">
                <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{l.loanType} loan</div>
                <span className={`chip chip-${l.status === 'approved' ? 'success' : l.status === 'rejected' ? 'danger' : 'warning'}`}>{l.status.replace('_', ' ')}</span>
              </div>
              <div style={{ marginTop: 14, fontSize: 24, fontWeight: 800 }}>{formatINR(l.amount)}</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {l.tenureMonths} months · EMI {formatINR(l.emi)} · {l.interestRate}%
              </div>
            </Card>
          ))}
        </div>
      )}

      <ApplyLoanModal open={applying} onClose={() => setApplying(false)} onApplied={() => qc.invalidateQueries({ queryKey: qk.loans })} />
    </div>
  );
}

function ApplyLoanModal({ open, onClose, onApplied }: { open: boolean; onClose: () => void; onApplied: () => void }) {
  const [type, setType] = useState(TYPES[0].id);
  const [amount, setAmount] = useState('');
  const [tenure, setTenure] = useState('24');
  const [income, setIncome] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/users/loans/apply', {
        loanType: type, amount: parseFloat(amount),
        tenureMonths: parseInt(tenure, 10), monthlyIncome: parseFloat(income || '0'),
      });
      toast.success('Application submitted', 'We’ll review it within 2–3 business days.');
      onApplied(); onClose();
      setAmount(''); setIncome('');
    } catch (err) { toast.error('Could not apply', err instanceof ApiError ? err.message : ''); }
    finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Apply for a loan">
      <form onSubmit={submit} className="stack-4">
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>Loan type</span>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{
            background: 'var(--bg-3)', color: 'var(--text-1)', border: '1px solid var(--line)',
            borderRadius: 12, padding: '12px 14px', fontSize: 14, height: 48,
          }}>
            {TYPES.map(t => <option key={t.id} value={t.id}>{t.label} · {t.rate}%</option>)}
          </select>
        </label>
        <Input label="Amount (₹)" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
        <Input label="Tenure (months)" inputMode="numeric" required value={tenure} onChange={(e) => setTenure(e.target.value.replace(/\D/g, ''))} />
        <Input label="Monthly income (₹)" inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value.replace(/[^\d.]/g, ''))} />
        <Button type="submit" loading={busy} block>Submit application</Button>
      </form>
    </Modal>
  );
}
