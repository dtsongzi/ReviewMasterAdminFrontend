import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { Business } from './pages/Business';
import { Performance } from './pages/Performance';

function Guard() {
  const { token, checking } = useAuth();
  if (checking) return <div className="boot">正在校验登录态…</div>;
  if (!token) return <Navigate to="/login" replace />;
  return <Layout />;
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
            <Route path="performance" element={<Performance />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
