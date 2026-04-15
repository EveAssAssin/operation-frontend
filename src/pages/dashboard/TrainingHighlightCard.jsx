// pages/dashboard/TrainingHighlightCard.jsx
// 今日重點：教育訓練模組卡片
// 接收 props: data（後端回傳的 training 模組資料）、success、loading

import { useState } from 'react';

// ── 色彩系統 ─────────────────────────────────────────────
const ACCENT = {
  sos:     '#c53030',   // 紅
  urgent:  '#c05621',   // 橘
  normal:  '#2d6a4f',   // 綠
  neutral: '#8b6f4e',   // 棕（品牌色）
};

// ── 徽章 ─────────────────────────────────────────────────
function Badge({ count, label, color = '#8b6f4e', bg = '#f5f0ea' }) {
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

// ── 人員列 ───────────────────────────────────────────────
function PersonRow({ icon, name, detail, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 8,
      padding: '4px 0', fontSize: 13,
    }}>
      <span>{icon}</span>
      <span style={{ fontWeight: 600, color: color || '#3a2e1e', minWidth: 60 }}>{name}</span>
      {detail && <span style={{ color: '#9a8878', fontSize: 12 }}>{detail}</span>}
    </div>
  );
}

// ── 分隔標題 ─────────────────────────────────────────────
function SubSection({ label, color }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      margin: '10px 0 4px',
    }}>
      {label}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 主卡片
// ════════════════════════════════════════════════════════════
export default function TrainingHighlightCard({ loading, success, data }) {
  const [collapsed, setCollapsed] = useState(false);

  // ── 判斷緊急層級 ─────────────────────────────────────
  const sosCount    = data?.sos_active?.length      || 0;
  const urgentCount = data?.urgent_attention?.length || 0;
  const accentColor = sosCount > 0 ? ACCENT.sos
    : urgentCount > 0              ? ACCENT.urgent
    : ACCENT.normal;

  const summary = data?.summary || {};

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e0d5c8',
      overflow: 'hidden',
      boxShadow: (sosCount > 0 || urgentCount > 0)
        ? `0 0 0 2px ${accentColor}40`
        : 'none',
    }}>
      {/* ── 左色條 + 頭部 ── */}
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

        {/* Icon + 標題 */}
        <div style={{ fontSize: 20 }}>🎓</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a202c' }}>教育訓練</div>
          {!loading && success && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
              {sosCount > 0 && (
                <Badge count={sosCount} label="SOS 求助"
                  color={ACCENT.sos} bg="#fff5f5" />
              )}
              {urgentCount > 0 && (
                <Badge count={urgentCount} label="需關注"
                  color={ACCENT.urgent} bg="#fffaf0" />
              )}
              {(summary.in_training > 0) && (
                <Badge count={summary.in_training} label="訓練中"
                  color={ACCENT.neutral} bg="#f5f0ea" />
              )}
              {(summary.waiting_exam > 0) && (
                <Badge count={summary.waiting_exam} label="等待考試"
                  color="#5a67d8" bg="#ebf4ff" />
              )}
              {(summary.in_exam > 0) && (
                <Badge count={summary.in_exam} label="考試中"
                  color="#2d6a4f" bg="#f0fff4" />
              )}
              {!sosCount && !urgentCount && !summary.in_training && !summary.waiting_exam && !summary.in_exam && (
                <span style={{ fontSize: 12, color: '#9a8878' }}>本日無異常</span>
              )}
            </div>
          )}
          {!loading && !success && (
            <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>暫時無法連線</div>
          )}
          {loading && (
            <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>載入中...</div>
          )}
        </div>

        {/* 收合按鈕 */}
        {success && !loading && (
          <div style={{ color: '#cdbea2', fontSize: 16, flexShrink: 0 }}>
            {collapsed ? '▼' : '▲'}
          </div>
        )}
      </div>

      {/* ── 展開內容 ── */}
      {!collapsed && !loading && success && data && (
        <div style={{ padding: '12px 20px 4px 20px' }}>

          {/* SOS 求助 */}
          {sosCount > 0 && (
            <>
              <SubSection label="🆘 SOS 求助中" color={ACCENT.sos} />
              {data.sos_active.map((p, i) => (
                <PersonRow key={i} icon="🔴"
                  name={p.name || p}
                  detail={p.detail || p.reason || null}
                  color={ACCENT.sos}
                />
              ))}
            </>
          )}

          {/* 需緊急關注 */}
          {urgentCount > 0 && (
            <>
              <SubSection label="⚠ 需緊急關注" color={ACCENT.urgent} />
              {data.urgent_attention.map((p, i) => (
                <PersonRow key={i} icon="🟠"
                  name={p.name || p}
                  detail={
                    p.risk_score != null
                      ? `風險分數 ${p.risk_score}${p.summary ? ' · ' + p.summary : ''}`
                      : (p.summary || null)
                  }
                  color={ACCENT.urgent}
                />
              ))}
            </>
          )}

          {/* 今日到職 */}
          {data.onboarding_today?.length > 0 && (
            <>
              <SubSection label="🎉 今日到職" color={ACCENT.normal} />
              {data.onboarding_today.map((p, i) => (
                <PersonRow key={i} icon="🟢"
                  name={p.name || p}
                  detail={p.position || p.dept || null}
                />
              ))}
            </>
          )}

          {/* 排隊 / 考試中 */}
          {data.exam_queue?.length > 0 && (
            <>
              <SubSection label="📝 考試排程" color="#5a67d8" />
              {data.exam_queue.slice(0, 5).map((p, i) => (
                <PersonRow key={i} icon="📋"
                  name={p.name || p}
                  detail={p.status || p.exam_name || null}
                />
              ))}
              {data.exam_queue.length > 5 && (
                <div style={{ fontSize: 12, color: '#9a8878', paddingLeft: 22, paddingBottom: 4 }}>
                  還有 {data.exam_queue.length - 5} 人...
                </div>
              )}
            </>
          )}

          {/* 本週完訓 */}
          {data.completed_this_week?.length > 0 && (
            <>
              <SubSection label="✅ 本週完訓" color={ACCENT.normal} />
              <div style={{ fontSize: 12, color: '#6b5640', paddingLeft: 4, paddingBottom: 4 }}>
                {data.completed_this_week.map(p => p.name || p).join('、')}
              </div>
            </>
          )}

          {/* 本週即將到職 */}
          {data.onboarding_this_week?.length > 0 && (
            <div style={{
              marginTop: 8, padding: '8px 12px',
              background: '#f5f0ea', borderRadius: 8,
              fontSize: 12, color: '#6b5640',
            }}>
              📅 本週即將到職：
              {data.onboarding_this_week.map(p => p.name || p).join('、')}
            </div>
          )}

          {/* 底部連結 */}
          <div style={{
            marginTop: 12, paddingTop: 10,
            borderTop: '1px solid #e0d5c8',
            paddingBottom: 12,
          }}>
            <a
              href="https://lohas-lms-backend.onrender.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12, color: '#8b6f4e', fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
            >
              前往教育訓練系統 →
            </a>
          </div>
        </div>
      )}

      {/* 無法連線時的底部提示 */}
      {!loading && !success && (
        <div style={{
          padding: '10px 20px 12px 20px',
          fontSize: 12, color: '#a0aec0',
          borderTop: '1px solid #e0d5c8',
        }}>
          教育訓練系統目前無法回應，請稍後再試
        </div>
      )}
    </div>
  );
}
