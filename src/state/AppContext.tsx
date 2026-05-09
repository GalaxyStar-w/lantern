import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from '../core/api.ts';
import { THEMES, type ThemeKey } from '../core/theme.ts';
import type { User } from './types.ts';

interface AppContextValue {
  user: User | null;
  loading: boolean;
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
  login: (code: string, nickname?: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const Ctx = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<ThemeKey>('night-violet');

  const refreshMe = async () => {
    if (!getToken()) { setUser(null); setLoading(false); return; }
    try {
      const r = await api.me();
      const u = (r.user as User) || null;
      setUser(u);
      if (u?.theme === 'cream-warm' || u?.theme === 'night-violet') {
        setThemeState(u.theme);
      }
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshMe(); }, []);

  useEffect(() => {
    const t = THEMES[theme];
    const root = document.documentElement;
    root.style.setProperty('--bg-from', t.bgGradientFrom);
    root.style.setProperty('--bg-to', t.bgGradientTo);
    root.style.setProperty('--text', t.text);
    root.style.setProperty('--text-dim', t.textDim);
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--bubble-self', t.bubbleSelf);
    root.style.setProperty('--bubble-other', t.bubbleOther);
    root.style.setProperty('--border', t.border);
    root.style.setProperty('--danger', t.danger);
    root.dataset.theme = theme;
  }, [theme]);

  const login = async (code: string, nickname?: string) => {
    const r = await api.login(code, nickname);
    setToken(r.token);
    setUser(r.user as User);
    const u = r.user as User;
    if (u?.theme === 'cream-warm' || u?.theme === 'night-violet') setThemeState(u.theme);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const setTheme = (t: ThemeKey) => {
    setThemeState(t);
    if (user) api.updateSettings({ theme: t }).catch(() => {});
  };

  const value = useMemo<AppContextValue>(() => ({
    user, loading, theme, setTheme, login, logout, refreshMe,
  }), [user, loading, theme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
