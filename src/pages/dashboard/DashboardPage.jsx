// pages/dashboard/DashboardPage.jsx
// 營運部系統首頁

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { checksApi } from '../../services/api';

// ── 品牌色 ───────────────────────────────────────────────
const C = {
  dark:   '#50422d',
  mid:    '#8b6f4e',
  light:  '#cdbea2',
  bg:     '#f5f0ea',
  border: '#e0d5c8',
};

const fmtAmt = (n) =>
  new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n);

const ROLE_LABELS = {
  super_admin:     '超級管理員',
  operation_lead:  '營運部主管',
  operation_staff: '營運部部員',
};

const QUICK_LINKS = [
  { path: '/personnel', icon: '👥', label: '人員管理',   desc: '查看在職員工、設定系統權限', minRole: 'operation_staff' },
  { path: '/billing',   icon: '💰', label: '開帳系統',   desc: '查看各門市每月養護/報修費用', minRole: 'operation_lead' },
  { path: '/checks',    icon: '🏦', label: '支票紀錄',   desc: '管理應付票據批次與每日出款',  minRole: 'operation_staff' },
];

// ════════════════════════════════════════════════════════════
// 今日重點：單一模組卡片
// ════════════════════════════════════════════════════════════
function HighlightCard({ icon, label, loading, urgent, text, subText, onClick }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff',
        border: `2px solid ${urgent ? '#f56565' : (hover ? C.light : C.border)}`,
        borderRadius: 12,
        padding: '16px 20px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: hover
          ? (urgent ? '0 4px 16px rgba(197,48,48,0.12)' : '0 4px 12px rgba(80,66,45,0.08)')
          : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        minWidth: 0,
      }}
    >
      {/* 左側圖示 */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: urgent ? '#fff5f5' : C.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>
        {icon}
      </div>

      {/* 中段文字 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: C.mid, fontWeight: 600, marginBottom: 4 }}>{label}</div>
        {loading ? (
          <div style={{ fontSize: 13, color: '#a0aec0' }}>載入中...</div>
        ) : (
          <>
            <div style={{
              fontSize: 15, fontWeight: 700,
              color: urgent ? '#c53030' : C.dark,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {text}
            </div>
            {subText && (
              <div style={{ fontSize: 12, color: '#9a8878', marginTop: 2 }}>{subText}</div>
            )}
          </>
        )}
      </div>

      {/* 右側箭頭 */}
      <div style={{ color: C.light, fontSize: 18, flexShrink: 0 }}>›</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 今日重點：支票模組資料
// ════════════════════════════════════════════════════════════
function useChecksHighlight() {
  const [state, setState] = useState({ loading: true, total: 0, amount: 0, overdue: 0 });

  useEffect(() => {
    checksApi.getToday()
      .then(res => {
        const d = res.data || {};
        const totalAmt = (d.summary || []).reduce((s, g) => s + (g.total_amount || 0), 0);
        setState({
          loading:  false,
          total:    d.total || 0,
          amount:   totalAmt,
          overdue:  d.overdue_count || 0,
        });
      })
      .catch(() => setState({ loading: false, total: 0, amount: 0, overdue: 0 }));
  }, []);

  return state;
}

// ════════════════════════════════════════════════════════════
// 主頁面
// ════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const checksHighlight = useChecksHighlight();

  const available = QUICK_LINKS.filter(l => hasRole(l.minRole));

  // 今日日期（台灣格式）
  const today = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    timeZone: 'Asia/Taipei',
  });

  return (
    <div style={{ padding: '32px 24px', maxWidth: '860px', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── 問候 ── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a202c', margin: '0 0 4px' }}>
          歡迎回來，{user?.name} 👋
        </h1>
        <p style={{ fontSize: 13, color: '#718096', margin: 0 }}>
          {ROLE_LABELS[user?.role] || user?.role} · {today}
        </p>
      </div>

      {/* ── 今日重點 ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: C.mid,
          marginBottom: 12, letterSpacing: '0.05em',
          textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            width: 3, height: 14, background: C.mid, borderRadius: 2, display: 'inline-block',
          }} />
          今日重點
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>

          {/* 支票出款 */}
          <HighlightCard
            icon="🏦"
            label="支票出款"
            loading={checksHighlight.loading}
            urgent={checksHighlight.total > 0}
            text={
              checksHighlight.total > 0
                ? `本日應出 ${fmtAmt(checksHighlight.amount)}`
                : '本日無待辦'
            }
            subText={
              checksHighlight.total > 0
                ? `共 ${checksHighlight.total} 張${checksHighlight.overdue > 0 ? `，其中 ${checksHighlight.overdue} 張逾期` : ''}`
                : null
            }
            onClick={() => navigate('/checks')}
          />

          {/* 未來可新增其他模組的今日重點 */}
          {/* <HighlightCard icon="📋" label="工單待辦" ... /> */}

        </div>
      </div>

      {/* ── 功能模組入口 ── */}
      {available.length > 0 && (
        <>
          <div style={{
            fontSize: 13, fontWeight: 700, color: C.mid,
            marginBottom: 12, letterSpacing: '0.05em',
            textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              width: 3, height: 14, background: C.mid, borderRadius: 2, display: 'inline-block',
            }} />
            功能模組
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
            {available.map(link => (
              <a
                key={link.path}
                href={link.path}
                style={{
                  display: 'block', padding: '18px 20px',
                  background: '#fff', border: `1px solid ${C.border}`,
                  borderRadius: 10, textDecoration: 'none',
                  transition: 'box-shadow 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = C.light; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = C.border; }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>{link.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#1a202c', marginBottom: 4 }}>{link.label}</div>
                <div style={{ fontSize: 13, color: '#718096', lineHeight: 1.4 }}>{link.desc}</div>
              </a>
            ))}
          </div>
        </>
      )}

      {/* ── 系統基礎建設 ── */}
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#718096', marginBottom: 10 }}>系統基礎建設</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: '#4a5568' }}>
          {['人員資料庫（含行政部門）', 'LINE UID 同步', 'LINE 推播通知', 'QR Code 通用簽收', '系統用戶管理'].map(item => (
            <div key={item}>✅ {item}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
