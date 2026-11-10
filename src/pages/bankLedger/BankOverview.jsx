// pages/bankLedger/BankOverview.jsx —— 銀存彙整「本子總覽」（2026-11）
//   所有本子餘額加總、每本最後更新、餘額核對（期初＋存入－支出 對 銀行餘額）、網銀連結、網銀帳密（查看要輸入查看密碼）
import { useEffect, useState, useCallback } from 'react';
import { bankLedgerApi } from '../../services/api';

const C = { primary: '#50422d', border: '#e0d5c8', muted: '#8a7a66', ok: '#2d6a4f', danger: '#c53030', warn: '#b7791f' };
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 };
const btn = (bg, fg) => ({ border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600, background: bg, color: fg || '#fff' });
const ghost = btn('#edf2f7', '#4a5568');
const small = { ...ghost, padding: '3px 9px', fontSize: 12 };
const input = { border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', fontSize: 13, boxSizing: 'border-box' };
const th = { padding: '7px 8px', textAlign: 'left', fontWeight: 600, background: '#f7fafc', borderBottom: '2px solid #e2e8f0', color: '#4a5568', whiteSpace: 'nowrap', fontSize: 12 };
const td = { padding: '8px', borderBottom: '1px solid #edf2f7', verticalAlign: 'top', fontSize: 13 };
const fmt = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('zh-TW', { maximumFractionDigits: 2 }));
const errMsg = (e) => (e && (e.message || e.error)) || '失敗';
const dt = (s) => (s ? String(s).slice(0, 16).replace('T', ' ') : '');
const DEFAULT_FIELDS = [{ label: '身分證字號／統一編號', value: '', secret: true }, { label: '使用者代號', value: '', secret: true }, { label: '密碼', value: '', secret: true }];

