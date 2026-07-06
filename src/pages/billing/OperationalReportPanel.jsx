// pages/billing/OperationalReportPanel.jsx
// 營運報表：KPI + 圖表（折線/堆疊區域切換）+ YoY + 明細表 + Excel 匯出

import { useState, useEffect, useCallback } from 'react';
import { operationalExpensesApi, personnelApi, basicDataApi } from '../../services/api';
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';

const fmt = n => Number(n || 0).toLocaleString('zh-TW');
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 圖表用配色
const COLORS = ['#c8860d', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b', '#14b8a6', '#ec4899', '#6366f1', '#84cc16'];

export default function OperationalReportPanel() {
  const [filter, setFilter] = useState({
    from:        monthsAgo(11),
    to:          currentMonth(),
    category_id: '',
    store_erpid: '',
    store_scope: 'all',
  });
  const [chartMode, setChartMode] = useState('line'); // 'line' | 'area'
  const [chartDim, setChartDim]   = useState('category'); // 'category' | 'store'
  const [data, setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [storeMap, setStoreMap]     = useState({});
  const [exporting, setExporting]   = useState(false);

  const load = useCallback(async () => {
    if (!filter.from || !filter.to) return;
    setLoading(true);
    try {
      const params = {};
      for (const k of ['from', 'to', 'category_id', 'store_erpid', 'store_scope']) {
        if (filter[k]) params[k] = filter[k];
      }
      const r = await operationalExpensesApi.getReport(params);
      setData(r.success ? r.data : null);
    } catch (e) {
      alert('載入失敗：' + (e?.message || e));
    } finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    basicDataApi.listCategories().then(r => setCategories(r.success ? r.data : [])).catch(() => {});
    personnelApi.getDepartments().then(r => {
      const m = {};
      for (const d of (r.data || [])) if (d.store_erpid) m[d.store_erpid] = d.store_name;
      setStoreMap(m);
    }).catch(() => {});
  }, []);

  async function exportExcel() {
    setExporting(true);
    try {
      const params = {};
      for (const k of ['from', 'to', 'category_id', 'store_erpid', 'store_scope']) {
        if (filter[k]) params[k] = filter[k];
      }
      const res = await operationalExpensesApi.exportReport(params);
      const blob = new Blob([res.data || res], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `營運報表_${filter.from}_${filter.to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('匯出失敗：' + (e?.response?.data?.message || e?.message || e));
    } finally { setExporting(false); }
  }

  const kpi = data?.kpi || {};
  const yoyColor = kpi.yoy_ratio == null ? '#718096' : kpi.yoy_ratio > 0.1 ? '#c53030' : kpi.yoy_ratio < -0.05 ? '#276749' : '#4a5568';
  const catNames = data?.category_names || [];
  const chartData = chartDim === 'category' ? (data?.chart_by_category || []) : (data?.chart_by_store || []);
  const chartKeys = chartDim === 'category'
    ? catNames
    : (data?.top_stores || []).map(s => s.store_name);

  // 明細表 (月度彙總)
  const summary = data?.summary || [];

  return (
    <div>
      {/* 篩選列 */}
      <div style={S.toolbar}>
        <span style={S.label}>期間</span>
        <input type="month" style={S.input} value={filter.from} onChange={e => setFilter(f => ({ ...f, from: e.target.value }))} />
        <span>~</span>
        <input type="month" style={S.input} value={filter.to} onChange={e => setFilter(f => ({ ...f, to: e.target.value }))} />
        <span style={S.label}>門市</span>
        <select style={S.select} value={filter.store_erpid} onChange={e => setFilter(f => ({ ...f, store_erpid: e.target.value }))}>
          <option value="">全部</option>
          {Object.entries(storeMap).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <span style={S.label}>顯示</span>
        <select style={S.select} value={filter.store_scope} onChange={e => setFilter(f => ({ ...f, store_scope: e.target.value }))}>
          <option value="all">全部</option>
          <option value="store_only">只看門市</option>
          <option value="misc_only">只看非門市 (MISC)</option>
        </select>
        <span style={S.label}>品項</span>
        <select style={S.select} value={filter.category_id} onChange={e => setFilter(f => ({ ...f, category_id: e.target.value }))}>
          <option value="">全部</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon || ''} {c.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button style={S.btnPrimary} disabled={exporting || loading} onClick={exportExcel}>
          {exporting ? '產生中...' : '📥 匯出 Excel'}
        </button>
      </div>

      {loading && !data && <div style={S.empty}>載入中...</div>}

      {data && (
        <>
          {/* KPI 卡 */}
          <div style={S.kpiRow}>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>期間總支出</div>
              <div style={S.kpiValue}>${fmt(kpi.total)}</div>
              <div style={S.kpiHint}>{filter.from} ~ {filter.to}（{kpi.non_zero_months} 個月有資料）</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>平均月支出</div>
              <div style={S.kpiValue}>${fmt(Math.round(kpi.avg_monthly || 0))}</div>
              <div style={S.kpiHint}>期間內非零月份平均</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>同期比較 ({kpi.yoy_base_month} vs {kpi.yoy_prev_month})</div>
              <div style={{ ...S.kpiValue, color: yoyColor }}>
                {kpi.yoy_ratio == null ? '—' : `${kpi.yoy_diff >= 0 ? '+' : ''}${Math.round(kpi.yoy_ratio * 100)}%`}
              </div>
              <div style={S.kpiHint}>
                本月 ${fmt(kpi.this_month_total)} vs 去年 ${fmt(kpi.last_year_total)}
                {kpi.yoy_diff != null && `（差 ${kpi.yoy_diff >= 0 ? '+' : ''}$${fmt(kpi.yoy_diff)}）`}
              </div>
            </div>
          </div>

          {/* 主圖 */}
          <div style={S.chartCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <strong style={{ fontSize: 15 }}>月度趨勢</strong>
              <div style={{ flex: 1 }} />
              <div style={S.btnGroup}>
                <button style={{ ...S.btnToggle, ...(chartMode === 'line' ? S.btnToggleOn : {}) }} onClick={() => setChartMode('line')}>📈 折線</button>
                <button style={{ ...S.btnToggle, ...(chartMode === 'area' ? S.btnToggleOn : {}) }} onClick={() => setChartMode('area')}>📊 堆疊區域</button>
              </div>
              <div style={S.btnGroup}>
                <button style={{ ...S.btnToggle, ...(chartDim === 'category' ? S.btnToggleOn : {}) }} onClick={() => setChartDim('category')}>依品項</button>
                <button style={{ ...S.btnToggle, ...(chartDim === 'store' ? S.btnToggleOn : {}) }} onClick={() => setChartDim('store')}>依門市 (前 10)</button>
              </div>
            </div>
            <div style={{ width: '100%', height: 340 }}>
              <ResponsiveContainer>
                {chartMode === 'line' ? (
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="year_month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}K` : v} />
                    <Tooltip formatter={v => `$${fmt(v)}`} />
                    <Legend />
                    {chartKeys.map((k, i) => (
                      <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                ) : (
                  <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="year_month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}K` : v} />
                    <Tooltip formatter={v => `$${fmt(v)}`} />
                    <Legend />
                    {chartKeys.map((k, i) => (
                      <Area key={k} type="monotone" dataKey={k} stackId="1" stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.6} />
                    ))}
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* 明細表 (月度彙總) */}
          <div style={S.card}>
            <strong style={{ fontSize: 15 }}>月度彙總</strong>
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>月份</th>
                    {catNames.map(c => <th key={c} style={{ ...S.th, textAlign: 'right' }}>{c}</th>)}
                    <th style={{ ...S.th, textAlign: 'right' }}>合計</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>vs 前月</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row, i) => {
                    const prev = summary[i - 1]?.total || 0;
                    const diff = prev > 0 ? (row.total - prev) / prev : null;
                    return (
                      <tr key={row.year_month}>
                        <td style={S.td}>{row.year_month}</td>
                        {catNames.map(c => (
                          <td key={c} style={{ ...S.td, textAlign: 'right' }}>${fmt(row[c] || 0)}</td>
                        ))}
                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>${fmt(row.total)}</td>
                        <td style={{ ...S.td, textAlign: 'right', color: diff == null ? '#a0aec0' : diff > 0.1 ? '#c53030' : diff < -0.05 ? '#276749' : '#4a5568' }}>
                          {diff == null ? '—' : `${diff >= 0 ? '+' : ''}${Math.round(diff * 100)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const S = {
  toolbar:   { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 12 },
  label:     { fontSize: 12, color: '#4a5568', fontWeight: 600 },
  input:     { padding: '6px 10px', border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13 },
  select:    { padding: '6px 10px', border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13, background: '#fff' },
  btnPrimary:{ padding: '7px 16px', background: '#50422d', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  kpiRow:    { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 },
  kpiCard:   { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 },
  kpiLabel:  { fontSize: 12, color: '#718096', fontWeight: 600 },
  kpiValue:  { fontSize: 24, fontWeight: 700, color: '#2d3748', marginTop: 4 },
  kpiHint:   { fontSize: 11, color: '#a0aec0', marginTop: 6 },
  chartCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 12 },
  btnGroup:  { display: 'inline-flex', border: '1px solid #cbd5e0', borderRadius: 6, overflow: 'hidden' },
  btnToggle: { padding: '5px 12px', background: '#fff', color: '#4a5568', border: 'none', fontSize: 12, cursor: 'pointer' },
  btnToggleOn: { background: '#50422d', color: '#fff' },
  card:      { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 12 },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:        { padding: '8px 10px', textAlign: 'left', background: '#f7fafc', borderBottom: '2px solid #e2e8f0', color: '#4a5568', fontWeight: 600, whiteSpace: 'nowrap' },
  td:        { padding: '8px 10px', borderBottom: '1px solid #edf2f7', whiteSpace: 'nowrap' },
  empty:     { textAlign: 'center', padding: 40, color: '#a0aec0' },
};
