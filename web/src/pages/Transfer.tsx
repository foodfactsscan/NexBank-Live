import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/primitives/Card';
import { Input } from '@/components/primitives/Input';
import { Button } from '@/components/primitives/Button';
import { useAuth } from '@/store/auth';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { toast, useUI } from '@/store/ui';
import { formatINR } from '@/lib/format';
import { SendIcon, CheckIcon, ArrowRightIcon, ArrowLeftIcon } from '@/icons/Icon';

type Mode = 'IMPS' | 'NEFT' | 'RTGS' | 'UPI';

export function Transfer() {
  const accounts = useAuth(s => s.accounts);
  const primary = accounts[0];
  const fireConfetti = useUI(s => s.fireConfetti);
  const nav = useNavigate();

  const [step, setStep] = useState(1);
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<Mode>('IMPS');
  const [description, setDescription] = useState('');
  const [verified, setVerified] = useState<{ accountHolderName: string; ifscCode: string } | null>(null);
  const [busyVerify, setBusyVerify] = useState(false);
  const [busySend, setBusySend] = useState(false);
  const [saveBene, setSaveBene] = useState(true);

  async function verify() {
    if (!accountNumber || !amount) { toast.error('Enter account and amount'); return; }
    if (!primary) return;
    setBusyVerify(true);
    try {
      const res = await api.get<any>(`/transactions/verify-account/${accountNumber}`);
      setVerified(res);
      setStep(2);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not verify account';
      toast.error('Verification failed', msg);
    } finally {
      setBusyVerify(false);
    }
  }

  async function send() {
    if (!primary || !verified) return;
    setBusySend(true);
    try {
      const res = await api.post<any>('/transactions/transfer', {
        fromAccountId: primary._id,
        toAccountNumber: accountNumber,
        amount: parseFloat(amount),
        mode,
        description,
        saveBeneficiary: saveBene,
        beneficiaryName: verified.accountHolderName,
      }, { idempotencyKey: newIdempotencyKey() });
      fireConfetti();
      toast.success('Sent ✓', `${formatINR(parseFloat(amount))} to ${verified.accountHolderName}`);
      setStep(3);
      setTimeout(() => nav('/transactions'), 1500);
      void res;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Transfer failed';
      toast.error('Could not send money', msg);
    } finally {
      setBusySend(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }} className="stack-5">
      <Stepper step={step} />

      {step === 1 && (
        <Card>
          <h3 className="h3" style={{ marginBottom: 16 }}>Send to a NexBank account</h3>
          <div className="stack-4">
            <Input
              label="Recipient account number" inputMode="numeric"
              maxLength={12} value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="10-digit account number"
            />
            <Input
              label="Amount (₹)" inputMode="decimal" value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="0.00"
              hint={primary ? `Available: ${formatINR(primary.balance - (primary.minimumBalance || 0))}` : undefined}
            />
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8, fontWeight: 500 }}>Transfer mode</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['IMPS', 'UPI', 'NEFT', 'RTGS'] as Mode[]).map(m => (
                  <button key={m} type="button" onClick={() => setMode(m)}
                    style={{
                      padding: '8px 14px', borderRadius: 999,
                      background: mode === m ? 'var(--accent)' : 'var(--bg-2)',
                      color: mode === m ? '#fff' : 'var(--text-2)',
                      border: '1px solid', borderColor: mode === m ? 'var(--accent)' : 'var(--line)',
                      fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    }}>{m}</button>
                ))}
              </div>
            </div>
            <Input
              label="Note (optional)" value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this for?"
            />
            <Button onClick={verify} loading={busyVerify} block iconRight={<ArrowRightIcon size={16} />}>
              Verify recipient
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && verified && (
        <Card>
          <h3 className="h3" style={{ marginBottom: 16 }}>Confirm transfer</h3>
          <div className="stack-3" style={{ padding: 16, background: 'var(--bg-2)', borderRadius: 'var(--r-md)' }}>
            <Row label="To" value={verified.accountHolderName} />
            <Row label="Account" value={accountNumber} />
            <Row label="IFSC" value={verified.ifscCode} />
            <Row label="Mode" value={mode} />
            <Row label="Note" value={description || '—'} />
            <div style={{ height: 1, background: 'var(--line)' }} />
            <Row label="Amount" value={formatINR(parseFloat(amount || '0'))} valueBold />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 14, color: 'var(--text-2)' }}>
            <input type="checkbox" checked={saveBene} onChange={(e) => setSaveBene(e.target.checked)} />
            Save as beneficiary
          </label>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button variant="secondary" iconLeft={<ArrowLeftIcon size={16} />} onClick={() => setStep(1)}>Back</Button>
            <Button onClick={send} loading={busySend} block iconLeft={<SendIcon size={16} />}>
              Send {formatINR(parseFloat(amount || '0'))}
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card style={{ textAlign: 'center', padding: 'var(--s-7)' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--success-soft)', color: 'var(--success)',
            display: 'grid', placeItems: 'center', margin: '0 auto 16px',
          }}>
            <CheckIcon size={32} />
          </div>
          <h3 className="h3">Transfer successful</h3>
          <p className="muted" style={{ marginTop: 6 }}>Money is on its way. We saved you a record.</p>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, valueBold }: { label: string; value: string; valueBold?: boolean }) {
  return (
    <div className="row-sb">
      <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: valueBold ? 800 : 600, fontSize: valueBold ? 18 : 14 }}>{value}</span>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {[1, 2, 3].map(n => (
        <div key={n} style={{
          height: 4, flex: 1, maxWidth: 60,
          background: n <= step ? 'var(--accent)' : 'var(--bg-2)',
          borderRadius: 2, transition: 'background 200ms',
        }} />
      ))}
    </div>
  );
}
