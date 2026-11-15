import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('接口前缀：api.ts 默认 /reviewmaster，本地与生产口径一致', () => {
  const src = read('src/api.ts');
  assert.match(src, /import\.meta\.env\.VITE_API_BASE \|\| '\/(?:reviewmaster)'/);
  assert.ok(!/VITE_API_BASE \|\| ''\)/.test(src), '不允许退回空前缀（裸 /api/*）');
  assert.match(src, /fetch\(BASE \+ path/, '所有请求必须经 BASE 拼接');
  const bare = [...src.matchAll(/fetch\(\s*['"`]\/api\//g)];
  assert.equal(bare.length, 0, '存在绕过前缀的裸 fetch');
});

test('接口前缀：所有端点都走 req()，且路径保持 /api/* 相对形态', () => {
  const src = read('src/api.ts');
  const endpoints = [...src.matchAll(/req<[^>]*>\(\s*['"`](\/api\/[^'"`]+)/g)].map(m => m[1]);
  assert.ok(endpoints.length >= 15, `端点数量异常：${endpoints.length}`);
  assert.ok(endpoints.every(p => p.startsWith('/api/')), '端点路径不应自行带应用前缀（由 BASE 统一拼）');
});

test('Vite 代理：带前缀的接口路径原样转发到本机后端', () => {
  const vite = read('vite.config.ts');
  assert.match(vite, /'\/reviewmaster\/api'/);
  assert.match(vite, /'\/reviewmaster\/health'/);
  assert.ok(!/rewrite\s*:/.test(vite), '后端已负责剥前缀，代理不应再配置 rewrite 规则');
});
