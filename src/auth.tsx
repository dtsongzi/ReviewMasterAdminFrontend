import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { adminApi, clearSession, getToken, getUsername, saveSession } from './api';

interface AuthValue {
  token: string | null;
  username: string;
  checking: boolean;
  signIn: (token: string, username: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 <AuthProvider> 内使用');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [username, setUsername] = useState<string>(() => getUsername());
  const [checking, setChecking] = useState<boolean>(() => !!getToken());

  // 刷新后校验令牌有效性；失效则清空回登录页
  useEffect(() => {
    let alive = true;
    if (!token) { setChecking(false); return; }
    adminApi.me()
      .then((r) => { if (alive) setUsername(r.username); })
      .catch(() => { if (alive) { clearSession(); setToken(null); } })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [token]);

  const value = useMemo<AuthValue>(() => ({
    token,
    username,
    checking,
    signIn: (t: string, u: string) => { saveSession(t, u); setToken(t); setUsername(u); setChecking(false); },
    signOut: () => { clearSession(); setToken(null); setUsername('admin'); },
  }), [token, username, checking]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
