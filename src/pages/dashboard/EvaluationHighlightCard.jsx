// pages/dashboard/EvaluationHighlightCard.jsx
// 今日重點：人員評價系統動態牆卡片
// 顯示今日客訴/建議/評價摘要，可展開查看完整時間線

import { useState } from 'react';

// ── 狀態 / 緊急度 / 類型設定 ─────────────────────────────
const STATUS_CFG = {
  pending:    { label: '待處理', color: '#c53030', bg: '#fff5f5', border: '#feb2b2' },
  processing: { label: '處理中', color: '#d69e2e', bg: '#fffff0', border: '#f6e05e' },
  resolved:   { label: '已解決', color: '#276749', bg: '#f0fff4', border: '#9ae6b4' },
  closed:     { label: '已結案', color: '#718096', bg: '#f7fafc', border: '#e2e8f0' },
};

const URGENCY_CFG = {
  urgent: { label: '🔴 緊急', color: '#c53030', bg: '#fff5f5', border: '#feb2b2' },
  normal: { label: '🟡 一般', color: '#d69e2e', bg: '#fffff0', border: '#f6e05e' },
};

const KIND_CFG = {
  feedback: {
    complaint:  { icon: '⚠️', label: '客訴', color: '#c53030' },
    suggestion: { icon: '💡', label: '建議', color: '#2b6cb0' },
  },
  review: {
    negative: { icon: '👎', label: '負評', color: '#c53030' },
    positive: { icon: '👍', label: '好評', color: '#276749' },
    neutral:  { icon: '➖', label: '中性', color: '#718096' },
  },
};

