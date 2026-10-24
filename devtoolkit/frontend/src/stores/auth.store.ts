import { create } from 'zustand';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const storedToken = localStorage.getItem('auth_token');

export const useAuthStore = create<AuthState>((set) => ({
  token: storedToken,
  isAuthenticated: !!storedToken,
  login: (token: string) => {
    localStorage.setItem('auth_token', token);
    set({ token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('auth_token');
    set({ token: null, isAuthenticated: false });
  },
}));
