// pages/pettyCash/PettyCashPage.jsx —— 營運管理 → 零用金管理（2026-11）
// 金庫（可多個）→ 收入／支出流水、即時餘額；支出可勾「同步開帳」列入門市月報（選門市＋會計科目，可拆多間店）
import { useCallback, useEffect, useMemo, useState } from 'react';
import { pettyCashApi } from '../../services/api';

const C = { primary: '#50422d', bg: '#faf8f5', border: '#e0d5c8', muted: '#8a7a66', ok: '#2d6a4f', danger: '#c53030', in: '#2f855a', out: '#c05621' };
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 };
const btn = (bg, fg) => ({ border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600, background: bg, color: fg || '#fff' });
const ghost = btn('#edf2f7', '#4a5568');
const input = { border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 9px', fontSize: 13, boxSizing: 'border-box' };
const fmt = (n) => Number(n || 0).toLocaleString('zh-TW', { maximumFractionDigits: 2 });
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const errMsg = (e) => (e && (e.message || e.error)) || '失敗';
const IN_CATS = ['撥補', '退回', '其他收入'];
const OUT_CATS = ['文具用品', '清潔用品', '交通費', '郵資運費', '餐費', '修繕', '雜支'];

export default function PettyCashPage() {
  const [funds, setFunds] = useState([]);
  const [fundId, setFundId] = useState('');
  const [stores, setStores] = useState([]);
  const [err, setErr] = useState('');
  const [fundForm, setFundForm] = useState(null);   // null | {} 新增 | fund 修改
  const [showOff, setShowOff] = useState(false);

  const loadFunds = useCallback(async () => {
    try {
      const r = await pettyCashApi.funds(showOff);
      const list = r.data || [];
      setFunds(list);
      setFundId((cur) => (cur && list.some((f) => f.id === cur) ? cur : (list[0] && list[0].id) || ''));
    } catch (e) { setErr(errMsg(e)); }
  }, [showOff]);
  useEffect(() => { loadFunds(); }, [loadFunds]);
  const [subjects, setSubjects] = useState([]);
  useEffect(() => {
    // 門市＋部門（門市在前）；會計科目（支出）——都走零用金自己的 API，公關部不用其他權限
    pettyCashApi.stores().then((r) => setStores(r.data || [])).catch((e) => setErr('門市清單讀取失敗：' + errMsg(e)));
    pettyCashApi.subjects().then((r) => setSubjects(r.data || [])).catch(() => {});
  }, []);

  const fund = funds.find((f) => f.id === fundId);
  const storeName = (id) => (stores.find((s) => String(s.store_erpid) === String(id)) || {}).store_name || id;

  return (
    <div style={{ padding: 20, background: C.bg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, color: C.primary }}>💰 零用金管理</h2>
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 12, color: C.muted }}><input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} /> 顯示停用的金庫</label>
        <button style={btn(C.primary)} onClick={() => setFundForm({})}>＋ 新增金庫</button>
      </div>
      {err && <div style={{ ...card, color: C.danger }}>⚠ {err}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {funds.map((f) => (
          <div key={f.id} onClick={() => setFundId(f.id)} style={{ ...card, marginBottom: 0, cursor: 'pointer', minWidth: 200,
            borderColor: f.id === fundId ? C.primary : C.border, boxShadow: f.id === fundId ? '0 0 0 2px #50422d33' : 'none', opacity: f.is_active ? 1 : 0.5 }}>
            <div style={{ fontWeight: 700 }}>{f.name}{!f.is_active && <span style={{ fontSize: 11, marginLeft: 6 }}>停用</span>}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: f.balance < 0 ? C.danger : C.primary, margin: '4px 0' }}>${fmt(f.balance)}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{f.keeper_name ? `保管 ${f.keeper_name}・` : ''}{f.last_date ? `最後 ${f.last_date}` : '還沒有紀錄'}</div>
          </div>
        ))}
        {!funds.length && <div style={{ ...card, color: C.muted }}>還沒有金庫，先按「＋ 新增金庫」（例：總公司零用金）。</div>}
      </div>

      {fundForm && <FundForm f={fundForm} stores={stores} onClose={() => setFundForm(null)} onSaved={async (x) => { setFundForm(null); await loadFunds(); if (x && x.id) setFundId(x.id); }} />}
      {fund && <FundBook key={fund.id} fund={fund} stores={stores} subjects={subjects} storeName={storeName} onChanged={loadFunds} onEditFund={() => setFundForm(fund)} />}
    </div>
  );
}

