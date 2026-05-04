import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { OtpInput } from '@/components/primitives/OtpInput';
import { LockIcon, EyeIcon, EyeOffIcon } from '@/icons/Icon';
import { useAuth } from '@/store/auth';
import { toast } from '@/store/ui';
import { ApiError } from '@/lib/api';

export function Login() {
  const nav = useNavigate();
  const login = useAuth(s => s.login);
  const loginAcc = useAuth(s => s.loginWithAccountNumber);

  const [mode, setMode] = useState<'email' | 'account'>('email');
  const [email, setEmail] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [totp, setTotp] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = mode === 'email'
        ? await login(email.trim(), password, totp || undefined)
        : await loginAcc(accountNumber.trim(), password, totp || undefined);
      if (res.twoFARequired) {
        setNeeds2FA(true);
        toast.info('Two-factor required', 'Enter the 6-digit code from your authenticator.');
        return;
      }
      toast.success('Welcome back!');
      nav('/');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Login failed';
      toast.error('Could not sign in', msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="h2">Welcome back</h2>
      <p className="muted" style={{ marginTop: 4, marginBottom: 24 }}>Sign in to your NexBank account</p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, padding: 4, background: 'var(--bg-2)', borderRadius: 12 }}>
        {(['email', 'account'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 10,
              background: mode === m ? 'var(--bg-1)' : 'transparent',
              color: mode === m ? 'var(--text-1)' : 'var(--text-3)',
              border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              transition: 'all var(--t-fast)',
            }}
          >
            {m === 'email' ? 'Email' : 'Account #'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {mode === 'email' ? (
          <Input
            label="Email" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        ) : (
          <Input
            label="Account number" type="text" inputMode="numeric" maxLength={12} required
            value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
          />
        )}

        <Input
          label="Password"
          type={showPwd ? 'text' : 'password'}
          autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)}
          iconLeft={<LockIcon size={16} />}
          iconRight={
            <button type="button" onClick={() => setShowPwd(v => !v)} aria-label="Toggle password visibility"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4 }}>
              {showPwd ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
            </button>
          }
        />

        {needs2FA && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: 'var(--bg-2)', borderRadius: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Authenticator code</span>
            <OtpInput length={6} value={totp} onChange={setTotp} autoFocus />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span style={{ color: 'var(--text-3)' }}>Forgot your password?</span>
          <Link to="/forgot-password" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>Reset</Link>
        </div>

        <Button type="submit" loading={busy} block>Sign in</Button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-2)' }}>
        New to NexBank? <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Open a free account</Link>
      </div>
    </AuthShell>
  );
}
