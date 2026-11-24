import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api';
import { useAuth } from '../auth';

export function Login() {
  const { token, signIn } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (token) nav('/', { replace: true }); }, [token, nav]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await adminApi.login(username.trim(), password);
      signIn(r.token, r.username || 'admin', !!r.super);
      nav('/', { replace: true });
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : '登录失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">📊</div>
        <h1>复盘大师 · 管理后台</h1>
        <p className="login-hint">仅限管理员账号登录</p>
        <label>
          管理员账号
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label>
          密码
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="请输入管理员密码"
          />
        </label>
        {error ? <div className="login-error">{error}</div> : null}
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  );
}