function FundForm({ f, stores, onClose, onSaved }) {
  const [v, setV] = useState({ name: f.name || '', keeper_name: f.keeper_name || '', store_erpid: f.store_erpid || '', note: f.note || '', is_active: f.is_active !== false });
  const [msg, setMsg] = useState('');
  const save = async () => {
    try { const r = f.id ? await pettyCashApi.updateFund(f.id, v) : await pettyCashApi.createFund(v); onSaved(r.data); } catch (e) { setMsg(errMsg(e)); }
  };
  return (
    <div style={card}>
      <b>{f.id ? '修改金庫' : '新增金庫'}</b>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
        <input style={{ ...input, width: 200 }} placeholder="金庫名稱（例：總公司零用金）" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        <input style={{ ...input, width: 140 }} placeholder="保管人" value={v.keeper_name} onChange={(e) => setV({ ...v, keeper_name: e.target.value })} />
        <select style={input} value={v.store_erpid} onChange={(e) => setV({ ...v, store_erpid: e.target.value })} title="開帳時預設的門市／部門">
          <option value="">開帳預設門市／部門（可不選）</option>
          {stores.map((s) => <option key={s.store_erpid} value={s.store_erpid}>{s.store_name}</option>)}
        </select>
        <input style={{ ...input, minWidth: 160 }} placeholder="備註" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
        {f.id && <label style={{ fontSize: 13 }}><input type="checkbox" checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} /> 使用中</label>}
        <button style={btn(C.primary)} onClick={save}>儲存</button>
        <button style={ghost} onClick={onClose}>取消</button>
      </div>
      {msg && <div style={{ color: C.danger, fontSize: 13, marginTop: 6 }}>{msg}</div>}
    </div>
  );
}

