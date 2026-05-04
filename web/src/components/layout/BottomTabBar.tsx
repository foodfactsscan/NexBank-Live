import { NavLink, useNavigate } from 'react-router-dom';
import { HomeIcon, ChartIcon, SendIcon, CardIcon, UserIcon } from '@/icons/Icon';

const TABS = [
  { to: '/', icon: HomeIcon, label: 'Home', end: true },
  { to: '/insights', icon: ChartIcon, label: 'Insights' },
  { to: '/cards', icon: CardIcon, label: 'Cards' },
  { to: '/profile', icon: UserIcon, label: 'Profile' },
];

export function BottomTabBar() {
  const nav = useNavigate();
  return (
    <nav
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100,
        height: 'calc(var(--bottom-nav-h) + var(--safe-bottom))',
        paddingBottom: 'var(--safe-bottom)',
        background: 'rgba(10, 14, 26, 0.85)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        borderTop: '1px solid var(--line)',
        display: 'flex', alignItems: 'stretch', justifyContent: 'space-around',
      }}
      aria-label="Primary navigation"
    >
      <Tab to={TABS[0].to} Icon={TABS[0].icon} label={TABS[0].label} end />
      <Tab to={TABS[1].to} Icon={TABS[1].icon} label={TABS[1].label} />

      <button
        onClick={() => nav('/transfer')}
        aria-label="Send money"
        style={{
          alignSelf: 'center',
          width: 60, height: 60, borderRadius: 22,
          background: 'var(--grad-brand)',
          color: '#fff', display: 'grid', placeItems: 'center',
          marginTop: -22,
          boxShadow: 'var(--shadow-3)',
          border: '4px solid var(--bg-0)',
          cursor: 'pointer',
        }}
      >
        <SendIcon size={24} />
      </button>

      <Tab to={TABS[2].to} Icon={TABS[2].icon} label={TABS[2].label} />
      <Tab to={TABS[3].to} Icon={TABS[3].icon} label={TABS[3].label} />
    </nav>
  );
}

function Tab({ to, Icon, label, end }: { to: string; Icon: typeof HomeIcon; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to} end={end}
      style={({ isActive }) => ({
        flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: isActive ? 'var(--accent)' : 'var(--text-2)',
        textDecoration: 'none', fontSize: 11, fontWeight: 600, gap: 4,
        minHeight: 48,
      })}
    >
      <Icon size={20} />
      <span>{label}</span>
    </NavLink>
  );
}
