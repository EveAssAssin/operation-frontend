// pages/basicData/BasicDataPage.jsx
// 「基本資料」模組
//   - 雙視角：📊 依分類檢視 / 🏬 依門市檢視
//   - 每筆資料顯示「異動人 / 異動時間」
//   - 設定按鈕：管理欄位 / 管理分類 / 推播名單 / 歷史紀錄

import { useState, useEffect, useCallback, useMemo } from 'react';
import { basicDataApi } from '../../services/api';

// ── 品牌色 ───────────────────────────────────────────────────
const C = {
  dark:   '#50422d',
  mid:    '#8b6f4e',
  light:  '#cdbea2',
  bg:     '#f5f0ea',
  bgCard: '#ffffff',
  border: '#e0d5c8',
  textDark:  '#3a2e1e',
  textMid:   '#6b5640',
  textLight: '#9a8878',
};

const fmtDateTime = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
};

const btn = (variant = 'default') => {
  const base = {
    padding: '7px 14px', border: 'none', borderRadius: 6,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    transition: 'opacity 0.15s',
  };
  if (variant === 'primary') return { ...base, background: C.dark,    color: '#fff' };
  if (variant === 'danger')  return { ...base, background: '#c53030', color: '#fff' };
  if (variant === 'ghost')   return { ...base, background: '#fff',    color: C.textDark, border: `1px solid ${C.border}` };
  return { ...base, background: C.mid, color: '#fff' };
};

