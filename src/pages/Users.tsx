import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import type { UsersResult } from '../api';
import { Empty, ErrorMsg, Panel } from '../components/ui';
import { fmtDate, fmtDateTime, fmtInt } from '../format';

const SIZE = 20;

export function Users() {
  const [kw, setKw] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setError('');
    adminApi.users({ page, size: SIZE, q: q || undefined })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [page, q]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / SIZE)) : 1;

  return (
    <div className="page">
      <div className="page-head">
        <h1>用户管理</h1>
        <form
          className="search"
          onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(kw.trim()); }}
        >
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
                  <th>ID</th><th>用户名</th><th>手机号</th><th>会员</th><th>注册时间</th><th>最后活跃</th>
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
                    <td>{fmtDate(u.createdAt)}</td>
                    <td>{fmtDateTime(u.lastActive)}</td>
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
    </div>
  );
}
