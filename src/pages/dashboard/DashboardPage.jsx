// pages/dashboard/DashboardPage.jsx
// 營運部系統首頁

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { checksApi, dashboardApi } from '../../services/api';

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
function HighlightCard({ icon, label, loading, urgent, warning, text, subText, onClick, unavailable }) {
  const [hover, setHover] = useState(false);

  const borderColor = unavailable ? C.border
    : urgent  ? '#f56565'
    : warning ? '#ed8936'
    : hover   ? C.light
    : C.border;

  const shadowColor = urgent  ? 'rgba(197,48,48,0.12)'
    : warning ? 'rgba(237,137,54,0.12)'
    : 'rgba(80,66,45,0.08)';

  const iconBg = urgent ? '#fff5f5' : warning ? '#fffaf0' : C.bg;
  const textColor = urgent ? '#c53030' : warning ? '#c05621' : C.dark;

  return (
    <div
      onClick={!unavailable ? onClick : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff',
        border: `2px solid ${borderColor}`,
        borderRadius: 12,
        padding: '16px 20px',
        cursor: unavailable ? 'default' : 'pointer',
        transition: 'all 0.15s',
        boxShadow: (!unavailable && hover) ? `0 4px 16px ${shadowColor}` : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        minWidth: 0,
        opacity: unavailable ? 0.55 : 1,
      }}
    >
      {/* 左側圖示 */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: iconBg,
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
              color: textColor,
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

      {/* 右側箭頭（不可點時不顯示）*/}
      {!unavailable && (
        <div style={{ color: C.light, fontSize: 18, flexShrink: 0 }}>›</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Hook：支票出款
// ════════════════════════════════════════════════════════════
function useChecksHighlight() {
  const [state, setState] = useState({ loading: true, total: 0, amount: 0, overdue: 0 });

  useEffect(() => {
    checksApi.getToday()
      .then(res => {
        const d = res.data || {};
        const totalAmt = (d.summary || []).reduce((s, g) => s + (g.total_amount || 0), 0);
        setState({ loading: false, total: d.total || 0, amount: totalAmt, overdue: d.overdue_count || 0 });
      })
      .catch(() => setState({ loading: false, total: 0, amount: 0, overdue: 0 }));
  }, []);

  return state;
}

// ════════════════════════════════════════════════════════════
// Hook：教育訓練
// ════════════════════════════════════════════════════════════
function useTrainingHighlight() {
  const [state, setState] = useState({ loading: true, data: null, error: false });

  useEffect(() => {
    dashboardApi.getTrainingHighlight()
      .then(res => {
        setState({ loading: false, data: res.data || null, error: false });
      })
      .catch(() => setState({ loading: false, data: null, error: true }));
  }, []);

  return state;
}

// 從教育訓練資料推導出卡片要顯示的優先內容
function resolveTrainingCard(data) {
  if (!data) return { urgent: false, warning: false, text: '無法取得資料', subText: null };

  const sosCount      = data.sos_active?.length       || 0;
  const urgentCount   = data.urgent_attention?.length  || 0;
  const onboardCount  = data.onboarding_today?.length  || 0;
  const examCount     = (data.exam_queue?.length        || 0);

  // SOS 最優先
  if (sosCount > 0) {
    const names = data.sos_active.slice(0, 2).map(s => s.name || s).join('、');
    return {
      urgent: true, warning: false,
      text:    `🆘 SOS 求助中 ${sosCount} 人`,
      subText: names + (sosCount > 2 ? ` 等 ${sosCount} 人` : ''),
    };
  }

  // 需緊急關注
  if (urgentCount > 0) {
    const names = data.urgent_attention.slice(0, 2).map(s => s.name || s).join('、');
    return {
      urgent: false, warning: true,
      text:    `⚠ 需關注學員 ${urgentCount} 人`,
      subText: names + (urgentCount > 2 ? ` 等 ${urgentCount} 人` : ''),
    };
  }

  // 今日到職
  if (onboardCount > 0) {
    const names = data.onboarding_today.slice(0, 3).map(s => s.name || s).join('、');
    return {
      urgent: false, warning: false,
      text:    `🎉 今日到職 ${onboardCount} 人`,
      subText: names,
    };
  }

  // 正常：顯示摘要數字
  const s = data.summary || {};
  const parts = [];
  if (s.in_training  > 0) parts.push(`訓練中 ${s.in_training}`);
  if (s.waiting_exam > 0) parts.push(`等待考試 ${s.waiting_exam}`);
  if (s.in_exam      > 0) parts.push(`考試中 ${s.in_exam}`);
  if (examCount      > 0 && !s.in_exam) parts.push(`排隊考試 ${examCount}`);

  return {
    urgent: false, warning: false,
    text:    parts.length > 0 ? '訓練進度正常' : '本日無異常',
    subText: parts.join(' · ') || null,
  };
}

// ════════════════════════════════════════════════════════════
// 主頁面
// ════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const checksHighlight   = useChecksHighlight();
  const trainingHighlight = useTrainingHighlight();

  const available = QUICK_LINKS.filter(l => hasRole(l.minRole));

  const today = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    timeZone: 'Asia/Taipei',
  });

  // 教育訓練卡片內容
  const trainingCard = resolveTrainingCard(trainingHighlight.data);

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
        <SectionTitle>今日重點</SectionTitle>

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

          {/* 教育訓練 */}
          <HighlightCard
            icon="🎓"
            label="教育訓練"
            loading={trainingHighlight.loading}
            urgent={trainingCard.urgent}
            warning={trainingCard.warning}
            text={trainingHighlight.error ? '服務暫時無法連線' : trainingCard.text}
            subText={trainingHighlight.error ? null : trainingCard.subText}
            unavailable={trainingHighlight.error}
            onClick={() => window.open('https://lohas-lms-backend.onrender.com', '_blank')}
          />

          {/* 未來可新增其他模組的今日重點 */}

        </div>
      </div>

      {/* ── 功能模組入口 ── */}
      {available.length > 0 && (
        <>
          <SectionTitle>功能模組</SectionTitle>
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

// ── 小工具：區塊標題 ─────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 700, color: C.mid,
      marginBottom: 12, letterSpacing: '0.05em',
      textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ width: 3, height: 14, background: C.mid, borderRadius: 2, display: 'inline-block' }} />
      {children}
    </div>
  );
}
