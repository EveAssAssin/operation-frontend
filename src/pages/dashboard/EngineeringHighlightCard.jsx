// pages/dashboard/EngineeringHighlightCard.jsx
// 今日重點：工務部模組卡片（保養 + 報修排程，含逾期追蹤）

import { useState } from 'react';

// ── 狀態設定 ─────────────────────────────────────────────
const STATUS_CONFIG = {
  overdue:     { color: '#c53030', bg: '#fff5f5', label: '🚨 超時',     border: '#feb2b2' },
  completed:   { color: '#276749', bg: '#f0fff4', label: '✅ 已完成',   border: '#b7e4c7' },
  pending_sign:{ color: '#d69e2e', bg: '#fffff0', label: '⏳ 待簽收',   border: '#f6e05e' },
  in_progress: { color: '#2b6cb0', bg: '#ebf8ff', label: '🔧 進行中',   border: '#90cdf4' },
  scheduled:   { color: '#6b46c1', bg: '#faf5ff', label: '📅 排定維修', border: '#d6bcfa' },
  not_started: { color: '#a0aec0', bg: '#f7fafc', label: '⏸ 未開始',   border: '#e2e8f0' },
};

// ── StatusBadge ───────────────────────────────────────────
function StatusBadge({ status, label }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  return (
    <span style={{
      display: 'inline-block',
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      borderRadius: 999, padding: '1px 9px',
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {label || cfg.label}
    </span>
  );
}

// ── 進度條 ────────────────────────────────────────────────
function ProgressBar({ label, done, total, overdue }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  const barColor = overdue > 0 ? '#c53030' : pct === 100 ? '#276749' : '#2b6cb0';

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 12, color: '#6b5640', marginBottom: 4,
      }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600 }}>
          {done}/{total} 完成
          {overdue > 0 && (
            <span style={{ color: '#c53030', marginLeft: 6 }}>· {overdue} 項超時</span>
          )}
        </span>
      </div>
      <div style={{
        height: 6, background: '#e0d5c8', borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: barColor, borderRadius: 3,
          transition: 'width 0.4s',
        }} />
      </div>
    </div>
  );
}

// ── 工作列 ────────────────────────────────────────────────
function WorkRow({ item }) {
  const cfg = STATUS_CONFIG[item.exec_status] || STATUS_CONFIG.not_started;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 10px',
      background: item.is_overdue ? '#fff5f5' : 'transparent',
      borderRadius: 6,
      border: item.is_overdue ? '1px solid #feb2b2' : '1px solid transparent',
      marginBottom: 4,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#3a2e1e' }}>
          {item.store_name}
        </span>
        {item.engineer_name && (
          <span style={{ fontSize: 12, color: '#9a8878', marginLeft: 6 }}>
            · {item.engineer_name}
          </span>
        )}
        {item.ticket_no && (
          <span style={{ fontSize: 11, color: '#9a8878', marginLeft: 6 }}>
            #{item.ticket_no}
          </span>
        )}
      </div>
      <StatusBadge status={item.exec_status} label={item.exec_label} />
    </div>
  );
}

// ── 分隔標題 ─────────────────────────────────────────────
function SubSection({ label, color = '#8b6f4e' }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      margin: '12px 0 6px',
    }}>
      {label}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 主卡片
