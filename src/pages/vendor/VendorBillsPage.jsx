// pages/vendor/VendorBillsPage.jsx
// 廠商後台：帳單列表 + 新增 / 送審

import { useState, useEffect, useCallback } from 'react';
import { vendorApi } from '../../services/api';
import { useVendorAuth } from '../../contexts/VendorAuthContext';

// ── 工具 ─────────────────────────────────────────────────────
const fmtMoney = (v) => v == null ? '—' : 'NT$ ' + Number(v).toLocaleString('zh-TW');
const fmtDate  = (v) => v ? new Date(v).toLocaleDateString('zh-TW') : '—';
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const STATUS_LABEL = {
  draft:       '草稿',
  submitted:   '待審核',
  confirmed:   '已確認',
  distributed: '已分配',
  void:        '已作廢',
};
const STATUS_STYLE = {
  draft:       { background: '#edf2f7', color: '#718096' },
  submitted:   { background: '#fefcbf', color: '#744210' },
  confirmed:   { background: '#ebf8ff', color: '#2c5282' },
  distributed: { background: '#f0fff4', color: '#276749' },
  void:        { background: '#fff5f5', color: '#9b2c2c' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.draft;
  return (
    <span style={{
      ...s, display: 'inline-block', padding: '2px 10px',
      borderRadius: 12, fontSize: 12, fontWeight: 600,
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

// ── 帳單詳情 Modal ────────────────────────────────────────────
function BillDetailModal({ bill, onClose, onRefresh, categories }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({
    title:                 bill.title,
    description:           bill.description || '',
    total_amount:          String(bill.total_amount),
    accounting_category_id: bill.accounting_category_id || '',
    invoice_no:            bill.invoice_no || '',
    invoice_date:          bill.invoice_date || '',
    notes:                 bill.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState('');

  const isDraft = bill.status === 'draft';

  const handleSave = async () => {
    setLoading(true); setMsg('');
    try {
      const res = await vendorApi.updateBill(bill.id, {
        ...form,
        total_amount: parseFloat(form.total_amount),
        accounting_category_id: form.accounting_category_id || null,
        invoice_date: form.invoice_date || null,
      });
      if (res.success) {
        setMsg('✓ 已儲存');
        setEditing(false);
        onRefresh();
      } else {
        setMsg('✗ ' + res.message);
      }
    } catch (err) {
      setMsg('✗ ' + (err.message || '儲存失敗'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!window.confirm('確定要送審此帳單？送審後將無法修改。')) return;
    setLoading(true); setMsg('');
    try {
      const res = await vendorApi.submitBill(bill.id);
      if (res.success) { setMsg('✓ 已送審'); onRefresh(); }
      else setMsg('✗ ' + res.message);
    } catch (err) {
      setMsg('✗ ' + (err.message || '送審失敗'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={{ ...modalBox, maxWidth: 600 }}>
        <div style={modalHeader}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>
              {bill.bill_no || bill.id.slice(0, 8)}
            </h3>
            <div style={{ marginTop: 4 }}><StatusBadge status={bill.status} /></div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: 'calc(90vh - 130px)' }}>
          {msg && (
            <div style={{
              ...msg.startsWith('✓') ? successBox : errorBox,
              marginBottom: 12,
            }}>{msg}</div>
          )}

          {editing ? (
            /* 編輯模式 */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="帳單標題 *">
                <input style={input} value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                <Field label="帳單金額 *">
                  <input type="number" style={input} value={form.total_amount}
                    onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
                </Field>
                <Field label="會計科目">
                  <select style={input} value={form.accounting_category_id}
                    onChange={e => setForm(f => ({ ...f, accounting_category_id: e.target.value }))}>
                    <option value="">— 選擇科目 —</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.code ? `[${c.code}] ` : ''}{c.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="發票號碼">
                  <input style={input} value={form.invoice_no}
                    onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))} />
                </Field>
                <Field label="發票日期">
                  <input type="date" style={input} value={form.invoice_date}
                    onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
                </Field>
              </div>
              <Field label="說明">
                <textarea style={{ ...input, height: 60, resize: 'vertical' }} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </Field>
              <Field label="備註">
                <textarea style={{ ...input, height: 50, resize: 'vertical' }} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </Field>
            </div>
          ) : (
            /* 檢視模式 */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
              <InfoRow label="帳單月份"  value={bill.period} />
              <InfoRow label="金額"     value={<strong style={{ fontSize: 15 }}>{fmtMoney(bill.total_amount)}</strong>} />
              <InfoRow label="標題"     value={bill.title} span />
              <InfoRow label="會計科目" value={bill.accounting_categories?.name || '—'} />
              <InfoRow label="發票號碼" value={bill.invoice_no || '—'} />
              <InfoRow label="發票日期" value={bill.invoice_date || '—'} />
              {bill.description && <InfoRow label="說明" value={bill.description} span />}
              {bill.notes       && <InfoRow label="備註" value={bill.notes}       span />}
              <InfoRow label="送審時間" value={fmtDate(bill.submitted_at)} />
              <InfoRow label="確認時間" value={fmtDate(bill.confirmed_at)} />
              {bill.bill_allocations?.length > 0 && (
                <div style={{ gridColumn: '1 / -1', marginTop: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#4a5568', marginBottom: 6 }}>
                    門市分配（由樂活眼鏡設定）
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f7fafc' }}>
                        <th style={th}>門市</th>
                        <th style={{ ...th, textAlign: 'right' }}>金額</th>
                        <th style={th}>狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.bill_allocations.map(a => (
                        <tr key={a.id}>
                          <td style={td}>{a.store_name || a.store_erpid}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(a.allocated_amount)}</td>
                          <td style={td}>
                            <span style={{
                              fontSize: 11, padding: '1px 8px', borderRadius: 8,
                              background: a.confirm_status === 'confirmed' ? '#c6f6d5' : '#e2e8f0',
                              color:      a.confirm_status === 'confirmed' ? '#276749' : '#4a5568',
                            }}>
                              {a.confirm_status === 'confirmed' ? '已確認' : '待確認'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={modalFooter}>
          {isDraft && !editing && (
            <>
              <button onClick={() => setEditing(true)} style={secondaryBtn}>編輯</button>
              <button onClick={handleSubmit} disabled={loading} style={primaryBtn}>
                送審帳單
              </button>
            </>
          )}
          {editing && (
            <>
              <button onClick={() => setEditing(false)} style={cancelBtn}>取消</button>
              <button onClick={handleSave} disabled={loading} style={primaryBtn}>
                {loading ? '儲存中…' : '儲存'}
              </button>
            </>
          )}
          {!isDraft && !editing && (
            <button onClick={onClose} style={cancelBtn}>關閉</button>
          )}
          {isDraft && !editing && (
            <button onClick={onClose} style={cancelBtn}>關閉</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#718096' }}>{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ label, value, span }) {
  return (
    <div style={{ gridColumn: span ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 11, color: '#a0aec0', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#2d3748' }}>{value}</div>
    </div>
  );
}

// ── 新增帳單 Modal ────────────────────────────────────────────
function CreateBillModal({ categories, onClose, onCreated }) {
  const [form, setForm] = useState({
    period:                currentMonth(),
    title:                 '',
    description:           '',
    total_amount:          '',
    accounting_category_id:'',
    invoice_no:            '',
    invoice_date:          '',
    notes:                 '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!form.period || !form.title || !form.total_amount) {
      setError('請填寫：月份、標題、金額');
      return;
    }
    setLoading(true);
    try {
      const res = await vendorApi.createBill({
        ...form,
        total_amount: parseFloat(form.total_amount),
        accounting_category_id: form.accounting_category_id || null,
        invoice_date: form.invoice_date || null,
      });
      if (res.success) { onCreated(res.data); onClose(); }
      else setError(res.message || '建立失敗');
    } catch (err) {
      setError(err.message || '建立失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={{ ...modalBox, maxWidth: 520 }}>
        <div style={modalHeader}>
          <h3 style={{ margin: 0, fontSize: 16 }}>新增帳單</h3>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: 'calc(90vh - 120px)' }}>
          {error && <div style={{ ...errorBox, marginBottom: 12 }}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
              <Field label="帳單月份 *">
                <input type="month" style={input} value={form.period}
                  onChange={e => setForm(f => ({ ...f, period: e.target.value }))} />
              </Field>
              <Field label="金額（NT$）*">
                <input type="number" style={input} value={form.total_amount}
                  placeholder="0" onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
              </Field>
            </div>

            <Field label="帳單標題 *">
              <input style={input} value={form.title}
                placeholder="如：2025年5月維修費" onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </Field>

            <Field label="會計科目">
              <select style={input} value={form.accounting_category_id}
                onChange={e => setForm(f => ({ ...f, accounting_category_id: e.target.value }))}>
                <option value="">— 選擇科目（選填）—</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.code ? `[${c.code}] ` : ''}{c.name}</option>
                ))}
              </select>
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
              <Field label="發票號碼">
                <input style={input} value={form.invoice_no}
                  onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))} />
              </Field>
              <Field label="發票日期">
                <input type="date" style={input} value={form.invoice_date}
                  onChange={e => setForm(f => ({ ...f, invoice_date: e.target.value }))} />
              </Field>
            </div>

            <Field label="說明">
              <textarea style={{ ...input, height: 60, resize: 'vertical' }} value={form.description}
                placeholder="帳單說明（選填）" onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </Field>

            <Field label="備註">
              <textarea style={{ ...input, height: 50, resize: 'vertical' }} value={form.notes}
                placeholder="備註（選填）" onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
          </div>

          <p style={{ fontSize: 12, color: '#a0aec0', marginTop: 14 }}>
            帳單建立後為「草稿」狀態，可修改後再送審。
            送審後由樂活眼鏡確認並分配至門市。
          </p>
        </div>

        <div style={modalFooter}>
          <button onClick={onClose} style={cancelBtn}>取消</button>
          <button onClick={handleSubmit} disabled={loading} style={primaryBtn}>
            {loading ? '建立中…' : '建立帳單'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────
export default function VendorBillsPage() {
  const { vendor }   = useVendorAuth();
  const [bills, setBills]         = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter]       = useState({ period: '', status: '' });
  const [loading, setLoading]     = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [showCreate, setShowCreate]     = useState(false);

  // 載入會計科目
  useEffect(() => {
    vendorApi.getCategories().then(r => r.success && setCategories(r.data));
  }, []);

  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await vendorApi.getBills({
        period: filter.period || undefined,
        status: filter.status || undefined,
        limit:  100,
      });
      if (res.success) setBills(res.data);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadBills(); }, [loadBills]);

  const openBill = async (id) => {
    const res = await vendorApi.getBill(id);
    if (res.success) setSelectedBill(res.data);
  };

  const refreshSelected = async () => {
    if (!selectedBill) return;
    const res = await vendorApi.getBill(selectedBill.id);
    if (res.success) setSelectedBill(res.data);
    loadBills();
  };

  // 統計
  const stats = {
    total:    bills.length,
    draft:    bills.filter(b => b.status === 'draft').length,
    pending:  bills.filter(b => b.status === 'submitted').length,
    amount:   bills.filter(b => !['void'].includes(b.status))
                   .reduce((s, b) => s + parseFloat(b.total_amount || 0), 0),
  };

  return (
    <div>
      {/* 歡迎標題 */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a202c' }}>
          帳單管理
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#718096' }}>
          {vendor?.source_name} 的帳單紀錄
        </p>
      </div>

      {/* 統計卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="帳單總數"   value={stats.total}               color="#3182ce" />
        <StatCard label="草稿"       value={stats.draft}               color="#718096" />
        <StatCard label="待審核"     value={stats.pending}             color="#d69e2e" />
        <StatCard label="總金額"     value={fmtMoney(stats.amount)}    color="#38a169" small />
      </div>

      {/* 操作列 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: '#718096', fontWeight: 600, marginBottom: 4 }}>月份</div>
            <input type="month" style={{ ...input, width: 140 }} value={filter.period}
              onChange={e => setFilter(f => ({ ...f, period: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#718096', fontWeight: 600, marginBottom: 4 }}>狀態</div>
            <select style={{ ...input, width: 130 }} value={filter.status}
              onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
              <option value="">全部狀態</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} style={primaryBtn}>
          ＋ 新增帳單
        </button>
      </div>

      {/* 帳單列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#a0aec0' }}>載入中…</div>
      ) : bills.length === 0 ? (
        <div style={emptyState}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧾</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#4a5568' }}>
            {filter.period || filter.status ? '此條件下無帳單' : '尚未有帳單'}
          </div>
          <div style={{ fontSize: 13, color: '#a0aec0', marginTop: 4 }}>
            點擊「新增帳單」建立第一張帳單
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bills.map(b => (
            <div key={b.id} style={billCard} onClick={() => openBill(b.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#718096' }}>
                    {b.bill_no || b.id.slice(0, 8)}
                  </span>
                  <StatusBadge status={b.status} />
                  <span style={{ fontSize: 12, color: '#a0aec0' }}>{b.period}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#2d3748', marginBottom: 2 }}>
                  {b.title}
                </div>
                {b.accounting_categories?.name && (
                  <div style={{ fontSize: 12, color: '#718096' }}>
                    科目：{b.accounting_categories.name}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#2d3748' }}>
                  {fmtMoney(b.total_amount)}
                </div>
                <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 2 }}>
                  {fmtDate(b.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {selectedBill && (
        <BillDetailModal
          bill={selectedBill}
          categories={categories}
          onClose={() => setSelectedBill(null)}
          onRefresh={refreshSelected}
        />
      )}
      {showCreate && (
        <CreateBillModal
          categories={categories}
          onClose={() => setShowCreate(false)}
          onCreated={(bill) => { setSelectedBill(bill); loadBills(); }}
        />
      )}
    </div>
  );
}

// ── 統計卡片 ─────────────────────────────────────────────────
function StatCard({ label, value, color, small }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '14px 18px',
      borderLeft: `4px solid ${color}`,
      boxShadow:  '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: 11, color: '#718096', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: small ? 16 : 24, fontWeight: 700, color: '#2d3748' }}>{value}</div>
    </div>
  );
}

// ── 樣式 ────────────────────────────────────────────────────
const overlay = {
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
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  padding: '14px 20px', borderBottom: '1px solid #e2e8f0',
};
const modalFooter = {
  display: 'flex', justifyContent: 'flex-end', gap: 8,
  padding: '12px 20px', borderTop: '1px solid #e2e8f0',
};
const closeBtn     = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#718096' };
const primaryBtn   = { background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 600 };
const secondaryBtn = { background: '#edf2f7', color: '#4a5568', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, cursor: 'pointer' };
const cancelBtn    = { background: '#f7fafc', color: '#718096', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 18px', fontSize: 13, cursor: 'pointer' };
const input        = { border: '1.5px solid #e2e8f0', borderRadius: 7, padding: '8px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none', color: '#2d3748' };
const errorBox     = { background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 6, padding: '8px 12px', color: '#c53030', fontSize: 13 };
const successBox   = { background: '#f0fff4', border: '1px solid #c6f6d5', borderRadius: 6, padding: '8px 12px', color: '#276749', fontSize: 13 };
const th           = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#4a5568', borderBottom: '2px solid #e2e8f0' };
const td           = { padding: '8px 10px', borderBottom: '1px solid #f0f0f0', fontSize: 13 };
const billCard     = {
  background: '#fff', borderRadius: 10, padding: '14px 18px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  display: 'flex', alignItems: 'flex-start', gap: 16,
  cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.1s',
  border: '1px solid #e2e8f0',
};
const emptyState = {
  textAlign: 'center', padding: '60px 20px',
  background: '#fff', borderRadius: 12, border: '2px dashed #e2e8f0',
};
