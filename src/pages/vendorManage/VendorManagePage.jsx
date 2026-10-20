// pages/vendorManage/VendorManagePage.jsx —— 營運管理 → 廠商管理（2026-10-20）
// 一個畫面：新建廠商＋廠商入口帳號密碼＋出款資訊（收款銀行帳號）。
// 出款資訊設好後，帳單管理「💸 廠商出款」匯出元大檔會自動用廠商的預設帳號。
import React, { useCallback, useEffect, useState } from 'react';
import { vendorManageApi } from '../../services/api';
import HelpTip from '../../components/help/HelpTip';
import { useCoachMarks } from '../../components/help/CoachMarks';

const C = { primary: '#50422d', bg: '#faf8f5', border: '#e0d5c8', muted: '#8a7a66', ok: '#2d6a4f', danger: '#c53030' };
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 };
const btn = (bg, fg) => ({ border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600, background: bg, color: fg || '#fff' });
const ghost = btn('#edf2f7', '#4a5568');
const input = { border: '1px solid #e2e8f0', borderRadius: 6, padding: '7px 9px', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const VENDOR_LOGIN = 'https://operation-frontend.onrender.com/vendor/login';

const HELP = {
  page: '廠商在這裡建立一次就好：基本資料、廠商入口登入帳號密碼、出款資訊（收款銀行帳號）。\n廠商用帳號密碼登入廠商入口上傳帳單請款；會計通過、排出款日後，元大出款檔會自動帶這裡設定的收款帳號。',
  account: '廠商登入廠商入口用的帳號密碼。建好後把登入網址和帳號密碼給廠商；廠商也可以登入後自己改資料。',
  bank: '廠商的收款帳號。勾「預設」的那個會自動帶進元大出款檔。戶名要跟存摺一樣，不然匯款會被退回。\n銀行代碼 3 碼（元大 806、台新 812、國泰 013…），分行代碼 4 碼。',
};
const TOUR = [
  { sel: '[data-tour="vm-new"]', title: '新建廠商', body: '按這裡，一次填好基本資料、登入帳號密碼、出款資訊。' },
  { sel: '[data-tour="vm-list"]', title: '廠商清單', body: '每家廠商的登入帳號、預設收款帳號都列在這裡；沒設出款資訊的會標紅。點一家可以修改。' },
];
// 一鍵列印廠商帳號密碼＋登入網址（2026-10-21）：密碼只存 hash，所以只有「剛建立／剛改密碼」時畫面上還有明碼才印得出來
function printCredentials({ name, username, password, contact }) {
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(VENDOR_LOGIN)}`;
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) { alert('瀏覽器擋了彈出視窗，請允許後再按一次'); return; }
  const esc = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>廠商入口登入資料 - ${esc(name)}</title>
<style>body{font-family:"Noto Sans TC",system-ui,sans-serif;color:#2d3748;padding:36px;max-width:640px;margin:0 auto}h1{font-size:22px;margin:0 0 4px}.sub{color:#718096;font-size:13px;margin-bottom:24px}
.box{border:1px solid #cbd5e0;border-radius:10px;padding:18px 20px;margin-bottom:16px}.row{display:flex;gap:12px;align-items:baseline;margin:10px 0}.k{width:96px;color:#718096;font-size:13px}.v{font-size:20px;font-weight:700;letter-spacing:1px;font-family:ui-monospace,Menlo,monospace}
.url{font-size:15px;word-break:break-all}.qr{float:right;margin-left:16px}ol{font-size:14px;line-height:1.8;padding-left:20px}.note{font-size:12px;color:#718096;margin-top:20px}@media print{.noprint{display:none}}</style></head><body>
<h1>樂活眼鏡 廠商入口 登入資料</h1><div class="sub">廠商：${esc(name)}${contact ? `　聯絡人：${esc(contact)}` : ''}　列印日期：${new Date().toLocaleDateString('zh-TW')}</div>
<div class="box"><img class="qr" src="${qr}" width="150" height="150" alt="QR"><div class="row"><span class="k">登入網址</span><span class="url">${VENDOR_LOGIN}</span></div>
<div class="row"><span class="k">帳號</span><span class="v">${esc(username)}</span></div><div class="row"><span class="k">密碼</span><span class="v">${esc(password)}</span></div><div style="clear:both"></div></div>
<div class="box"><b>使用方式</b><ol><li>用手機掃 QR Code 或在瀏覽器輸入上方網址。</li><li>輸入帳號、密碼登入。</li><li>登入後可上傳帳單請款、查看請款進度、修改聯絡資料與收款帳號。</li><li>建議第一次登入後到「廠商資料」自行更改密碼。</li></ol></div>
<div class="note">此文件含登入密碼，請妥善保管，勿轉傳。有問題請聯絡樂活眼鏡營運部。</div>
<div class="noprint" style="margin-top:20px"><button onclick="window.print()" style="padding:10px 18px;font-size:15px;cursor:pointer">🖨️ 列印</button></div>
<script>setTimeout(function(){window.print()},400)</script></body></html>`);
  w.document.close();
}

