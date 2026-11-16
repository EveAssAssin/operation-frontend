// pages/liveReport/LiveReportSettingsPage.jsx —— 即時月報設定（2026-11-17 Louis；後端 routes/liveReport.js）
// 店長工具「即時月報」每天 03:30 算到昨天。這裡給營運部：
//   ① 參數：隱眼／護理成本＝賣價 × 比例（預設 65%）、代工費＋運費（每張鏡片單）、晚到帳單用幾個月平均
//   ② 鏡片成本表：ERP 商品（bind_id）→ 單片成本；最近賣出但沒有成本的品項排最前面（補上後下一次更新就會算進去）
//   ③ 校正：關帳後「預估 vs 實際」，下個月的估法乘上最近 3 個月的係數
//   ④ 手動重算、看各店最新一天
import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

const S = {
  card: { background: '#fff', border: '1px solid #e5dccd', borderRadius: 10, padding: 14, marginBottom: 14 },
  h: { fontWeight: 700, color: '#50422d', marginBottom: 8 },
  inp: { border: '1px solid #d6cbb8', borderRadius: 6, padding: '5px 8px', fontSize: 13, width: 90 },
  btn: (bg = '#50422d', fg = '#fff') => ({ background: bg, color: fg, border: '1px solid #d6cbb8', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }),
  th: { textAlign: 'left', padding: '6px', background: '#f5f0ea', fontSize: 12, color: '#6b5640' },
  td: { padding: '5px 6px', fontSize: 13, borderBottom: '1px solid #f0ebe3' },
};
const money = (n) => (n == null ? '—' : Math.round(n).toLocaleString());

