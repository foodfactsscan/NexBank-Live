import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Cache keys grouped under a single object so call-sites are typo-resistant
// and test code can reach in to invalidate selectively.
export const qk = {
  me: ['me'] as const,
  accounts: ['accounts'] as const,
  account: (id: string) => ['account', id] as const,
  summary: (id: string) => ['summary', id] as const,
  transactions: ['transactions'] as const,
  notifications: ['notifications'] as const,
  goals: ['goals'] as const,
  budgets: ['budgets'] as const,
  cards: ['cards'] as const,
  devices: ['devices'] as const,
  rewards: ['rewards'] as const,
  fds: ['fds'] as const,
  loans: ['loans'] as const,
  beneficiaries: ['beneficiaries'] as const,
  moneyRequests: ['moneyRequests'] as const,
};