const emptyNew = { name: '', tax_id: '', contact_name: '', contact_phone: '', contact_email: '', notes: '', username: '', password: '', bank: { bank_code: '', branch_code: '', account_no: '', account_name: '' } };

export default function VendorManagePage() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');
  const { start, overlay } = useCoachMarks(TOUR, 'tour_vendor_manage_v1', true);
  const load = useCallback(async () => { setErr(''); try { const r = await vendorManageApi.list(); setList(r.data || []); } catch (e) { setErr(e.message || '讀取失敗'); } }, []);
  useEffect(() => { load(); }, [load]);
  const shown = list.filter((v) => !q || (v.name + (v.tax_id || '') + (v.contact_name || '')).includes(q));
  const current = list.find((v) => v.id === sel);
  return (
    <div style={{ padding: 20, background: C.bg, minHeight: '100vh' }}>
      {overlay}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, color: C.primary }}>🏭 廠商管理<HelpTip title="廠商管理" body={HELP.page} /></h2>
        <input placeholder="搜尋名稱／統編" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...input, width: 200 }} />
        <div style={{ flex: 1 }} />
        <button style={ghost} onClick={start}>📖 使用說明</button>
        <button data-tour="vm-new" style={btn(C.primary)} onClick={() => { setCreating(true); setSel(null); }}>＋ 新建廠商</button>
      </div>
      {err && <div style={{ ...card, color: C.danger }}>⚠ {err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) 1fr', gap: 14, alignItems: 'start' }}>
        <div data-tour="vm-list" style={card}>
          {shown.map((v) => {
            const def = (v.banks || []).find((b) => b.is_default) || (v.banks || [])[0];
            return (
              <div key={v.id} onClick={() => { setSel(v.id); setCreating(false); }} style={{ padding: '10px 8px', borderRadius: 8, cursor: 'pointer', background: sel === v.id ? '#f5f0ea' : 'transparent', borderBottom: `1px solid ${C.border}`, opacity: v.is_active ? 1 : 0.5 }}>
                <b>{v.name}</b>{!v.is_active && <span style={{ fontSize: 11, marginLeft: 6 }}>停用</span>}
                <div style={{ fontSize: 12, color: C.muted }}>{v.tax_id ? `統編 ${v.tax_id}・` : ''}{(v.accounts || [])[0] ? `帳號 ${v.accounts[0].username}` : <span style={{ color: C.danger }}>沒有登入帳號</span>}</div>
                <div style={{ fontSize: 12, color: def ? C.muted : C.danger }}>{def ? `出款 ${def.bank_code}-${def.branch_code || ''} 尾 ${String(def.account_no).slice(-5)}` : '⚠ 沒有出款資訊'}</div>
              </div>
            );
          })}
          {!shown.length && <div style={{ color: C.muted, fontSize: 13 }}>沒有廠商</div>}
        </div>
        <div>
          {creating ? <CreateForm onDone={async (s) => { setCreating(false); await load(); setSel(s.id); }} onCancel={() => setCreating(false)} />
            : current ? <Edit v={current} reload={load} /> : <div style={{ ...card, color: C.muted }}>點左邊一家廠商修改，或按「＋ 新建廠商」</div>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, wide }) { return <label style={{ fontSize: 12, color: C.muted, gridColumn: wide ? '1 / -1' : undefined }}>{label}<br />{children}</label>; }

function BankFields({ b, set }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
      <Field label="銀行代碼（3 碼）"><input value={b.bank_code} onChange={(e) => set({ ...b, bank_code: e.target.value })} placeholder="806" style={input} /></Field>
      <Field label="分行代碼（4 碼）"><input value={b.branch_code} onChange={(e) => set({ ...b, branch_code: e.target.value })} placeholder="0998" style={input} /></Field>
      <Field label="帳號"><input value={b.account_no} onChange={(e) => set({ ...b, account_no: e.target.value })} style={input} /></Field>
      <Field label="戶名（同存摺）"><input value={b.account_name} onChange={(e) => set({ ...b, account_name: e.target.value })} style={input} /></Field>
    </div>
  );
}

