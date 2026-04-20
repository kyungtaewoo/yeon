import { create } from 'zustand';

interface PremiumState {
  isPremium: boolean;
  plan: 'free' | 'monthly' | 'yearly';
  expiresAt: string | null;
  setPremium: (plan: 'monthly' | 'yearly') => void;
  clearPremium: () => void;
}

export const usePremiumStore = create<PremiumState>((set) => ({
  isPremium: false,
  plan: 'free',
  expiresAt: null,
  setPremium: (plan) => {
    const now = new Date();
    const expires = new Date(now);
    if (plan === 'monthly') expires.setMonth(expires.getMonth() + 1);
    else expires.setFullYear(expires.getFullYear() + 1);
    set({ isPremium: true, plan, expiresAt: expires.toISOString() });
  },
  clearPremium: () => set({ isPremium: false, plan: 'free', expiresAt: null }),
}));
