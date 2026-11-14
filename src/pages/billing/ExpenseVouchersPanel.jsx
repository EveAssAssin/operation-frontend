// pages/billing/ExpenseVouchersPanel.jsx —— 帳單管理「🧾 報帳憑證」（2026-11-15）
// 門市費用申請（諮詢頻道 → 營運部審核通過）開的報帳憑證：黏存單（有發票／收據）／支出證明單（沒有單據）
// 列表（月份／種類／關鍵字）→ 點開看明細與單據 → 列印／作廢
import { useEffect, useState } from 'react';
import api from '../../services/api';
import { printVoucher } from './voucherPrint';

const KIND = { paste: '黏存單', proof: '支出證明單' };
const money = (n) => Number(n || 0).toLocaleString();
const ymNow = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7);
const S = {
  bar: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  inp: { border: '1px solid #d6cbb8', borderRadius: 6, padding: '6px 8px', fontSize: 13 },
  btn: (bg = '#50422d', fg = '#fff') => ({ background: bg, color: fg, border: '1px solid #d6cbb8', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }),
  th: { textAlign: 'left', padding: '8px 6px', background: '#f5f0ea', fontSize: 12, color: '#6b5640', borderBottom: '1px solid #e5dccd' },
  td: { padding: '8px 6px', fontSize: 13, borderBottom: '1px solid #f0ebe3', verticalAlign: 'top' },
};

export default function ExpenseVouchersPanel() {
  const [ym, setYm] = useState(ymNow());
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [cur, setCur] = useState(null);
  const load = async () => {
    setBusy(true); setErr('');
    try { const r = await api.get('/expense-vouchers', { params: { ym: ym || undefined, kind: kind || undefined, q: q || undefined } }); setRows(r.data || []); }
    catch (e) { setErr(e.message || '讀取失敗'); }
    setBusy(false);
  };
  useEffect(() => { load(); }, [ym, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = async (id) => { try { const r = await api.get(`/expense-vouchers/${id}`); setCur(r.data); } catch (e) { alert(e.message || '讀取失敗'); } };
  const doVoid = async () => {
    if (!window.confirm(`作廢 ${cur.voucher_no}？（只作廢憑證本身；月報與薪資加項不會動，要改請到月報調帳）`)) return;
    try { await api.post(`/expense-vouchers/${cur.id}/void`); setCur(null); load(); } catch (e) { alert(e.message || '失敗'); }
  };
  const total = rows.filter((r) => r.status === 'issued').reduce((s, r) => s + Number(r.amount || 0), 0);
  return (
    <div>
      <div style={{ fontSize: 12, color: '#6b5640', marginBottom: 10 }}>門市在諮詢頻道送「費用申請」（差旅費：交通費／油資），營運部審核通過後開的報帳憑證。有發票／收據＝黏存單；沒有單據＝支出證明單（要經手人、證明人簽章）。金額已同時列入月報「差旅費」科目與申請人二次薪加項。</div>
      <div style={S.bar}>
        <label style={{ fontSize: 13 }}>列帳月份 <input type="month" value={ym} onChange={(e) => setYm(e.target.value)} style={S.inp} /></label>
        <button onClick={() => setYm('')} style={S.btn('#fff', '#50422d')}>全部月份</button>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={S.inp}><option value="">全部種類</option><option value="paste">黏存單</option><option value="proof">支出證明單</option></select>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="編號／申請人／事由／門市" style={{ ...S.inp, width: 200 }} />
        <button onClick={load} style={S.btn()}>{busy ? '…' : '查詢'}</button>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#50422d' }}>{rows.length} 張，有效合計 NT$ {money(total)}</span>
      </div>
      {err && <div style={{ color: '#b91c1c', marginBottom: 8 }}>{err}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
        <thead><tr>{['編號', '日期', '種類', '公司', '申請人', '開帳單位', '列帳月份', '事由', '金額', '單據', ''].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ opacity: r.status === 'void' ? 0.45 : 1 }}>
              <td style={S.td}>{r.voucher_no}{r.status === 'void' && <span style={{ color: '#b91c1c', marginLeft: 4 }}>作廢</span>}</td>
              <td style={S.td}>{r.voucher_date}</td>
              <td style={S.td}>{KIND[r.kind] || r.kind}</td>
              <td style={S.td}>{r.company || '—'}</td>
              <td style={S.td}>{r.applicant_name}</td>
              <td style={S.td}>{r.store_name}</td>
              <td style={S.td}>{r.report_ym}</td>
              <td style={{ ...S.td, maxWidth: 260 }}>{r.purpose}</td>
              <td style={{ ...S.td, textAlign: 'right' }}>{money(r.amount)}</td>
              <td style={S.td}>{r.attach_count || 0}</td>
              <td style={S.td}><button onClick={() => open(r.id)} style={S.btn('#fff', '#50422d')}>查看</button></td>
            </tr>
          ))}
          {!rows.length && !busy && <tr><td colSpan={11} style={{ ...S.td, textAlign: 'center', color: '#999' }}>沒有資料</td></tr>}
        </tbody>
      </table>
      {cur && (
        <div onClick={() => setCur(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, padding: 18, width: 'min(720px, 94vw)', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <b style={{ fontSize: 16 }}>{KIND[cur.kind]}｜{cur.voucher_no}</b>
              {cur.status === 'void' && <span style={{ color: '#b91c1c' }}>已作廢（{cur.void_by}）</span>}
              <span style={{ marginLeft: 'auto' }} />
              <button onClick={() => printVoucher(cur)} style={S.btn()}>🖨 列印</button>
              {cur.status === 'issued' && <button onClick={doVoid} style={S.btn('#fff', '#b91c1c')}>作廢</button>}
              <button onClick={() => setCur(null)} style={S.btn('#fff', '#50422d')}>關閉</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><tbody>
              {[['公司（投保單位）', cur.company], ['申請人', cur.applicant_name], ['開帳單位／列帳月份', `${cur.store_name || ''}／${cur.report_ym || ''}`], ['會計科目', cur.subject_name], ['事由', cur.purpose], ['金額', `NT$ ${money(cur.amount)}（${cur.amount_words}）`], cur.kind === 'proof' ? ['不能取得單據原因', cur.no_receipt_reason] : ['附單據', `${cur.attach_count} 張`], ['備註', cur.note], ['開立', `${cur.created_by || ''}　${String(cur.created_at || '').slice(0, 16).replace('T', ' ')}`]].filter((x) => x[1]).map(([k, v]) => <tr key={k}><td style={{ ...S.td, width: 140, color: '#6b5640' }}>{k}</td><td style={S.td}>{v}</td></tr>)}
            </tbody></table>
            {(cur.items || []).length > 0 && <div style={{ marginTop: 10 }}><b style={{ fontSize: 13 }}>明細</b>{cur.items.map((x, i) => <div key={i} style={{ fontSize: 13, padding: '3px 0' }}>・{x.date || ''} {x.desc || [x.from, x.to].filter(Boolean).join(' → ')} {x.qty || ''} {x.amount != null ? `NT$ ${money(x.amount)}` : ''}</div>)}</div>}
            {(cur.files || []).length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{cur.files.map((f, i) => f.url && <a key={i} href={f.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#50422d', textAlign: 'center' }}><img src={f.url} alt="" style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd', display: 'block' }} />{f.amount != null ? `NT$ ${money(f.amount)}` : f.name}</a>)}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
