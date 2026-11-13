export function fmtInt(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString('zh-CN');
}
export function fmtPct(v: number | null | undefined): string {
  return ((Number(v) || 0) * 100).toFixed(1) + '%';
}
export function fmtMs(v: number | null | undefined): string {
  const n = Number(v) || 0;
  if (!n) return '0 ms';
  return n >= 1000 ? (n / 1000).toFixed(2) + ' s' : Math.round(n) + ' ms';
}
export function fmtDateTime(ms: number | null | undefined): string {
  if (!ms) return '—';
  return new Date(Number(ms)).toLocaleString('zh-CN', { hour12: false });
}
export function fmtDate(ms: number | null | undefined): string {
  if (!ms) return '—';
  return new Date(Number(ms)).toLocaleDateString('zh-CN');
}
