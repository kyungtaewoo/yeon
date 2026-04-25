import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  nickname: string;
  gender: string;
  isOnboardingComplete: boolean;
  isPremium: boolean;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      updateUser: (patch) => {
        const u = get().user;
        if (!u) return;
        set({ user: { ...u, ...patch } });
      },
      clearAuth: () => set({ token: null, user: null }),
    }),
    { name: 'yeon-auth' },
  ),
);