function SmallBadge({ text, color, bg, border }) {
  return (
    <span style={{
      display: 'inline-block',
      background: bg, color, border: `1px solid ${border}`,
      borderRadius: 999, padding: '1px 8px',
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  );
}

// ── 時間線單筆 ────────────────────────────────────────────
function TimelineItem({ item }) {
  const [open, setOpen] = useState(false);

  const kindMap  = KIND_CFG[item.kind]  || {};
  const typeCfg  = kindMap[item.type]   || { icon: '📌', label: item.type, color: '#718096' };
  const statusCfg = STATUS_CFG[item.status] || { label: item.status, color: '#718096', bg: '#f7fafc', border: '#e2e8f0' };
  const isUrgent = item.urgency === 'urgent';

  const timeStr = item.created_at
    ? new Date(item.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei' })
    : '';

  return (
    <div style={{
      marginBottom: 6, borderRadius: 7,
      border: `1px solid ${isUrgent ? '#feb2b2' : '#e0d5c8'}`,
      background: isUrgent ? '#fff8f8' : '#fafaf9',
      overflow: 'hidden',
    }}>
      {/* 主列 */}
      <div
        onClick={() => item.content_preview && setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          padding: '8px 10px',
          cursor: item.content_preview ? 'pointer' : 'default',
        }}
      >
        {/* 類型圖示 */}
        <span style={{ fontSize: 15, lineHeight: 1.4, flexShrink: 0 }}>{typeCfg.icon}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 第一行：類型標籤 + 客戶 + 門市 + 時間 */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: typeCfg.color }}>{typeCfg.label}</span>
            {item.client_name && (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#3a2e1e' }}>{item.client_name}</span>
            )}
            {item.assigned_store && (
              <span style={{ fontSize: 11, color: '#9a8878' }}>· {item.assigned_store}</span>
            )}
            <span style={{ fontSize: 11, color: '#b0a090', marginLeft: 'auto' }}>{timeStr}</span>
          </div>

          {/* 第二行：狀態 + 緊急度 + 分類 + 負責人 */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <SmallBadge text={statusCfg.label} color={statusCfg.color} bg={statusCfg.bg} border={statusCfg.border} />
            {isUrgent && (
              <SmallBadge text="緊急" color="#c53030" bg="#fff5f5" border="#feb2b2" />
            )}
            {item.category && (
              <span style={{ fontSize: 11, color: '#8b7050', background: '#f5f0ea', borderRadius: 999, padding: '1px 7px', border: '1px solid #e0d5c8' }}>
                {item.category}
              </span>
            )}
            {item.assigned_to && (
              <span style={{ fontSize: 11, color: '#718096', marginLeft: 2 }}>負責：{item.assigned_to}</span>
            )}
          </div>
        </div>

        {/* 展開箭頭 */}
        {item.content_preview && (
          <span style={{ color: '#cdbea2', fontSize: 13, flexShrink: 0, marginTop: 2 }}>
            {open ? '▲' : '▼'}
          </span>
        )}
      </div>

      {/* 展開：內文預覽 + 即時回應 */}
      {open && item.content_preview && (
        <div style={{ borderTop: '1px solid #e0d5c8', padding: '8px 10px 10px', background: '#fff' }}>
          <div style={{ fontSize: 12, color: '#4a5568', lineHeight: 1.6, marginBottom: item.immediate_response ? 8 : 0 }}>
            {item.content_preview}
          </div>
          {item.immediate_response && (
            <div style={{ fontSize: 12, color: '#276749', background: '#f0fff4', borderLeft: '3px solid #68d391', padding: '6px 10px', borderRadius: '0 5px 5px 0' }}>
              <span style={{ fontWeight: 600 }}>即時回應：</span>{item.immediate_response}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 摘要數字區塊 ──────────────────────────────────────────
function StatPill({ icon, label, value, color = '#6b5640' }) {
  return (
    <span style={{ fontSize: 12, color, fontWeight: value > 0 ? 600 : 400 }}>
      {icon} {label} {value}
    </span>
  );
}

// ════════════════════════════════════════════════════════════
// 主卡片
// ════════════════════════════════════════════════════════════
export default function EvaluationHighlightCard({ loading, success, data }) {
  const [collapsed, setCollapsed] = useState(true);

  const summary    = data?.summary    || {};
  const timeline   = data?.timeline   || [];
  const feedbacks  = summary.feedbacks || {};
  const reviews    = summary.reviews   || {};
  const totalToday = summary.total_today || 0;

  const urgentCount  = feedbacks.by_urgency?.urgent || 0;
  const pendingCount = (feedbacks.by_status?.pending || 0) + (reviews.by_status?.pending || 0);
  const complaintCnt = feedbacks.by_type?.complaint || 0;
  const negativeCnt  = reviews.by_type?.negative    || 0;

  const accentColor = urgentCount  > 0 ? '#c53030'
    : pendingCount  > 0            ? '#d69e2e'
    : totalToday    > 0            ? '#2b6cb0'
    : '#276749';

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e0d5c8',
      overflow: 'hidden',
      boxShadow: urgentCount > 0 ? '0 0 0 2px #c5303030' : 'none',
    }}>
      {/* ── 頭部（可點擊收合）── */}
      <div
        onClick={() => !loading && success && totalToday > 0 && setCollapsed(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', cursor: (!loading && success && totalToday > 0) ? 'pointer' : 'default',
          borderBottom: collapsed ? 'none' : '1px solid #e0d5c8',
        }}
      >
        {/* 左色條 */}
        <div style={{
          width: 4, borderRadius: 2, alignSelf: 'stretch',
          background: loading || !success ? '#cbd5e0' : accentColor,
          minHeight: 28, flexShrink: 0,
        }} />

        <div style={{ fontSize: 20 }}>🗂️</div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a202c' }}>人員評價</div>

          {loading && (
            <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>載入中...</div>
          )}
          {!loading && !success && (
            <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>暫時無法連線</div>
          )}
          {!loading && success && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 5, alignItems: 'center' }}>
              {totalToday === 0 ? (
                <span style={{ fontSize: 12, color: '#9a8878' }}>今日無動態</span>
              ) : (
                <>
                  <span style={{ fontSize: 12, fontWeight: 600, color: accentColor }}>
                    今日 {totalToday} 筆
                  </span>
                  {feedbacks.total > 0 && (
                    <StatPill icon="📩" label="回饋" value={feedbacks.total} color={complaintCnt > 0 ? '#c53030' : '#6b5640'} />
                  )}
                  {reviews.total > 0 && (
                    <StatPill icon="⭐" label="評價" value={reviews.total} color={negativeCnt > 0 ? '#c53030' : '#6b5640'} />
                  )}
                  {urgentCount > 0 && (
                    <SmallBadgeInline text={`🔴 緊急 ${urgentCount}`} color="#c53030" bg="#fff5f5" border="#feb2b2" />
                  )}
                  {pendingCount > 0 && urgentCount === 0 && (
                    <SmallBadgeInline text={`⏳ 待處理 ${pendingCount}`} color="#d69e2e" bg="#fffff0" border="#f6e05e" />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* 收合按鈕 */}
        {!loading && success && totalToday > 0 && (
          <div style={{ color: '#cdbea2', fontSize: 16, flexShrink: 0 }}>
            {collapsed ? '▼' : '▲'}
          </div>
        )}
      </div>

      {/* ── 展開：時間線 ── */}
      {!collapsed && !loading && success && (
        <div style={{ padding: '12px 16px 14px' }}>

          {/* 摘要數字列 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12, padding: '8px 10px', background: '#f7f5f2', borderRadius: 7, fontSize: 12 }}>
            {feedbacks.total > 0 && (
              <>
                <span style={{ color: '#8b6f4e', fontWeight: 600 }}>回饋</span>
                {feedbacks.by_type?.complaint > 0 && <StatPill icon="⚠️" label="客訴" value={feedbacks.by_type.complaint} color="#c53030" />}
                {feedbacks.by_type?.suggestion > 0 && <StatPill icon="💡" label="建議" value={feedbacks.by_type.suggestion} color="#2b6cb0" />}
                {feedbacks.by_urgency?.urgent > 0 && <StatPill icon="🔴" label="緊急" value={feedbacks.by_urgency.urgent} color="#c53030" />}
              </>
            )}
            {feedbacks.total > 0 && reviews.total > 0 && (
              <span style={{ color: '#e0d5c8' }}>│</span>
            )}
            {reviews.total > 0 && (
              <>
                <span style={{ color: '#8b6f4e', fontWeight: 600 }}>評價</span>
                {reviews.by_type?.negative > 0 && <StatPill icon="👎" label="負評" value={reviews.by_type.negative} color="#c53030" />}
                {reviews.by_type?.positive > 0 && <StatPill icon="👍" label="好評" value={reviews.by_type.positive} color="#276749" />}
              </>
            )}
          </div>

          {/* 時間線列表 */}
          {timeline.length > 0
            ? timeline.map((item) => <TimelineItem key={item.id} item={item} />)
            : <div style={{ textAlign: 'center', color: '#9a8878', fontSize: 13, padding: '8px 0' }}>今日無動態記錄</div>
          }
        </div>
      )}

      {/* 無法連線提示 */}
      {!loading && !success && (
        <div style={{ padding: '10px 20px 12px', fontSize: 12, color: '#a0aec0', borderTop: '1px solid #e0d5c8' }}>
          評價系統目前無法回應，請稍後再試
        </div>
      )}
    </div>
  );
}

// 行內 badge 輔助（避免在 JSX 裡重複寫 style）
function SmallBadgeInline({ text, color, bg, border }) {
  return (
    <span style={{
      display: 'inline-block',
      background: bg, color, border: `1px solid ${border}`,
      borderRadius: 999, padding: '1px 9px',
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  );
}
