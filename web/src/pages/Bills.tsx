import { useState } from 'react';
import { Card } from '@/components/primitives/Card';
import { Input } from '@/components/primitives/Input';
import { Button } from '@/components/primitives/Button';
import { useAuth } from '@/store/auth';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { toast, useUI } from '@/store/ui';
import { formatINR } from '@/lib/format';
import { ReceiptIcon } from '@/icons/Icon';

const BILLERS = [
  { id: 'electricity', label: 'Electricity',  account: '5001000000001' },
  { id: 'mobile',      label: 'Mobile',       account: '5001000000002' },
  { id: 'broadband',   label: 'Broadband',    account: '5001000000003' },
  { id: 'gas',         label: 'Gas',          account: '5001000000004' },
  { id: 'water',       label: 'Water',        account: '5001000000005' },
  { id: 'dth',         label: 'DTH/TV',       account: '5001000000006' },
];

export function Bills() {
  const accounts = useAuth(s => s.accounts);
  const primary = accounts[0];
  const fireConfetti = useUI(s => s.fireConfetti);
  const [biller, setBiller] = useState(BILLERS[0]);
  const [consumerId, setConsumerId] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!primary) return;
    setBusy(true);
    try {
      await api.post('/transactions/transfer', {
        fromAccountId: primary._id,
        toAccountNumber: biller.account,
        amount: parseFloat(amount),
        mode: 'IMPS',
        description: `${biller.label} bill - ${consumerId}`,
        category: 'Bills & Utilities',
      }, { idempotencyKey: newIdempotencyKey() });
      fireConfetti();
      toast.success('Bill paid', `${biller.label} - ${formatINR(parseFloat(amount))}`);
      setConsumerId(''); setAmount('');
    } catch (err) {
      toast.error('Payment failed', err instanceof ApiError ? err.message : '');
    } finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }} className="stack-5">
      <Card>
        <h3 className="h3" style={{ marginBottom: 12 }}>Pay a bill</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {BILLERS.map(b => (
            <button key={b.id} onClick={() => setBiller(b)} style={{
              padding: '10px 14px', borderRadius: 12,
              background: biller.id === b.id ? 'var(--accent)' : 'var(--bg-2)',
              color: biller.id === b.id ? '#fff' : 'var(--text-2)',
              border: '1px solid', borderColor: biller.id === b.id ? 'var(--accent)' : 'var(--line)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <ReceiptIcon size={14} /> {b.label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="stack-4">
          <Input label="Consumer / connection ID" value={consumerId} onChange={(e) => setConsumerId(e.target.value)} required />
          <Input label="Amount (₹)" inputMode="decimal" value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} required />
          <Button type="submit" loading={busy}>Pay {amount ? formatINR(parseFloat(amount)) : ''}</Button>
        </form>
      </Card>
      <Card style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(99,102,241,0.12))' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-2)' }}>
          <ReceiptIcon size={18} />
          <span>Earn 1% cashback on bill payments. Credited instantly to Rewards.</span>
        </div>
      </Card>
    </div>
  );
}
