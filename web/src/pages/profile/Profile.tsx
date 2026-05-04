import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/primitives/Card';
import { Input } from '@/components/primitives/Input';
import { Button } from '@/components/primitives/Button';
import { useAuth } from '@/store/auth';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/store/ui';
import { initials } from '@/lib/format';
import { ShieldIcon, UserIcon, LockIcon } from '@/icons/Icon';

export function Profile() {
  const user = useAuth(s => s.user);
  const setUser = useAuth(s => s.setUser);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [username, setUsername] = useState(user?.username || '');
  const [busy, setBusy] = useState(false);
  const [busyU, setBusyU] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.put<any>('/users/profile', { firstName, lastName, phone });
      setUser(res.user);
      toast.success('Profile updated');
    } catch (err) { toast.error('Update failed', err instanceof ApiError ? err.message : ''); }
    finally { setBusy(false); }
  }

  async function saveUsername(e: React.FormEvent) {
    e.preventDefault();
    setBusyU(true);
    try {
      await api.put('/users/username', { username });
      if (user) setUser({ ...user, username });
      toast.success('Username saved');
    } catch (err) { toast.error('Could not save', err instanceof ApiError ? err.message : ''); }
    finally { setBusyU(false); }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }} className="stack-5">
      <Card>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--grad-brand)', color: '#fff',
            display: 'grid', placeItems: 'center',
            fontWeight: 800, fontSize: 28, letterSpacing: '-0.04em',
          }}>{user ? initials(`${user.firstName} ${user.lastName}`) : 'U'}</div>
          <div>
            <h2 className="h2">{user?.firstName} {user?.lastName}</h2>
            <div className="muted">{user?.email}</div>
            {user?.username && <div style={{ color: 'var(--accent)', fontSize: 13 }}>@{user.username}</div>}
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="h3" style={{ marginBottom: 12 }}>Personal details</h3>
        <form onSubmit={save} className="stack-4">
          <div className="grid-2" style={{ gap: 12 }}>
            <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div><Button type="submit" loading={busy}>Save changes</Button></div>
        </form>
      </Card>

      <Card>
        <h3 className="h3" style={{ marginBottom: 12 }}>P2P username</h3>
        <p className="muted" style={{ marginTop: -8, marginBottom: 12 }}>Friends can send you money with @{username || 'yourname'}.</p>
        <form onSubmit={saveUsername} className="stack-4">
          <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} hint="3–32 chars, a–z, 0–9, _ ." />
          <div><Button type="submit" loading={busyU}>Save username</Button></div>
        </form>
      </Card>

      <div className="grid-2">
        <Link to="/profile/security" style={{ textDecoration: 'none' }}>
          <Card style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ShieldIcon size={22} />
              <div>
                <div style={{ fontWeight: 700 }}>Security</div>
                <div className="muted" style={{ fontSize: 13 }}>2FA, password</div>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/profile/devices" style={{ textDecoration: 'none' }}>
          <Card style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <UserIcon size={22} />
              <div>
                <div style={{ fontWeight: 700 }}>Devices</div>
                <div className="muted" style={{ fontSize: 13 }}>Active sessions</div>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
