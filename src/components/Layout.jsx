// components/Layout.jsx
// 左側 Sidebar — 支援單層 + 可展開子項目

import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// ── 導覽項目定義 ─────────────────────────────────────────────
// 有 children 的項目可展開，自身不導頁
// moduleKey 對應 DB modules.key，用於分權系統過濾選單
const NAV_ITEMS = [
  { path: '/dashboard',       label: '首頁',     icon: '🏠', moduleKey: 'dashboard' },
  { path: '/personnel',       label: '人員管理', icon: '👥', minRole: 'operation_staff', moduleKey: 'personnel' },
  { path: '/basic-data',      label: '基本資料', icon: '📚', minRole: 'operation_staff', moduleKey: 'basic_data' },
  {
    key:   'dept-billing',
    label: '部門開帳',
    icon:  '🏢',
    minRole: 'operation_staff',
    moduleKey: 'billing',
    children: [
      { path: '/billing',    label: '工程開帳', icon: '🔧', moduleKey: 'billing' },
      { path: '/billing-ad', label: '企劃開帳', icon: '📣', moduleKey: 'billing' },
      // 之後新增的部門開帳（美睫部 等）都加在這裡
    ],
  },
  { path: '/billing-v2',      label: '帳單管理', icon: '🧾', minRole: 'operation_staff', moduleKey: 'billing_v2' },
  { path: '/billing-report',  label: '帳單月報', icon: '📊', minRole: 'operation_staff', moduleKey: 'billing_report' },
  {
    key:   'payable',
    label: '應付帳款',
    icon:  '💴',
    minRole: 'operation_staff',
    moduleKey: 'recurring_expenses',
    children: [
      { path: '/checks',             label: '支票紀錄', icon: '🏦', moduleKey: 'checks' },
      { path: '/recurring-expenses', label: '常態費用', icon: '💴', moduleKey: 'recurring_expenses' },
      { path: '/company-profile',    label: '公司資料', icon: '⚙', moduleKey: 'recurring_expenses' },
      // 之後新增的應付帳款子項目（廠商請款 / 匯款批次 等）都加在這裡
    ],
  },
  { path: '/recruitment',     label: '人力招募', icon: '🧑‍💼', minRole: 'operation_staff', moduleKey: 'recruitment' },
  { path: '/sales-events',    label: '業績活動', icon: '📣', minRole: 'operation_staff', moduleKey: 'sales_events' },
  { path: '/quests',          label: '任務派發', icon: '📋', minRole: 'operation_staff', moduleKey: 'quests' },
  {
    key:   'processes',
    label: '各類流程',
    icon:  '🗂️',
    minRole: 'operation_staff',
    moduleKey: 'processes',
    children: [
      { path: '/processes/handover', label: '門市交接表', icon: '📝', moduleKey: 'processes' },
      // 之後新增的子流程都加在這裡
    ],
  },
  { path:  '/appointed-units',    label: '特約廠商', icon:  '🤝', minRole: 'operation_staff', moduleKey: 'appointed_units' },
  { path:  '/point-redemption',   label: '分數兌換', icon:  '🪙', minRole: 'operation_staff', moduleKey: 'point_redemption' },
  { path:  '/scheduled-notify',   label: '排程推播', icon:  '⏰', minRole: 'operation_staff', moduleKey: 'scheduled_notify' },
  { path:  '/system-updates',     label: '系統更新', icon:  '🚀', minRole: 'operation_staff', moduleKey: 'system_updates' },
  // 系統設定 — 僅 admin 角色（is_admin=true）能看
  { path:  '/system/permissions', label: '權限管理', icon:  '⚙', adminOnly: true, moduleKey: 'system_settings' },
];

// 角色中文標籤
const ROLE_LABELS = {
  super_admin:          '超級管理員',
  dept_head:            '部門主管',
  operation_lead:       '營運部主管',
  operation_accounting: '營運部會計',
  operation_hr:         '營運部人事',
  operation_staff:      '營運部部員',
};

const ROLE_COLORS = {
  super_admin:          '#fed7d7',
  dept_head:            '#fef3c7',
  operation_lead:       '#fef3c7',
  operation_accounting: '#dbeafe',
  operation_hr:         '#dcfce7',
  operation_staff:      '#f5f0ea',
};
const ROLE_TEXT = {
  super_admin:          '#c53030',
  dept_head:            '#92400e',
  operation_lead:       '#8b6f4e',
  operation_accounting: '#1e40af',
  operation_hr:         '#15803d',
  operation_staff:      '#50422d',
};

