import { useState } from 'react';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { Modal } from '@/components/primitives/Modal';
import { OtpInput } from '@/components/primitives/OtpInput';
import { useAuth } from '@/store/auth';
import { api, ApiError } from '@/lib/api';
import { toast, useUI } from '@/store/ui';
import { ShieldIcon, LockIcon } from '@/icons/Icon';

export function Security() {
  const user = useAuth(s => s.user);
  const setUser = useAuth(s => s.setUser);
  const fireConfetti = useUI(s => s.fireConfetti);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enroll, setEnroll] = useState<{ secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState<string[] | null>(null);
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [busyPwd, setBusyPwd] = useState(false);
  const [busy2FA, setBusy2FA] = useState(false);

  async function startEnroll() {
    setBusy2FA(true);
    try {
      const res = await api.post<{ secret: string; otpauth: string }>('/auth/2fa/enroll');
      setEnroll(res); setEnrollOpen(true);
    } catch (err) { toast.error('Could not start enrollment', err instanceof ApiError ? err.message : ''); }
    finally { setBusy2FA(false); }
  }

  async function verify2FA() {
    try {
      const res = await api.post<{ backupCodes: string[] }>('/auth/2fa/verify', { code });
      setBackup(res.backupCodes);
      if (user) setUser({ ...user, twoFA: { enabled: true } });
      fireConfetti();
      toast.success('2FA enabled');
    } catch (err) { toast.error('Code is wrong', err instanceof ApiError ? err.message : ''); }
  }

  async function disable2FA() {
    const password = window.prompt('Enter your password to disable 2FA');
    if (!password) return;
    const tcode = window.prompt('Enter 6-digit code from your authenticator');
    if (!tcode) return;
    try {
      await api.post('/auth/2fa/disable', { password, code: tcode });
      if (user) setUser({ ...user, twoFA: { enabled: false } });
      toast.success('2FA disabled');
    } catch (err) { toast.error('Could not disable 2FA', err instanceof ApiError ? err.message : ''); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.next !== pwd.confirm) { toast.error('Passwords do not match'); return; }
    setBusyPwd(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pwd.current, newPassword: pwd.next });
      toast.success('Password changed', 'Other sessions have been signed out.');
      setPwd({ current: '', next: '', confirm: '' });
    } catch (err) { toast.error('Could not change password', err instanceof ApiError ? err.message : ''); }
    finally { setBusyPwd(false); }
  }

  const enabled = user?.twoFA?.enabled;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }} className="stack-5">
      <Card>
        <div className="row-sb">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <ShieldIcon size={22} />
            <div>
              <div style={{ fontWeight: 700 }}>Two-factor authentication</div>
              <div className="muted" style={{ fontSize: 13 }}>Required for high-value transfers and password changes.</div>
            </div>
          </div>
          {enabled
            ? <Button variant="secondary" onClick={disable2FA}>Disable</Button>
            : <Button loading={busy2FA} onClick={startEnroll}>Enable</Button>}
        </div>
      </Card>

      <Card>
        <h3 className="h3" style={{ marginBottom: 12 }}><LockIcon size={18} /> Change password</h3>
        <form onSubmit={changePassword} className="stack-4">
          <Input label="Current password" type="password" required value={pwd.current} onChange={(e) => setPwd(p => ({ ...p, current: e.target.value }))} />
          <Input label="New password" type="password" required value={pwd.next} onChange={(e) => setPwd(p => ({ ...p, next: e.target.value }))} hint="Min 12 chars · upper · lower · digit · special" />
          <Input label="Confirm new password" type="password" required value={pwd.confirm} onChange={(e) => setPwd(p => ({ ...p, confirm: e.target.value }))} />
          <div><Button type="submit" loading={busyPwd}>Change password</Button></div>
        </form>
      </Card>

      <Modal open={enrollOpen} onClose={() => { setEnrollOpen(false); setEnroll(null); setCode(''); setBackup(null); }} title="Enable 2FA">
        {enroll && !backup && (
          <div className="stack-4">
            <p className="muted" style={{ marginTop: -8 }}>
              Open your authenticator app (Google Authenticator, Authy, 1Password) and add this entry.
            </p>
            <Card style={{ background: 'var(--bg-2)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              <div style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 6 }}>SECRET</div>
              {enroll.secret}
            </Card>
            <p className="muted" style={{ fontSize: 13, marginTop: -4 }}>Enter the current 6-digit code:</p>
            <OtpInput length={6} value={code} onChange={setCode} autoFocus />
            <Button onClick={verify2FA} disabled={code.length < 6} block>Verify and enable</Button>
          </div>
        )}
        {backup && (
          <div className="stack-3">
            <p>Save these backup codes somewhere safe. Each code works once.</p>
            <Card style={{ background: 'var(--bg-2)', fontFamily: 'var(--font-mono)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {backup.map(c => <div key={c}>{c}</div>)}
              </div>
            </Card>
            <Button onClick={() => { setEnrollOpen(false); setBackup(null); setEnroll(null); setCode(''); }} block>Done</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
