// 管理后台 API 客户端：令牌存储、错误码处理、各数据端点类型。

const TOKEN_KEY = 'rm_admin_token';
const USER_KEY = 'rm_admin_user';
// 所有接口统一带 /reviewmaster 前缀（公网根 /api/* 不可达）。
// 以前只在生产构建由 .env.production 注入，本地裸 /api/* 与线上口径不一致；
// 现在默认就有前缀，Vite 代理原样转发到本机后端，由后端剥前缀。
const BASE = (import.meta.env.VITE_API_BASE || '/reviewmaster').replace(/\/+$/, '');

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
export interface UsedCode { code: string; plan: string; days: number; usedAt: number | null; }
export interface UserRow {
  id: string; username: string | null; phone: string | null;
  createdAt: number | null; via: string | null; member: MemberState; lastActive: number | null;
  banned: boolean; banReason: string | null; bannedAt: number | null; usedCode: UsedCode | null;
}
export interface UsersResult { items: UserRow[]; total: number; page: number; size: number; }

export interface MemberCode {
  code: string; plan: string; days: number; note: string | null;
  createdAt: number;
  soldAt: number | null; soldBy: string | null;
  usedBy: string | null; usedAt: number | null; activatedAt: number | null;
  revokedAt: number | null; discardedAt: number | null; discardedBy: string | null;
  status: 'unused' | 'sold' | 'activated' | 'discarded';
  usedUser?: { id: string; username: string | null; phone: string | null } | null;
}
export interface CodesResult {
  items: MemberCode[]; total: number;
  counts: { all: number; unused: number; sold: number; activated: number; discarded: number };
  status: string; q: string;
}
/** 批量操作逐码结算：一部分码状态已变时，其它码仍可成功。 */
export interface BatchCodeItem {
  code: string; ok: boolean; status: string | null;
  error?: string; errorCode?: string;
}
export interface BatchCodesResult {
  items: BatchCodeItem[];
  summary: { requested: number; succeeded: number; failed: number };
}
export interface AnalyticsStats {
  received: number; written: number; dropped: number; flushFails: number;
  rows: number; lastAt: number | null;
}
export interface TopEvent { eventName: string; count: number; users: number; conversions: number; }

