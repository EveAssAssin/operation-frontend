// pages/recurringExpenses/RecurringExpensesPage.jsx
// 常態費用模組
//   Tab 1：本月應付（含標記已付）
//   Tab 2：費用設定（CRUD）

import { useState, useEffect, useCallback, useMemo } from 'react';
import { recurringExpensesApi } from '../../services/api';

// ── 工具 ────────────────────────────────────────────────────
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtAmount(n) {
  return Number(n || 0).toLocaleString('zh-TW');
}
function fmtDate(s) {
  if (!s) return '—';
  return s.slice(0, 10);
}

const HOLIDAY_RULES = [
  { value: 'previous_workday', label: '遇假日往前到上一個工作天' },
  { value: 'none',             label: '不調整（保留原日期）' },
];

const TARGET_TYPES = [
  { value: 'store',      label: '門市' },
  { value: 'department', label: '部門' },
];

// ════════════════════════════════════════════════════════════
// 主元件
// ════════════════════════════════════════════════════════════
export default function RecurringExpensesPage() {
  const [tab, setTab] = useState('payments'); // 'payments' | 'expenses'

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>💴 常態費用</h1>
        <div style={S.subtitle}>每月固定支付的費用項目（房租、水電、保全費等）每天 09:00 自動推播當日應付清單</div>
      </div>

      <div style={S.tabBar}>
        <TabBtn active={tab === 'payments'} onClick={() => setTab('payments')}>
          📋 本月應付
        </TabBtn>
        <TabBtn active={tab === 'expenses'} onClick={() => setTab('expenses')}>
          ⚙️ 費用設定
        </TabBtn>
      </div>

      <div style={S.tabContent}>
        {tab === 'payments' ? <PaymentsTab /> : <ExpensesTab />}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{ ...S.tabBtn, ...(active ? S.tabBtnActive : null) }}
    >
      {children}
    </button>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 1：本月應付
