import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { adminApi } from '../api';
import type { AdminRow, AdminsResult } from '../api';
import { ErrorMsg, Panel } from '../components/ui';
import { fmtDateTime } from '../format';

/** 管理员管理：仅超级管理员可见。创建/重置密码/禁用/删除普通管理员。 */
export function Admins() {
  const [data, setData] = useState<AdminsResult | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [form, setForm] = useState({ username: '', password: '' });

  async function load() {
    setError('');
    try { setData(await adminApi.admins()); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { void load(); }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy || !form.username.trim() || !form.password) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await adminApi.createAdmin(form.username.trim(), form.password);
      setNotice(`✓ 已创建管理员 ${r.username}，请把初始密码安全告知本人`);
      setForm({ username: '', password: '' });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function reset(row: AdminRow) {
    const pw = window.prompt(`为 ${row.username} 设置新密码（至少 8 位）：`, '');
    if (pw === null) return;
    if (pw.length < 8) { setError('新密码至少 8 位'); return; }
    setBusyId(row.id); setError(''); setNotice('');
    try {
      const r = await adminApi.resetAdminPassword(row.id, pw);
      setNotice(`✓ 已重置 ${r.username} 的密码，旧令牌仍有效至过期`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusyId(''); }
  }

  async function toggle(row: AdminRow) {
    const next = !row.disabled;
    if (!window.confirm(`${next ? '禁用' : '启用'}管理员 ${row.username}？${next ? '禁用后其令牌立即失效。' : ''}`)) return;
    setBusyId(row.id); setError(''); setNotice('');
    try {
      await adminApi.setAdminDisabled(row.id, next);
      setNotice(`✓ 已${next ? '禁用' : '启用'} ${row.username}`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusyId(''); }
  }

  async function remove(row: AdminRow) {
    if (!window.confirm(`确定删除管理员 ${row.username}？其令牌将立即失效，此操作不可撤销。`)) return;
    setBusyId(row.id); setError(''); setNotice('');
    try {
      await adminApi.deleteAdmin(row.id);
      setNotice(`✓ 已删除 ${row.username}`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusyId(''); }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>管理员管理</h1>
          <div className="muted" style={{ marginTop: 4 }}>
            超级管理员 {data?.superUsername || '—'} 可创建/重置/禁用普通管理员；账号密码由 GitHub Secrets 配置，无法在此修改。
          </div>
        </div>
      </div>

      <ErrorMsg msg={error} />
      {notice ? <div className="ma-notice ok">{notice}</div> : null}

      <Panel title="新建普通管理员">
        <form className="ma-form" onSubmit={(e) => void create(e)}>
          <label className="fld">
            <span>账号</span>
            <input className="rc-inp" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="登录用户名，全局唯一" />
          </label>
          <label className="fld">
            <span>初始密码</span>
            <input className="rc-inp" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="至少 8 位" />
            <small className="muted">创建后请把密码安全告知本人；系统不保存明文。</small>
          </label>
          <div className="ma-actions">
            <button className="btn-primary" type="submit" disabled={busy || !form.username.trim() || !form.password}>
              {busy ? '创建中…' : '创建管理员'}
            </button>
          </div>
        </form>
      </Panel>

      <Panel title={data ? `普通管理员 · ${data.items.length} 人` : '普通管理员'}>
        {!data ? <div className="loading">加载中…</div> : data.items.length === 0 ? (
          <div className="muted">暂无普通管理员，所有后台权限当前仅超级管理员持有。</div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>账号</th><th>状态</th><th>创建人</th><th>创建时间</th><th>操作</th></tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.username}</td>
                  <td>{row.disabled ? <span className="badge banned">已禁用</span> : <span className="badge ok">正常</span>}</td>
                  <td>{row.createdBy || '—'}</td>
                  <td>{row.createdAt ? fmtDateTime(row.createdAt) : '—'}</td>
                  <td>
                    <div className="ma-actions">
                      <button className="btn-ghost btn-sm" disabled={busyId === row.id} onClick={() => void reset(row)}>重置密码</button>
                      <button className="btn-ghost btn-sm" disabled={busyId === row.id} onClick={() => void toggle(row)}>
                        {row.disabled ? '启用' : '禁用'}
                      </button>
                      <button className="btn-danger btn-sm" disabled={busyId === row.id} onClick={() => void remove(row)}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
