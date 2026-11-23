// 模块 key（与主站 navigation.ts 一致）-> 中文名。埋点里的 module 用 nav key。
export const MODULE_LABELS: Record<string, string> = {
  'pm-summary': '盘前资讯速览',
  'holiday-sum': '假日信息汇总',
  'nw-digest': '资讯全景',
  'nw-headline': '财经要闻',
  'nw-flash': '7×24 快讯',
  'nw-stock': '个股资讯',
  'nw-report': '研报速递',
  'nw-watch': '自选股资讯',
  'qt-watch': '行情自选',
  'ann': '公告精要',
  'diag': '个股综衡',
  'ind-notes': '行业研究',
  'screener': '多因子选股',
  // 策略实验室（v2 对齐：原「回测工作台」7 页，v1 旧实验室已下线）
  'pos-home': '策略总览',
  'pos-strategies': '策略档案库',
  'pos-groups': '实验组',
  'pos-runs': '批量回测',
  'pos-board': '绩效看板',
  'pos-stress': '压力测试',
  'pos-notes': '迭代笔记',
  'rev-mid': '午盘复盘',
  'rev-full': '当天复盘',
  'rev-week': '本周复盘',
  'nt-stock': '个股笔记',
  'nt-review': '交易复盘',
  'courses': '会员课程',
  'member': '会员中心',
  'auth': '登录注册',
};

export function moduleLabel(key: string): string {
  return MODULE_LABELS[key] || key || '（未归类）';
}
