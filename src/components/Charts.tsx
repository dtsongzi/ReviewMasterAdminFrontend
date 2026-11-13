// 表格内联条形（轻量，用于单元格进度条）。折线/柱状图统一用 <EChart />。
export function Bar({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = value > 0 && max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="bar">
      <span style={{ width: pct + '%', background: color || 'var(--accent)' }} />
    </div>
  );
}