function FundBook({ fund, stores, subjects, storeName, onChanged, onEditFund }) {
  const [filter, setFilter] = useState({ from: '', to: '', direction: '', keyword: '', include_void: false });
  const [data, setData] = useState({ rows: [], opening_balance: 0, balance: 0 });
  const [adding, setAdding] = useState(null);   // 'in' | 'out'
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      const p = { fund_id: fund.id };
      for (const k of ['from', 'to', 'direction', 'keyword']) if (filter[k]) p[k] = filter[k];
      if (filter.include_void) p.include_void = '1';
      const r = await pettyCashApi.txns(p);
      setData(r.data || { rows: [] });
    } catch (e) { setMsg(errMsg(e)); }
  }, [fund.id, filter]);
  useEffect(() => { load(); }, [load]);

  const sum = useMemo(() => {
    const live = data.rows.filter((t) => !t.void_at);
    return { in: live.filter((t) => t.direction === 'in').reduce((s, t) => s + Number(t.amount), 0), out: live.filter((t) => t.direction === 'out').reduce((s, t) => s + Number(t.amount), 0) };
  }, [data]);

  const exportCsv = () => {
    const head = ['日期', '收支', '類別', '用途／說明', '對象', '單據號碼', '經手人', '收入', '支出', '餘額', '開帳', '狀態'];
    const lines = [...data.rows].reverse().map((t) => [t.txn_date, t.direction === 'in' ? '收入' : '支出', t.category || '', t.description || '', t.payee || '', t.receipt_no || '', t.handled_by || '',
      t.direction === 'in' ? t.amount : '', t.direction === 'out' ? t.amount : '', t.balance_after ?? '',
      t.post_to_ledger ? `${t.report_ym} ` + (t.allocations || []).map((a) => `${storeName(a.store_erpid)} ${a.amount}`).join('／') : '', t.void_at ? `作廢：${t.void_reason || ''}` : '']);
    const csv = [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `零用金_${fund.name}_${today()}.csv`; a.click();
  };

  return (
    <div>
      <div style={{ ...card, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <b style={{ fontSize: 16 }}>{fund.name}</b>
        <span style={{ fontSize: 13, color: C.muted }}>餘額 <b style={{ color: fund.balance < 0 ? C.danger : C.primary }}>${fmt(fund.balance)}</b></span>
        <button style={{ ...ghost, padding: '4px 10px' }} onClick={onEditFund}>修改金庫</button>
        <div style={{ flex: 1 }} />
        <button style={btn(C.in)} onClick={() => setAdding('in')}>＋ 收入</button>
        <button style={btn(C.out)} onClick={() => setAdding('out')}>－ 支出</button>
      </div>

      {adding && <TxnForm fund={fund} direction={adding} stores={stores} subjects={subjects} onClose={() => setAdding(null)}
        onSaved={(m) => { setAdding(null); setMsg(m); load(); onChanged(); }} />}
      {msg && <div style={{ ...card, color: msg.startsWith('⚠') ? C.danger : C.ok, padding: 10 }}>{msg}</div>}

      <div style={card}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <input type="date" style={input} value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
          <span>～</span>
          <input type="date" style={input} value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
          <select style={input} value={filter.direction} onChange={(e) => setFilter({ ...filter, direction: e.target.value })}>
            <option value="">收入＋支出</option><option value="in">只看收入</option><option value="out">只看支出</option>
          </select>
          <input style={{ ...input, width: 160 }} placeholder="搜尋用途／對象／單據" value={filter.keyword} onChange={(e) => setFilter({ ...filter, keyword: e.target.value })} />
          <label style={{ fontSize: 12, color: C.muted }}><input type="checkbox" checked={filter.include_void} onChange={(e) => setFilter({ ...filter, include_void: e.target.checked })} /> 含作廢</label>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13 }}>
            {filter.from && <>期初 ${fmt(data.opening_balance)}｜</>}收入 <b style={{ color: C.in }}>${fmt(sum.in)}</b>｜支出 <b style={{ color: C.out }}>${fmt(sum.out)}</b>
          </span>
          <button style={{ ...ghost, padding: '5px 10px' }} onClick={exportCsv}>匯出 CSV</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>{['日期', '類別', '用途／說明', '對象', '收入', '支出', '餘額', '開帳', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {data.rows.map((t) => (
              <TxnRow key={t.id} t={t} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} storeName={storeName}
                onChanged={(m) => { setMsg(m); load(); onChanged(); }} />
            ))}
            {!data.rows.length && <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: C.muted, padding: 24 }}>沒有紀錄</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = { padding: '8px 8px', textAlign: 'left', fontWeight: 600, background: '#f7fafc', borderBottom: '2px solid #e2e8f0', color: '#4a5568', whiteSpace: 'nowrap' };
const td = { padding: '8px 8px', borderBottom: '1px solid #edf2f7', verticalAlign: 'top' };

function TxnRow({ t, open, onToggle, storeName, onChanged }) {
  const [files, setFiles] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ed, setEd] = useState(null);
  const loadFiles = useCallback(() => pettyCashApi.files(t.id).then((r) => setFiles(r.data || [])).catch(() => setFiles([])), [t.id]);
  useEffect(() => { if (open && files === null) loadFiles(); }, [open, files, loadFiles]);
  const isVoid = !!t.void_at;
  const doVoid = async () => {
    const reason = window.prompt(`作廢這筆${t.direction === 'in' ? '收入' : '支出'} $${fmt(t.amount)}？${t.post_to_ledger ? '\n（列入月報的開帳也會一起作廢）' : ''}\n請輸入原因：`);
    if (!reason) return;
    try { await pettyCashApi.voidTxn(t.id, reason); onChanged('已作廢'); } catch (e) { onChanged('⚠ ' + errMsg(e)); }
  };
  const up = async (e) => {
    const fs = [...(e.target.files || [])]; if (!fs.length) return;
    setBusy(true);
    try { await pettyCashApi.uploadFiles(t.id, fs); await loadFiles(); } catch (er) { alert(errMsg(er)); } finally { setBusy(false); e.target.value = ''; }
  };
  const saveEd = async () => {
    try { await pettyCashApi.updateTxn(t.id, ed); setEd(null); onChanged('已更新'); } catch (e) { onChanged('⚠ ' + errMsg(e)); }
  };
  return (
    <>
      <tr style={{ opacity: isVoid ? 0.45 : 1, textDecoration: isVoid ? 'line-through' : 'none', cursor: 'pointer', background: open ? '#fbf8f3' : undefined }} onClick={onToggle}>
        <td style={td}>{t.txn_date}</td>
        <td style={td}>{t.category || ''}</td>
        <td style={td}>{t.description || ''}{t.receipt_no ? <div style={{ fontSize: 11, color: C.muted }}>單據 {t.receipt_no}</div> : null}</td>
        <td style={td}>{t.payee || ''}</td>
        <td style={{ ...td, color: C.in, textAlign: 'right' }}>{t.direction === 'in' ? fmt(t.amount) : ''}</td>
        <td style={{ ...td, color: C.out, textAlign: 'right' }}>{t.direction === 'out' ? fmt(t.amount) : ''}</td>
        <td style={{ ...td, textAlign: 'right' }}>{t.balance_after != null ? fmt(t.balance_after) : ''}</td>
        <td style={td}>{t.post_to_ledger ? <span style={{ fontSize: 11, background: '#bee3f8', color: '#2a4365', borderRadius: 4, padding: '1px 6px' }}>已開帳 {t.report_ym}</span> : t.direction === 'out' ? <span style={{ fontSize: 11, color: C.muted }}>未開帳</span> : ''}</td>
        <td style={{ ...td, whiteSpace: 'nowrap' }}>{isVoid ? <span style={{ fontSize: 11, color: C.danger, textDecoration: 'none' }}>作廢</span> : '▾'}</td>
      </tr>
      {open && (
        <tr><td colSpan={9} style={{ ...td, background: '#fbf8f3' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
            <div style={{ minWidth: 260 }}>
              <div>經手人：{t.handled_by || '—'}｜登記：{t.created_by || '—'} {String(t.created_at || '').slice(0, 16).replace('T', ' ')}</div>
              {isVoid && <div style={{ color: C.danger }}>作廢：{t.void_reason}（{t.void_by}）</div>}
              {t.post_to_ledger && (
                <div style={{ marginTop: 6 }}>
                  <b>開帳（列入門市月報）</b>
                  {(t.ledger_entries || []).map((e) => (
                    <div key={e.id} style={{ color: e.void_at ? C.muted : undefined }}>・{storeName(e.store_erpid)}｜{e.report_ym}｜${fmt(e.amount)}{e.void_at ? '（已作廢）' : ''}</div>
                  ))}
                </div>
              )}
              {!isVoid && !ed && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <button style={{ ...ghost, padding: '4px 10px' }} onClick={() => setEd({ txn_date: t.txn_date, category: t.category || '', description: t.description || '', payee: t.payee || '', receipt_no: t.receipt_no || '', handled_by: t.handled_by || '', ...(t.post_to_ledger ? {} : { amount: t.amount }) })}>修改</button>
                  <button style={{ ...ghost, padding: '4px 10px', color: C.danger }} onClick={doVoid}>作廢</button>
                </div>
              )}
              {ed && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <input type="date" style={input} value={ed.txn_date} onChange={(e) => setEd({ ...ed, txn_date: e.target.value })} />
                  {ed.amount !== undefined && <input style={{ ...input, width: 90 }} value={ed.amount} onChange={(e) => setEd({ ...ed, amount: e.target.value })} />}
                  <input style={{ ...input, width: 100 }} placeholder="類別" value={ed.category} onChange={(e) => setEd({ ...ed, category: e.target.value })} />
                  <input style={{ ...input, width: 180 }} placeholder="用途／說明" value={ed.description} onChange={(e) => setEd({ ...ed, description: e.target.value })} />
                  <input style={{ ...input, width: 120 }} placeholder="對象" value={ed.payee} onChange={(e) => setEd({ ...ed, payee: e.target.value })} />
                  <input style={{ ...input, width: 110 }} placeholder="單據號碼" value={ed.receipt_no} onChange={(e) => setEd({ ...ed, receipt_no: e.target.value })} />
                  <input style={{ ...input, width: 90 }} placeholder="經手人" value={ed.handled_by} onChange={(e) => setEd({ ...ed, handled_by: e.target.value })} />
                  <button style={btn(C.primary)} onClick={saveEd}>存</button>
                  <button style={ghost} onClick={() => setEd(null)}>取消</button>
                  {t.post_to_ledger && <div style={{ width: '100%', fontSize: 11, color: C.muted }}>已開帳的支出不能改金額；要改請作廢後重新登記。</div>}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <b>單據照片</b>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                {(files || []).map((f) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                    {f.kind === 'image' && f.url ? <img src={f.url} alt={f.name} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }} /> : `📄 ${f.name}`}
                  </a>
                ))}
                {files && !files.length && <span style={{ fontSize: 12, color: C.muted }}>還沒有</span>}
              </div>
              {!isVoid && <label style={{ ...ghost, display: 'inline-block', marginTop: 6, padding: '4px 10px' }}>
                {busy ? '上傳中…' : '＋ 上傳照片／PDF'}
                <input type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }} onChange={up} disabled={busy} />
              </label>}
            </div>
          </div>
        </td></tr>
      )}
    </>
  );
}

