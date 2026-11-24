import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { Business } from './pages/Business';
import { Performance } from './pages/Performance';
import { Logs } from './pages/Logs';
import { ModuleAccess } from './pages/ModuleAccess';
import { Courses } from './pages/Courses';
import { DataConfigPage } from './pages/DataConfig';
import { Admins } from './pages/Admins';

function Guard() {
  const { token, checking } = useAuth();
  if (checking) return <div className="boot">正在校验登录态…</div>;
  if (!token) return <Navigate to="/login" replace />;
  return <Layout />;
}

// 仅超管可进入管理员管理页；普通管理员直接访问时退回首页。
function SuperGuard() {
  const { superAdmin } = useAuth();
  return superAdmin ? <Admins /> : <Navigate to="/" replace />;
}

export function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Guard />}>
            <Route index element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="business" element={<Business />} />
            <Route path="modules" element={<ModuleAccess />} />
            <Route path="courses" element={<Courses />} />
            <Route path="data-config" element={<DataConfigPage />} />
            <Route path="performance" element={<Performance />} />
            <Route path="logs" element={<Logs />} />
            <Route path="admins" element={<SuperGuard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
