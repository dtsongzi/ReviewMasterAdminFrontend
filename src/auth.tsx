import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { adminApi, clearSession, getToken, getUsername, isSuper, saveSession } from './api';

interface AuthValue {
  token: string | null;
  username: string;
  superAdmin: boolean;
  checking: boolean;
  signIn: (token: string, username: string, superAdmin?: boolean) => void;
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
  const [superAdmin, setSuperAdmin] = useState<boolean>(() => isSuper());
  const [checking, setChecking] = useState<boolean>(() => !!getToken());

  // 刷新后校验令牌有效性；失效则清空回登录页。同时以服务端返回的角色为准（防止本地存值被篡改）。
  useEffect(() => {
    let alive = true;
    if (!token) { setChecking(false); return; }
    adminApi.me()
      .then((r) => {
        if (alive) {
          setUsername(r.username);
          setSuperAdmin(!!r.super);
          saveSession(token, r.username, !!r.super);
        }
      })
      .catch(() => { if (alive) { clearSession(); setToken(null); setSuperAdmin(false); } })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [token]);

  const value = useMemo<AuthValue>(() => ({
    token,
    username,
    superAdmin,
    checking,
    signIn: (t: string, u: string, s = false) => { saveSession(t, u, s); setToken(t); setUsername(u); setSuperAdmin(s); setChecking(false); },
    signOut: () => { clearSession(); setToken(null); setUsername(''); setSuperAdmin(false); },
  }), [token, username, superAdmin, checking]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
