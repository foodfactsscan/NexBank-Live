import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { useAuth } from '@/store/auth';
import { toast, useUI } from '@/store/ui';
import { ApiError } from '@/lib/api';

interface Form {
  firstName: string; lastName: string; email: string; phone: string;
  password: string; confirmPassword: string;
  dateOfBirth: string; gender: string; address: string; panNumber: string;
  referralCode: string;
}

const empty: Form = {
  firstName: '', lastName: '', email: '', phone: '',
  password: '', confirmPassword: '',
  dateOfBirth: '', gender: '', address: '', panNumber: '', referralCode: '',
};

function strength(pw: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  const colors = ['#EF4444', '#EF4444', '#F59E0B', '#F59E0B', '#10B981', '#10B981'];
  return { score: s, label: labels[s], color: colors[s] };
}

export function Register() {
  const nav = useNavigate();
  const register = useAuth(s => s.register);
  const fireConfetti = useUI(s => s.fireConfetti);
  const [f, setF] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));
  const ps = strength(f.password);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.password !== f.confirmPassword) {
      toast.error('Passwords do not match'); return;
    }
    setBusy(true);
    try {
      await register({
        firstName: f.firstName, lastName: f.lastName,
        email: f.email, phone: f.phone, password: f.password,
        dateOfBirth: f.dateOfBirth || undefined,
        gender: f.gender || undefined,
        address: f.address || undefined,
        panNumber: f.panNumber || undefined,
        referralCode: f.referralCode || undefined,
      });
      fireConfetti();
      toast.success('Welcome to NexBank!', '₹1,000 welcome bonus credited.');
      nav('/');
    } catch (err) {
      const msg = err instanceof ApiError
        ? (err.details ? (err.details as any[]).map(d => d.message).join(', ') : err.message)
        : 'Registration failed';
      toast.error('Could not create account', msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h2 className="h2">Open a free account</h2>
      <p className="muted" style={{ marginTop: 4, marginBottom: 20 }}>₹1,000 welcome bonus, instant.</p>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="First name" required value={f.firstName} onChange={set('firstName')} />
          <Input label="Last name" required value={f.lastName} onChange={set('lastName')} />
        </div>
        <Input label="Email" type="email" autoComplete="email" required value={f.email} onChange={set('email')} />
        <Input label="Mobile" type="tel" inputMode="numeric" maxLength={10} required value={f.phone} onChange={set('phone')} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Date of birth" type="date" value={f.dateOfBirth} onChange={set('dateOfBirth')} />
          <Input label="PAN (optional)" maxLength={10} value={f.panNumber} onChange={(e) => setF(p => ({ ...p, panNumber: e.target.value.toUpperCase() }))} />
        </div>

        <Input
          label="Password"
          type="password" autoComplete="new-password" required
          value={f.password} onChange={set('password')}
          hint="Min 12 chars · upper · lower · digit · special"
        />
        {f.password && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--bg-2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(ps.score / 5) * 100}%`, background: ps.color, transition: 'width 200ms' }} />
            </div>
            <span style={{ color: ps.color, fontWeight: 600 }}>{ps.label}</span>
          </div>
        )}

        <Input label="Confirm password" type="password" required value={f.confirmPassword} onChange={set('confirmPassword')} />

        <Input label="Referral code (optional)" value={f.referralCode} onChange={(e) => setF(p => ({ ...p, referralCode: e.target.value.toUpperCase() }))} />

        <Button type="submit" loading={busy} block style={{ marginTop: 6 }}>Create account</Button>

        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 14, color: 'var(--text-2)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </div>
      </form>
    </AuthShell>
  );
}
