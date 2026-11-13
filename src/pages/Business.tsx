import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import type { BusinessResult } from '../api';
import { DaysTabs, Empty, ErrorMsg, Panel } from '../components/ui';
import { Bar } from '../components/Charts';
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

  return (
    <div className="page">
      <div className="page-head">
        <h1>业务指标</h1>
        <DaysTabs days={days} onChange={setDays} />
      </div>
      <ErrorMsg msg={error} />
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
