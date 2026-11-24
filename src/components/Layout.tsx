import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';

const NAV: Array<{ to: string; label: string; end?: boolean; superOnly?: boolean }> = [
  { to: '/', label: '数据概览', end: true },
  { to: '/users', label: '用户管理' },
  { to: '/business', label: '业务指标' },
  { to: '/modules', label: '会员模块权限' },
  { to: '/courses', label: '会员课程' },
  { to: '/data-config', label: '数据源设置' },
  { to: '/performance', label: '性能指标' },
  { to: '/logs', label: '日志查询' },
  { to: '/admins', label: '管理员管理', superOnly: true },
];

export function Layout() {
  const { username, superAdmin, signOut } = useAuth();
  const visibleNav = NAV.filter((n) => !n.superOnly || superAdmin);
  return (
    <div className="layout">
      <aside className="side">
        <div className="brand">
          <div className="logo">📊</div>
          <div>
            <strong>复盘大师</strong>
            <span>管理后台</span>
          </div>
        </div>
        <nav className="nav">
          {visibleNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">数据来自埋点系统 · 仅内部使用</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">运营数据平台</div>
          <div className="who">
            <span>{username}</span>
            <button className="btn-ghost" onClick={signOut}>退出</button>
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
