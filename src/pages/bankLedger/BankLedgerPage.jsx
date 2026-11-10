// pages/bankLedger/BankLedgerPage.jsx —— 金流 → 銀存彙整（2026-11）
// 匯入各銀行網銀交易明細（CSV／XLS）→ 自動登錄、重複自動去掉、同期間重匯自動校正 → 分類／門市 → 門市存入彙整
import { useCallback, useEffect, useMemo, useState } from 'react';
import { bankLedgerApi } from '../../services/api';

const C = { primary: '#50422d', bg: '#faf8f5', border: '#e0d5c8', muted: '#8a7a66', ok: '#2d6a4f', danger: '#c53030', in: '#2f855a', out: '#c05621', warn: '#b7791f' };
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 };
const btn = (bg, fg) => ({ border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600, background: bg, color: fg || '#fff' });
const ghost = btn('#edf2f7', '#4a5568');
const input = { border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', fontSize: 13, boxSizing: 'border-box' };
const th = { padding: '7px 8px', textAlign: 'left', fontWeight: 600, background: '#f7fafc', borderBottom: '2px solid #e2e8f0', color: '#4a5568', whiteSpace: 'nowrap', fontSize: 12 };
const td = { padding: '6px 8px', borderBottom: '1px solid #edf2f7', verticalAlign: 'top', fontSize: 13 };
const fmt = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('zh-TW', { maximumFractionDigits: 2 }));
const errMsg = (e) => (e && (e.message || e.error)) || '失敗';
const thisYm = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7);
const monthRange = (ym) => { const [y, m] = ym.split('-').map(Number); return { from: `${ym}-01`, to: `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}` }; };

export default function BankLedgerPage() {
  const [tab, setTab] = useState('import');
  const [meta, setMeta] = useState({ categories: [], stores: [] });
  const [accounts, setAccounts] = useState([]);
  const [err, setErr] = useState('');
  const [txFilter, setTxFilter] = useState(null);   // 從別的分頁跳到明細時帶的篩選

  const loadAccounts = useCallback(() => bankLedgerApi.accounts().then((r) => setAccounts(r.data || [])).catch((e) => setErr(errMsg(e))), []);
  useEffect(() => {
    bankLedgerApi.meta().then((r) => setMeta(r.data || { categories: [], stores: [] })).catch((e) => setErr(errMsg(e)));
    loadAccounts();
  }, [loadAccounts]);

  const tabs = [['import', '📥 匯入'], ['accounts', '🏦 帳戶'], ['txns', '📄 交易明細'], ['stores', '🏪 門市存入'], ['rules', '⚙ 分類規則']];
  return (
    <div style={{ padding: 20, background: C.bg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, color: C.primary }}>🏦 銀存彙整</h2>
        <span style={{ fontSize: 12, color: C.muted }}>匯入網銀交易明細 → 自動登錄、重複自動去掉、同期間重匯自動校正</span>
      </div>
      <div style={{ display: 'flex', gap: 4, borderBottom: `2px solid ${C.border}`, marginBottom: 14, flexWrap: 'wrap' }}>
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); if (k !== 'txns') setTxFilter(null); }} style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14,
            fontWeight: tab === k ? 700 : 500, color: tab === k ? C.primary : C.muted, borderBottom: tab === k ? `3px solid ${C.primary}` : '3px solid transparent', marginBottom: -2 }}>{l}</button>
        ))}
      </div>
      {err && <div style={{ ...card, color: C.danger }}>⚠ {err}</div>}
      {tab === 'import' && <ImportTab accounts={accounts} onDone={loadAccounts} />}
      {tab === 'accounts' && <AccountsTab accounts={accounts} reload={loadAccounts} onOpen={(a) => { setTxFilter({ account_id: a.id }); setTab('txns'); }} />}
      {tab === 'txns' && <TxnsTab key={JSON.stringify(txFilter)} accounts={accounts} meta={meta} preset={txFilter} />}
      {tab === 'stores' && <StoresTab meta={meta} onOpen={(f) => { setTxFilter(f); setTab('txns'); }} />}
      {tab === 'rules' && <RulesTab accounts={accounts} meta={meta} />}
    </div>
  );
}