const inputStyle = () => ({
  width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`,
  borderRadius: 6, fontSize: 13, background: '#fff', boxSizing: 'border-box',
});

// ════════════════════════════════════════════════════════════
//                         主頁面
// ════════════════════════════════════════════════════════════
export default function BasicDataPage() {
  // 視角：'category' = 依分類；'store' = 依門市
  const [view, setView] = useState('category');

  const [categories, setCategories] = useState([]);
  const [stores, setStores]         = useState([]);
  const [selCategoryId, setSelCategoryId] = useState(null);
  const [selStoreErpid, setSelStoreErpid] = useState(null);

  // modals
  const [showFieldsMgr,    setShowFieldsMgr]    = useState(null); // { categoryId }
  const [showCategoryMgr,  setShowCategoryMgr]  = useState(false);
  const [showSubsMgr,      setShowSubsMgr]      = useState(false);
  const [showHistoryMgr,   setShowHistoryMgr]   = useState(false);

  const reloadAll = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([basicDataApi.listCategories(), basicDataApi.getStores()]);
      const cats = Array.isArray(c?.data) ? c.data : [];
      setCategories(cats);
      setStores(Array.isArray(s?.data) ? s.data : []);
      if (cats.length && !cats.some(x => x.id === selCategoryId)) setSelCategoryId(cats[0].id);
    } catch (e) { console.error(e); }
  }, [selCategoryId]);

  useEffect(() => { reloadAll(); }, []); // eslint-disable-line

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* 標頭 */}
      <div style={{ background: C.dark, padding: '20px 28px' }}>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>📚 基本資料</div>
        <div style={{ color: C.light, fontSize: 13 }}>
          管理各門市的電費 / 電話與網路 / 房租等資料；異動會自動推播給訂閱者
        </div>
      </div>

      <div style={{ padding: '20px 28px' }}>
        {/* 上方工具列 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          flexWrap: 'wrap',
        }}>
          {/* 視角切換 */}
          <div style={{ display: 'inline-flex', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 3 }}>
            <button
              onClick={() => setView('category')}
              style={{
                padding: '6px 14px', border: 'none', borderRadius: 6,
                background: view === 'category' ? C.dark : 'transparent',
                color: view === 'category' ? '#fff' : C.textMid,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>📊 依分類</button>
            <button
              onClick={() => setView('store')}
              style={{
                padding: '6px 14px', border: 'none', borderRadius: 6,
                background: view === 'store' ? C.dark : 'transparent',
                color: view === 'store' ? '#fff' : C.textMid,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>🏬 依門市</button>
          </div>

          <div style={{ flex: 1 }} />

          <button style={btn('ghost')} onClick={() => setShowHistoryMgr(true)}>🕐 歷史紀錄</button>
          <button style={btn('ghost')} onClick={() => setShowSubsMgr(true)}>🔔 推播名單</button>
          <button style={btn('ghost')} onClick={() => setShowCategoryMgr(true)}>⚙ 分類管理</button>
        </div>

        {view === 'category' && (
          <CategoryView
            categories={categories}
            stores={stores}
            selCategoryId={selCategoryId}
            setSelCategoryId={setSelCategoryId}
            onMgrFields={(catId) => setShowFieldsMgr({ categoryId: catId })}
          />
        )}
        {view === 'store' && (
          <StoreView
            stores={stores}
            categories={categories}
            selStoreErpid={selStoreErpid}
            setSelStoreErpid={setSelStoreErpid}
            onMgrFields={(catId) => setShowFieldsMgr({ categoryId: catId })}
          />
        )}
      </div>

      {/* Modals */}
      {showFieldsMgr   && <FieldsManagerModal categoryId={showFieldsMgr.categoryId} categories={categories}
                                              onClose={() => { setShowFieldsMgr(null); reloadAll(); }} />}
      {showCategoryMgr && <CategoriesManagerModal onClose={() => { setShowCategoryMgr(false); reloadAll(); }} />}
      {showSubsMgr     && <SubscribersModal onClose={() => setShowSubsMgr(false)} />}
      {showHistoryMgr  && <HistoryModal categories={categories} stores={stores} onClose={() => setShowHistoryMgr(false)} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//                  視角 1：依分類（橫式 tab + 大表）
// ════════════════════════════════════════════════════════════
function CategoryView({ categories, stores, selCategoryId, setSelCategoryId, onMgrFields }) {
  const selCat = categories.find(c => c.id === selCategoryId);

  return (
    <>
      {/* tab 列 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat.id}
            onClick={() => setSelCategoryId(cat.id)}
            style={{
              padding: '8px 16px', borderRadius: '8px 8px 0 0',
              border: 'none', cursor: 'pointer',
              background: selCategoryId === cat.id ? C.bgCard : 'transparent',
              color: selCategoryId === cat.id ? C.dark : C.textMid,
              fontSize: 13, fontWeight: selCategoryId === cat.id ? 700 : 500,
              borderTop:  selCategoryId === cat.id ? `2px solid ${C.dark}` : '2px solid transparent',
            }}>{cat.icon || '📂'} {cat.name}</button>
        ))}
      </div>

      {selCat ? (
        <FactsTable
          category={selCat}
          stores={stores}
          onMgrFields={() => onMgrFields(selCat.id)}
        />
      ) : (
        <div style={{ padding: 30, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, textAlign: 'center', color: C.textLight }}>
          請先建立分類
        </div>
      )}
    </>
  );
}

// 一個分類的所有資料表
function FactsTable({ category, stores, onMgrFields }) {
  const [fields, setFields]   = useState([]);
  const [facts,  setFacts]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState(null);   // null | { id?, store_erpid, data, note }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, d] = await Promise.all([
        basicDataApi.listFields(category.id),
        basicDataApi.listFacts({ category_id: category.id }),
      ]);
      setFields(Array.isArray(f?.data) ? f.data : []);
      setFacts(Array.isArray(d?.data) ? d.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [category.id]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!keyword.trim()) return facts;
    const k = keyword.toLowerCase();
    return facts.filter(r => (
      (r.store_name || '').toLowerCase().includes(k) ||
      JSON.stringify(r.data || {}).toLowerCase().includes(k)
    ));
  }, [facts, keyword]);

  async function handleDelete(id) {
    if (!window.confirm('確定刪除這筆資料？')) return;
    try { await basicDataApi.deleteFact(id); load(); }
    catch (e) { alert('失敗：' + (e?.message || e)); }
  }

  return (
    <div style={{ background: C.bgCard, borderRadius: '0 8px 8px 8px', border: `1px solid ${C.border}`, padding: 16 }}>
      {/* 分類資訊條 + 工具按鈕 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark }}>
          {category.icon || '📂'} {category.name}
        </div>
        {category.extra?.query_url && (
          <a href={category.extra.query_url} target="_blank" rel="noreferrer"
             style={{ fontSize: 12, color: '#3b5bdb', textDecoration: 'underline' }}>
            🔗 查詢網址
          </a>
        )}
        <span style={{ color: C.textLight, fontSize: 12 }}>共 {facts.length} 筆</span>
        <div style={{ flex: 1 }} />
        <input value={keyword} onChange={e => setKeyword(e.target.value)}
               placeholder="🔍 搜尋..."
               style={{ width: 200, padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13 }} />
        <button style={btn('ghost')} onClick={onMgrFields}>⚙ 欄位管理</button>
        <button style={btn('primary')} onClick={() => setEditing({ store_erpid: '', data: {}, note: '' })}>+ 新增資料</button>
      </div>

      {/* 表格 */}
      <div style={{ overflow: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: C.bg, position: 'sticky', top: 0 }}>
            <tr>
              <th style={th()}>門市</th>
              {fields.map(f => <th key={f.id} style={th()}>{f.field_label}</th>)}
              <th style={th()}>備註</th>
              <th style={th()}>異動人</th>
              <th style={th()}>異動時間</th>
              <th style={th()}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={fields.length + 5} style={td('center')}>載入中...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={fields.length + 5} style={td('center')}>無資料</td></tr>}
            {!loading && filtered.map(row => (
              <tr key={row.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={td()}>
                  <b>{row.store_name || '—'}</b>
                  <div style={{ fontSize: 11, color: C.textLight }}>{row.store_erpid}</div>
                </td>
                {fields.map(f => (
                  <td key={f.id} style={td()}>
                    {renderValue(row.data?.[f.field_key], f.field_type)}
                  </td>
                ))}
                <td style={td()}>
                  {row.note ? <span style={{ whiteSpace: 'pre-wrap' }}>{row.note}</span> : <span style={{ color: C.textLight }}>—</span>}
                </td>
                <td style={td()}>
                  <span style={{ fontSize: 11 }}>{row.updated_by_app_number || '—'}</span>
                </td>
                <td style={td()}>
                  <span style={{ fontSize: 11, color: C.textMid }}>{fmtDateTime(row.updated_at)}</span>
                </td>
                <td style={td()}>
                  <button style={btn('ghost')} onClick={() => setEditing(row)}>✏️</button>
                  <button style={{ ...btn('danger'), marginLeft: 4 }} onClick={() => handleDelete(row.id)}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <FactEditorModal
          category={category}
          fields={fields}
          stores={stores}
          fact={editing}
          onClose={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function renderValue(v, type) {
  if (v === null || v === undefined || v === '') return <span style={{ color: '#bbb' }}>—</span>;
  if (type === 'multiline') return <span style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{String(v)}</span>;
  if (type === 'number')    return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Number(v).toLocaleString()}</span>;
  if (type === 'url')       return <a href={v} target="_blank" rel="noreferrer" style={{ color: '#3b5bdb', textDecoration: 'underline' }}>{v}</a>;
  if (type === 'boolean')   return v ? '✓' : '✗';
  return String(v);
}

// ════════════════════════════════════════════════════════════
//             視角 2：依門市（左門市列表 + 右多分類資料）
// ════════════════════════════════════════════════════════════
function StoreView({ stores, categories, selStoreErpid, setSelStoreErpid, onMgrFields }) {
  const [allFacts, setAllFacts] = useState([]);
  const [fieldsByCat, setFieldsByCat] = useState({});  // {catId: [fields]}

  useEffect(() => {
    if (!selStoreErpid && stores.length) setSelStoreErpid(stores[0].store_erpid);
  }, [stores, selStoreErpid, setSelStoreErpid]);

  const loadFacts = useCallback(async () => {
    if (!selStoreErpid) return;
    try {
      const res = await basicDataApi.listFacts({ store_erpid: selStoreErpid });
      setAllFacts(Array.isArray(res?.data) ? res.data : []);

      // 同步抓所有分類的欄位（一次）
      if (Object.keys(fieldsByCat).length === 0 && categories.length) {
        const entries = await Promise.all(categories.map(c =>
          basicDataApi.listFields(c.id).then(r => [c.id, Array.isArray(r?.data) ? r.data : []])
        ));
        setFieldsByCat(Object.fromEntries(entries));
      }
    } catch (e) { console.error(e); }
  }, [selStoreErpid, categories, fieldsByCat]);

  useEffect(() => { loadFacts(); }, [loadFacts]);

  const factsByCat = useMemo(() => {
    const map = {};
    allFacts.forEach(f => { (map[f.category_id] = map[f.category_id] || []).push(f); });
    return map;
  }, [allFacts]);

  const selStore = stores.find(s => s.store_erpid === selStoreErpid);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12 }}>
      {/* 左：門市清單 */}
      <div style={{ background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}`, maxHeight: '75vh', overflow: 'auto' }}>
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.textDark, position: 'sticky', top: 0, background: C.bg }}>
          門市 / 部門（{stores.length}）
        </div>
        {stores.map(s => {
          const isActive = s.store_erpid === selStoreErpid;
          const factCnt  = allFacts.length; // 對選中的這個 store 有效
          return (
            <button key={s.store_erpid}
              onClick={() => setSelStoreErpid(s.store_erpid)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', border: 'none',
                background: isActive ? '#fff8ec' : 'transparent',
                color: isActive ? C.dark : C.textDark,
                borderLeft: isActive ? `3px solid ${C.dark}` : '3px solid transparent',
                cursor: 'pointer', fontSize: 13,
                borderBottom: `1px solid ${C.border}`,
              }}>
              <div style={{ fontWeight: 600 }}>{s.store_name}</div>
              <div style={{ fontSize: 11, color: C.textLight }}>{s.store_erpid}{isActive && ` · ${factCnt} 筆`}</div>
            </button>
          );
        })}
      </div>

      {/* 右：該門市所有分類資料 */}
      <div>
        {!selStore && <div style={{ padding: 30, color: C.textLight }}>請從左側選一個門市</div>}
        {selStore && (
          <>
            <div style={{ background: C.bgCard, padding: '12px 16px', borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark }}>🏬 {selStore.store_name}</div>
              <div style={{ fontSize: 12, color: C.textLight }}>{selStore.store_erpid}</div>
            </div>
            {categories.map(cat => {
              const list   = factsByCat[cat.id] || [];
              const fields = fieldsByCat[cat.id] || [];
              return (
                <div key={cat.id} style={{ marginBottom: 12, background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.textDark }}>
                      {cat.icon || '📂'} {cat.name}
                    </div>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 999,
                      background: list.length === 0 ? '#fff0f0' : '#f0fff4',
                      color: list.length === 0 ? '#c53030' : '#2d6a4f',
                      border: `1px solid ${list.length === 0 ? '#feb2b2' : '#b7e4c7'}`,
                    }}>{list.length === 0 ? '⚠ 尚未填寫' : `${list.length} 筆`}</span>
                    <div style={{ flex: 1 }} />
                    <button style={btn('ghost')} onClick={() => onMgrFields(cat.id)}>⚙ 欄位</button>
                  </div>
                  {list.length === 0 ? (
                    <div style={{ padding: 16, color: C.textLight, fontSize: 12 }}>—</div>
                  ) : (
                    <div style={{ overflow: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            {fields.map(f => <th key={f.id} style={th()}>{f.field_label}</th>)}
                            <th style={th()}>備註</th>
                            <th style={th()}>異動人/時間</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map(row => (
                            <tr key={row.id} style={{ borderTop: `1px solid ${C.border}` }}>
                              {fields.map(f => <td key={f.id} style={td()}>{renderValue(row.data?.[f.field_key], f.field_type)}</td>)}
                              <td style={td()}>{row.note || <span style={{ color: '#bbb' }}>—</span>}</td>
                              <td style={td()}>
                                <div style={{ fontSize: 11 }}>{row.updated_by_app_number || '—'}</div>
                                <div style={{ fontSize: 10, color: C.textLight }}>{fmtDateTime(row.updated_at)}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//                   新增 / 編輯資料 modal
// ════════════════════════════════════════════════════════════
function FactEditorModal({ category, fields, stores, fact, onClose }) {
  const isNew = !fact.id;
  const [form, setForm] = useState({
    store_erpid: fact.store_erpid || '',
    data:        { ...(fact.data || {}) },
    note:        fact.note || '',
  });
  const [busy, setBusy] = useState(false);

  function setData(k, v) { setForm(f => ({ ...f, data: { ...f.data, [k]: v } })); }

  async function handleSave() {
    if (!form.store_erpid) return alert('請選擇門市');
    setBusy(true);
    try {
      if (isNew) {
        await basicDataApi.createFact({ category_id: category.id, ...form });
      } else {
        await basicDataApi.updateFact(fact.id, form);
      }
      onClose();
    } catch (e) { alert('失敗：' + (e?.message || e)); }
    finally { setBusy(false); }
  }

  return (
    <Modal onClose={onClose} title={`${isNew ? '新增' : '編輯'} — ${category.icon || ''} ${category.name}`} width={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="門市 / 部門 *">
          <select value={form.store_erpid} onChange={e => setForm(f => ({ ...f, store_erpid: e.target.value }))} style={inputStyle()}>
            <option value="">-- 請選 --</option>
            {stores.map(s => <option key={s.store_erpid} value={s.store_erpid}>{s.store_name} ({s.store_erpid})</option>)}
          </select>
        </Field>

        {fields.map(f => (
          <Field key={f.id} label={f.field_label + (f.is_required ? ' *' : '')}>
            {f.field_type === 'multiline'
              ? <textarea rows={3} value={form.data[f.field_key] || ''} onChange={e => setData(f.field_key, e.target.value)}
                          placeholder={f.placeholder || ''} style={{ ...inputStyle(), resize: 'vertical' }} />
              : f.field_type === 'number'
                ? <input type="number" value={form.data[f.field_key] ?? ''} onChange={e => setData(f.field_key, e.target.value === '' ? null : Number(e.target.value))}
                         placeholder={f.placeholder || ''} style={inputStyle()} />
                : f.field_type === 'date'
                  ? <input type="date" value={form.data[f.field_key] || ''} onChange={e => setData(f.field_key, e.target.value)} style={inputStyle()} />
                  : f.field_type === 'boolean'
                    ? <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" checked={!!form.data[f.field_key]} onChange={e => setData(f.field_key, e.target.checked)} />
                        <span>{f.placeholder || '是'}</span>
                      </label>
                    : <input value={form.data[f.field_key] || ''} onChange={e => setData(f.field_key, e.target.value)}
                             placeholder={f.placeholder || ''} style={inputStyle()} />}
          </Field>
        ))}

        <Field label="額外備註">
          <textarea rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    style={{ ...inputStyle(), resize: 'vertical' }} placeholder="任何補充說明" />
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button style={btn('ghost')} onClick={onClose}>取消</button>
          <button style={btn('primary')} disabled={busy} onClick={handleSave}>{busy ? '處理中...' : '儲存'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
//                   欄位管理 modal
// ════════════════════════════════════════════════════════════
function FieldsManagerModal({ categoryId, categories, onClose }) {
  const cat = categories.find(c => c.id === categoryId);
  const [fields, setFields] = useState([]);
  const [busy, setBusy] = useState(false);
  const [newField, setNewField] = useState({ field_key: '', field_label: '', field_type: 'text', sort_order: 100, placeholder: '' });

  const load = useCallback(async () => {
    try {
      const r = await basicDataApi.listFields(categoryId);
      setFields(Array.isArray(r?.data) ? r.data : []);
    } catch (e) { console.error(e); }
  }, [categoryId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!newField.field_key.trim() || !newField.field_label.trim()) return alert('field_key 與 field_label 必填');
    setBusy(true);
    try {
      await basicDataApi.createField(categoryId, newField);
      setNewField({ field_key: '', field_label: '', field_type: 'text', sort_order: 100, placeholder: '' });
      load();
    } catch (e) { alert('失敗：' + (e?.message || e)); }
    finally { setBusy(false); }
  }

  async function handleEdit(f) {
    const label = window.prompt('新名稱', f.field_label);
    if (!label || label === f.field_label) return;
    try { await basicDataApi.updateField(f.id, { field_label: label }); load(); }
    catch (e) { alert('失敗：' + (e?.message || e)); }
  }

  async function handleDelete(f) {
    if (f.is_system) return alert('系統預設欄位不能刪除');
    if (!window.confirm(`確定刪除欄位「${f.field_label}」？已填的資料不會消失但會變成「孤兒」`)) return;
    try { await basicDataApi.deleteField(f.id); load(); }
    catch (e) { alert('失敗：' + (e?.message || e)); }
  }

  return (
    <Modal onClose={onClose} title={`${cat?.icon || ''} ${cat?.name || ''} — 欄位管理`} width={680}>
      <div style={{ marginBottom: 12, padding: 12, background: C.bg, borderRadius: 6, fontSize: 12, color: C.textMid }}>
        💡 系統預設欄位（鎖頭標記）不能刪，但可以改名稱與順序
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
        <thead style={{ background: C.bg }}>
          <tr>
            <th style={th()}>顯示名稱</th>
            <th style={th()}>程式 key</th>
            <th style={th()}>類型</th>
            <th style={th()}>排序</th>
            <th style={th()}>操作</th>
          </tr>
        </thead>
        <tbody>
          {fields.map(f => (
            <tr key={f.id} style={{ borderTop: `1px solid ${C.border}` }}>
              <td style={td()}>{f.is_system && <span title="系統預設">🔒 </span>}<b>{f.field_label}</b></td>
              <td style={td()}><code style={{ fontSize: 11, color: C.textMid }}>{f.field_key}</code></td>
              <td style={td()}>{f.field_type}</td>
              <td style={td()}>{f.sort_order}</td>
              <td style={td()}>
                <button style={btn('ghost')} onClick={() => handleEdit(f)}>改名</button>
                {!f.is_system && <button style={{ ...btn('danger'), marginLeft: 4 }} onClick={() => handleDelete(f)}>刪除</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: `2px dashed ${C.border}`, paddingTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>➕ 新增欄位</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 80px', gap: 8, marginBottom: 8 }}>
          <input value={newField.field_label} onChange={e => setNewField(f => ({ ...f, field_label: e.target.value }))}
                 placeholder="顯示名稱（如：電費）" style={inputStyle()} />
          <input value={newField.field_key} onChange={e => setNewField(f => ({ ...f, field_key: e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase() }))}
                 placeholder="程式 key（如：electricity_fee）" style={inputStyle()} />
          <select value={newField.field_type} onChange={e => setNewField(f => ({ ...f, field_type: e.target.value }))} style={inputStyle()}>
            <option value="text">文字</option>
            <option value="number">數字</option>
            <option value="date">日期</option>
            <option value="url">網址</option>
            <option value="multiline">多行文字</option>
            <option value="boolean">是/否</option>
          </select>
          <input type="number" value={newField.sort_order} onChange={e => setNewField(f => ({ ...f, sort_order: Number(e.target.value) }))}
                 style={inputStyle()} />
        </div>
        <input value={newField.placeholder} onChange={e => setNewField(f => ({ ...f, placeholder: e.target.value }))}
               placeholder="placeholder（提示文字，選填）" style={{ ...inputStyle(), marginBottom: 8 }} />
        <button style={btn('primary')} disabled={busy} onClick={handleAdd}>{busy ? '...' : '+ 新增'}</button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
//                   分類管理 modal
// ════════════════════════════════════════════════════════════
function CategoriesManagerModal({ onClose }) {
  const [cats, setCats] = useState([]);
  const [busy, setBusy] = useState(false);
  const [newCat, setNewCat] = useState({ code: '', name: '', icon: '📂', sort_order: 100 });

  const load = useCallback(async () => {
    try { const r = await basicDataApi.listCategories(); setCats(Array.isArray(r?.data) ? r.data : []); }
    catch (e) { console.error(e); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!newCat.code.trim() || !newCat.name.trim()) return alert('代碼 + 名稱必填');
    setBusy(true);
    try {
      await basicDataApi.createCategory(newCat);
      setNewCat({ code: '', name: '', icon: '📂', sort_order: 100 });
      load();
    } catch (e) { alert('失敗：' + (e?.message || e)); }
    finally { setBusy(false); }
  }

  async function handleRename(c) {
    const name = window.prompt('新名稱', c.name);
    if (!name || name === c.name) return;
    try { await basicDataApi.updateCategory(c.id, { name }); load(); }
    catch (e) { alert('失敗：' + (e?.message || e)); }
  }

  async function handleDelete(c) {
    if (c.is_system) return alert('系統預設分類不能刪除');
    if (!window.confirm(`確定刪除分類「${c.name}」？所有相關資料都會一起被刪除！`)) return;
    try { await basicDataApi.deleteCategory(c.id); load(); }
    catch (e) { alert('失敗：' + (e?.message || e)); }
  }

  return (
    <Modal onClose={onClose} title="📂 分類管理" width={620}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
        <thead style={{ background: C.bg }}>
          <tr>
            <th style={th()}>名稱</th>
            <th style={th()}>代碼</th>
            <th style={th()}>排序</th>
            <th style={th()}>操作</th>
          </tr>
        </thead>
        <tbody>
          {cats.map(c => (
            <tr key={c.id} style={{ borderTop: `1px solid ${C.border}` }}>
              <td style={td()}>{c.is_system && '🔒 '}{c.icon} <b>{c.name}</b></td>
              <td style={td()}><code style={{ fontSize: 11, color: C.textMid }}>{c.code}</code></td>
              <td style={td()}>{c.sort_order}</td>
              <td style={td()}>
                <button style={btn('ghost')} onClick={() => handleRename(c)}>改名</button>
                {!c.is_system && <button style={{ ...btn('danger'), marginLeft: 4 }} onClick={() => handleDelete(c)}>刪除</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: `2px dashed ${C.border}`, paddingTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>➕ 新增分類</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px 90px 90px', gap: 8 }}>
          <input value={newCat.name} onChange={e => setNewCat(c => ({ ...c, name: e.target.value }))} placeholder="名稱（水費）" style={inputStyle()} />
          <input value={newCat.code} onChange={e => setNewCat(c => ({ ...c, code: e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase() }))} placeholder="代碼（water）" style={inputStyle()} />
          <input value={newCat.icon} onChange={e => setNewCat(c => ({ ...c, icon: e.target.value }))} placeholder="📂" style={inputStyle()} />
          <input type="number" value={newCat.sort_order} onChange={e => setNewCat(c => ({ ...c, sort_order: Number(e.target.value) }))} style={inputStyle()} />
          <button style={btn('primary')} disabled={busy} onClick={handleAdd}>+ 新增</button>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
//                  推播訂閱 modal
// ════════════════════════════════════════════════════════════
const EVENT_OPTIONS = [
  { key: 'fact_create',  label: '新增資料' },
  { key: 'fact_update',  label: '修改資料' },
  { key: 'fact_delete',  label: '刪除資料' },
  { key: 'meta_change',  label: '分類/欄位變動' },
];

function SubscribersModal({ onClose }) {
  const [subs, setSubs]   = useState([]);
  const [users, setUsers] = useState([]);
  const [adding, setAdding] = useState({ app_number: '', events: ['fact_create','fact_update','fact_delete','meta_change'] });

  const load = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([basicDataApi.listSubscribers(), basicDataApi.getSystemUsers()]);
      setSubs(Array.isArray(s?.data) ? s.data : []);
      setUsers(Array.isArray(u?.data) ? u.data : []);
    } catch (e) { console.error(e); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggleEnabled(sub) {
    try { await basicDataApi.upsertSubscriber({ ...sub, enabled: !sub.enabled }); load(); }
    catch (e) { alert('失敗：' + (e?.message || e)); }
  }

  async function toggleEvent(sub, key) {
    const has = (sub.events || []).includes(key);
    const next = has ? sub.events.filter(x => x !== key) : [...(sub.events || []), key];
    try { await basicDataApi.upsertSubscriber({ ...sub, events: next }); load(); }
    catch (e) { alert('失敗：' + (e?.message || e)); }
  }

  async function handleDelete(id) {
    if (!window.confirm('確定移除？')) return;
    try { await basicDataApi.deleteSubscriber(id); load(); }
    catch (e) { alert('失敗：' + (e?.message || e)); }
  }

  async function handleAdd() {
    if (!adding.app_number) return alert('請選擇人員');
    const u = users.find(x => x.app_number === adding.app_number);
    try {
      await basicDataApi.upsertSubscriber({ app_number: adding.app_number, name: u?.name || '', enabled: true, events: adding.events });
      setAdding({ app_number: '', events: ['fact_create','fact_update','fact_delete','meta_change'] });
      load();
    } catch (e) { alert('失敗：' + (e?.message || e)); }
  }

  // 還沒訂閱的人
  const availableUsers = users.filter(u => !subs.some(s => s.app_number === u.app_number));

  return (
    <Modal onClose={onClose} title="🔔 推播名單設定" width={700}>
      <div style={{ marginBottom: 12, padding: 12, background: C.bg, borderRadius: 6, fontSize: 12, color: C.textMid }}>
        💡 列在這裡的人會收到 LINE 推播通知。可以個別關閉某種事件。
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
        <thead style={{ background: C.bg }}>
          <tr>
            <th style={th()}>人員</th>
            <th style={th()}>app_number</th>
            <th style={th()}>啟用</th>
            <th style={th()}>訂閱事件</th>
            <th style={th()}>操作</th>
          </tr>
        </thead>
        <tbody>
          {subs.length === 0 && <tr><td colSpan={5} style={td('center')}>尚無訂閱者，下方新增</td></tr>}
          {subs.map(s => (
            <tr key={s.id} style={{ borderTop: `1px solid ${C.border}` }}>
              <td style={td()}><b>{s.name || '—'}</b></td>
              <td style={td()}><code style={{ fontSize: 11 }}>{s.app_number}</code></td>
              <td style={td()}>
                <input type="checkbox" checked={!!s.enabled} onChange={() => toggleEnabled(s)} />
              </td>
              <td style={td()}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {EVENT_OPTIONS.map(opt => {
                    const on = (s.events || []).includes(opt.key);
                    return (
                      <button key={opt.key} onClick={() => toggleEvent(s, opt.key)}
                        style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                          background: on ? '#f0fff4' : '#f3f3f3',
                          color: on ? '#2d6a4f' : '#888',
                          border: `1px solid ${on ? '#b7e4c7' : '#ccc'}`,
                        }}>{on ? '✓' : '○'} {opt.label}</button>
                    );
                  })}
                </div>
              </td>
              <td style={td()}><button style={btn('danger')} onClick={() => handleDelete(s.id)}>移除</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: `2px dashed ${C.border}`, paddingTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>➕ 新增訂閱者</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={adding.app_number} onChange={e => setAdding(a => ({ ...a, app_number: e.target.value }))} style={{ ...inputStyle(), flex: 1 }}>
            <option value="">-- 選擇人員 --</option>
            {availableUsers.map(u => <option key={u.app_number} value={u.app_number}>{u.name}（{u.app_number}）— {u.role}</option>)}
          </select>
          <button style={btn('primary')} onClick={handleAdd}>+ 新增</button>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
//                  歷史紀錄 modal
// ════════════════════════════════════════════════════════════
function HistoryModal({ categories, stores, onClose }) {
  const [filter, setFilter] = useState({ category_id: '', store_erpid: '' });
  const [list, setList]     = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.category_id) params.category_id = filter.category_id;
      if (filter.store_erpid) params.store_erpid = filter.store_erpid;
      const r = await basicDataApi.listHistory(params);
      setList(Array.isArray(r?.data) ? r.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const actionLabel = (a) => ({ create: '➕ 新增', update: '✏️ 修改', delete: '🗑 刪除' }[a] || a);

  return (
    <Modal onClose={onClose} title="🕐 歷史紀錄" width={820}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select value={filter.category_id} onChange={e => setFilter(f => ({ ...f, category_id: e.target.value }))} style={inputStyle()}>
          <option value="">全部分類</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <select value={filter.store_erpid} onChange={e => setFilter(f => ({ ...f, store_erpid: e.target.value }))} style={inputStyle()}>
          <option value="">全部門市</option>
          {stores.map(s => <option key={s.store_erpid} value={s.store_erpid}>{s.store_name}</option>)}
        </select>
      </div>

      <div style={{ maxHeight: 500, overflow: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: C.bg, position: 'sticky', top: 0 }}>
            <tr>
              <th style={th()}>時間</th>
              <th style={th()}>動作</th>
              <th style={th()}>目標</th>
              <th style={th()}>操作者</th>
              <th style={th()}>變動內容</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={td('center')}>載入中...</td></tr>}
            {!loading && list.length === 0 && <tr><td colSpan={5} style={td('center')}>無紀錄</td></tr>}
            {!loading && list.map(h => (
              <tr key={h.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={td()}>{fmtDateTime(h.created_at)}</td>
                <td style={td()}>{actionLabel(h.action)}</td>
                <td style={td()}>
                  <div>{h.category_name || h.entity_type}</div>
                  {h.store_name && <div style={{ fontSize: 11, color: C.textLight }}>{h.store_name}</div>}
                </td>
                <td style={td()}>{h.actor_name || '—'}<br /><span style={{ fontSize: 10, color: C.textLight }}>{h.actor_app_number || ''}</span></td>
                <td style={td()}>
                  {h.changes && Object.keys(h.changes).length > 0 ? (
                    <div style={{ fontSize: 11 }}>
                      {Object.entries(h.changes).slice(0, 5).map(([k, [o, n]]) => (
                        <div key={k}><b>{k}:</b> <span style={{ color: '#c53030' }}>{String(o ?? '—')}</span> → <span style={{ color: '#2d6a4f' }}>{String(n ?? '—')}</span></div>
                      ))}
                    </div>
                  ) : h.full_data ? (
                    <code style={{ fontSize: 10, color: C.textMid }}>{JSON.stringify(h.full_data).slice(0, 100)}…</code>
                  ) : <span style={{ color: C.textLight }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
//                       共用元件
// ════════════════════════════════════════════════════════════
function th() { return { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.textDark, borderBottom: `1px solid ${C.border}` }; }
function td(align = 'left') { return { padding: '10px 12px', textAlign: align, fontSize: 13, color: C.textDark, verticalAlign: 'top' }; }

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

function Modal({ onClose, title, children, width = 800 }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 10, width: '100%', maxWidth: width, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark }}>{title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: C.textMid }}>×</button>
        </div>
        <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}