export interface LogRecord { ts: string; level: string; module: string; message: string; stack: string; }
export interface LogsResult {
  available: boolean;
  date: string;
  hour: number | null;
  files: string[];
  window: { start: string; end: string } | null;
  total: number;
  returned: number;
  truncated: boolean;
  records: LogRecord[];
  message?: string;
}
export interface ModuleMetric {
  module: string; views: number; impressions: number; clicks: number; conversions: number;
  errors: number; users: number; ctr: number; conversionRate: number; errorRate: number; penetration: number;
}
export interface BusinessResult { days: number; totalUsers: number; modules: ModuleMetric[]; }
export interface ApiMetric { name: string; count: number; avg: number; p50: number; p95: number; max: number; errorRate: number; }
export interface ScreenMetric { name: string; count: number; avg: number; p75: number; max: number; }
export interface PerfStat { count: number; avg: number; p75: number; max: number; }
/** 单个页面的性能汇总：perf 里没有的指标说明该页暂无样本。 */
export interface PageMetric {
  page: string; module: string; views: number; users: number; errors: number;
  perf: Record<string, PerfStat>;
  api: { count: number; avg: number; p95: number; errorRate: number };
  fcpP75: number; lcpP75: number; routeP75: number; apiP95: number; apiErrorRate: number;
}
export interface PageOption { page: string; module: string; views: number; }
export interface PerformanceResult {
  days: number;
  page: string;               // 当前筛选的页面，'' 表示全部
  pages: PageOption[];        // 下拉选项（始终为全部页面）
  api: ApiMetric[];           // 受 page 过滤
  screen: ScreenMetric[];     // 受 page 过滤
  breakdown: PageMetric[];    // 各页面横向对比（不受 page 过滤）
}
// 会员模块可见性：免费可见 / 会员专享 / 暂不开放
export type ModuleLevel = 'free' | 'pro' | 'hidden';
export interface ModuleAccessItem {
  key: string; label: string; group: string; groupKey: string;
  defaultLevel: ModuleLevel; level: ModuleLevel; apis: string[];
}
export interface LevelMeta { id: ModuleLevel; label: string; hint: string; }
export interface ModuleAccessResult {
  ok: boolean;
  levels: Record<string, ModuleLevel>;
  freeKeys: string[]; proKeys: string[]; hiddenKeys: string[];
  proApis: string[]; warnings: string[];
  items: ModuleAccessItem[]; levelMeta: LevelMeta[];
  updatedAt: number | null; updatedBy: string | null; isDefault: boolean;
}

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
  performance: (days: number, page = '') =>
    req<PerformanceResult>('/api/admin/metrics/performance?days=' + days + '&page=' + encodeURIComponent(page)),
  timeseries: (days: number) => req<TimeseriesResult>('/api/admin/timeseries?days=' + days),
  analyticsStats: () => req<AnalyticsStats>('/api/admin/analytics/stats'),
  topEvents: (days: number, limit = 20) => req<{ days: number; items: TopEvent[] }>(`/api/admin/metrics/events?days=${days}&limit=${limit}`),

  // 用户封禁 / 解封
  banUser: (id: string, reason?: string) =>
    req<{ id: string; banned: boolean }>(`/api/admin/users/${encodeURIComponent(id)}/ban`, {
      method: 'POST', body: JSON.stringify({ reason: reason || '' }),
    }),
  unbanUser: (id: string) =>
    req<{ id: string; banned: boolean }>(`/api/admin/users/${encodeURIComponent(id)}/unban`, { method: 'POST' }),

  // 会员兑换码
  memberCodes: (params: { status?: string; q?: string; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.q) qs.set('q', params.q);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    return req<CodesResult>('/api/admin/member-codes?' + qs.toString());
  },
  generateCodes: (params: { plan: string; count: number; note?: string }) =>
    req<{ items: MemberCode[] }>('/api/admin/member-codes/generate', {
      method: 'POST', body: JSON.stringify(params),
    }),
  markSold: (code: string) =>
    req<{ code: string; status: string }>('/api/admin/member-codes/sell', {
      method: 'POST', body: JSON.stringify({ code }),
    }),
  discardCode: (code: string) =>
    req<{ code: string; status: string }>('/api/admin/member-codes/discard', {
      method: 'POST', body: JSON.stringify({ code }),
    }),

  // 批量标记已卖出 / 批量废弃：单次最多 200 个，后端逐码返回成败
  markSoldBatch: (codes: string[]) =>
    req<BatchCodesResult>('/api/admin/member-codes/sell', {
      method: 'POST', body: JSON.stringify({ codes }),
    }),
  discardCodesBatch: (codes: string[]) =>
    req<BatchCodesResult>('/api/admin/member-codes/discard', {
      method: 'POST', body: JSON.stringify({ codes }),
    }),

  // 会员模块可见性
  moduleAccess: () => req<ModuleAccessResult>('/api/admin/module-access'),
  saveModuleAccess: (levels: Record<string, ModuleLevel>) =>
    req<ModuleAccessResult>('/api/admin/module-access', {
      method: 'PUT', body: JSON.stringify({ levels }),
    }),
  resetModuleAccess: () =>
    req<ModuleAccessResult>('/api/admin/module-access/reset', { method: 'POST', body: '{}' }),

  // 线上日志查询
  logs: (params: { date: string; hour?: number | null; level?: string; module?: string; q?: string; limit?: number }) => {
    const qs = new URLSearchParams({ date: params.date });
    if (params.hour != null) qs.set('hour', String(params.hour));
    if (params.level) qs.set('level', params.level);
    if (params.module) qs.set('module', params.module);
    if (params.q) qs.set('q', params.q);
    if (params.limit) qs.set('limit', String(params.limit));
    return req<LogsResult>('/api/admin/logs?' + qs.toString());
  },
};
