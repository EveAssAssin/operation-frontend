// pages/dashboard/AuditHighlightCard.jsx
// 今日重點：稽察卡片
// 顯示今日稽察排程、月稽 / 季稽進度

import { useState } from 'react';

// ── 稽察項目狀態設定 ──────────────────────────────────────
const AUDIT_STATUS = {
  signed:       { label: '✅ 已簽收', color: '#276749', bg: '#f0fff4', border: '#9ae6b4' },
  completed:    { label: '✅ 已完成', color: '#276749', bg: '#f0fff4', border: '#9ae6b4' },
  pending_sign: { label: '⏳ 待簽收', color: '#d69e2e', bg: '#fffff0', border: '#f6e05e' },
  in_progress:  { label: '🔍 進行中', color: '#2b6cb0', bg: '#ebf8ff', border: '#90cdf4' },
  scheduled:    { label: '📅 已排定', color: '#6b46c1', bg: '#faf5ff', border: '#d6bcfa' },
  not_started:  { label: '⏸ 未開始', color: '#a0aec0', bg: '#f7fafc', border: '#e2e8f0' },
};

function AuditBadge({ status }) {
  if (!status) return null;
  const cfg = AUDIT_STATUS[status] || AUDIT_STATUS.not_started;
  return (
    <span style={{
      display: 'inline-block',
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
      borderRadius: 999, padding: '1px 8px',
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

// ── 進度條 ────────────────────────────────────────────────
function ProgressBar({ label, done, total }) {
  if (!total) return null;
  const pct = Math.round((done / total) * 100);
  const barColor = pct === 100 ? '#276749' : '#d69e2e';

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 12, color: '#6b5640', marginBottom: 4,
      }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600 }}>{done}/{total} 完成</span>
      </div>
      <div style={{ height: 6, background: '#e0d5c8', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: barColor, borderRadius: 3,
          transition: 'width 0.4s',
        }} />
      </div>
    </div>
  );
}