export default function BankOverview({ accounts, reload, onOpen }) {
  const [ed, setEd] = useState(null);
  const [msg, setMsg] = useState('');
  const [credSt, setCredSt] = useState({ pin_set: true });
  const [pinAsk, setPinAsk] = useState(null);     // { title, onOk(pin) }
  const [shown, setShown] = useState(null);       // { account, fields, until }
  const [credEdit, setCredEdit] = useState(null); // { account, pin, fields }
  const [showOff, setShowOff] = useState(false);

  const loadSt = useCallback(() => bankLedgerApi.credStatus().then((r) => setCredSt(r.data || {})).catch(() => {}), []);
  useEffect(() => { loadSt(); }, [loadSt]);
  useEffect(() => { if (!shown) return undefined; const t = setTimeout(() => setShown(null), 60000); return () => clearTimeout(t); }, [shown]);

  const list = accounts.filter((a) => showOff || a.is_active !== false);
  const active = accounts.filter((a) => a.is_active !== false);
  const total = active.reduce((s, a) => s + Number(a.balance || 0), 0);
  const lastUpd = active.map((a) => a.last_import_at).filter(Boolean).sort().pop();
  const bad = active.filter((a) => a.verify && a.verify.status === 'mismatch').length;
  const noOpen = active.filter((a) => a.verify && a.verify.status === 'no_opening').length;

  const save = async () => {
    try { if (ed.id) await bankLedgerApi.updateAccount(ed.id, ed); else await bankLedgerApi.createAccount(ed); setEd(null); setMsg('已儲存'); reload(); } catch (e) { setMsg('⚠ ' + errMsg(e)); }
  };
  // 輸入查看密碼 → 執行；密碼錯就留在視窗顯示錯誤
  const reveal = (a) => setPinAsk({ title: `查看「${a.alias}」網銀帳密`, action: async (pin) => {
    const r = await bankLedgerApi.credReveal(a.id, pin); setShown({ account: a, fields: r.data || [] });
  } });
  const editCred = (a) => setPinAsk({ title: `設定「${a.alias}」網銀帳密`, action: async (pin) => {
    const r = a.has_cred ? await bankLedgerApi.credReveal(a.id, pin) : await bankLedgerApi.credCheck(pin);
    const fs = a.has_cred && r.data && r.data.length ? r.data : DEFAULT_FIELDS;
    setCredEdit({ account: a, pin, fields: fs.map((f) => ({ ...f })) });
  } });
  const runPin = async (pin) => {
    try { await pinAsk.action(pin); setPinAsk(null); } catch (e) { setPinAsk((p) => p && { ...p, err: errMsg(e) }); }
  };
  const saveCred = async () => {
    try { await bankLedgerApi.credSave(credEdit.account.id, credEdit.pin, credEdit.fields); setCredEdit(null); setMsg('網銀帳密已加密儲存'); reload(); }
    catch (e) { setMsg('⚠ ' + errMsg(e)); }
  };
  const setPin = async () => {
    const old = credSt.pin_set && !credSt.can_reset ? window.prompt('輸入目前的查看密碼') : (credSt.pin_set ? (window.prompt('輸入目前的查看密碼（主管可留空直接重設）') || '') : '');
    if (old === null) return;
    const n1 = window.prompt('設定新的查看密碼（至少 4 碼；看網銀帳密時要輸入）');
    if (!n1) return;
    const n2 = window.prompt('再輸入一次新的查看密碼');
    if (n1 !== n2) { setMsg('⚠ 兩次輸入不一樣'); return; }
    try { await bankLedgerApi.credPin({ old_pin: old, new_pin: n1 }); setMsg('查看密碼已設定'); loadSt(); } catch (e) { setMsg('⚠ ' + errMsg(e)); }
  };
  const copy = (v) => { try { navigator.clipboard.writeText(v); setMsg('已複製'); } catch { /* */ } };

  return (
    <div>
      <div style={{ ...card, display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 12, color: C.muted }}>所有本子餘額加總（{active.length} 本）</div><div style={{ fontSize: 26, fontWeight: 800, color: C.primary }}>${fmt(total)}</div></div>
        <div><div style={{ fontSize: 12, color: C.muted }}>最後更新（最近一次匯入）</div><div style={{ fontSize: 15, fontWeight: 600 }}>{dt(lastUpd) || '—'}</div></div>
        <div><div style={{ fontSize: 12, color: C.muted }}>餘額核對</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {bad ? <span style={{ color: C.danger }}>⚠ {bad} 本對不上</span> : <span style={{ color: C.ok }}>✓ 沒有對不上</span>}
            {noOpen > 0 && <span style={{ color: C.warn, marginLeft: 8 }}>{noOpen} 本還沒設期初</span>}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 12, color: C.muted }}><input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} /> 顯示停用</label>
        <button style={ghost} onClick={setPin}>🔑 {credSt.pin_set ? '更改查看密碼' : '設定查看密碼'}</button>
        <button style={btn(C.primary)} onClick={() => setEd({ bank_name: '', alias: '', account_no: '', holder: '', note: '', bank_url: '', opening_date: '', opening_balance: '' })}>＋ 新增本子</button>
      </div>
      {!credSt.pin_set && <div style={{ ...card, background: '#fffbeb', fontSize: 13 }}>還沒設定「查看密碼」。網銀帳密要先設查看密碼才能存，之後看帳密都要輸入它。<button style={{ ...small, marginLeft: 8 }} onClick={setPin}>現在設定</button></div>}
      {msg && <div style={{ ...card, padding: 8, color: msg.startsWith('⚠') ? C.danger : C.ok }}>{msg}</div>}

      {ed && (
        <div style={card}>
          <b>{ed.id ? `修改「${ed.alias}」` : '新增本子'}</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
            {[['bank_name', '銀行'], ['alias', '顯示名稱（例：元大 總公司）'], ['account_no', '帳號'], ['holder', '戶名']].map(([k, l]) => (
              <label key={k} style={{ fontSize: 12, color: C.muted }}>{l}<br /><input style={{ ...input, width: '100%' }} value={ed[k] || ''} onChange={(e) => setEd({ ...ed, [k]: e.target.value })} /></label>
            ))}
            <label style={{ fontSize: 12, color: C.muted }}>期初日期（這天開始前的餘額）<br /><input type="date" style={{ ...input, width: '100%' }} value={ed.opening_date || ''} onChange={(e) => setEd({ ...ed, opening_date: e.target.value })} /></label>
            <label style={{ fontSize: 12, color: C.muted }}>期初餘額<br /><input style={{ ...input, width: '100%' }} inputMode="decimal" value={ed.opening_balance ?? ''} onChange={(e) => setEd({ ...ed, opening_balance: e.target.value })} /></label>
            <label style={{ fontSize: 12, color: C.muted, gridColumn: 'span 2' }}>網銀網址<br /><input style={{ ...input, width: '100%' }} placeholder="https://..." value={ed.bank_url || ''} onChange={(e) => setEd({ ...ed, bank_url: e.target.value })} /></label>
            <label style={{ fontSize: 12, color: C.muted, gridColumn: '1 / -1' }}>備註（例：哪些門市在用）<br /><input style={{ ...input, width: '100%' }} value={ed.note || ''} onChange={(e) => setEd({ ...ed, note: e.target.value })} /></label>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            {ed.id && <label style={{ fontSize: 13 }}><input type="checkbox" checked={ed.is_active !== false} onChange={(e) => setEd({ ...ed, is_active: e.target.checked })} /> 使用中</label>}
            <button style={btn(C.primary)} onClick={save}>儲存</button>
            <button style={ghost} onClick={() => setEd(null)}>取消</button>
            <span style={{ fontSize: 12, color: C.muted }}>期初設好後，系統會用「期初＋每筆存入－支出」逐筆對銀行檔案上的餘額。</span>
          </div>
        </div>
      )}

      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['本子', '帳號', '最新餘額', '最後交易日／最後匯入', '餘額核對', '網銀', '帳密', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {list.map((a) => {
              const v = a.verify || {};
              return (
                <tr key={a.id} style={{ opacity: a.is_active === false ? 0.5 : 1 }}>
                  <td style={td}><a style={{ color: '#2b6cb0', cursor: 'pointer', fontWeight: 600 }} onClick={() => onOpen(a)}>{a.alias}</a><div style={{ fontSize: 11, color: C.muted }}>{a.bank_name}{a.holder ? `｜${a.holder}` : ''}</div>{a.note && <div style={{ fontSize: 11, color: C.muted }}>{a.note}</div>}</td>
                  <td style={td}>{a.account_no || <span style={{ color: C.muted }}>—</span>}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(a.balance)}{a.computed_balance != null && Math.abs(a.computed_balance - (a.balance || 0)) > 0.5 && <div style={{ fontSize: 11, color: C.danger }}>系統算 {fmt(a.computed_balance)}</div>}</td>
                  <td style={td}>{a.last_date || '—'}<div style={{ fontSize: 11, color: C.muted }}>{a.last_import_at ? `匯入 ${dt(a.last_import_at)}` : '還沒匯入'}</div></td>
                  <td style={td}>
                    {v.status === 'ok' && <span style={{ color: C.ok }}>✓ 對得上</span>}
                    {v.status === 'empty' && <span style={{ color: C.muted }}>沒有交易</span>}
                    {v.status === 'no_opening' && <span style={{ color: C.warn }}>沒設期初</span>}
                    {v.status === 'mismatch' && (
                      <div style={{ color: C.danger }}>⚠ {v.mismatches} 處對不上
                        {v.first && <div style={{ fontSize: 11 }}>{v.first.date} {v.first.summary} 差 {fmt(v.first.diff)}</div>}
                      </div>
                    )}
                    {a.opening_date && <div style={{ fontSize: 11, color: C.muted }}>期初 {a.opening_date}：{fmt(a.opening_balance)}</div>}
                  </td>
                  <td style={td}>{a.bank_url ? <a href={a.bank_url} target="_blank" rel="noreferrer" style={{ ...small, textDecoration: 'none', display: 'inline-block' }}>🌐 開網銀</a> : <span style={{ fontSize: 12, color: C.muted }}>沒設網址</span>}</td>
                  <td style={td}>
                    {a.has_cred ? (
                      <div>
                        {(a.cred_labels || []).map((f) => <div key={f.label} style={{ fontSize: 11, color: C.muted }}>{f.label}：{f.secret ? '••••••' : f.value}</div>)}
                        <button style={{ ...small, marginTop: 4 }} onClick={() => reveal(a)}>🔒 查看</button>
                      </div>
                    ) : <span style={{ fontSize: 12, color: C.muted }}>沒存</span>}
                    <div><button style={{ border: 'none', background: 'none', color: '#2b6cb0', cursor: 'pointer', fontSize: 12, padding: 0, marginTop: 4 }} onClick={() => editCred(a)} disabled={!credSt.pin_set}>{a.has_cred ? '改帳密' : '＋ 存帳密'}</button></div>
                  </td>
                  <td style={td}><button style={small} onClick={() => setEd({ ...a, opening_balance: a.opening_balance ?? '' })}>改</button></td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: C.muted }}>還沒有本子；匯入有帳號的檔案會自動建立，或按「＋ 新增本子」</td></tr>}
          </tbody>
        </table>
      </div>

      {pinAsk && <PinModal title={pinAsk.title} err={pinAsk.err} onCancel={() => setPinAsk(null)} onOk={runPin} />}
      {shown && (
        <Modal title={`「${shown.account.alias}」網銀帳密`} onClose={() => setShown(null)}>
          {shown.account.bank_url && <div style={{ marginBottom: 10 }}><a href={shown.account.bank_url} target="_blank" rel="noreferrer">🌐 {shown.account.bank_url}</a></div>}
          {shown.fields.map((f) => (
            <div key={f.label} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #edf2f7' }}>
              <span style={{ width: 150, fontSize: 13, color: C.muted }}>{f.label}</span>
              <code style={{ flex: 1, fontSize: 15 }}>{f.value}</code>
              <button style={small} onClick={() => copy(f.value)}>複製</button>
            </div>
          ))}
          {!shown.fields.length && <div style={{ color: C.muted }}>沒有存帳密</div>}
          <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>60 秒後自動隱藏。每次查看都有紀錄。</div>
        </Modal>
      )}
      {credEdit && (
        <Modal title={`設定「${credEdit.account.alias}」網銀帳密`} onClose={() => setCredEdit(null)}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>每家銀行要填的不一樣，欄位可以自己加、改名稱。勾「私密」的欄位在清單上不顯示，要輸入查看密碼才看得到（預設全部私密）。</div>
          {credEdit.fields.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input style={{ ...input, width: 150 }} placeholder="欄位名稱" value={f.label} onChange={(e) => setCredEdit({ ...credEdit, fields: credEdit.fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <input style={{ ...input, flex: 1 }} placeholder="值" value={f.value} autoComplete="off" onChange={(e) => setCredEdit({ ...credEdit, fields: credEdit.fields.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
              <label style={{ fontSize: 12, whiteSpace: 'nowrap' }}><input type="checkbox" checked={f.secret !== false} onChange={(e) => setCredEdit({ ...credEdit, fields: credEdit.fields.map((x, j) => (j === i ? { ...x, secret: e.target.checked } : x)) })} /> 私密</label>
              <button style={small} onClick={() => setCredEdit({ ...credEdit, fields: credEdit.fields.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            <button style={small} onClick={() => setCredEdit({ ...credEdit, fields: [...credEdit.fields, { label: '', value: '', secret: true }] })}>＋ 加欄位</button>
            {['驗證碼／圖形碼備註', '憑證密碼', '交易密碼', '登入身分（企業／個人）'].map((l) => (
              <button key={l} style={{ ...small, background: '#fff', border: '1px dashed #cbd5e0' }} onClick={() => setCredEdit({ ...credEdit, fields: [...credEdit.fields, { label: l, value: '', secret: true }] })}>＋ {l}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button style={ghost} onClick={() => setCredEdit(null)}>取消</button>
            <button style={btn(C.primary)} onClick={saveCred}>加密儲存</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><b>{title}</b><button style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer' }} onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}
function PinModal({ title, err, onOk, onCancel }) {
  const [pin, setPin] = useState('');
  return (
    <Modal title={title} onClose={onCancel}>
      <div style={{ fontSize: 13, marginBottom: 8 }}>請輸入查看密碼</div>
      <input type="password" autoFocus autoComplete="off" style={{ ...input, width: '100%', fontSize: 16 }} value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && pin) onOk(pin); }} />
      {err && <div style={{ color: C.danger, fontSize: 13, marginTop: 6 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button style={ghost} onClick={onCancel}>取消</button>
        <button style={btn(C.primary)} disabled={!pin} onClick={() => onOk(pin)}>確定</button>
      </div>
    </Modal>
  );
}
