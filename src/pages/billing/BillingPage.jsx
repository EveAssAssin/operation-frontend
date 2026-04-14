// pages/billing/BillingPage.jsx
// 開帳系統：按月查看各門市養護/報修費用彙總、明細、手動同步、匯出 CSV

import { useState, useEffect, useCallback } from 'react';
import { billingApi, personnelApi } from '../../services/api';

// ─── 工具函式 ────────────────────────────────────────────────

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatAmount(n) {
  return Number(n || 0).toLocaleString('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/** 產生過去 N 個月的 YYYY-MM 陣列（含當月） */
function recentMonths(n = 13) {
  const result = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    result.push(`${y}-${m}`);
    d.setMonth(d.getMonth() - 1);
  }
  return result;
}

/** 將彙總資料匯出成 CSV */
function exportSummaryCSV(summary, storeMap, month) {
  const headers = ['門市代號', '門市名稱', '養護筆數', '養護金額', '報修筆數', '報修金額', '合計筆數', '合計金額'];
  const rows = summary.map((s) => [
    s.store_erpid,
    storeMap[s.store_erpid] || s.store_erpid,
    s.maintenance_count,
    s.maintenance_amount,
    s.repair_count,
    s.repair_amount,
    s.total_count,
    s.total_amount,
  ]);
  // 加總列
  const totals = summary.reduce((acc, s) => ({
    mc: acc.mc + s.maintenance_count,
    ma: acc.ma + s.maintenance_amount,
    rc: acc.rc + s.repair_count,
    ra: acc.ra + s.repair_amount,
    tc: acc.tc + s.total_count,
    ta: acc.ta + s.total_amount,
  }), { mc: 0, ma: 0, rc: 0, ra: 0, tc: 0, ta: 0 });
  rows.push(['', '合計', totals.mc, totals.ma, totals.rc, totals.ra, totals.tc, totals.ta]);

  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const bom  = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `開帳彙總_${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 將明細資料匯出成 CSV */
function exportOrdersCSV(orders, storeMap, month, storeErpid) {
  const headers = ['訂單ID', '類型', '門市代號', '門市名稱', '金額', '簽收時間', '帳單月份'];
  const rows = orders.map((o) => [
    o.order_id,
    o.source_type === 'maintenance' ? '養護' : '報修',
    o.store_erpid,
    storeMap[o.store_erpid] || o.store_erpid,
    o.amount,
    formatDateTime(o.signed_at),
    o.billing_month,
  ]);
  const csv  = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const bom  = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `開帳明細_${month}${storeErpid ? `_${storeErpid}` : ''}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── 樣式常數 ────────────────────────────────────────────────
const S = {
  page:        { padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#1a202c' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
  title:       { fontSize: '20px', fontWeight: '700', margin: 0 },
  toolbar:     { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  select:      { padding: '6px 12px', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '14px', background: '#fff', cursor: 'pointer' },
  btnPrimary:  { padding: '7px 16px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
  btnSecondary:{ padding: '7px 16px', background: '#fff', color: '#4a5568', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' },
  btnDanger:   { padding: '7px 16px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' },
  card:        { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', marginBottom: '20px' },
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th:          { background: '#f7fafc', padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#4a5568', whiteSpace: 'nowrap' },
  thR:         { background: '#f7fafc', padding: '10px 14px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#4a5568', whiteSpace: 'nowrap' },
  td:          { padding: '10px 14px', borderBottom: '1px solid #edf2f7', verticalAlign: 'middle' },
  tdR:         { padding: '10px 14px', borderBottom: '1px solid #edf2f7', textAlign: 'right', verticalAlign: 'middle' },
  tdTotal:     { padding: '10px 14px', borderTop: '2px solid #e2e8f0', fontWeight: '700', background: '#f7fafc' },
  tdTotalR:    { padding: '10px 14px', borderTop: '2px solid #e2e8f0', fontWeight: '700', background: '#f7fafc', textAlign: 'right' },
  rowHover:    { cursor: 'pointer' },
  badge:       (type) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: '500',
    background: type === 'maintenance' ? '#ebf8ff' : '#fff5f5',
    color:      type === 'maintenance' ? '#2b6cb0' : '#c53030',
  }),
  empty:       { textAlign: 'center', color: '#a0aec0', padding: '48px 0' },
  spinner:     { textAlign: 'center', color: '#a0aec0', padding: '48px 0' },
  alert:       (type) => ({
    padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px',
    background: type === 'error' ? '#fff5f5' : '#f0fff4',
    color:      type === 'error' ? '#c53030' : '#276749',
    border:     `1px solid ${type === 'error' ? '#feb2b2' : '#9ae6b4'}`,
  }),
  detailHeader:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' },
  backBtn:     { background: 'none', border: 'none', cursor: 'pointer', color: '#3182ce', fontSize: '14px', padding: '0', display: 'flex', alignItems: 'center', gap: '4px' },
  syncInfo:    { fontSize: '12px', color: '#718096', marginTop: '6px' },
};

// ─── 主元件 ─────────────────────────────────────────────────

export default function BillingPage() {
  const months  = recentMonths(13);
  const [month, setMonth]           = useState(currentMonth());
  const [summary, setSummary]       = useState([]);
  const [storeMap, setStoreMap]     = useState({});   // { store_erpid → store_name }
  const [loading, setLoading]       = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [message, setMessage]       = useState(null); // { type: 'error'|'success', text }
  const [selectedStore, setSelectedStore] = useState(null); // { store_erpid, store_name }
  const [orders, setOrders]         = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [syncLogs, setSyncLogs]     = useState([]);

  // 初始化：載入門市 map
  useEffect(() => {
    personnelApi.getDepartments().then((res) => {
      const map = {};
      for (const d of (res.data || [])) {
        if (d.store_erpid) map[d.store_erpid] = d.store_name;
      }
      setStoreMap(map);
    }).catch(() => {});
  }, []);

  // 載入彙總
  const loadSummary = useCallback(async (m) => {
    setLoading(true);
    setMessage(null);
    setSelectedStore(null);
    setOrders([]);
    try {
      const res = await billingApi.getSummary(m);
      setSummary(res.data || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || '載入彙總失敗' });
      setSummary([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 載入最近同步記錄
  const loadSyncLogs = useCallback(async () => {
    try {
      const res = await billingApi.getSyncLogs(5);
      setSyncLogs(res.data || []);
    } catch (_) {}
  }, []);

  useEffect(() => { loadSummary(month); }, [month, loadSummary]);
  useEffect(() => { loadSyncLogs(); }, [loadSyncLogs]);

  // 點擊門市展開明細
  async function handleStoreClick(storeErpid) {
    if (selectedStore?.store_erpid === storeErpid) {
      setSelectedStore(null);
      setOrders([]);
      return;
    }
    setSelectedStore({ store_erpid: storeErpid, store_name: storeMap[storeErpid] || storeErpid });
    setOrdersLoading(true);
    try {
      const res = await billingApi.getOrders(month, storeErpid);
      setOrders(res.data || []);
    } catch (err) {
      setMessage({ type: 'error', text: `載入明細失敗：${err.message}` });
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }

  // 手動同步
  async function handleSync(targetMonth) {
    setSyncing(true);
    setMessage(null);
    try {
      await billingApi.sync(targetMonth || null);
      setMessage({ type: 'success', text: targetMonth ? `月份 ${targetMonth} 同步已啟動，約 10 秒後重新整理可見最新資料` : '增量同步已啟動' });
      // 稍後重新載入
      setTimeout(() => { loadSummary(month); loadSyncLogs(); }, 5000);
    } catch (err) {
      setMessage({ type: 'error', text: `同步失敗：${err.message}` });
    } finally {
      setSyncing(false);
    }
  }

  // 計算合計列
  const totals = summary.reduce((acc, s) => ({
    mc: acc.mc + s.maintenance_count,
    ma: acc.ma + s.maintenance_amount,
    rc: acc.rc + s.repair_count,
    ra: acc.ra + s.repair_amount,
    tc: acc.tc + s.total_count,
    ta: acc.ta + s.total_amount,
  }), { mc: 0, ma: 0, rc: 0, ra: 0, tc: 0, ta: 0 });

  const lastSync = syncLogs[0];

  return (
    <div style={S.page}>
      {/* 頁首 */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>開帳系統</h1>
          {lastSync && (
            <div style={S.syncInfo}>
              上次同步：{formatDateTime(lastSync.synced_at)}
              （{lastSync.status === 'success' ? `更新 ${lastSync.orders_synced} 筆` : '失敗'}）
            </div>
          )}
        </div>
        <div style={S.toolbar}>
          {/* 月份選擇 */}
          <select
            style={S.select}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* 同步當月 */}
          <button
            style={S.btnPrimary}
            onClick={() => handleSync(month)}
            disabled={syncing}
          >
            {syncing ? '同步中...' : `同步 ${month}`}
          </button>

          {/* 增量同步 */}
          <button
            style={S.btnSecondary}
            onClick={() => handleSync(null)}
            disabled={syncing}
          >
            增量同步
          </button>

          {/* 匯出彙總 CSV */}
          {summary.length > 0 && (
            <button
              style={S.btnSecondary}
              onClick={() => exportSummaryCSV(summary, storeMap, month)}
            >
              匯出彙總 CSV
            </button>
          )}
        </div>
      </div>

      {/* 訊息提示 */}
      {message && (
        <div style={S.alert(message.type)}>{message.text}</div>
      )}

      {/* ── 彙總表 ── */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <strong style={{ fontSize: '16px' }}>{month} 各門市帳單彙總</strong>
          <span style={{ fontSize: '13px', color: '#718096' }}>點擊門市列可展開明細</span>
        </div>

        {loading ? (
          <div style={S.spinner}>載入中...</div>
        ) : summary.length === 0 ? (
          <div style={S.empty}>本月尚無帳單資料，請先執行同步</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>門市</th>
                <th style={S.thR}>養護筆數</th>
                <th style={S.thR}>養護金額</th>
                <th style={S.thR}>報修筆數</th>
                <th style={S.thR}>報修金額</th>
                <th style={S.thR}>合計金額</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => {
                const isSelected = selectedStore?.store_erpid === s.store_erpid;
                return (
                  <tr
                    key={s.store_erpid}
                    style={{ ...S.rowHover, background: isSelected ? '#ebf8ff' : 'transparent' }}
                    onClick={() => handleStoreClick(s.store_erpid)}
                  >
                    <td style={S.td}>
                      <span style={{ fontWeight: '500' }}>
                        {storeMap[s.store_erpid] || s.store_erpid}
                      </span>
                      <span style={{ color: '#a0aec0', fontSize: '12px', marginLeft: '6px' }}>
                        {s.store_erpid}
                      </span>
                      {isSelected && <span style={{ marginLeft: '6px', color: '#3182ce' }}>▸</span>}
                    </td>
                    <td style={S.tdR}>{s.maintenance_count} 筆</td>
                    <td style={S.tdR}>$ {formatAmount(s.maintenance_amount)}</td>
                    <td style={S.tdR}>{s.repair_count} 筆</td>
                    <td style={S.tdR}>$ {formatAmount(s.repair_amount)}</td>
                    <td style={{ ...S.tdR, fontWeight: '600' }}>$ {formatAmount(s.total_amount)}</td>
                  </tr>
                );
              })}
              {/* 合計列 */}
              <tr>
                <td style={{ ...S.tdTotal, color: '#4a5568' }}>合計</td>
                <td style={S.tdTotalR}>{totals.mc} 筆</td>
                <td style={S.tdTotalR}>$ {formatAmount(totals.ma)}</td>
                <td style={S.tdTotalR}>{totals.rc} 筆</td>
                <td style={S.tdTotalR}>$ {formatAmount(totals.ra)}</td>
                <td style={{ ...S.tdTotalR, color: '#2b6cb0' }}>$ {formatAmount(totals.ta)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* ── 明細面板 ── */}
      {selectedStore && (
        <div style={S.card}>
          <div style={S.detailHeader}>
            <div>
              <strong style={{ fontSize: '16px' }}>
                {selectedStore.store_name} 明細（{month}）
              </strong>
              <span style={{ fontSize: '13px', color: '#718096', marginLeft: '8px' }}>
                {orders.length} 筆
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {orders.length > 0 && (
                <button
                  style={S.btnSecondary}
                  onClick={() => exportOrdersCSV(orders, storeMap, month, selectedStore.store_erpid)}
                >
                  匯出明細 CSV
                </button>
              )}
              <button
                style={S.backBtn}
                onClick={() => { setSelectedStore(null); setOrders([]); }}
              >
                ✕ 關閉
              </button>
            </div>
          </div>

          {ordersLoading ? (
            <div style={S.spinner}>載入中...</div>
          ) : orders.length === 0 ? (
            <div style={S.empty}>本月此門市無帳單明細</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>訂單 ID</th>
                  <th style={S.th}>類型</th>
                  <th style={S.thR}>金額</th>
                  <th style={S.th}>簽收時間</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '13px', color: '#4a5568' }}>
                      {o.order_id}
                    </td>
                    <td style={S.td}>
                      <span style={S.badge(o.source_type)}>
                        {o.source_type === 'maintenance' ? '養護' : '報修'}
                      </span>
                    </td>
                    <td style={S.tdR}>$ {formatAmount(o.amount)}</td>
                    <td style={S.td}>{formatDateTime(o.signed_at)}</td>
                  </tr>
                ))}
                {/* 明細合計 */}
                <tr>
                  <td colSpan={2} style={{ ...S.tdTotal, color: '#4a5568' }}>合計</td>
                  <td style={S.tdTotalR}>
                    $ {formatAmount(orders.reduce((s, o) => s + Number(o.amount), 0))}
                  </td>
                  <td style={S.tdTotal}></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
