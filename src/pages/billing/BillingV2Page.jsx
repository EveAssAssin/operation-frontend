// pages/billing/BillingV2Page.jsx
// 開帳系統 v2：帳單管理（來源單位 / 會計科目 / 帳單建立與審核）

import { useState, useEffect, useCallback } from 'react';
import { billingV2Api, personnelApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

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
  admin_dept:  '#3182ce',
  vendor:      '#805ad5',
  operational: '#38a169',
};

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
  confirmed:   '#3182ce',
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
                {sources.map(s => (
                  <option key={s.id} value={s.id}>[{SOURCE_TYPE_LABEL[s.source_type]}] {s.name}</option>
                ))}
              </select>
            </div>
            <div style={formField}>
              <label style={labelStyle}>會計科目</label>
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
                  <button onClick={addAlloc} style={{ ...smallBtn, background: '#ebf8ff', color: '#2b6cb0' }}>＋ 新增門市</button>
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
                <button onClick={() => setEditAlloc(!editAlloc)} style={{ ...smallBtn, background: '#ebf8ff', color: '#2b6cb0' }}>
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
                  <button onClick={addNewAlloc} style={{ ...smallBtn, background: '#ebf8ff', color: '#2b6cb0' }}>＋ 新增</button>
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
              <button disabled={loading} style={{ ...primaryBtn, background: '#3182ce' }}
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

// ── 來源單位管理面板 ──────────────────────────────────────────
function SourcePanel({ sources, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ source_type: 'vendor', code: '', name: '', contact_name: '', contact_phone: '', contact_email: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setError('');
    if (!form.source_type || !form.name) { setError('請填寫類型和名稱'); return; }
    setSaving(true);
    try {
      const res = await billingV2Api.createSource(form);
      if (res.success) { setShowForm(false); setForm({ source_type: 'vendor', code: '', name: '', contact_name: '', contact_phone: '', contact_email: '' }); onRefresh(); }
      else setError(res.message);
    } catch (err) { setError(err.message); }
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

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f7fafc' }}>
            <th style={th}>名稱</th>
            <th style={th}>類型</th>
            <th style={th}>識別碼</th>
            <th style={th}>聯絡人</th>
            <th style={th}>狀態</th>
          </tr>
        </thead>
        <tbody>
          {sources.map(s => (
            <tr key={s.id} style={trHover}>
              <td style={td}>{s.name}</td>
              <td style={td}><TypeBadge type={s.source_type} /></td>
              <td style={{ ...td, color: '#718096' }}>{s.code || '—'}</td>
              <td style={td}>{s.contact_name || '—'}</td>
              <td style={td}>
                <span style={{ color: s.is_active ? '#38a169' : '#e53e3e', fontSize: 12 }}>
                  {s.is_active ? '啟用' : '停用'}
                </span>
              </td>
            </tr>
          ))}
          {sources.length === 0 && (
            <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#a0aec0' }}>尚無來源單位</td></tr>
          )}
        </tbody>
      </table>
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
  const [filter, setFilter] = useState({ period: currentMonth(), source_id: '', status: '' });
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
    { key: 'bills',   label: '帳單列表' },
    { key: 'sources', label: '來源單位', hidden: !canManage(user?.role) },
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
            color: tab === t.key ? '#3182ce' : '#718096',
            borderBottom: tab === t.key ? '2px solid #3182ce' : '2px solid transparent',
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
            <div>
              <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>來源單位</label>
              <select style={{ ...selectStyle, width: 180 }} value={filter.source_id}
                onChange={e => setFilter(f => ({ ...f, source_id: e.target.value }))}>
                <option value="">全部來源</option>
                {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                <div style={{ marginTop: 8, color: '#718096', fontSize: 12 }}>
                  共 {pagination.total} 筆
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
const primaryBtn = { background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 };
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
