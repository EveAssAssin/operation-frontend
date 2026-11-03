// pages/billing/BillScanModal.jsx
// 營運費用「掃碼入帳」
//   1. 掃描槍（或手機掃完貼上）逐條掃，系統自動分組成一張張帳單
//      - 中華電信三段式：三條掃完自動成一張（年月、金額、繳費期限都自動）
//      - 其他帳單：掃完輸入金額按 Enter 成一張
//   2. 第一次出現的帳單 → 選一次對應的帳號/電號，之後自動帶出
//   3. 重複（同帳號同月已入帳）自動標示、預設不送
//   4. 一次送出 → 建營運費用 + 分帳（掛帳年月 = 帳單年月），月報自動帶入

import { useState, useEffect, useRef, useMemo } from 'react';
import { operationalExpensesApi } from '../../services/api';
import { feed, emptyBuf, bufEmpty, toBill, describeBuf } from './billBarcode';

const fmt = n => Number(n || 0).toLocaleString('zh-TW');
let seq = 0;

function factLabel(f) {
  if (!f) return '';
  const d = f.data || {};
  const nums = ['account_id', 'meter_id', 'water_id', 'account_no', 'full_phone', 'service_type']
    .map(k => d[k]).filter(v => v != null && String(v).trim() !== '');
  const rest = nums.length ? nums : Object.values(d).filter(v => v != null && String(v).trim() !== '').slice(0, 2);
  return [f.store_name || f.store_erpid, ...rest.slice(0, 3)].filter(Boolean).join(' · ');
}

