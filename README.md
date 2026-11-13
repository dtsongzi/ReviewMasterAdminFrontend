# 复盘大师 · 管理后台

React + TypeScript + Vite。零图表依赖（手写 SVG 折线/条形），HashRouter，可部署到任意子路径。

## 功能

- **登录**：管理员账号（后端 `ADMIN_USERNAME` / `ADMIN_PASSWORD`），JWT 12h。
- **数据概览**：用户数、会员数、新增、活跃、事件、转化、错误；趋势图；模块 Top 8。
- **用户管理**：搜索（用户名/手机号/ID）、分页；展示 id、手机号、会员状态、注册时间、最后活跃。
- **业务指标**：各模块浏览/点击/转化/独立用户/渗透率/点击率/转化率/错误率。
- **性能指标**：接口次数/平均/P50/P95/最大/错误率；首屏 TTFB/FCP/LCP/DOM/LOAD。

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

`base: './'`，静态托管于任意路径均可；HashRouter 刷新不需要服务端 rewrite。

## 部署

把 `dist/` 交给 Nginx/静态服务器，并将 `/api` 反代到后端。管理后台建议独立域名/路径，并加访问限制
（IP 白名单或 Basic Auth），避免公网直接暴露登录入口。

## 数据来源

全部来自后端埋点系统（`analytics_events`）与用户表，只读；接口见后端 README「管理后台」小节。
