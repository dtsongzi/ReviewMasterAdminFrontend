// 零依赖图表：折线图（多序列）与横向进度条。SVG 绘制，随容器缩放。

export interface LineSeries {
  name: string;
  color: string;
  values: number[];
}

export function LineChart({ labels, series, height = 220 }: { labels: string[]; series: LineSeries[]; height?: number }) {
  const W = 820;
  const H = height;
  const P = { l: 44, r: 16, t: 14, b: 28 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const n = labels.length;
  const px = (i: number) => (n <= 1 ? P.l : P.l + (iw * i) / (n - 1));
  const py = (v: number) => P.t + ih - (Math.max(0, v) / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const xTicks = n === 0 ? [] : [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
        {ticks.map((t, i) => {
          const y = P.t + ih - t * ih;
          return (
            <g key={i}>
              <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="var(--grid)" strokeWidth="1" />
              <text x={P.l - 8} y={y + 4} textAnchor="end" className="axis">{Math.round(max * t)}</text>
            </g>
          );
        })}
        {series.map((s) => (
          <polyline
            key={s.name}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={s.values.map((v, i) => `${px(i)},${py(v)}`).join(' ')}
          />
        ))}
        {xTicks.map((i) => (
          <text
            key={i}
            x={px(i)}
            y={H - 8}
            textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            className="axis"
          >
            {labels[i]}
          </text>
        ))}
      </svg>
      <div className="legend">
        {series.map((s) => (
          <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>
        ))}
      </div>
    </div>
  );
}

export function Bar({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = value > 0 && max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="bar">
      <span style={{ width: pct + '%', background: color || 'var(--accent)' }} />
    </div>
  );
}
