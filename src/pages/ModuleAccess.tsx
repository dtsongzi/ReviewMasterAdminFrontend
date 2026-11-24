import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { adminApi } from '../api';
import type { LevelMeta, ModuleAccessItem, ModuleAccessResult, ModuleLevel } from '../api';
import { ErrorMsg, Kpi, Panel } from '../components/ui';

type Draft = Record<string, ModuleLevel>;

/** 与服务端 core/module-access.js 的 derive() 同口径，用于保存前的实时预览。 */
function derivePreview(items: ModuleAccessItem[], draft: Draft) {
  const level = (key: string): ModuleLevel => draft[key] || 'free';
  const owners = new Map<string, { key: string; level: ModuleLevel }[]>();
  for (const m of items) {
    for (const p of m.apis) {
      if (!owners.has(p)) owners.set(p, []);
      owners.get(p)!.push({ key: m.key, level: level(m.key) });
    }
  }
  const proApis: string[] = [], warnings: string[] = [];
  const labelOf = new Map(items.map((m) => [m.key, m.label]));
  for (const [prefix, list] of owners) {
    if (list.every((o) => o.level === 'free')) continue;
    proApis.push(prefix);
    for (const o of list) {
      if (o.level !== 'free') continue;
      warnings.push(`「${labelOf.get(o.key) || o.key}」已设为免费可见，但其依赖的 ${prefix} 仍被会员门禁保护（还有非免费模块共用），请把共用模块一并设为免费。`);
    }
  }
  return {
    freeKeys: items.filter((m) => level(m.key) === 'free').map((m) => m.key),
    proKeys: items.filter((m) => level(m.key) === 'pro').map((m) => m.key),
    hiddenKeys: items.filter((m) => level(m.key) === 'hidden').map((m) => m.key),
    proApis, warnings,
  };
}

