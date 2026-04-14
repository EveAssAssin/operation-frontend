// pages/dashboard/DashboardPage.jsx
// 營運部系統首頁（佔位）

import { useAuth } from '../../contexts/AuthContext';

export default function DashboardPage() {
  const { user, logout, roleLabel } = useAuth();

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '32px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px' }}>
          營運部系統
        </h1>
        <p style={{ fontSize: 14, color: '#718096', margin: '0 0 24px' }}>
          歡迎，{user?.name}（{roleLabel[user?.role] || user?.role}）
        </p>

        <div style={{ background: '#f7f8fc', borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: '#718096', marginBottom: 12 }}>系統基礎建設已就緒</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: '#4a5568' }}>
            <div>✅ 人員資料庫（含行政部門）</div>
            <div>✅ LINE UID 同步</div>
            <div>✅ LINE 推播通知</div>
            <div>✅ QR Code 通用簽收</div>
            <div>✅ 系統用戶管理</div>
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            padding: '10px 20px', background: '#f7f8fc', border: '1px solid #e2e8f0',
            borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#718096',
          }}
        >
          登出
        </button>
      </div>
    </div>
  );
}