export default function LiveReportSettingsPage() {
  const [set, setSet] = useState(null);
  const [lens, setLens] = useState(null);
  const [cal, setCal] = useState(null);
  const [st, setSt] = useState(null);
  const [q, setQ] = useState('');
  const [only, setOnly] = useState('todo');
  const [edit, setEdit] = useState({});
  const [msg, setMsg] = useState('');
  const loadAll = () => {
    api.get('/live-report/settings').then((r) => setSet(r.data)).catch((e) => setMsg(e.message));
    api.get('/live-report/lens-costs').then((r) => setLens(r.data)).catch((e) => setMsg(e.message));
    api.get('/live-report/calibration').then((r) => setCal(r.data)).catch(() => {});
    api.get('/live-report/status').then((r) => setSt(r.data)).catch(() => {});
  };
  useEffect(loadAll, []);
  const saveSet = async () => { try { const r = await api.put('/live-report/settings', set); setSet(r.data); setMsg('✅ 參數已存，下一次更新生效'); } catch (e) { setMsg(e.message); } };
  const saveCost = async (row) => {
    const v = edit[row.bind_id ?? row.bind];
    try {
      await api.put(`/live-report/lens-costs/${row.bind_id ?? row.bind}`, { cost: v, ...(row.bind_id ? {} : { name: row.name }) });
      setEdit((x) => { const n = { ...x }; delete n[row.bind_id ?? row.bind]; return n; });
      api.get('/live-report/lens-costs').then((r) => setLens(r.data));
    } catch (e) { alert(e.message); }
  };
  const run = async () => { try { const r = await api.post('/live-report/run', {}); setMsg(r.data.running ? '正在算了，等幾分鐘' : '✅ 開始重算（全部門市約 5～15 分鐘），完成後店長工具就會看到新的'); } catch (e) { setMsg(e.message); } };
  const rows = useMemo(() => {
    if (!lens) return [];
    const known = new Set(lens.rows.map((r) => String(r.bind_id)));
    const extra = (lens.unknown || []).filter((u) => u.bind && !known.has(String(u.bind))).map((u) => ({ bind: u.bind, name: u.name, cost: null, sold_no_cost: u.n, isNew: true }));
    let list = [...extra, ...lens.rows];
    if (only === 'todo') list = list.filter((r) => r.cost == null);
    if (q) list = list.filter((r) => `${r.name || ''} ${r.brand || ''} ${r.catena || ''} ${r.bind_id || r.bind}`.includes(q));
    return list.sort((a, b) => (b.sold_no_cost || 0) - (a.sold_no_cost || 0));
  }, [lens, q, only]);
  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <h2 style={{ color: '#50422d', marginTop: 0 }}>📊 即時月報設定</h2>
      <div style={{ fontSize: 13, color: '#6b5640', marginBottom: 12 }}>店長工具的「即時月報」每天 03:30 自動算到昨天：已經有帳的用實際、會隨銷售變動的成本用訂單反推（估）、帳單還沒來的用最近幾個月平均（預測）。</div>
      {msg && <div style={{ ...S.card, background: '#fffbeb' }}>{msg}</div>}
      <div style={S.card}>
        <div style={S.h}>① 參數</div>
        {set && <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
          <label>隱眼／護理成本＝賣價 × <input style={S.inp} value={set.contact_ratio} onChange={(e) => setSet({ ...set, contact_ratio: e.target.value })} /></label>
          <label>代工費（每張鏡片單）<input style={S.inp} value={set.lab_fee} onChange={(e) => setSet({ ...set, lab_fee: e.target.value })} /></label>
          <label>＋運費 <input style={S.inp} value={set.ship_fee} onChange={(e) => setSet({ ...set, ship_fee: e.target.value })} /></label>
          <label>晚到帳單用最近 <input style={{ ...S.inp, width: 50 }} value={set.hist_months} onChange={(e) => setSet({ ...set, hist_months: e.target.value })} /> 個月平均</label>
          <button style={S.btn()} onClick={saveSet}>存參數</button>
        </div>}
        <div style={{ fontSize: 12, color: '#8a7a66', marginTop: 6 }}>鏡框成本＝型號第 4 段（A=1…I=9、J=0）；刷卡手續費、包裝、物流＝過去幾個月占實收的比例 × 本月實收。</div>
      </div>
      <div style={S.card}>
        <div style={{ ...S.h, display: 'flex', alignItems: 'center', gap: 10 }}>② 鏡片成本表（單片成本）
          <span style={{ fontSize: 12, color: '#8a7a66', fontWeight: 400 }}>{lens ? `${lens.rows.filter((r) => r.cost != null).length}／${lens.rows.length} 已填；最近賣出沒有成本 ${(lens.unknown || []).length} 項${lens.unknown_at ? `（${lens.unknown_at}）` : ''}` : ''}</span></div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select value={only} onChange={(e) => setOnly(e.target.value)} style={S.inp}><option value="todo">還沒填成本</option><option value="all">全部</option></select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋品名／品牌／編號" style={{ ...S.inp, width: 220 }} />
        </div>
        <div style={{ maxHeight: 460, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['ERP 編號', '品名', '品牌／系列', '本月賣出沒成本', '單片成本', ''].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => { const id = r.bind_id ?? r.bind; const v = edit[id] ?? (r.cost ?? ''); return (
                <tr key={id}>
                  <td style={S.td}>{id}{r.isNew && <span style={{ color: '#b45309', fontSize: 11 }}> 新</span>}</td>
                  <td style={S.td}>{r.name}</td>
                  <td style={S.td}>{[r.brand, r.catena].filter(Boolean).join('／')}</td>
                  <td style={{ ...S.td, color: r.sold_no_cost ? '#b91c1c' : '#999' }}>{r.sold_no_cost ? `${r.sold_no_cost} 片` : '—'}</td>
                  <td style={S.td}><input style={S.inp} value={v} onChange={(e) => setEdit((x) => ({ ...x, [id]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && saveCost(r)} /></td>
                  <td style={S.td}>{edit[id] !== undefined && <button style={S.btn()} onClick={() => saveCost(r)}>存</button>}</td>
                </tr>); })}
              {!rows.length && <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#999' }}>{lens ? '沒有資料' : '讀取中…'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.h}>③ 校正（關帳後 預估 vs 實際）</div>
        {cal && <div style={{ fontSize: 13, marginBottom: 6 }}>目前套用的係數：{Object.keys(cal.current).length ? Object.entries(cal.current).map(([k, v]) => `${k} ×${Math.round(v * 100) / 100}`).join('、') : '還沒有（第一個月關帳後才會有）'}</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['月份', '項目', '預估', '實際', '係數（實際÷預估）', '門市數'].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{(cal ? cal.rows : []).map((r) => <tr key={r.ym + r.key}><td style={S.td}>{r.ym}</td><td style={S.td}>{r.key}</td><td style={S.td}>{money(r.est)}</td><td style={S.td}>{money(r.actual)}</td><td style={{ ...S.td, color: Math.abs(1 - r.factor) > 0.2 ? '#b91c1c' : '#047857' }}>{r.factor}</td><td style={S.td}>{r.stores}</td></tr>)}</tbody>
        </table>
      </div>
      <div style={S.card}>
        <div style={{ ...S.h, display: 'flex', alignItems: 'center', gap: 10 }}>④ 各店最新一天 <button style={S.btn()} onClick={run}>{st && st.running ? '計算中…' : '立刻重算全部門市'}</button><button style={S.btn('#fff', '#50422d')} onClick={loadAll}>重新整理</button></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['門市', '資料到', '月底預估淨利', '估的占比'].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{(st ? st.latest : []).map((r) => <tr key={r.store_erpid + r.day}><td style={S.td}>{r.store_name || r.store_erpid}</td><td style={S.td}>{r.day}</td><td style={S.td}>{money(r.totals && r.totals.profit_proj)}</td><td style={S.td}>{r.totals ? `${r.totals.est_pct}%` : '—'}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
