// Top-level router. Auth pages and the post-login Dashboard are eager so the
// first paint after sign-in is instant; every other route is React.lazy so
// the initial bundle stays under ~60 kB gzipped. Token-refresh failures wipe
// `user` so the guard kicks back to /login.
import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useAuth } from './store/auth';
import { onAuthChange } from './lib/api';
import { AppShell } from './components/layout/AppShell';
import { RequireAuth, RedirectIfAuthed } from './components/layout/RequireAuth';
import { Toaster } from './components/primitives/Toaster';
import { ConfettiHost } from './components/motion/Confetti';

// Auth bundle is small + needed first → eager.
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';

// Dashboard is the post-login first paint → eager.
import { Dashboard } from './pages/Dashboard';

// Everything else lazy-loaded so the initial bundle stays light.
const Transfer       = lazy(() => import('./pages/Transfer').then(m => ({ default: m.Transfer })));
const RequestMoney   = lazy(() => import('./pages/RequestMoney').then(m => ({ default: m.RequestMoney })));
const Transactions   = lazy(() => import('./pages/Transactions').then(m => ({ default: m.Transactions })));
const Insights       = lazy(() => import('./pages/Insights').then(m => ({ default: m.Insights })));
const Goals          = lazy(() => import('./pages/Goals').then(m => ({ default: m.Goals })));
const Budgets        = lazy(() => import('./pages/Budgets').then(m => ({ default: m.Budgets })));
const Cards          = lazy(() => import('./pages/Cards').then(m => ({ default: m.Cards })));
const Accounts       = lazy(() => import('./pages/Accounts').then(m => ({ default: m.Accounts })));
const Bills          = lazy(() => import('./pages/Bills').then(m => ({ default: m.Bills })));
const Investments    = lazy(() => import('./pages/Investments').then(m => ({ default: m.Investments })));
const Loans          = lazy(() => import('./pages/Loans').then(m => ({ default: m.Loans })));
const Rewards        = lazy(() => import('./pages/Rewards').then(m => ({ default: m.Rewards })));
const Notifications  = lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));
const Profile        = lazy(() => import('./pages/profile/Profile').then(m => ({ default: m.Profile })));
const Security       = lazy(() => import('./pages/profile/Security').then(m => ({ default: m.Security })));
const Devices        = lazy(() => import('./pages/profile/Devices').then(m => ({ default: m.Devices })));
const Statements     = lazy(() => import('./pages/Statements').then(m => ({ default: m.Statements })));
const Support        = lazy(() => import('./pages/Support').then(m => ({ default: m.Support })));
const Admin          = lazy(() => import('./pages/admin/Admin').then(m => ({ default: m.Admin })));

function PageFallback() {
  return (
    <div style={{ padding: 32, color: 'var(--text-3)' }}>Loading…</div>
  );
}

function ShellRoutes() {
  return (
    <AppShell>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="/transfer" element={<Transfer />} />
          <Route path="/request" element={<RequestMoney />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/investments" element={<Investments />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/security" element={<Security />} />
          <Route path="/profile/devices" element={<Devices />} />
          <Route path="/statements" element={<Statements />} />
          <Route path="/support" element={<Support />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  const hydrate = useAuth(s => s.hydrate);
  const setUser = useAuth(s => s.setUser);

  useEffect(() => {
    hydrate();
    // If the api layer wipes tokens (e.g. refresh failed), clear the user.
    const off = onAuthChange((tok) => { if (!tok) setUser(null); });
    return () => { off(); };
  }, [hydrate, setUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
          <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />
          <Route path="/forgot-password" element={<RedirectIfAuthed><ForgotPassword /></RedirectIfAuthed>} />
          <Route path="/reset-password" element={<RedirectIfAuthed><ResetPassword /></RedirectIfAuthed>} />
          <Route path="/*" element={<RequireAuth><ShellRoutes /></RequireAuth>} />
        </Routes>
        <Toaster />
        <ConfettiHost />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
