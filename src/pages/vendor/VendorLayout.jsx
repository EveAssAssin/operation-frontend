// pages/vendor/VendorLayout.jsx
// 廠商後台共用外框（Topbar 版，簡潔行動優先設計）

import { useNavigate, NavLink } from 'react-router-dom';
import { useVendorAuth } from '../../contexts/VendorAuthContext';

export default function VendorLayout({ children }) {
  const { vendor, logout } = useVendorAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/vendor/login');
  };

  return (
    <div style={styles.root}>
      {/* Topbar */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoIcon}>樂</div>
          <div style={styles.headerTitles}>
            <span style={styles.sysName}>樂活眼鏡</span>
            <span style={styles.portalName}>廠商服務入口</span>
          </div>
        </div>

        <nav style={styles.nav}>
          <NavLink to="/vendor/bills" style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {}),
          })}>
            帳單管理
          </NavLink>
        </nav>

        <div style={styles.headerRight}>
          <span style={styles.vendorName}>{vendor?.source_name || vendor?.username}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>登出</button>
        </div>
      </header>

      {/* 主內容 */}
      <main style={styles.main}>
        {children}
      </main>
    </div>
  );
}

const styles = {
  root: {
    minHeight:  '100vh',
    background: '#f5f0ea',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display:    'flex',
    flexDirection: 'column',
  },
  header: {
    background:     '#50422d',
    height:         56,
    display:        'flex',
    alignItems:     'center',
    padding:        '0 24px',
    gap:            24,
    position:       'sticky',
    top:            0,
    zIndex:         100,
    boxShadow:      '0 2px 8px rgba(0,0,0,0.3)',
  },
  headerLeft: {
    display:    'flex',
    alignItems: 'center',
    gap:        10,
    flexShrink: 0,
  },
  logoIcon: {
    width:          32,
    height:         32,
    background:     '#8b6f4e',
    borderRadius:   8,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       16,
    fontWeight:     800,
    color:          '#fff',
  },
  headerTitles: {
    display:       'flex',
    flexDirection: 'column',
    lineHeight:    1.2,
  },
  sysName: {
    fontSize:   13,
    fontWeight: 700,
    color:      '#fff',
  },
  portalName: {
    fontSize: 10,
    color:    '#cdbea2',
  },
  nav: {
    flex:    1,
    display: 'flex',
    gap:     4,
  },
  navLink: {
    color:          '#cdbea2',
    textDecoration: 'none',
    fontSize:       14,
    fontWeight:     500,
    padding:        '6px 14px',
    borderRadius:   6,
    transition:     'background 0.15s',
  },
  navLinkActive: {
    color:      '#fff',
    background: '#8b6f4e',
  },
  headerRight: {
    display:    'flex',
    alignItems: 'center',
    gap:        12,
    flexShrink: 0,
  },
  vendorName: {
    fontSize:   13,
    color:      '#e2e8f0',
    fontWeight: 500,
  },
  logoutBtn: {
    background:   'transparent',
    border:       '1px solid rgba(255,255,255,0.2)',
    borderRadius: 6,
    color:        '#cdbea2',
    fontSize:     12,
    padding:      '4px 12px',
    cursor:       'pointer',
  },
  main: {
    flex:     1,
    padding:  '28px 24px',
    maxWidth: 900,
    width:    '100%',
    margin:   '0 auto',
  },
};
