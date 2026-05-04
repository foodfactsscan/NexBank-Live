import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/store/ui';

export function ForgotPassword() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      toast.success('Check your inbox', 'If that email exists, we sent a 6-digit code.');
      nav(`/reset-password?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to send reset code';
      toast.error('Could not send code', msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="h2">Reset your password</h2>
      <p className="muted" style={{ marginTop: 4, marginBottom: 20 }}>
        Enter your email and we’ll send you a one-time code.
      </p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" loading={busy} block>Send reset code</Button>
        <Link to="/login" style={{ textAlign: 'center', color: 'var(--text-2)', textDecoration: 'none', marginTop: 8 }}>
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}
