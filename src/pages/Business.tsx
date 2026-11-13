import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../api';
import type { BusinessResult } from '../api';
import { DaysTabs, Empty, ErrorMsg, Panel } from '../components/ui';
import { Bar } from '../components/Charts';
import { EChart } from '../components/EChart';
import type { ChartOption } from '../components/EChart';
import { fmtInt, fmtPct } from '../format';
import { moduleLabel } from '../labels';

export function Business() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<BusinessResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setError('');
    adminApi.business(days)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [days]);

  const modules = data?.modules || [];
  const maxConv = Math.max(0.0001, ...modules.map((m) => m.conversionRate));

  const barOption = useMemo<ChartOption>(() => {
    const top = (data?.modules || []).slice(0, 12);
    return {
      color: ['#4f46e5', '#38bdf8', '#059669'],
      tooltip: { trigger: 'axis' },
      legend: { data: ['浏览', '点击', '转化'], top: 0, textStyle: { color: '#64748b' } },
      grid: { left: 44, right: 16, top: 36, bottom: 58 },
      xAxis: {
        type: 'category', data: top.map((m) => moduleLabel(m.module)),
        axisLabel: { interval: 0, rotate: 28, color: '#64748b', fontSize: 11 },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
      },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef2f7' } }, axisLabel: { color: '#94a3b8' } },
      series: [
        { name: '浏览', type: 'bar', data: top.map((m) => m.views) },
        { name: '点击', type: 'bar', data: top.map((m) => m.clicks) },
        { name: '转化', type: 'bar', data: top.map((m) => m.conversions) },
      ],
    };
  }, [data]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>业务指标</h1>
        <DaysTabs days={days} onChange={setDays} />
      </div>
      <ErrorMsg msg={error} />
      {data && modules.length > 0 ? (
        <Panel title="模块漏斗对比（浏览 / 点击 / 转化）">
          <EChart option={barOption} height={300} />
        </Panel>
      ) : null}
      <Panel title={'各模块转化 / 渗透 / 错误（近 ' + days + ' 天）'} extra={data ? <span className="muted">总用户 {fmtInt(data.totalUsers)}</span> : null}>
        {!data ? <div className="loading">加载中…</div> : modules.length === 0 ? <Empty /> : (
          <table className="table">
            <thead>
              <tr>
                <th>模块</th><th>浏览</th><th>点击</th><th>转化</th><th>独立用户</th>
                <th>渗透率</th><th>点击率</th><th>转化率</th><th>错误率</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((m) => (
                <tr key={m.module}>
                  <td>{moduleLabel(m.module)}</td>
                  <td>{fmtInt(m.views)}</td>
                  <td>{fmtInt(m.clicks)}</td>
                  <td>{fmtInt(m.conversions)}</td>
                  <td>{fmtInt(m.users)}</td>
                  <td>{fmtPct(m.penetration)}</td>
                  <td>{fmtPct(m.ctr)}</td>
                  <td>
                    <div className="cell-bar">
                      <span>{fmtPct(m.conversionRate)}</span>
                      <Bar value={m.conversionRate} max={maxConv} color="#059669" />
                    </div>
                  </td>
                  <td className={m.errorRate > 0.05 ? 'warn' : ''}>{fmtPct(m.errorRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
