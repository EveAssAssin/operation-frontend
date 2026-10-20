// pages/billing/LedgerPosting.jsx — 入帳月份／科目／分攤＋帳本明細（2026-10-20）
//   PostingFields：廠商請款審核時（按「通過」前）設定入帳月份、月報格子、分攤月數
//   BillPosting：已產生帳單後，逐門市看／改列入月份、科目、分攤（已關帳的不能動）
//   BookPanel：帳單管理「📒 帳本明細」— 全部門市每一筆支出，依科目／門市／來源篩選與逐月比較
import { useEffect, useState, useCallback, useMemo } from 'react';
import { ledgerApi } from '../../services/api';
import SubjectSelect from '../../components/ledger/SubjectSelect';
import HelpTip from '../../components/help/HelpTip';

const GROUPS = { opex: '營運支出', planning: '企劃品', ads: '廣告費', misc: '雜費', frame: '鏡框', lens: '鏡片', contact: '藥拋' };
const errMsg = (e) => (e && e.response && e.response.data && e.response.data.message) || (e && e.message) || '失敗';
const fmt = (n) => (n == null ? '—' : Math.round(Number(n)).toLocaleString());
const tpeYm = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7);
const addYm = (ym, k) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 7); };

let accCache = null;
function useAccounts() {
  const [accs, setAccs] = useState(accCache || []);
  useEffect(() => { if (accCache) return; ledgerApi.accounts().then((r) => { accCache = (r.data || []).filter((a) => a.kind === 'expense' && a.is_active !== false); setAccs(accCache); }).catch(() => {}); }, []);
  return accs;
}
function CodeSelect({ value, onChange, accs, autoLabel = '（照廠商設定）', style }) {
  return (
    <select style={{ ...S.input, ...style }} value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{autoLabel}</option>
      {Object.entries(GROUPS).map(([g, gn]) => <optgroup key={g} label={gn}>{accs.filter((a) => a.group_code === g).map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}</optgroup>)}
    </select>
  );
}

/** 請款審核：入帳設定（受控元件） value={report_ym, ledger_code, amort_months} */
export function PostingFields({ value, onChange, feeYm, stores, disabled }) {
  const accs = useAccounts();
  const [pv, setPv] = useState(null);
  const v = value || {};
  useEffect(() => {
    if (!feeYm) return;
    ledgerApi.postingPreview({ fee_ym: feeYm, ym: v.report_ym || '', stores: (stores || []).join(',') }).then((r) => setPv(r.data)).catch(() => setPv(null));
  }, [feeYm, v.report_ym, (stores || []).join(',')]); // eslint-disable-line
  const ym = v.report_ym || (pv && pv.default_ym) || '';
  const n = Number(v.amort_months) || 1;
  return (
    <div style={{ padding: 12, background: '#f0f7ff', border: '1px solid #bee3f8', borderRadius: 6 }} data-yaya="vp-posting">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#2c5282', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        📒 入帳設定（列入門市月報）
        <HelpTip title="入帳設定" body={'入帳月份：這筆帳列在哪個月的門市月報。預設＝費用月份；如果過了下個月 ' + ((pv && pv.cutoff) || 26) + ' 號才收到，會列下個月。\n會計科目：一定要選，選了就決定列在月報哪一格（之後也用來歸類分析）；沒有適合的可以當場新增。\n分攤：要分好幾個月算就填月數，每月平均、零頭放最後一個月。\n任何一個門市那個月已關帳，會自動改列下一個沒關帳的月份。\n廠商入口的請款是「標記已撥款」後才進月報；市場部等系統送來的請款是「通過」就進月報。'} />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
        <label>入帳月份 <input type="month" disabled={disabled} style={S.input} value={ym} onChange={(e) => onChange({ ...v, report_ym: e.target.value || null })} /></label>
        {pv && pv.default_ym && v.report_ym && v.report_ym !== pv.default_ym && <button style={S.link} disabled={disabled} onClick={() => onChange({ ...v, report_ym: null })}>改回預設 {pv.default_ym}</button>}
        <label>會計科目 <SubjectSelect disabled={disabled} value={v.subject_id} onChange={(sj) => onChange({ ...v, subject_id: sj ? sj.id : null, ledger_code: sj ? sj.ledger_code : null })} /></label>
        <label>分攤 <input type="number" min="1" max="60" disabled={disabled} style={{ ...S.input, width: 56 }} value={n} onChange={(e) => onChange({ ...v, amort_months: Number(e.target.value) || 1 })} /> 個月</label>
      </div>
      <div style={{ fontSize: 12, color: '#4a5568', marginTop: 6 }}>
        {feeYm ? `費用月份 ${feeYm}` : ''}{ym ? `　→　列入 ${ym}${n > 1 ? `～${addYm(ym, n - 1)}（分 ${n} 個月）` : ''} 月報` : ''}
        {pv && pv.shift && pv.shift.length > 0 && <div style={{ color: '#c05621' }}>⚠ {pv.shift.length} 家門市 {ym} 已關帳，會改列 {[...new Set(pv.shift.map((x) => x.to))].join('／')}</div>}
      </div>
    </div>
  );
}

