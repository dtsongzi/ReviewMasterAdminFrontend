import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import type { PerformanceResult } from '../api';
import { DaysTabs, Empty, ErrorMsg, Kpi, Panel } from '../components/ui';
import { fmtInt, fmtMs, fmtPct } from '../format';

const SCREEN_LABELS: Record<string, string> = {
  ttfb: 'TTFB 首字节',
  fcp: 'FCP 首次内容绘制',
  lcp: 'LCP 最大内容绘制',
  dom: 'DOMContentLoaded',
  load: '页面加载完成',
};

export function Performance() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<PerformanceResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setError('');
    adminApi.performance(days)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [days]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>性能指标</h1>
        <DaysTabs days={days} onChange={setDays} />
      </div>
      <ErrorMsg msg={error} />

      <Panel title={'首屏性能（近 ' + days + ' 天）'}>
        {!data ? <div className="loading">加载中…</div> : data.screen.length === 0 ? <Empty text="暂无首屏性能数据（需真实浏览器访问）" /> : (
          <div className="kpi-grid">
            {data.screen.map((s) => (
              <Kpi
                key={s.name}
                label={SCREEN_LABELS[s.name] || s.name}
                value={fmtMs(s.avg)}
                sub={'样本 ' + fmtInt(s.count) + ' · 最慢 ' + fmtMs(s.max)}
                accent={s.name === 'lcp' ? '#b45309' : undefined}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel title={'接口耗时（近 ' + days + ' 天）'}>
        {!data ? <div className="loading">加载中…</div> : data.api.length === 0 ? <Empty /> : (
          <table className="table">
            <thead>
              <tr><th>接口</th><th>次数</th><th>平均</th><th>P50</th><th>P95</th><th>最大</th><th>错误率</th></tr>
            </thead>
            <tbody>
              {data.api.map((a) => (
                <tr key={a.name}>
                  <td className="mono">{a.name}</td>
                  <td>{fmtInt(a.count)}</td>
                  <td>{fmtMs(a.avg)}</td>
                  <td>{fmtMs(a.p50)}</td>
                  <td>{fmtMs(a.p95)}</td>
                  <td>{fmtMs(a.max)}</td>
                  <td className={a.errorRate > 0.05 ? 'warn' : ''}>{fmtPct(a.errorRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
