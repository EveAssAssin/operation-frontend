// pages/auth/SsoPage.jsx
// 統一入口 SSO 登入頁
// 網址格式：/sso?app_number=XXXXX
// 統一入口導過來後，自動登入並跳轉首頁

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function SsoPage() {
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const { login }       = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const appNumber = searchParams.get('app_number');

    if (!appNumber) {
      setError('缺少會員編號，請從統一入口重新登入。');
      return;
    }

    // 呼叫 SSO 端點
    authApi.sso(appNumber)
      .then(res => {
        if (!res.success) throw new Error(res.message);
        // 存 token 與用戶資訊
        localStorage.setItem('operation_token', res.token);
        localStorage.setItem('operation_user', JSON.stringify(res.user));
        // 跳轉首頁
        navigate('/dashboard', { replace: true });
      })
      .catch(err => {
        setError(err.message || '登入失敗，您可能沒有此系統的操作權限。');
      });
  }, []); // eslint-disable-line

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#f5f0ea', fontFamily: 'system-ui',
      }}>
        <div style={{
          background: '#fff', borderRadius: 12, padding: '40px 48px',
          textAlign: 'center', maxWidth: 400,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <div style={{ fontWeight: 700, color: '#50422d', fontSize: 18, marginBottom: 12 }}>
            無法登入
          </div>
          <div style={{ color: '#8b6f4e', fontSize: 14, lineHeight: 1.7 }}>{error}</div>
          <div style={{ marginTop: 24, fontSize: 12, color: '#aaa' }}>
            如需開通權限，請聯繫系統管理員
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#f5f0ea', fontFamily: 'system-ui',
      color: '#8b6f4e', fontSize: 15,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div>登入中，請稍候...</div>
      </div>
    </div>
  );
}