// ═══ 匯入 ═══
function ImportTab({ accounts, onDone }) {
  const [items, setItems] = useState([]);   // { file, state, result, error, need, pick }
  const [hist, setHist] = useState([]);
  const loadHist = useCallback(() => bankLedgerApi.imports().then((r) => setHist(r.data || [])).catch(() => {}), []);
  useEffect(() => { loadHist(); }, [loadHist]);

  const setItem = (i, p) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const run = async (i, file, accountId) => {
    setItem(i, { state: 'uploading', error: '' });
    try {
      const r = await bankLedgerApi.importFile(file, accountId);
      const d = r.data || {};
      if (d.need_account) setItem(i, { state: 'need', need: d, pick: d.candidates?.[0]?.id || '' });
      else { setItem(i, { state: 'done', result: d }); onDone(); loadHist(); }
    } catch (e) { setItem(i, { state: 'error', error: errMsg(e) }); }
  };
  const addFiles = async (list) => {
    const fs = [...(list || [])];
    if (!fs.length) return;
    const start = items.length;
    setItems((xs) => [...xs, ...fs.map((f) => ({ file: f, state: 'waiting' }))]);
    for (let k = 0; k < fs.length; k++) await run(start + k, fs[k], null);   // 一個一個來，避免同帳戶同時寫
  };
  const createAndRun = async (i, it) => {
    const name = window.prompt(`這個檔案沒有帳號，請幫這個帳戶取個名字（例：${it.need.bank} 公司戶）`, `${it.need.bank} `);
    if (!name) return;
    const no = window.prompt('帳號（可不填；之後可在「帳戶」分頁補）', '') || '';
    try { const a = await bankLedgerApi.createAccount({ bank_name: it.need.bank, alias: name.trim(), account_no: no.trim() || null }); onDone(); await run(i, it.file, a.data.id); }
    catch (e) { setItem(i, { error: errMsg(e) }); }
  };
  const undo = async (h) => {
    if (!window.confirm(`撤銷這次匯入？\n${h.account?.alias || ''}｜${h.file_name}\n這次新增的 ${h.rows_new} 筆會刪掉，這次校正掉的 ${h.rows_removed} 筆會還原。`)) return;
    try { await bankLedgerApi.undoImport(h.id); loadHist(); onDone(); } catch (e) { alert(errMsg(e)); }
  };

  return (
    <div>
      <div style={{ ...card, border: `2px dashed ${C.border}`, textAlign: 'center', padding: 24 }}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.primary }}>把網銀下載的交易明細檔拖進來，或</div>
        <label style={{ ...btn(C.primary), display: 'inline-block', marginTop: 10 }}>選擇檔案（可多選）
          <input type="file" multiple accept=".csv,.xls,.xlsx" style={{ display: 'none' }} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </label>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 1.7 }}>
          目前認得：中國信託（個人戶／公司戶）、元大、郵局、合作金庫、高雄銀行；其他銀行有「日期／支出／存入／餘額」欄位一般也讀得到。<br />
          同一段期間重複匯入沒關係：重複的自動略過；這次檔案裡沒有、但系統有的會自動校正掉（可還原）。
        </div>
      </div>

      {items.length > 0 && (
        <div style={card}>
          <b>這次匯入</b>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
            <thead><tr>{['檔案', '帳戶', '期間', '結果'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td style={td}>{it.file.name}</td>
                  <td style={td}>{it.result?.account?.alias || (it.need ? it.need.bank : '')}</td>
                  <td style={td}>{it.result ? `${it.result.period_from}～${it.result.period_to}` : it.need ? `${it.need.period_from}～${it.need.period_to}` : ''}</td>
                  <td style={td}>
                    {it.state === 'waiting' && <span style={{ color: C.muted }}>排隊中…</span>}
                    {it.state === 'uploading' && <span style={{ color: C.muted }}>匯入中…</span>}
                    {it.state === 'error' && <span style={{ color: C.danger }}>✕ {it.error}</span>}
                    {it.state === 'done' && <ImportResult r={it.result} />}
                    {it.state === 'need' && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ color: C.warn }}>這個檔案沒有帳號（{it.need.rows} 筆），請選是哪個帳戶：</span>
                        <select style={input} value={it.pick} onChange={(e) => setItem(i, { pick: e.target.value })}>
                          <option value="">— 選帳戶 —</option>
                          {accounts.filter((a) => a.is_active !== false).map((a) => <option key={a.id} value={a.id}>{a.alias}{a.account_no ? `（${a.account_no}）` : ''}</option>)}
                        </select>
                        <button style={btn(C.primary)} disabled={!it.pick} onClick={() => run(i, it.file, it.pick)}>用這個帳戶匯入</button>
                        <button style={ghost} onClick={() => createAndRun(i, it)}>＋ 新帳戶</button>
                        {it.error && <span style={{ color: C.danger }}>{it.error}</span>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={card}>
        <b>匯入紀錄</b>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <thead><tr>{['時間', '帳戶', '檔案', '期間', '新增', '重複略過', '校正掉', '還原', '餘額接不起來', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {hist.map((h) => (
              <tr key={h.id} style={{ opacity: h.undone_at ? 0.45 : 1 }}>
                <td style={td}>{String(h.created_at).slice(0, 16).replace('T', ' ')}<div style={{ fontSize: 11, color: C.muted }}>{h.created_by}</div></td>
                <td style={td}>{h.account?.alias}</td>
                <td style={td}>{h.file_name}</td>
                <td style={td}>{h.period_from}～{h.period_to}</td>
                <td style={td}>{h.rows_new}</td><td style={td}>{h.rows_dup}</td>
                <td style={{ ...td, color: h.rows_removed ? C.warn : undefined }}>{h.rows_removed}</td><td style={td}>{h.rows_restored}</td>
                <td style={{ ...td, color: (h.balance_breaks || []).length ? C.warn : undefined }}>{(h.balance_breaks || []).length || ''}</td>
                <td style={td}>{h.undone_at ? '已撤銷' : <button style={{ ...ghost, padding: '3px 8px' }} onClick={() => undo(h)}>撤銷</button>}</td>
              </tr>
            ))}
            {!hist.length && <tr><td colSpan={10} style={{ ...td, color: C.muted, textAlign: 'center' }}>還沒有匯入過</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function ImportResult({ r }) {
  const br = r.balance_breaks || [];
  return (
    <div>
      <span style={{ color: C.ok }}>✓ 新增 {r.rows_new} 筆</span>
      {r.rows_dup > 0 && <span style={{ color: C.muted }}>｜重複略過 {r.rows_dup}</span>}
      {r.rows_removed > 0 && <span style={{ color: C.warn }}>｜校正掉 {r.rows_removed}（系統有、這次檔案沒有）</span>}
      {r.rows_restored > 0 && <span>｜還原 {r.rows_restored}</span>}
      {br.length > 0 && (
        <div style={{ fontSize: 12, color: C.warn, marginTop: 4 }}>
          ⚠ 餘額接不起來 {br.length} 處（可能漏匯某段期間，或銀行把多筆壓縮成一筆）：
          {br.slice(0, 3).map((b) => `${b.date} ${b.summary || ''} 差 ${fmt(b.diff)}`).join('；')}
        </div>
      )}
    </div>
  );
}

// ═══ 帳戶 ═══
function AccountsTab({ accounts, reload, onOpen }) {
  const [ed, setEd] = useState(null);
  const [msg, setMsg] = useState('');
  const save = async () => {
    try { if (ed.id) await bankLedgerApi.updateAccount(ed.id, ed); else await bankLedgerApi.createAccount(ed); setEd(null); setMsg('已儲存'); reload(); } catch (e) { setMsg('⚠ ' + errMsg(e)); }
  };
  const total = accounts.filter((a) => a.is_active !== false).reduce((s, a) => s + Number(a.balance || 0), 0);
  return (
    <div>
      <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <b>帳戶 {accounts.filter((a) => a.is_active !== false).length} 個</b>
        <span style={{ fontSize: 13, color: C.muted }}>最新餘額合計 <b style={{ color: C.primary, fontSize: 16 }}>${fmt(total)}</b>（各帳戶最後一筆交易的餘額）</span>
        <div style={{ flex: 1 }} />
        {msg && <span style={{ fontSize: 13, color: msg.startsWith('⚠') ? C.danger : C.ok }}>{msg}</span>}
        <button style={btn(C.primary)} onClick={() => setEd({ bank_name: '', alias: '', account_no: '', holder: '', note: '' })}>＋ 新增帳戶</button>
      </div>
      {ed && (
        <div style={card}>
          <b>{ed.id ? '修改帳戶' : '新增帳戶'}</b>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <input style={{ ...input, width: 120 }} placeholder="銀行" value={ed.bank_name || ''} onChange={(e) => setEd({ ...ed, bank_name: e.target.value })} />
            <input style={{ ...input, width: 180 }} placeholder="顯示名稱（例：元大 總公司）" value={ed.alias || ''} onChange={(e) => setEd({ ...ed, alias: e.target.value })} />
            <input style={{ ...input, width: 170 }} placeholder="帳號" value={ed.account_no || ''} onChange={(e) => setEd({ ...ed, account_no: e.target.value })} />
            <input style={{ ...input, width: 120 }} placeholder="戶名" value={ed.holder || ''} onChange={(e) => setEd({ ...ed, holder: e.target.value })} />
            <input style={{ ...input, minWidth: 200, flex: 1 }} placeholder="備註（例：哪些門市在用）" value={ed.note || ''} onChange={(e) => setEd({ ...ed, note: e.target.value })} />
            {ed.id && <label style={{ fontSize: 13 }}><input type="checkbox" checked={ed.is_active !== false} onChange={(e) => setEd({ ...ed, is_active: e.target.checked })} /> 使用中</label>}
            <button style={btn(C.primary)} onClick={save}>儲存</button>
            <button style={ghost} onClick={() => setEd(null)}>取消</button>
          </div>
        </div>
      )}
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['名稱', '銀行', '帳號', '戶名', '最後交易日', '最新餘額', '筆數', '備註', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} style={{ opacity: a.is_active === false ? 0.5 : 1 }}>
                <td style={td}><a style={{ color: '#2b6cb0', cursor: 'pointer' }} onClick={() => onOpen(a)}>{a.alias}</a></td>
                <td style={td}>{a.bank_name}</td><td style={td}>{a.account_no || <span style={{ color: C.muted }}>—</span>}</td>
                <td style={td}>{a.holder || ''}</td><td style={td}>{a.last_date || ''}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmt(a.balance)}</td><td style={td}>{a.txn_count}</td>
                <td style={{ ...td, fontSize: 12, color: C.muted }}>{a.note || ''}</td>
                <td style={td}><button style={{ ...ghost, padding: '3px 8px' }} onClick={() => setEd({ ...a })}>改</button></td>
              </tr>
            ))}
            {!accounts.length && <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: C.muted }}>還沒有帳戶；匯入有帳號的檔案會自動建立</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══ 交易明細 ═══
function TxnsTab({ accounts, meta, preset }) {
  const mr = monthRange(thisYm());
  const [f, setF] = useState({ account_id: '', from: mr.from, to: mr.to, direction: '', category: '', store_erpid: '', keyword: '', status: 'active', ...(preset || {}) });
  const [data, setData] = useState({ rows: [], total: 0, sum_in: 0, sum_out: 0 });
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(new Set());
  const [bulk, setBulk] = useState({ category: '', store_erpid: '' });
  const [msg, setMsg] = useState('');
  const [rule, setRule] = useState(null);   // 記住規則
  const storeName = useMemo(() => Object.fromEntries((meta.stores || []).map((s) => [s.store_erpid, s.store_name])), [meta]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = {}; for (const [k, v] of Object.entries(f)) if (v) p[k] = v;
      const r = await bankLedgerApi.txns(p); setData(r.data || { rows: [] }); setSel(new Set());
    } catch (e) { setMsg('⚠ ' + errMsg(e)); } finally { setLoading(false); }
  }, [f]);
  useEffect(() => { load(); }, [load]);

  const patch = async (t, body) => {
    try { const r = await bankLedgerApi.updateTxn(t.id, body); setData((d) => ({ ...d, rows: d.rows.map((x) => (x.id === t.id ? { ...x, ...r.data.txn } : x)) })); if (r.data.rule) { setMsg(`已記住規則，套用到 ${r.data.rule.applied || 0} 筆`); load(); } }
    catch (e) { setMsg('⚠ ' + errMsg(e)); }
  };
  const doBulk = async () => {
    const body = {}; if (bulk.category) body.category = bulk.category; if (bulk.store_erpid) body.store_erpid = bulk.store_erpid === '__clear' ? null : bulk.store_erpid;
    if (!Object.keys(body).length) return;
    try { await bankLedgerApi.bulk([...sel], body); setMsg(`已更新 ${sel.size} 筆`); load(); } catch (e) { setMsg('⚠ ' + errMsg(e)); }
  };
  const storeOpts = (
    <>
      <optgroup label="門市">{(meta.stores || []).filter((s) => s.kind === 'store').map((s) => <option key={s.store_erpid} value={s.store_erpid}>{s.store_name}</option>)}</optgroup>
      <optgroup label="部門">{(meta.stores || []).filter((s) => s.kind !== 'store').map((s) => <option key={s.store_erpid} value={s.store_erpid}>{s.store_name}</option>)}</optgroup>
    </>
  );
  const exportCsv = () => {
    const head = ['帳戶', '日期', '時間', '摘要', '備註', '註記', '支出', '存入', '餘額', '類別', '門市', '說明'];
    const lines = data.rows.map((t) => [t.account?.alias, t.txn_date, t.txn_time || '', t.summary, t.memo, t.memo2, t.out_amt || '', t.in_amt || '', t.balance, t.category, storeName[t.store_erpid] || '', t.note]);
    const csv = [head, ...lines].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = `銀存明細_${f.from}_${f.to}.csv`; a.click();
  };

  return (
    <div>
      <div style={{ ...card, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={input} value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value })}>
          <option value="">全部帳戶</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.alias}</option>)}
        </select>
        <input type="date" style={input} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />～
        <input type="date" style={input} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        <select style={input} value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}><option value="">存入＋支出</option><option value="in">只看存入</option><option value="out">只看支出</option></select>
        <select style={input} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">全部類別</option><option value="__none">（未分類）</option>{meta.categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select style={input} value={f.store_erpid} onChange={(e) => setF({ ...f, store_erpid: e.target.value })}><option value="">全部門市</option><option value="__none">（沒標門市）</option>{storeOpts}</select>
        <input style={{ ...input, width: 140 }} placeholder="搜尋備註／金額" value={f.keyword} onChange={(e) => setF({ ...f, keyword: e.target.value })} />
        <label style={{ fontSize: 12, color: C.muted }}><input type="checkbox" checked={f.status === 'removed'} onChange={(e) => setF({ ...f, status: e.target.checked ? 'removed' : 'active' })} /> 看已校正掉的</label>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 13 }}>{data.total} 筆｜存入 <b style={{ color: C.in }}>{fmt(data.sum_in)}</b>｜支出 <b style={{ color: C.out }}>{fmt(data.sum_out)}</b></span>
        <button style={{ ...ghost, padding: '5px 10px' }} onClick={exportCsv}>匯出 CSV</button>
      </div>
      {msg && <div style={{ ...card, padding: 8, color: msg.startsWith('⚠') ? C.danger : C.ok }}>{msg}</div>}
      {sel.size > 0 && (
        <div style={{ ...card, display: 'flex', gap: 6, alignItems: 'center', background: '#fffbeb' }}>
          已選 {sel.size} 筆 → 類別
          <select style={input} value={bulk.category} onChange={(e) => setBulk({ ...bulk, category: e.target.value })}><option value="">（不改）</option>{meta.categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          門市 <select style={input} value={bulk.store_erpid} onChange={(e) => setBulk({ ...bulk, store_erpid: e.target.value })}><option value="">（不改）</option><option value="__clear">（清掉門市）</option>{storeOpts}</select>
          <button style={btn(C.primary)} onClick={doBulk}>套用</button>
          <button style={ghost} onClick={() => setSel(new Set())}>取消選取</button>
        </div>
      )}
      {rule && (
        <div style={{ ...card, background: '#ebf8ff' }}>
          <b>記住規則</b>：摘要／備註含
          <input style={{ ...input, width: 200, margin: '0 6px' }} value={rule.pattern} onChange={(e) => setRule({ ...rule, pattern: e.target.value })} />
          的{Number(rule.t.in_amt) > 0 ? '存入' : '支出'} → 類別「{rule.category || rule.t.category}」{(rule.store_erpid || rule.t.store_erpid) ? `、門市「${storeName[rule.store_erpid || rule.t.store_erpid] || ''}」` : ''}
          <label style={{ fontSize: 12, marginLeft: 8 }}><input type="checkbox" checked={rule.all} onChange={(e) => setRule({ ...rule, all: e.target.checked })} /> 所有帳戶都適用</label>
          <button style={{ ...btn(C.primary), marginLeft: 8 }} onClick={() => { patch(rule.t, { category: rule.category || rule.t.category, store_erpid: rule.store_erpid ?? rule.t.store_erpid, remember: true, pattern: rule.pattern, rule_all_accounts: rule.all }); setRule(null); }}>記住並套用</button>
          <button style={{ ...ghost, marginLeft: 6 }} onClick={() => setRule(null)}>取消</button>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>之後匯入、以及現在還沒手動改過的交易，只要符合就自動套用。</div>
        </div>
      )}
      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={th}><input type="checkbox" checked={data.rows.length > 0 && sel.size === data.rows.length} onChange={(e) => setSel(e.target.checked ? new Set(data.rows.map((t) => t.id)) : new Set())} /></th>
            {['日期', '帳戶', '摘要／備註', '支出', '存入', '餘額', '類別', '門市', '說明', ''].map((h) => <th key={h} style={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={11} style={{ ...td, textAlign: 'center', color: C.muted }}>載入中…</td></tr>}
            {!loading && data.rows.map((t) => (
              <tr key={t.id} style={{ background: sel.has(t.id) ? '#fffbeb' : undefined, opacity: t.status === 'removed' ? 0.5 : 1 }}>
                <td style={td}><input type="checkbox" checked={sel.has(t.id)} onChange={(e) => { const s = new Set(sel); if (e.target.checked) s.add(t.id); else s.delete(t.id); setSel(s); }} /></td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{t.txn_date}{t.txn_time ? <div style={{ fontSize: 11, color: C.muted }}>{t.txn_time}</div> : null}</td>
                <td style={{ ...td, fontSize: 12 }}>{t.account?.alias}</td>
                <td style={td}><b style={{ fontWeight: 600 }}>{t.summary}</b> {t.memo}{t.memo2 ? <span style={{ color: C.muted }}>｜{t.memo2}</span> : null}{t.counter_account ? <div style={{ fontSize: 11, color: C.muted }}>{t.counter_account}</div> : null}</td>
                <td style={{ ...td, textAlign: 'right', color: C.out }}>{t.out_amt > 0 ? fmt(t.out_amt) : ''}</td>
                <td style={{ ...td, textAlign: 'right', color: C.in }}>{t.in_amt > 0 ? fmt(t.in_amt) : ''}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmt(t.balance)}</td>
                <td style={td}>
                  <select style={{ ...input, padding: '3px 4px', fontSize: 12 }} value={t.category || ''} onChange={(e) => patch(t, { category: e.target.value })}>
                    <option value="">—</option>{meta.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {t.tag_source && t.tag_source !== 'manual' && <div style={{ fontSize: 10, color: C.muted }}>{t.tag_source === 'rule' ? '規則' : '自動'}</div>}
                </td>
                <td style={td}>
                  <select style={{ ...input, padding: '3px 4px', fontSize: 12, maxWidth: 120 }} value={t.store_erpid || ''} onChange={(e) => patch(t, { store_erpid: e.target.value })}>
                    <option value="">—</option>{storeOpts}
                  </select>
                </td>
                <td style={td}><input style={{ ...input, padding: '3px 6px', fontSize: 12, width: 110 }} defaultValue={t.note || ''} onBlur={(e) => { if ((e.target.value || '') !== (t.note || '')) patch(t, { note: e.target.value }); }} /></td>
                <td style={td}><button title="以後同樣的備註都這樣分" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2b6cb0', fontSize: 12 }}
                  onClick={() => setRule({ t, pattern: (t.memo || t.summary || '').slice(0, 20), all: false, category: t.category, store_erpid: t.store_erpid })}>記住</button></td>
              </tr>
            ))}
            {!loading && !data.rows.length && <tr><td colSpan={11} style={{ ...td, textAlign: 'center', color: C.muted, padding: 20 }}>沒有交易</td></tr>}
          </tbody>
        </table>
        {data.total > data.rows.length && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>只顯示前 {data.rows.length} 筆，請縮小日期範圍</div>}
      </div>
    </div>
  );
}

// ═══ 門市存入 ═══
function StoresTab({ meta, onOpen }) {
  const [ym, setYm] = useState(thisYm());
  const [cats, setCats] = useState(['現金存入']);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    setD(null);
    bankLedgerApi.storeDeposits(ym, cats).then((r) => setD(r.data)).catch((e) => setErr(errMsg(e)));
  }, [ym, cats]);
  const days = useMemo(() => {
    if (!d) return [];
    const out = []; const [y, m] = ym.split('-').map(Number); const n = new Date(y, m, 0).getDate();
    for (let i = 1; i <= n; i++) out.push(`${ym}-${String(i).padStart(2, '0')}`);
    return out;
  }, [d, ym]);
  const total = d ? d.stores.reduce((s, x) => s + x.total, 0) : 0;
  return (
    <div>
      <div style={{ ...card, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="month" style={input} value={ym} onChange={(e) => setYm(e.target.value)} />
        <span style={{ fontSize: 13, color: C.muted }}>類別：</span>
        {meta.categories.filter((c) => !['內部轉帳', '手續費', '貨款/付款', '其他支出'].includes(c)).map((c) => (
          <label key={c} style={{ fontSize: 13 }}><input type="checkbox" checked={cats.includes(c)} onChange={(e) => setCats(e.target.checked ? [...cats, c] : cats.filter((x) => x !== c))} /> {c}</label>
        ))}
      </div>
      {err && <div style={{ ...card, color: C.danger }}>⚠ {err}</div>}
      {d && d.unassigned.n > 0 && (
        <div style={{ ...card, background: '#fffbeb', fontSize: 13 }}>
          ⚠ 還有 {d.unassigned.n} 筆、${fmt(d.unassigned.total)} 沒標門市
          <button style={{ ...ghost, marginLeft: 8, padding: '3px 10px' }} onClick={() => onOpen({ ...monthRange(ym), store_erpid: '__none', direction: 'in', category: cats.length === 1 ? cats[0] : '' })}>去標門市</button>
        </div>
      )}
      <div style={{ ...card, overflowX: 'auto' }}>
        {!d ? <div style={{ color: C.muted }}>載入中…</div> : (
          <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>
              <th style={{ ...th, position: 'sticky', left: 0, zIndex: 1 }}>門市</th><th style={th}>合計</th><th style={th}>筆數</th>
              {days.map((x) => <th key={x} style={{ ...th, textAlign: 'right' }}>{Number(x.slice(8))}</th>)}
            </tr></thead>
            <tbody>
              {d.stores.map((s) => (
                <tr key={s.store_erpid}>
                  <td style={{ ...td, position: 'sticky', left: 0, background: '#fff', whiteSpace: 'nowrap' }}>
                    <a style={{ color: '#2b6cb0', cursor: 'pointer' }} onClick={() => onOpen({ ...monthRange(ym), store_erpid: s.store_erpid, direction: 'in' })}>{s.store_name}</a>
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(s.total)}</td><td style={td}>{s.n}</td>
                  {days.map((x) => <td key={x} style={{ ...td, textAlign: 'right', color: s.days[x] ? undefined : '#cbd5e0' }}>{s.days[x] ? fmt(s.days[x]) : '·'}</td>)}
                </tr>
              ))}
              {!d.stores.length && <tr><td colSpan={days.length + 3} style={{ ...td, color: C.muted }}>這個月還沒有標了門市的存入</td></tr>}
              {d.stores.length > 0 && <tr><td style={{ ...td, fontWeight: 700, position: 'sticky', left: 0, background: '#fff' }}>合計</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(total)}</td><td style={td} colSpan={days.length + 1} /></tr>}
            </tbody>
          </table>
        )}
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>日期＝銀行入帳日。下一步會加上「門市當天應存（ERP 現金收入）」對照，列出沒存、少存、多存。</div>
      </div>
    </div>
  );
}

