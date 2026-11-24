// components/SplitBox.jsx —— 寄銷對帳單拆分（2026-11-24；會計審核廠商請款時看）
// 每店：廠商請款（匯給廠商）／中間商回饋／總部收入（暫列）／門市開帳（進月報）；店號對不到的在這裡選門市（存在廠商，下個月自動套用）
import { useEffect, useState } from 'react';
import { vendorPaymentApi } from '../services/api';

const money = (n) => (n == null ? '—' : Math.round(Number(n)).toLocaleString());
const th = { padding: '6px 8px', textAlign: 'left', fontSize: 12, background: '#f7fafc', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' };
const td = { padding: '5px 8px', fontSize: 13, borderBottom: '1px solid #edf2f7' };
const btn = (bg, fg = '#fff') => ({ border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: bg, color: fg });

export default function SplitBox({ requestId, split, canEdit, onChanged }) {
  const [targets, setTargets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => { vendorPaymentApi.targets().then((r) => setTargets(r.data || [])).catch(() => {}); }, []);
  const run = async (fn) => { setBusy(true); setErr(''); try { await fn(); onChanged && onChanged(); } catch (e) { setErr(e.message || '失敗'); } finally { setBusy(false); } };
  const resplit = () => run(() => vendorPaymentApi.split(requestId));
  const setStore = (code, store) => run(() => vendorPaymentApi.splitStore(requestId, code, store));
  const head = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <b style={{ fontSize: 14 }}>🧾 對帳單拆分</b>
      <span style={{ fontSize: 11, color: '#a0aec0' }}>廠商看不到這一塊</span>
      <div style={{ flex: 1 }} />
      {canEdit && <button style={btn('#edf2f7', '#4a5568')} disabled={busy} onClick={resplit}>{busy ? '處理中…' : '重新讀對帳單拆分'}</button>}
    </div>
  );
  if (!split || split.error) {
    return (
      <div style={{ border: '2px solid #f6e05e', borderRadius: 8, padding: 10, background: '#fffff0' }}>
        {head}
        <div style={{ color: '#c05621', fontSize: 13, marginTop: 6 }}>{split && split.error ? `⚠ 拆分失敗：${split.error}` : '還沒拆分（廠商送審時會自動拆；也可以按上面重新讀）'}</div>
        {err && <div style={{ color: '#c53030', fontSize: 12 }}>⚠ {err}</div>}
      </div>
    );
  }
  const t = split.totals || {};
  const cell = (label, v, color, note) => (
    <div style={{ flex: 1, minWidth: 130, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px' }}>
      <div style={{ fontSize: 12, color: '#718096' }}>{label}</div><div style={{ fontSize: 18, fontWeight: 700, color }}>{money(v)}</div>{note && <div style={{ fontSize: 11, color: '#a0aec0' }}>{note}</div>}
    </div>
  );
  return (
    <div style={{ border: '2px solid #f6e05e', borderRadius: 8, padding: 10, background: '#fffff0' }}>
      {head}
      <div style={{ fontSize: 12, color: '#718096', margin: '4px 0 8px' }}>
        {split.file ? `檔案：${split.file.name}・` : ''}{split.sheet ? `分頁「${split.sheet}」・` : ''}規則：{(split.rules || []).map((r) => `${r.match} → 門市 ${r.rate - r.intermediary - r.hq}%、中間商 ${r.intermediary}%、總部 ${r.hq}%`).join('；') || '（沒設）'}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {cell('廠商請款（匯給廠商）', t.payout, '#c05621')}
        {cell('中間商回饋（一起出款）', t.intermediary, '#2b6cb0')}
        {cell('總部收入（暫列）', t.hq, '#2f855a', '帳務系統完整後再入帳')}
        {cell('門市開帳（進月報）', t.store_cost, '#2d3748', '＝前三項合計')}
      </div>
      {(split.unmapped || []).length > 0 && (
        <div style={{ marginTop: 8, padding: 8, background: '#fff5f5', borderRadius: 6 }}>
          <b style={{ color: '#c53030', fontSize: 13 }}>⚠ {split.unmapped.length} 個店號對不到門市（選了會記住，下個月自動套用）</b>
          {split.unmapped.map((u) => (
            <div key={u.code} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, fontSize: 13 }}>
              <span style={{ minWidth: 220 }}>{u.code} {String(u.name || '').split('\n')[0]}</span>
              <select disabled={!canEdit || busy} defaultValue="" onChange={(e) => e.target.value && setStore(u.code, e.target.value)} style={{ padding: 4, borderRadius: 4, border: '1px solid #e2e8f0' }}>
                <option value="">選門市…</option>{targets.map((x) => <option key={x.store_erpid} value={x.store_erpid}>{x.store_name}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
      {(split.warnings || []).map((w, i) => <div key={i} style={{ color: '#c05621', fontSize: 12, marginTop: 4 }}>⚠ {w}</div>)}
      {err && <div style={{ color: '#c53030', fontSize: 12, marginTop: 4 }}>⚠ {err}</div>}
      <button style={{ ...btn('none', '#2b6cb0'), padding: '6px 0', marginTop: 6 }} onClick={() => setOpen(!open)}>{open ? '▲ 收起各店明細' : `▼ 看各店明細（${(split.rows || []).length} 店）`}</button>
      {open && (
        <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['店號', '廠商店名', '我們的門市', '銷售額', '廠商請款', '中間商', '總部', '門市開帳'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {(split.rows || []).map((r) => (
                <tr key={r.code} style={{ background: r.store_erpid ? undefined : '#fff5f5' }}>
                  <td style={td}>{r.code}</td><td style={td}>{String(r.name || '').split('\n')[0]}</td>
                  <td style={td}>
                    {canEdit ? (
                      <select value={r.store_erpid || ''} disabled={busy} onChange={(e) => setStore(r.code, e.target.value)} style={{ padding: 2, fontSize: 12, borderRadius: 4, border: '1px solid #e2e8f0', maxWidth: 140 }}>
                        <option value="">（沒對到）</option>{targets.map((x) => <option key={x.store_erpid} value={x.store_erpid}>{x.store_name}</option>)}
                      </select>
                    ) : (r.store_name || '—')}
                    {r.matched_by === 'auto' && <span style={{ fontSize: 10, color: '#a0aec0' }}> 自動</span>}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>{money(r.sales)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{money(r.payout)}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#2b6cb0' }}>{money(r.intermediary)}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#2f855a' }}>{money(r.hq)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{money(r.store_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
