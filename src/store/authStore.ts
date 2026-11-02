import { create } from 'zustand';
import type { AuthState, RegisterAccountInput, User } from '../types';

const USER_KEY = 'auth_user';
const TOKEN_KEY = 'auth_token';
const EXPIRY_KEY = 'auth_expires_at';

const getStoredUser = (): User | null => {
  try {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const getStoredToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

/** Epoch (ms) en que el servidor dará por vencida la cookie de sesión. */
const getStoredExpiry = (): number | null => {
  const value = Number(localStorage.getItem(EXPIRY_KEY));
  return Number.isFinite(value) && value > 0 ? value : null;
};

const clearStoredSession = () => {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
};

const storeSession = (user: User, token: string, expiresAt: number | null) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_KEY, token);
  if (expiresAt) localStorage.setItem(EXPIRY_KEY, String(expiresAt));
  else localStorage.removeItem(EXPIRY_KEY);
};

/*
 * Si la copia local ya venció, se descarta antes de montar el panel: el
 * servidor rechazaría cada consulta y no tiene sentido mostrar el CMS abierto.
 * Una sesión guardada sin fecha (de una versión anterior) se deja pasar: la
 * cookie puede seguir viva y, si no lo está, el primer 401 la cierra.
 */
const storedExpiry = getStoredExpiry();
if (storedExpiry !== null && storedExpiry <= Date.now()) clearStoredSession();

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  token: getStoredToken(),
  sessionExpiresAt: getStoredExpiry(),
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

      const { user, token, expiresAt } = result.data;
      storeSession(user as User, token, expiresAt ?? null);

      set({
        user: user as User,
        token,
        sessionExpiresAt: expiresAt ?? null,
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

      const { user, token, expiresAt } = result.data;
      storeSession(user as User, token, expiresAt ?? null);

      set({
        user: user as User,
        token,
        sessionExpiresAt: expiresAt ?? null,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    clearStoredSession();
    // Borra la cookie de sesión del backend.
    fetch(`${import.meta.env.BASE_URL}api/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    set({ user: null, token: null, sessionExpiresAt: null, isAuthenticated: false });
  },

  expire: () => {
    // La cookie ya no sirve: el servidor acaba de rechazarla. No hace falta
    // avisarle con /api/logout.
    clearStoredSession();
    set({ user: null, token: null, sessionExpiresAt: null, isAuthenticated: false });
  },

  setUser: (user: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user });
  },
}));