// ════════════════════════════════════════════════════════════
function PaymentsTab() {
  const [month, setMonth]       = useState(currentMonth());
  const [loading, setLoading]   = useState(true);
  const [payments, setPayments] = useState([]);
  const [error, setError]       = useState('');

  const today = todayStr();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await recurringExpensesApi.listPayments(month);
      setPayments(res.data?.payments || []);
    } catch (e) {
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    const total   = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const paid    = payments.filter(p => p.status === 'paid');
    const pending = payments.filter(p => p.status === 'pending');
    const todayDue = pending.filter(p => p.due_date === today);
    return {
      count: payments.length,
      total,
      paid_count: paid.length,
      paid_amount: paid.reduce((s, p) => s + Number(p.amount || 0), 0),
      pending_count: pending.length,
      pending_amount: pending.reduce((s, p) => s + Number(p.amount || 0), 0),
      today_due_count: todayDue.length,
    };
  }, [payments, today]);

  async function handlePay(id) {
    const note = window.prompt('（可選）支付備註：');
    if (note === null) return; // 按取消
    try {
      await recurringExpensesApi.markPaid(id, note || null);
      await load();
    } catch (e) {
      alert('標記失敗：' + (e.message || ''));
    }
  }
  async function handleUnpay(id) {
    if (!window.confirm('要把這筆改回「未付」嗎？')) return;
    try {
      await recurringExpensesApi.unmarkPaid(id);
      await load();
    } catch (e) {
      alert('操作失敗：' + (e.message || ''));
    }
  }

  return (
    <div>
      {/* 篩選列 */}
      <div style={S.filterRow}>
        <label style={S.label}>月份</label>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          style={S.input}
        />
        <button style={S.btnSecondary} onClick={load} disabled={loading}>
          {loading ? '載入中...' : '重新載入'}
        </button>
      </div>

      {/* 摘要卡片 */}
      <div style={S.summaryRow}>
        <SummaryCard label="當月總額"   value={`$ ${fmtAmount(summary.total)}`} />
        <SummaryCard label="筆數"       value={`${summary.count}`}   small={`已付 ${summary.paid_count} / 未付 ${summary.pending_count}`} />
        <SummaryCard label="已付金額"   value={`$ ${fmtAmount(summary.paid_amount)}`}    color="#2e7d32" />
        <SummaryCard label="未付金額"   value={`$ ${fmtAmount(summary.pending_amount)}`} color="#c53030" />
        <SummaryCard label="今日到期"   value={`${summary.today_due_count} 筆`}          color="#d97706" />
      </div>

      {/* 錯誤訊息 */}
      {error && <div style={S.errorBanner}>{error}</div>}

      {/* 表格 */}
      {!loading && payments.length === 0 && !error && (
        <div style={S.empty}>本月還沒有任何常態費用紀錄。請先到「費用設定」分頁建立費用項目。</div>
      )}

      {payments.length > 0 && (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>狀態</th>
                <th style={S.th}>應付日</th>
                <th style={S.th}>費用項目</th>
                <th style={S.th}>開帳對象</th>
                <th style={{ ...S.th, textAlign: 'right' }}>金額</th>
                <th style={S.th}>支付日 / 備註</th>
                <th style={{ ...S.th, textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => {
                const isToday = p.due_date === today && p.status === 'pending';
                const isOverdue = p.due_date < today && p.status === 'pending';
                return (
                  <tr key={p.id} style={{
                    ...S.tr,
                    background: isToday ? '#fff7e6'
                              : isOverdue ? '#fde8e8'
                              : undefined,
                  }}>
                    <td style={S.td}>
                      {p.status === 'paid' && <span style={S.badgePaid}>✓ 已付</span>}
                      {p.status === 'pending' && (isToday
                        ? <span style={S.badgeToday}>📌 今日到期</span>
                        : isOverdue
                          ? <span style={S.badgeOverdue}>⚠ 已逾期</span>
                          : <span style={S.badgePending}>未付</span>
                      )}
                      {p.status === 'skipped' && <span style={S.badgeSkipped}>跳過</span>}
                    </td>
                    <td style={S.td}>
                      {fmtDate(p.due_date)}
                      {p.original_due_date !== p.due_date && (
                        <div style={S.smallNote}>原 {fmtDate(p.original_due_date)}（順延）</div>
                      )}
                    </td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600 }}>{p.recurring_expenses?.name || '—'}</div>
                    </td>
                    <td style={S.td}>
                      <span style={S.targetTag}>
                        {p.bill_target_type === 'store' ? '門市' : '部門'}
                      </span>{' '}
                      {p.bill_target_name}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>
                      $ {fmtAmount(p.amount)}
                    </td>
                    <td style={S.td}>
                      {p.status === 'paid' ? (
                        <>
                          <div>{p.paid_at ? new Date(p.paid_at).toLocaleString('zh-TW') : '—'}</div>
                          {p.paid_note && <div style={S.smallNote}>備註：{p.paid_note}</div>}
                        </>
                      ) : '—'}
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      {p.status === 'pending'
                        ? <button style={S.btnPrimary} onClick={() => handlePay(p.id)}>標記已付</button>
                        : <button style={S.btnGhost}   onClick={() => handleUnpay(p.id)}>還原</button>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, small, color }) {
  return (
    <div style={S.summaryCard}>
      <div style={S.summaryLabel}>{label}</div>
      <div style={{ ...S.summaryValue, color: color || S.summaryValue.color }}>{value}</div>
      {small && <div style={S.summarySmall}>{small}</div>}
    </div>
  );
}


// ════════════════════════════════════════════════════════════
// Tab 2：費用設定
// ════════════════════════════════════════════════════════════
function ExpensesTab() {
  const [loading, setLoading]   = useState(true);
  const [items, setItems]       = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await recurringExpensesApi.list(showInactive ? null : true);
      setItems(res.data || []);
    } catch (e) {
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(item) {
    setEditing(item);
    setShowForm(true);
  }
  async function handleDelete(item) {
    if (!window.confirm(`確定要停用「${item.name}」嗎？\n（停用後本月之後不會再產生應付紀錄；歷史紀錄會保留）`)) return;
    try {
      await recurringExpensesApi.remove(item.id);
      await load();
    } catch (e) {
      alert('停用失敗：' + (e.message || ''));
    }
  }
  async function handleReactivate(item) {
    try {
      await recurringExpensesApi.update(item.id, { is_active: true });
      await load();
    } catch (e) {
      alert('啟用失敗：' + (e.message || ''));
    }
  }

  return (
    <div>
      {/* 工具列 */}
      <div style={S.filterRow}>
        <button style={S.btnPrimary} onClick={openNew}>＋ 新增費用項目</button>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
          />
          顯示已停用
        </label>
      </div>

      {error && <div style={S.errorBanner}>{error}</div>}

      {!loading && items.length === 0 && !error && (
        <div style={S.empty}>還沒有任何費用項目，點上方「新增費用項目」開始建立。</div>
      )}

      {items.length > 0 && (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>名稱</th>
                <th style={S.th}>金額</th>
                <th style={S.th}>支付週期</th>
                <th style={S.th}>開帳對象</th>
                <th style={S.th}>套用期間</th>
                <th style={S.th}>狀態</th>
                <th style={{ ...S.th, textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} style={S.tr}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600 }}>{it.name}</div>
                    {it.description && <div style={S.smallNote}>{it.description}</div>}
                  </td>
                  <td style={{ ...S.td, fontWeight: 600 }}>$ {fmtAmount(it.amount)}</td>
                  <td style={S.td}>
                    每月 {it.cycle_day} 日
                    {it.holiday_rule === 'previous_workday' && (
                      <div style={S.smallNote}>遇假日往前到上個工作天</div>
                    )}
                  </td>
                  <td style={S.td}>
                    <span style={S.targetTag}>
                      {it.bill_target_type === 'store' ? '門市' : '部門'}
                    </span>{' '}
                    {it.bill_target_name}
                  </td>
                  <td style={S.td}>
                    {it.start_year_month || '—'} ～ {it.end_year_month || '無限期'}
                  </td>
                  <td style={S.td}>
                    {it.is_active
                      ? <span style={S.badgeActive}>啟用中</span>
                      : <span style={S.badgeInactive}>已停用</span>
                    }
                  </td>
                  <td style={{ ...S.td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button style={S.btnGhost} onClick={() => openEdit(it)}>編輯</button>
                    {it.is_active
                      ? <button style={S.btnDanger} onClick={() => handleDelete(it)}>停用</button>
                      : <button style={S.btnGhost}  onClick={() => handleReactivate(it)}>啟用</button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ExpenseFormModal
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={async () => { setShowForm(false); await load(); }}
        />
      )}
    </div>
  );
}


// ════════════════════════════════════════════════════════════
// 新增 / 編輯 Modal
// ════════════════════════════════════════════════════════════
function ExpenseFormModal({ editing, onClose, onSaved }) {
  const isEdit = !!editing;
  const [form, setForm] = useState(() => ({
    name:             editing?.name             || '',
    description:      editing?.description      || '',
    amount:           editing?.amount           ?? '',
    cycle_day:        editing?.cycle_day        ?? 5,
    holiday_rule:     editing?.holiday_rule     || 'previous_workday',
    bill_target_type: editing?.bill_target_type || 'store',
    bill_target_id:   editing?.bill_target_id   || '',
    bill_target_name: editing?.bill_target_name || '',
    start_year_month: editing?.start_year_month || '',
    end_year_month:   editing?.end_year_month   || '',
    note:             editing?.note             || '',
    is_active:        editing?.is_active ?? true,
  }));
  const [stores,      setStores]      = useState([]);
  const [departments, setDepartments] = useState([]);
  const [saving, setSaving]           = useState(false);
  const [error,  setError]            = useState('');

  // 載入下拉選單
  useEffect(() => {
    (async () => {
      try {
        const [s, d] = await Promise.all([
          recurringExpensesApi.getStores(),
          recurringExpensesApi.getDepartments(),
        ]);
        setStores(s.data || []);
        setDepartments(d.data || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  function update(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function pickTarget(type, id) {
    const list = type === 'store' ? stores : departments;
    const found = list.find(x => String(x.id) === String(id));
    setForm(f => ({
      ...f,
      bill_target_type: type,
      bill_target_id:   id,
      bill_target_name: found?.name || '',
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.name.trim())             return setError('費用名稱必填');
    if (!form.amount || isNaN(Number(form.amount))) return setError('金額必須是數字');
    if (!form.cycle_day || form.cycle_day < 1 || form.cycle_day > 31) return setError('支付日期需在 1~31 之間');
    if (!form.bill_target_id)          return setError('請選擇開帳對象');

    const payload = {
      ...form,
      amount:    Number(form.amount),
      cycle_day: Number(form.cycle_day),
    };
    // 空字串轉 null
    if (!payload.start_year_month) payload.start_year_month = null;
    if (!payload.end_year_month)   payload.end_year_month   = null;

    setSaving(true);
    try {
      if (isEdit) {
        await recurringExpensesApi.update(editing.id, payload);
      } else {
        await recurringExpensesApi.create(payload);
      }
      await onSaved();
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  }

  const targetList = form.bill_target_type === 'store' ? stores : departments;

  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h2 style={S.modalTitle}>{isEdit ? '編輯費用項目' : '新增費用項目'}</h2>
          <button style={S.modalClose} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={S.formRow}>
            <Field label="費用名稱 *">
              <input
                style={S.input}
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="例如：台北門市房租"
                required
              />
            </Field>
          </div>

          <div style={S.formRow2}>
            <Field label="金額（元）*">
              <input
                style={S.input}
                type="number"
                value={form.amount}
                onChange={e => update('amount', e.target.value)}
                min="0"
                step="1"
                required
              />
            </Field>
            <Field label="每月幾號支付 *">
              <input
                style={S.input}
                type="number"
                min="1" max="31"
                value={form.cycle_day}
                onChange={e => update('cycle_day', e.target.value)}
                required
              />
            </Field>
          </div>

          <div style={S.formRow}>
            <Field label="假日規則">
              <select
                style={S.input}
                value={form.holiday_rule}
                onChange={e => update('holiday_rule', e.target.value)}
              >
                {HOLIDAY_RULES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div style={S.formRow2}>
            <Field label="開帳對象類型 *">
              <select
                style={S.input}
                value={form.bill_target_type}
                onChange={e => {
                  update('bill_target_type', e.target.value);
                  update('bill_target_id', '');
                  update('bill_target_name', '');
                }}
              >
                {TARGET_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="開帳對象 *">
              <select
                style={S.input}
                value={form.bill_target_id}
                onChange={e => pickTarget(form.bill_target_type, e.target.value)}
                required
              >
                <option value="">— 請選擇 —</option>
                {targetList.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div style={S.formRow2}>
            <Field label="從哪一期開始（選填）">
              <input
                style={S.input}
                type="month"
                value={form.start_year_month}
                onChange={e => update('start_year_month', e.target.value)}
              />
            </Field>
            <Field label="結束期（選填）">
              <input
                style={S.input}
                type="month"
                value={form.end_year_month}
                onChange={e => update('end_year_month', e.target.value)}
              />
            </Field>
          </div>

          <div style={S.formRow}>
            <Field label="備註（選填）">
              <textarea
                style={{ ...S.input, minHeight: 60 }}
                value={form.note}
                onChange={e => update('note', e.target.value)}
              />
            </Field>
          </div>

          {error && <div style={S.errorBanner}>{error}</div>}

          <div style={S.modalActions}>
            <button type="button" style={S.btnGhost} onClick={onClose} disabled={saving}>取消</button>
            <button type="submit" style={S.btnPrimary} disabled={saving}>
              {saving ? '儲存中...' : (isEdit ? '更新' : '建立')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={S.field}>
      <span style={S.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}


// ════════════════════════════════════════════════════════════
// 樣式
// ════════════════════════════════════════════════════════════
const C = { primary: '#50422d', gold: '#8b6f4e', sand: '#cdbea2', bg: '#faf8f5' };

const S = {
  page:     { padding: '24px 28px', maxWidth: 1280, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header:   { marginBottom: 18 },
  title:    { fontSize: 24, fontWeight: 700, color: C.primary, margin: 0 },
  subtitle: { fontSize: 13, color: '#777', marginTop: 6 },

  tabBar:    { display: 'flex', gap: 4, borderBottom: '2px solid #e8e3dc', marginBottom: 20 },
  tabBtn:    { padding: '10px 18px', background: 'none', border: 'none', borderBottom: '2px solid transparent', marginBottom: -2, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#888' },
  tabBtnActive: { color: C.primary, borderBottom: `2px solid ${C.gold}` },
  tabContent: { },

  filterRow:  { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  label:      { fontSize: 13, color: '#666' },

  summaryRow:    { display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' },
  summaryCard:   { flex: '1 1 140px', background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  summaryLabel:  { fontSize: 11, color: '#999', marginBottom: 6 },
  summaryValue:  { fontSize: 18, fontWeight: 700, color: C.primary },
  summarySmall:  { fontSize: 11, color: '#aaa', marginTop: 4 },

  errorBanner: { background: '#fce4ec', color: '#c62828', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 14 },
  empty:       { textAlign: 'center', padding: 40, color: '#aaa', fontSize: 14, background: '#fff', border: '1px dashed #ddd', borderRadius: 10 },

  tableWrap:  { background: '#fff', border: '1px solid #eee', borderRadius: 10, overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  table:      { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:         { padding: '10px 12px', background: '#faf8f5', color: '#555', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' },
  tr:         { borderBottom: '1px solid #f5f5f5' },
  td:         { padding: '10px 12px', color: '#444', verticalAlign: 'top' },
  smallNote:  { fontSize: 11, color: '#888', marginTop: 2 },
  targetTag:  { fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#ede8e3', color: C.primary, fontWeight: 600 },

  badgePaid:    { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#e8f5e9', color: '#2e7d32', fontWeight: 600 },
  badgeToday:   { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#fff3cd', color: '#d97706', fontWeight: 600 },
  badgeOverdue: { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#fde8e8', color: '#c62828', fontWeight: 600 },
  badgePending: { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#f0f0f0', color: '#666',    fontWeight: 600 },
  badgeSkipped: { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#eee',    color: '#999',    fontWeight: 600 },
  badgeActive:  { fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#e8f5e9', color: '#2e7d32', fontWeight: 600 },
  badgeInactive:{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#eee',    color: '#888',    fontWeight: 600 },

  btnPrimary:   { padding: '8px 16px', background: C.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnSecondary: { padding: '7px 14px', background: '#fff', color: C.primary, border: `1px solid ${C.sand}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnGhost:     { padding: '6px 10px', background: 'transparent', color: C.gold, border: `1px solid ${C.sand}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, marginRight: 4 },
  btnDanger:    { padding: '6px 10px', background: 'transparent', color: '#c53030', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  input:        { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, color: C.primary, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },

  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 },
  modal:        { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #eee' },
  modalTitle:   { fontSize: 16, fontWeight: 700, color: C.primary, margin: 0 },
  modalClose:   { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' },
  modalActions: { padding: '12px 20px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #eee' },

  formRow:    { padding: '12px 20px 0' },
  formRow2:   { padding: '12px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field:      { display: 'flex', flexDirection: 'column', gap: 5 },
  fieldLabel: { fontSize: 12, color: '#666', fontWeight: 600 },
};
