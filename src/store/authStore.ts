import { create } from 'zustand';
import type { AuthState, RegisterAccountInput, User } from '../types';

const getStoredUser = (): User | null => {
  try {
    const stored = localStorage.getItem('auth_user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const getStoredToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  token: getStoredToken(),
  isAuthenticated: !!getStoredToken(),
  isLoading: false,

  login: async (username: string, password: string, turnstileToken?: string) => {
    set({ isLoading: true });
    try {
      const { authApi } = await import('../api/client');
      const result = await authApi.login(username, password, turnstileToken);

      if (result.error || !result.data) {
        throw new Error(result.error || 'Error al iniciar sesión');
      }

      const { user, token } = result.data;
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('auth_token', token);

      set({
        user: user as User,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (input: RegisterAccountInput) => {
    set({ isLoading: true });
    try {
      const { authApi } = await import('../api/client');
      const result = await authApi.register(input);

      if (result.error || !result.data) {
        throw new Error(result.error || 'No se pudo crear la cuenta');
      }

      const { user, token } = result.data;
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('auth_token', token);

      set({
        user: user as User,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    // Borra la cookie de sesión del backend.
    fetch(`${import.meta.env.BASE_URL}api/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    set({ user: null, token: null, isAuthenticated: false });
  },

  setUser: (user: User) => {
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ user });
  },
}));
