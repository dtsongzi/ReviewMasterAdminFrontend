// 管理后台 API 客户端：令牌存储、错误码处理、各数据端点类型。

const TOKEN_KEY = 'rm_admin_token';
const USER_KEY = 'rm_admin_user';
const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

export class ApiError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function getUsername(): string {
  try { return localStorage.getItem(USER_KEY) || 'admin'; } catch { return 'admin'; }
}
export function saveSession(token: string, username: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, username); } catch { /* ignore */ }
}
export function clearSession(): void {
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
}

export interface Overview {
  days: number; totalUsers: number; members: number; newUsers: number;
  activeUsers: number; events: number; conversions: number; errors: number;
}
export interface MemberState {
  plan: string; isPro: boolean; isTrial: boolean; trialUsed: boolean;
  expireAt: number | null; since: number | null; daysLeft: number;
}
export interface UserRow {
  id: string; username: string | null; phone: string | null;
  createdAt: number | null; via: string | null; member: MemberState; lastActive: number | null;
}
export interface UsersResult { items: UserRow[]; total: number; page: number; size: number; }
export interface ModuleMetric {
  module: string; views: number; impressions: number; clicks: number; conversions: number;
  errors: number; users: number; ctr: number; conversionRate: number; errorRate: number; penetration: number;
}
export interface BusinessResult { days: number; totalUsers: number; modules: ModuleMetric[]; }
export interface ApiMetric { name: string; count: number; avg: number; p50: number; p95: number; max: number; errorRate: number; }
export interface ScreenMetric { name: string; count: number; avg: number; max: number; }
export interface PerformanceResult { days: number; api: ApiMetric[]; screen: ScreenMetric[]; }
export interface SeriesPoint { date: string; events: number; users: number; conversions: number; errors: number; }
export interface TimeseriesResult { days: number; series: SeriesPoint[]; }

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = Object.assign({}, (opts.headers as Record<string, string>) || {});
  const token = getToken();
  if (token) headers['X-Fp-Token'] = token;
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const r = await fetch(BASE + path, { ...opts, headers });
  let data: Record<string, unknown> | null = null;
  try { data = await r.json() as Record<string, unknown>; } catch { /* 非 JSON */ }

  if (!r.ok) {
    throw new ApiError(String((data && (data.message || data.error)) || ('请求失败 ' + r.status)), data?.code as string | undefined);
  }
  if (data && data.ok === false) {
    const code = data.code as string | undefined;
    if (code === 'AUTH_UNAUTHORIZED') clearSession();
    throw new ApiError(String(data.message || '请求失败'), code);
  }
  return data as T;
}

export const adminApi = {
  login: (username: string, password: string) =>
    req<{ token: string; username: string; ttl: number }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => req<{ username: string }>('/api/admin/me'),
  overview: (days: number) => req<Overview>('/api/admin/overview?days=' + days),
  users: (params: { page: number; size: number; q?: string }) => {
    const qs = new URLSearchParams({ page: String(params.page), size: String(params.size) });
    if (params.q) qs.set('q', params.q);
    return req<UsersResult>('/api/admin/users?' + qs.toString());
  },
  business: (days: number) => req<BusinessResult>('/api/admin/metrics/business?days=' + days),
  performance: (days: number) => req<PerformanceResult>('/api/admin/metrics/performance?days=' + days),
  timeseries: (days: number) => req<TimeseriesResult>('/api/admin/timeseries?days=' + days),
};
