import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { useAuth } from '@/store/auth';
import { getAccessToken } from '@/lib/api';
import { toast } from '@/store/ui';
import { DownloadIcon } from '@/icons/Icon';

export function Statements() {
  const [params] = useSearchParams();
  const accounts = useAuth(s => s.accounts);
  const [accountId, setAccountId] = useState(params.get('accountId') || accounts[0]?._id || '');
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!accountId) return;
    setBusy(true);
    try {
      const url = `/api/v1/statements/${accountId}.pdf?from=${from}&to=${to}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `nexbank-statement-${from}_${to}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      toast.error('Could not download', err.message || '');
    } finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }} className="stack-5">
      <Card>
        <h2 className="h2">Statements</h2>
        <p className="muted" style={{ marginTop: 4, marginBottom: 16 }}>Generate a real PDF statement for any window.</p>
        <div className="stack-4">
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>Account</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{
              background: 'var(--bg-3)', color: 'var(--text-1)', border: '1px solid var(--line)',
              borderRadius: 12, padding: '12px 14px', fontSize: 14, height: 48,
            }}>
              {accounts.map(a => <option key={a._id} value={a._id}>{a.accountName} · {a.accountNumber}</option>)}
            </select>
          </label>
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button loading={busy} iconLeft={<DownloadIcon size={16} />} onClick={download}>Download PDF</Button>
        </div>
      </Card>
    </div>
  );
}
