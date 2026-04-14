// pages/dashboard/DashboardPage.jsx
// 營運部系統首頁

import { useAuth } from '../../contexts/AuthContext';

const ROLE_LABELS = {
  super_admin:     '超級管理員',
  operation_lead:  '營運部主管',
  operation_staff: '營運部部員',
};

const QUICK_LINKS = [
  { path: '/personnel', icon: '👥', label: '人員管理', desc: '查看在職員工、設定系統權限', minRole: 'operation_staff' },
  { path: '/billing',   icon: '💰', label: '開帳系統', desc: '查看各門市每月養護/報修費用', minRole: 'operation_lead' },
];

export default function DashboardPage() {
  const { user, hasRole } = useAuth();

  const available = QUICK_LINKS.filter(l => hasRole(l.minRole));

  return (
    <div style={{ padding: '32px 24px', maxWidth: '800px', fontFamily: 'system-ui, sans-serif' }}>
      {/* 問候 */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a202c', margin: '0 0 6px' }}>
          歡迎回來，{user?.name} 👋
        </h1>
        <p style={{ fontSize: '14px', color: '#718096', margin: 0 }}>
          {ROLE_LABELS[user?.role] || user?.role} · 營運部系統
        </p>
      </div>

      {/* 快速入口 */}
      {available.length > 0 && (
        <>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#718096', marginBottom: '12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            功能模組
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px', marginBottom: '28px' }}>
            {available.map(link => (
              <a
                key={link.path}
                href={link.path}
                style={{
                  display: 'block', padding: '18px 20px',
                  background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: '10px', textDecoration: 'none',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = '#bee3f8'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
              >
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>{link.icon}</div>
                <div style={{ fontWeight: '600', fontSize: '15px', color: '#1a202c', marginBottom: '4px' }}>{link.label}</div>
                <div style={{ fontSize: '13px', color: '#718096', lineHeight: '1.4' }}>{link.desc}</div>
              </a>
            ))}
          </div>
        </>
      )}

      {/* 系統狀態 */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#718096', marginBottom: '10px' }}>系統基礎建設</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', color: '#4a5568' }}>
          {['人員資料庫（含行政部門）', 'LINE UID 同步', 'LINE 推播通知', 'QR Code 通用簽收', '系統用戶管理'].map(item => (
            <div key={item}>✅ {item}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
