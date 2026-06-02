// pages/billing/BillingAdPage.jsx
// 企劃部廣告費（部門開帳 → 企劃開帳）
//   - 選月份 → 列出該月企劃部廣告費同步進來的 billing_orders
//   - 「📣 同步」按鈕

import { useState, useEffect, useCallback } from 'react';
import { billingApi } from '../../services/api';

const C = {
  dark: '#50422d', mid: '#8b6f4e', light: '#cdbea2',
  bg: '#f5f0ea', bgCard: '#ffffff', border: '#e0d5c8',
  textDark: '#3a2e1e', textMid: '#6b5640', textLight: '#9a8878',
};

const btn = (variant = 'default') => {
  const base = { padding: '8px 14px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
  if (variant === 'primary') return { ...base, background: C.dark, color: '#fff' };
  if (variant === 'accent')  return { ...base, background: '#805ad5', color: '#fff' };
  if (variant === 'ghost')   return { ...base, background: '#fff', color: C.textDark, border: `1px solid ${C.border}` };
  return { ...base, background: C.mid, color: '#fff' };
};

const fmtMoney = v => v == null ? '—' : `NT$ ${Number(v).toLocaleString()}`;
const fmtDateTime = s => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' });
};

export default function BillingAdPage() {
  const today = new Date();
  const defMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth]     = useState(defMonth);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async (m) => {
    setLoading(true);
    try {
      const r = await billingApi.getAdOrders(m || month);
      setData(r);
    } catch (e) { console.error(e); setData(null); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(month); /* eslint-disable-next-line */ }, []);

  async function handleSync() {
    if (!window.confirm(`同步企劃部廣告費 ${month}？`)) return;
    setSyncing(true);
    try {
      const r = await billingApi.syncAdBudgetDebug(month);
      const samples = r?.samples || [];
      const sampleStr = samples.slice(0, 5).map(s =>
        `  ${s.order_id} / ${s.store_erpid} / ${s.billing_category || '-'} / NT$${(s.amount || 0).toLocaleString()}`
      ).join('\n');
      alert([
        `✅ 企劃部廣告費 ${month} 同步完成`,
        ``,
        `同步回應：${JSON.stringify(r?.sync_result || {})}`,
        `資料庫實際筆數：${r?.rows_in_db || 0}`,
        r?.fallback_count_in_samples > 0
          ? `⚠️ 前 5 筆 sample 中有 ${r.fallback_count_in_samples} 筆 store_erpid 是 fallback`
          : '',
        samples.length > 0 ? `Sample (前 ${samples.length} 筆)：\n${sampleStr}` : '無資料寫入',
        r?.count_err ? `❌ count 查詢錯誤：${r.count_err}` : '',
      ].filter(Boolean).join('\n'));
      load(month);
    } catch (e) {
      // 顯示完整錯誤資訊
      const r = e?.response;
      alert([
        '❌ 同步失敗',
        ``,
        `Status: ${r?.status || '無'}`,
        `Message: ${r?.data?.message || e?.message || '未知'}`,
        r?.data?.stack ? `\nStack:\n${(Array.isArray(r.data.stack) ? r.data.stack : [r.data.stack]).join('\n')}` : '',
        `\n如果是「未設定環境變數 AD_BUDGET_API_URL」→ 請去 Render 後台填這個環境變數`,
        `如果是「constraint」→ 014 SQL 沒跑（CHECK 限制只接受 maintenance/repair）`,
      ].filter(Boolean).join('\n'));
    } finally { setSyncing(false); }
  }

  async function handleEnvCheck() {
    try {
      const r = await billingApi.envCheck();
      alert('環境變數狀態:\n' + JSON.stringify(r?.data || r, null, 2));
    } catch (e) {
      const r = e?.response;
      alert(`Status ${r?.status}\n${r?.data?.message || e?.message}`);
    }
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: C.dark, padding: '20px 28px' }}>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>📣 企劃開帳</div>
        <div style={{ color: C.light, fontSize: 13, marginTop: 4 }}>
          企劃部廣告費同步進來的帳單，依月份分各門市分攤金額
        </div>
      </div>

      <div style={{ padding: '20px 28px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                 style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, background: '#fff' }} />
          <button onClick={() => load(month)} disabled={loading} style={btn('ghost')}>
            {loading ? '載入中…' : '🔍 查詢'}
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={handleEnvCheck} style={btn('ghost')} title="檢查後端環境變數">⚙ 檢查環境</button>
          <button onClick={handleSync} disabled={syncing} style={btn('accent')}>
            {syncing ? '同步中…' : '📥 同步本月廣告費'}
          </button>
        </div>

        {/* 摘要 */}
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <Stat label="月份" value={data.month} />
            <Stat label="總筆數" value={data.total_count || 0} />
            <Stat label="總金額" value={fmtMoney(data.total_amount)} highlight />
          </div>
        )}

        {/* 依門市分組顯示 */}
        {data?.stores?.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: C.textLight, background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}` }}>
            該月份尚無資料 — 試試按右上「📥 同步本月廣告費」
          </div>
        )}

        {(data?.stores || []).map(s => (
          <div key={s.store_erpid || '_none'} style={{
            background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 12, overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px', background: C.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.border}` }}>
              <div>
                <b style={{ fontSize: 14 }}>🏬 {s.store_name || s.store_erpid || '（未指定）'}</b>
                <span style={{ marginLeft: 8, fontSize: 11, color: C.textLight, fontFamily: 'monospace' }}>{s.store_erpid}</span>
                {s.store_erpid?.startsWith('ad-store-') && (
                  <span style={{ marginLeft: 8, padding: '2px 8px', fontSize: 10, background: '#fff0f0', color: '#c53030', border: '1px solid #feb2b2', borderRadius: 12 }}>
                    ⚠ fallback 未對應
                  </span>
                )}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>
                {s.orders.length} 筆 · {fmtMoney(s.total)}
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ background: '#fafaf7' }}>
                <tr>
                  <th style={th()}>order_id</th>
                  <th style={th()}>類別</th>
                  <th style={th()}>備註</th>
                  <th style={{ ...th(), textAlign: 'right' }}>金額</th>
                  <th style={th()}>建立</th>
                </tr>
              </thead>
              <tbody>
                {s.orders.map(o => (
                  <tr key={o.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={td()}><code style={{ fontSize: 11 }}>{o.order_id}</code></td>
                    <td style={td()}>{o.billing_category || '—'}</td>
                    <td style={td()}>{o.remark || '—'}</td>
                    <td style={{ ...td(), textAlign: 'right', fontWeight: 600 }}>{fmtMoney(o.amount)}</td>
                    <td style={td()}>{fmtDateTime(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div style={{
      padding: 14, background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}`, textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: C.textLight, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: highlight ? C.dark : C.textDark }}>{value}</div>
    </div>
  );
}

function th() { return { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.textDark, borderBottom: `1px solid ${C.border}` }; }
function td() { return { padding: '8px 12px', fontSize: 13, color: C.textDark, verticalAlign: 'top' }; }
