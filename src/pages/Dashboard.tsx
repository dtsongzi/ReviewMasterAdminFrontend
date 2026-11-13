import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../api';
import type { AnalyticsStats, ModuleMetric, Overview, SeriesPoint, TopEvent } from '../api';
import { DaysTabs, Empty, ErrorMsg, Kpi, Panel } from '../components/ui';
import { EChart } from '../components/EChart';
import type { ChartOption } from '../components/EChart';
import { fmtDateTime, fmtInt, fmtPct } from '../format';
import { moduleLabel } from '../labels';

export function Dashboard() {
  const [days, setDays] = useState(7);
  const [ov, setOv] = useState<Overview | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [modules, setModules] = useState<ModuleMetric[]>([]);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [events, setEvents] = useState<TopEvent[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setError('');
    Promise.all([
      adminApi.overview(days),
      adminApi.timeseries(days),
      adminApi.business(days),
      adminApi.analyticsStats().catch(() => null),
      adminApi.topEvents(days, 15).catch(() => ({ days, items: [] as TopEvent[] })),
    ])
      .then(([o, t, b, s, ev]) => {
        if (!alive) return;
        setOv(o);
        setSeries(t.series);
        setModules(b.modules.slice(0, 8));
        setStats(s);
        setEvents(ev.items);
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [days]);

  const lineOption = useMemo<ChartOption>(() => ({
    color: ['#4f46e5', '#059669', '#dc2626'],
    tooltip: { trigger: 'axis' },
    legend: { data: ['活跃用户', '转化', '错误'], right: 0, top: 0, textStyle: { color: '#64748b' } },
    grid: { left: 44, right: 16, top: 36, bottom: 28 },
    xAxis: {
      type: 'category', boundaryGap: false, data: series.map((s) => s.date.slice(5)),
      axisLine: { lineStyle: { color: '#e2e8f0' } }, axisLabel: { color: '#94a3b8' },
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef2f7' } }, axisLabel: { color: '#94a3b8' } },
    series: [
      { name: '活跃用户', type: 'line', smooth: true, symbol: 'none', areaStyle: { color: 'rgba(79,70,229,.10)' }, data: series.map((s) => s.users) },
      { name: '转化', type: 'line', smooth: true, symbol: 'none', data: series.map((s) => s.conversions) },
      { name: '错误', type: 'line', smooth: true, symbol: 'none', data: series.map((s) => s.errors) },
    ],
  }), [series]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>数据概览</h1>
        <DaysTabs days={days} onChange={setDays} />
      </div>
      <ErrorMsg msg={error} />
      {!ov ? <div className="loading">加载中…</div> : (
        <>
          <div className="kpi-grid">
            <Kpi label="用户总数" value={fmtInt(ov.totalUsers)} sub={'近 ' + days + ' 天新增 ' + fmtInt(ov.newUsers)} />
            <Kpi label="会员数" value={fmtInt(ov.members)} accent="#b45309" sub={'占比 ' + fmtPct(ov.totalUsers ? ov.members / ov.totalUsers : 0)} />
            <Kpi label="活跃用户" value={fmtInt(ov.activeUsers)} accent="#4f46e5" sub={'近 ' + days + ' 天有埋点'} />
            <Kpi label="事件总数" value={fmtInt(ov.events)} sub={'近 ' + days + ' 天'} />
            <Kpi label="转化次数" value={fmtInt(ov.conversions)} accent="#059669" sub={'近 ' + days + ' 天'} />
            <Kpi label="错误次数" value={fmtInt(ov.errors)} accent="#dc2626" sub={'近 ' + days + ' 天'} />
          </div>

          <Panel title={'趋势（近 ' + days + ' 天）'}>
            {series.length === 0 ? <Empty /> : <EChart option={lineOption} height={260} />}
          </Panel>

          <Panel title="模块表现 Top 8">
            {modules.length === 0 ? <Empty /> : (
              <table className="table">
                <thead>
                  <tr><th>模块</th><th>浏览</th><th>点击</th><th>转化</th><th>转化率</th></tr>
                </thead>
                <tbody>
                  {modules.map((m) => (
                    <tr key={m.module}>
                      <td>{moduleLabel(m.module)}</td>
                      <td>{fmtInt(m.views)}</td>
                      <td>{fmtInt(m.clicks)}</td>
                      <td>{fmtInt(m.conversions)}</td>
                      <td>{fmtPct(m.conversionRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="埋点落库" extra={stats ? <span className="muted">已落库 {fmtInt(stats.rows)} 行</span> : null}>
            {!stats ? <div className="loading">加载中…</div> : (
              <div className="kpi-grid">
                <Kpi label="已落库行数" value={fmtInt(stats.rows)} sub={stats.lastAt ? '最近写入 ' + fmtDateTime(stats.lastAt) : '暂无写入'} />
                <Kpi label="接收（本次进程）" value={fmtInt(stats.received)} />
                <Kpi label="已写入" value={fmtInt(stats.written)} accent="#059669" />
                <Kpi
                  label="丢弃"
                  value={fmtInt(stats.dropped)}
                  accent={stats.dropped ? '#dc2626' : undefined}
                  sub={stats.flushFails ? '写失败 ' + stats.flushFails + ' 次' : ''}
                />
              </div>
            )}
          </Panel>

          <Panel title="埋点名 Top 15">
            {events.length === 0 ? <Empty /> : (
              <table className="table">
                <thead>
                  <tr><th>埋点名（英文）</th><th>次数</th><th>独立用户</th><th>转化</th></tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.eventName}>
                      <td className="mono">{e.eventName}</td>
                      <td>{fmtInt(e.count)}</td>
                      <td>{fmtInt(e.users)}</td>
                      <td>{fmtInt(e.conversions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
