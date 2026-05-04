import { Link } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { formatINR, maskAccount } from '@/lib/format';
import { DownloadIcon, BankIcon } from '@/icons/Icon';

export function Accounts() {
  const accounts = useAuth(s => s.accounts);
  return (
    <div className="stack-4">
      <div>
        <h2 className="h2">Your accounts</h2>
        <p className="muted" style={{ marginTop: 4 }}>Balance, IFSC, downloads.</p>
      </div>
      <div className="grid-2">
        {accounts.map(a => (
          <Card key={a._id}>
            <div className="row-sb">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'var(--grad-brand)', color: '#fff',
                  display: 'grid', placeItems: 'center',
                }}><BankIcon size={20} /></div>
                <div>
                  <div style={{ fontWeight: 700 }}>{a.accountName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{a.accountType.toUpperCase()} · {maskAccount(a.accountNumber)}</div>
                </div>
              </div>
              <span className={`chip chip-${a.status === 'active' ? 'success' : 'warning'}`}>{a.status}</span>
            </div>
            <div style={{ marginTop: 18, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{formatINR(a.balance)}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-3)' }}>
              {a.ifscCode} · Min balance {formatINR(a.minimumBalance || 0)} · {a.interestRate ?? 0}% interest
            </div>
            <div style={{ marginTop: 16 }}>
              <Link to={`/statements?accountId=${a._id}`}>
                <Button variant="secondary" size="sm" iconLeft={<DownloadIcon size={14} />}>Download statement</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
