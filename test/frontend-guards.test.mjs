// 前端缺陷回归守卫：与本仓现有测试一致，采用源码静态检查（无 DOM 测试环境）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const count = (src, re) => [...src.matchAll(re)].length;

test('日志页：筛选变化经 250-300ms 防抖，手动刷新可跳过防抖', () => {
  const src = read('src/pages/Logs.tsx');
  const m = src.match(/const DEBOUNCE_MS = (\d+);/);
  assert.ok(m, '必须定义防抖延时常量');
  const ms = Number(m[1]);
  assert.ok(ms >= 250 && ms <= 300, `防抖延时应在 250-300ms，实际 ${ms}`);
  assert.match(src, /setTimeout\(\(\) => \{ debounceRef\.current = null; void load\(\); \}, DEBOUNCE_MS\)/,
    '筛选条件变化必须通过防抖定时器发起查询');
  assert.match(src, /useEffect\(\(\) => \{[\s\S]*?\}, \[load\]\);/, '防抖需随筛选条件变化重新调度');
  assert.ok(count(src, /clearTimeout\(debounceRef\.current\)/g) >= 2, '防抖定时器必须被清理');
  assert.match(src, /const loadNow = useCallback\(/, '手动触发需有立即查询入口');
  assert.match(src, /onClick=\{loadNow\}/, '刷新按钮应走立即查询');
});

test('日志页：自增序号 + AbortController 守卫，乱序旧响应不得回写', () => {
  const src = read('src/pages/Logs.tsx');
  assert.match(src, /const requestIdRef = useRef\(0\)/, '需要自增请求序号');
  assert.match(src, /\+\+requestIdRef\.current/, '每次查询必须递增序号');
  assert.match(src, /const abortRef = useRef<AbortController \| null>\(null\)/);
  assert.match(src, /new AbortController\(\)/);
  assert.match(src, /abortRef\.current\?\.abort\(\)/, '发起新查询时需取消旧请求');
  assert.ok(count(src, /id !== requestIdRef\.current \|\| controller\.signal\.aborted/g) >= 2,
    '成功与失败路径都必须丢弃过期/已取消响应');
  assert.match(src, /if \(id === requestIdRef\.current\) setLoading\(false\)/, '过期请求不得复位 loading');
  assert.match(src, /\{ signal: controller\.signal \}/, '取消信号需要透传到 api 层');
});

test('请求层：默认 15s 超时、支持外部 signal、清理定时器且保留鉴权清会话', () => {
  const src = read('src/api.ts');
  assert.match(src, /DEFAULT_TIMEOUT_MS = 15000/, '默认超时应为 15 秒');
  assert.match(src, /timeoutMs: number = DEFAULT_TIMEOUT_MS/, '超时时间应可配置');
  assert.match(src, /new AbortController\(\)/);
  assert.match(src, /setTimeout\(\(\) => \{ timedOut = true; controller\.abort\(\); \}, timeoutMs\)/);
  assert.match(src, /signal: controller\.signal/, 'fetch 必须接内部控制器信号');
  assert.match(src, /external\.addEventListener\('abort', forwardAbort/, '外部 signal 要能取消请求');
  assert.match(src, /clearTimeout\(timer\)/, '结束时必须清理超时定时器');
  assert.match(src, /if \(timedOut\) throw new ApiError\('请求超时，请稍后重试', 'TIMEOUT'\)/, '超时必须抛出明确错误');
  assert.match(src, /r\.status === 401\) clearSession\(\)/, 'HTTP 401 清会话逻辑不得丢失');
  assert.match(src, /AUTH_ADMIN_REQUIRED' \|\| code === 'AUTH_UNAUTHORIZED'\) clearSession\(\)/,
    '业务码清会话逻辑不得丢失');
  assert.match(src, /logs: \(params: \{[\s\S]*?\}, opts\?: \{ signal\?: AbortSignal \}\)/, '日志接口需透传 signal');
});

test('错误边界：包裹路由，提供友好提示与「重新加载」按钮', () => {
  const app = read('src/App.tsx');
  const eb = read('src/components/ErrorBoundary.tsx');
  assert.match(app, /import \{ ErrorBoundary \} from '\.\/components\/ErrorBoundary'/);
  assert.match(app, /<ErrorBoundary>[\s\S]*<HashRouter>/, '错误边界需在路由外层');
  assert.match(eb, /extends Component<Props, State>/);
  assert.match(eb, /static getDerivedStateFromError/);
  assert.match(eb, /override componentDidCatch/);
  assert.match(eb, /页面出错了/);
  assert.match(eb, /重新加载/);
});

test('首屏体积：图表页走动态 import，静态导入链不含 ECharts', () => {
  const app = read('src/App.tsx');
  for (const page of ['Dashboard', 'Business', 'Performance']) {
    assert.match(app, new RegExp(`lazy\\(\\(\\) => import\\('\\./pages/${page}'\\)`),
      `${page} 必须懒加载`);
    assert.ok(!new RegExp(`import \\{ ${page} \\} from './pages/${page}'`).test(app),
      `${page} 不得静态导入`);
  }
  assert.match(app, /<Suspense fallback=/, '懒加载需有 Suspense 占位');
  // 入口静态依赖的页面不允许直接引用 EChart（否则 echarts 会重新进入首屏预加载）。
  for (const file of [
    'src/pages/Login.tsx', 'src/pages/Users.tsx', 'src/pages/Logs.tsx',
    'src/pages/ModuleAccess.tsx', 'src/pages/Courses.tsx', 'src/pages/DataConfig.tsx',
    'src/pages/Admins.tsx', 'src/components/Layout.tsx',
  ]) {
    assert.ok(!/from '\.\/components\/EChart'|from '\.\.\/components\/EChart'/.test(read(file)),
      `${file} 不应静态引用 EChart`);
  }
});
