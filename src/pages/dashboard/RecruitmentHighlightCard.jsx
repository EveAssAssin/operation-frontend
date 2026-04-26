// pages/dashboard/RecruitmentHighlightCard.jsx
// 今日重點：人力招募卡片

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ACCENT = {
  urgent:  '#c05621',   // 橘（有待辦）
  normal:  '#2d6a4f',   // 綠（無異常）
  neutral: '#8b6f4e',   // 棕
};

function Badge({ count, label, color, bg }) {
  if (!count) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: bg, color, border: `1px solid ${color}33`,
      borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700 }}>{count}</span>
      <span style={{ fontWeight: 400 }}>{label}</span>
    </span>
  );
}

function Row({ icon, name, detail, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0', fontSize: 13 }}>
      <span>{icon}</span>
      <span style={{ fontWeight: 600, color: color || '#3a2e1e', minWidth: 60 }}>{name}</span>
      {detail && <span style={{ color: '#9a8878', fontSize: 12 }}>{detail}</span>}
    </div>
  );
}

function Sub({ label, color }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color,
      letterSpacing: '0.06em', margin: '10px 0 4px',
    }}>{label}</div>
  );
}

export default function RecruitmentHighlightCard({ loading, success, data }) {
  const [collapsed, setCollapsed] = useState(true);
  const navigate = useNavigate();

  const todayCount   = data?.today_interviews?.length   || 0;
  const pendingCount = data?.pending_scheduling?.length || 0;
  const missingCount = data?.missing_results?.length    || 0;
  const openNeeds    = data?.open_needs?.total          || 0;
  const urgentNeeds  = data?.open_needs?.urgent         || 0;

  const hasAction = todayCount > 0 || pendingCount > 0 || missingCount > 0;
  const accentColor = hasAction ? ACCENT.urgent : ACCENT.normal;

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: '1px solid #e0d5c8', overflow: 'hidden',
      boxShadow: hasAction ? `0 0 0 2px ${accentColor}40` : 'none',
    }}>
      {/* ── 頭部（可點擊收合）── */}
      <div
        onClick={() => setCollapsed(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', cursor: 'pointer',
          borderBottom: collapsed ? 'none' : '1px solid #e0d5c8',
        }}
      >
        {/* 左色條 */}
        <div style={{
          width: 4, borderRadius: 2, alignSelf: 'stretch',
          background: loading || !success ? '#cbd5e0' : accentColor,
          minHeight: 28, flexShrink: 0,
        }} />

        <div style={{ fontSize: 20 }}>🧑‍💼</div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a202c' }}>人力招募</div>

          {loading && <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>載入中...</div>}
          {!loading && !success && <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>暫時無法載入</div>}

          {!loading && success && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
              {todayCount > 0 && (
                <Badge count={todayCount} label="今日面試"
                  color="#c53030" bg="#fff5f5" />
              )}
              {missingCount > 0 && (
                <Badge count={missingCount} label="結果未填"
                  color={ACCENT.urgent} bg="#fffaf0" />
              )}
              {pendingCount > 0 && (
                <Badge count={pendingCount} label="待安排"
                  color="#5a67d8" bg="#ebf4ff" />
              )}
              {openNeeds > 0 && (
                <Badge count={openNeeds} label={urgentNeeds > 0 ? `開缺（${urgentNeeds} 急）` : '開缺'}
                  color={ACCENT.neutral} bg="#f5f0ea" />
              )}
              {!hasAction && openNeeds === 0 && (
                <span style={{ fontSize: 12, color: '#9a8878' }}>本日無待辦</span>
              )}
            </div>
          )}
        </div>

        {success && !loading && (
          <div style={{ color: '#cdbea2', fontSize: 16, flexShrink: 0 }}>
            {collapsed ? '▼' : '▲'}
          </div>
        )}
      </div>

      {/* ── 展開內容 ── */}
      {!collapsed && !loading && success && data && (
        <div style={{ padding: '12px 20px 16px 20px' }}>

          {/* 今日面試 */}
          {todayCount > 0 && (
            <>
              <Sub label="📅 今日面試" color="#c53030" />
              {data.today_interviews.map((a, i) => (
                <Row key={i} icon="🔴"
                  name={a.name}
                  detail={[a.time, a.store_name].filter(Boolean).join(' · ')}
                  color="#c53030"
                />
              ))}
            </>
          )}

          {/* 結果未填 */}
          {missingCount > 0 && (
            <>
              <Sub label="⚠ 面試結果未填" color={ACCENT.urgent} />
              {data.missing_results.map((iv, i) => (
                <Row key={i} icon="🟠"
                  name={iv.name}
                  detail={[iv.interview_date, iv.store_name].filter(Boolean).join(' · ')}
                  color={ACCENT.urgent}
                />
              ))}
            </>
          )}

          {/* 待安排面試 */}
          {pendingCount > 0 && (
            <>
              <Sub label="📋 待安排面試" color="#5a67d8" />
              {data.pending_scheduling.slice(0, 5).map((a, i) => (
                <Row key={i} icon="🔵"
                  name={a.name}
                  detail={a.store_name}
                />
              ))}
              {pendingCount > 5 && (
                <div style={{ fontSize: 12, color: '#9a8878', paddingLeft: 22, paddingBottom: 4 }}>
                  還有 {pendingCount - 5} 人...
                </div>
              )}
            </>
          )}

          {/* 開缺概況 */}
          {openNeeds > 0 && (
            <div style={{
              marginTop: 10, padding: '8px 12px',
              background: '#f5f0ea', borderRadius: 8,
              fontSize: 12, color: '#6b5640',
            }}>
              📌 目前開缺 {openNeeds} 個需求
              {urgentNeeds > 0 && <span style={{ color: ACCENT.urgent, fontWeight: 700, marginLeft: 6 }}>（其中 {urgentNeeds} 個急徵）</span>}
            </div>
          )}

          {/* 前往按鈕 */}
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button
              onClick={e => { e.stopPropagation(); navigate('/recruitment'); }}
              style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid #cdbea2',
                background: '#f5f0ea', color: '#50422d',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >前往招募模組 ›</button>
          </div>
        </div>
      )}
    </div>
  );
}