// ════════════════════════════════════════════════════════════
export default function EngineeringHighlightCard({ loading, success, data }) {
  const [collapsed, setCollapsed] = useState(true);

  const summary   = data?.summary    || {};
  const maint     = data?.maintenance || [];
  const repair    = data?.repair      || [];
  const ms        = summary.maintenance || {};
  const rs        = summary.repair      || {};

  const totalOverdue  = (ms.overdue || 0) + (rs.overdue || 0);
  const totalDone     = (ms.completed || 0) + (rs.completed || 0);
  const totalAll      = (ms.total || 0) + (rs.total || 0);

  const overdueItems  = [...maint, ...repair].filter(i => i.is_overdue);
  const maintToday    = maint.filter(i => !i.is_overdue);
  const repairToday   = repair.filter(i => !i.is_overdue);

  const accentColor = totalOverdue > 0 ? '#c53030'
    : totalDone === totalAll && totalAll > 0 ? '#276749'
    : '#2b6cb0';

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e0d5c8',
      overflow: 'hidden',
      boxShadow: totalOverdue > 0 ? '0 0 0 2px #c5303030' : 'none',
    }}>
      {/* ── 頭部（可點擊收合）── */}
      <div
        onClick={() => !loading && success && setCollapsed(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', cursor: (!loading && success) ? 'pointer' : 'default',
          borderBottom: collapsed ? 'none' : '1px solid #e0d5c8',
        }}
      >
        {/* 左色條 */}
        <div style={{
          width: 4, borderRadius: 2, alignSelf: 'stretch',
          background: loading || !success ? '#cbd5e0' : accentColor,
          minHeight: 28, flexShrink: 0,
        }} />

        <div style={{ fontSize: 20 }}>🔧</div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a202c' }}>工務部</div>

          {loading && (
            <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>載入中...</div>
          )}
          {!loading && !success && (
            <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>暫時無法連線</div>
          )}
          {!loading && success && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5, alignItems: 'center' }}>
              {/* 完成比例 */}
              {totalAll > 0 && (
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: totalDone === totalAll ? '#276749' : '#6b5640',
                }}>
                  {totalDone}/{totalAll} 完成
                </span>
              )}
              {totalAll === 0 && (
                <span style={{ fontSize: 12, color: '#9a8878' }}>今日無排程</span>
              )}
              {/* 超時警示 */}
              {totalOverdue > 0 && (
                <span style={{
                  background: '#fff5f5', color: '#c53030',
                  border: '1px solid #feb2b2',
                  borderRadius: 999, padding: '1px 9px',
                  fontSize: 11, fontWeight: 700,
                }}>
                  🚨 {totalOverdue} 項超時
                </span>
              )}
            </div>
          )}
        </div>

        {/* 收合按鈕 */}
        {!loading && success && totalAll > 0 && (
          <div style={{ color: '#cdbea2', fontSize: 16, flexShrink: 0 }}>
            {collapsed ? '▼' : '▲'}
          </div>
        )}
      </div>

      {/* ── 展開內容 ── */}
      {!collapsed && !loading && success && data && (
        <div style={{ padding: '12px 16px 14px' }}>

          {/* 進度條 */}
          {ms.total > 0 && (
            <ProgressBar
              label="🏪 例行保養"
              done={ms.completed}
              total={ms.total}
              overdue={ms.overdue}
            />
          )}
          {rs.total > 0 && (
            <ProgressBar
              label="🔧 報修維護"
              done={rs.completed}
              total={rs.total}
              overdue={rs.overdue}
            />
          )}

          {/* 逾期未完成（紅底，最優先）*/}
          {overdueItems.length > 0 && (
            <>
              <SubSection label="🚨 逾期未完成" color="#c53030" />
              {overdueItems.map((item, i) => <WorkRow key={`o-${i}`} item={item} />)}
            </>
          )}

          {/* 今日保養 */}
          {maintToday.length > 0 && (
            <>
              <SubSection label="🏪 今日保養排程" />
              {maintToday.map((item, i) => <WorkRow key={`m-${i}`} item={item} />)}
            </>
          )}

          {/* 今日報修 */}
          {repairToday.length > 0 && (
            <>
              <SubSection label="🔧 今日報修排程" />
              {repairToday.map((item, i) => <WorkRow key={`r-${i}`} item={item} />)}
            </>
          )}

          {totalAll === 0 && (
            <div style={{ textAlign: 'center', color: '#9a8878', fontSize: 13, padding: '8px 0' }}>
              今日無工務排程
            </div>
          )}
        </div>
      )}

      {/* 無法連線 */}
      {!loading && !success && (
        <div style={{
          padding: '10px 20px 12px',
          fontSize: 12, color: '#a0aec0',
          borderTop: '1px solid #e0d5c8',
        }}>
          工務系統目前無法回應，請稍後再試
        </div>
      )}
    </div>
  );
}
