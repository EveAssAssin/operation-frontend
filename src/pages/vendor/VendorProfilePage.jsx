// pages/vendor/VendorProfilePage.jsx
// 廠商前台 — 基本資料 + 銀行帳號 管理

import { useState, useEffect, useCallback } from 'react';
import { vendorApi } from '../../services/api';

const C = {
  dark: '#50422d', mid: '#8b6f4e', bg: '#f5f0ea',
  bgCard: '#ffffff', border: '#e0d5c8',
  textDark: '#3a2e1e', textMid: '#6b5640', textLight: '#9a8878',
};

const btn = {
  primary: { padding: '8px 16px', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: C.dark, color: '#fff' },
  ghost:   { padding: '8px 16px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#fff', color: C.textDark },
  danger:  { padding: '6px 12px', border: '1px solid #fed7d7', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff5f5', color: '#c53030' },
  small:   { padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff', color: C.textDark },
};

const inputStyle = { width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, background: '#fff', boxSizing: 'border-box' };

export default function VendorProfilePage() {
  const [tab, setTab] = useState('contact');
  const [profile, setProfile] = useState(null);
  const [banks, setBanks] = useState([]);
  const [msg, setMsg] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [p, b] = await Promise.all([vendorApi.getProfile(), vendorApi.listBankAccounts()]);
      setProfile(p?.data || null);
      setBanks(Array.isArray(b?.data) ? b.data : []);
    } catch (e) { console.error(e); }
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  if (!profile) return <div style={{ padding: 40, color: C.textLight, textAlign: 'center' }}>載入中…</div>;

  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 22, color: C.textDark, marginBottom: 4 }}>👤 我的資料</h1>
      <p style={{ marginTop: 0, color: C.textLight, fontSize: 13 }}>
        維護聯絡資料 + 銀行帳號 — 銀行資料會用於樂活付款給您
      </p>

      {msg && <div style={{ padding: 10, borderRadius: 6, marginBottom: 12, background: msg.startsWith('✓') ? '#f0fff4' : '#fff0f0', color: msg.startsWith('✓') ? '#2d6a4f' : '#c53030', border: `1px solid ${msg.startsWith('✓') ? '#b7e4c7' : '#feb2b2'}` }}>{msg}</div>}

      <div style={{ display: 'flex', borderBottom: `2px solid ${C.border}`, marginBottom: 16 }}>
        {[
          { k: 'contact', l: '聯絡資料' },
          { k: 'bank',    l: `銀行帳號 (${banks.length})` },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: tab === t.k ? 700 : 500,
            color: tab === t.k ? C.dark : C.textMid,
            borderBottom: tab === t.k ? `3px solid ${C.dark}` : '3px solid transparent',
            marginBottom: -2,
          }}>{t.l}</button>
        ))}
      </div>

      {tab === 'contact' && <ContactTab profile={profile} onSaved={(m) => { setMsg(m); loadAll(); }} />}
      {tab === 'bank'    && <BankTab banks={banks} onChanged={loadAll} />}
    </div>
  );
}

function ContactTab({ profile, onSaved }) {
  const [form, setForm] = useState({
    short_name:      profile.short_name || '',
    contact_name:    profile.contact_name || '',
    contact_phone:   profile.contact_phone || '',
    contact_email:   profile.contact_email || '',
    contact_line_id: profile.contact_line_id || '',
    address:         profile.address || '',
    notes:           profile.notes || '',
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const r = await vendorApi.updateProfile(form);
      onSaved(r.success ? '✓ 已儲存' : '✗ ' + r.message);
    } catch (e) { onSaved('✗ ' + e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ background: C.bgCard, padding: 20, borderRadius: 8, border: `1px solid ${C.border}` }}>
      <div style={{ marginBottom: 14, padding: 10, background: '#fff8ec', borderRadius: 6, fontSize: 12, color: C.textMid }}>
        📌 名稱：<b>{profile.name}</b> / 代碼：{profile.code || '—'} / 統編：{profile.tax_id || '—'}
        <div style={{ marginTop: 4, color: C.textLight }}>※ 廠商名稱與代碼由樂活管理員設定，如需變更請聯絡管理員</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="廠商縮寫（用於匯款附言，例：精華光學 → 精華）">
          <input style={inputStyle} value={form.short_name} placeholder="例：精華"
                 onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="聯絡人">
            <input style={inputStyle} value={form.contact_name}
                   onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
          </Field>
          <Field label="聯絡電話">
            <input style={inputStyle} value={form.contact_phone}
                   onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="E-mail">
            <input style={inputStyle} value={form.contact_email}
                   onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
          </Field>
          <Field label="LINE ID">
            <input style={inputStyle} value={form.contact_line_id} placeholder="@xxx 或 ID"
                   onChange={e => setForm(f => ({ ...f, contact_line_id: e.target.value }))} />
          </Field>
        </div>
        <Field label="地址">
          <input style={inputStyle} value={form.address}
                 onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        </Field>
        <Field label="備註">
          <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={save} disabled={busy} style={btn.primary}>{busy ? '處理中…' : '💾 儲存'}</button>
        </div>
      </div>
    </div>
  );
}

