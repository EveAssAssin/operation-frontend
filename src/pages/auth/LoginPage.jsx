// pages/auth/LoginPage.jsx
// 營運部系統登入頁面

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
  const [appNumber, setAppNumber] = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!appNumber.trim()) return setError('請輸入員工編號');

    setLoading(true);
    setError('');
    try {
      await login(appNumber.trim());
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || '登入失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f0ea' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', width: '100%', maxWidth: 380, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px' }}>營運部系統</h1>
          <p style={{ fontSize: 14, color: '#718096', margin: 0 }}>樂活眼鏡</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: 6 }}>
              員工編號（app_number）
            </label>
            <input
              type="text"
              value={appNumber}
              onChange={e => setAppNumber(e.target.value)}
              placeholder="請輸入員工編號"
              style={{
                width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0',
                borderRadius: 8, fontSize: 15, outline: 'none', boxSizing: 'border-box',
              }}
              autoFocus
            />
          </div>

          {error && (
            <div style={{ padding: '10px 12px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8, color: '#c53030', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '13px', background: loading ? '#a0aec0' : '#2d6a4f',
              color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '驗證中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  );
}
