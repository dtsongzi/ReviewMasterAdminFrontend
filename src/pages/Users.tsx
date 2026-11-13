import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { adminApi } from '../api';
import type { CodesResult, MemberCode, UserRow, UsersResult } from '../api';
import { Empty, ErrorMsg, Panel } from '../components/ui';
import { fmtDate, fmtDateTime, fmtInt } from '../format';

const SIZE = 20;
const CODE_STATUS = [
  { key: 'all', label: '全部' },
  { key: 'unused', label: '未使用' },
  { key: 'used', label: '已使用' },
  { key: 'revoked', label: '已作废' },
];
const STATUS_LABEL: Record<string, string> = { unused: '未使用', used: '已使用', revoked: '已作废' };

export function Users() {
  // 用户列表
  const [kw, setKw] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersResult | null>(null);
  const [error, setError] = useState('');
  const [ver, setVer] = useState(0);
  const [busyId, setBusyId] = useState('');

  // 会员兑换码
  const [codeStatus, setCodeStatus] = useState('all');
  const [codes, setCodes] = useState<CodesResult | null>(null);
  const [codeVer, setCodeVer] = useState(0);
  const [codeError, setCodeError] = useState('');
  const [plan, setPlan] = useState('month');
  const [count, setCount] = useState(5);
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<MemberCode[]>([]);

  useEffect(() => {
    let alive = true;
    setError('');
    adminApi.users({ page, size: SIZE, q: q || undefined })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [page, q, ver]);

  useEffect(() => {
    let alive = true;
    setCodeError('');
    adminApi.memberCodes({ status: codeStatus, limit: 200 })
      .then((d) => { if (alive) setCodes(d); })
      .catch((e) => { if (alive) setCodeError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [codeStatus, codeVer]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / SIZE)) : 1;

  async function toggleBan(u: UserRow) {
    setError('');
    if (u.banned) {
      if (!window.confirm(`确定解封 ${u.username || u.phone || u.id}？`)) return;
      setBusyId(u.id);
      try { await adminApi.unbanUser(u.id); setVer((v) => v + 1); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); }
      finally { setBusyId(''); }
      return;
    }
    const reason = window.prompt('封禁原因（可选）', '');
    if (reason === null) return;
    setBusyId(u.id);
    try { await adminApi.banUser(u.id, reason); setVer((v) => v + 1); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusyId(''); }
  }

  async function generate(e: FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setCodeError('');
    try {
      const r = await adminApi.generateCodes({ plan, count: Math.max(1, Math.min(100, Number(count) || 1)), note: note.trim() || undefined });
      setGenerated(r.items);
      setNote('');
      setCodeVer((v) => v + 1);
    } catch (ex) {
      setCodeError(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setGenerating(false);
    }
  }

  async function revoke(code: string) {
    if (!window.confirm(`确定作废兑换码 ${code}？作废后不可使用。`)) return;
    setCodeError('');
    try { await adminApi.revokeCode(code); setCodeVer((v) => v + 1); }
    catch (e) { setCodeError(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>用户管理</h1>
        <form className="search" onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(kw.trim()); }}>
          <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜索用户名 / 手机号 / ID" />
          <button className="btn-primary" type="submit">搜索</button>
        </form>
      </div>
      <ErrorMsg msg={error} />

      <Panel title={'用户列表' + (data ? ' · 共 ' + fmtInt(data.total) + ' 人' : '')}>
        {!data ? <div className="loading">加载中…</div> : data.items.length === 0 ? <Empty /> : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th><th>用户名</th><th>手机号</th><th>会员</th><th>状态</th>
                  <th>使用的会员码</th><th>注册时间</th><th>最后活跃</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td className="mono">{u.id}</td>
                    <td>{u.username || '—'}</td>
                    <td className="mono">{u.phone || '—'}</td>
                    <td>
                      {u.member.isPro
                        ? <span className="badge pro">{u.member.plan}{u.member.daysLeft ? ' · ' + u.member.daysLeft + ' 天' : ''}</span>
                        : <span className="badge free">免费</span>}
                    </td>
                    <td>
                      {u.banned
                        ? <span className="badge banned" title={u.banReason || ''}>已封禁</span>
                        : <span className="badge ok">正常</span>}
                    </td>
                    <td>{u.usedCode ? <span className="mono">{u.usedCode.code}</span> : '—'}</td>
                    <td>{fmtDate(u.createdAt)}</td>
                    <td>{fmtDateTime(u.lastActive)}</td>
                    <td>
                      <button
                        className={u.banned ? 'btn-ghost btn-sm' : 'btn-danger btn-sm'}
                        disabled={busyId === u.id}
                        onClick={() => toggleBan(u)}
                      >
                        {busyId === u.id ? '处理中…' : (u.banned ? '解封' : '封禁')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pager">
              <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</button>
              <span>第 {page} / {totalPages} 页</span>
              <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</button>
            </div>
          </>
        )}
      </Panel>

      {/* ---------- 会员兑换码（独立区域） ---------- */}
      <Panel
        title="会员兑换码"
        extra={codes ? <span className="muted">共 {fmtInt(codes.counts.all)} · 未用 {codes.counts.unused} · 已用 {codes.counts.used} · 作废 {codes.counts.revoked}</span> : null}
      >
        <form className="inline-form" onSubmit={generate}>
          <label>
            套餐
            <select value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="month">月卡（30 天）</option>
              <option value="quarter">季卡（90 天）</option>
              <option value="year">年卡（365 天）</option>
            </select>
          </label>
          <label>
            数量
            <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </label>
          <label className="grow">
            备注（可选）
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：双十一活动 / 渠道A" maxLength={120} />
          </label>
          <button className="btn-primary" type="submit" disabled={generating}>{generating ? '生成中…' : '生成兑换码'}</button>
        </form>

        {generated.length > 0 ? (
          <div className="code-gen">
            <div className="code-gen-title">本次生成 {generated.length} 个（已保存，可复制发给用户）</div>
            <div className="code-list">
              {generated.map((c) => <span key={c.code} className="code-chip">{c.code}</span>)}
            </div>
          </div>
        ) : null}

        <div className="toolbar" style={{ marginTop: 14 }}>
          <div className="tabs">
            {CODE_STATUS.map((s) => (
              <button key={s.key} className={'tab' + (codeStatus === s.key ? ' active' : '')} onClick={() => setCodeStatus(s.key)}>
                {s.label}{codes ? ' ' + (codes.counts as Record<string, number>)[s.key] : ''}
              </button>
            ))}
          </div>
        </div>

        <ErrorMsg msg={codeError} />
        {!codes ? <div className="loading">加载中…</div> : codes.items.length === 0 ? <Empty /> : (
          <table className="table">
            <thead>
              <tr><th>兑换码</th><th>套餐</th><th>天数</th><th>状态</th><th>使用人</th><th>使用时间</th><th>创建时间</th><th>备注</th><th>操作</th></tr>
            </thead>
            <tbody>
              {codes.items.map((c) => (
                <tr key={c.code}>
                  <td className="mono">{c.code}</td>
                  <td>{c.plan}</td>
                  <td>{c.days}</td>
                  <td>
                    <span className={'badge ' + (c.status === 'used' ? 'pro' : c.status === 'revoked' ? 'banned' : 'free')}>
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  </td>
                  <td>{c.usedUser ? (c.usedUser.username || c.usedUser.phone || c.usedUser.id) : '—'}</td>
                  <td>{fmtDateTime(c.usedAt)}</td>
                  <td>{fmtDateTime(c.createdAt)}</td>
                  <td className="muted">{c.note || '—'}</td>
                  <td>
                    {c.status === 'unused'
                      ? <button className="btn-danger btn-sm" onClick={() => revoke(c.code)}>作废</button>
                      : <span className="muted">—</span>}
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
