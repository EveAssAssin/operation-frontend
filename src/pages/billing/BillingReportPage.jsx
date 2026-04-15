// pages/billing/BillingReportPage.jsx
// 帳單月報：按月份查看各門市的帳單彙總（跨所有來源單位）

import { useState, useEffect, useCallback } from 'react';
import { billingV2Api } from '../../services/api';

// ── 常數 ────────────────────────────────────────────────────
const SOURCE_TYPE_LABEL = {
  admin_dept:  '行政部門',
  vendor:      '廠商',
  operational: '營運費用',
};
const SOURCE_TYPE_COLOR = {
  admin_dept:  { bg: '#f5f0ea', text: '#50422d', border: '#cdbea2' },
  vendor:      { bg: '#f0fff4', text: '#276749', border: '#c6f6d5' },
  operational: { bg: '#fffaf0', text: '#7b341e', border: '#feebc8' },
};

// ── 工具函式 ─────────────────────────────────────────────────
function fmtAmt(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency', currency: 'TWD', maximumFractionDigits: 0,
  }).format(n);
}

function getPrevMonths(count = 12) {
  const months = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
    d.setMonth(d.getMonth() - 1);
  }
  return months;
}

// ── 主元件 ──────────────────────────────────────────────────
export default function BillingReportPage() {
  const defaultPeriod = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const [period,    setPeriod]    = useState(defaultPeriod);
  const [data,      setData]      = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [expanded,  setExpanded]  = useState({});   // store_erpid → bool

  const months = getPrevMonths(24);

  const load = useCallback(async (p) => {
    setLoading(true);
    setError('');
    try {
      const res = await billingV2Api.getReport(p);
      setData(res.data || []);
    } catch (e) {
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  function toggleExpand(erpid) {
    setExpanded(prev => ({ ...prev, [erpid]: !prev[erpid] }));
  }

  // ── 統計 ──────────────────────────────────────────────────
  const totalAmt   = data.reduce((s, r) => s + r.total, 0);
  const adminAmt   = data.reduce((s, r) => s + r.admin_dept, 0);
  const vendorAmt  = data.reduce((s, r) => s + r.vendor, 0);
  const opAmt      = data.reduce((s, r) => s + r.operational, 0);

  return (
    <div style={styles.page}>
      {/* ── 頁頭 ── */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📊 帳單月報</h1>
          <p style={styles.subtitle}>各門市當月應分攤費用彙總（已確認 + 已分配帳單）</p>
        </div>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          style={styles.monthSelect}
        >
          {months.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* ── 統計卡片 ── */}
      <div style={styles.statsRow}>
        <StatCard label="門市數" value={data.length} unit="間" color="#50422d" />
        <StatCard label="合計費用" value={fmtAmt(totalAmt)} color="#2d3748" large />
        <StatCard label="行政部門" value={fmtAmt(adminAmt)} color="#50422d" />
        <StatCard label="廠商" value={fmtAmt(vendorAmt)} color="#276749" />
        <StatCard label="營運費用" value={fmtAmt(opAmt)} color="#7b341e" />
      </div>

      {/* ── 主表格 ── */}
      {error && <div style={styles.error}>{error}</div>}
      {loading ? (
        <div style={styles.loading}>載入中...</div>
      ) : data.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
          <div style={{ fontSize: '16px', color: '#718096' }}>{period} 尚無已確認帳單</div>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={{ ...styles.th, width: '36px' }}></th>
                <th style={styles.th}>門市名稱</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>行政部門</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>廠商</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>營運費用</th>
                <th style={{ ...styles.th, textAlign: 'right', fontWeight: '700' }}>合計</th>
              </tr>
            </thead>
            <tbody>
              {data.map(store => (
                <>
                  <tr
                    key={store.store_erpid}
                    style={{
                      ...styles.tr,
                      background: expanded[store.store_erpid] ? '#f7fafc' : '#fff',
                      cursor: store.bills?.length ? 'pointer' : 'default',
                    }}
                    onClick={() => store.bills?.length && toggleExpand(store.store_erpid)}
                  >
                    <td style={{ ...styles.td, textAlign: 'center', color: '#a0aec0', fontSize: '11px' }}>
                      {store.bills?.length ? (expanded[store.store_erpid] ? '▲' : '▼') : ''}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.storeName}>{store.store_name}</span>
                      <span style={styles.storeErpid}> {store.store_erpid}</span>
                      {store.bills?.length > 0 && (
                        <span style={styles.billCount}>{store.bills.length} 筆</span>
                      )}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: store.admin_dept ? '#50422d' : '#cbd5e0' }}>
                      {store.admin_dept ? fmtAmt(store.admin_dept) : '—'}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: store.vendor ? '#276749' : '#cbd5e0' }}>
                      {store.vendor ? fmtAmt(store.vendor) : '—'}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: store.operational ? '#7b341e' : '#cbd5e0' }}>
                      {store.operational ? fmtAmt(store.operational) : '—'}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: '700', color: '#1a202c' }}>
                      {fmtAmt(store.total)}
                    </td>
                  </tr>
                  {/* 展開明細 */}
                  {expanded[store.store_erpid] && store.bills?.map(bill => (
                    <tr key={bill.bill_id} style={styles.detailRow}>
                      <td></td>
                      <td style={styles.detailTd} colSpan={4}>
                        <span style={{
                          ...styles.sourceTag,
                          background: SOURCE_TYPE_COLOR[bill.source_type]?.bg || '#f7fafc',
                          color:      SOURCE_TYPE_COLOR[bill.source_type]?.text || '#4a5568',
                          border:     `1px solid ${SOURCE_TYPE_COLOR[bill.source_type]?.border || '#e2e8f0'}`,
                        }}>
                          {SOURCE_TYPE_LABEL[bill.source_type] || bill.source_type}
                        </span>
                        <span style={styles.detailSourceName}>{bill.source_name}</span>
                        <span style={styles.detailTitle}>{bill.title}</span>
                        <span style={styles.detailBillNo}>{bill.bill_no}</span>
                      </td>
                      <td style={{ ...styles.detailTd, textAlign: 'right', fontWeight: '600', color: '#4a5568' }}>
                        {fmtAmt(bill.amount)}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
            {/* 頁腳合計 */}
            <tfoot>
              <tr style={styles.tfootRow}>
                <td></td>
                <td style={{ ...styles.tfoot, fontWeight: '700' }}>合計 {data.length} 間門市</td>
                <td style={{ ...styles.tfoot, textAlign: 'right', color: '#50422d' }}>{fmtAmt(adminAmt)}</td>
                <td style={{ ...styles.tfoot, textAlign: 'right', color: '#276749' }}>{fmtAmt(vendorAmt)}</td>
                <td style={{ ...styles.tfoot, textAlign: 'right', color: '#7b341e' }}>{fmtAmt(opAmt)}</td>
                <td style={{ ...styles.tfoot, textAlign: 'right', fontWeight: '800', color: '#1a202c', fontSize: '15px' }}>
                  {fmtAmt(totalAmt)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 統計卡片 ─────────────────────────────────────────────────
function StatCard({ label, value, unit, color, large }) {
  return (
    <div style={{ ...styles.statCard, borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: large ? '22px' : '18px', fontWeight: '700', color }}>
        {value}{unit && <span style={{ fontSize: '13px', marginLeft: '3px', color: '#718096' }}>{unit}</span>}
      </div>
    </div>
  );
}

// ── 樣式 ─────────────────────────────────────────────────────
const styles = {
  page: {
    padding:    '28px 32px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth:   '1200px',
  },
  header: {
    display:        'flex',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   '20px',
    gap:            '16px',
    flexWrap:       'wrap',
  },
  title: {
    fontSize:   '22px',
    fontWeight: '700',
    color:      '#1a202c',
    margin:     0,
  },
  subtitle: {
    fontSize:   '13px',
    color:      '#718096',
    margin:     '4px 0 0',
  },
  monthSelect: {
    padding:      '8px 12px',
    border:       '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize:     '15px',
    color:        '#2d3748',
    background:   '#fff',
    cursor:       'pointer',
    fontWeight:   '600',
  },
  statsRow: {
    display:       'flex',
    gap:           '12px',
    marginBottom:  '20px',
    flexWrap:      'wrap',
  },
  statCard: {
    flex:          '1',
    minWidth:      '120px',
    background:    '#fff',
    borderRadius:  '10px',
    padding:       '14px 18px',
    boxShadow:     '0 1px 3px rgba(0,0,0,0.08)',
  },
  tableWrap: {
    background:    '#fff',
    borderRadius:  '12px',
    boxShadow:     '0 1px 4px rgba(0,0,0,0.08)',
    overflow:      'hidden',
  },
  table: {
    width:           '100%',
    borderCollapse: 'collapse',
  },
  thead: {
    background: '#f7fafc',
  },
  th: {
    padding:       '12px 16px',
    textAlign:     'left',
    fontSize:      '12px',
    fontWeight:    '600',
    color:         '#718096',
    borderBottom:  '2px solid #e2e8f0',
    whiteSpace:    'nowrap',
  },
  tr: {
    borderBottom: '1px solid #f0f4f8',
    transition:   'background 0.1s',
  },
  td: {
    padding:    '12px 16px',
    fontSize:   '14px',
    color:      '#2d3748',
    verticalAlign: 'middle',
  },
  storeName: {
    fontWeight: '600',
    color:      '#1a202c',
  },
  storeErpid: {
    fontSize:   '12px',
    color:      '#a0aec0',
    marginLeft: '6px',
  },
  billCount: {
    marginLeft:   '8px',
    fontSize:     '11px',
    background:   '#edf2f7',
    color:        '#4a5568',
    padding:      '2px 7px',
    borderRadius: '99px',
    fontWeight:   '600',
  },
  detailRow: {
    background:   '#fafbfc',
    borderBottom: '1px solid #f0f4f8',
  },
  detailTd: {
    padding:    '8px 16px',
    fontSize:   '13px',
    color:      '#4a5568',
  },
  sourceTag: {
    display:       'inline-block',
    fontSize:      '11px',
    fontWeight:    '600',
    padding:       '2px 8px',
    borderRadius:  '99px',
    marginRight:   '8px',
  },
  detailSourceName: {
    fontWeight:  '600',
    color:       '#2d3748',
    marginRight: '6px',
  },
  detailTitle: {
    color:       '#4a5568',
    marginRight: '8px',
  },
  detailBillNo: {
    fontSize:   '12px',
    color:      '#a0aec0',
    fontFamily: 'monospace',
  },
  tfootRow: {
    background:   '#f7fafc',
    borderTop:    '2px solid #e2e8f0',
  },
  tfoot: {
    padding:    '12px 16px',
    fontSize:   '13px',
    color:      '#4a5568',
  },
  loading: {
    padding:    '48px',
    textAlign:  'center',
    color:      '#718096',
    fontSize:   '15px',
  },
  empty: {
    padding:    '64px',
    textAlign:  'center',
  },
  error: {
    background:   '#fff5f5',
    color:        '#c53030',
    border:       '1px solid #fed7d7',
    borderRadius: '8px',
    padding:      '12px 16px',
    marginBottom: '16px',
    fontSize:     '14px',
  },
};
