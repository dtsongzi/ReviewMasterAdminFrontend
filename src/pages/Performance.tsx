import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../api';
import type { PageMetric, PerformanceResult, PerfStat } from '../api';
import { DaysTabs, Empty, ErrorMsg, Kpi, Panel } from '../components/ui';
import { EChart } from '../components/EChart';
import type { ChartOption } from '../components/EChart';
import { fmtInt, fmtMs, fmtPct } from '../format';
import { MODULE_LABELS } from '../labels';

const SCREEN_LABELS: Record<string, string> = {
  ttfb: 'TTFB 首字节',
  fcp: 'FCP 首次内容绘制',
  lcp: 'LCP 最大内容绘制',
  dom: 'DOMContentLoaded',
  load: '页面加载完成',
  route: 'SPA 页面切换',
};

/** 页面展示名优先用主站导航中文名，未登记时退回路由路径。 */
function pageTitle(row: { page: string; module: string }): string {
  return (row.module && MODULE_LABELS[row.module]) || row.page || '（未知页面）';
}

function p75Text(stat?: PerfStat): string {
  return stat && stat.count ? fmtMs(stat.p75) : '—';
}

export function Performance() {
  const [days, setDays] = useState(7);
  const [page, setPage] = useState('');
  const [data, setData] = useState<PerformanceResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setError('');
    adminApi.performance(days, page)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [days, page]);

  const scopeLabel = useMemo(() => {
    if (!page) return '全部页面';
    const hit = data?.pages.find((p) => p.page === page);
    return hit ? pageTitle(hit) : page;
  }, [page, data]);

  const barOption = useMemo<ChartOption>(() => {
    const top = [...(data?.api || [])].sort((a, b) => b.p95 - a.p95).slice(0, 10).reverse();
    return {
      color: ['#4f46e5'],
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 190, right: 76, top: 16, bottom: 24 },
      xAxis: {
        type: 'value', splitLine: { lineStyle: { color: '#eef2f7' } },
        axisLabel: { color: '#94a3b8', formatter: '{value} ms' },
      },
      yAxis: {
        type: 'category', data: top.map((a) => a.name),
        axisLabel: { color: '#475569', fontSize: 11, width: 170, overflow: 'truncate' },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
      },
      series: [{
        name: 'P95', type: 'bar', data: top.map((a) => a.p95), barWidth: 14,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', formatter: '{c} ms', color: '#64748b' },
      }],
    };
  }, [data]);

  // 各页面横向对比：按浏览量取前 10，比较 LCP 与 SPA 切换耗时。
  const pageChart = useMemo<{ option: ChartOption; rows: PageMetric[] }>(() => {
    const rows = [...(data?.breakdown || [])]
      .filter((p) => p.lcpP75 > 0 || p.routeP75 > 0)
      .sort((a, b) => b.views - a.views)
      .slice(0, 10).reverse();
    const labels = rows.map(pageTitle);
    return {
      rows,
      option: {
        color: ['#b45309', '#4f46e5'],
        legend: { data: ['LCP P75', '切换 P75'], top: 0, textStyle: { color: '#64748b' } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 130, right: 70, top: 30, bottom: 24 },
        xAxis: {
          type: 'value', splitLine: { lineStyle: { color: '#eef2f7' } },
          axisLabel: { color: '#94a3b8', formatter: '{value} ms' },
        },
        yAxis: {
          type: 'category', data: labels,
          axisLabel: { color: '#475569', fontSize: 11, width: 118, overflow: 'truncate' },
          axisLine: { lineStyle: { color: '#e2e8f0' } },
        },
        series: [
          { name: 'LCP P75', type: 'bar', data: rows.map((p) => p.lcpP75), barMaxWidth: 12, itemStyle: { borderRadius: [0, 4, 4, 0] } },
          { name: '切换 P75', type: 'bar', data: rows.map((p) => p.routeP75), barMaxWidth: 12, itemStyle: { borderRadius: [0, 4, 4, 0] } },
        ],
      } as ChartOption,
    };
  }, [data]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>性能指标</h1>
        <div className="perf-controls">
          <label className="page-scope">
            页面
            <select value={page} onChange={(e) => setPage(e.target.value)} aria-label="按页面筛选性能指标">
              <option value="">全部页面</option>
              {(data?.pages || []).map((p) => (
                <option key={p.page} value={p.page}>{pageTitle(p)}</option>
              ))}
            </select>
          </label>
          {page ? <button className="btn-ghost btn-sm" onClick={() => setPage('')}>清除筛选</button> : null}
          <DaysTabs days={days} onChange={setDays} />
        </div>
      </div>
      <ErrorMsg msg={error} />
      {page ? <div className="scope-hint">当前仅统计「{scopeLabel}」的埋点数据；下方「各页面性能对比」仍展示全部页面。</div> : null}

      <Panel title={'页面性能 · ' + scopeLabel + '（近 ' + days + ' 天）'}>
        {!data ? <div className="loading">加载中…</div> : data.screen.length === 0 ? <Empty text="暂无该页性能数据（需真实浏览器访问，且前端 SDK 已带页面维度）" /> : (
          <div className="kpi-grid">
            {data.screen.map((s) => (
              <Kpi
                key={s.name}
                label={SCREEN_LABELS[s.name] || s.name}
                value={fmtMs(s.avg)}
                sub={'P75 ' + fmtMs(s.p75) + ' · 最慢 ' + fmtMs(s.max) + ' · 样本 ' + fmtInt(s.count)}
                accent={s.name === 'lcp' ? '#b45309' : undefined}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel title={'各页面性能对比（近 ' + days + ' 天）'}>
        {!data ? <div className="loading">加载中…</div> : data.breakdown.length === 0 ? <Empty text="暂无页面数据" /> : (
          <>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>页面</th><th>浏览量</th><th>用户</th>
                    <th>FCP P75</th><th>LCP P75</th><th>切换 P75</th>
                    <th>接口 P95</th><th>接口错误率</th><th>前端异常</th>
                  </tr>
                </thead>
                <tbody>
                  {data.breakdown.map((p) => (
                    <tr
                      key={p.page}
                      className={'row-link' + (page === p.page ? ' row-active' : '')}
                      onClick={() => setPage(page === p.page ? '' : p.page)}
                      title={'点击查看「' + pageTitle(p) + '」的明细'}
                    >
                      <td>
                        <div>{pageTitle(p)}</div>
                        <div className="muted mono">{p.page}</div>
                      </td>
                      <td>{fmtInt(p.views)}</td>
                      <td>{fmtInt(p.users)}</td>
                      <td>{p75Text(p.perf.fcp)}</td>
                      <td>{p75Text(p.perf.lcp)}</td>
                      <td>{p75Text(p.perf.route)}</td>
                      <td>{p.api.count ? fmtMs(p.apiP95) : '—'}</td>
                      <td className={p.apiErrorRate > 0.05 ? 'warn' : ''}>{p.api.count ? fmtPct(p.apiErrorRate) : '—'}</td>
                      <td className={p.errors > 0 ? 'warn' : ''}>{fmtInt(p.errors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="muted" style={{ marginTop: 10 }}>
              点击任意一行可切换上方明细的页面范围。FCP / LCP 在整页加载时采集，「切换」为 SPA 路由切换耗时；
              「—」表示该页暂无样本。页面维度性能数据随新版前端埋点开始积累。
            </div>
          </>
        )}
      </Panel>

      {data && pageChart.rows.length > 0 ? (
        <Panel title="页面首屏 / 切换 P75 对比（按浏览量 Top 10）">
          <EChart option={pageChart.option} height={Math.max(220, Math.min(420, pageChart.rows.length * 34 + 60))} />
        </Panel>
      ) : null}

      {data && data.api.length > 0 ? (
        <Panel title={'接口 P95 耗时 Top 10 · ' + scopeLabel}>
          <EChart option={barOption} height={Math.max(220, Math.min(400, data.api.length * 26 + 40))} />
        </Panel>
      ) : null}

      <Panel title={'接口耗时 · ' + scopeLabel + '（近 ' + days + ' 天）'}>
        {!data ? <div className="loading">加载中…</div> : data.api.length === 0 ? <Empty /> : (
          <div className="table-scroll">
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
          </div>
        )}
      </Panel>
    </div>
  );
}
