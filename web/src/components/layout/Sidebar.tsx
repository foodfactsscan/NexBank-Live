import { NavLink } from 'react-router-dom';
import {
  HomeIcon, SendIcon, HistoryIcon, BankIcon, CardIcon, ChartIcon,
  TargetIcon, PiggyIcon, ReceiptIcon, ShieldIcon, GiftIcon, UserIcon,
  HelpIcon, LogoutIcon,
} from '@/icons/Icon';
import { useAuth } from '@/store/auth';
import { initials } from '@/lib/format';

const NAV = [
  { to: '/', icon: HomeIcon, label: 'Dashboard', end: true },
  { to: '/transfer', icon: SendIcon, label: 'Send Money' },
  { to: '/transactions', icon: HistoryIcon, label: 'Transactions' },
  { to: '/insights', icon: ChartIcon, label: 'Insights' },
  { to: '/goals', icon: TargetIcon, label: 'Goals' },
  { to: '/budgets', icon: PiggyIcon, label: 'Budgets' },
  { to: '/cards', icon: CardIcon, label: 'Cards' },
  { to: '/accounts', icon: BankIcon, label: 'Accounts' },
  { to: '/bills', icon: ReceiptIcon, label: 'Bills' },
  { to: '/investments', icon: ChartIcon, label: 'Investments' },
  { to: '/loans', icon: ShieldIcon, label: 'Loans' },
  { to: '/rewards', icon: GiftIcon, label: 'Rewards' },
  { to: '/profile', icon: UserIcon, label: 'Profile' },
  { to: '/support', icon: HelpIcon, label: 'Support' },
];

export function Sidebar() {
  const user = useAuth(s => s.user);
  const logout = useAuth(s => s.logout);
  return (
    <aside style={{
      width: 'var(--sidebar-w)', height: '100vh',
      background: 'rgba(11, 16, 32, 0.7)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderRight: '1px solid var(--line)',
      display: 'flex', flexDirection: 'column',
      padding: 'var(--s-4)',
      gap: 'var(--s-3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 16px' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--grad-brand)',
          display: 'grid', placeItems: 'center',
          fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-0.04em',
        }}>N</div>
        <div style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 18 }}>NexBank</div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: 12, borderRadius: 12,
        background: 'var(--bg-2)', border: '1px solid var(--line)',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'var(--grad-brand)', color: '#fff',
          display: 'grid', placeItems: 'center',
          fontWeight: 700, letterSpacing: '-0.04em',
        }}>{user ? initials(`${user.firstName} ${user.lastName}`) : 'U'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user ? `${user.firstName} ${user.lastName}` : 'User'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {user?.username ? `@${user.username}` : user?.email || ''}
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {NAV.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 10,
                fontSize: 14, fontWeight: 500,
                color: isActive ? 'var(--text-1)' : 'var(--text-2)',
                background: isActive ? 'var(--bg-2)' : 'transparent',
                border: '1px solid',
                borderColor: isActive ? 'var(--line-strong)' : 'transparent',
                textDecoration: 'none',
                transition: 'all var(--t-fast)',
              })}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <button
        onClick={logout}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 12px', borderRadius: 10,
          fontSize: 14, fontWeight: 500,
          color: 'var(--danger)',
          background: 'transparent', border: '1px solid var(--line)',
          cursor: 'pointer',
        }}
      >
        <LogoutIcon size={18} /> <span>Sign out</span>
      </button>
    </aside>
  );
}
