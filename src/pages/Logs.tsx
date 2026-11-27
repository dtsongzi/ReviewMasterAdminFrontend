import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { adminApi } from '../api';
import type { LogsResult } from '../api';
import { Empty, ErrorMsg, Panel } from '../components/ui';
import { fmtInt } from '../format';

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 日志时间：完整日期 + 时分秒.毫秒（浏览器本地时区，默认即 Asia/Shanghai）。 */
function fmtLogTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

const LEVELS = ['', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
const LIMITS = [100, 200, 500, 1000];
/** 筛选条件变化后的防抖延时：避免逐字符输入触发查询风暴。 */
const DEBOUNCE_MS = 280;

export function Logs() {
  const [date, setDate] = useState<string>(today);
  const [hour, setHour] = useState<number | ''>('');
  const [level, setLevel] = useState('');
  const [module, setModule] = useState('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(200);
  const [auto, setAuto] = useState(false);
  const [data, setData] = useState<LogsResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 自增序号 + AbortController 双重守卫：旧请求被中止且不允许回写，只接受最新一次查询的响应。
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const id = ++requestIdRef.current;
    setLoading(true);
    setError('');
    try {
      const r = await adminApi.logs({
        date,
        hour: hour === '' ? null : hour,
        level: level || undefined,
        module: module.trim() || undefined,
        q: q.trim() || undefined,
        limit,
      }, { signal: controller.signal });
      if (id !== requestIdRef.current || controller.signal.aborted) return;
      setData(r);
    } catch (e) {
      // 被新查询取代/组件卸载导致的取消不是错误，不展示也不回写。
      if (id !== requestIdRef.current || controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === requestIdRef.current) setLoading(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [date, hour, level, module, q, limit]);

  // 手动触发（刷新按钮 / 表单提交 / 自动刷新）立即查询，并取消待执行的防抖。
  const loadNow = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    void load();
  }, [load]);

  useEffect(() => {
    debounceRef.current = setTimeout(() => { debounceRef.current = null; void load(); }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    };
  }, [load]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => { loadNow(); }, 10000);
    return () => clearInterval(t);
  }, [auto, loadNow]);

  function submit(e: FormEvent) {
    e.preventDefault();
    loadNow();
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>日志查询</h1>
        <div className="toolbar" style={{ margin: 0 }}>
          <label className="auto-toggle">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            每 10 秒自动刷新
          </label>
          <button className="btn-ghost" type="button" onClick={loadNow} disabled={loading}>
            {loading ? '查询中…' : '刷新'}
          </button>
        </div>
      </div>

      <ErrorMsg msg={error} />

      <Panel title="筛选条件">
        <form className="filters" onSubmit={submit}>
          <label>日期<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>
            小时
            <select value={hour} onChange={(e) => setHour(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">全天</option>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}:00 - {String(i).padStart(2, '0')}:59</option>
              ))}
            </select>
          </label>
          <label>
            级别
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => <option key={l} value={l}>{l || '全部'}</option>)}
            </select>
          </label>
          <label>模块<input value={module} onChange={(e) => setModule(e.target.value)} placeholder="如 premarket / errors" /></label>
          <label className="grow">关键字<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="消息 / 堆栈内容" /></label>
          <label>
            条数
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {LIMITS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button className="btn-primary" type="submit" disabled={loading}>查询</button>
        </form>
      </Panel>

      <div className="log-meta">
        {data ? (
          <>
            <span>共 {fmtInt(data.total)} 条，显示 {fmtInt(data.returned)} 条</span>
            {data.files.length ? <span>文件：{data.files.join(', ')}</span> : null}
            {data.truncated ? <span className="warn">结果已截断（仅显示最近部分）</span> : null}
            <span>时区：Asia/Shanghai（+08:00）</span>
          </>
        ) : <span>加载中…</span>}
      </div>

      <Panel title="查询结果">
        {!data ? <div className="loading">加载中…</div> : !data.available ? (
          <Empty text={data.message || '日志文件不存在'} />
        ) : data.records.length === 0 ? <Empty text="该时间范围没有匹配日志" /> : (
          <div className="log-list">
            {data.records.map((r, i) => (
              <div className="log-item" key={r.ts + i}>
                <div className="log-head">
                  <span className="log-time" title={'UTC: ' + r.ts}>{fmtLogTime(r.ts)}</span>
                  <span className={'lv lv-' + r.level}>{r.level}</span>
                  <span className="log-module">[{r.module}]</span>
                </div>
                <div className="log-msg">{r.message}</div>
                {r.stack ? (
                  <details className="log-stack">
                    <summary>堆栈</summary>
                    <pre>{r.stack}</pre>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
