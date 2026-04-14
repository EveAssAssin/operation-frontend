// pages/sign/UniversalSignPage.jsx
// 通用簽收頁面（LINE LIFF / Web 備援）
// 路由：/sign?token=xxx

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';

const liff = window.liff;
const LIFF_ID = import.meta.env.VITE_LINE_LIFF_ID || '';

export default function UniversalSignPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [stage,    setStage]    = useState('loading');
  const [data,     setData]     = useState(null);
  const [employee, setEmployee] = useState(null);
  const [lineUid,  setLineUid]  = useState('');
  const [error,    setError]    = useState('');
  const [label,    setLabel]    = useState('');

  useEffect(() => {
    if (!token) { setError('缺少簽收 token'); setStage('error'); return; }
    initSign();
  }, [token]);

  const initSign = async () => {
    try {
      // 嘗試 LIFF 登入取得 LINE UID
      let uid = '';
      if (liff && LIFF_ID) {
        try {
          await liff.init({ liffId: LIFF_ID });
          if (!liff.isLoggedIn()) { liff.login(); return; }
          const profile = await liff.getProfile();
          uid = profile.userId;
          setLineUid(uid);
        } catch { /* LIFF 失敗，走 Web 備援 */ }
      }

      // 驗證 token
      const url = uid
        ? `/sign/universal/${token}?line_uid=${uid}`
        : `/sign/universal/verify/${token}`;

      const res = await api.get(url);
      setData(res.data);
      setLabel(res.label || '');
      if (res.employee) setEmployee(res.employee);
      setStage('confirm');
    } catch (err) {
      setError(err?.message || '驗證失敗');
      setStage('error');
    }
  };

  const handleConfirm = async () => {
    setStage('signing');
    try {
      const body = { token };
      if (lineUid) body.line_uid = lineUid;
      // Web 備援需要 app_number（由使用者輸入或其他方式取得）

      await api.post('/sign/universal/confirm', body);
      setStage('success');
    } catch (err) {
      setError(err?.message || '簽收失敗');
      setStage('error');
    }
  };

  const pageStyle = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f8fc', padding: 16 };
  const cardStyle = { background: '#fff', borderRadius: 16, padding: '32px 24px', width: '100%', maxWidth: 400, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' };

  if (stage === 'loading') {
    return <div style={pageStyle}><div style={cardStyle}><div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div><div style={{ color: '#4a5568' }}>驗證中...</div></div></div>;
  }
  if (stage === 'error') {
    return <div style={pageStyle}><div style={cardStyle}><div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div><h2 style={{ color: '#c53030', fontSize: 18, margin: '0 0 8px' }}>無法完成簽收</h2><p style={{ color: '#718096', fontSize: 14, lineHeight: 1.6 }}>{error}</p></div></div>;
  }
  if (stage === 'success') {
    return <div style={pageStyle}><div style={cardStyle}><div style={{ fontSize: 56, marginBottom: 12 }}>✅</div><h2 style={{ color: '#276749', fontSize: 22, margin: '0 0 8px' }}>簽收完成！</h2><p style={{ color: '#4a5568', fontSize: 14 }}>{label && `${label}已確認`}</p><p style={{ color: '#a0aec0', fontSize: 13, marginTop: 8 }}>可以關閉此頁面</p></div></div>;
  }

  // confirm
  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: '0 0 6px' }}>{label || '簽收確認'}</h2>
        {employee && <p style={{ fontSize: 13, color: '#718096', margin: '0 0 16px' }}>您好，{employee.name}（{employee.store_name}）</p>}

        {data && (
          <div style={{ background: '#f7f8fc', borderRadius: 10, padding: 16, marginBottom: 20, textAlign: 'left', fontSize: 14 }}>
            {data.store_name && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: '#718096' }}>門市</span><span style={{ fontWeight: 600, color: '#1a1a2e' }}>{data.store_name}</span></div>}
          </div>
        )}

        <button onClick={handleConfirm} style={{ width: '100%', padding: 15, background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
          ✅ 確認簽收
        </button>
      </div>
    </div>
  );
}
