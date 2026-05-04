import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { OtpInput } from '@/components/primitives/OtpInput';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/store/ui';

export function ResetPassword() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [code, setCode] = useState('');
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd !== confirm) { toast.error('Passwords do not match'); return; }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { email: email.trim(), code, password: pwd });
      toast.success('Password reset', 'Sign in with your new password.');
      nav('/login');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Reset failed';
      toast.error('Could not reset password', msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="h2">Enter your code</h2>
      <p className="muted" style={{ marginTop: 4, marginBottom: 20 }}>
        We sent a 6-digit code to <b>{email || 'your email'}</b>.
      </p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8, fontWeight: 500 }}>One-time code</div>
          <OtpInput length={6} value={code} onChange={setCode} autoFocus />
        </div>
        <Input label="New password" type="password" autoComplete="new-password" required value={pwd} onChange={(e) => setPwd(e.target.value)}
          hint="Min 12 chars · upper · lower · digit · special" />
        <Input label="Confirm password" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Button type="submit" loading={busy} block disabled={code.length < 6}>Reset password</Button>
        <Link to="/login" style={{ textAlign: 'center', color: 'var(--text-2)', textDecoration: 'none', marginTop: 8 }}>
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}
