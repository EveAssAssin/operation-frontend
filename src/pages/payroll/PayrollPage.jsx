// pages/payroll/PayrollPage.jsx — 出勤薪資（lohas-payroll）內嵌（2026-11-03）
// 另一套系統（https://lohas-payroll-web.onrender.com），用營運系統的 app_number 進去；
// 角色由 payroll 後端打 /api/external/payroll-role 對（super_admin／lead→admin、hr→hr、accounting→只看）。
import { useAuth } from '../../contexts/AuthContext';

const BASE = import.meta.env.VITE_PAYROLL_URL || 'https://lohas-payroll-web.onrender.com';

export default function PayrollPage() {
  const { user } = useAuth();
  const app = user?.app_number || user?.memberId || '';
  const src = `${BASE}/?app_number=${encodeURIComponent(app)}&embed=1`;
  return (
    <div style={{ height: 'calc(100vh - 24px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 4px 6px' }}>
        <a href={src} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#8b6f4e' }}>另開視窗 ↗</a>
      </div>
      <iframe title="出勤薪資" src={src} style={{ flex: 1, width: '100%', border: '1px solid #e5ddd0', borderRadius: 12, background: '#faf8f5' }} />
    </div>
  );
}