function CreateForm({ onDone, onCancel }) {
  const [f, setF] = useState(emptyNew);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [created, setCreated] = useState(null);
  const save = async () => {
    setBusy(true); setMsg('');
    try { const r = await vendorManageApi.create(f); if (f.username && f.password) setCreated({ data: r.data, name: f.name, username: f.username, password: f.password, contact: f.contact_name }); else onDone(r.data); }
    catch (e) { setMsg('⚠ ' + (e.message || '失敗')); } finally { setBusy(false); }
  };
  if (created) return (
    <div style={{ ...card, borderColor: C.ok }}>
      <b style={{ fontSize: 16 }}>✅ 廠商「{created.name}」已建立</b>
      <div style={{ fontSize: 13, color: C.muted, margin: '6px 0 12px' }}>密碼只有現在看得到（系統只存加密後的值），請現在列印或抄下來給廠商。</div>
      <div style={{ fontSize: 14, lineHeight: 1.9 }}>登入網址：{VENDOR_LOGIN}<br />帳號：<b>{created.username}</b><br />密碼：<b>{created.password}</b></div>
      <div style={{ marginTop: 12 }}>
        <button style={btn(C.primary)} onClick={() => printCredentials(created)}>🖨️ 一鍵列印帳號密碼＋登入網址</button>
        <button style={{ ...ghost, marginLeft: 8 }} onClick={() => onDone(created.data)}>完成</button>
      </div>
    </div>
  );
  return (
    <div>
      <div style={card}>
        <b>① 基本資料</b>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
          <Field label="廠商名稱 *"><input value={f.name} onChange={set('name')} style={input} /></Field>
          <Field label="統一編號"><input value={f.tax_id} onChange={set('tax_id')} style={input} /></Field>
          <Field label="聯絡人"><input value={f.contact_name} onChange={set('contact_name')} style={input} /></Field>
          <Field label="電話"><input value={f.contact_phone} onChange={set('contact_phone')} style={input} /></Field>
          <Field label="Email"><input value={f.contact_email} onChange={set('contact_email')} style={input} /></Field>
          <Field label="備註" wide><input value={f.notes} onChange={set('notes')} style={input} /></Field>
        </div>
      </div>
      <div style={card}>
        <b>② 廠商入口登入帳號</b><HelpTip title="登入帳號" body={HELP.account} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
          <Field label="帳號（英數字）"><input value={f.username} onChange={set('username')} autoComplete="off" style={input} /></Field>
          <Field label="密碼（至少 6 碼）"><input value={f.password} onChange={set('password')} autoComplete="new-password" style={input} /></Field>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>登入網址：{VENDOR_LOGIN}（可以先不設，之後再補）</div>
      </div>
      <div style={card}>
        <b>③ 出款資訊（收款銀行帳號）</b><HelpTip title="出款資訊" body={HELP.bank} />
        <div style={{ marginTop: 8 }}><BankFields b={f.bank} set={(bank) => setF({ ...f, bank })} /></div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>設好後，這家廠商的請款出款時會自動帶這個帳號。</div>
      </div>
      <button style={btn(C.primary)} disabled={busy} onClick={save}>{busy ? '建立中…' : '建立廠商'}</button>
      <button style={{ ...ghost, marginLeft: 8 }} onClick={onCancel}>取消</button>
      {msg && <span style={{ marginLeft: 10, color: C.danger, fontSize: 13 }}>{msg}</span>}
    </div>
  );
}

