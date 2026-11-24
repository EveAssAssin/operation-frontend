// pages/bankLedger/CashDepositReviewPage.jsx —— 金流 → 銀存審核（2026-11-24）
// 門市在 App「營運工具 → 銀存回報」看 ERP 日結算現金、存好拍存款單上繳（AI 讀金額＝應繳才收；不符要寫原因）
// 這裡：① 各店總覽（應繳／已通過／待確認／金額不符／沒繳、逾期）② 待審清單（不符的特別標）③ 審核（可指定本子哪一筆）
//       ④ 現金銀存專用本子：匯入明細後自動對帳，一對一同金額就自動通過 ⑤ 本子有存入但沒人回報
import { useCallback, useEffect, useState } from 'react';
import { cashDepositApi, bankLedgerApi } from '../../services/api';

const C = { primary: '#50422d', border: '#e0d5c8', muted: '#8a7a66', ok: '#2d6a4f', danger: '#c53030', warn: '#b7791f', in: '#2f855a', blue: '#2b6cb0' };
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 };
const btn = (bg, fg) => ({ border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600, background: bg, color: fg || '#fff' });
const ghost = btn('#edf2f7', '#4a5568');
const input = { border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', fontSize: 13 };
const th = { padding: '7px 8px', textAlign: 'left', fontWeight: 600, background: '#f7fafc', borderBottom: '2px solid #e2e8f0', color: '#4a5568', whiteSpace: 'nowrap', fontSize: 12 };
const td = { padding: '6px 8px', borderBottom: '1px solid #edf2f7', verticalAlign: 'top', fontSize: 13 };
const money = (n) => (n == null ? '—' : Number(n).toLocaleString());
const errMsg = (e) => (e && (e.message || e.error)) || '失敗';
const thisYm = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7);
const dt = (s) => (s ? new Date(s).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const ST = { submitted: ['待確認（金額相符）', C.blue, '#ebf8ff'], mismatch: ['⚠ 金額不符', C.warn, '#fffbeb'], approved: ['已通過', C.ok, '#f0fff4'], rejected: ['已退回', C.danger, '#fff5f5'], cancelled: ['門市撤回', C.muted, '#f7fafc'] };

export default function CashDepositReviewPage() {
  const [tab, setTab] = useState('review');
  const [msg, setMsg] = useState('');
  const tabs = [['review', '📥 待審'], ['stores', '🏪 各店總覽'], ['history', '📄 全部紀錄'], ['book', '🏦 本子沒對到的存入'], ['settings', '⚙ 設定']];
  return (
    <div style={{ padding: 20, maxWidth: 1300 }}>
      <h2 style={{ margin: '0 0 4px', color: C.primary }}>💵 銀存審核</h2>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>門市在 App「營運工具 → 銀存回報」上繳現金（拍存款單，AI 核對金額）。指定「現金銀存專用本子」後，匯入那本的網銀明細會自動對帳：同金額、一對一就自動通過。</div>
      <div style={{ display: 'flex', gap: 4, borderBottom: `2px solid ${C.border}`, marginBottom: 14 }}>
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: tab === k ? 700 : 400, color: tab === k ? C.primary : C.muted, borderBottom: tab === k ? `3px solid ${C.primary}` : '3px solid transparent', marginBottom: -2 }}>{l}</button>)}
      </div>
      {msg && <div style={{ ...card, padding: 8, color: msg.startsWith('⚠') ? C.danger : C.ok }}>{msg}<button style={{ float: 'right', border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => setMsg('')}>✕</button></div>}
      {tab === 'review' && <DepositList statuses="mismatch,submitted" setMsg={setMsg} review />}
      {tab === 'stores' && <StoresTab />}
      {tab === 'history' && <DepositList statuses="" setMsg={setMsg} />}
      {tab === 'book' && <BookTab />}
      {tab === 'settings' && <SettingsTab setMsg={setMsg} />}
    </div>
  );
}