function fmtTime(ts: number | null): string {
  if (!ts) return '尚未修改（使用出厂口径）';
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const LEVEL_FALLBACK: LevelMeta[] = [
  { id: 'free', label: '免费可见', hint: '' },
  { id: 'pro', label: '会员专享', hint: '' },
  { id: 'hidden', label: '暂不开放', hint: '' },
];

export function ModuleAccess() {
  const [data, setData] = useState<ModuleAccessResult | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError('');
    return adminApi.moduleAccess()
      .then((d) => { setData(d); setDraft({ ...d.levels }); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(() => { void load(); }, []);

  const items = data?.items || [];
  const meta = data?.levelMeta?.length ? data.levelMeta : LEVEL_FALLBACK;
  const preview = useMemo(() => derivePreview(items, draft), [items, draft]);
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: ModuleAccessItem[] }[] = [];
    for (const m of items) {
      let g = out.find((x) => x.key === m.groupKey);
      if (!g) { g = { key: m.groupKey, label: m.group, items: [] }; out.push(g); }
      g.items.push(m);
    }
    return out;
  }, [items]);

  const dirty = !!data && items.some((m) => draft[m.key] && draft[m.key] !== data.levels[m.key]);
  const setLevel = (key: string, lv: ModuleLevel) => {
    setNotice('');
    setDraft((d) => ({ ...d, [key]: lv }));
  };
  const setGroup = (keys: string[], lv: ModuleLevel) => {
    setNotice('');
    setDraft((d) => { const next = { ...d }; for (const k of keys) next[k] = lv; return next; });
  };

  const save = async () => {
    // 该操作直接改写全站会员权益边界，保存前展示变更摘要并要求确认。
    const changes = data ? items.filter((m) => draft[m.key] && draft[m.key] !== data.levels[m.key]) : [];
    if (!changes.length) return;
    const summary = changes.map((m) => `${m.label}：${data!.levels[m.key]} → ${draft[m.key]}`).join('\n');
    if (!window.confirm(`以下 ${changes.length} 个模块的可见性将立即生效：\n\n${summary}\n\n确定保存？`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await adminApi.saveModuleAccess(draft);
      setData(r); setDraft({ ...r.levels });
      setNotice('已保存，主站侧栏与会员中心「权益对照」即时生效');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };
  const reset = async () => {
    if (!window.confirm('恢复出厂口径会覆盖当前配置，确定继续？')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await adminApi.resetModuleAccess();
      setData(r); setDraft({ ...r.levels });
      setNotice('已恢复出厂口径');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>会员模块权限</h1>
          <div className="muted" style={{ marginTop: 4 }}>
            配置各页面对会员的可见性 · 最近更新 {fmtTime(data?.updatedAt ?? null)}
            {data?.updatedBy ? ` · ${data.updatedBy}` : ''}
          </div>
        </div>
        <div className="ma-actions">
          <button className="btn-ghost" disabled={!dirty || busy} onClick={() => { setDraft({ ...(data?.levels || {}) }); setNotice(''); }}>撤销更改</button>
          <button className="btn-ghost" disabled={busy || data?.isDefault} onClick={() => void reset()}>恢复默认</button>
          <button className="btn-primary" disabled={!dirty || busy} onClick={() => void save()}>
            {busy ? '保存中…' : dirty ? '保存生效' : '已保存'}
          </button>
        </div>
      </div>

      <ErrorMsg msg={error} />
      {notice ? <div className="ma-notice ok">{notice}</div> : null}

      <div className="kpi-grid">
        <Kpi label="免费可见" value={preview.freeKeys.length} sub="所有登录用户可用" accent="#059669" />
        <Kpi label="会员专享" value={preview.proKeys.length} sub="免费用户看到锁标与付费墙" accent="#b45309" />
        <Kpi label="暂不开放" value={preview.hiddenKeys.length} sub="侧栏 / 路由 / 权益对照均不出现" />
        <Kpi label="受保护接口" value={preview.proApis.length} sub="由模块级别自动派生" />
      </div>

      <Panel title="配置说明">
        <div className="ma-help">
          <p>三档口径同时作用于三处：<b>主站侧栏与路由</b>、<b>会员中心「权益对照」</b>、<b>后端接口门禁</b>。保存后下一个请求即生效，无需发版或重启。</p>
          <p>多个模块共用同一组接口时（如策略实验室共用 /api/vpos），按最严格口径保护：只要还有一个依赖方不是「免费可见」，接口就仍要求会员。把共用模块一并设为免费才会放开，避免误放开付费数据。</p>
          <p className="muted">{meta.map((m) => `${m.label}：${m.hint}`).join('　·　')}</p>
        </div>
      </Panel>

      {preview.warnings.length ? (
        <div className="ma-notice warn">
          <b>配置提示（{preview.warnings.length}）</b>
          <ul>{preview.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      ) : null}

      <Panel title="模块可见性" extra={<span className="muted">共 {items.length} 个页面</span>}>
        {!data ? <div className="loading">加载中…</div> : groups.map((g) => (
          <div className="ma-group" key={g.key}>
            <div className="ma-group-h">
              <span>{g.label}</span>
              <span className="muted">批量设为</span>
              <div className="ma-batch">
                {meta.map((m) => (
                  <button key={m.id} className="btn-ghost" title={m.hint} onClick={() => setGroup(g.items.map((i) => i.key), m.id)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <table className="table ma-table">
              <thead><tr><th>页面</th><th>受保护接口</th><th>可见性</th></tr></thead>
              <tbody>
                {g.items.map((m) => {
                  const lv = draft[m.key] || m.defaultLevel;
                  return (
                    <tr key={m.key} className={lv !== m.defaultLevel ? 'ma-changed' : ''}>
                      <td>
                        <div>{m.label}</div>
                        <div className="muted mono">{m.key}</div>
                      </td>
                      <td>{m.apis.length ? <span className="muted mono" title={m.apis.join('\n')}>{m.apis.length} 个</span> : <span className="muted">—</span>}</td>
                      <td>
                        <div className="ma-seg" role="group" aria-label={`${m.label} 可见性`}>
                          {meta.map((x) => (
                            <button
                              key={x.id}
                              type="button"
                              title={x.hint}
                              className={'ma-seg-btn ' + x.id + (lv === x.id ? ' on' : '')}
                              aria-pressed={lv === x.id}
                              onClick={() => setLevel(m.key, x.id)}
                            >{x.label}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </Panel>

      <Panel title="会员中心 · 权益对照预览" extra={<span className="muted">与主站「会员中心 → 权益对照」一致</span>}>
        <div className="ma-help muted">「暂不开放」的页面不会出现在对照表中；下表随上方选择实时变化，未保存前主站仍显示旧口径。</div>
        <table className="table ma-preview">
          <thead><tr><th>功能</th><th>免费版</th><th>会员</th></tr></thead>
          <tbody>
            {groups.map((g) => {
              const rows = g.items.filter((m) => (draft[m.key] || m.defaultLevel) !== 'hidden');
              if (!rows.length) return null;
              const nFree = rows.filter((m) => (draft[m.key] || m.defaultLevel) === 'free').length;
              return (
                <FragmentRows key={g.key} label={g.label} count={rows.length} freeCount={nFree}>
                  {rows.map((m) => {
                    const free = (draft[m.key] || m.defaultLevel) === 'free';
                    return (
                      <tr key={m.key}>
                        <td>{m.label}</td>
                        <td className={free ? 'ma-yes' : 'ma-no'}>{free ? '✓' : '—'}</td>
                        <td className="ma-yes">✓</td>
                      </tr>
                    );
                  })}
                </FragmentRows>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

/** 表格里插一行分组标题（不能用 div 直接放在 tbody 下）。 */
function FragmentRows({ label, count, freeCount, children }: {
  label: string; count: number; freeCount: number; children: ReactNode;
}) {
  return (
    <>
      <tr className="ma-preview-g"><td colSpan={3}>{label} <span className="muted">· {count} 项 · 免费 {freeCount}</span></td></tr>
      {children}
    </>
  );
}