export default function Layout({ children }) {
  const { user, logout, hasRole, hasModule, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 展開狀態（每個 group 一個 key）
  // 若當前路徑是某 group 的子項，初始就展開該 group
  const initiallyExpanded = NAV_ITEMS
    .filter(it => Array.isArray(it.children) &&
      it.children.some(c => location.pathname.startsWith(c.path)))
    .map(it => it.key);
  const [expanded, setExpanded] = useState(new Set(initiallyExpanded));

  const toggleGroup = (key) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div style={styles.root}>
      {/* ── 左側 Sidebar ── */}
      <aside style={styles.sidebar}>
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcon}>樂</div>
          <div>
            <div style={styles.logoTitle}>樂活眼鏡</div>
            <div style={styles.logoSub}>營運部系統</div>
          </div>
        </div>

        <div style={styles.divider} />

        {/* 導覽連結 */}
        <nav style={styles.nav}>
          {NAV_ITEMS
            .filter(item => {
              // adminOnly：僅全權角色（is_admin=true）能看
              if (item.adminOnly) return isAdmin();
              // 分權系統：有 moduleKey 就用 hasModule 過濾
              if (item.moduleKey) return hasModule(item.moduleKey);
              // 沒有 moduleKey 才退回原本的 minRole 檢查（向下相容）
              return !item.minRole || hasRole(item.minRole);
            })
            .map(item => {
              if (Array.isArray(item.children)) {
                const isExpanded = expanded.has(item.key);
                const childActive = item.children.some(c => location.pathname.startsWith(c.path));
                return (
                  <div key={item.key}>
                    <button
                      onClick={() => toggleGroup(item.key)}
                      style={{
                        ...styles.navItem,
                        ...(childActive ? styles.navItemActive : styles.navItemInactive),
                        background: childActive ? '#8b6f4e' : 'transparent',
                        border: 'none', width: '100%', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: '10px',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={styles.navIcon}>{item.icon}</span>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      <span style={{ fontSize: 10, opacity: 0.7 }}>{isExpanded ? '▼' : '▶'}</span>
                    </button>
                    {isExpanded && (
                      <div style={{ paddingLeft: 16, marginTop: 2 }}>
                        {item.children.map(child => (
                          <NavLink
                            key={child.path}
                            to={child.path}
                            style={({ isActive }) => ({
                              ...styles.navItem,
                              ...(isActive ? styles.navItemActive : styles.navItemInactive),
                              fontSize: 13,
                            })}
                          >
                            <span style={styles.navIcon}>{child.icon || '·'}</span>
                            <span>{child.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  style={({ isActive }) => ({
                    ...styles.navItem,
                    ...(isActive ? styles.navItemActive : styles.navItemInactive),
                  })}
                >
                  <span style={styles.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
        </nav>

        {/* 底部：用戶資訊 */}
        <div style={styles.userBlock}>
          <div style={styles.divider} />
          <div style={styles.userInfo}>
            <div style={styles.userName}>{user?.name || '—'}</div>
            <div style={{
              ...styles.roleBadge,
              background: ROLE_COLORS[user?.role] || '#e2e8f0',
              color:      ROLE_TEXT[user?.role]   || '#4a5568',
            }}>
              {ROLE_LABELS[user?.role] || user?.role || '—'}
            </div>
          </div>
          <a
            href={
              user?.line_uid
                ? `https://portal.ruki-ai.com/portal.html?uid=${encodeURIComponent(user.line_uid)}`
                : '#'
            }
            onClick={(e) => {
              // 沒 line_uid → portal 會顯示「缺少登入資訊」錯誤頁
              // 改成登出後跳本系統登入頁
              if (!user?.line_uid) {
                e.preventDefault();
                logout();
                navigate('/login');
              }
            }}
            style={styles.portalBtn}
          >
            🏠 返回統一登入口
          </a>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            登出
          </button>
        </div>
      </aside>

      <main style={styles.main}>
        {children}
      </main>
    </div>
  );
}

// ── 樣式 ────────────────────────────────────────────────────
const styles = {
  root: {
    display:   'flex',
    minHeight: '100vh',
    background: '#f5f0ea',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  sidebar: {
    width:      '220px',
    minWidth:   '220px',
    background: '#50422d',
    display:    'flex',
    flexDirection: 'column',
    position:   'sticky',
    top:        0,
    height:     '100vh',
    overflowY:  'auto',
  },
  logo: {
    display:    'flex',
    alignItems: 'center',
    gap:        '10px',
    padding:    '20px 16px 16px',
  },
  logoIcon: {
    width:      '36px',
    height:     '36px',
    background: '#8b6f4e',
    borderRadius: '8px',
    display:    'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize:   '18px',
    fontWeight: '700',
    color:      '#fff',
    flexShrink: 0,
  },
  logoTitle: { fontSize: '14px', fontWeight: '700', color: '#fff', lineHeight: '1.2' },
  logoSub:   { fontSize: '11px', color: '#cdbea2', lineHeight: '1.2' },
  divider:   { height: '1px', background: 'rgba(255,255,255,0.15)', margin: '0 12px' },
  nav: {
    flex: 1, padding: '10px 8px',
    display: 'flex', flexDirection: 'column', gap: '2px',
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 12px', borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '14px', fontWeight: '500',
    transition: 'background 0.15s',
  },
  navItemActive:   { background: '#8b6f4e', color: '#fff' },
  navItemInactive: { color: '#cdbea2' },
  navIcon:         { fontSize: '16px', width: '20px', textAlign: 'center' },
  userBlock:       { padding: '0 0 12px' },
  userInfo: {
    padding: '12px 16px 8px',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  userName:  { fontSize: '13px', fontWeight: '600', color: '#e2e8f0' },
  roleBadge: {
    display: 'inline-block',
    fontSize: '11px', fontWeight: '600',
    padding: '2px 8px', borderRadius: '999px',
    alignSelf: 'flex-start',
  },
  portalBtn: {
    display: 'block', margin: '0 12px 6px',
    padding: '8px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    color: '#cdbea2', fontSize: '13px',
    textAlign: 'center', textDecoration: 'none',
    cursor: 'pointer',
  },
  logoutBtn: {
    margin: '0 12px',
    width: 'calc(100% - 24px)',
    padding: '8px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    color: '#cdbea2', fontSize: '13px',
    cursor: 'pointer',
  },
  main: { flex: 1, minWidth: 0, overflowY: 'auto' },
};
