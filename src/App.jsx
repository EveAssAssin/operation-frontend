// App.jsx
// 營運部系統路由設定與入口

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { VendorAuthProvider, useVendorAuth } from './contexts/VendorAuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/auth/LoginPage';
import SsoPage   from './pages/auth/SsoPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import PersonnelPage from './pages/personnel/PersonnelPage';
import BillingPage       from './pages/billing/BillingPage';
import BillingV2Page     from './pages/billing/BillingV2Page';
import BillingReportPage from './pages/billing/BillingReportPage';
import ChecksPage        from './pages/checks/ChecksPage';
import RecruitmentPage   from './pages/recruitment/RecruitmentPage';
import SalesEventsPage   from './pages/salesEvents/SalesEventsPage';

// 廠商後台
import VendorLoginPage  from './pages/vendor/VendorLoginPage';
import VendorBillsPage  from './pages/vendor/VendorBillsPage';
import VendorLayout     from './pages/vendor/VendorLayout';

// 通用簽收頁面（LINE LIFF / Web，不需登入）
import UniversalSignPage from './pages/sign/UniversalSignPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#718096', fontFamily: 'system-ui' }}>
      載入中...
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

// 廠商 Private Route
function VendorPrivateRoute({ children }) {
  const { vendor, loading } = useVendorAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#718096', fontFamily: 'system-ui' }}>
      載入中...
    </div>
  );
  if (!vendor) return <Navigate to="/vendor/login" replace />;
  return <VendorLayout>{children}</VendorLayout>;
}

function AppRoutes() {
  const { user }   = useAuth();
  const { vendor } = useVendorAuth();

  return (
    <Routes>
      {/* 登入（不需 Layout） */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      {/* SSO 統一入口：/sso?app_number=XXXXX */}
      <Route path="/sso" element={<SsoPage />} />

      {/* 通用簽收（不需登入，不需 Layout） */}
      <Route path="/sign" element={<UniversalSignPage />} />

      {/* 主應用（需登入，套 Layout） */}
      <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/personnel" element={<PrivateRoute><PersonnelPage /></PrivateRoute>} />
      <Route path="/billing"        element={<PrivateRoute><BillingPage /></PrivateRoute>} />
      <Route path="/billing-v2"     element={<PrivateRoute><BillingV2Page /></PrivateRoute>} />
      <Route path="/billing-report" element={<PrivateRoute><BillingReportPage /></PrivateRoute>} />
      <Route path="/checks"         element={<PrivateRoute><ChecksPage /></PrivateRoute>} />
      <Route path="/recruitment"    element={<PrivateRoute><RecruitmentPage /></PrivateRoute>} />
      <Route path="/sales-events"   element={<PrivateRoute><SalesEventsPage /></PrivateRoute>} />

      {/* 廠商後台（獨立 JWT，獨立 Layout） */}
      <Route path="/vendor/login" element={vendor ? <Navigate to="/vendor/bills" replace /> : <VendorLoginPage />} />
      <Route path="/vendor/bills" element={<VendorPrivateRoute><VendorBillsPage /></VendorPrivateRoute>} />
      <Route path="/vendor"       element={<Navigate to="/vendor/login" replace />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <VendorAuthProvider>
          <AppRoutes />
        </VendorAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
