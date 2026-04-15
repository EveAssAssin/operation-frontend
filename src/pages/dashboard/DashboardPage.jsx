// pages/dashboard/DashboardPage.jsx
// 營運部系統首頁

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { checksApi, dashboardApi } from '../../services/api';
import TrainingHighlightCard from './TrainingHighlightCard';

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
// 支票出款卡片（獨立小元件）
// ════════════════════════════════════════════════════════════
function ChecksHighlightCard({ loading, total, amount, overdue, onClick }) {
  const [hover, setHover] = useState(false);
  const urgent = total > 0;
  const accentColor = urgent ? '#c53030' : '#2d6a4f';

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e0d5c8',
      overflow: 'hidden',
      boxShadow: urgent && hover ? '0 0 0 2px #c5303040' : 'none',
      transition: 'all 0.15s',
      cursor: 'pointer',
    }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
        {/* 左色條 */}
        <div style={{
          width: 4, borderRadius: 2, alignSelf: 'stretch',
          background: loading ? '#cbd5e0' : accentColor,
          minHeight: 28, flexShrink: 0,
        }} />

        <div style={{ fontSize: 20 }}>🏦</div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a202c' }}>支票出款</div>
          {loading ? (
            <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>載入中...</div>
          ) : (
            <div style={{ marginTop: 5 }}>
              <span style={{
                fontSize: 15, fontWeight: 700,
                color: urgent ? '#c53030' : '#2d6a4f',
              }}>
                {urgent ? `本日應出 ${fmtAmt(amount)}` : '本日無待辦'}
              </span>
              {urgent && (
                <span style={{ fontSize: 12, color: '#9a8878', marginLeft: 8 }}>
                  共 {total} 張{overdue > 0 ? `，逾期 ${overdue} 張` : ''}
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ color: C.light, fontSize: 16, flexShrink: 0 }}>›</div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 主頁面
// ════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  // ── 支票資料 ─────────────────────────────────────────
  const [checks, setChecks] = useState({ loading: true, total: 0, amount: 0, overdue: 0 });

  // ── 聚合 Highlights 資料（教育訓練等外部模組）────────
  const [highlights, setHighlights] = useState({ loading: true, data: null });

  const loadAll = useCallback(async () => {
    // 支票 + 聚合 API 同時發出
    const [checksRes, hlRes] = await Promise.allSettled([
      checksApi.getToday(),
      dashboardApi.getHighlights(),
    ]);

    // 支票
    if (checksRes.status === 'fulfilled') {
      const d = checksRes.value.data || {};
      const totalAmt = (d.summary || []).reduce((s, g) => s + (g.total_amount || 0), 0);
      setChecks({ loading: false, total: d.total || 0, amount: totalAmt, overdue: d.overdue_count || 0 });
    } else {
      setChecks({ loading: false, total: 0, amount: 0, overdue: 0 });
    }

    // 聚合 Highlights
    if (hlRes.status === 'fulfilled') {
      setHighlights({ loading: false, data: hlRes.value.data || {} });
    } else {
      setHighlights({ loading: false, data: {} });
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const available = QUICK_LINKS.filter(l => hasRole(l.minRole));

  const today = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    timeZone: 'Asia/Taipei',
  });

  // 各模組的資料（從聚合結果取出）
  const trainingResult = highlights.data?.training;

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
        <SectionTitle>📌 今日重點</SectionTitle>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* 支票出款 */}
          <ChecksHighlightCard
            loading={checks.loading}
            total={checks.total}
            amount={checks.amount}
            overdue={checks.overdue}
            onClick={() => navigate('/checks')}
          />

          {/* 教育訓練 */}
          <TrainingHighlightCard
            loading={highlights.loading}
            success={trainingResult?.success ?? false}
            data={trainingResult?.data ?? null}
          />

          {/* 未來其他模組在此新增，例如：
          <WorkOrderHighlightCard
            loading={highlights.loading}
            success={highlights.data?.workorder?.success ?? false}
            data={highlights.data?.workorder?.data ?? null}
          />
          */}

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
      marginBottom: 12, letterSpacing: '0.04em',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {children}
    </div>
  );
}