function Edit({ v, reload }) {
  const [f, setF] = useState(v);
  const [acc, setAcc] = useState({ username: '', password: '' });
  const [nb, setNb] = useState({ bank_code: '', branch_code: '', account_no: '', account_name: '' });
  const [msg, setMsg] = useState('');
  useEffect(() => { setF(v); setAcc({ username: (v.accounts || [])[0]?.username || '', password: '' }); setMsg(''); }, [v]);
  const act = async (fn, ok) => { setMsg(''); try { await fn(); setMsg(ok); await reload(); } catch (e) { setMsg('⚠ ' + (e.message || '失敗')); } };
  const a = (v.accounts || [])[0];
  return (
    <div>
      {msg && <div style={{ ...card, color: msg.startsWith('⚠') ? C.danger : C.ok }}>{msg}</div>}
      <div style={card}>
        <b>基本資料</b>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
          {[['name', '廠商名稱'], ['tax_id', '統一編號'], ['contact_name', '聯絡人'], ['contact_phone', '電話'], ['contact_email', 'Email'], ['notes', '備註']].map(([k, l]) => (
            <Field key={k} label={l}><input value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} style={input} /></Field>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <button style={btn(C.primary)} onClick={() => act(() => vendorManageApi.update(v.id, { name: f.name, tax_id: f.tax_id, contact_name: f.contact_name, contact_phone: f.contact_phone, contact_email: f.contact_email, notes: f.notes }), '已儲存')}>儲存</button>
          <button style={{ ...ghost, marginLeft: 8 }} onClick={() => act(() => vendorManageApi.update(v.id, { is_active: !v.is_active }), v.is_active ? '已停用' : '已啟用')}>{v.is_active ? '停用廠商' : '啟用廠商'}</button>
        </div>
      </div>
      <div style={card}>
        <b>廠商入口登入帳號</b><HelpTip title="登入帳號" body={HELP.account} />
        {a && <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>{a.is_active ? '使用中' : '已停用'}{a.last_login_at ? `・上次登入 ${new Date(a.last_login_at).toLocaleString('zh-TW')}` : '・還沒登入過'}</span>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
          <Field label="帳號"><input value={acc.username} onChange={(e) => setAcc({ ...acc, username: e.target.value })} autoComplete="off" style={input} /></Field>
          <Field label={a ? '新密碼（不改就空白）' : '密碼（至少 6 碼）'}><input value={acc.password} onChange={(e) => setAcc({ ...acc, password: e.target.value })} autoComplete="new-password" style={input} /></Field>
        </div>
        <div style={{ marginTop: 10 }}>
          <button style={btn(C.primary)} onClick={() => act(() => vendorManageApi.account(v.id, acc), a ? '帳號已更新' : '帳號已建立')}>{a ? '更新帳號／密碼' : '建立帳號'}</button>
          {a && <button style={{ ...ghost, marginLeft: 8 }} onClick={() => act(() => vendorManageApi.account(v.id, { is_active: !a.is_active }), a.is_active ? '帳號已停用' : '帳號已啟用')}>{a.is_active ? '停用帳號' : '啟用帳號'}</button>}
          <span style={{ fontSize: 12, color: C.muted, marginLeft: 10 }}>登入網址：{VENDOR_LOGIN}</span>
        </div>
        {a && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.border || '#e2e8f0'}` }}>
            <button style={btn(C.primary)} onClick={() => printCredentials({ name: v.name, username: acc.username || a.username, password: acc.password || '（密碼未變更；要重發請先在上方填新密碼並按「更新帳號／密碼」）', contact: v.contact_name })}>🖨️ 列印帳號密碼＋登入網址</button>
            <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>密碼只存加密值，印出來的是你現在填在「新密碼」欄的值；沒填就只印帳號與網址。</span>
          </div>
        )}
      </div>
      <div style={card}>
        <b>出款資訊（收款銀行帳號）</b><HelpTip title="出款資訊" body={HELP.bank} />
        <table style={{ width: '100%', fontSize: 13, marginTop: 8, borderCollapse: 'collapse' }}>
          <tbody>
            {(v.banks || []).map((b) => (
              <tr key={b.id} style={{ borderTop: '1px solid #f1ede6' }}>
                <td style={{ padding: 4 }}>{b.is_default ? <b style={{ color: C.ok }}>預設</b> : ''}</td>
                <td style={{ padding: 4 }}>{b.bank_code}-{b.branch_code || '—'}</td>
                <td style={{ padding: 4 }}>{b.account_no}</td>
                <td style={{ padding: 4 }}>{b.account_name}</td>
                <td style={{ padding: 4, textAlign: 'right' }}>
                  {!b.is_default && <button style={{ ...ghost, padding: '3px 8px' }} onClick={() => act(() => vendorManageApi.updateBank(v.id, b.id, { is_default: true }), '已設為預設')}>設為預設</button>}
                  <button style={{ ...ghost, padding: '3px 8px', marginLeft: 4 }} onClick={() => { if (window.confirm('刪除這個收款帳號？')) act(() => vendorManageApi.deleteBank(v.id, b.id), '已刪除'); }}>刪</button>
                </td>
              </tr>
            ))}
            {!(v.banks || []).length && <tr><td style={{ color: C.danger, padding: 4 }}>⚠ 還沒有出款資訊，這家廠商的請款沒辦法匯出元大檔</td></tr>}
          </tbody>
        </table>
        <div style={{ marginTop: 10, padding: 10, background: '#f7fafc', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>新增收款帳號（第一個會自動設為預設）</div>
          <BankFields b={nb} set={setNb} />
          <button style={{ ...btn(C.primary), marginTop: 8 }} onClick={() => act(async () => { await vendorManageApi.addBank(v.id, nb); setNb({ bank_code: '', branch_code: '', account_no: '', account_name: '' }); }, '已新增收款帳號')}>新增</button>
        </div>
      </div>
    </div>
  );
}