// ── 門市稽察列 ────────────────────────────────────────────
function StoreAuditRow({ store }) {
  const hasPending =
    store.monthly_order?.status         === 'pending_sign' ||
    store.quarterly_contact_lens?.status === 'pending_sign' ||
    store.quarterly_glasses?.status      === 'pending_sign';

  return (
    <div style={{
      padding: '8px 10px',
      marginBottom: 4, borderRadius: 6,
      background: hasPending ? '#fffff0' : '#fafaf9',
      border: `1px solid ${hasPending ? '#f6e05e' : '#e0d5c8'}`,
    }}>
      {/* 門市名稱 */}
      <div style={{ fontWeight: 600, fontSize: 13, color: '#3a2e1e', marginBottom: 6 }}>
        {store.store_name}
      </div>

      {/* 三類稽察項目 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {store.monthly_order && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b5640' }}>
            <span>月稽</span>
            <AuditBadge status={store.monthly_order.status} />
            {store.monthly_order.total_score != null && (
              <span style={{ color: '#a0aec0' }}>（{store.monthly_order.total_score} 分）</span>
            )}
          </div>
        )}
        {store.quarterly_contact_lens && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b5640' }}>
            <span>季稽·隱眼</span>
            <AuditBadge status={store.quarterly_contact_lens.status} />
          </div>
        )}
        {store.quarterly_glasses && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b5640' }}>
            <span>季稽·眼鏡</span>
            <AuditBadge status={store.quarterly_glasses.status} />
          </div>
        )}
        {!store.monthly_order && !store.quarterly_contact_lens && !store.quarterly_glasses && (
          <span style={{ fontSize: 12, color: '#a0aec0' }}>今日無稽察項目</span>
        )}
      </div>
    </div>
  );
}

// ── 分隔標題 ─────────────────────────────────────────────
function SubSection({ label }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: '#8b6f4e',
      letterSpacing: '0.06em',
      margin: '12px 0 6px',
    }}>
      {label}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 主卡片
// ════════════════════════════════════════════════════════════
export default function AuditHighlightCard({ loading, success, data }) {
  const [collapsed, setCollapsed] = useState(true);

  const todayScheduled = data?.today?.scheduled  || 0;
  const todayStores    = data?.today?.stores      || [];
  const monthly        = data?.monthly            || {};
  const quarterly      = data?.quarterly          || {};

  // 有任何待簽收 → 黃色警示
  const hasPending = todayStores.some(s =>
    s.monthly_order?.status         === 'pending_sign' ||
    s.quarterly_contact_lens?.status === 'pending_sign' ||
    s.quarterly_glasses?.status      === 'pending_sign'
  );

  const monthlyAllDone = monthly.total > 0 && monthly.completed >= monthly.total;
  const accentColor = hasPending        ? '#d69e2e'
    : monthlyAllDone && !hasPending     ? '#276749'
    : '#2b6cb0';

  const quarterTotal    = (quarterly.contact_lens || 0) + (quarterly.glasses || 0);
  const quarterComplete = quarterly.total_completed || 0;

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e0d5c8',
      overflow: 'hidden',
      boxShadow: hasPending ? '0 0 0 2px #d69e2e30' : 'none',
    }}>
      {/* ── 頭部（可點擊收合）── */}
      <div
        onClick={() => !loading && success && todayScheduled > 0 && setCollapsed(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', cursor: (!loading && success && todayScheduled > 0) ? 'pointer' : 'default',
          borderBottom: collapsed ? 'none' : '1px solid #e0d5c8',
        }}
      >
        {/* 左色條 */}
        <div style={{
          width: 4, borderRadius: 2, alignSelf: 'stretch',
          background: loading || !success ? '#cbd5e0' : accentColor,
          minHeight: 28, flexShrink: 0,
        }} />

        <div style={{ fontSize: 20 }}>📋</div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a202c' }}>稽察</div>

          {loading && (
            <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>載入中...</div>
          )}
          {!loading && !success && (
            <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>暫時無法連線</div>
          )}
          {!loading && success && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5, alignItems: 'center' }}>
              {/* 今日排程 */}
              <span style={{ fontSize: 12, fontWeight: 600, color: todayScheduled > 0 ? accentColor : '#9a8878' }}>
                {todayScheduled > 0 ? `今日 ${todayScheduled} 家` : '今日無排程'}
              </span>

              {/* 月稽進度 */}
              {monthly.total > 0 && (
                <span style={{ fontSize: 12, color: '#6b5640' }}>
                  月稽 {monthly.completed}/{monthly.total} 完成
                  {monthly.signed > 0 && (
                    <span style={{ color: '#276749' }}>（{monthly.signed} 已簽收）</span>
                  )}
                </span>
              )}

              {/* 季稽進度 */}
              {quarterTotal > 0 && (
                <span style={{ fontSize: 12, color: '#6b5640' }}>
                  · 季稽 {quarterComplete}/{quarterTotal}
                </span>
              )}

              {/* 待簽收警示 */}
              {hasPending && (
                <span style={{
                  background: '#fffff0', color: '#d69e2e',
                  border: '1px solid #f6e05e',
                  borderRadius: 999, padding: '1px 9px',
                  fontSize: 11, fontWeight: 700,
                }}>
                  ⏳ 待簽收
                </span>
              )}
            </div>
          )}
        </div>

        {/* 收合按鈕 */}
        {!loading && success && todayScheduled > 0 && (
          <div style={{ color: '#cdbea2', fontSize: 16, flexShrink: 0 }}>
            {collapsed ? '▼' : '▲'}
          </div>
        )}
      </div>

      {/* ── 展開內容 ── */}
      {!collapsed && !loading && success && data && (
        <div style={{ padding: '12px 16px 14px' }}>

          {/* 月稽進度條 */}
          {monthly.total > 0 && (
            <ProgressBar
              label="📆 月稽"
              done={monthly.completed}
              total={monthly.total}
            />
          )}

          {/* 季稽進度條 */}
          {(quarterly.contact_lens > 0 || quarterly.glasses > 0) && (
            <>
              {quarterly.contact_lens > 0 && (
                <ProgressBar
                  label="👁 季稽·隱形眼鏡"
                  done={quarterComplete}
                  total={quarterly.contact_lens}
                />
              )}
              {quarterly.glasses > 0 && (
                <ProgressBar
                  label="🕶 季稽·眼鏡"
                  done={quarterComplete}
                  total={quarterly.glasses}
                />
              )}
            </>
          )}

          {/* 今日排程列表 */}
          {todayStores.length > 0 && (
            <>
              <SubSection label={`📋 今日稽察（${todayScheduled} 家）`} />
              {todayStores.map((store, i) => (
                <StoreAuditRow key={store.store_erpid || i} store={store} />
              ))}
            </>
          )}

          {todayScheduled === 0 && (
            <div style={{ textAlign: 'center', color: '#9a8878', fontSize: 13, padding: '8px 0' }}>
              今日無稽察排程
            </div>
          )}
        </div>
      )}

      {/* 無法連線提示 */}
      {!loading && !success && (
        <div style={{
          padding: '10px 20px 12px',
          fontSize: 12, color: '#a0aec0',
          borderTop: '1px solid #e0d5c8',
        }}>
          稽察系統目前無法回應，請稍後再試
        </div>
      )}
    </div>
  );
}
