// pages/billing/BillingPage.jsx
// 開帳系統：按月查看各門市養護/報修費用彙總、明細（含項目展開）、手動同步、匯出 CSV

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

function exportSummaryCSV(summary, storeMap, month) {
  const headers = ['門市代號', '門市名稱', '部門分類', '養護筆數', '養護金額', '報修筆數', '報修金額', '合計筆數', '合計金額'];
  const rows = summary.map((s) => [
    s.store_erpid,
    storeMap[s.store_erpid] || s.store_erpid,
    s.billing_category || '-',
    s.maintenance_count,
    s.maintenance_amount,
    s.repair_count,
    s.repair_amount,
    s.total_count,
    s.total_amount,
  ]);
  const totals = summary.reduce((acc, s) => ({
    mc: acc.mc + s.maintenance_count, ma: acc.ma + s.maintenance_amount,
    rc: acc.rc + s.repair_count,      ra: acc.ra + s.repair_amount,
    tc: acc.tc + s.total_count,       ta: acc.ta + s.total_amount,
  }), { mc: 0, ma: 0, rc: 0, ra: 0, tc: 0, ta: 0 });
  rows.push(['', '合計', '', totals.mc, totals.ma, totals.rc, totals.ra, totals.tc, totals.ta]);

  const csv  = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const bom  = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `開帳彙總_${month}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function exportOrdersCSV(orders, storeMap, month, storeErpid) {
  const headers = ['訂單ID', '類型', '部門', '門市代號', '門市名稱', '金額', '簽收時間', '備註'];
  const rows = orders.map((o) => [
    o.order_id,
    o.source_type === 'maintenance' ? '養護' : '報修',
    o.billing_category || '-',
    o.store_erpid,
    storeMap[o.store_erpid] || o.store_erpid,
    o.amount,
    formatDateTime(o.signed_at),
    (o.remark || '').replace(/,/g, '，'),
  ]);
  const csv  = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const bom  = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `開帳明細_${month}${storeErpid ? `_${storeErpid}` : ''}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ─── 樣式常數 ────────────────────────────────────────────────
const S = {
  page:         { padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#1a202c' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
  title:        { fontSize: '20px', fontWeight: '700', margin: 0 },
  toolbar:      { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  select:       { padding: '6px 12px', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '14px', background: '#fff', cursor: 'pointer' },
  btnPrimary:   { padding: '7px 16px', background: '#3182ce', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
  btnSecondary: { padding: '7px 16px', background: '#fff', color: '#4a5568', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' },
  btnSmall:     { padding: '4px 10px', background: '#fff', color: '#3182ce', border: '1px solid #bee3f8', borderRadius: '5px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' },
  card:         { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', marginBottom: '20px' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th:           { background: '#f7fafc', padding: '10px 14px', textAlign: 'left',  borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#4a5568', whiteSpace: 'nowrap' },
  thR:          { background: '#f7fafc', padding: '10px 14px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#4a5568', whiteSpace: 'nowrap' },
  td:           { padding: '10px 14px', borderBottom: '1px solid #edf2f7', verticalAlign: 'middle' },
  tdR:          { padding: '10px 14px', borderBottom: '1px solid #edf2f7', textAlign: 'right', verticalAlign: 'middle' },
  tdTotal:      { padding: '10px 14px', borderTop: '2px solid #e2e8f0', fontWeight: '700', background: '#f7fafc' },
  tdTotalR:     { padding: '10px 14px', borderTop: '2px solid #e2e8f0', fontWeight: '700', background: '#f7fafc', textAlign: 'right' },
  rowHover:     { cursor: 'pointer' },
  badge: (type) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: '500',
    background: type === 'maintenance' ? '#ebf8ff' : '#fff5f5',
    color:      type === 'maintenance' ? '#2b6cb0' : '#c53030',
  }),
  categoryBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: '500', background: '#f0fff4', color: '#276749', border: '1px solid #9ae6b4' },
  empty:        { textAlign: 'center', color: '#a0aec0', padding: '48px 0' },
  spinner:      { textAlign: 'center', color: '#a0aec0', padding: '48px 0' },
  alert: (type) => ({
    padding: '10px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px',
    background: type === 'error' ? '#fff5f5' : '#f0fff4',
    color:      type === 'error' ? '#c53030' : '#276749',
    border:     `1px solid ${type === 'error' ? '#feb2b2' : '#9ae6b4'}`,
  }),
  detailHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' },
  backBtn:      { background: 'none', border: 'none', cursor: 'pointer', color: '#718096', fontSize: '14px', padding: '0', display: 'flex', alignItems: 'center', gap: '4px' },
  syncInfo:     { fontSize: '12px', color: '#718096', marginTop: '6px' },
  // 項目展開子表
  subTable:     { width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: '0' },
  subTh:        { background: '#f0f4f8', padding: '7px 12px', textAlign: 'left',  borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' },
  subThR:       { background: '#f0f4f8', padding: '7px 12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' },
  subTd:        { padding: '7px 12px', borderBottom: '1px solid #edf2f7', color: '#4a5568' },
  subTdR:       { padding: '7px 12px', borderBottom: '1px solid #edf2f7', color: '#4a5568', textAlign: 'right' },
  // Modal
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal:        { background: '#fff', borderRadius: '12px', padding: '28px', width: '760px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader:  { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' },
  modalTitle:   { fontSize: '17px', fontWeight: '700', color: '#1a202c' },
  closeBtn:     { background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#718096', lineHeight: 1, padding: '0 0 0 16px' },
  photoGrid:    { display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px' },
  photo:        { width: '140px', height: '100px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer' },
  label:        { fontSize: '12px', fontWeight: '600', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', marginTop: '16px' },
  infoText:     { fontSize: '14px', color: '#2d3748', lineHeight: '1.6' },
};

// ─── 完整明細 Modal ──────────────────────────────────────────
function OrderDetailModal({ detail, onClose }) {
  if (!detail) return null;

  const items = detail.items || [];
  const photos = detail.photo_urls || detail.photos || [];
  const notes  = detail.completion_notes || detail.notes || detail.remark || '';

  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <div>
            <div style={S.modalTitle}>訂單完整明細</div>
            <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
              {detail.source_id || detail.order_id || '-'} ／ {detail.source_type === 'maintenance' ? '養護' : '報修'}
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* 項目清單 */}
        {items.length > 0 && (
          <>
            <div style={S.label}>項目明細</div>
            <table style={S.subTable}>
              <thead>
                <tr>
                  <th style={S.subTh}>項目名稱</th>
                  <th style={S.subTh}>規格／說明</th>
                  <th style={S.subThR}>數量</th>
                  <th style={S.subThR}>單價</th>
                  <th style={S.subThR}>小計</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={S.subTd}>{item.name || item.item_name || '-'}</td>
                    <td style={S.subTd}>{item.spec || item.description || '-'}</td>
                    <td style={S.subTdR}>{item.quantity ?? '-'}</td>
                    <td style={S.subTdR}>{item.unit_price != null ? `$ ${formatAmount(item.unit_price)}` : '-'}</td>
                    <td style={S.subTdR}>{item.subtotal != null ? `$ ${formatAmount(item.subtotal)}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* 完工備註 */}
        {notes && (
          <>
            <div style={S.label}>完工備註</div>
            <div style={S.infoText}>{notes}</div>
          </>
        )}

        {/* 照片 */}
        {photos.length > 0 && (
          <>
            <div style={S.label}>照片（{photos.length} 張）</div>
            <div style={S.photoGrid}>
              {photos.map((url, idx) => (
                <a key={idx} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`照片${idx + 1}`} style={S.photo} />
                </a>
              ))}
            </div>
          </>
        )}

        {items.length === 0 && !notes && photos.length === 0 && (
          <div style={S.empty}>此訂單尚無詳細資料</div>
        )}
      </div>
    </div>
  );
}

// ─── 主元件 ─────────────────────────────────────────────────

export default function BillingPage() {
  const months = recentMonths(13);
  const [month, setMonth]                   = useState(currentMonth());
  const [summary, setSummary]               = useState([]);
  const [storeMap, setStoreMap]             = useState({});
  const [loading, setLoading]               = useState(false);
  const [syncing, setSyncing]               = useState(false);
  const [message, setMessage]               = useState(null);
  const [selectedStore, setSelectedStore]   = useState(null);
  const [orders, setOrders]                 = useState([]);
  const [ordersLoading, setOrdersLoading]   = useState(false);
  const [syncLogs, setSyncLogs]             = useState([]);
  const [expandedOrderId, setExpandedOrderId] = useState(null); // 展開 items 的訂單
  const [detailModal, setDetailModal]       = useState(null);   // Method B 完整明細
  const [detailLoading, setDetailLoading]   = useState(null);   // 哪個訂單的 loading

  useEffect(() => {
    personnelApi.getDepartments().then((res) => {
      const map = {};
      for (const d of (res.data || [])) {
        if (d.store_erpid) map[d.store_erpid] = d.store_name;
      }
      setStoreMap(map);
    }).catch(() => {});
  }, []);

  const loadSummary = useCallback(async (m) => {
    setLoading(true);
    setMessage(null);
    setSelectedStore(null);
    setOrders([]);
    setExpandedOrderId(null);
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

  const loadSyncLogs = useCallback(async () => {
    try {
      const res = await billingApi.getSyncLogs(5);
      setSyncLogs(res.data || []);
    } catch (_) {}
  }, []);

  useEffect(() => { loadSummary(month); }, [month, loadSummary]);
  useEffect(() => { loadSyncLogs(); }, [loadSyncLogs]);

  async function handleStoreClick(storeErpid) {
    if (selectedStore?.store_erpid === storeErpid) {
      setSelectedStore(null);
      setOrders([]);
      setExpandedOrderId(null);
      return;
    }
    setSelectedStore({ store_erpid: storeErpid, store_name: storeMap[storeErpid] || storeErpid });
    setExpandedOrderId(null);
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

  async function handleSync(targetMonth) {
    setSyncing(true);
    setMessage(null);
    try {
      await billingApi.sync(targetMonth || null);
      setMessage({ type: 'success', text: targetMonth ? `月份 ${targetMonth} 同步已啟動，約 10 秒後重新整理可見最新資料` : '增量同步已啟動' });
      setTimeout(() => { loadSummary(month); loadSyncLogs(); }, 5000);
    } catch (err) {
      setMessage({ type: 'error', text: `同步失敗：${err.message}` });
    } finally {
      setSyncing(false);
    }
  }

  // 展開 / 收合訂單的 items（已在 DB，不需打 API）
  function toggleOrderItems(orderId) {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  }

  // 呼叫 Method B 取完整明細（含照片）
  async function handleViewFullDetail(order) {
    setDetailLoading(order.order_id);
    try {
      const res = await billingApi.getOrderDetail(order.source_type, order.order_id);
      setDetailModal(res.data || res);
    } catch (err) {
      setMessage({ type: 'error', text: `取得完整明細失敗：${err.message}` });
    } finally {
      setDetailLoading(null);
    }
  }

  const totals = summary.reduce((acc, s) => ({
    mc: acc.mc + s.maintenance_count, ma: acc.ma + s.maintenance_amount,
    rc: acc.rc + s.repair_count,      ra: acc.ra + s.repair_amount,
    tc: acc.tc + s.total_count,       ta: acc.ta + s.total_amount,
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
          <select style={S.select} value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button style={S.btnPrimary} onClick={() => handleSync(month)} disabled={syncing}>
            {syncing ? '同步中...' : `同步 ${month}`}
          </button>
          <button style={S.btnSecondary} onClick={() => handleSync(null)} disabled={syncing}>
            增量同步
          </button>
          {summary.length > 0 && (
            <button style={S.btnSecondary} onClick={() => exportSummaryCSV(summary, storeMap, month)}>
              匯出彙總 CSV
            </button>
          )}
        </div>
      </div>

      {message && <div style={S.alert(message.type)}>{message.text}</div>}

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
                <th style={S.th}>部門分類</th>
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
                      <span style={{ fontWeight: '500' }}>{storeMap[s.store_erpid] || s.store_erpid}</span>
                      <span style={{ color: '#a0aec0', fontSize: '12px', marginLeft: '6px' }}>{s.store_erpid}</span>
                      {isSelected && <span style={{ marginLeft: '6px', color: '#3182ce' }}>▸</span>}
                    </td>
                    <td style={S.td}>
                      {s.billing_category
                        ? <span style={S.categoryBadge}>{s.billing_category}</span>
                        : <span style={{ color: '#a0aec0', fontSize: '12px' }}>—</span>}
                    </td>
                    <td style={S.tdR}>{s.maintenance_count} 筆</td>
                    <td style={S.tdR}>$ {formatAmount(s.maintenance_amount)}</td>
                    <td style={S.tdR}>{s.repair_count} 筆</td>
                    <td style={S.tdR}>$ {formatAmount(s.repair_amount)}</td>
                    <td style={{ ...S.tdR, fontWeight: '600' }}>$ {formatAmount(s.total_amount)}</td>
                  </tr>
                );
              })}
              <tr>
                <td style={{ ...S.tdTotal, color: '#4a5568' }}>合計</td>
                <td style={S.tdTotal}></td>
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
                <button style={S.btnSecondary} onClick={() => exportOrdersCSV(orders, storeMap, month, selectedStore.store_erpid)}>
                  匯出明細 CSV
                </button>
              )}
              <button style={S.backBtn} onClick={() => { setSelectedStore(null); setOrders([]); setExpandedOrderId(null); }}>
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
                  <th style={S.th}>部門</th>
                  <th style={S.thR}>金額</th>
                  <th style={S.th}>簽收時間</th>
                  <th style={S.th}>備註</th>
                  <th style={S.th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const isExpanded = expandedOrderId === o.order_id;
                  const hasItems   = Array.isArray(o.items) && o.items.length > 0;
                  const isLoadingDetail = detailLoading === o.order_id;

                  return (
                    <>
                      <tr key={o.order_id} style={{ background: isExpanded ? '#f7fafc' : 'transparent' }}>
                        <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '12px', color: '#718096' }}>
                          {o.order_id?.slice(0, 8)}…
                        </td>
                        <td style={S.td}>
                          <span style={S.badge(o.source_type)}>
                            {o.source_type === 'maintenance' ? '養護' : '報修'}
                          </span>
                        </td>
                        <td style={S.td}>
                          {o.billing_category
                            ? <span style={S.categoryBadge}>{o.billing_category}</span>
                            : <span style={{ color: '#a0aec0', fontSize: '12px' }}>—</span>}
                        </td>
                        <td style={S.tdR}>$ {formatAmount(o.amount)}</td>
                        <td style={S.td}>{formatDateTime(o.signed_at)}</td>
                        <td style={{ ...S.td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', color: '#718096' }}>
                          {o.remark || '—'}
                        </td>
                        <td style={S.td}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {hasItems && (
                              <button
                                style={S.btnSmall}
                                onClick={() => toggleOrderItems(o.order_id)}
                              >
                                {isExpanded ? '▲ 收合' : `▼ 項目（${o.items.length}）`}
                              </button>
                            )}
                            <button
                              style={{ ...S.btnSmall, color: '#6b46c1', borderColor: '#e9d8fd' }}
                              onClick={() => handleViewFullDetail(o)}
                              disabled={isLoadingDetail}
                            >
                              {isLoadingDetail ? '讀取中...' : '完整明細'}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* 展開項目子列 */}
                      {isExpanded && hasItems && (
                        <tr key={`${o.order_id}-items`}>
                          <td colSpan={7} style={{ padding: '0 14px 12px 14px', background: '#f7fafc' }}>
                            <table style={S.subTable}>
                              <thead>
                                <tr>
                                  <th style={S.subTh}>項目名稱</th>
                                  <th style={S.subTh}>規格／說明</th>
                                  <th style={S.subThR}>數量</th>
                                  <th style={S.subThR}>單價</th>
                                  <th style={S.subThR}>小計</th>
                                </tr>
                              </thead>
                              <tbody>
                                {o.items.map((item, idx) => (
                                  <tr key={idx}>
                                    <td style={S.subTd}>{item.name || item.item_name || '-'}</td>
                                    <td style={S.subTd}>{item.spec || item.description || '-'}</td>
                                    <td style={S.subTdR}>{item.quantity ?? '-'}</td>
                                    <td style={S.subTdR}>{item.unit_price != null ? `$ ${formatAmount(item.unit_price)}` : '-'}</td>
                                    <td style={S.subTdR}>{item.subtotal != null ? `$ ${formatAmount(item.subtotal)}` : '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                <tr>
                  <td colSpan={3} style={{ ...S.tdTotal, color: '#4a5568' }}>合計</td>
                  <td style={S.tdTotalR}>$ {formatAmount(orders.reduce((s, o) => s + Number(o.amount), 0))}</td>
                  <td colSpan={3} style={S.tdTotal}></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Method B 完整明細 Modal ── */}
      {detailModal && (
        <OrderDetailModal detail={detailModal} onClose={() => setDetailModal(null)} />
      )}
    </div>
  );
}
