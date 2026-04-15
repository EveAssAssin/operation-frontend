// pages/vendor/VendorLoginPage.jsx
// 廠商後台登入頁（獨立入口，與系統用戶登入完全分開）

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVendorAuth } from '../../contexts/VendorAuthContext';

export default function VendorLoginPage() {
  const { login }  = useVendorAuth();
  const navigate   = useNavigate();
  const [form, setForm]   = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.username || !form.password) {
      setError('請輸入帳號與密碼');
      return;
    }
    setLoading(true);
    try {
      const res = await login(form.username, form.password);
      if (res.success) {
        navigate('/vendor/bills');
      } else {
        setError(res.message || '帳號或密碼錯誤');
      }
    } catch (err) {
      setError(err.message || '登入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.root}>
      {/* 背景裝飾 */}
      <div style={styles.bg} />

      <div style={styles.card}>
        {/* Logo 區 */}
        <div style={styles.logoArea}>
          <div style={styles.logoIcon}>樂</div>
          <div>
            <div style={styles.logoTitle}>樂活眼鏡</div>
            <div style={styles.logoSub}>廠商服務入口</div>
          </div>
        </div>

        <h2 style={styles.heading}>廠商登入</h2>
        <p style={styles.subText}>請使用廠商帳號登入以管理您的帳單</p>

        {error && (
          <div style={styles.errorBox}>
            <span>⚠</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>廠商帳號</label>
            <input
              type="text"
              style={styles.input}
              placeholder="請輸入帳號"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>密碼</label>
            <input
              type="password"
              style={styles.input}
              placeholder="請輸入密碼"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" disabled={loading} style={{
            ...styles.submitBtn,
            opacity: loading ? 0.7 : 1,
            cursor:  loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '登入中…' : '登入'}
          </button>
        </form>

        <p style={styles.hint}>
          如帳號有問題，請聯絡樂活眼鏡營運部
        </p>
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight:      '100vh',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    background:     'linear-gradient(135deg, #1a202c 0%, #2d3748 50%, #1a365d 100%)',
    padding:        20,
    position:       'relative',
    overflow:       'hidden',
    fontFamily:     'system-ui, -apple-system, sans-serif',
  },
  bg: {
    position:     'absolute',
    inset:        0,
    background:   'radial-gradient(ellipse at 60% 20%, rgba(49,130,206,0.15) 0%, transparent 60%)',
    pointerEvents:'none',
  },
  card: {
    background:   '#fff',
    borderRadius: 16,
    padding:      '40px 36px',
    width:        '100%',
    maxWidth:     420,
    boxShadow:    '0 25px 60px rgba(0,0,0,0.4)',
    position:     'relative',
    zIndex:       1,
  },
  logoArea: {
    display:     'flex',
    alignItems:  'center',
    gap:         12,
    marginBottom:28,
  },
  logoIcon: {
    width:          48,
    height:         48,
    background:     'linear-gradient(135deg, #3182ce, #2b6cb0)',
    borderRadius:   12,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       22,
    fontWeight:     800,
    color:          '#fff',
    flexShrink:     0,
    boxShadow:      '0 4px 12px rgba(49,130,206,0.3)',
  },
  logoTitle: {
    fontSize:   17,
    fontWeight: 800,
    color:      '#1a202c',
    lineHeight: 1.2,
  },
  logoSub: {
    fontSize:   12,
    color:      '#718096',
    lineHeight: 1.2,
    marginTop:  2,
  },
  heading: {
    margin:     '0 0 6px',
    fontSize:   22,
    fontWeight: 700,
    color:      '#1a202c',
  },
  subText: {
    margin:     '0 0 24px',
    fontSize:   13,
    color:      '#718096',
  },
  errorBox: {
    background:   '#fff5f5',
    border:       '1px solid #feb2b2',
    borderRadius: 8,
    padding:      '10px 14px',
    marginBottom: 16,
    color:        '#c53030',
    fontSize:     13,
    display:      'flex',
    gap:          8,
    alignItems:   'center',
  },
  form: {
    display:       'flex',
    flexDirection: 'column',
    gap:           16,
  },
  field: {
    display:       'flex',
    flexDirection: 'column',
    gap:           6,
  },
  label: {
    fontSize:   13,
    fontWeight: 600,
    color:      '#4a5568',
  },
  input: {
    border:       '1.5px solid #e2e8f0',
    borderRadius: 8,
    padding:      '10px 14px',
    fontSize:     14,
    outline:      'none',
    transition:   'border-color 0.15s',
    color:        '#2d3748',
  },
  submitBtn: {
    marginTop:    8,
    background:   'linear-gradient(135deg, #3182ce, #2b6cb0)',
    color:        '#fff',
    border:       'none',
    borderRadius: 8,
    padding:      '12px',
    fontSize:     15,
    fontWeight:   700,
    boxShadow:    '0 4px 12px rgba(49,130,206,0.35)',
    transition:   'transform 0.1s, box-shadow 0.1s',
  },
  hint: {
    marginTop:  20,
    fontSize:   12,
    color:      '#a0aec0',
    textAlign:  'center',
  },
};
