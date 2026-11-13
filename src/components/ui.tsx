import type { ReactNode } from 'react';

export function Kpi({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={accent ? { color: accent } : undefined}>{value}</div>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
    </div>
  );
}

export function Panel({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      <header className="panel-h">
        <h2>{title}</h2>
        {extra ? <div className="panel-extra">{extra}</div> : null}
      </header>
      <div className="panel-b">{children}</div>
    </section>
  );
}

export function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div className="error-box">加载失败：{msg}</div>;
}

export function Empty({ text = '暂无数据' }: { text?: string }) {
  return <div className="empty">{text}</div>;
}

export function DaysTabs({ days, onChange, options = [7, 30, 90] }: { days: number; onChange: (d: number) => void; options?: number[] }) {
  return (
    <div className="tabs">
      {options.map((d) => (
        <button key={d} className={'tab' + (d === days ? ' active' : '')} onClick={() => onChange(d)}>
          近 {d} 天
        </button>
      ))}
    </div>
  );
}