function TxnForm({ fund, direction, stores, subjects, onClose, onSaved }) {
  const isOut = direction === 'out';
  const [f, setF] = useState({ txn_date: today(), amount: '', category: '', description: '', payee: '', receipt_no: '', handled_by: fund.keeper_name || '',
    post_to_ledger: false, report_ym: today().slice(0, 7) });
  const [allocs, setAllocs] = useState([{ store_erpid: fund.store_erpid || '', subject_id: '', amount: '' }]);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const total = Number(f.amount) || 0;
  const allocSum = allocs.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  // 只有一列時，分配金額自動＝支出金額
  const allocsEff = allocs.length === 1 ? [{ ...allocs[0], amount: allocs[0].amount === '' ? total : allocs[0].amount }] : allocs;
  const effSum = allocsEff.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const setA = (i, patch) => setAllocs(allocs.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const save = async () => {
    setMsg('');
    if (!(total > 0)) { setMsg('請填金額'); return; }
    if (isOut && !f.description.trim() && !f.category) { setMsg('支出請寫用途'); return; }
    if (isOut && f.post_to_ledger) {
      if (allocsEff.some((a) => !a.store_erpid || !a.subject_id || !(Number(a.amount) > 0))) { setMsg('開帳的每一列都要選門市、會計科目、金額'); return; }
      if (Math.abs(effSum - total) > 0.5) { setMsg(`分配合計 $${fmt(effSum)} 不等於支出 $${fmt(total)}`); return; }
    }
    setBusy(true);
    try {
      const body = { ...f, fund_id: fund.id, direction, amount: total, post_to_ledger: isOut && f.post_to_ledger };
      if (body.post_to_ledger) body.allocations = allocsEff.map((a) => ({ ...a, amount: Number(a.amount) }));
      const r = await pettyCashApi.createTxn(body);
      if (files.length && r.data && r.data.id) { try { await pettyCashApi.uploadFiles(r.data.id, files); } catch (e) { /* 照片失敗不擋 */ } }
      const sh = r.data && r.data.posting && r.data.posting.shifted && r.data.posting.shifted.length ? `（${r.data.posting.shifted.join('；')}）` : '';
      onSaved(`已登記${isOut ? '支出' : '收入'} $${fmt(total)}${body.post_to_ledger ? '，已列入門市月報' + sh : ''}`);
    } catch (e) { setMsg(errMsg(e)); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ ...card, borderColor: isOut ? C.out : C.in }}>
      <b style={{ color: isOut ? C.out : C.in }}>{isOut ? '－ 登記支出' : '＋ 登記收入'}</b>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
        <input type="date" style={input} value={f.txn_date} onChange={set('txn_date')} />
        <input style={{ ...input, width: 110, fontWeight: 700 }} placeholder="金額" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') })} />
        <input style={{ ...input, width: 110 }} list={`pc-cat-${direction}`} placeholder="類別" value={f.category} onChange={set('category')} />
        <datalist id={`pc-cat-${direction}`}>{(isOut ? OUT_CATS : IN_CATS).map((c) => <option key={c} value={c} />)}</datalist>
        <input style={{ ...input, minWidth: 200, flex: 1 }} placeholder={isOut ? '用途（例：門市清潔用品）' : '說明（例：會計撥補 11 月零用金）'} value={f.description} onChange={set('description')} />
        <input style={{ ...input, width: 130 }} placeholder={isOut ? '付給誰（店家）' : '從哪來'} value={f.payee} onChange={set('payee')} />
        {isOut && <input style={{ ...input, width: 120 }} placeholder="發票／收據號碼" value={f.receipt_no} onChange={set('receipt_no')} />}
        <input style={{ ...input, width: 100 }} placeholder="經手人" value={f.handled_by} onChange={set('handled_by')} />
      </div>

      {isOut && (
        <div style={{ marginTop: 10, padding: 10, background: '#f7fafc', borderRadius: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            <input type="checkbox" checked={f.post_to_ledger} onChange={(e) => setF({ ...f, post_to_ledger: e.target.checked })} /> 同步開帳（列入門市月報）
          </label>
          {f.post_to_ledger && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: 13 }}>
                入帳月份 <input type="month" style={input} value={f.report_ym} onChange={set('report_ym')} />
                <span style={{ fontSize: 11, color: C.muted }}>（那個月已關帳會自動順延到下個月）</span>
              </div>
              {allocs.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  <select style={{ ...input, width: 150 }} value={a.store_erpid} onChange={(e) => setA(i, { store_erpid: e.target.value })}>
                    <option value="">— 開帳門市／部門 —</option>
                    <optgroup label="門市">{stores.filter((s) => s.kind === 'store').map((s) => <option key={s.store_erpid} value={s.store_erpid}>{s.store_name}</option>)}</optgroup>
                    <optgroup label="部門">{stores.filter((s) => s.kind !== 'store').map((s) => <option key={s.store_erpid} value={s.store_erpid}>{s.store_name}</option>)}</optgroup>
                  </select>
                  <select style={{ ...input, minWidth: 200 }} value={a.subject_id} onChange={(e) => setA(i, { subject_id: e.target.value })}>
                    <option value="">— 會計科目 —</option>
                    {Object.entries(subjects.reduce((o, s) => { (o[s.ledger_name] = o[s.ledger_name] || []).push(s); return o; }, {})).map(([g, list]) => (
                      <optgroup key={g} label={g}>{list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</optgroup>
                    ))}
                  </select>
                  <input style={{ ...input, width: 100 }} placeholder={allocs.length === 1 ? `${fmt(total)}` : '金額'} value={a.amount} onChange={(e) => setA(i, { amount: e.target.value.replace(/[^\d.]/g, '') })} />
                  {allocs.length > 1 && <button style={{ ...ghost, padding: '3px 8px' }} onClick={() => setAllocs(allocs.filter((_, j) => j !== i))}>✕</button>}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
                <button style={{ ...ghost, padding: '3px 10px' }} onClick={() => setAllocs([...allocs.map((a) => (allocs.length === 1 && a.amount === '' ? { ...a, amount: total || '' } : a)), { store_erpid: '', subject_id: allocs[allocs.length - 1].subject_id, amount: '' }])}>＋ 拆給另一間店</button>
                {allocs.length > 1 && <span style={{ color: Math.abs(allocSum - total) < 0.5 ? C.ok : C.danger }}>分配合計 ${fmt(allocSum)}／支出 ${fmt(total)}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <label style={{ ...ghost, display: 'inline-block', padding: '5px 10px' }}>
          📎 單據照片{files.length ? `（${files.length}）` : ''}
          <input type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }} onChange={(e) => setFiles([...(e.target.files || [])])} />
        </label>
        <div style={{ flex: 1 }} />
        {msg && <span style={{ color: C.danger, fontSize: 13 }}>{msg}</span>}
        <button style={ghost} onClick={onClose}>取消</button>
        <button style={btn(isOut ? C.out : C.in)} disabled={busy} onClick={save}>{busy ? '儲存中…' : '儲存'}</button>
      </div>
    </div>
  );
}
