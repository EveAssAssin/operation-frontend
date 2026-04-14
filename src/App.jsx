// App.jsx
// 營運部系統路由設定與入口

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import BillingPage from './pages/billing/BillingPage';

// 通用簽收頁面（LINE LIFF / Web）
import UniversalSignPage from './pages/sign/UniversalSignPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#718096' }}>載入中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* 登入 */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      {/* 通用簽收（不需登入） */}
      <Route path="/sign" element={<UniversalSignPage />} />

      {/* 主應用（需登入） */}
      <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />

      {/* 開帳系統（需登入，operation_lead 以上） */}
      <Route path="/billing" element={<PrivateRoute><BillingPage /></PrivateRoute>} />

      {/* 未來功能模組在此新增路由 */}

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