export default function BillScanModal({ categories = [], onClose, onSaved }) {
  const [buf, setBuf]         = useState(emptyBuf());
  const [queue, setQueue]     = useState([]);   // { uid, bill, res, category_id, fact_id, amount, bill_ym, include, result }
  const [factsByCat, setFactsByCat] = useState({});
  const [manualAmt, setManualAmt]   = useState('');
  const [busy, setBusy]       = useState(false);
  const [done, setDone]       = useState(null);
  const scanRef = useRef(null);
  const amtRef  = useRef(null);

  const catByCode = useMemo(() => Object.fromEntries(categories.map(c => [c.code, c])), [categories]);
  const telecomId = catByCode.telecom?.id || '';

  useEffect(() => { scanRef.current?.focus(); }, []);

  async function loadFacts(catId) {
    if (!catId || factsByCat[catId]) return;
    try {
      const r = await operationalExpensesApi.listFactsByCategory(catId);
      setFactsByCat(m => ({ ...m, [catId]: r.success ? r.data : [] }));
    } catch { /* ignore */ }
  }

  async function addBills(bills) {
    if (!bills.length) return;
    const rows = bills.map(bill => ({
      uid: ++seq, bill, res: null,
      category_id: bill.format === 'std' ? telecomId : '',
      fact_id: '', amount: bill.amount ?? '', bill_ym: bill.bill_ym || '',
      include: true, result: null,
    }));
    setQueue(q => [...q, ...rows]);
    try {
      const r = await operationalExpensesApi.scanResolve(bills.map(b => ({ key: b.key, bill_ym: b.bill_ym })));
      const list = r.success ? r.data : [];
      setQueue(q => q.map(row => {
        const i = rows.findIndex(x => x.uid === row.uid);
        if (i < 0) return row;
        const res = list[i] || null;
        const patch = { res };
        if (res?.binding) {
          patch.category_id = res.binding.category_id || res.binding.fact?.category_id || row.category_id;
          patch.fact_id = res.binding.fact_id || '';
        } else if (res?.guesses?.length === 1) {
          patch.category_id = res.guesses[0].category_id;
          patch.fact_id = res.guesses[0].id;
        }
        if (res?.duplicate) patch.include = false;
        return { ...row, ...patch };
      }));
      const cats = new Set(rows.map(r => r.category_id).filter(Boolean));
      for (const x of list) {
        if (x?.binding?.category_id) cats.add(x.binding.category_id);
        for (const g of x?.guesses || []) cats.add(g.category_id);
      }
      cats.forEach(loadFacts);
    } catch (e) { alert('比對失敗：' + (e?.message || e)); }
  }

  function onScan(text) {
    const lines = String(text).split(/\n/).filter(l => l.trim() !== '');
    let b = buf; const out = [];
    for (const l of lines) { const r = feed(b, l); b = r.buf; out.push(...r.flushed); }
    setBuf(b);
    addBills(out);
    // 非三段式：跳到金額欄
    if (!bufEmpty(b) && !(b.s1 || b.s3)) setTimeout(() => amtRef.current?.focus(), 0);
  }

  function finishBuf(amount) {
    if (bufEmpty(buf)) return;
    const bill = toBill(buf);
    if (amount !== undefined && amount !== '') bill.amount = Number(amount);
    setBuf(emptyBuf());
    setManualAmt('');
    addBills([bill]);
    scanRef.current?.focus();
  }

  function setRow(uid, patch) { setQueue(q => q.map(r => r.uid === uid ? { ...r, ...patch } : r)); }
  async function pickFact(row, factId) {
    setRow(row.uid, { fact_id: factId });
    if (!factId || !row.bill_ym) return;
    try {
      const r = await operationalExpensesApi.getFactAllocatedMonths(factId);
      if (r.success && (r.data?.allocated || []).includes(row.bill_ym)) {
        setQueue(q => q.map(x => x.uid === row.uid
          ? { ...x, include: false, res: { ...(x.res || {}), duplicate: { type: 'allocated', amount: 0 } } }
          : x));
      } else {
        setQueue(q => q.map(x => x.uid === row.uid && x.res?.duplicate?.type === 'allocated'
          ? { ...x, include: true, res: { ...x.res, duplicate: null } } : x));
      }
    } catch { /* ignore */ }
  }
  function delRow(uid) { setQueue(q => q.filter(r => r.uid !== uid)); }

  const ready = r => r.include && !r.result?.ok && r.bill.key && r.fact_id && Number(r.amount) > 0 && /^\d{4}-\d{2}$/.test(r.bill_ym);
  const toSend = queue.filter(ready);
  const sendTotal = toSend.reduce((s, r) => s + Number(r.amount || 0), 0);

  async function submit() {
    if (!toSend.length) return;
    setBusy(true);
    try {
      const items = toSend.map(r => ({
        key: r.bill.key, bill_ym: r.bill_ym, amount: Number(r.amount),
        due_date: r.bill.due_date, raw: r.bill.raw, fact_id: r.fact_id,
      }));
      const res = await operationalExpensesApi.scanCommit(items);
      const list = res.success ? res.data : [];
      setQueue(q => q.map(row => {
        const i = toSend.findIndex(x => x.uid === row.uid);
        return i >= 0 ? { ...row, result: list[i] || { ok: false, message: '無回應' } } : row;
      }));
      const okN = list.filter(x => x.ok).length;
      setDone({ ok: okN, fail: list.length - okN });
      if (okN) onSaved?.();
    } catch (e) { alert('送出失敗：' + (e?.message || e)); }
    finally { setBusy(false); }
  }

  const bufParts = describeBuf(buf);
  const bufIsStd = !!(buf.s1 || buf.s3);

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.box}>
        <div style={S.header}>
          <strong>📷 掃碼入帳</strong>
          <button onClick={onClose} style={S.close}>✕</button>
        </div>

        <div style={S.body}>
          <div style={S.scanCard}>
            <textarea
              ref={scanRef}
              rows={1}
              style={S.scanInput}
              placeholder="點這裡後用掃描槍掃條碼（或把手機掃到的條碼整段貼上）"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const v = e.currentTarget.value;
                  e.currentTarget.value = '';
                  if (v.trim()) onScan(v);
                  else if (!bufEmpty(buf) && bufIsStd) finishBuf();
                }
              }}
              onPaste={e => {
                const t = e.clipboardData.getData('text');
                if (t.includes('\n')) { e.preventDefault(); onScan(t); }
              }}
            />
            <div style={S.hint}>
              中華電信三段式條碼：三條掃完自動成一張。其他帳單：掃完在右邊輸入金額按 Enter。
            </div>

            {!bufEmpty(buf) && (
              <div style={S.bufBox}>
                <div style={{ flex: 1, fontSize: 12, color: '#2d3748' }}>
                  <strong>掃描中：</strong>{bufParts.join('｜')}
                  {bufIsStd && (
                    <span style={{ color: '#c05621', marginLeft: 6 }}>
                      還缺 {['s1', 's2', 's3'].filter(k => !buf[k]).map(k => ({ s1: '第一段', s2: '第二段', s3: '第三段' })[k]).join('、')}
                    </span>
                  )}
                </div>
                {!bufIsStd && (
                  <input
                    ref={amtRef}
                    style={{ ...S.input, width: 110 }}
                    placeholder="金額"
                    inputMode="numeric"
                    value={manualAmt}
                    onChange={e => setManualAmt(e.target.value.replace(/[^\d.]/g, ''))}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); finishBuf(manualAmt); } }}
                  />
                )}
                <button style={S.btnGhost} onClick={() => finishBuf(manualAmt)}>完成這張</button>
                <button style={S.btnGhost} onClick={() => { setBuf(emptyBuf()); setManualAmt(''); scanRef.current?.focus(); }}>清除</button>
              </div>
            )}
          </div>

          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>送</th>
                <th style={S.th}>帳單年月</th>
                <th style={S.th}>金額</th>
                <th style={S.th}>對應帳號 / 門市</th>
                <th style={S.th}>狀態</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 && (
                <tr><td colSpan={6} style={S.empty}>還沒有帳單，開始掃吧</td></tr>
              )}
              {queue.map(r => {
                const facts = factsByCat[r.category_id] || [];
                const bound = !!r.res?.binding;
                const dup = r.res?.duplicate;
                return (
                  <tr key={r.uid} style={{ background: r.result?.ok ? '#f0fff4' : dup ? '#fffaf0' : undefined }}>
                    <td style={S.td}>
                      <input type="checkbox" checked={r.include} disabled={!!r.result?.ok}
                        onChange={e => setRow(r.uid, { include: e.target.checked })} />
                    </td>
                    <td style={S.td}>
                      <input type="month" style={{ ...S.input, width: 140 }} value={r.bill_ym}
                        disabled={!!r.result?.ok} onChange={e => setRow(r.uid, { bill_ym: e.target.value })} />
                      {r.bill.due_date && <div style={S.sub}>繳費期限 {r.bill.due_date}</div>}
                    </td>
                    <td style={S.td}>
                      <input style={{ ...S.input, width: 100, textAlign: 'right' }} value={r.amount}
                        disabled={!!r.result?.ok || r.bill.format === 'std'}
                        onChange={e => setRow(r.uid, { amount: e.target.value.replace(/[^\d.]/g, '') })} />
                    </td>
                    <td style={S.td}>
                      {bound ? (
                        <div>
                          <span style={S.tagOk}>已記住</span> {factLabel(r.res.binding.fact)}
                          {!r.result?.ok && (
                            <button style={S.link} onClick={() => setRow(r.uid, { res: { ...r.res, binding: null } })}>改</button>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <select style={S.select} value={r.category_id}
                            disabled={!!r.result?.ok}
                            onChange={e => { setRow(r.uid, { category_id: e.target.value, fact_id: '' }); loadFacts(e.target.value); }}>
                            <option value="">分類…</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.icon || ''} {c.name}</option>)}
                          </select>
                          <select style={{ ...S.select, minWidth: 260 }} value={r.fact_id}
                            disabled={!r.category_id || !!r.result?.ok}
                            onFocus={() => loadFacts(r.category_id)}
                            onChange={e => pickFact(r, e.target.value)}>
                            <option value="">第一次掃到，請選對應帳號…</option>
                            {facts.map(f => <option key={f.id} value={f.id}>{factLabel(f)}</option>)}
                          </select>
                        </div>
                      )}
                      <div style={S.sub} title={r.bill.raw.join('\n')}>識別碼 {r.bill.key || '（無）'}</div>
                    </td>
                    <td style={S.td}>
                      {r.result?.ok && <span style={S.tagOk}>✓ 已入帳</span>}
                      {r.result && !r.result.ok && <span style={S.tagErr}>✕ {r.result.message}</span>}
                      {!r.result && dup && (
                        <span style={S.tagWarn}>
                          ⚠ {dup.type === 'scanned' ? '這張已掃過入帳' : '此帳號該月已有費用'}{dup.amount ? `（$${fmt(dup.amount)}）` : ''}
                        </span>
                      )}
                      {!r.result && !dup && r.bill.missing?.length > 0 && (
                        <span style={S.tagErr}>缺 {r.bill.missing.join('、')}</span>
                      )}
                      {!r.result && !dup && !r.bill.missing?.length && !ready(r) && r.include && (
                        <span style={S.tagWarn}>
                          {!r.fact_id ? '待選帳號' : !(Number(r.amount) > 0) ? '待填金額' : '待確認'}
                        </span>
                      )}
                      {!r.result && ready(r) && <span style={S.tagNew}>可送出</span>}
                    </td>
                    <td style={S.td}>
                      {!r.result?.ok && <button style={S.btnDanger} onClick={() => delRow(r.uid)}>✕</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={S.footer}>
          <div style={{ marginRight: 'auto', fontSize: 13, color: '#4a5568' }}>
            共 {queue.length} 張｜可送出 <strong>{toSend.length}</strong> 張，合計 <strong>${fmt(sendTotal)}</strong>
            {done && <span style={{ marginLeft: 10, color: done.fail ? '#c53030' : '#276749' }}>
              上次送出：成功 {done.ok}、失敗 {done.fail}
            </span>}
          </div>
          <button style={S.btnGhost} onClick={onClose}>關閉</button>
          <button style={S.btnPrimary} disabled={busy || !toSend.length} onClick={submit}>
            {busy ? '入帳中…' : `入帳 ${toSend.length} 張`}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  box:       { background: '#fff', borderRadius: 10, width: '100%', maxWidth: 1100, maxHeight: '92vh', display: 'flex', flexDirection: 'column' },
  header:    { padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  body:      { padding: 20, overflowY: 'auto', flex: 1 },
  footer:    { padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 },
  close:     { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#718096' },
  scanCard:  { border: '2px dashed #b7a98f', borderRadius: 10, padding: 14, marginBottom: 14, background: '#fbf8f3' },
  scanInput: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 16, border: '1px solid #cbd5e0', borderRadius: 8, resize: 'none', fontFamily: 'monospace' },
  hint:      { fontSize: 12, color: '#718096', marginTop: 6 },
  bufBox:    { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 10px', background: '#fff', border: '1px solid #f6ad55', borderRadius: 8 },
  input:     { padding: '5px 8px', border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13 },
  select:    { padding: '5px 8px', border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13, background: '#fff' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:        { padding: '8px 10px', textAlign: 'left', fontWeight: 600, background: '#f7fafc', borderBottom: '2px solid #e2e8f0', color: '#4a5568', whiteSpace: 'nowrap' },
  td:        { padding: '8px 10px', borderBottom: '1px solid #edf2f7', verticalAlign: 'top' },
  sub:       { fontSize: 11, color: '#a0aec0', marginTop: 3, fontFamily: 'monospace' },
  empty:     { textAlign: 'center', padding: 30, color: '#a0aec0' },
  tagOk:     { fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#c6f6d5', color: '#22543d' },
  tagNew:    { fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#bee3f8', color: '#2a4365' },
  tagWarn:   { fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#feebc8', color: '#7b341e' },
  tagErr:    { fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#fed7d7', color: '#822727' },
  link:      { background: 'none', border: 'none', color: '#3182ce', cursor: 'pointer', fontSize: 12, marginLeft: 4 },
  btnPrimary:{ padding: '7px 16px', background: '#50422d', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnGhost:  { padding: '5px 10px', background: '#fff', color: '#4a5568', border: '1px solid #cbd5e0', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  btnDanger: { padding: '4px 8px', background: '#fff', color: '#c53030', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
};
