// pages/billing/BillingV2Page.jsx
// 開帳系統 v2：帳單管理（來源單位 / 會計科目 / 帳單建立與審核）

import { useState, useEffect, useCallback } from 'react';
import { billingV2Api, personnelApi, billingApi, vendorPaymentApi, paymentBatchApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// ── 廠商帳號管理面板 ──────────────────────────────────────────
function VendorAccountsPanel({ sources, onSourceUpdate }) {
  const [accounts, setAccounts]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [msg, setMsg]             = useState('');
  const [resetPwdId, setResetPwdId] = useState(null);
  const [newPwd, setNewPwd]       = useState('');
  const [detailSource, setDetailSource] = useState(null);   // { source } 開啟廠商詳細編輯
  const [form, setForm] = useState({
    source_id: '',
    username: '',
    password: '',
    notes: '',
  });

  const vendorSources = sources.filter(s => s.source_type === 'vendor');

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await billingV2Api.getVendorAccounts();
      if (res.success) setAccounts(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const handleCreate = async () => {
    setError('');
    if (!form.source_id || !form.username || !form.password) {
      setError('請填寫：廠商來源、帳號名稱、初始密碼');
      return;
    }
    if (form.password.length < 6) { setError('密碼至少 6 個字元'); return; }
    setSaving(true);
    try {
      const res = await billingV2Api.createVendorAccount(form);
      if (res.success) {
        setMsg('✓ 帳號建立成功');
        setShowForm(false);
        setForm({ source_id: '', username: '', password: '', notes: '' });
        loadAccounts();
      } else setError(res.message);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (account) => {
    try {
      const res = await billingV2Api.updateVendorAccount(account.id, { is_active: !account.is_active });
      if (res.success) {
        setMsg(`✓ 帳號已${!account.is_active ? '啟用' : '停用'}`);
        loadAccounts();
      }
    } catch (err) { setMsg(`✗ ${err.message}`); }
  };

  const handleResetPwd = async (id) => {
    if (!newPwd || newPwd.length < 6) { alert('密碼至少 6 個字元'); return; }
    try {
      const res = await billingV2Api.updateVendorAccount(id, { password: newPwd });
      if (res.success) {
        setMsg('✓ 密碼已重設');
        setResetPwdId(null);
        setNewPwd('');
      }
    } catch (err) { setMsg(`✗ ${err.message}`); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>廠商帳號管理</h3>
        <button onClick={() => { setShowForm(!showForm); setError(''); }} style={primaryBtn}>
          {showForm ? '取消' : '＋ 新增帳號'}
        </button>
      </div>

      {msg && (
        <div style={msg.startsWith('✓') ? successBox : errorBox}>{msg}
          <button onClick={() => setMsg('')}
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>✕</button>
        </div>
      )}

      {showForm && (
        <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          {error && <div style={errorBox}>{error}</div>}
          {vendorSources.length === 0 ? (
            <div style={{ color: '#718096', fontSize: 13 }}>
              ⚠️ 目前沒有「廠商費用」類型的來源單位，請先在「來源單位」分頁建立廠商。
            </div>
          ) : (
            <>
              <div style={formGrid}>
                <div style={formField}>
                  <label style={labelStyle}>廠商來源 *</label>
                  <select style={selectStyle} value={form.source_id}
                    onChange={e => setForm(f => ({ ...f, source_id: e.target.value }))}>
                    <option value="">— 選擇廠商 —</option>
                    {vendorSources.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div style={formField}>
                  <label style={labelStyle}>帳號名稱 *</label>
                  <input style={inputStyle} value={form.username} placeholder="如：vendor_abc"
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                </div>
                <div style={formField}>
                  <label style={labelStyle}>初始密碼 * （至少6字元）</label>
                  <input type="password" style={inputStyle} value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                <div style={formField}>
                  <label style={labelStyle}>備註</label>
                  <input style={inputStyle} value={form.notes} placeholder="如：ABC廠商聯絡人帳號"
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button onClick={() => setShowForm(false)} style={cancelBtn}>取消</button>
                <button onClick={handleCreate} disabled={saving} style={primaryBtn}>
                  {saving ? '建立中…' : '建立帳號'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#718096' }}>載入中…</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f7fafc' }}>
              <th style={th}>帳號</th>
              <th style={th}>對應廠商</th>
              <th style={th}>狀態</th>
              <th style={th}>最後登入</th>
              <th style={th}>備註</th>
              <th style={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(acc => (
              <>
                <tr key={acc.id} style={trHover}>
                  <td style={{ ...td, fontWeight: 600 }}>{acc.username}</td>
                  <td style={td}>
                    <span style={{
                      display: 'inline-block', fontSize: 11, padding: '2px 8px',
                      borderRadius: 99, background: '#f0e6ff', color: '#6b46c1',
                      border: '1px solid #d6bcfa', fontWeight: 600,
                    }}>
                      {acc.billing_sources?.name || '—'}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: acc.is_active ? '#38a169' : '#e53e3e',
                    }}>
                      {acc.is_active ? '✓ 啟用中' : '✗ 已停用'}
                    </span>
                  </td>
                  <td style={{ ...td, color: '#718096' }}>
                    {acc.last_login_at
                      ? new Date(acc.last_login_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })
                      : '從未登入'}
                  </td>
                  <td style={{ ...td, color: '#718096' }}>{acc.notes || '—'}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => toggleActive(acc)}
                        style={{
                          ...smallBtn,
                          background: acc.is_active ? '#fff5f5' : '#f0fff4',
                          color:      acc.is_active ? '#c53030' : '#276749',
                          border:     acc.is_active ? '1px solid #fed7d7' : '1px solid #c6f6d5',
                        }}>
                        {acc.is_active ? '停用' : '啟用'}
                      </button>
                      <button
                        onClick={() => { setResetPwdId(acc.id); setNewPwd(''); }}
                        style={{ ...smallBtn, background: '#f5f0ea', color: '#50422d', border: '1px solid #cdbea2' }}>
                        重設密碼
                      </button>
                      <button
                        onClick={() => {
                          const src = sources.find(s => s.id === acc.source_id);
                          if (src) setDetailSource(src);
                        }}
                        style={{ ...smallBtn, background: '#fff8ec', color: '#8b6f4e', border: '1px solid #e5c99a' }}>
                        📝 廠商資料 / 銀行
                      </button>
                    </div>
                  </td>
                </tr>
                {resetPwdId === acc.id && (
                  <tr key={`${acc.id}-pwd`} style={{ background: '#fffaf0' }}>
                    <td colSpan={6} style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#718096' }}>
                          為 <strong>{acc.username}</strong> 設定新密碼：
                        </span>
                        <input
                          type="password"
                          style={{ ...inputStyle, width: 200 }}
                          placeholder="新密碼（至少6字元）"
                          value={newPwd}
                          onChange={e => setNewPwd(e.target.value)}
                          autoFocus
                        />
                        <button
                          onClick={() => handleResetPwd(acc.id)}
                          style={{ ...primaryBtn, background: '#d69e2e' }}>
                          確認重設
                        </button>
                        <button
                          onClick={() => setResetPwdId(null)}
                          style={cancelBtn}>
                          取消
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...td, textAlign: 'center', color: '#a0aec0', padding: 32 }}>
                  尚無廠商帳號
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {detailSource && (
        <VendorDetailModal
          source={detailSource}
          onClose={() => { setDetailSource(null); onSourceUpdate?.(); }}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  廠商詳細編輯 Modal — 聯絡資料 + 銀行帳號
// ════════════════════════════════════════════════════════════
function VendorDetailModal({ source, onClose }) {
  const [tab, setTab] = useState('contact');   // contact | bank
  const [form, setForm] = useState({
    short_name:      source.short_name      || '',
    contact_name:    source.contact_name    || '',
    contact_phone:   source.contact_phone   || '',
    contact_email:   source.contact_email   || '',
    contact_line_id: source.contact_line_id || '',
    tax_id:          source.tax_id          || '',
    address:         source.address         || '',
    notes:           source.notes           || '',
  });
  const [banks, setBanks]   = useState([]);
  const [busy, setBusy]     = useState(false);
  const [msg, setMsg]       = useState('');
  const [bankForm, setBankForm] = useState({ bank_code: '', branch_code: '', account_no: '', account_name: '', is_default: false, note: '' });
  const [editingBankId, setEditingBankId] = useState(null);

  const loadBanks = useCallback(async () => {
    try {
      const r = await vendorPaymentApi.listBankAccounts(source.id);
      setBanks(Array.isArray(r?.data) ? r.data : []);
    } catch (e) { console.error(e); }
  }, [source.id]);

  useEffect(() => { loadBanks(); }, [loadBanks]);

  async function saveContact() {
    setBusy(true);
    try {
      const res = await billingV2Api.updateSource(source.id, form);
      if (res.success) setMsg('✓ 已儲存');
      else setMsg('✗ ' + res.message);
    } catch (e) { setMsg('✗ ' + e.message); }
    finally { setBusy(false); setTimeout(() => setMsg(''), 3000); }
  }

  async function saveBank() {
    if (!bankForm.bank_code || !bankForm.account_no || !bankForm.account_name) {
      return alert('銀行代號 / 帳號 / 戶名 必填');
    }
    setBusy(true);
    try {
      if (editingBankId) {
        await vendorPaymentApi.updateBankAccount(editingBankId, bankForm);
      } else {
        await vendorPaymentApi.createBankAccount(source.id, bankForm);
      }
      setBankForm({ bank_code: '', branch_code: '', account_no: '', account_name: '', is_default: false, note: '' });
      setEditingBankId(null);
      loadBanks();
    } catch (e) { alert('失敗：' + e.message); }
    finally { setBusy(false); }
  }

  async function deleteBank(id) {
    if (!window.confirm('刪除此銀行帳號？')) return;
    try { await vendorPaymentApi.deleteBankAccount(id); loadBanks(); }
    catch (e) { alert('失敗：' + e.message); }
  }

  function editBank(b) {
    setEditingBankId(b.id);
    setBankForm({
      bank_code: b.bank_code, branch_code: b.branch_code || '',
      account_no: b.account_no, account_name: b.account_name,
      is_default: !!b.is_default, note: b.note || '',
    });
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 10, width: '100%', maxWidth: 720, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0d5c8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#3a2e1e' }}>📝 {source.name}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b5640' }}>×</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #e0d5c8' }}>
          <button onClick={() => setTab('contact')} style={{
            flex: 1, padding: '12px', border: 'none', cursor: 'pointer',
            background: tab === 'contact' ? '#fff' : '#f5f0ea',
            color: tab === 'contact' ? '#50422d' : '#6b5640',
            fontWeight: tab === 'contact' ? 700 : 500, fontSize: 13,
            borderBottom: tab === 'contact' ? '2px solid #50422d' : '2px solid transparent',
          }}>👤 聯絡 / 基本資料</button>
          <button onClick={() => setTab('bank')} style={{
            flex: 1, padding: '12px', border: 'none', cursor: 'pointer',
            background: tab === 'bank' ? '#fff' : '#f5f0ea',
            color: tab === 'bank' ? '#50422d' : '#6b5640',
            fontWeight: tab === 'bank' ? 700 : 500, fontSize: 13,
            borderBottom: tab === 'bank' ? '2px solid #50422d' : '2px solid transparent',
          }}>🏦 銀行帳號（{banks.length}）</button>
        </div>

        <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
          {msg && <div style={msg.startsWith('✓') ? successBox : errorBox}>{msg}</div>}

          {tab === 'contact' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FieldRow label="廠商縮寫（匯款附言用，例：精華光學 → 精華）">
                <input style={inputStyle} value={form.short_name}
                  onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))}
                  placeholder="例：精華" />
              </FieldRow>
              <FieldRow label="統編 / 身分證">
                <input style={inputStyle} value={form.tax_id}
                  onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} />
              </FieldRow>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FieldRow label="聯絡人">
                  <input style={inputStyle} value={form.contact_name}
                    onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
                </FieldRow>
                <FieldRow label="聯絡電話">
                  <input style={inputStyle} value={form.contact_phone}
                    onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
                </FieldRow>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FieldRow label="E-mail">
                  <input style={inputStyle} value={form.contact_email}
                    onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
                </FieldRow>
                <FieldRow label="LINE ID">
                  <input style={inputStyle} value={form.contact_line_id}
                    onChange={e => setForm(f => ({ ...f, contact_line_id: e.target.value }))}
                    placeholder="@xxx 或 ID" />
                </FieldRow>
              </div>
              <FieldRow label="地址">
                <input style={inputStyle} value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </FieldRow>
              <FieldRow label="備註">
                <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </FieldRow>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={saveContact} disabled={busy} style={primaryBtn}>
                  {busy ? '處理中...' : '💾 儲存聯絡資料'}
                </button>
              </div>
            </div>
          )}

          {tab === 'bank' && (
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
                <thead>
                  <tr style={{ background: '#f5f0ea' }}>
                    <th style={th}>銀行代號</th>
                    <th style={th}>分行</th>
                    <th style={th}>帳號</th>
                    <th style={th}>戶名</th>
                    <th style={th}>預設</th>
                    <th style={th}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {banks.length === 0 && (
                    <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#a0aec0', padding: 16 }}>尚無銀行帳號</td></tr>
                  )}
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
                        <button onClick={() => editBank(b)}  style={{ ...smallBtn, marginRight: 4 }}>編輯</button>
                        <button onClick={() => deleteBank(b.id)} style={{ ...smallBtn, background: '#fff5f5', color: '#c53030', border: '1px solid #fed7d7' }}>刪除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: '2px dashed #cdbea2', paddingTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#3a2e1e', marginBottom: 8 }}>
                  {editingBankId ? '✏️ 編輯銀行帳號' : '➕ 新增銀行帳號'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 100px 1fr', gap: 8, marginBottom: 8 }}>
                  <input style={inputStyle} placeholder="總行 3 碼" value={bankForm.bank_code}
                    onChange={e => setBankForm(f => ({ ...f, bank_code: e.target.value }))} />
                  <input style={inputStyle} placeholder="分行 4 碼" value={bankForm.branch_code}
                    onChange={e => setBankForm(f => ({ ...f, branch_code: e.target.value }))} />
                  <input style={inputStyle} placeholder="帳號" value={bankForm.account_no}
                    onChange={e => setBankForm(f => ({ ...f, account_no: e.target.value }))} />
                </div>
                <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="戶名" value={bankForm.account_name}
                  onChange={e => setBankForm(f => ({ ...f, account_name: e.target.value }))} />
                <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="備註（選填）" value={bankForm.note}
                  onChange={e => setBankForm(f => ({ ...f, note: e.target.value }))} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13 }}>
                  <input type="checkbox" checked={bankForm.is_default}
                    onChange={e => setBankForm(f => ({ ...f, is_default: e.target.checked }))} />
                  <span>設為預設（請款時預設用此帳號）</span>
                </label>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {editingBankId && (
                    <button onClick={() => {
                      setEditingBankId(null);
                      setBankForm({ bank_code: '', branch_code: '', account_no: '', account_name: '', is_default: false, note: '' });
                    }} style={cancelBtn}>取消</button>
                  )}
                  <button onClick={saveBank} disabled={busy} style={primaryBtn}>
                    {busy ? '...' : (editingBankId ? '💾 更新' : '➕ 新增')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6b5640', marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

// ════════════════════════════════════════════════════════════
//   廠商請款審核面板 — 會計列待審/已通過/已撥款/已退回 + 操作
// ════════════════════════════════════════════════════════════
const REQ_STATUS_LABEL = {
  draft:     '草稿',
  submitted: '待審',
  approved:  '已通過',
  paid:      '已撥款',
  rejected:  '已退回',
};
const REQ_STATUS_COLOR = {
  draft:     ['#f3f3f3', '#666',     '#ccc'],
  submitted: ['#fff8ec', '#8b6f4e',  '#e5c99a'],
  approved:  ['#f0fff4', '#2d6a4f',  '#b7e4c7'],
  paid:      ['#e6fffa', '#2c7a7b',  '#81e6d9'],
  rejected:  ['#fff0f0', '#c53030',  '#feb2b2'],
};

function VendorPaymentReviewPanel({ sources }) {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState({ status: 'submitted', source_id: '', period: '', keyword: '' });
  const [detail, setDetail]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.status)    params.status    = filter.status;
      if (filter.source_id) params.source_id = filter.source_id;
      if (filter.period)    params.period    = filter.period;
      if (filter.keyword)   params.keyword   = filter.keyword;
      const r = await vendorPaymentApi.listRequests(params);
      setList(Array.isArray(r?.data) ? r.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const vendorSources = sources.filter(s => s.source_type === 'vendor');

  // 快捷統計
  const counts = list.reduce((m, r) => { m[r.status] = (m[r.status] || 0) + 1; return m; }, {});

  return (
    <div>
      {/* 篩選列 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={selectStyle} value={filter.status}
                onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="">全部狀態</option>
          <option value="submitted">⏳ 待審</option>
          <option value="approved">✓ 已通過</option>
          <option value="paid">💰 已撥款</option>
          <option value="rejected">✗ 已退回</option>
          <option value="draft">📝 草稿</option>
        </select>
        <select style={selectStyle} value={filter.source_id}
                onChange={e => setFilter(f => ({ ...f, source_id: e.target.value }))}>
          <option value="">全部廠商</option>
          {vendorSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input style={{ ...inputStyle, width: 110 }} type="month" value={filter.period}
               onChange={e => setFilter(f => ({ ...f, period: e.target.value }))} />
        <input style={{ ...inputStyle, width: 200 }} placeholder="🔍 搜尋（單號 / 標題）"
               value={filter.keyword} onChange={e => setFilter(f => ({ ...f, keyword: e.target.value }))} />
        <button onClick={load} style={cancelBtn}>↻ 重新整理</button>
      </div>

      {/* 統計 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, fontSize: 12 }}>
        {Object.entries(REQ_STATUS_LABEL).map(([k, label]) => {
          const [bg, color, border] = REQ_STATUS_COLOR[k];
          return (
            <button key={k}
              onClick={() => setFilter(f => ({ ...f, status: k }))}
              style={{
                padding: '4px 10px', borderRadius: 999, border: `1px solid ${border}`,
                background: filter.status === k ? bg : '#fff', color,
                cursor: 'pointer', fontWeight: 600,
              }}>
              {label} {counts[k] || 0}
            </button>
          );
        })}
      </div>

      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0d5c8', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: '#f5f0ea' }}>
            <tr>
              <th style={th}>單號 / 月份</th>
              <th style={th}>廠商</th>
              <th style={th}>標題</th>
              <th style={{ ...th, textAlign: 'right' }}>金額</th>
              <th style={th}>附言</th>
              <th style={th}>狀態</th>
              <th style={th}>送審時間</th>
              <th style={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', padding: 20 }}>載入中...</td></tr>}
            {!loading && list.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#a0aec0', padding: 20 }}>無資料</td></tr>}
            {!loading && list.map(r => {
              const [bg, color, border] = REQ_STATUS_COLOR[r.status] || REQ_STATUS_COLOR.draft;
              return (
                <tr key={r.id} style={trHover}>
                  <td style={td}>
                    <b style={{ fontFamily: 'monospace' }}>{r.request_no || '—'}</b>
                    <div style={{ fontSize: 11, color: '#a0aec0' }}>{r.period}</div>
                  </td>
                  <td style={td}>{r.source?.name || '—'}</td>
                  <td style={td}>{r.title}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                    {fmtMoney(r.total_amount)}
                  </td>
                  <td style={td}>
                    <code style={{ fontSize: 11, color: '#6b5640' }}>{r.remit_memo || '—'}</code>
                  </td>
                  <td style={td}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: bg, color, border: `1px solid ${border}`,
                    }}>{REQ_STATUS_LABEL[r.status]}</span>
                  </td>
                  <td style={{ ...td, fontSize: 11, color: '#6b5640' }}>
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                  <td style={td}>
                    <button onClick={() => setDetail(r)} style={smallBtn}>檢視 / 操作</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detail && (
        <VendorPaymentDetailModal
          requestId={detail.id}
          onClose={() => { setDetail(null); load(); }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//   單筆請款詳情 + 審核操作
// ────────────────────────────────────────────────────────────
function VendorPaymentDetailModal({ requestId, onClose }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [invForm, setInvForm] = useState({ invoice_no: '', invoice_date: '', amount: '', pre_tax_amount: '', tax_amount: '', vendor_tax_id: '' });

  const load = useCallback(async () => {
    try {
      const r = await vendorPaymentApi.getRequest(requestId);
      setData(r?.data || null);
    } catch (e) { console.error(e); }
  }, [requestId]);

  useEffect(() => { load(); }, [load]);

  async function doApprove() {
    if (!window.confirm('確定通過此請款？')) return;
    setBusy(true);
    try { await vendorPaymentApi.approveRequest(requestId); load(); }
    catch (e) { alert('失敗：' + e.message); }
    finally { setBusy(false); }
  }
  async function doReject() {
    if (!rejectReason.trim()) return alert('請填寫退回原因');
    setBusy(true);
    try {
      await vendorPaymentApi.rejectRequest(requestId, rejectReason);
      setShowReject(false); setRejectReason('');
      load();
    } catch (e) { alert('失敗：' + e.message); }
    finally { setBusy(false); }
  }
  async function doMarkPaid() {
    if (!window.confirm('確定標記為已撥款？')) return;
    setBusy(true);
    try { await vendorPaymentApi.markPaid(requestId); load(); }
    catch (e) { alert('失敗：' + e.message); }
    finally { setBusy(false); }
  }
  async function doAddInvoice() {
    if (!invForm.invoice_no || !invForm.amount) return alert('發票號碼 + 金額必填');
    setBusy(true);
    try {
      await vendorPaymentApi.addInvoice(requestId, invForm);
      setShowAddInvoice(false);
      setInvForm({ invoice_no: '', invoice_date: '', amount: '', pre_tax_amount: '', tax_amount: '', vendor_tax_id: '' });
      load();
    } catch (e) { alert('失敗：' + e.message); }
    finally { setBusy(false); }
  }
  async function delInvoice(id) {
    if (!window.confirm('刪除此發票紀錄？')) return;
    try { await vendorPaymentApi.deleteInvoice(id); load(); }
    catch (e) { alert('失敗：' + e.message); }
  }

  if (!data) {
    return (
      <Modal title="載入中…" onClose={onClose} width={720}>
        <div style={{ padding: 30, textAlign: 'center', color: '#a0aec0' }}>載入中…</div>
      </Modal>
    );
  }

  const [bg, color, border] = REQ_STATUS_COLOR[data.status] || REQ_STATUS_COLOR.draft;
  const canApproveReject = data.status === 'submitted';
  const canMarkPaid      = data.status === 'approved';

  return (
    <Modal title={`📝 ${data.request_no} — ${data.title}`} onClose={onClose} width={800}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 摘要 */}
        <div style={{ background: '#f5f0ea', padding: 12, borderRadius: 6, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 13 }}>
          <div><span style={{ color: '#a0aec0' }}>廠商：</span>{data.source?.name}</div>
          <div><span style={{ color: '#a0aec0' }}>月份：</span>{data.period}</div>
          <div><span style={{ color: '#a0aec0' }}>金額：</span><b>{fmtMoney(data.total_amount)}</b></div>
          <div><span style={{ color: '#a0aec0' }}>狀態：</span>
            <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: bg, color, border: `1px solid ${border}` }}>
              {REQ_STATUS_LABEL[data.status]}
            </span>
          </div>
          <div><span style={{ color: '#a0aec0' }}>附言：</span><code style={{ fontSize: 12 }}>{data.remit_memo || '—'}</code></div>
          <div><span style={{ color: '#a0aec0' }}>建立者：</span>{data.created_by_type === 'vendor' ? '廠商自助' : '系統人員'}</div>
        </div>

        {data.description && (
          <div style={{ padding: 12, background: '#fff', border: '1px solid #e0d5c8', borderRadius: 6, fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {data.description}
          </div>
        )}

        {data.rejection_reason && (
          <div style={{ padding: 10, background: '#fff0f0', border: '1px solid #feb2b2', borderRadius: 6, fontSize: 12, color: '#c53030' }}>
            <b>退回原因：</b>{data.rejection_reason}
          </div>
        )}

        {/* 撥款帳號 */}
        {data.bank_account && (
          <div style={{ padding: 10, background: '#fff', border: '1px solid #e0d5c8', borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: '#a0aec0', marginBottom: 4 }}>🏦 撥款帳號</div>
            <div style={{ fontSize: 13 }}>
              <b>{data.bank_account.account_name}</b> · {data.bank_account.bank_code}-{data.bank_account.branch_code} · <code style={{ fontFamily: 'monospace' }}>{data.bank_account.account_no}</code>
            </div>
          </div>
        )}

        {/* 附件 */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>📎 附件（{data.files?.length || 0}）</div>
          {(!data.files || data.files.length === 0) && (
            <div style={{ fontSize: 12, color: '#a0aec0' }}>無附件</div>
          )}
          {(data.files || []).map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f5f0ea', borderRadius: 4, marginBottom: 4, fontSize: 12 }}>
              <span style={{
                padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                background: '#fff', color: '#6b5640', border: '1px solid #cdbea2',
              }}>{({ summary: '總表', detail: '明細', invoice: '發票', other: '其他' })[f.file_type]}</span>
              <a href={f.file_url} target="_blank" rel="noreferrer" style={{ color: '#3b5bdb', textDecoration: 'underline', flex: 1 }}>
                {f.file_name}
              </a>
              <span style={{ color: '#a0aec0' }}>{new Date(f.uploaded_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
          ))}
        </div>

        {/* 發票 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>🧾 發票（{data.invoices?.length || 0}）</div>
            <button onClick={() => setShowAddInvoice(s => !s)} style={smallBtn}>
              {showAddInvoice ? '取消' : '+ 新增發票紀錄'}
            </button>
          </div>

          {showAddInvoice && (
            <div style={{ padding: 10, background: '#fff8ec', border: '1px solid #e5c99a', borderRadius: 6, marginBottom: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                <input style={inputStyle} placeholder="發票號碼" value={invForm.invoice_no}
                       onChange={e => setInvForm(f => ({ ...f, invoice_no: e.target.value }))} />
                <input style={inputStyle} placeholder="開立統編" value={invForm.vendor_tax_id}
                       onChange={e => setInvForm(f => ({ ...f, vendor_tax_id: e.target.value }))} />
                <input type="date" style={inputStyle} value={invForm.invoice_date}
                       onChange={e => setInvForm(f => ({ ...f, invoice_date: e.target.value }))} />
                <input style={inputStyle} placeholder="含稅金額" type="number" value={invForm.amount}
                       onChange={e => setInvForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
                <button onClick={doAddInvoice} disabled={busy} style={primaryBtn}>儲存</button>
              </div>
            </div>
          )}

          {(!data.invoices || data.invoices.length === 0) ? (
            <div style={{ fontSize: 12, color: '#a0aec0' }}>無發票紀錄</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ background: '#f5f0ea' }}>
                <tr>
                  <th style={th}>發票號</th>
                  <th style={th}>日期</th>
                  <th style={th}>開立統編</th>
                  <th style={{ ...th, textAlign: 'right' }}>含稅</th>
                  <th style={{ ...th, textAlign: 'right' }}>稅額</th>
                  <th style={th}>可扣抵</th>
                  <th style={th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {(data.invoices || []).map(inv => (
                  <tr key={inv.id}>
                    <td style={td}><code>{inv.invoice_no}</code></td>
                    <td style={td}>{inv.invoice_date || '—'}</td>
                    <td style={td}>{inv.vendor_tax_id || '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(inv.amount)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{inv.tax_amount != null ? fmtMoney(inv.tax_amount) : '—'}</td>
                    <td style={td}>{inv.is_input_tax_eligible ? '✓' : '✗'}</td>
                    <td style={td}>
                      <button onClick={() => delInvoice(inv.id)} style={{ ...smallBtn, background: '#fff5f5', color: '#c53030', border: '1px solid #fed7d7' }}>刪</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 退回原因 input */}
        {showReject && (
          <div style={{ padding: 10, background: '#fff0f0', border: '1px solid #feb2b2', borderRadius: 6 }}>
            <div style={{ fontSize: 12, marginBottom: 4, color: '#c53030', fontWeight: 700 }}>退回原因</div>
            <textarea rows={2} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                      style={{ ...inputStyle, resize: 'vertical' }}
                      placeholder="請說明退回原因，廠商會在前台看到" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
              <button onClick={() => { setShowReject(false); setRejectReason(''); }} style={cancelBtn}>取消</button>
              <button onClick={doReject} disabled={busy} style={{ ...primaryBtn, background: '#c53030' }}>確認退回</button>
            </div>
          </div>
        )}

        {/* 操作 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #e0d5c8', paddingTop: 12 }}>
          <button onClick={onClose} style={cancelBtn}>關閉</button>
          {canApproveReject && (
            <>
              <button onClick={() => setShowReject(true)} disabled={busy}
                      style={{ ...cancelBtn, color: '#c53030', borderColor: '#feb2b2' }}>✗ 退回</button>
              <button onClick={doApprove} disabled={busy}
                      style={{ ...primaryBtn, background: '#2d6a4f' }}>✓ 通過</button>
            </>
          )}
          {canMarkPaid && (
            <button onClick={doMarkPaid} disabled={busy}
                    style={{ ...primaryBtn, background: '#2c7a7b' }}>💰 標記已撥款</button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
//   匯款批次面板（S2）
// ════════════════════════════════════════════════════════════
const BATCH_STATUS_LABEL = {
  preparing: '⏳ 準備中',
  exported:  '📤 已匯出',
  paid:      '💰 已撥款',
  cancelled: '✗ 已取消',
};
const BATCH_STATUS_COLOR = {
  preparing: ['#fff8ec', '#8b6f4e', '#e5c99a'],
  exported:  ['#e0f2fe', '#0369a1', '#7dd3fc'],
  paid:      ['#e6fffa', '#2c7a7b', '#81e6d9'],
  cancelled: ['#f3f3f3', '#888',    '#ccc'],
};

function PaymentBatchPanel() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const r = await paymentBatchApi.listBatches(params);
      setList(Array.isArray(r?.data) ? r.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterStatus]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <select style={selectStyle} value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}>
          <option value="">全部狀態</option>
          {Object.entries(BATCH_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => setCreating(true)} style={primaryBtn}>+ 建立批次</button>
      </div>

      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0d5c8', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: '#f5f0ea' }}>
            <tr>
              <th style={th}>批次號 / 撥款日</th>
              <th style={th}>付款方</th>
              <th style={{ ...th, textAlign: 'right' }}>金額</th>
              <th style={{ ...th, textAlign: 'right' }}>筆數</th>
              <th style={th}>狀態</th>
              <th style={th}>建立時間</th>
              <th style={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: 20 }}>載入中…</td></tr>}
            {!loading && list.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: 20, color: '#a0aec0' }}>尚無批次，點「+ 建立批次」</td></tr>}
            {!loading && list.map(b => {
              const [bg, color, border] = BATCH_STATUS_COLOR[b.status] || BATCH_STATUS_COLOR.preparing;
              return (
                <tr key={b.id} style={trHover}>
                  <td style={td}>
                    <b style={{ fontFamily: 'monospace' }}>{b.batch_no}</b>
                    <div style={{ fontSize: 11, color: '#a0aec0' }}>{b.payment_date}</div>
                  </td>
                  <td style={td}>{b.payer_account_name || '—'}<br /><span style={{ fontSize: 11, color: '#a0aec0', fontFamily: 'monospace' }}>{b.payer_bank_code}-{b.payer_branch_code}</span></td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                    {fmtMoney(b.total_amount)}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>{b.total_items}</td>
                  <td style={td}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: bg, color, border: `1px solid ${border}` }}>
                      {BATCH_STATUS_LABEL[b.status]}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 11, color: '#6b5640' }}>
                    {new Date(b.created_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td style={td}>
                    <button onClick={() => setDetail(b)} style={smallBtn}>檢視 / 操作</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {creating && <CreateBatchModal onClose={() => { setCreating(false); load(); }} />}
      {detail   && <BatchDetailModal batchId={detail.id} onClose={() => { setDetail(null); load(); }} />}
    </div>
  );
}

// ── 建立批次 ────────────────────────────────────────────────
function CreateBatchModal({ onClose }) {
  const [eligible, setEligible] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [filterPeriod, setFilterPeriod] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = filterPeriod ? { period: filterPeriod } : {};
      const r = await paymentBatchApi.listEligible(params);
      setEligible(Array.isArray(r?.data) ? r.data : []);
    } catch (e) { console.error(e); }
  }, [filterPeriod]);
  useEffect(() => { load(); }, [load]);

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === eligible.length) setSelected(new Set());
    else setSelected(new Set(eligible.map(r => r.id)));
  }

  const totalAmount = eligible
    .filter(r => selected.has(r.id))
    .reduce((s, r) => s + Number(r.total_amount || 0), 0);

  async function submit() {
    if (selected.size === 0) return alert('請至少選一筆');
    if (!paymentDate) return alert('撥款日必填');
    setBusy(true);
    try {
      await paymentBatchApi.createBatch({
        payment_date: paymentDate,
        request_ids:  Array.from(selected),
        note,
      });
      onClose();
    } catch (e) { alert('失敗：' + e.message); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="📥 建立匯款批次" onClose={onClose} width={900}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FieldRow label="撥款日 *">
            <input type="date" style={inputStyle} value={paymentDate}
                   onChange={e => setPaymentDate(e.target.value)} />
          </FieldRow>
          <FieldRow label="篩選月份（選填）">
            <input type="month" style={inputStyle} value={filterPeriod}
                   onChange={e => setFilterPeriod(e.target.value)} />
          </FieldRow>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: '#3a2e1e', marginTop: 4 }}>
          📋 可加入的已通過請款（{eligible.length} 筆）
        </div>
        <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #e0d5c8', borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ background: '#f5f0ea', position: 'sticky', top: 0 }}>
              <tr>
                <th style={{ ...th, width: 30 }}>
                  <input type="checkbox" checked={selected.size === eligible.length && eligible.length > 0}
                         onChange={toggleAll} />
                </th>
                <th style={th}>單號</th>
                <th style={th}>廠商</th>
                <th style={th}>月份</th>
                <th style={{ ...th, textAlign: 'right' }}>金額</th>
                <th style={th}>銀行</th>
                <th style={th}>附言</th>
              </tr>
            </thead>
            <tbody>
              {eligible.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#a0aec0', padding: 20 }}>無可加入的請款（必須是「已通過」）</td></tr>
              )}
              {eligible.map(r => (
                <tr key={r.id} style={{ background: selected.has(r.id) ? '#fff8ec' : undefined }}>
                  <td style={td}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                  <td style={td}><code>{r.request_no}</code></td>
                  <td style={td}>{r.source?.name}</td>
                  <td style={td}>{r.period}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtMoney(r.total_amount)}</td>
                  <td style={td}>
                    {r.bank_account ? (
                      <div style={{ fontSize: 11 }}>
                        {r.bank_account.bank_code}-{r.bank_account.branch_code}<br />
                        <code>{r.bank_account.account_no}</code> / {r.bank_account.account_name}
                      </div>
                    ) : <span style={{ color: '#c53030', fontSize: 11 }}>⚠ 未設定銀行</span>}
                  </td>
                  <td style={td}><code style={{ fontSize: 11 }}>{r.remit_memo || '—'}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <FieldRow label="批次備註（選填）">
          <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} value={note}
                    onChange={e => setNote(e.target.value)} />
        </FieldRow>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e0d5c8', paddingTop: 12 }}>
          <div style={{ fontSize: 14 }}>
            已選 <b>{selected.size}</b> 筆，合計 <b style={{ color: '#50422d' }}>{fmtMoney(totalAmount)}</b>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={cancelBtn}>取消</button>
            <button onClick={submit} disabled={busy || selected.size === 0} style={primaryBtn}>
              {busy ? '處理中…' : '建立批次'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── 批次詳情 ────────────────────────────────────────────────
function BatchDetailModal({ batchId, onClose }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await paymentBatchApi.getBatch(batchId);
      setData(r?.data || null);
    } catch (e) { console.error(e); }
  }, [batchId]);
  useEffect(() => { load(); }, [load]);

  async function downloadXlsx() {
    setBusy(true);
    try {
      const token = localStorage.getItem('operation_token');
      const baseURL = window.location.hostname === 'localhost' ? '/api' : (import.meta.env.VITE_API_URL || 'https://operation-backend.onrender.com/api');
      const url = baseURL + paymentBatchApi.exportBatchUrl(batchId);
      const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      if (!resp.ok) { alert('匯出失敗'); return; }
      const blob = await resp.blob();
      const cd = resp.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename\*=UTF-8''([^;]+)/);
      const filename = m ? decodeURIComponent(m[1]) : `${data.batch_no}.xlsx`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      load();
    } catch (e) { alert('失敗：' + e.message); }
    finally { setBusy(false); }
  }

  async function markPaid() {
    if (!window.confirm(`確認所有 ${data.total_items} 筆請款已實際撥款？\n標記後對應請款的狀態會變為「已撥款」`)) return;
    setBusy(true);
    try { await paymentBatchApi.markPaid(batchId); load(); }
    catch (e) { alert('失敗：' + e.message); }
    finally { setBusy(false); }
  }

  async function doCancel() {
    const reason = window.prompt('取消原因？');
    if (!reason) return;
    setBusy(true);
    try { await paymentBatchApi.cancelBatch(batchId, reason); load(); }
    catch (e) { alert('失敗：' + e.message); }
    finally { setBusy(false); }
  }

  if (!data) {
    return <Modal title="載入中…" onClose={onClose} width={900}><div style={{ padding: 30, textAlign: 'center' }}>載入中…</div></Modal>;
  }

  const [bg, color, border] = BATCH_STATUS_COLOR[data.status] || BATCH_STATUS_COLOR.preparing;

  return (
    <Modal title={`📦 ${data.batch_no}`} onClose={onClose} width={900}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ padding: 12, background: '#f5f0ea', borderRadius: 6, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 13 }}>
          <div><span style={{ color: '#a0aec0' }}>撥款日：</span>{data.payment_date}</div>
          <div><span style={{ color: '#a0aec0' }}>金額：</span><b>{fmtMoney(data.total_amount)}</b></div>
          <div><span style={{ color: '#a0aec0' }}>筆數：</span>{data.total_items}</div>
          <div><span style={{ color: '#a0aec0' }}>狀態：</span>
            <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: bg, color, border: `1px solid ${border}` }}>
              {BATCH_STATUS_LABEL[data.status]}
            </span>
          </div>
          <div><span style={{ color: '#a0aec0' }}>付款方：</span>{data.payer_account_name} <code style={{ fontSize: 11 }}>{data.payer_bank_code}-{data.payer_branch_code} / {data.payer_account_no}</code></div>
        </div>

        {data.cancelled_reason && (
          <div style={{ padding: 10, background: '#f3f3f3', border: '1px solid #ccc', borderRadius: 6, fontSize: 12 }}>
            <b>取消原因：</b>{data.cancelled_reason}
          </div>
        )}

        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>📋 明細（{data.items?.length || 0}）</div>
          <div style={{ maxHeight: 350, overflow: 'auto', border: '1px solid #e0d5c8', borderRadius: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ background: '#f5f0ea', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={th}>請款單號</th>
                  <th style={th}>廠商</th>
                  <th style={th}>銀行</th>
                  <th style={th}>戶名</th>
                  <th style={{ ...th, textAlign: 'right' }}>金額</th>
                  <th style={th}>附言</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map(it => (
                  <tr key={it.id}>
                    <td style={td}><code>{it.request?.request_no || '—'}</code></td>
                    <td style={td}>{it.source_name}</td>
                    <td style={td}>{it.bank_code}-{it.branch_code} <code style={{ fontSize: 11 }}>{it.account_no}</code></td>
                    <td style={td}>{it.account_name}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtMoney(it.amount)}</td>
                    <td style={td}><code style={{ fontSize: 11 }}>{it.memo || '—'}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #e0d5c8', paddingTop: 12 }}>
          <button onClick={onClose} style={cancelBtn}>關閉</button>
          {data.status !== 'paid' && data.status !== 'cancelled' && (
            <button onClick={doCancel} disabled={busy} style={{ ...cancelBtn, color: '#c53030', borderColor: '#feb2b2' }}>
              ✗ 取消批次
            </button>
          )}
          {data.status !== 'cancelled' && (
            <button onClick={downloadXlsx} disabled={busy} style={primaryBtn}>
              📥 下載元大格式 xlsx
            </button>
          )}
          {(data.status === 'exported' || data.status === 'preparing') && (
            <button onClick={markPaid} disabled={busy} style={{ ...primaryBtn, background: '#2c7a7b' }}>
              💰 標記已撥款
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}


// ════════════════════════════════════════════════════════════
//   進項發票面板
// ════════════════════════════════════════════════════════════
function InputInvoicePanel() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportLog, setExportLog] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await paymentBatchApi.listInputInvoices(period);
      setList(Array.isArray(r?.data) ? r.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [period]);

  const loadLog = useCallback(async () => {
    try {
      const r = await paymentBatchApi.listExportLog();
      setExportLog(Array.isArray(r?.data) ? r.data : []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { load(); loadLog(); }, [load, loadLog]);

  async function download() {
    try {
      const token = localStorage.getItem('operation_token');
      const baseURL = window.location.hostname === 'localhost' ? '/api' : (import.meta.env.VITE_API_URL || 'https://operation-backend.onrender.com/api');
      const url = baseURL + paymentBatchApi.exportInputInvoiceUrl(period);
      const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      if (!resp.ok) { alert('匯出失敗'); return; }
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `進項發票_${period}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      loadLog();
    } catch (e) { alert('失敗：' + e.message); }
  }

  const totalAmt = list.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalTax = list.reduce((s, r) => s + Number(r.tax_amount || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input type="month" style={{ ...inputStyle, width: 160 }} value={period}
               onChange={e => setPeriod(e.target.value)} />
        <button onClick={load} style={cancelBtn}>↻ 重新整理</button>
        <div style={{ flex: 1 }} />
        <button onClick={download} style={primaryBtn} disabled={list.length === 0}>
          📥 匯出 CSV（{list.length} 筆）
        </button>
      </div>

      <div style={{ marginBottom: 12, padding: 12, background: '#fff8ec', border: '1px solid #e5c99a', borderRadius: 6, fontSize: 13 }}>
        <b>{period}</b> 月份共 {list.length} 張發票 ｜
        含稅 <b>{fmtMoney(totalAmt)}</b> ｜
        稅額 <b>{fmtMoney(totalTax)}</b>
      </div>

      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0d5c8', overflow: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#f5f0ea' }}>
            <tr>
              <th style={th}>發票日期</th>
              <th style={th}>發票號碼</th>
              <th style={th}>廠商</th>
              <th style={th}>開立統編</th>
              <th style={{ ...th, textAlign: 'right' }}>未稅</th>
              <th style={{ ...th, textAlign: 'right' }}>稅額</th>
              <th style={{ ...th, textAlign: 'right' }}>含稅</th>
              <th style={th}>請款單號</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', padding: 20 }}>載入中…</td></tr>}
            {!loading && list.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', padding: 20, color: '#a0aec0' }}>該月無進項發票</td></tr>}
            {!loading && list.map(inv => (
              <tr key={inv.id}>
                <td style={td}>{inv.invoice_date}</td>
                <td style={td}><code>{inv.invoice_no}</code></td>
                <td style={td}>{inv.request?.source?.name || '—'}</td>
                <td style={td}>{inv.vendor_tax_id || '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{inv.pre_tax_amount != null ? fmtMoney(inv.pre_tax_amount) : '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{inv.tax_amount != null ? fmtMoney(inv.tax_amount) : '—'}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtMoney(inv.amount)}</td>
                <td style={td}><code>{inv.request?.request_no || '—'}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 匯出歷史 */}
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: '#3a2e1e' }}>🕐 匯出歷史</div>
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0d5c8', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#f5f0ea' }}>
            <tr>
              <th style={th}>匯出時間</th>
              <th style={th}>月份</th>
              <th style={{ ...th, textAlign: 'right' }}>筆數</th>
              <th style={{ ...th, textAlign: 'right' }}>金額</th>
              <th style={th}>匯出者</th>
            </tr>
          </thead>
          <tbody>
            {exportLog.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#a0aec0' }}>無紀錄</td></tr>}
            {exportLog.map(log => (
              <tr key={log.id}>
                <td style={td}>{new Date(log.exported_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td style={td}>{log.period}</td>
                <td style={{ ...td, textAlign: 'right' }}>{log.invoice_count}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(log.total_amount)}</td>
                <td style={td}>{log.exporter?.name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// 共用 Modal（簡化版，避免跟既有 Modal 衝突先 inline 一個）
function Modal({ title, children, onClose, width = 800 }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 10, width: '100%', maxWidth: width, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e0d5c8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#3a2e1e' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b5640' }}>×</button>
        </div>
        <div style={{ padding: 18, overflow: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

// ── 工具函式 ──────────────────────────────────────────────────
const ROLES_LEVEL = { operation_staff: 1, operation_lead: 2, dept_head: 3, super_admin: 4 };
const canConfirm  = (role) => (ROLES_LEVEL[role] || 0) >= 2;
const canManage   = (role) => (ROLES_LEVEL[role] || 0) >= 2;

const SOURCE_TYPE_LABEL = {
  admin_dept:  '行政部門費用',
  vendor:      '廠商費用',
  operational: '營運費用',
};
const SOURCE_TYPE_COLOR = {
  admin_dept:  '#50422d',
  vendor:      '#805ad5',
  operational: '#38a169',
};

// API 自動同步來源：顯示標記，不允許手動新增帳單
const SYNC_METHOD_LABEL = { api: '🔄 API自動', manual: '✏️ 手動' };
const isApiSource = (source) => source?.sync_method === 'api';

const STATUS_LABEL = {
  draft:       '草稿',
  submitted:   '待審核',
  confirmed:   '已確認',
  distributed: '已分配',
  void:        '已作廢',
};
const STATUS_COLOR = {
  draft:       '#718096',
  submitted:   '#d69e2e',
  confirmed:   '#50422d',
  distributed: '#38a169',
  void:        '#e53e3e',
};

const fmtMoney = (v) => {
  if (v == null) return '—';
  return 'NT$ ' + Number(v).toLocaleString('zh-TW', { minimumFractionDigits: 0 });
};

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// ── 狀態 Badge ────────────────────────────────────────────────
function StatusBadge({ status }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      color: '#fff',
      background: STATUS_COLOR[status] || '#718096',
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      color: '#fff',
      background: SOURCE_TYPE_COLOR[type] || '#718096',
    }}>
      {SOURCE_TYPE_LABEL[type] || type}
    </span>
  );
}

// ── 帳單建立 Modal ────────────────────────────────────────────
function CreateBillModal({ sources, departments, onClose, onCreated }) {
  const [form, setForm] = useState({
    source_id: '',
    accounting_category_id: '',
    period: currentMonth(),
    title: '',
    description: '',
    total_amount: '',
    invoice_no: '',
    invoice_date: '',
    notes: '',
  });
  const [categories, setCategories] = useState([]);
  const [allocMode, setAllocMode] = useState('single'); // 'single' | 'split'
  const [allocations, setAllocations] = useState([{ store_erpid: '', store_name: '', allocated_amount: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 來源單位改變時載入科目
  useEffect(() => {
    if (!form.source_id) { setCategories([]); return; }
    billingV2Api.getCategories(form.source_id).then(res => {
      setCategories(res.success ? res.data : []);
    });
  }, [form.source_id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const totalAlloc = allocations.reduce((s, a) => s + (parseFloat(a.allocated_amount) || 0), 0);
  const remaining  = parseFloat(form.total_amount || 0) - totalAlloc;

  const addAlloc = () =>
    setAllocations(a => [...a, { store_erpid: '', store_name: '', allocated_amount: '' }]);
  const removeAlloc = (i) =>
    setAllocations(a => a.filter((_, j) => j !== i));
  const setAlloc = (i, k, v) =>
    setAllocations(a => a.map((row, j) => j === i ? { ...row, [k]: v } : row));

  const handleDeptSelect = (i, erpid) => {
    const dept = departments.find(d => d.store_erpid === erpid);
    setAlloc(i, 'store_erpid', erpid);
    setAlloc(i, 'store_name', dept?.store_name || '');
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.source_id || !form.period || !form.title || !form.total_amount) {
      setError('請填寫：來源單位、月份、標題、金額');
      return;
    }
    const allocs = allocMode === 'single'
      ? []
      : allocations.filter(a => a.store_erpid && a.allocated_amount);

    setSaving(true);
    try {
      const res = await billingV2Api.createBill({
        ...form,
        total_amount: parseFloat(form.total_amount),
        accounting_category_id: form.accounting_category_id || null,
        invoice_date: form.invoice_date || null,
        allocations:  allocs.map(a => ({ ...a, allocated_amount: parseFloat(a.allocated_amount) })),
      });
      if (res.success) {
        onCreated(res.data);
        onClose();
      } else {
        setError(res.message || '建立失敗');
      }
    } catch (err) {
      setError(err.message || '建立失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalOverlay}>
      <div style={{ ...modalBox, maxWidth: 680 }}>
        <div style={modalHeader}>
          <h3 style={{ margin: 0, fontSize: 16 }}>新增帳單</h3>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: 'calc(90vh - 120px)' }}>
          {error && <div style={errorBox}>{error}</div>}

          <div style={formGrid}>
            <div style={formField}>
              <label style={labelStyle}>來源單位 *</label>
              <select style={selectStyle} value={form.source_id} onChange={e => set('source_id', e.target.value)}>
                <option value="">— 選擇來源單位 —</option>
                {['admin_dept', 'vendor', 'operational'].map(type => {
                  const group = sources.filter(s => s.source_type === type && s.sync_method !== 'api');
                  if (!group.length) return null;
                  return (
                    <optgroup key={type} label={SOURCE_TYPE_LABEL[type]}>
                      {group.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div style={formField}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <label style={{ ...labelStyle, marginBottom: 0, flex: 1 }}>會計科目</label>
                <button type="button" disabled={!form.source_id}
                  onClick={async () => {
                    if (!form.source_id) { alert('請先選來源單位'); return; }
                    const name = window.prompt('新增會計科目名稱：');
                    if (!name || !name.trim()) return;
                    const code = window.prompt('會計科目代碼（可留空）：', '') || '';
                    try {
                      const r = await billingV2Api.createCategory(form.source_id, { name: name.trim(), code: code.trim() || null });
                      if (!r.success) throw new Error(r.message);
                      const listRes = await billingV2Api.getCategories(form.source_id);
                      if (listRes.success) setCategories(listRes.data);
                      set('accounting_category_id', r.data?.id || '');
                    } catch (e) { alert('新增失敗：' + (e?.message || e)); }
                  }}
                  style={{ fontSize: 11, color: !form.source_id ? '#a0aec0' : '#50422d', background: 'none', border: 'none', cursor: !form.source_id ? 'not-allowed' : 'pointer', padding: 0 }}>
                  ＋ 新增科目
                </button>
              </div>
              <select style={selectStyle} value={form.accounting_category_id}
                onChange={e => set('accounting_category_id', e.target.value)}
                disabled={categories.length === 0}>
                <option value="">— 選擇科目 —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.code ? `[${c.code}] ` : ''}{c.name}</option>
                ))}
              </select>
            </div>
            <div style={formField}>
              <label style={labelStyle}>帳單月份 *</label>
              <input type="month" style={inputStyle} value={form.period}
                onChange={e => set('period', e.target.value)} />
            </div>
            <div style={formField}>
              <label style={labelStyle}>總金額 *</label>
              <input type="number" style={inputStyle} value={form.total_amount}
                placeholder="0" onChange={e => set('total_amount', e.target.value)} />
            </div>
          </div>

          <div style={{ ...formField, marginTop: 8 }}>
            <label style={labelStyle}>帳單標題 *</label>
            <input style={inputStyle} value={form.title} placeholder="如：2025年5月電費" onChange={e => set('title', e.target.value)} />
          </div>

          <div style={formGrid}>
            <div style={formField}>
              <label style={labelStyle}>發票號碼</label>
              <input style={inputStyle} value={form.invoice_no} onChange={e => set('invoice_no', e.target.value)} />
            </div>
            <div style={formField}>
              <label style={labelStyle}>發票日期</label>
              <input type="date" style={inputStyle} value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} />
            </div>
          </div>

          <div style={{ ...formField, marginTop: 8 }}>
            <label style={labelStyle}>說明</label>
            <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={form.description}
              onChange={e => set('description', e.target.value)} />
          </div>

          {/* 門市分配 */}
          <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>門市分配</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="radio" value="single" checked={allocMode === 'single'} onChange={() => setAllocMode('single')} />
                稍後設定
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="radio" value="split" checked={allocMode === 'split'} onChange={() => setAllocMode('split')} />
                立即分配
              </label>
            </div>

            {allocMode === 'split' && (
              <>
                {allocations.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <select style={{ ...selectStyle, flex: 2 }} value={a.store_erpid}
                      onChange={e => handleDeptSelect(i, e.target.value)}>
                      <option value="">— 選擇門市 —</option>
                      {departments.map(d => (
                        <option key={d.store_erpid} value={d.store_erpid}>{d.store_name}</option>
                      ))}
                    </select>
                    <input type="number" style={{ ...inputStyle, flex: 1 }} placeholder="金額" value={a.allocated_amount}
                      onChange={e => setAlloc(i, 'allocated_amount', e.target.value)} />
                    {allocations.length > 1 && (
                      <button onClick={() => removeAlloc(i)} style={{ ...smallBtn, background: '#fed7d7', color: '#c53030' }}>－</button>
                    )}
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <button onClick={addAlloc} style={{ ...smallBtn, background: '#f5f0ea', color: '#50422d' }}>＋ 新增門市</button>
                  <span style={{ fontSize: 12, color: remaining === 0 ? '#38a169' : '#e53e3e' }}>
                    未分配：{fmtMoney(remaining)}
                    {remaining === 0 && ' ✓'}
                  </span>
                </div>
              </>
            )}
          </div>

          <div style={{ ...formField, marginTop: 8 }}>
            <label style={labelStyle}>備註</label>
            <textarea style={{ ...inputStyle, height: 50, resize: 'vertical' }} value={form.notes}
              onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <div style={modalFooter}>
          <button onClick={onClose} style={cancelBtn}>取消</button>
          <button onClick={handleSubmit} disabled={saving} style={primaryBtn}>
            {saving ? '建立中…' : '建立帳單'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 帳單詳情 Modal ────────────────────────────────────────────
function BillDetailModal({ bill, onClose, onRefresh, userRole, departments }) {
  const [allocations, setAllocations] = useState(bill.bill_allocations || []);
  const [editAlloc, setEditAlloc] = useState(false);
  const [newAllocs, setNewAllocs] = useState(
    (bill.bill_allocations || []).map(a => ({
      store_erpid: a.store_erpid,
      store_name:  a.store_name,
      allocated_amount: String(a.allocated_amount),
      allocation_note:  a.allocation_note || '',
    }))
  );
  const [voidReason, setVoidReason] = useState('');
  const [showVoid, setShowVoid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const total = allocations.reduce((s, a) => s + parseFloat(a.allocated_amount || 0), 0);

  const action = async (fn, label) => {
    setLoading(true); setMsg('');
    try {
      await fn();
      setMsg(`✓ ${label}成功`);
      onRefresh();
    } catch (err) {
      setMsg(`✗ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveAlloc = () => action(async () => {
    const rows = newAllocs
      .filter(a => a.store_erpid && a.allocated_amount)
      .map(a => ({
        store_erpid:      a.store_erpid,
        store_name:       a.store_name,
        allocated_amount: parseFloat(a.allocated_amount),
        allocation_note:  a.allocation_note,
      }));
    const res = await billingV2Api.updateAllocations(bill.id, rows);
    if (!res.success) throw new Error(res.message);
    setAllocations(res.data.bill_allocations || []);
    setEditAlloc(false);
  }, '分配更新');

  const addNewAlloc = () =>
    setNewAllocs(a => [...a, { store_erpid: '', store_name: '', allocated_amount: '', allocation_note: '' }]);

  const totalNew = newAllocs.reduce((s, a) => s + (parseFloat(a.allocated_amount) || 0), 0);
  const remainNew = parseFloat(bill.total_amount) - totalNew;

  const handleDeptSelect = (i, erpid) => {
    const dept = departments.find(d => d.store_erpid === erpid);
    setNewAllocs(a => a.map((row, j) => j === i
      ? { ...row, store_erpid: erpid, store_name: dept?.store_name || '' }
      : row
    ));
  };

  const { status } = bill;
  const isDraft = status === 'draft';
  const lead    = canConfirm(userRole);

  return (
    <div style={modalOverlay}>
      <div style={{ ...modalBox, maxWidth: 700 }}>
        <div style={modalHeader}>
          <h3 style={{ margin: 0, fontSize: 16 }}>帳單詳情：{bill.bill_no || bill.id.slice(0, 8)}</h3>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: 'calc(90vh - 120px)' }}>
          {msg && <div style={msg.startsWith('✓') ? successBox : errorBox}>{msg}</div>}

          {/* 基本資訊 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 16 }}>
            <InfoRow label="帳單編號" value={bill.bill_no || '—'} />
            <InfoRow label="狀態" value={<StatusBadge status={bill.status} />} />
            <InfoRow label="來源單位" value={
              <span>{bill.billing_sources?.name} <TypeBadge type={bill.billing_sources?.source_type} /></span>
            } />
            <InfoRow label="會計科目" value={bill.accounting_categories?.name || '—'} />
            <InfoRow label="帳單月份" value={bill.period} />
            <InfoRow label="金額" value={<strong style={{ color: '#2d3748', fontSize: 15 }}>{fmtMoney(bill.total_amount)}</strong>} />
            <InfoRow label="發票號碼" value={bill.invoice_no || '—'} />
            <InfoRow label="發票日期" value={bill.invoice_date || '—'} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <InfoRow label="帳單標題" value={bill.title} />
            {bill.description && <InfoRow label="說明" value={bill.description} />}
            {bill.notes && <InfoRow label="備註" value={bill.notes} />}
          </div>

          {/* 門市分配 */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>門市分配</span>
              {isDraft && (
                <button onClick={() => setEditAlloc(!editAlloc)} style={{ ...smallBtn, background: '#f5f0ea', color: '#50422d' }}>
                  {editAlloc ? '取消編輯' : '編輯分配'}
                </button>
              )}
            </div>

            {editAlloc ? (
              <>
                {newAllocs.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                    <select style={{ ...selectStyle, flex: 2 }} value={a.store_erpid}
                      onChange={e => handleDeptSelect(i, e.target.value)}>
                      <option value="">— 門市 —</option>
                      {departments.map(d => (
                        <option key={d.store_erpid} value={d.store_erpid}>{d.store_name}</option>
                      ))}
                    </select>
                    <input type="number" style={{ ...inputStyle, flex: 1 }} placeholder="金額" value={a.allocated_amount}
                      onChange={e => setNewAllocs(arr => arr.map((r, j) => j === i ? { ...r, allocated_amount: e.target.value } : r))} />
                    <input style={{ ...inputStyle, flex: 2 }} placeholder="說明（選填）" value={a.allocation_note}
                      onChange={e => setNewAllocs(arr => arr.map((r, j) => j === i ? { ...r, allocation_note: e.target.value } : r))} />
                    <button onClick={() => setNewAllocs(arr => arr.filter((_, j) => j !== i))}
                      style={{ ...smallBtn, background: '#fed7d7', color: '#c53030' }}>－</button>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <button onClick={addNewAlloc} style={{ ...smallBtn, background: '#f5f0ea', color: '#50422d' }}>＋ 新增</button>
                  <span style={{ fontSize: 12, color: remainNew === 0 ? '#38a169' : '#e53e3e' }}>
                    未分配：{fmtMoney(remainNew)}
                  </span>
                  <button onClick={saveAlloc} disabled={loading} style={primaryBtn}>儲存分配</button>
                </div>
              </>
            ) : (
              allocations.length === 0 ? (
                <p style={{ color: '#718096', fontSize: 13 }}>尚未設定門市分配</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f7fafc' }}>
                      <th style={th}>門市</th>
                      <th style={{ ...th, textAlign: 'right' }}>金額</th>
                      <th style={th}>說明</th>
                      <th style={th}>確認狀態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((a) => (
                      <tr key={a.id}>
                        <td style={td}>{a.store_name || a.store_erpid}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(a.allocated_amount)}</td>
                        <td style={td}>{a.allocation_note || '—'}</td>
                        <td style={td}>
                          <span style={{
                            padding: '1px 6px', borderRadius: 8, fontSize: 11,
                            background: a.confirm_status === 'confirmed' ? '#c6f6d5'
                              : a.confirm_status === 'disputed' ? '#fed7d7' : '#e2e8f0',
                            color: a.confirm_status === 'confirmed' ? '#276749'
                              : a.confirm_status === 'disputed' ? '#9b2c2c' : '#4a5568',
                          }}>
                            {a.confirm_status === 'confirmed' ? '已確認'
                              : a.confirm_status === 'disputed' ? '有異議' : '待確認'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f7fafc', fontWeight: 600 }}>
                      <td style={td}>合計</td>
                      <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(total)}</td>
                      <td style={td} colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              )
            )}
          </div>

          {/* 明細列表（API 自動同步的帳單會有 items） */}
          {Array.isArray(bill.items) && bill.items.length > 0 && (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 16 }}>
              <BillItemsTable items={bill.items} />
            </div>
          )}

          {/* 操作按鈕 */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isDraft && (
              <button disabled={loading} style={{ ...primaryBtn, background: '#d69e2e' }}
                onClick={() => action(() => billingV2Api.submitBill(bill.id).then(r => { if (!r.success) throw new Error(r.message); }), '送審')}>
                送審
              </button>
            )}
            {status === 'submitted' && lead && (
              <button disabled={loading} style={{ ...primaryBtn, background: '#38a169' }}
                onClick={() => action(() => billingV2Api.confirmBill(bill.id).then(r => { if (!r.success) throw new Error(r.message); }), '確認')}>
                確認帳單
              </button>
            )}
            {status === 'confirmed' && lead && (
              <button disabled={loading} style={{ ...primaryBtn, background: '#50422d' }}
                onClick={() => action(() => billingV2Api.distributeBill(bill.id).then(r => { if (!r.success) throw new Error(r.message); }), '分配')}>
                分配至門市
              </button>
            )}
            {['draft','submitted','confirmed'].includes(status) && lead && !showVoid && (
              <button disabled={loading} style={{ ...cancelBtn, border: '1px solid #e53e3e', color: '#e53e3e' }}
                onClick={() => setShowVoid(true)}>
                作廢
              </button>
            )}
            {showVoid && (
              <div style={{ width: '100%', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="作廢原因" value={voidReason}
                  onChange={e => setVoidReason(e.target.value)} />
                <button disabled={loading} style={{ ...primaryBtn, background: '#e53e3e' }}
                  onClick={() => action(() => billingV2Api.voidBill(bill.id, voidReason).then(r => { if (!r.success) throw new Error(r.message); }), '作廢')}>
                  確認作廢
                </button>
                <button onClick={() => setShowVoid(false)} style={cancelBtn}>取消</button>
              </div>
            )}
          </div>
        </div>

        <div style={modalFooter}>
          <button onClick={onClose} style={cancelBtn}>關閉</button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
      <span style={{ color: '#718096', fontSize: 12, minWidth: 70 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#2d3748' }}>{value}</span>
    </div>
  );
}

// ── 帳單明細列表（API 自動同步的帳單會帶 items）─────────────
function BillItemsTable({ items }) {
  const [showAll, setShowAll] = useState(false);
  const completionCount = items.filter(i => i.type !== 'return').length;
  const returnCount     = items.filter(i => i.type === 'return').length;
  const sumCompletion   = items.filter(i => i.type !== 'return').reduce((s, i) => s + (Number(i.total) || 0), 0);
  const sumReturn       = items.filter(i => i.type === 'return').reduce((s, i) => s + (Number(i.total) || 0), 0); // 已為負數
  const showItems       = showAll ? items : items.slice(0, 20);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          帳單明細
          <span style={{ fontSize: 11, color: '#718096', fontWeight: 400, marginLeft: 8 }}>
            完成 {completionCount} 筆（NT${sumCompletion.toLocaleString()}）
            {returnCount > 0 && (
              <> / 退回 {returnCount} 筆（NT${Math.abs(sumReturn).toLocaleString()}）</>
            )}
          </span>
        </span>
        {items.length > 20 && (
          <button onClick={() => setShowAll(v => !v)}
            style={{ ...smallBtn, background: '#f5f0ea', color: '#50422d' }}>
            {showAll ? `收合（共 ${items.length}）` : `展開全部（${items.length}）`}
          </button>
        )}
      </div>
      <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: '#f7fafc', position: 'sticky', top: 0 }}>
            <tr>
              <th style={th}>類型</th>
              <th style={th}>日期</th>
              <th style={th}>客戶單號</th>
              <th style={th}>送修單號</th>
              <th style={th}>規格</th>
              <th style={{ ...th, textAlign: 'right' }}>數量</th>
              <th style={{ ...th, textAlign: 'right' }}>單價</th>
              <th style={{ ...th, textAlign: 'right' }}>金額</th>
            </tr>
          </thead>
          <tbody>
            {showItems.map((it, idx) => {
              const isReturn = it.type === 'return';
              return (
                <tr key={`${it.type}-${it.seq_no}-${idx}`} style={{ background: isReturn ? '#fff5f5' : '#fff' }}>
                  <td style={td}>
                    <span style={{
                      padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                      background: isReturn ? '#fed7d7' : '#c6f6d5',
                      color:      isReturn ? '#9b2c2c' : '#276749',
                    }}>
                      {isReturn ? '退回' : '完成'}
                    </span>
                  </td>
                  <td style={td}>{it.item_date || '—'}</td>
                  <td style={td}>{it.customer_order || '—'}</td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{it.doc_number || '—'}</td>
                  <td style={{ ...td, fontSize: 11, maxWidth: 240, wordBreak: 'break-word' }}>{it.product_spec || '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{it.quantity ?? '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(it.unit_price)}</td>
                  <td style={{ ...td, textAlign: 'right', color: isReturn ? '#c53030' : '#2d3748', fontWeight: 600 }}>
                    {fmtMoney(it.total)}
                  </td>
                </tr>
              );
            })}
            {!showAll && items.length > 20 && (
              <tr>
                <td colSpan={8} style={{ ...td, textAlign: 'center', color: '#718096', fontSize: 11 }}>
                  ... 還有 {items.length - 20} 筆，點上方「展開全部」查看
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── 路奇天格手動同步按鈕（只給 code='CHI-LENS' 的來源顯示）──
function AdBudgetSyncBtn() {
  const [busy, setBusy] = useState(false);
  async function handleSync() {
    const def = new Date();
    const cur = `${def.getFullYear()}-${String(def.getMonth() + 1).padStart(2, '0')}`;
    const month = window.prompt('要同步哪個月份的企劃部廣告費？格式 YYYY-MM', cur);
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return;
    if (!window.confirm(`確定要同步企劃部廣告費 ${month}？`)) return;
    setBusy(true);
    try {
      const res = await billingApi.syncAdBudgetDebug(month);
      if (res?.success === false) {
        alert('同步失敗：' + (res.message || '未知錯誤') + (res.stack ? '\n\n' + res.stack.join('\n') : ''));
      } else {
        const samples = res?.samples || [];
        const sampleStr = samples.slice(0, 5).map(s =>
          `  ${s.order_id} / ${s.store_erpid} / ${s.billing_category || '-'} / NT$${(s.amount || 0).toLocaleString()}`
        ).join('\n');
        alert([
          `企劃部廣告費 ${month} 同步完成`,
          ``,
          `同步回應：${JSON.stringify(res?.sync_result || {})}`,
          `資料庫實際筆數：${res?.rows_in_db || 0}`,
          res?.fallback_count_in_samples > 0
            ? `⚠️ 前 5 筆 sample 中有 ${res.fallback_count_in_samples} 筆 store_erpid 是 fallback（未對應到 departments）`
            : '',
          samples.length > 0 ? `Sample (前 ${samples.length} 筆)：\n${sampleStr}` : '無資料寫入',
          res?.count_err ? `❌ count 查詢錯誤：${res.count_err}` : '',
        ].filter(Boolean).join('\n'));
      }
    } catch (e) {
      alert('同步失敗：' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <button onClick={handleSync} disabled={busy}
      style={{ ...primaryBtn, background: '#805ad5' }}>
      {busy ? '同步中...' : '📣 同步企劃部廣告費'}
    </button>
  );
}

function ChiLensSyncBtn() {
  const [busy, setBusy] = useState(false);
  async function handleSync() {
    const def = new Date();
    const cur = `${def.getFullYear()}-${String(def.getMonth() + 1).padStart(2, '0')}`;
    const period = window.prompt('要同步哪個月份？格式 YYYY-MM', cur);
    if (!period || !/^\d{4}-\d{2}$/.test(period)) return;
    if (!window.confirm(`確定要同步路奇天格鏡片帳單 ${period}？`)) return;
    setBusy(true);
    try {
      const res = await billingApi.syncChiFinanceLens(period);
      if (res?.success === false) {
        alert('同步失敗：' + (res.message || '未知錯誤'));
      } else {
        const r = res?.data;
        alert([
          `路奇天格 ${period} 同步完成`,
          r ? `完成單：${r.completion_count} 筆／退回單：${r.return_count} 筆` : '',
          r ? `同步門市：${r.synced_stores} 家（新增 ${r.inserted_count || 0} / 更新 ${r.updated_count || 0}）` : '',
          r ? `淨額：NT$${(r.total_net || 0).toLocaleString()}` : '',
          r?.unmapped_branches?.length
            ? `⚠️ 無法對應門市：${r.unmapped_branches.map(b => b.branch_name).join('、')}`
            : '',
          r?.skipped_branches?.length
            ? `ℹ️ 已忽略內部單位：${r.skipped_branches.map(b => `${b.branch_name}(NT$${(b.net||0).toLocaleString()})`).join('、')}`
            : '',
          r?.write_errors?.length
            ? `❌ 寫入失敗 ${r.write_errors.length} 件：\n` +
              r.write_errors.slice(0, 5).map(e => `  ${e.branch}（${e.step}）: ${e.message}`).join('\n') +
              (r.write_errors.length > 5 ? `\n  ... 另外 ${r.write_errors.length - 5} 件` : '')
            : '',
        ].filter(Boolean).join('\n'));
      }
    } catch (e) {
      alert('同步失敗：' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <button onClick={handleSync} disabled={busy}
      style={{ ...smallBtn, background: '#bee3f8', color: '#2c5282' }}>
      {busy ? '同步中...' : '🔄 同步'}
    </button>
  );
}

// ── 來源單位管理面板 ──────────────────────────────────────────
function SourcePanel({ sources, onRefresh }) {
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [form, setForm]   = useState({ source_type: 'vendor', code: '', name: '', contact_name: '', contact_phone: '', contact_email: '', sync_method: 'manual', api_start_period: '' });
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleCreate = async () => {
    setError('');
    if (!form.source_type || !form.name) { setError('請填寫類型和名稱'); return; }
    if (form.sync_method === 'api' && !form.api_start_period) { setError('API 來源請填寫「API 開始月份」'); return; }
    setSaving(true);
    try {
      const res = await billingV2Api.createSource(form);
      if (res.success) {
        setShowForm(false);
        setForm({ source_type: 'vendor', code: '', name: '', contact_name: '', contact_phone: '', contact_email: '', sync_method: 'manual', api_start_period: '' });
        onRefresh();
      } else setError(res.message);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditForm({
      sync_method:      s.sync_method || 'manual',
      api_start_period: s.api_start_period || '',
      is_active:        s.is_active,
    });
  };

  const handleUpdate = async (id) => {
    if (editForm.sync_method === 'api' && !editForm.api_start_period) {
      alert('API 來源請填寫「API 開始月份」');
      return;
    }
    setSaving(true);
    try {
      const res = await billingV2Api.updateSource(id, editForm);
      if (res.success) { setEditingId(null); onRefresh(); }
      else alert(res.message);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>來源單位管理</h3>
        <button onClick={() => setShowForm(!showForm)} style={primaryBtn}>
          {showForm ? '取消' : '＋ 新增'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          {error && <div style={errorBox}>{error}</div>}
          <div style={formGrid}>
            <div style={formField}>
              <label style={labelStyle}>類型 *</label>
              <select style={selectStyle} value={form.source_type} onChange={e => setForm(f => ({ ...f, source_type: e.target.value }))}>
                <option value="admin_dept">行政部門費用（6-1）</option>
                <option value="vendor">廠商費用（6-2）</option>
                <option value="operational">營運費用（6-3）</option>
              </select>
            </div>
            <div style={formField}>
              <label style={labelStyle}>識別碼</label>
              <input style={inputStyle} value={form.code} placeholder="如：VENDOR-001" onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div style={{ ...formField, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>名稱 *</label>
              <input style={inputStyle} value={form.name} placeholder="如：台電公司 / 工程部 / 租金" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={formField}>
              <label style={labelStyle}>帳單來源方式</label>
              <select style={selectStyle} value={form.sync_method} onChange={e => setForm(f => ({ ...f, sync_method: e.target.value }))}>
                <option value="manual">✏️ 手動輸入</option>
                <option value="api">🔄 API 自動同步</option>
              </select>
            </div>
            {form.sync_method === 'api' && (
              <div style={formField}>
                <label style={labelStyle}>API 開始月份 *</label>
                <input type="month" style={inputStyle} value={form.api_start_period}
                  onChange={e => setForm(f => ({ ...f, api_start_period: e.target.value }))} />
              </div>
            )}
            <div style={formField}>
              <label style={labelStyle}>聯絡人</label>
              <input style={inputStyle} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
            </div>
            <div style={formField}>
              <label style={labelStyle}>聯絡電話</label>
              <input style={inputStyle} value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button onClick={() => setShowForm(false)} style={cancelBtn}>取消</button>
            <button onClick={handleCreate} disabled={saving} style={primaryBtn}>{saving ? '建立中…' : '建立'}</button>
          </div>
        </div>
      )}

      {/* 分組顯示：行政部門 / 廠商 / 營運 */}
      {[
        { type: 'admin_dept',  label: '行政部門費用', code: '6-1', accentColor: '#50422d', bgColor: '#f5f0ea' },
        { type: 'vendor',      label: '廠商費用',     code: '6-2', accentColor: '#805ad5', bgColor: '#faf5ff' },
        { type: 'operational', label: '營運費用',     code: '6-3', accentColor: '#38a169', bgColor: '#f0fff4' },
      ].map(({ type, label, code, accentColor, bgColor }) => {
        const group = sources.filter(s => s.source_type === type);
        const activeCount = group.filter(s => s.is_active).length;
        return (
          <div key={type} style={{ marginBottom: 20 }}>
            {/* 大分類 Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              background: bgColor,
              borderLeft: `4px solid ${accentColor}`,
              borderRadius: '8px 8px 0 0',
              borderTop: `1px solid ${accentColor}20`,
              borderRight: `1px solid ${accentColor}20`,
            }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: accentColor }}>{label}</span>
              <span style={{ fontSize: 11, color: '#718096', background: '#fff', padding: '1px 8px', borderRadius: 99, border: `1px solid ${accentColor}40` }}>
                科目代碼 {code}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#718096' }}>
                {activeCount} 個啟用 / {group.length} 個合計
              </span>
            </div>

            {/* 子來源 Table */}
            <div style={{ border: `1px solid ${accentColor}20`, borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
              {group.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#a0aec0', fontSize: 13, background: '#fff' }}>
                  尚無此類型來源單位
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#fafafa' }}>
                      <th style={th}>名稱</th>
                      <th style={th}>帳單來源</th>
                      <th style={th}>API 開始月份</th>
                      <th style={th}>識別碼</th>
                      <th style={th}>狀態</th>
                      <th style={th}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map(s => (
                      <tr key={s.id} style={{ ...trHover, opacity: s.is_active ? 1 : 0.55 }}>
                        <td style={td}>
                          <strong style={{ color: '#1a202c' }}>{s.name}</strong>
                          {s.contact_name && (
                            <div style={{ fontSize: 11, color: '#718096', marginTop: 1 }}>聯絡人：{s.contact_name}</div>
                          )}
                        </td>
                        <td style={td}>
                          {editingId === s.id ? (
                            <select style={{ ...selectStyle, fontSize: 12 }} value={editForm.sync_method}
                              onChange={e => setEditForm(f => ({ ...f, sync_method: e.target.value }))}>
                              <option value="manual">✏️ 手動</option>
                              <option value="api">🔄 API自動</option>
                            </select>
                          ) : (
                            <span style={{
                              fontSize: 11, padding: '2px 8px', borderRadius: 8, fontWeight: 600,
                              background: s.sync_method === 'api' ? '#f0fff4' : '#f5f0ea',
                              color:      s.sync_method === 'api' ? '#276749' : '#50422d',
                              border:     s.sync_method === 'api' ? '1px solid #c6f6d5' : '1px solid #cdbea2',
                            }}>
                              {s.sync_method === 'api' ? '🔄 API自動' : '✏️ 手動'}
                            </span>
                          )}
                        </td>
                        <td style={td}>
                          {editingId === s.id && editForm.sync_method === 'api' ? (
                            <input type="month" style={{ ...selectStyle, fontSize: 12, width: 130 }}
                              value={editForm.api_start_period}
                              onChange={e => setEditForm(f => ({ ...f, api_start_period: e.target.value }))} />
                          ) : (
                            <span style={{ color: s.api_start_period ? '#2d3748' : '#a0aec0' }}>
                              {s.api_start_period || (s.sync_method === 'api' ? '未設定' : '—')}
                            </span>
                          )}
                        </td>
                        <td style={{ ...td, color: '#718096', fontFamily: 'monospace', fontSize: 12 }}>{s.code || '—'}</td>
                        <td style={td}>
                          {editingId === s.id ? (
                            <select style={{ ...selectStyle, fontSize: 12, width: 80 }} value={editForm.is_active}
                              onChange={e => setEditForm(f => ({ ...f, is_active: e.target.value === 'true' }))}>
                              <option value="true">啟用</option>
                              <option value="false">停用</option>
                            </select>
                          ) : (
                            <span style={{ color: s.is_active ? '#38a169' : '#e53e3e', fontSize: 12, fontWeight: 600 }}>
                              {s.is_active ? '● 啟用' : '○ 停用'}
                            </span>
                          )}
                        </td>
                        <td style={td}>
                          {editingId === s.id ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => handleUpdate(s.id)} disabled={saving}
                                style={{ ...smallBtn, background: '#c6f6d5', color: '#276749' }}>儲存</button>
                              <button onClick={() => setEditingId(null)}
                                style={{ ...smallBtn, background: '#e2e8f0', color: '#718096' }}>取消</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => startEdit(s)}
                                style={{ ...smallBtn, background: '#f5f0ea', color: '#50422d' }}>編輯</button>
                              {s.code === 'CHI-LENS' && (
                                <ChiLensSyncBtn />
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────
export default function BillingV2Page() {
  const { user } = useAuth();
  const [tab, setTab] = useState('bills');  // 'bills' | 'sources'
  const [sources, setSources]       = useState([]);
  const [departments, setDepartments] = useState([]);
  const [bills, setBills]           = useState([]);
  const [pagination, setPagination] = useState({});
  const [filter, setFilter] = useState({ period: currentMonth(), source_type: '', source_id: '', status: '' });
  const [loading, setLoading] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // 載入基礎資料
  useEffect(() => {
    billingV2Api.getSources({ is_active: true }).then(r => r.success && setSources(r.data));
    personnelApi.getDepartments().then(r => r.success && setDepartments(r.data));
  }, []);

  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await billingV2Api.getBills({
        period:    filter.period || undefined,
        source_id: filter.source_id || undefined,
        status:    filter.status || undefined,
        limit:     50,
      });
      if (res.success) {
        setBills(res.data);
        setPagination(res.pagination);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadBills(); }, [loadBills]);

  // 重新載入帳單（狀態變更後）
  const refreshBill = useCallback(async () => {
    if (!selectedBill) return;
    const res = await billingV2Api.getBill(selectedBill.id);
    if (res.success) setSelectedBill(res.data);
    loadBills();
  }, [selectedBill, loadBills]);

  const refreshSources = () =>
    billingV2Api.getSources({ is_active: true }).then(r => r.success && setSources(r.data));

  const TABS = [
    { key: 'bills',           label: '帳單列表' },
    { key: 'vendor_payment',  label: '廠商請款審核' },
    { key: 'payment_batch',   label: '匯款批次' },
    { key: 'input_invoice',   label: '進項發票' },
    { key: 'sources',         label: '來源單位',     hidden: !canManage(user?.role) },
    { key: 'vendors',         label: '廠商帳號管理', hidden: !canManage(user?.role) },
  ].filter(t => !t.hidden);

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#2d3748' }}>開帳系統</h2>
        {tab === 'bills' && (
          <button onClick={() => setShowCreate(true)} style={primaryBtn}>＋ 新增帳單</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 20px', fontSize: 14, fontWeight: 600,
            color: tab === t.key ? '#50422d' : '#718096',
            borderBottom: tab === t.key ? '2px solid #50422d' : '2px solid transparent',
            marginBottom: -2,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 帳單列表 */}
      {tab === 'bills' && (
        <>
          {/* 篩選列 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>月份</label>
              <input type="month" style={{ ...inputStyle, width: 140 }} value={filter.period}
                onChange={e => setFilter(f => ({ ...f, period: e.target.value }))} />
            </div>

            {/* 大分類 */}
            <div>
              <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>費用類別</label>
              <select style={{ ...selectStyle, width: 150 }} value={filter.source_type}
                onChange={e => setFilter(f => ({ ...f, source_type: e.target.value, source_id: '' }))}>
                <option value="">全部類別</option>
                <option value="admin_dept">行政部門費用</option>
                <option value="vendor">廠商費用</option>
                <option value="operational">營運費用</option>
              </select>
            </div>

            {/* 子來源（依大分類篩選） */}
            <div>
              <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>來源單位</label>
              <select style={{ ...selectStyle, width: 180 }} value={filter.source_id}
                onChange={e => setFilter(f => ({ ...f, source_id: e.target.value }))}>
                <option value="">
                  {filter.source_type ? '全部（此類別）' : '全部來源'}
                </option>
                {(filter.source_type
                  ? sources.filter(s => s.source_type === filter.source_type)
                  : sources
                ).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>狀態</label>
              <select style={{ ...selectStyle, width: 130 }} value={filter.status}
                onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
                <option value="">全部狀態</option>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <button onClick={loadBills} style={{ ...primaryBtn, alignSelf: 'flex-end' }}>搜尋</button>
          </div>

          {/* 帳單表格 */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#718096' }}>載入中…</div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f7fafc' }}>
                    <th style={th}>帳單編號</th>
                    <th style={th}>月份</th>
                    <th style={th}>來源單位</th>
                    <th style={th}>標題</th>
                    <th style={{ ...th, textAlign: 'right' }}>金額</th>
                    <th style={th}>狀態</th>
                    <th style={th}>建立時間</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map(b => (
                    <tr key={b.id} style={{ ...trHover, cursor: 'pointer' }}
                      onClick={() => {
                        billingV2Api.getBill(b.id).then(r => r.success && setSelectedBill(r.data));
                      }}>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>
                        {b.bill_no || b.id.slice(0, 8)}
                      </td>
                      <td style={td}>{b.period}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                          <TypeBadge type={b.billing_sources?.source_type} />
                          <span>{b.billing_sources?.name}</span>
                          {b.billing_sources?.sync_method === 'api' && (
                            <span style={{ fontSize: 10, color: '#38a169', background: '#f0fff4', padding: '1px 6px', borderRadius: 8, border: '1px solid #c6f6d5' }}>
                              🔄 API
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={td}>{b.title}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>
                        {fmtMoney(b.total_amount)}
                      </td>
                      <td style={td}><StatusBadge status={b.status} /></td>
                      <td style={{ ...td, color: '#718096' }}>
                        {b.created_at ? new Date(b.created_at).toLocaleDateString('zh-TW') : '—'}
                      </td>
                    </tr>
                  ))}
                  {bills.length === 0 && (
                    <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#a0aec0', padding: 32 }}>
                      此條件下無帳單資料
                    </td></tr>
                  )}
                </tbody>
              </table>
              {pagination.total > 0 && (
                <div style={{ marginTop: 8, color: '#718096', fontSize: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span>共 <b style={{ color: '#2d3748' }}>{pagination.total}</b> 筆</span>
                  <span>總金額 <b style={{ color: '#50422d' }}>{fmtMoney(bills.reduce((s, b) => s + Number(b.total_amount || 0), 0))}</b></span>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* 來源單位管理 */}
      {tab === 'sources' && (
        <SourcePanel sources={sources} onRefresh={refreshSources} />
      )}

      {/* 廠商帳號管理 */}
      {tab === 'vendors' && (
        <VendorAccountsPanel sources={sources} onSourceUpdate={refreshSources} />
      )}

      {/* 廠商請款審核 */}
      {tab === 'vendor_payment' && (
        <VendorPaymentReviewPanel sources={sources} />
      )}

      {/* 匯款批次 */}
      {tab === 'payment_batch' && (
        <PaymentBatchPanel />
      )}

      {/* 進項發票 */}
      {tab === 'input_invoice' && (
        <InputInvoicePanel />
      )}

      {/* 帳單詳情 Modal */}
      {selectedBill && (
        <BillDetailModal
          bill={selectedBill}
          onClose={() => setSelectedBill(null)}
          onRefresh={refreshBill}
          userRole={user?.role}
          departments={departments}
        />
      )}

      {/* 建立帳單 Modal */}
      {showCreate && (
        <CreateBillModal
          sources={sources}
          departments={departments}
          onClose={() => setShowCreate(false)}
          onCreated={(bill) => {
            setSelectedBill(bill);
            loadBills();
          }}
        />
      )}
    </div>
  );
}

// ── 樣式常數 ──────────────────────────────────────────────────
const modalOverlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 20,
};
const modalBox = {
  background: '#fff', borderRadius: 12, width: '100%',
  maxHeight: '90vh', display: 'flex', flexDirection: 'column',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
};
const modalHeader = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '14px 20px', borderBottom: '1px solid #e2e8f0',
};
const modalFooter = {
  display: 'flex', justifyContent: 'flex-end', gap: 8,
  padding: '12px 20px', borderTop: '1px solid #e2e8f0',
};
const closeBtn   = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#718096' };
const primaryBtn = { background: '#50422d', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 };
const cancelBtn  = { background: '#edf2f7', color: '#4a5568', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, cursor: 'pointer' };
const smallBtn   = { border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 13, cursor: 'pointer', fontWeight: 600 };
const inputStyle = { border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };
const labelStyle = { fontSize: 12, color: '#718096', fontWeight: 600 };
const formGrid   = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' };
const formField  = { display: 'flex', flexDirection: 'column', gap: 4 };
const errorBox   = { background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 6, padding: '8px 12px', marginBottom: 12, color: '#c53030', fontSize: 13 };
const successBox = { background: '#f0fff4', border: '1px solid #c6f6d5', borderRadius: 6, padding: '8px 12px', marginBottom: 12, color: '#276749', fontSize: 13 };
const th = { padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#4a5568', borderBottom: '2px solid #e2e8f0' };
const td = { padding: '10px 12px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' };
const trHover = { transition: 'background 0.1s' };
