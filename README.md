# 复盘大师 · 管理后台

React + TypeScript + Vite + **ECharts**（按需引入）。HashRouter，可部署到任意子路径。

**默认分支：`develop`**（本仓库只使用 develop）。

## 功能

- **登录**：管理员账号（后端 `ADMIN_USERNAME` / `ADMIN_PASSWORD`），JWT 12h。
- **数据概览**：用户数、会员数、新增、活跃、事件、转化、错误；ECharts 趋势折线；模块 Top 8；
  埋点落库统计（行数/接收/写入/丢弃）与埋点名 Top 15。
- **用户管理**：搜索（用户名/手机号/ID）、分页；展示 id、手机号、会员状态、注册时间、最后活跃；
  **封禁 / 解封**（封禁后旧令牌立即失效），并展示该用户**使用的会员码**。
- **会员兑换码**（用户管理页下方独立区域）：批量生成（初始「未使用」，建议填批次备注）；
  状态 `未使用 / 已卖出 / 已激活 / 已废弃` 筛选与计数；按兑换码 / 批次备注搜索；
  **列表分页**：默认每页 20 条，可切 20/50/100/200，分页条常驻（总数、当前页、首页/上一页/下一页/末页），
  切换筛选或每页条数回到第 1 页，筛选后页码越界自动回退；本次生成结果超 20 个可展开；
  复选框多选（可跨页累计、切换筛选或每页条数会清空）、本页全选、「选中本次生成」、复制全部；
  **批量标记已卖出 / 批量废弃**（单次最多 200 个，带二次确认），逐码显示成功/失败原因，
  失败的码保留选中便于重试；单码按钮仍可用。查看使用人、卖出/激活/创建时间。
- **业务指标**：ECharts 模块漏斗柱状图 + 表格（浏览/点击/转化/渗透率/点击率/转化率/错误率）。
- **性能指标**：ECharts 接口 P95 Top 10 横向柱状 + 首屏 TTFB/FCP/LCP/DOM/LOAD + 接口明细表。
- **日志查询**：按日期、小时、级别、模块、关键字筛选线上日志；结果按时间倒序，显示完整时间
  （精确到毫秒）与可展开堆栈；支持 10 秒自动刷新。
- **会员模块权限**：按侧栏分组逐页配置 `免费可见 / 会员专享 / 暂不开放`；支持分组批量设置、
  撤销更改、恢复默认；实时预览主站「会员中心 → 权益对照」的两列对照表；
  展示由配置派生出的受保护接口数量，并对「免费模块仍依赖被保护接口」给出提示。
  保存走 `PUT /api/admin/module-access`，落库后立即对主站侧栏/路由/权益对照与后端接口门禁生效。

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