function DepositList({ statuses, setMsg, review }) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => cashDepositApi.deposits({ status: statuses || undefined, limit: review ? 500 : 300 }).then((r) => setList(r.data || [])).catch((e) => setMsg('⚠ ' + errMsg(e))), [statuses]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  const recon = async () => {
    setBusy(true);
    try { const r = (await cashDepositApi.reconcile()).data; setMsg(r.message ? `⚠ ${r.message}` : `自動對帳完成：通過 ${r.matched} 筆${r.ambiguous ? `，${r.ambiguous} 筆有好幾筆可能要人工選` : ''}${r.waiting - r.ambiguous > 0 ? `，${r.waiting - r.ambiguous} 筆本子還沒看到這筆存入` : ''}`); load(); }
    catch (e) { setMsg('⚠ ' + errMsg(e)); } finally { setBusy(false); }
  };
  if (!list) return <div style={card}>載入中…</div>;
  const mism = list.filter((x) => x.status === 'mismatch');
  return (
    <div>
      {review && (
        <div style={{ ...card, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>待審 <b>{list.length}</b> 筆{mism.length ? <>，其中 <b style={{ color: C.warn }}>金額不符 {mism.length}</b> 筆</> : ''}</span>
          <div style={{ flex: 1 }} />
          <button style={btn(C.primary)} disabled={busy} onClick={recon}>{busy ? '對帳中…' : '🔄 跟本子立即對帳'}</button>
        </div>
      )}
      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['上繳時間', '門市', '涵蓋結算', '應繳', '單據金額', '狀態', '原因／審核', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {list.map((x) => {
              const st = ST[x.status] || [x.status, C.muted, '#fff'];
              return (
                <tr key={x.id} style={{ background: x.status === 'mismatch' ? '#fffbeb' : undefined }}>
                  <td style={td}>{dt(x.created_at)}<div style={{ fontSize: 11, color: C.muted }}>{x.created_by_name}</div></td>
                  <td style={td}>{x.store_name || x.store_erpid}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{x.period_from}～{x.period_to}<div style={{ fontSize: 11, color: C.muted }}>{(x.settle_ids || []).length} 次結算</div></td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{money(x.expected)}</td>
                  <td style={{ ...td, textAlign: 'right', color: x.ai_amount != null && Number(x.ai_amount) !== Number(x.expected) ? C.danger : undefined }}>{x.ai_amount == null ? <span style={{ color: C.warn }}>看不清楚</span> : money(x.ai_amount)}</td>
                  <td style={td}><span style={{ fontSize: 12, fontWeight: 700, color: st[1], background: st[2], borderRadius: 10, padding: '2px 8px', whiteSpace: 'nowrap' }}>{st[0]}</span>{x.auto_matched && <div style={{ fontSize: 11, color: C.ok }}>本子自動對帳</div>}</td>
                  <td style={{ ...td, fontSize: 12, maxWidth: 260 }}>{x.reason && <div style={{ color: C.warn }}>門市：{x.reason}</div>}{x.review_note && <div style={{ color: C.muted }}>{x.reviewed_name}：{x.review_note}</div>}</td>
                  <td style={td}><button style={{ ...ghost, padding: '3px 10px' }} onClick={() => setOpen(x.id)}>{['submitted', 'mismatch'].includes(x.status) ? '審核' : '看'}</button></td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: C.muted, padding: 20 }}>{review ? '沒有待審的上繳 🎉' : '沒有紀錄'}</td></tr>}
          </tbody>
        </table>
      </div>
      {open && <ReviewModal id={open} onClose={() => setOpen(null)} onDone={(m) => { setOpen(null); setMsg(m); load(); }} />}
    </div>
  );
}

function ReviewModal({ id, onClose, onDone }) {
  const [d, setD] = useState(null);
  const [cand, setCand] = useState(null);
  const [pick, setPick] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    cashDepositApi.deposit(id).then((r) => setD(r.data)).catch((e) => setErr(errMsg(e)));
    cashDepositApi.candidates(id).then((r) => { setCand(r.data); const ex = (r.data.list || []).filter((t) => t.exact && (!t.cash_deposit_id || t.cash_deposit_id === id)); if (ex.length === 1) setPick(ex[0].id); }).catch(() => setCand({ list: [], books: 0 }));
  }, [id]);
  const act = async (action) => {
    setErr('');
    if (action === 'reject' && !note.trim()) return setErr('退回要寫原因（會推播給門市）');
    try { await cashDepositApi.review(id, { action, note: note.trim() || null, bank_txn_id: action === 'approve' && pick ? pick : null }); onDone(action === 'approve' ? '已通過' : '已退回，已推播通知門市'); }
    catch (e) { setErr(errMsg(e)); }
  };
  const can = d && ['submitted', 'mismatch'].includes(d.status);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(920px, 96vw)', maxHeight: '92vh', overflowY: 'auto', padding: 18 }} onClick={(e) => e.stopPropagation()}>
        {!d ? <div>{err || '載入中…'}</div> : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>{d.store_name} 上繳 {money(d.expected)} 元</h3><button style={ghost} onClick={onClose}>關閉</button></div>
            <div style={{ fontSize: 13, color: C.muted, margin: '4px 0 10px' }}>{dt(d.created_at)} {d.created_by_name}・涵蓋 {d.period_from}～{d.period_to}・{(ST[d.status] || [d.status])[0]}</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 320px' }}>
                <b>單據照片</b>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>{(d.photos || []).map((p) => <a key={p.url} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="" style={{ maxWidth: 300, maxHeight: 360, borderRadius: 8, border: `1px solid ${C.border}` }} /></a>)}</div>
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <b>AI 讀到</b>：{d.ai_amount == null ? <span style={{ color: C.warn }}>看不清楚金額</span> : <>{money(d.ai_amount)} 元 {Number(d.ai_amount) === Number(d.expected) ? <span style={{ color: C.ok }}>✓ 跟應繳相同</span> : <span style={{ color: C.danger }}>✕ 差 {money(Number(d.ai_amount) - Number(d.expected))}</span>}</>}
                  {(d.ai && d.ai.slips || []).map((s, i) => <div key={i} style={{ fontSize: 12, color: C.muted }}>第 {i + 1} 張：{s.kind || ''} {s.amount != null ? money(s.amount) : '?'}{s.date ? `・${s.date}` : ''}{s.account_tail ? `・帳號末 ${s.account_tail}` : ''}{s.depositor ? `・${s.depositor}` : ''}{s.note ? `（${s.note}）` : ''}</div>)}
                </div>
                {d.reason && <div style={{ marginTop: 8, padding: 8, background: '#fffbeb', borderRadius: 6, fontSize: 13 }}>門市說明：{d.reason}</div>}
              </div>
              <div style={{ flex: '1 1 300px' }}>
                <b>涵蓋的 ERP 日結算（現金）</b>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}><tbody>
                  {(d.settlements || []).map((s) => <tr key={s.id}><td style={td}>{s.biz_date}<div style={{ fontSize: 11, color: C.muted }}>{String(s.begin_at || '').slice(5, 16)}～{String(s.end_at || '').slice(5, 16)}</div></td><td style={{ ...td, textAlign: 'right' }}>{money(s.cash)}</td></tr>)}
                  <tr><td style={{ ...td, fontWeight: 700 }}>合計</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{money(d.expected)}</td></tr>
                </tbody></table>
                {d.bank_info && <div style={{ marginTop: 8, fontSize: 13, color: C.ok }}>🏦 已對到本子：{d.bank_info.account} {d.bank_info.date} 存入 {money(d.bank_info.amount)}</div>}
              </div>
            </div>
            {can && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <b>對到本子哪一筆？</b><span style={{ fontSize: 12, color: C.muted }}>（選了會把那筆存入標成這家店、已對帳；可以不選）</span>
                {!cand ? <div style={{ fontSize: 13 }}>找候選中…</div> : !cand.books ? <div style={{ fontSize: 13, color: C.warn }}>還沒指定現金銀存專用本子（到「⚙ 設定」）</div> : (
                  <div style={{ maxHeight: 180, overflowY: 'auto', marginTop: 6 }}>
                    <label style={{ display: 'block', fontSize: 13 }}><input type="radio" checked={!pick} onChange={() => setPick('')} /> 不指定</label>
                    {cand.list.map((t) => (
                      <label key={t.id} style={{ display: 'block', fontSize: 13, color: t.exact ? undefined : C.muted }}>
                        <input type="radio" checked={pick === t.id} onChange={() => setPick(t.id)} /> {t.account_alias} {t.txn_date} {t.txn_time || ''} 存入 <b>{money(t.in_amt)}</b> {t.summary} {t.memo}{t.exact ? ' ✓ 金額相同' : ''}{t.store_erpid ? '（已標門市）' : ''}
                      </label>
                    ))}
                    {!cand.list.length && <div style={{ fontSize: 13, color: C.muted }}>本子裡附近日期沒有金額接近的存入（可能還沒匯入明細）</div>}
                  </div>
                )}
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="審核說明（退回必填，會推播給門市）" style={{ ...input, width: '100%', boxSizing: 'border-box', marginTop: 8 }} />
                {err && <div style={{ color: C.danger, fontSize: 13 }}>⚠ {err}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button style={btn(C.ok)} onClick={() => act('approve')}>✓ 通過</button>
                  <button style={btn(C.danger)} onClick={() => act('reject')}>退回請門市重繳</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StoresTab() {
  const [ym, setYm] = useState(thisYm());
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { setD(null); cashDepositApi.overview(ym).then((r) => setD(r.data)).catch((e) => setErr(errMsg(e))); }, [ym]);
  if (err) return <div style={{ ...card, color: C.danger }}>⚠ {err}</div>;
  const tot = d ? d.stores.reduce((a, s) => ({ month: a.month + s.month_cash, ok: a.ok + s.approved, pend: a.pend + s.pending, mis: a.mis + s.mismatch, open: a.open + s.open }), { month: 0, ok: 0, pend: 0, mis: 0, open: 0 }) : null;
  return (
    <div>
      <div style={{ ...card, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        月份 <input type="month" style={input} value={ym} onChange={(e) => setYm(e.target.value)} />
        {tot && <span style={{ fontSize: 13 }}>本月結算現金 <b>{money(tot.month)}</b>｜已通過 <b style={{ color: C.ok }}>{money(tot.ok)}</b>｜待確認 <b style={{ color: C.blue }}>{money(tot.pend)}</b>｜不符待審 <b style={{ color: C.warn }}>{money(tot.mis)}</b>｜沒繳 <b style={{ color: C.danger }}>{money(tot.open)}</b></span>}
      </div>
      <div style={{ ...card, overflowX: 'auto' }}>
        {!d ? '載入中…' : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['門市', '本月結算現金', '本月已通過', '待確認（相符）', '金額不符待審', '沒繳（全部）', '最舊沒繳', '最後結算'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {d.stores.map((s) => (
                <tr key={s.store_erpid} style={{ background: s.overdue ? '#fff5f5' : undefined }}>
                  <td style={td}>{s.store_name || s.store_erpid}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{money(s.month_cash)}</td>
                  <td style={{ ...td, textAlign: 'right', color: C.ok }}>{money(s.approved)}</td>
                  <td style={{ ...td, textAlign: 'right', color: C.blue }}>{s.pending ? money(s.pending) : ''}</td>
                  <td style={{ ...td, textAlign: 'right', color: C.warn }}>{s.mismatch ? money(s.mismatch) : ''}</td>
                  <td style={{ ...td, textAlign: 'right', color: s.open ? C.danger : C.muted, fontWeight: s.open ? 700 : 400 }}>{s.open ? money(s.open) : '0'}</td>
                  <td style={{ ...td, color: s.overdue ? C.danger : undefined }}>{s.oldest_open ? `${s.oldest_open}（${s.open_days} 天${s.overdue ? '・逾期' : ''}）` : '—'}</td>
                  <td style={{ ...td, color: C.muted }}>{s.last_biz}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {d && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>從 {d.start_date} 的結算開始算；最舊一筆沒繳超過 {d.overdue_days} 天標紅，每天 10:30 推播給門市。</div>}
      </div>
    </div>
  );
}

function BookTab() {
  const [d, setD] = useState(null);
  useEffect(() => { cashDepositApi.unmatched().then((r) => setD(r.data)).catch(() => setD({ books: [], list: [] })); }, []);
  if (!d) return <div style={card}>載入中…</div>;
  if (!d.books.length) return <div style={card}>還沒指定現金銀存專用本子，到「⚙ 設定」選。</div>;
  return (
    <div style={{ ...card, overflowX: 'auto' }}>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>現金銀存專用本子（{d.books.map((b) => b.alias).join('、')}）近 45 天的存入，還沒對到任何門市上繳的：可能是門市存了沒回報、或金額不符還在待審。</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['日期', '本子', '摘要／備註', '存入', '已標門市'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {d.list.map((t) => <tr key={t.id}><td style={td}>{t.txn_date} {t.txn_time || ''}</td><td style={td}>{t.account_alias}</td><td style={td}>{t.summary} {t.memo}</td><td style={{ ...td, textAlign: 'right', color: C.in }}>{money(t.in_amt)}</td><td style={td}>{t.store_erpid || ''}</td></tr>)}
          {!d.list.length && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: C.muted, padding: 16 }}>全部都對到了</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function SettingsTab({ setMsg }) {
  const [accs, setAccs] = useState([]);
  const [sel, setSel] = useState(new Set());
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    bankLedgerApi.accounts().then((r) => setAccs(r.data || [])).catch(() => {});
    cashDepositApi.cashBooks().then((r) => setSel(new Set((r.data || []).map((b) => b.id)))).catch(() => {});
    cashDepositApi.settings().then((r) => setSt(r.data)).catch((e) => setMsg('⚠ ' + errMsg(e)));
  }, []); // eslint-disable-line
  const toggle = (id) => { const s = new Set(sel); if (s.has(id)) s.delete(id); else s.add(id); setSel(s); };
  return (
    <div>
      <div style={card}>
        <b>現金銀存專用本子</b>
        <div style={{ fontSize: 12, color: C.muted, margin: '4px 0 8px' }}>門市存現金都存進這幾本。匯入這幾本的網銀明細後，系統拿每筆「存入」跟門市上繳比對：同金額、日期在最後結算日前 1 天～上繳後 3 天內、一對一，就自動通過。兩家店同一天存一樣的金額會分不出來，留給你在待審手動選。</div>
        {accs.filter((a) => a.is_active !== false).map((a) => <label key={a.id} style={{ display: 'block', fontSize: 14, padding: '3px 0' }}><input type="checkbox" checked={sel.has(a.id)} onChange={() => toggle(a.id)} /> {a.alias}　<span style={{ color: C.muted, fontSize: 12 }}>{a.bank_name} {a.account_no}</span></label>)}
        <button style={{ ...btn(C.primary), marginTop: 8 }} onClick={async () => { try { await cashDepositApi.setCashBooks([...sel]); setMsg('已儲存現金銀存專用本子'); } catch (e) { setMsg('⚠ ' + errMsg(e)); } }}>儲存</button>
      </div>
      <div style={card}>
        <b>規則</b>
        {st && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 14 }}>
            從 <input type="date" style={input} value={st.start_date} onChange={(e) => setSt({ ...st, start_date: e.target.value })} /> 的結算開始算
            ｜最舊沒繳超過 <input type="number" style={{ ...input, width: 60 }} value={st.overdue_days} onChange={(e) => setSt({ ...st, overdue_days: e.target.value })} /> 天就提醒
            <button style={btn(C.primary)} onClick={async () => { try { setSt((await cashDepositApi.saveSettings(st)).data); setMsg('已儲存規則'); } catch (e) { setMsg('⚠ ' + errMsg(e)); } }}>儲存</button>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button style={ghost} disabled={busy} onClick={async () => { setBusy(true); try { const r = (await cashDepositApi.sync(true)).data; setMsg(`已從 ERP 重新抓結算：${r.rows} 筆`); } catch (e) { setMsg('⚠ ' + errMsg(e)); } finally { setBusy(false); } }}>{busy ? '同步中…' : '從起算日重新抓 ERP 結算'}</button>
          <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>平常每小時自動抓最近 10 天，門市打開頁面也會抓一次。</span>
        </div>
      </div>
    </div>
  );
}
