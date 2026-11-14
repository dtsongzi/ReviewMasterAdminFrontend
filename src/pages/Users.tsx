import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { adminApi } from '../api';
import type { BatchCodesResult, CodesResult, MemberCode, UserRow, UsersResult } from '../api';
import { Empty, ErrorMsg, Panel } from '../components/ui';
import { fmtDate, fmtDateTime, fmtInt } from '../format';

const SIZE = 20;
const CODE_PAGE_SIZES = [20, 50, 100, 200];
const DEFAULT_CODE_PAGE_SIZE = 20;
const GEN_PREVIEW = 20;       // 本次生成结果默认只铺前 20 个，其余可展开
const MAX_BATCH = 200;        // 单次批量操作上限（可跨页累计选择）
const CODE_STATUS = [
  { key: 'all', label: '全部' },
  { key: 'unused', label: '未使用' },
  { key: 'sold', label: '已卖出' },
  { key: 'activated', label: '已激活' },
  { key: 'discarded', label: '已废弃' },
];
const STATUS_LABEL: Record<string, string> = {
  unused: '未使用', sold: '已卖出', activated: '已激活', discarded: '已废弃'
};

function canOperate(status: string) { return status === 'unused' || status === 'sold'; }

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
  const [codeKw, setCodeKw] = useState('');
  const [codeQ, setCodeQ] = useState('');
  const [codePage, setCodePage] = useState(0);
  const [codeSize, setCodeSize] = useState(DEFAULT_CODE_PAGE_SIZE);
  const [codes, setCodes] = useState<CodesResult | null>(null);
  const [codeVer, setCodeVer] = useState(0);
  const [codeError, setCodeError] = useState('');
  const [plan, setPlan] = useState('month');
  const [count, setCount] = useState(5);
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<MemberCode[]>([]);
  const [genExpanded, setGenExpanded] = useState(false);

  // 批量操作：选中集合可跨页保留，切换筛选条件 / 每页条数时清空
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState('');
  const [batchResult, setBatchResult] = useState<{ action: string; result: BatchCodesResult } | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

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
    adminApi.memberCodes({
      status: codeStatus, q: codeQ || undefined,
      limit: codeSize, offset: codePage * codeSize
    })
      .then((d) => { if (alive) setCodes(d); })
      .catch((e) => { if (alive) setCodeError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [codeStatus, codeQ, codePage, codeSize, codeVer]);

  useEffect(() => {
    setSelected(new Set());
    setBatchResult(null);
  }, [codeStatus, codeQ, codeSize]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / SIZE)) : 1;
  const codeTotalPages = codes ? Math.max(1, Math.ceil(codes.total / codeSize)) : 1;

  // 筛选/批量操作后总数可能变小，当前页码越界会显示空白页，自动回退到最后一页。
  useEffect(() => {
    if (codes && codePage > 0 && codePage >= codeTotalPages) {
      setCodePage(Math.max(0, codeTotalPages - 1));
    }
  }, [codes, codePage, codeTotalPages]);
  const actionable = useMemo(
    () => (codes ? codes.items.filter((c) => canOperate(c.status)) : []),
    [codes]
  );
  const allVisibleSelected = actionable.length > 0 && actionable.every((c) => selected.has(c.code));
  const someVisibleSelected = actionable.some((c) => selected.has(c.code));

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
  }, [someVisibleSelected, allVisibleSelected]);

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
      setGenExpanded(false);
      setNote('');
      setCodePage(0);
      setCodeVer((v) => v + 1);
    } catch (ex) {
      setCodeError(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setGenerating(false);
    }
  }

  function toggleOne(code: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) {
        if (next.size >= MAX_BATCH && !next.has(code)) return prev;
        next.add(code);
      } else next.delete(code);
      return next;
    });
  }

  function toggleAllVisible(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      actionable.forEach((c) => {
        if (on) {
          if (next.size < MAX_BATCH) next.add(c.code);
        } else next.delete(c.code);
      });
      return next;
    });
  }

  function selectGenerated() {
    if (!generated.length) return;
    setSelected((prev) => {
      const next = new Set(prev);
      generated.forEach((c) => { if (next.size < MAX_BATCH) next.add(c.code); });
      return next;
    });
  }

  async function copyGenerated() {
    try {
      await navigator.clipboard.writeText(generated.map((c) => c.code).join('\n'));
    } catch {
      setCodeError('复制失败，请手动选中兑换码复制');
    }
  }

  async function markSold(code: string) {
    if (!window.confirm(`确认兑换码 ${code} 已卖出？标记后不可再卖，也不可撤回。`)) return;
    setCodeError('');
    try { await adminApi.markSold(code); setCodeVer((v) => v + 1); }
    catch (e) { setCodeError(e instanceof Error ? e.message : String(e)); }
  }

  async function discard(code: string) {
    if (!window.confirm(`确定废弃兑换码 ${code}？废弃后不可使用。`)) return;
    setCodeError('');
    try { await adminApi.discardCode(code); setCodeVer((v) => v + 1); }
    catch (e) { setCodeError(e instanceof Error ? e.message : String(e)); }
  }

  async function runBatch(action: 'sell' | 'discard') {
    const list = Array.from(selected);
    if (!list.length || batchBusy) return;
    const label = action === 'sell' ? '批量标记已卖出' : '批量废弃';
    const preview = list.slice(0, 3).join('、') + (list.length > 3 ? ` 等 ${list.length} 个` : '');
    const warning = action === 'discard'
      ? '废弃后不可恢复，也不能再兑换。已激活的兑换码不会被废弃。'
      : '标记后不可撤销，只有已卖出的码才能被用户兑换；已卖出 / 已激活 / 已废弃的码会跳过。';
    if (!window.confirm(`${label}：共 ${list.length} 个兑换码\n${preview}\n\n${warning}\n\n确认继续？`)) return;
    setBatchBusy(action);
    setCodeError('');
    setBatchResult(null);
    try {
      const result = action === 'sell'
        ? await adminApi.markSoldBatch(list)
        : await adminApi.discardCodesBatch(list);
      setBatchResult({ action: label, result });
      // 失败的码保留选中，便于修正后直接重试；成功的清掉
      setSelected(new Set(result.items.filter((x) => !x.ok).map((x) => x.code)));
      setCodeVer((v) => v + 1);
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : String(e));
    } finally {
      setBatchBusy('');
    }
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
        extra={codes ? <span className="muted">共 {fmtInt(codes.counts.all)} · 未用 {codes.counts.unused} · 已卖 {codes.counts.sold} · 已激活 {codes.counts.activated} · 已废弃 {codes.counts.discarded}</span> : null}
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
            备注（可选，建议填批次名便于筛选）
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：双十一活动 / 渠道A" maxLength={120} />
          </label>
          <button className="btn-primary" type="submit" disabled={generating}>{generating ? '生成中…' : '生成兑换码'}</button>
        </form>

        {generated.length > 0 ? (
          <div className="code-gen">
            <div className="code-gen-title">
              <span>本次生成 {generated.length} 个（未使用；卖出后请批量标记已卖出）</span>
              <span className="code-gen-actions">
                <button className="btn-ghost btn-sm" onClick={selectGenerated}>选中本次生成</button>
                <button className="btn-ghost btn-sm" onClick={copyGenerated}>复制全部</button>
              </span>
            </div>
            <div className="code-list">
              {(genExpanded ? generated : generated.slice(0, GEN_PREVIEW))
                .map((c) => <span key={c.code} className="code-chip">{c.code}</span>)}
            </div>
            {generated.length > GEN_PREVIEW ? (
              <button className="btn-ghost btn-sm code-gen-more" onClick={() => setGenExpanded((v) => !v)}>
                {genExpanded ? '收起' : `展开剩余 ${generated.length - GEN_PREVIEW} 个`}
              </button>
            ) : null}
          </div>
        ) : null}

        <form className="inline-form code-filter" onSubmit={(e) => {
          e.preventDefault(); setCodePage(0); setCodeQ(codeKw.trim());
        }}>
          <label className="grow">
            搜索兑换码 / 批次备注
            <input value={codeKw} onChange={(e) => setCodeKw(e.target.value)} placeholder="按生成时的备注筛出整批码，再全选批量操作" maxLength={60} />
          </label>
          <button className="btn-ghost" type="submit">搜索</button>
          {codeQ ? <button className="btn-ghost" type="button" onClick={() => { setCodeKw(''); setCodeQ(''); setCodePage(0); }}>清除</button> : null}
        </form>

        <div className="toolbar" style={{ marginTop: 14 }}>
          <div className="tabs">
            {CODE_STATUS.map((s) => (
              <button key={s.key} className={'tab' + (codeStatus === s.key ? ' active' : '')}
                onClick={() => { setCodeStatus(s.key); setCodePage(0); }}>
                {s.label}{codes ? ' ' + (codes.counts as Record<string, number>)[s.key] : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="code-batch-bar">
          <span>已选 <strong>{selected.size}</strong> / 单次最多 {MAX_BATCH} 个</span>
          <button className="btn-primary btn-sm" disabled={!selected.size || !!batchBusy} onClick={() => runBatch('sell')}>
            {batchBusy === 'sell' ? '处理中…' : '批量标记已卖出'}
          </button>
          <button className="btn-danger btn-sm" disabled={!selected.size || !!batchBusy} onClick={() => runBatch('discard')}>
            {batchBusy === 'discard' ? '处理中…' : '批量废弃'}
          </button>
          <button className="btn-ghost btn-sm" disabled={!selected.size || !!batchBusy} onClick={() => setSelected(new Set())}>清空选择</button>
          <span className="muted">仅「未使用 / 已卖出」可勾选；翻页可累计选择，切换筛选或每页条数会清空</span>
        </div>

        {batchResult ? (
          <div className={'code-batch-result' + (batchResult.result.summary.failed ? ' warn' : ' ok')}>
            <div className="code-batch-summary">
              <span>
                {batchResult.action}：成功 {batchResult.result.summary.succeeded} / 共 {batchResult.result.summary.requested}
                {batchResult.result.summary.failed
                  ? ` · 失败 ${batchResult.result.summary.failed}（已保留选中，可直接重试）`
                  : ''}
              </span>
              <button className="btn-ghost btn-sm" onClick={() => setBatchResult(null)}>关闭</button>
            </div>
            {batchResult.result.summary.failed ? (
              <ul>
                {batchResult.result.items.filter((x) => !x.ok).map((x) => (
                  <li key={x.code}><span className="mono">{x.code}</span>：{x.error || x.errorCode || '操作失败'}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <ErrorMsg msg={codeError} />
        {!codes ? <div className="loading">加载中…</div> : codes.items.length === 0 ? <Empty text={codeQ ? '没有匹配的兑换码' : '暂无兑换码'} /> : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th className="code-check">
                    <input
                      type="checkbox" ref={selectAllRef} checked={allVisibleSelected}
                      disabled={!actionable.length}
                      onChange={(e) => toggleAllVisible(e.target.checked)}
                      aria-label="全选本页可操作的兑换码"
                    />
                  </th>
                  <th>兑换码</th><th>套餐</th><th>天数</th><th>状态</th><th>使用人</th>
                  <th>激活时间</th><th>卖出时间</th><th>创建时间</th><th>备注</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {codes.items.map((c) => (
                  <tr key={c.code} className={selected.has(c.code) ? 'row-selected' : ''}>
                    <td className="code-check">
                      {canOperate(c.status) ? (
                        <input
                          type="checkbox" checked={selected.has(c.code)}
                          onChange={(e) => toggleOne(c.code, e.target.checked)}
                          aria-label={`选择 ${c.code}`}
                        />
                      ) : <span className="muted">—</span>}
                    </td>
                    <td className="mono">{c.code}</td>
                    <td>{c.plan}</td>
                    <td>{c.days}</td>
                    <td>
                      <span className={'badge ' + (
                        c.status === 'activated' ? 'ok'
                          : c.status === 'sold' ? 'sold'
                            : c.status === 'discarded' ? 'banned' : 'free')}>
                        {STATUS_LABEL[c.status] || c.status}
                      </span>
                    </td>
                    <td>{c.usedUser ? (c.usedUser.username || c.usedUser.phone || c.usedUser.id) : '—'}</td>
                    <td>{fmtDateTime(c.activatedAt || c.usedAt)}</td>
                    <td>{fmtDateTime(c.soldAt)}</td>
                    <td>{fmtDateTime(c.createdAt)}</td>
                    <td className="muted">{c.note || '—'}</td>
                    <td className="actions">
                      {c.status === 'unused' ? (
                        <>
                          <button className="btn-primary btn-sm" onClick={() => markSold(c.code)}>标记已卖出</button>
                          <button className="btn-danger btn-sm" onClick={() => discard(c.code)}>废弃</button>
                        </>
                      ) : c.status === 'sold' ? (
                        <button className="btn-danger btn-sm" onClick={() => discard(c.code)}>废弃</button>
                      ) : <span className="muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {codes ? (
          <div className="pager code-pager">
            <div className="pager-left">
              <label className="pager-size">
                每页
                <select
                  value={codeSize}
                  onChange={(e) => { setCodeSize(Number(e.target.value)); setCodePage(0); }}
                  aria-label="每页显示条数"
                >
                  {CODE_PAGE_SIZES.map((n) => <option key={n} value={n}>{n} 条</option>)}
                </select>
              </label>
              <span>共 {fmtInt(codes.total)} 个 · 当前显示 {codes.items.length} 个</span>
            </div>
            <div className="pager-right">
              <span>第 {codePage + 1} / {codeTotalPages} 页</span>
              <button className="btn-ghost" disabled={codePage <= 0} onClick={() => setCodePage(0)}>首页</button>
              <button className="btn-ghost" disabled={codePage <= 0} onClick={() => setCodePage((p) => Math.max(0, p - 1))}>上一页</button>
              <button className="btn-ghost" disabled={codePage >= codeTotalPages - 1} onClick={() => setCodePage((p) => Math.min(codeTotalPages - 1, p + 1))}>下一页</button>
              <button className="btn-ghost" disabled={codePage >= codeTotalPages - 1} onClick={() => setCodePage(codeTotalPages - 1)}>末页</button>
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
