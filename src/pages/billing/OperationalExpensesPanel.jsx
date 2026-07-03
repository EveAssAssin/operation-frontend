// pages/billing/OperationalExpensesPanel.jsx
// 營運費用（電費 / 水費 / 電話與網路 ...）
//   - 列表 + 篩選
//   - 新增 / 編輯 modal（含分帳 table）

import { useState, useEffect, useCallback } from 'react';
import { operationalExpensesApi, personnelApi, basicDataApi } from '../../services/api';

const fmt = n => Number(n || 0).toLocaleString('zh-TW');
function today() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }); }
function firstOfMonth(d = new Date()) { return d.toISOString().slice(0, 7) + '-01'; }
function lastOfMonth(d = new Date()) {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}
function ymOf(dateStr) { return String(dateStr || '').slice(0, 7); }

export default function OperationalExpensesPanel() {
  const [list, setList]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [editing, setEditing]   = useState(null); // null | {} for new | existing object for edit
  const [filter, setFilter]     = useState({ from: '', to: '', category_id: '', store_erpid: '' });
  const [categories, setCategories] = useState([]);
  const [storeMap, setStoreMap]     = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.from)        params.from        = filter.from;
      if (filter.to)          params.to          = filter.to;
      if (filter.category_id) params.category_id = filter.category_id;
      if (filter.store_erpid) params.store_erpid = filter.store_erpid;
      const r = await operationalExpensesApi.list(params);
      setList(r.success ? r.data : []);
    } catch (e) { alert('載入失敗：' + (e?.message || e)); }
    finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  // 撈基本資料分類 + 門市 map
  useEffect(() => {
    basicDataApi.listCategories().then(r => setCategories(r.success ? r.data : [])).catch(() => {});
    personnelApi.getDepartments().then(r => {
      const m = {};
      for (const d of (r.data || [])) if (d.store_erpid) m[d.store_erpid] = d.store_name;
      setStoreMap(m);
    }).catch(() => {});
  }, []);

  async function remove(id) {
    if (!window.confirm('刪除此筆營運費用？分帳明細會一起刪掉，動作無法復原。')) return;
    try {
      await operationalExpensesApi.remove(id);
      await load();
    } catch (e) { alert('刪除失敗：' + (e?.message || e)); }
  }

  return (
    <div>
      <div style={S.toolbar}>
        <span style={S.label}>建檔日 從</span>
        <input type="date" style={S.input} value={filter.from} onChange={e => setFilter(f => ({ ...f, from: e.target.value }))} />
        <span style={S.label}>至</span>
        <input type="date" style={S.input} value={filter.to} onChange={e => setFilter(f => ({ ...f, to: e.target.value }))} />
        <span style={S.label}>分類</span>
        <select style={S.select} value={filter.category_id} onChange={e => setFilter(f => ({ ...f, category_id: e.target.value }))}>
          <option value="">全部</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon || ''} {c.name}</option>)}
        </select>
        <span style={S.label}>門市</span>
        <select style={S.select} value={filter.store_erpid} onChange={e => setFilter(f => ({ ...f, store_erpid: e.target.value }))}>
          <option value="">全部</option>
          {Object.entries(storeMap).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button style={S.btnPrimary} onClick={() => setEditing({})}>＋ 新增</button>
      </div>

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>建檔日</th>
              <th style={S.th}>費用期間</th>
              <th style={S.th}>分類</th>
              <th style={S.th}>電號 / 帳號</th>
              <th style={S.th}>主要門市</th>
              <th style={{ ...S.th, textAlign: 'right' }}>總金額</th>
              <th style={{ ...S.th, textAlign: 'right' }}>分帳合計</th>
              <th style={S.th}>備註</th>
              <th style={S.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} style={S.empty}>載入中...</td></tr>}
            {!loading && list.length === 0 && <tr><td colSpan={9} style={S.empty}>沒有資料，點右上「＋ 新增」建立第一筆</td></tr>}
            {list.map(x => {
              const allocSum = (x.allocations || []).reduce((s, a) => s + Number(a.amount || 0), 0);
              const diff = Number(x.total_amount || 0) - allocSum;
              const factLabel = x.fact ? (getFactDisplay(x.fact)) : '—';
              return (
                <tr key={x.id}>
                  <td style={S.td}>{x.entry_date}</td>
                  <td style={S.td}>{x.period_from} ~ {x.period_to}</td>
                  <td style={S.td}>{x.category ? (x.category.icon || '') + ' ' + x.category.name : '—'}</td>
                  <td style={S.td}>{factLabel}</td>
                  <td style={S.td}>{storeMap[x.store_erpid] || x.store_erpid || '—'}</td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>${fmt(x.total_amount)}</td>
                  <td style={{ ...S.td, textAlign: 'right', color: diff === 0 ? '#276749' : '#c53030' }}>
                    ${fmt(allocSum)}
                    {diff !== 0 && (
                      <div style={{ fontSize: 10 }}>
                        差 ${fmt(Math.abs(diff))}
                      </div>
                    )}
                  </td>
                  <td style={S.td}>{x.notes || '—'}</td>
                  <td style={S.td}>
                    <button style={S.btnGhost} onClick={() => setEditing(x)}>編輯</button>
                    <button style={S.btnDanger} onClick={() => remove(x.id)}>刪除</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <ExpenseModal
          expense={editing}
          categories={categories}
          storeMap={storeMap}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// 從 entity_facts.data 中把所有欄位值依序 concat 顯示（電號 / 戶名 / 地址 等）
// data 是 JSONB { field_key: value }，這邊直接把所有非空 value 串起來，再接門市名
function getFactDisplay(fact) {
  if (!fact) return '';
  const d = fact.data || {};
  const values = Object.entries(d)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([, v]) => String(v).trim());
  const store = fact.store_name || fact.store_erpid || '';
  return [...values, store].filter(Boolean).join(' · ');
}

// ═══════════════════════════════════════════════════════════════
// 新增 / 編輯 Modal（含分帳 table）
// ═══════════════════════════════════════════════════════════════
function ExpenseModal({ expense, categories, storeMap, onClose, onSaved }) {
  const isNew = !expense.id;
  const [form, setForm] = useState({
    entry_date:   expense.entry_date   || today(),
    period_from:  expense.period_from  || firstOfMonth(),
    period_to:    expense.period_to    || lastOfMonth(),
    category_id:  expense.category_id  || '',
    fact_id:      expense.fact_id      || '',
    store_erpid:  expense.store_erpid  || '',
    total_amount: expense.total_amount || '',
    notes:        expense.notes        || '',
  });
  const [facts, setFacts] = useState([]);
  const [allocations, setAllocations] = useState(
    (expense.allocations || []).map(a => ({ ...a }))
  );
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // 選了分類 → 撈該分類底下 facts
  useEffect(() => {
    if (!form.category_id) { setFacts([]); return; }
    operationalExpensesApi.listFactsByCategory(form.category_id)
      .then(r => setFacts(r.success ? r.data : []))
      .catch(() => setFacts([]));
  }, [form.category_id]);

  // 選電號 → 自動帶主要門市
  function onPickFact(fid) {
    set('fact_id', fid);
    const f = facts.find(x => String(x.id) === String(fid));
    if (f) set('store_erpid', f.store_erpid || '');
  }

  // 分帳操作
  function addAlloc() {
    setAllocations(a => [...a, { store_erpid: form.store_erpid || '', year_month: ymOf(form.period_to), amount: '' }]);
  }
  function updAlloc(i, k, v) {
    setAllocations(a => a.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  }
  function delAlloc(i) {
    setAllocations(a => a.filter((_, idx) => idx !== i));
  }
  const allocSum = allocations.reduce((s, a) => s + Number(a.amount || 0), 0);
  const totalNum = Number(form.total_amount || 0);
  const diff = totalNum - allocSum;

  async function save() {
    if (!form.entry_date)                      return alert('建檔日必填');
    if (!form.period_from || !form.period_to)  return alert('費用期間必填');
    if (!form.total_amount)                    return alert('總金額必填');
    setSaving(true);
    try {
      const body = {
        entry_date:   form.entry_date,
        period_from:  form.period_from,
        period_to:    form.period_to,
        category_id:  form.category_id || null,
        fact_id:      form.fact_id || null,
        store_erpid:  form.store_erpid || null,
        total_amount: Number(form.total_amount) || 0,
        notes:        form.notes || null,
      };
      let expenseId = expense.id;
      if (isNew) {
        body.allocations = allocations;
        const r = await operationalExpensesApi.create(body);
        if (!r.success) throw new Error(r.message);
        expenseId = r.data.id;
      } else {
        const r = await operationalExpensesApi.update(expense.id, body);
        if (!r.success) throw new Error(r.message);
        await operationalExpensesApi.replaceAllocations(expense.id, allocations);
      }
      onSaved();
    } catch (e) {
      alert('儲存失敗：' + (e?.message || e));
    } finally { setSaving(false); }
  }

  return (
    <div style={S.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modalBox}>
        <div style={S.modalHeader}>
          <strong>{isNew ? '＋ 新增營運費用' : `✏ 編輯營運費用`}</strong>
          <button onClick={onClose} style={S.close}>✕</button>
        </div>
        <div style={S.modalBody}>
          <div style={S.formRow}>
            <div style={S.field}>
              <label style={S.fieldLabel}>建檔日 *</label>
              <input type="date" style={S.input} value={form.entry_date} onChange={e => set('entry_date', e.target.value)} />
            </div>
            <div style={S.field}>
              <label style={S.fieldLabel}>費用期間起 *</label>
              <input type="date" style={S.input} value={form.period_from} onChange={e => set('period_from', e.target.value)} />
            </div>
            <div style={S.field}>
              <label style={S.fieldLabel}>費用期間訖 *</label>
              <input type="date" style={S.input} value={form.period_to} onChange={e => set('period_to', e.target.value)} />
            </div>
          </div>
          <div style={S.formRow}>
            <div style={S.field}>
              <label style={S.fieldLabel}>分類（電費/水費/...）</label>
              <select style={S.select} value={form.category_id} onChange={e => { set('category_id', e.target.value); set('fact_id', ''); set('store_erpid', ''); }}>
                <option value="">— 選擇分類 —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon || ''} {c.name}</option>)}
              </select>
            </div>
            <div style={{ ...S.field, flex: 2 }}>
              <label style={S.fieldLabel}>電號 / 帳號</label>
              <select style={S.select} value={form.fact_id} onChange={e => onPickFact(e.target.value)} disabled={!form.category_id}>
                <option value="">{form.category_id ? '— 選擇電號 —' : '請先選分類'}</option>
                {facts.map(f => <option key={f.id} value={f.id}>{getFactDisplay(f)}</option>)}
              </select>
            </div>
            <div style={S.field}>
              <label style={S.fieldLabel}>主要門市</label>
              <select style={S.select} value={form.store_erpid} onChange={e => set('store_erpid', e.target.value)}>
                <option value="">—</option>
                {Object.entries(storeMap).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
          </div>
          <div style={S.formRow}>
            <div style={S.field}>
              <label style={S.fieldLabel}>總金額 *</label>
              <input type="number" style={S.input} value={form.total_amount} onChange={e => set('total_amount', e.target.value)} />
            </div>
            <div style={{ ...S.field, flex: 3 }}>
              <label style={S.fieldLabel}>備註</label>
              <input style={S.input} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="例如：6/24代繳" />
            </div>
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ fontSize: 14 }}>分帳明細</strong>
              <span style={{ marginLeft: 12, fontSize: 12, color: '#718096' }}>
                共 {allocations.length} 筆，總 ${fmt(allocSum)}
                {diff !== 0 && <span style={{ marginLeft: 8, color: '#c53030' }}>（差 ${fmt(Math.abs(diff))}）</span>}
              </span>
              <div style={{ flex: 1 }} />
              <button style={S.btnGhost} onClick={addAlloc}>＋ 加一筆</button>
            </div>
            <table style={S.subTable}>
              <thead>
                <tr>
                  <th style={S.subTh}>掛帳門市</th>
                  <th style={S.subTh}>掛帳年月</th>
                  <th style={{ ...S.subTh, textAlign: 'right' }}>金額</th>
                  <th style={S.subTh}>備註</th>
                  <th style={S.subTh}></th>
                </tr>
              </thead>
              <tbody>
                {allocations.length === 0 && (
                  <tr><td colSpan={5} style={{ ...S.subTd, textAlign: 'center', color: '#a0aec0' }}>未分帳</td></tr>
                )}
                {allocations.map((a, i) => (
                  <tr key={i}>
                    <td style={S.subTd}>
                      <select style={S.smallSelect} value={a.store_erpid} onChange={e => updAlloc(i, 'store_erpid', e.target.value)}>
                        <option value="">選門市</option>
                        {Object.entries(storeMap).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                      </select>
                    </td>
                    <td style={S.subTd}>
                      <input type="month" style={S.smallInput} value={a.year_month} onChange={e => updAlloc(i, 'year_month', e.target.value)} />
                    </td>
                    <td style={{ ...S.subTd, textAlign: 'right' }}>
                      <input type="number" style={{ ...S.smallInput, textAlign: 'right' }} value={a.amount} onChange={e => updAlloc(i, 'amount', e.target.value)} />
                    </td>
                    <td style={S.subTd}>
                      <input style={S.smallInput} value={a.notes || ''} onChange={e => updAlloc(i, 'notes', e.target.value)} />
                    </td>
                    <td style={S.subTd}>
                      <button style={S.btnDanger} onClick={() => delAlloc(i)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnGhost} onClick={onClose}>取消</button>
          <button style={S.btnPrimary} disabled={saving} onClick={save}>{saving ? '儲存中...' : (isNew ? '建立' : '儲存')}</button>
        </div>
      </div>
    </div>
  );
}

const S = {
  toolbar:      { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 12 },
  label:        { fontSize: 12, color: '#4a5568', fontWeight: 600 },
  input:        { padding: '6px 10px', border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13 },
  select:       { padding: '6px 10px', border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13, background: '#fff' },
  smallInput:   { padding: '4px 8px', border: '1px solid #cbd5e0', borderRadius: 5, fontSize: 12, width: '100%' },
  smallSelect:  { padding: '4px 8px', border: '1px solid #cbd5e0', borderRadius: 5, fontSize: 12, background: '#fff', width: '100%' },
  btnPrimary:   { padding: '6px 14px', background: '#50422d', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnGhost:     { padding: '5px 10px', background: '#fff', color: '#4a5568', border: '1px solid #cbd5e0', borderRadius: 6, cursor: 'pointer', fontSize: 12, marginRight: 4 },
  btnDanger:    { padding: '5px 10px', background: '#fff', color: '#c53030', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  tableWrap:    { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflowX: 'auto' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:           { padding: '10px 12px', textAlign: 'left', fontWeight: 600, background: '#f7fafc', borderBottom: '2px solid #e2e8f0', color: '#4a5568', whiteSpace: 'nowrap' },
  td:           { padding: '10px 12px', borderBottom: '1px solid #edf2f7', verticalAlign: 'top' },
  empty:        { textAlign: 'center', padding: 40, color: '#a0aec0' },
  // Modal
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modalBox:     { background: '#fff', borderRadius: 10, width: '100%', maxWidth: 900, maxHeight: '92vh', display: 'flex', flexDirection: 'column' },
  modalHeader:  { padding: '14px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalBody:    { padding: 20, overflowY: 'auto', flex: 1 },
  modalFooter:  { padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 8 },
  close:        { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#718096' },
  formRow:      { display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  field:        { flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel:   { fontSize: 12, color: '#718096', fontWeight: 600 },
  subTable:     { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  subTh:        { padding: '6px 8px', textAlign: 'left', fontWeight: 600, background: '#f7fafc', borderBottom: '1px solid #e2e8f0', color: '#4a5568' },
  subTd:        { padding: '4px 8px', borderBottom: '1px solid #edf2f7' },
};