function BankTab({ banks, onChanged }) {
  const [editing, setEditing] = useState(null); // null | {} 新增 | row 編輯
  const [form, setForm] = useState({ bank_code: '', branch_code: '', account_no: '', account_name: '', is_default: false, note: '' });
  const [busy, setBusy] = useState(false);

  function startNew() {
    setEditing({});
    setForm({ bank_code: '', branch_code: '', account_no: '', account_name: '', is_default: banks.length === 0, note: '' });
  }
  function startEdit(b) {
    setEditing(b);
    setForm({ bank_code: b.bank_code, branch_code: b.branch_code || '', account_no: b.account_no, account_name: b.account_name, is_default: !!b.is_default, note: b.note || '' });
  }
  async function save() {
    if (!form.bank_code || !form.account_no || !form.account_name) return alert('銀行代號 / 帳號 / 戶名 必填');
    setBusy(true);
    try {
      if (editing.id) await vendorApi.updateBankAccount(editing.id, form);
      else            await vendorApi.createBankAccount(form);
      setEditing(null);
      onChanged();
    } catch (e) { alert('失敗：' + e.message); }
    finally { setBusy(false); }
  }
  async function del(id) {
    if (!window.confirm('確定刪除？')) return;
    try { await vendorApi.deleteBankAccount(id); onChanged(); }
    catch (e) { alert('失敗：' + e.message); }
  }

  return (
    <div style={{ background: C.bgCard, padding: 20, borderRadius: 8, border: `1px solid ${C.border}` }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: C.textMid }}>樂活付款給您時會匯到「預設」的帳號</div>
        {!editing && <button onClick={startNew} style={btn.primary}>+ 新增銀行帳號</button>}
      </div>

      {editing && (
        <div style={{ padding: 14, background: '#fff8ec', border: `1px solid #e5c99a`, borderRadius: 8, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 10 }}>
            {editing.id ? '✏️ 編輯銀行帳號' : '➕ 新增銀行帳號'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 110px 1fr', gap: 8, marginBottom: 8 }}>
            <input style={inputStyle} placeholder="總行 3 碼" value={form.bank_code}
                   onChange={e => setForm(f => ({ ...f, bank_code: e.target.value }))} />
            <input style={inputStyle} placeholder="分行 4 碼" value={form.branch_code}
                   onChange={e => setForm(f => ({ ...f, branch_code: e.target.value }))} />
            <input style={inputStyle} placeholder="帳號" value={form.account_no}
                   onChange={e => setForm(f => ({ ...f, account_no: e.target.value }))} />
          </div>
          <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="戶名" value={form.account_name}
                 onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} />
          <input style={{ ...inputStyle, marginBottom: 10 }} placeholder="備註（選填）" value={form.note}
                 onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13 }}>
            <input type="checkbox" checked={form.is_default}
                   onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
            <span>設為預設（預設用此帳號收款）</span>
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setEditing(null)} style={btn.ghost}>取消</button>
            <button onClick={save} disabled={busy} style={btn.primary}>{busy ? '…' : '💾 儲存'}</button>
          </div>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead style={{ background: C.bg }}>
          <tr>
            <th style={th}>總行</th><th style={th}>分行</th><th style={th}>帳號</th>
            <th style={th}>戶名</th><th style={th}>預設</th><th style={th}>操作</th>
          </tr>
        </thead>
        <tbody>
          {banks.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: C.textLight, padding: 20 }}>尚未新增銀行帳號</td></tr>}
          {banks.map(b => (
            <tr key={b.id}>
              <td style={td}>{b.bank_code}</td>
              <td style={td}>{b.branch_code || '—'}</td>
              <td style={{ ...td, fontFamily: 'monospace' }}>{b.account_no}</td>
              <td style={td}>{b.account_name}</td>
              <td style={td}>
                {b.is_default && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>預設</span>}
              </td>
              <td style={td}>
                <button onClick={() => startEdit(b)} style={{ ...btn.small, marginRight: 4 }}>編輯</button>
                <button onClick={() => del(b.id)}    style={btn.danger}>刪除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

const th = { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.textDark, borderBottom: `1px solid ${C.border}` };
const td = { padding: '10px 12px', fontSize: 13, color: C.textDark, borderTop: `1px solid ${C.border}` };
