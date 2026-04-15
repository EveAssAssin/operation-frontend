// pages/dashboard/SalesHighlightCard.jsx
// 今日重點：業績系統卡片（月度 KPI + 同門市比較）

import { useState } from 'react';

// ── 工具 ─────────────────────────────────────────────────
const fmtAmt = (n) =>
  n != null
    ? new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)
    : '—';

const fmtPct = (n) =>
  n != null ? `${n > 0 ? '+' : ''}${n.toFixed(1)}%` : null;

// ── 趨勢標籤 ─────────────────────────────────────────────
function TrendBadge({ pct, label }) {
  if (pct == null) return null;
  const up    = pct > 0;
  const zero  = pct === 0;
  const color = zero ? '#9a8878' : up ? '#276749' : '#c53030';
  const bg    = zero ? '#f5f0ea' : up ? '#f0fff4' : '#fff5f5';
  const arrow = zero ? '→' : up ? '▲' : '▼';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: bg, color,
      border: `1px solid ${color}33`,
      borderRadius: 999, padding: '1px 8px',
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {arrow} {fmtPct(pct)}{label ? ` ${label}` : ''}
    </span>
  );
}

// ── 單一 KPI 列（展開區用）────────────────────────────────
function KpiRow({ kpi }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '7px 0',
      borderBottom: '1px solid #f0ebe4',
    }}>
      <div style={{ flex: 1, fontSize: 13, color: '#6b5640' }}>{kpi.label}</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#3a2e1e', marginRight: 10 }}>
        {kpi.unit === '$' ? fmtAmt(kpi.value) : `${kpi.value}${kpi.unit || ''}`}
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        {kpi.mom_pct != null && <TrendBadge pct={kpi.mom_pct} label="MoM" />}
        {kpi.yoy_pct != null && <TrendBadge pct={kpi.yoy_pct} label="YoY" />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 主卡片
// ════════════════════════════════════════════════════════════
export default function SalesHighlightCard({ loading, success, data }) {
  const [collapsed, setCollapsed] = useState(false); // 業績卡預設展開（最重要）

  const kpis      = data?.kpis        || [];
  const sameStore = data?.same_store  || null;
  const period    = data?.period      || '';
  const dataAsOf  = data?.data_as_of  || null;

  // 主 KPI：total_revenue
  const mainKpi = kpis.find(k => k.key === 'total_revenue') || kpis[0];
  const subKpis = kpis.filter(k => k !== mainKpi);

  // 左色條顏色：依主 KPI YoY 判斷
  const mainYoy  = mainKpi?.yoy_pct;
  const accentColor = mainYoy == null  ? '#8b6f4e'
    : mainYoy >= 0                     ? '#276749'
    : '#c53030';

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e0d5c8',
      overflow: 'hidden',
    }}>
      {/* ── 頭部 ── */}
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

        <div style={{ fontSize: 20 }}>📊</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1a202c' }}>業績摘要</span>
            {period && (
              <span style={{ fontSize: 12, color: '#9a8878' }}>{period}</span>
            )}
            {dataAsOf && (
              <span style={{ fontSize: 11, color: '#b0a090' }}>資料至 {dataAsOf}</span>
            )}
          </div>

          {loading && (
            <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>載入中...</div>
          )}
          {!loading && !success && (
            <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>暫時無法連線</div>
          )}
          {!loading && success && mainKpi && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 5 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#3a2e1e' }}>
                {fmtAmt(mainKpi.value)}
              </span>
              {mainKpi.mom_pct != null && <TrendBadge pct={mainKpi.mom_pct} label="MoM" />}
              {mainKpi.yoy_pct != null && <TrendBadge pct={mainKpi.yoy_pct} label="YoY" />}
            </div>
          )}
        </div>

        {/* 收合按鈕 */}
        {!loading && success && (
          <div style={{ color: '#cdbea2', fontSize: 16, flexShrink: 0 }}>
            {collapsed ? '▼' : '▲'}
          </div>
        )}
      </div>

      {/* ── 展開內容 ── */}
      {!collapsed && !loading && success && data && (
        <div style={{ padding: '12px 16px 14px' }}>

          {/* 其他 KPI 列表 */}
          {subKpis.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {subKpis.map((k, i) => <KpiRow key={i} kpi={k} />)}
            </div>
          )}

          {/* 同門市比較 */}
          {sameStore && (
            <div style={{
              background: '#f5f0ea', borderRadius: 8,
              padding: '10px 14px', marginTop: 4,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#8b6f4e',
                letterSpacing: '0.05em', marginBottom: 8,
              }}>
                🏪 同門市比較（{sameStore.store_count} 家）
              </div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#9a8878', marginBottom: 2 }}>本期</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#3a2e1e' }}>
                    {fmtAmt(sameStore.current_revenue)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#9a8878', marginBottom: 2 }}>去年同期</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#3a2e1e' }}>
                    {fmtAmt(sameStore.yoy_revenue)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                  <TrendBadge pct={sameStore.yoy_pct} label="YoY" />
                </div>
              </div>
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
          業績系統目前無法回應，請稍後再試
        </div>
      )}
    </div>
  );
}