/** 帳單已產生後：逐門市入帳設定 */
export function BillPosting({ billId, canEdit = true, onChanged }) {
  const accs = useAccounts();
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(() => ledgerApi.billPosting(billId).then((r) => setD(r.data)).catch((e) => setMsg(errMsg(e))), [billId]);
  useEffect(() => { load(); }, [load]);
  const act = async (id, fn) => { setBusy(id); setMsg(''); try { const r = await fn(); setD(r.data); onChanged && onChanged(); } catch (e) { setMsg(errMsg(e)); } setBusy(''); };
  const askSchedule = (a) => {
    const n = window.prompt(`「${a.store_name}」${fmt(a.allocated_amount)} 元要分幾個月？（填 1＝取消分攤）`, a.schedule.length || 3);
    if (n == null) return;
    const from = a.schedule.length ? a.schedule[0].ym : a.effective_ym;
    const f = window.prompt('從哪個月開始？（YYYY-MM）', from || tpeYm());
    if (!f) return;
    act(a.id, () => ledgerApi.allocSchedule(a.id, { months: Number(n), from_ym: f }));
  };
  if (!d) return <div style={S.sub}>{msg || '載入入帳設定…'}</div>;
  const total = d.allocations.reduce((s, a) => s + Number(a.allocated_amount), 0);
  return (
    <div style={{ padding: 12, background: '#f0f7ff', border: '1px solid #bee3f8', borderRadius: 6 }} data-yaya="bill-posting">
      <div style={{ fontSize: 12, fontWeight: 700, color: '#2c5282', marginBottom: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
        📒 列入門市月報（{d.allocations.length} 家，{fmt(total)}）
        <HelpTip title="列入門市月報" body={'每一家門市這筆帳列在哪個月、哪一格。\n「自動」＝照費用月份＋收到日算（過了下個月 ' + d.bill.cutoff + ' 號才收到就列下個月）；已關帳的月份會自動往後順延。\n要改就直接選月份或格子；要分好幾個月算按「分攤」。\n已關帳的月份不能改（要修正請在之後的月份記調帳）。'} />
      </div>
      {msg && <div style={{ color: '#c53030', fontSize: 12, marginBottom: 4 }}>{msg}</div>}
      <div style={{ fontSize: 12, marginBottom: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        會計科目：<b style={{ color: d.bill.subject_set ? '#2c7a7b' : '#dd6b20' }}>{d.bill.subject_name || '（沒有）'}{d.bill.subject_set ? '' : '（沒選過，暫用預設）'}</b>
        {canEdit && <SubjectSelect value="" placeholder={d.bill.subject_set ? '換科目' : '選科目'} style={{ fontSize: 12, padding: 2 }}
          onChange={async (sj) => { if (!sj) return; setMsg(''); try { await ledgerApi.billSubject(billId, sj.id); await load(); onChanged && onChanged(); } catch (e) { setMsg(errMsg(e)); } }} />}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>{['門市', '金額', '列入月份', '月報格子', '分攤'].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>{d.allocations.map((a) => (
          <tr key={a.id} style={{ opacity: busy === a.id ? 0.5 : 1 }}>
            <td style={S.td}>{a.store_name || a.store_erpid}</td>
            <td style={{ ...S.td, textAlign: 'right' }}>{fmt(a.allocated_amount)}</td>
            <td style={S.td}>
              {a.schedule.length ? <span style={S.sub}>分攤中</span>
                : a.closed ? <span>{a.effective_ym} <span style={S.tag('#2f855a')}>已關帳</span></span>
                : <><input type="month" disabled={!canEdit} style={S.input} value={a.effective_ym || ''} onChange={(e) => act(a.id, () => ledgerApi.allocPatch(a.id, { report_ym: e.target.value || null }))} />
                    {a.ym_auto ? <span style={S.sub}> 自動</span> : canEdit && <button style={S.link} onClick={() => act(a.id, () => ledgerApi.allocPatch(a.id, { report_ym: null }))}> 改回自動</button>}</>}
            </td>
            <td style={S.td}>{a.closed ? (accs.find((x) => x.code === a.effective_code) || {}).name || a.effective_code
              : <CodeSelect accs={accs} value={a.ledger_code} onChange={(c) => act(a.id, () => ledgerApi.allocPatch(a.id, { ledger_code: c }))} autoLabel={`（照設定：${(accs.find((x) => x.code === a.effective_code) || {}).name || a.effective_code}）`} />}</td>
            <td style={S.td}>
              {a.schedule.length > 0 && <div style={{ fontSize: 11 }}>{a.schedule.map((x) => `${x.ym} ${fmt(x.amount)}${x.closed ? '🔒' : ''}`).join('、')}</div>}
              {canEdit && !a.closed && <button style={S.link} onClick={() => askSchedule(a)}>{a.schedule.length ? '改分攤' : '分攤'}</button>}
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/** 📒 帳本明細 */
export function BookPanel() {
  const accs = useAccounts();
  const [f, setF] = useState({ from: addYm(tpeYm(), -2), to: tpeYm(), store: '', code: '', group: '', source: '', subject: '', q: '' });
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [view, setView] = useState('code');
  const load = useCallback(async (fresh) => {
    setBusy(true); setMsg('');
    try { const r = await ledgerApi.book({ ...f, fresh: fresh ? 1 : undefined }); setD(r.data); } catch (e) { setMsg(errMsg(e)); }
    setBusy(false);
  }, [f]);
  useEffect(() => { load(); }, []); // eslint-disable-line
  const stores = useMemo(() => (d ? d.by_store.map((s) => ({ id: s.store, name: s.store_name })) : []), [d]);
  const months = d ? d.months : [];
  const trend = (row) => months.map((m, i) => {
    const v = row.months[m] || 0; const p = i ? row.months[months[i - 1]] || 0 : null;
    const pct = p ? Math.round(((v - p) / Math.abs(p)) * 100) : null;
    return <td key={m} style={{ ...S.td, textAlign: 'right' }}>{fmt(v)}{pct != null && Math.abs(pct) >= 20 && <div style={{ fontSize: 10, color: pct > 0 ? '#c53030' : '#2f855a' }}>{pct > 0 ? '+' : ''}{pct}%</div>}</td>;
  });
  const exportCsv = () => {
    if (!d) return;
    const head = ['月份', '門市', '區', '月報格子', '會計科目', '金額', '來源', '說明', '費用月', '已關帳'];
    const rows = d.lines.map((l) => [l.ym, l.store_name, l.group_name, l.name, `${l.subject_name || ''}${l.subject_set ? '' : '（預設）'}`, l.amount, l.source_name, l.ref_title || '', l.fee_ym || '', l.closed ? '是' : '']);
    const csv = '﻿' + [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `帳本明細_${f.from}_${f.to}.csv`; a.click();
  };
  return (
    <div style={S.card} data-yaya="book">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <b>📒 帳本明細</b>
        <HelpTip title="帳本明細" body={'門市月報裡每一筆支出都在這裡：帳單、廠商請款、部門開帳、營運費用、固定支出、合約房租、ERP 費用單、企劃部、倉庫、薪資、手填、調帳、分攤。\n上面選月份範圍（最多 12 個月）和篩選條件，按「查詢」。\n「依科目」「依門市」看逐月變化，跟上個月差 20% 以上會標出來；「明細」看每一筆，帳單那幾筆可以點進去改列入月份或格子。\n已關帳的月份用關帳當下的數字。'} />
        <input type="month" style={S.input} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />～<input type="month" style={S.input} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        <select style={S.input} value={f.store} onChange={(e) => setF({ ...f, store: e.target.value })}><option value="">全部門市</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select style={S.input} value={f.group} onChange={(e) => setF({ ...f, group: e.target.value, code: '' })}><option value="">全部區</option>{Object.entries(GROUPS).map(([g, n]) => <option key={g} value={g}>{n}</option>)}</select>
        <CodeSelect accs={f.group ? accs.filter((a) => a.group_code === f.group) : accs} value={f.code} onChange={(c) => setF({ ...f, code: c || '' })} autoLabel="全部科目" />
        <select style={S.input} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}><option value="">全部來源</option>{(d ? d.by_source : []).map((s) => <option key={s.source} value={s.source}>{s.source}</option>)}</select>
        <input style={{ ...S.input, width: 120 }} placeholder="關鍵字" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <button style={S.btn} disabled={busy} onClick={() => load()}>{busy ? '計算中…' : '查詢'}</button>
        <button style={S.link} disabled={busy} onClick={() => load(true)}>重算最新月</button>
        <button style={S.link} disabled={!d} onClick={exportCsv}>匯出 CSV</button>
      </div>
      {msg && <div style={{ color: '#c53030', fontSize: 13 }}>{msg}</div>}
      {busy && !d && <div style={S.sub}>第一次查詢要把每家店每個月都算一遍，約 10～60 秒…</div>}
      {d && <>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 13, marginBottom: 8, flexWrap: 'wrap' }}>
          <span>合計 <b>{fmt(d.total)}</b>（{d.count.toLocaleString()} 筆）</span>
          {d.by_source.slice(0, 8).map((s) => <span key={s.source} style={S.sub}>{s.source} {fmt(s.amount)}</span>)}
          {d.errors.length > 0 && <span style={{ color: '#c05621' }}>⚠ {d.errors.length} 家店有月份算不出來（{d.errors.slice(0, 3).map((e) => `${e.store_name} ${e.ym}`).join('、')}）</span>}
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {[['code', '依月報格子'], ['subject', '依會計科目'], ['store', '依門市'], ['lines', '明細']].map(([k, n]) => <button key={k} onClick={() => setView(k)} style={{ ...S.tab, ...(view === k ? S.tabOn : {}) }}>{n}</button>)}
        </div>
        {view !== 'lines' && <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr><th style={S.th}>{view === 'code' ? '月報格子' : view === 'subject' ? '會計科目' : '門市'}</th>{months.map((m) => <th key={m} style={{ ...S.th, textAlign: 'right' }}>{m}</th>)}<th style={{ ...S.th, textAlign: 'right' }}>合計</th><th style={{ ...S.th, textAlign: 'right' }}>占比</th></tr></thead>
          <tbody>{(view === 'code' ? d.by_code : view === 'subject' ? (d.by_subject || []) : d.by_store).map((r) => (
            <tr key={(r.subject_id || '') + (r.code || r.store)} style={{ cursor: 'pointer' }} onClick={() => { if (view === 'subject') setF({ ...f, subject: r.subject_id || '' }); else setF({ ...f, [view === 'code' ? 'code' : 'store']: r.code || r.store }); setView('lines'); }}>
              <td style={S.td}>{view === 'code' ? <>{r.name} <span style={S.sub}>{r.group_name}</span></> : view === 'subject' ? <>{r.name} <span style={S.sub}>{r.code_name}{r.unset ? `・其中 ${fmt(r.unset)} 沒選過科目` : ''}</span></> : r.store_name}</td>
              {trend(r)}
              <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{fmt(r.total)}</td>
              <td style={{ ...S.td, textAlign: 'right' }}>{d.total ? `${Math.round((r.total / d.total) * 1000) / 10}%` : ''}</td>
            </tr>))}</tbody>
        </table></div>}
        {view === 'lines' && <LinesTable d={d} f={f} setF={setF} />}
      </>}
    </div>
  );
}
function LinesTable({ d, f, setF }) {
  const [open, setOpen] = useState(null);
  const lines = d.lines.filter((l) => (!f.store || l.store === f.store) && (!f.code || l.code === f.code) && (!f.subject || l.subject_id === f.subject));
  return (
    <div style={{ overflowX: 'auto' }}>
      {(f.store || f.code || f.subject) && <div style={{ fontSize: 12, marginBottom: 4 }}>篩選中 <button style={S.link} onClick={() => setF({ ...f, store: '', code: '', subject: '' })}>清除門市／格子／科目</button>（改了篩選要按「查詢」）</div>}
      {d.truncated && <div style={{ fontSize: 12, color: '#c05621' }}>筆數太多，只列前 3000 筆，請縮小範圍</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead><tr>{['月份', '門市', '月報格子／會計科目', '金額', '來源', '說明', ''].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>{lines.map((l, i) => [
          <tr key={i}>
            <td style={S.td}>{l.ym}{l.closed ? ' 🔒' : ''}{l.fee_ym && l.fee_ym !== l.ym ? <div style={S.sub}>費用 {l.fee_ym}</div> : null}</td>
            <td style={S.td}>{l.store_name}</td>
            <td style={S.td}>{l.name}<div style={{ ...S.sub, color: l.subject_set ? '#2c7a7b' : '#a0aec0' }}>{l.subject_name}{l.subject_set ? '' : '（預設）'}</div></td>
            <td style={{ ...S.td, textAlign: 'right' }}>{fmt(l.amount)}</td>
            <td style={S.td}>{l.source_name}</td>
            <td style={{ ...S.td, maxWidth: 360 }}>{l.ref_title}</td>
            <td style={S.td}>{l.source === 'bill' && l.ref_id && <button style={S.link} onClick={() => setOpen(open === i ? null : i)}>{open === i ? '收起' : '入帳設定'}</button>}</td>
          </tr>,
          open === i && <tr key={`o${i}`}><td colSpan={7} style={{ padding: 8 }}><BillPosting billId={l.ref_id} /></td></tr>,
        ])}</tbody>
      </table>
    </div>
  );
}

const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 },
  sub: { fontSize: 11, color: '#718096' },
  btn: { padding: '4px 12px', border: '1px solid #3182ce', borderRadius: 6, background: '#3182ce', color: '#fff', cursor: 'pointer', fontSize: 13 },
  link: { border: 'none', background: 'none', color: '#3182ce', cursor: 'pointer', padding: 0, fontSize: 12 },
  input: { padding: 4, border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13 },
  th: { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0', color: '#718096', fontWeight: 500, whiteSpace: 'nowrap' },
  td: { padding: '4px 8px', borderBottom: '1px solid #edf2f7', verticalAlign: 'top' },
  tab: { padding: '4px 12px', border: '1px solid #cbd5e0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 },
  tabOn: { background: '#50422d', color: '#fff', borderColor: '#50422d' },
  tag: (c) => ({ fontSize: 10, color: c, border: `1px solid ${c}`, borderRadius: 4, padding: '0 4px' }),
};
