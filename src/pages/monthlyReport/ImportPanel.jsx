// 月報「📥 Excel 匯入」（2026-10-20）：下載範本 → 填好 → 上傳預覽（每列檢查）→ 全部 OK 才能確認寫入
import { useState } from 'react';
import { ledgerApi } from '../../services/api';
import HelpTip from '../../components/help/HelpTip';

const errMsg = (e) => (e && (e.message || e.error)) || '失敗';
export default function ImportPanel({ onDone }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [pv, setPv] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const dl = async () => {
    try {
      const blob = await ledgerApi.importTemplate();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '月報匯入範本.xlsx'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) { setMsg(errMsg(e)); }
  };
  const preview = async (f) => {
    setFile(f); setPv(null); setMsg(''); if (!f) return;
    setBusy(true);
    try { const r = await ledgerApi.importExcel(f, true); setPv(r.data); } catch (e) { setMsg(errMsg(e)); }
    setBusy(false);
  };
  const commit = async () => {
    setBusy(true);
    try { const r = await ledgerApi.importExcel(file, false); setMsg(`已匯入 ${r.data.done} 筆`); setPv(null); setFile(null); onDone && onDone(); }
    catch (e) { setMsg(errMsg(e)); }
    setBusy(false);
  };
  return (
    <div style={S.card} data-yaya="mr-import">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <b>📥 Excel 匯入</b>
        <HelpTip title="Excel 匯入怎麼用" body={'1. 按「下載範本」，第一張表填資料（範本裡有科目清單、門市清單可以對照）。\n2. 每一列：門市（名稱或 ERP 編號）、月份（2026-09）、科目（名稱或代碼）、金額；方式空白＝手填（整格改成這個數字）、填「調帳」＝在系統數字上加減，備註要寫原因。\n3. 上傳後先預覽，紅字的列要修好重傳；全部沒問題才會出現「確認匯入」。\n4. 手填同一格會把舊值作廢、留紀錄；已關帳的月份不能匯入。'} />
        <span style={S.sub}>勞健保、實收、自訂收入…每月手填的數字一次匯入</span>
        <button style={S.link} onClick={() => setOpen(!open)}>{open ? '收起' : '打開'}</button>
      </div>
      {open && <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={S.ghost} onClick={dl}>⬇ 下載範本</button>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => preview(e.target.files[0] || null)} />
          {busy && <span style={S.sub}>處理中…</span>}
        </div>
        {msg && <div style={{ fontSize: 13, color: '#2c5282', marginTop: 6 }}>{msg}</div>}
        {pv && <>
          <div style={{ marginTop: 8, fontSize: 13 }}>共 {pv.rows.length} 列：可匯入 {pv.ok}、有問題 <b style={{ color: pv.bad ? '#c53030' : undefined }}>{pv.bad}</b></div>
          <div style={{ maxHeight: 300, overflow: 'auto', marginTop: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>{['列', '門市', '月份', '科目', '金額', '方式', '問題'].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{pv.rows.map((x) => (
                <tr key={x.row} style={{ background: x.errors.length ? '#fff5f5' : undefined }}>
                  <td style={S.td}>{x.row}</td><td style={S.td}>{x.store_name}</td><td style={S.td}>{x.ym}</td><td style={S.td}>{x.account}</td>
                  <td style={S.td}>{Number.isFinite(x.amount) ? x.amount.toLocaleString() : '—'}</td><td style={S.td}>{x.type === 'adjust' ? '調帳' : '手填'}</td>
                  <td style={{ ...S.td, color: '#c53030' }}>{x.errors.join('；')}</td>
                </tr>))}</tbody>
            </table>
          </div>
          {pv.bad === 0 && pv.ok > 0 && <button style={{ ...S.btn, marginTop: 8 }} disabled={busy} onClick={commit}>確認匯入 {pv.ok} 筆</button>}
        </>}
      </div>}
    </div>
  );
}
const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 },
  sub: { fontSize: 12, color: '#718096' },
  btn: { padding: '4px 12px', border: '1px solid #3182ce', borderRadius: 6, background: '#3182ce', color: '#fff', cursor: 'pointer', fontSize: 13 },
  ghost: { padding: '4px 12px', border: '1px solid #cbd5e0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 },
  link: { border: 'none', background: 'none', color: '#3182ce', cursor: 'pointer', padding: 0, fontSize: 13 },
  th: { textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #e2e8f0', color: '#718096', fontWeight: 500 },
  td: { padding: '3px 6px', borderBottom: '1px solid #edf2f7' },
};
