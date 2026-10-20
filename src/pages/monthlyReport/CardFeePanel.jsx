// 月報「💳 刷卡手續費費率」（2026-10-20）：每一種 ERP 付款方式設費率％＋每筆固定 → 月報自動算每家店刷卡手續費
// 清單＝已設定的＋這個月 ERP 有收款的付款方式（全公司金額／筆數當參考）；空白＝不設（月報會提醒），不收費的設 0
import { useState, useCallback } from 'react';
import { ledgerApi } from '../../services/api';
import HelpTip from '../../components/help/HelpTip';

const errMsg = (e) => (e && (e.message || e.error)) || '失敗';
export default function CardFeePanel({ ym }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setMsg('讀取 ERP 收款（全部門市，第一次約 30 秒）…');
    try { const r = await ledgerApi.cardFeeRates(ym); setRows((r.data || []).map((x) => ({ ...x, rate: x.rate ?? '', per_txn: x.per_txn ?? '' }))); setMsg(''); }
    catch (e) { setMsg(errMsg(e)); }
    setBusy(false);
  }, [ym]);
  const toggle = () => { const o = !open; setOpen(o); if (o && !rows) load(); };
  const set = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const save = async () => {
    setBusy(true);
    try { await ledgerApi.saveCardFeeRates(rows.map((r) => ({ code: r.code, name: r.name, rate: r.rate, per_txn: r.per_txn || 0 }))); setMsg('已存。重新整理月報就會照新費率算。'); }
    catch (e) { setMsg(errMsg(e)); }
    setBusy(false);
  };
  return (
    <div style={S.card} data-yaya="mr-cardfee">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <b>💳 刷卡手續費費率</b>
        <HelpTip title="刷卡手續費怎麼算" body={'每家店每月：ERP 收款依付款方式分開加總 × 該付款方式費率％＋筆數 × 每筆固定費用，加起來就是月報的「刷卡手續費」。\n費率空白＝沒設，月報和查帳提醒會列出來；現金這類不收費的請填 0。\n改了費率只影響還沒關帳的月份；已關帳的月報數字不會變。\n單一店要例外，直接在月報那一格「手填金額」蓋過。'} />
        <span style={S.sub}>{ym} 的 ERP 收款付款方式</span>
        <button style={S.link} onClick={toggle}>{open ? '收起' : '打開'}</button>
      </div>
      {open && <>
        {msg && <div style={{ fontSize: 13, color: '#2c5282', margin: '6px 0' }}>{msg}</div>}
        {rows && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 6 }}>
            <thead><tr>{['付款方式', '代碼', `${ym} 全公司金額／筆數`, '費率 %', '每筆固定（元）'].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.code} style={{ background: r.rate === '' && r.amount ? '#fff5f5' : undefined }}>
                <td style={S.td}><input style={{ ...S.input, width: 140 }} value={r.name} onChange={(e) => set(i, 'name', e.target.value)} /></td>
                <td style={S.td}>{r.code}</td>
                <td style={S.td}>{r.amount == null ? '—' : `${Math.round(r.amount).toLocaleString()}／${r.n}`}</td>
                <td style={S.td}><input style={{ ...S.input, width: 70 }} value={r.rate} placeholder="未設" onChange={(e) => set(i, 'rate', e.target.value)} /></td>
                <td style={S.td}><input style={{ ...S.input, width: 70 }} value={r.per_txn} placeholder="0" onChange={(e) => set(i, 'per_txn', e.target.value)} /></td>
              </tr>))}</tbody>
          </table>
        )}
        {rows && <div style={{ marginTop: 8, display: 'flex', gap: 8 }}><button style={S.btn} disabled={busy} onClick={save}>存費率</button><button style={S.link} disabled={busy} onClick={load}>重新讀取</button></div>}
      </>}
    </div>
  );
}
const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 },
  sub: { fontSize: 12, color: '#718096' },
  btn: { padding: '4px 12px', border: '1px solid #3182ce', borderRadius: 6, background: '#3182ce', color: '#fff', cursor: 'pointer', fontSize: 13 },
  link: { border: 'none', background: 'none', color: '#3182ce', cursor: 'pointer', padding: 0, fontSize: 13 },
  input: { padding: 4, border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13 },
  th: { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0', color: '#718096', fontWeight: 500 },
  td: { padding: '4px 8px', borderBottom: '1px solid #edf2f7' },
};
