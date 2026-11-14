# 复盘大师 · 管理后台

React + TypeScript + Vite + **ECharts**（按需引入）。HashRouter，可部署到任意子路径。

**默认分支：`develop`**（本仓库只使用 develop）。

## 功能

- **登录**：管理员账号（后端 `ADMIN_USERNAME` / `ADMIN_PASSWORD`），JWT 12h。
- **数据概览**：用户数、会员数、新增、活跃、事件、转化、错误；ECharts 趋势折线；模块 Top 8；
  埋点落库统计（行数/接收/写入/丢弃）与埋点名 Top 15。
- **用户管理**：搜索（用户名/手机号/ID）、分页；展示 id、手机号、会员状态、注册时间、最后活跃；
  **封禁 / 解封**（封禁后旧令牌立即失效），并展示该用户**使用的会员码**。
- **会员兑换码**（用户管理页下方独立区域）：生成（初始「未使用」）；
  状态 `未使用 / 已卖出 / 已激活 / 已废弃` 筛选与计数；
  未使用可「标记已卖出」或废弃，已卖出可废弃；查看使用人、卖出/激活/创建时间。
- **业务指标**：ECharts 模块漏斗柱状图 + 表格（浏览/点击/转化/渗透率/点击率/转化率/错误率）。
- **性能指标**：ECharts 接口 P95 Top 10 横向柱状 + 首屏 TTFB/FCP/LCP/DOM/LOAD + 接口明细表。
- **日志查询**：按日期、小时、级别、模块、关键字筛选线上日志；结果按时间倒序，显示完整时间
  （精确到毫秒）与可展开堆栈；支持 10 秒自动刷新。

## 开发

```bash
npm install
npm run dev      # http://localhost:5174，/api 代理到 http://localhost:3002
```

后端需配置 `ADMIN_USERNAME` / `ADMIN_PASSWORD`（开发未配置时默认 admin / admin123，生产必须显式配置）。

## 构建

```bash
npm run build    # tsc --noEmit && vite build → dist/
npm run preview  # 本地预览产物
```

生产构建通过 `.env.production` 设置 `VITE_API_BASE=/reviewmaster`（与主站同源，后端 API 在
`/reviewmaster/api/*`）。若部署到独立域名/根路径 `/api`，改该变量即可。

## 部署（GitHub Actions）

推送到 `develop` 触发 `.github/workflows/deploy.yml`：

1. `npm ci` → `npm run typecheck` → `npm run build`
2. 校验 `dist/` 资源、生成 `MANIFEST.sha256`
3. scp 到服务器 `/tmp`，远端校验完整性后**原子替换** `/opt/ReviewMasterAdmin`

仓库 **Settings → Secrets and variables → Actions** 需配置（与主站相同）：

| Secret | 说明 |
|---|---|
| `ECS_HOST` | 服务器地址 |
| `ECS_USER` | SSH 用户 |
| `ECS_SSH_KEY` | SSH 私钥 |
| `ECS_PORT` | SSH 端口（可选，默认 22） |

Nginx 增加静态托管（示例）：

```nginx
location /reviewmaster-admin/ {
    alias /opt/ReviewMasterAdmin/;
    try_files $uri $uri/ /reviewmaster-admin/index.html;
}
```

`base: './'` 使资源按相对路径加载，HashRouter 刷新无需服务端 rewrite。管理后台建议加
IP 白名单或 Basic Auth，避免公网直接暴露登录入口。

## 数据来源

全部来自后端埋点系统（`analytics_events`）与用户表，只读；接口见后端 README「管理后台」小节。
