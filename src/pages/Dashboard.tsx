import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import type { ModuleMetric, Overview, SeriesPoint } from '../api';
import { DaysTabs, Empty, ErrorMsg, Kpi, Panel } from '../components/ui';
import { LineChart } from '../components/Charts';
import { fmtInt, fmtPct } from '../format';
import { moduleLabel } from '../labels';

export function Dashboard() {
  const [days, setDays] = useState(7);
  const [ov, setOv] = useState<Overview | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [modules, setModules] = useState<ModuleMetric[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setError('');
    Promise.all([adminApi.overview(days), adminApi.timeseries(days), adminApi.business(days)])
      .then(([o, t, b]) => {
        if (!alive) return;
        setOv(o);
        setSeries(t.series);
        setModules(b.modules.slice(0, 8));
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [days]);

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
            {series.length === 0 ? <Empty /> : (
              <LineChart
                labels={series.map((s) => s.date.slice(5))}
                series={[
                  { name: '活跃用户', color: '#4f46e5', values: series.map((s) => s.users) },
                  { name: '转化', color: '#059669', values: series.map((s) => s.conversions) },
                  { name: '错误', color: '#dc2626', values: series.map((s) => s.errors) },
                ]}
              />
            )}
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
        </>
      )}
    </div>
  );
}
