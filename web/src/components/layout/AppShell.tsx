import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { TopBar } from './TopBar';
import { PageTransition } from '@/components/motion/PageTransition';

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/transfer': 'Send Money',
  '/request': 'Request Money',
  '/transactions': 'Transactions',
  '/insights': 'Insights',
  '/goals': 'Savings Goals',
  '/budgets': 'Budgets',
  '/cards': 'Cards',
  '/accounts': 'Accounts',
  '/bills': 'Pay Bills',
  '/investments': 'Investments',
  '/loans': 'Loans',
  '/rewards': 'Rewards',
  '/profile': 'Profile',
  '/profile/security': 'Security',
  '/profile/devices': 'Devices',
  '/notifications': 'Notifications',
  '/support': 'Support',
  '/admin': 'Admin',
  '/statements': 'Statements',
};

interface Props { children: ReactNode }

export function AppShell({ children }: Props) {
  const { pathname } = useLocation();
  const title = TITLES[pathname] || (pathname.startsWith('/profile/') ? 'Profile' : 'NexBank');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 900 : false);
  useEffect(() => {
    const onR = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'var(--sidebar-w) 1fr',
      minHeight: '100vh',
      background: 'var(--bg-0)',
      position: 'relative',
    }}>
      <div style={{
        position: 'fixed', inset: 0,
        background: 'var(--grad-mesh)',
        opacity: 0.7, pointerEvents: 'none', zIndex: 0,
      }} aria-hidden />

      {!isMobile && <Sidebar />}

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative', zIndex: 1 }}>
        <TopBar title={title} />
        <main style={{
          flex: 1,
          padding: isMobile ? 'var(--s-4)' : 'var(--s-6)',
          paddingBottom: isMobile
            ? 'calc(var(--bottom-nav-h) + var(--safe-bottom) + var(--s-4))'
            : 'var(--s-6)',
        }}>
          <PageTransition key={pathname}>{children}</PageTransition>
        </main>
      </div>

      {isMobile && <BottomTabBar />}
    </div>
  );
}