// ═══ 規則 ═══
function RulesTab({ accounts, meta }) {
  const [list, setList] = useState([]);
  const [f, setF] = useState({ pattern: '', direction: 'in', category: '', store_erpid: '', account_id: '' });
  const [msg, setMsg] = useState('');
  const load = useCallback(() => bankLedgerApi.rules().then((r) => setList(r.data || [])).catch((e) => setMsg('⚠ ' + errMsg(e))), []);
  useEffect(() => { load(); }, [load]);
  const storeName = Object.fromEntries((meta.stores || []).map((s) => [s.store_erpid, s.store_name]));
  const add = async () => { try { await bankLedgerApi.addRule(f); setF({ ...f, pattern: '' }); setMsg('已新增（按「重新套用」可套到現有交易）'); load(); } catch (e) { setMsg('⚠ ' + errMsg(e)); } };
  const del = async (r) => { if (!window.confirm(`刪除規則「${r.pattern}」？`)) return; try { await bankLedgerApi.delRule(r.id); load(); } catch (e) { setMsg('⚠ ' + errMsg(e)); } };
  const reapply = async () => { try { const r = await bankLedgerApi.reapply(); setMsg(`已重新套用，更新 ${r.data.updated} 筆（手動改過的不動）`); } catch (e) { setMsg('⚠ ' + errMsg(e)); } };
  return (
    <div>
      <div style={card}>
        <b>新增規則</b>
        <div style={{ fontSize: 12, color: C.muted, margin: '4px 0 8px' }}>摘要／備註／註記含這段字 → 自動設類別、門市。例：備註含「南京」的現金存入 → 南京店；「財團法人聯合信用」→ 刷卡撥款。</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...input, width: 180 }} placeholder="含這段字" value={f.pattern} onChange={(e) => setF({ ...f, pattern: e.target.value })} />
          <select style={input} value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}><option value="in">存入</option><option value="out">支出</option><option value="">存入＋支出</option></select>
          <select style={input} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">類別（不設）</option>{meta.categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <select style={input} value={f.store_erpid} onChange={(e) => setF({ ...f, store_erpid: e.target.value })}><option value="">門市（不設）</option>{(meta.stores || []).map((s) => <option key={s.store_erpid} value={s.store_erpid}>{s.store_name}</option>)}</select>
          <select style={input} value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value })}><option value="">所有帳戶</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.alias}</option>)}</select>
          <button style={btn(C.primary)} onClick={add}>新增</button>
          <div style={{ flex: 1 }} />
          <button style={ghost} onClick={reapply}>重新套用到現有交易</button>
        </div>
        {msg && <div style={{ fontSize: 13, marginTop: 6, color: msg.startsWith('⚠') ? C.danger : C.ok }}>{msg}</div>}
      </div>
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['含這段字', '存入／支出', '類別', '門市', '帳戶', '建立', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td style={td}><b>{r.pattern}</b></td><td style={td}>{r.direction === 'in' ? '存入' : r.direction === 'out' ? '支出' : '都適用'}</td>
                <td style={td}>{r.category || ''}</td><td style={td}>{storeName[r.store_erpid] || ''}</td><td style={td}>{r.account?.alias || '所有帳戶'}</td>
                <td style={{ ...td, fontSize: 12, color: C.muted }}>{r.created_by}</td>
                <td style={td}><button style={{ ...ghost, padding: '3px 8px', color: C.danger }} onClick={() => del(r)}>刪除</button></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: C.muted }}>還沒有規則；在交易明細按「記住」也會建立</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
