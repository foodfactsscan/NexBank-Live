import { create } from 'zustand';
import { api, setTokens, getAccessToken, getRefreshToken } from '@/lib/api';

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role?: string;
  username?: string | null;
  referralCode?: string | null;
  kycStatus?: string;
  twoFA?: { enabled?: boolean };
}

export interface Account {
  _id: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  balance: number;
  status: string;
  ifscCode: string;
  branch?: string;
  currency: string;
  interestRate?: number;
  minimumBalance?: number;
}

interface AuthState {
  user: User | null;
  accounts: Account[];
  hydrating: boolean;
  setUser: (u: User | null) => void;
  setAccounts: (a: Account[]) => void;
  primaryAccount: () => Account | null;
  // Actions
  hydrate: () => Promise<void>;
  login: (email: string, password: string, totp?: string) => Promise<{ twoFARequired?: boolean }>;
  loginWithAccountNumber: (accountNumber: string, password: string, totp?: string) => Promise<{ twoFARequired?: boolean }>;
  register: (payload: any) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  accounts: [],
  hydrating: true,

  setUser: (u) => set({ user: u }),
  setAccounts: (a) => set({ accounts: a }),
  primaryAccount: () => get().accounts.find(a => a.status === 'active') || get().accounts[0] || null,

  hydrate: async () => {
    if (!getAccessToken() && !getRefreshToken()) {
      set({ hydrating: false });
      return;
    }
    try {
      const me = await api.get<{ user: User; accounts: Account[] }>('/auth/me');
      set({ user: me.user, accounts: me.accounts, hydrating: false });
    } catch {
      setTokens(null, null);
      set({ user: null, accounts: [], hydrating: false });
    }
  },

  login: async (email, password, totp) => {
    const res = await api.post<any>('/auth/login', { email, password, totp });
    if (res.twoFARequired) return { twoFARequired: true };
    setTokens(res.accessToken, res.refreshToken);
    set({ user: res.user, accounts: res.accounts });
    return {};
  },

  loginWithAccountNumber: async (accountNumber, password, totp) => {
    const res = await api.post<any>('/auth/login', { accountNumber, password, totp });
    if (res.twoFARequired) return { twoFARequired: true };
    setTokens(res.accessToken, res.refreshToken);
    set({ user: res.user, accounts: res.accounts });
    return {};
  },

  register: async (payload) => {
    const res = await api.post<any>('/auth/register', payload);
    setTokens(res.accessToken, res.refreshToken);
    set({ user: res.user, accounts: [res.account] });
  },

  logout: async () => {
    const refresh = getRefreshToken();
    try { await api.post('/auth/logout', { refreshToken: refresh }); } catch { /* */ }
    setTokens(null, null);
    set({ user: null, accounts: [] });
  },
}));
