// pages/contracts/ContractsPage.jsx
// 「合約管理」三分頁：房租 / 廠商 / 員工
//   - 列表 + 新增 + 編輯（含 type_data JSONB 動態欄位）

import { useEffect, useState, useMemo } from 'react';
import { contractsApi, filesApi, docLibraryApi } from '../../services/api';

const C = {
  dark:    '#50422d', gold: '#8b6f4e', sand: '#cdbea2',
  bg:      '#faf8f5', bgCard:'#ffffff', border:'#e8e3dc',
  textDark:'#3a2e1e', textMid: '#6b5640', textLight: '#9a8878',
};

const TYPES = [
  { value: 'rent',     label: '🏠 房租合約',   accent: '#8b6f4e' },
  { value: 'vendor',   label: '🤝 廠商合約',   accent: '#1f8b4c' },
  { value: 'employee', label: '👥 員工合約',   accent: '#3b5bdb' },
  { value: 'library',  label: '📁 文件庫',     accent: '#9d4edd' },
];

const STATUS_LABEL = {
  active:     { label: '進行中', color: '#2e7d32', bg: '#d8f3dc' },
  expired:    { label: '已過期', color: '#c53030', bg: '#fde8e8' },
  terminated: { label: '已終止', color: '#777',    bg: '#eee'    },
  pending:    { label: '未生效', color: '#d97706', bg: '#fff3cd' },
  archived:   { label: '已封存', color: '#aaa',    bg: '#f5f5f5' },
};

const S = {
  page:     { background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header:   { background: C.dark, padding: '20px 28px' },
  title:    { color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 },
  sub:      { color: C.sand, fontSize: 13 },

  body:     { padding: '20px 28px' },
  tabBar:   { display: 'flex', gap: 6, borderBottom: `2px solid ${C.border}`, marginBottom: 16 },
  tabBtn:   { padding: '10px 18px', border: 'none', background: 'transparent', borderBottom: '2px solid transparent', marginBottom: -2, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.textLight },

  toolbar:  { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  btnPrimary: { padding: '8px 16px', background: C.dark, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnGhost:   { padding: '6px 12px', background: '#fff', color: C.dark, border: `1px solid ${C.sand}`, borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  btnDanger:  { padding: '6px 10px', background: 'transparent', color: '#c53030', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: 12 },

  tableWrap:{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'auto' },
  table:    { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:       { padding: '10px 12px', background: '#faf8f5', color: C.textMid, fontWeight: 600, textAlign: 'left', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' },
  td:       { padding: '10px 12px', color: C.textDark, verticalAlign: 'top', borderBottom: `1px solid #f5f5f5` },
  empty:    { padding: 40, textAlign: 'center', color: C.textLight, fontSize: 13 },

  modalBg:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal:    { background: '#fff', borderRadius: 12, width: '92vw', maxWidth: 720, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' },
  modalH:   { padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalT:   { fontSize: 16, fontWeight: 700, color: C.dark, margin: 0 },
  modalX:   { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' },
  formGroup:{ padding: '12px 18px 0' },
  row2:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  row3:     { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
  label:    { fontSize: 12, color: '#666', fontWeight: 600, marginBottom: 4, display: 'block' },
  input:    { padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.textDark, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
  textarea: { padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.textDark, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', minHeight: 60, resize: 'vertical' },
  hint:     { fontSize: 11, color: '#aaa', marginTop: 3 },
  modalAct: { padding: '14px 18px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: `1px solid ${C.border}`, marginTop: 14 },
  errBanner:{ background: '#fce4ec', color: '#c62828', padding: '8px 12px', borderRadius: 6, margin: '10px 18px 0', fontSize: 12 },
};

const fmtDate = s => s ? s.slice(0, 10) : '—';
const fmtAmount = n => n != null ? Number(n).toLocaleString('zh-TW') : '—';
function daysUntil(date) {
  if (!date) return null;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
  return Math.ceil((new Date(date) - new Date(today)) / 86400000);
}

/**
 * 從房租 schedule 算出「今天屬於哪一段」+「下一段」
 * schedule = [{ from_date: 'YYYY-MM-DD', monthly_amount: number }, ...]
 * 自動依 from_date 排序
 */
function currentRentFromSchedule(schedule) {
  if (!Array.isArray(schedule) || schedule.length === 0) return { current: null, next: null };
  const sorted = [...schedule]
    .filter(s => s && s.from_date)
    .sort((a, b) => a.from_date.localeCompare(b.from_date));
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
  let current = null, next = null;
  for (const s of sorted) {
    if (s.from_date <= today) current = s;
    else { next = s; break; }
  }
  return { current, next };
}


export default function ContractsPage() {
  const [type, setType] = useState('rent');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);  // null | row | {} (new)
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const r = await contractsApi.list(type, 'active');
      setItems(r.data || []);
    } catch (e) { setErr(e?.message || '載入失敗'); }
    finally     { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [type]);

  async function removeOne(id) {
    if (!window.confirm('封存此份合約？（會從列表移除但資料保留）')) return;
    try {
      await contractsApi.remove(id);
      await load();
    } catch (e) { alert(e?.message || '封存失敗'); }
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.title}>📜 合約管理</div>
        <div style={S.sub}>房租 / 廠商 / 員工 三類合約集中管理</div>
      </div>

      <div style={S.body}>
        {/* 類型 tab */}
        <div style={S.tabBar}>
          {TYPES.map(t => {
            const active = t.value === type;
            return (
              <button key={t.value}
                onClick={() => setType(t.value)}
                style={{
                  ...S.tabBtn,
                  color: active ? t.accent : C.textLight,
                  borderBottom: active ? `2px solid ${t.accent}` : '2px solid transparent',
                }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {type === 'library' ? (
          <DocumentLibraryPanel />
        ) : (
        <>
        {/* 工具列 */}
        <div style={S.toolbar}>
          <div style={{ flex: 1, fontSize: 13, color: C.textLight }}>共 {items.length} 份</div>
          <button style={S.btnGhost}   onClick={load}>🔄 重新載入</button>
          <button style={S.btnPrimary} onClick={() => setEditing({ type })}>＋ 新增合約</button>
        </div>

        {err && <div style={{ ...S.errBanner, margin: 0, marginBottom: 12 }}>❗ {err}</div>}

        {loading ? (
          <div style={S.empty}>載入中...</div>
        ) : items.length === 0 ? (
          <div style={S.empty}>還沒有任何 {TYPES.find(t => t.value === type)?.label}，點上方「＋ 新增合約」開始</div>
        ) : (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>狀態</th>
                  <th style={S.th}>名稱</th>
                  <th style={S.th}>{type === 'rent' ? '門市' : type === 'vendor' ? '廠商' : '員工'}</th>
                  <th style={S.th}>合約期間</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>{type === 'rent' ? '月租' : '總額'}</th>
                  <th style={S.th}>專屬重點</th>
                  <th style={{ ...S.th, textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map(c => {
                  const days = daysUntil(c.end_date);
                  const expiring = days !== null && days >= 0 && days <= 60;
                  const overdue  = days !== null && days < 0;
                  const stat = STATUS_LABEL[c.status] || STATUS_LABEL.active;
                  return (
                    <tr key={c.id} style={{ background: overdue ? '#fde8e8' : expiring ? '#fff7e6' : undefined }}>
                      <td style={S.td}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: stat.bg, color: stat.color, fontWeight: 600 }}>
                          {stat.label}
                        </span>
                      </td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        {c.note && <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{c.note.slice(0, 60)}</div>}
                      </td>
                      <td style={S.td}>
                        <div>{c.our_side_name || '—'}</div>
                        {c.party_name && <div style={{ fontSize: 11, color: C.textLight }}>對方：{c.party_name}</div>}
                      </td>
                      <td style={S.td}>
                        <div>{fmtDate(c.start_date)} ~ {fmtDate(c.end_date)}</div>
                        {days !== null && (
                          <div style={{ fontSize: 11, color: overdue ? '#c53030' : expiring ? '#d97706' : C.textLight, marginTop: 2 }}>
                            {overdue ? `已過期 ${-days} 天` : `剩 ${days} 天`}
                          </div>
                        )}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {type === 'rent'
                          ? (() => {
                              const { current } = currentRentFromSchedule(c.type_data?.rent_schedule);
                              const amt = current?.monthly_amount ?? c.monthly_amount;
                              return amt != null ? `$ ${fmtAmount(amt)}` : '—';
                            })()
                          : (c.total_amount != null ? `$ ${fmtAmount(c.total_amount)}` : '—')
                        }
                      </td>
                      <td style={S.td}>
                        <TypeDataSummary type={c.type} data={c.type_data || {}} />
                      </td>
                      <td style={{ ...S.td, textAlign: 'center' }}>
                        <button style={S.btnGhost}  onClick={() => setEditing(c)}>✏ 編輯</button>
                        <button style={S.btnDanger} onClick={() => removeOne(c.id)} title="封存">🗑</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </>
        )}
      </div>

      {editing && (
        <ContractEditModal
          contract={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}


// ════════════════════════════════════════════════════════════
// 類型專屬重點顯示
// ════════════════════════════════════════════════════════════
function TypeDataSummary({ type, data }) {
  if (!data) return '—';
  if (type === 'rent') {
    const bits = [];
    const { current, next } = currentRentFromSchedule(data.rent_schedule);
    if (current) bits.push(`目前 $${fmtAmount(current.monthly_amount)}`);
    if (next)    bits.push(`${fmtDate(next.from_date)} 起 $${fmtAmount(next.monthly_amount)}`);
    if (data.deposit)          bits.push(`押金 $${fmtAmount(data.deposit)}`);
    if (data.landlord_account) bits.push(`帳號 …${String(data.landlord_account).slice(-6)}`);
    return <span style={{ fontSize: 12 }}>{bits.join(' · ') || '—'}</span>;
  }
  if (type === 'vendor') {
    const bits = [];
    const benefits = Array.isArray(data.benefits) ? data.benefits : [];
    if (benefits.length > 0) {
      const byType = {};
      benefits.forEach(b => { byType[b.type] = (byType[b.type] || 0) + 1; });
      bits.push(Object.entries(byType).map(([t, n]) => `${t}×${n}`).join(' '));
    }
    if (data.payment_terms)       bits.push(data.payment_terms);
    if (data.cost_target)         bits.push(`成本目標 $${fmtAmount(data.cost_target)}`);
    return <span style={{ fontSize: 12 }}>{bits.join(' · ') || '—'}</span>;
  }
  if (type === 'employee') {
    const bits = [];
    if (data.position)      bits.push(data.position);
    if (data.salary_base)   bits.push(`月薪 $${fmtAmount(data.salary_base)}`);
    if (data.probation_end) bits.push(`試用至 ${fmtDate(data.probation_end)}`);
    return <span style={{ fontSize: 12 }}>{bits.join(' · ') || '—'}</span>;
  }
  return '—';
}


// ════════════════════════════════════════════════════════════
// 文件庫 panel
// ════════════════════════════════════════════════════════════
function DocumentLibraryPanel() {
  const [subType, setSubType] = useState('vendor');   // vendor / rent / employee
  const [categories, setCategories] = useState([]);
  const [selCat,     setSelCat]     = useState(null);
  const [docs,       setDocs]       = useState([]);
  const [loadingCat, setLoadingCat] = useState(true);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [err,        setErr]        = useState('');
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [uploading,  setUploading]  = useState(false);

  const SUB_TABS = [
    { value: 'vendor',   label: '🤝 廠商文件庫',  placeholder: '帝康 / 萬豐 / ...', autoStore: false },
    { value: 'rent',     label: '🏬 門市文件庫',  placeholder: '北屯店 / 大墩店 / ...', autoStore: true },
    { value: 'employee', label: '👥 員工文件庫',  placeholder: '王小明 / 林小花 / ...', autoStore: false },
  ];
  const subCfg = SUB_TABS.find(s => s.value === subType);

  async function loadCategories() {
    setLoadingCat(true); setErr('');
    try {
      const r = await docLibraryApi.listCategories(subType);
      const cats = r?.data || [];
      setCategories(cats);
      if (cats.length > 0 && !cats.find(c => c.category === selCat)) {
        setSelCat(cats[0].category);
      }
    } catch (e) { setErr(e?.message || '載入分類失敗'); }
    finally { setLoadingCat(false); }
  }

  async function loadDocs() {
    if (!selCat) { setDocs([]); return; }
    setLoadingDoc(true);
    try {
      const r = await docLibraryApi.listDocs(subType, selCat);
      setDocs(r?.data || []);
    } catch (e) { setErr(e?.message || '載入文件失敗'); }
    finally { setLoadingDoc(false); }
  }

  useEffect(() => { setSelCat(null); loadCategories(); /* eslint-disable-next-line */ }, [subType]);
  useEffect(() => { loadDocs(); /* eslint-disable-next-line */ }, [subType, selCat]);

  function addCategory() {
    const name = (newCatName || '').trim();
    if (!name) return;
    // 直接設成選中（檔案上傳時會自動建立）
    setCategories(prev => prev.find(c => c.category === name) ? prev : [...prev, { category: name, count: 0 }]);
    setSelCat(name);
    setNewCatName('');
    setShowAddCat(false);
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (!selCat) { alert('請先選或新增一個分類'); e.target.value = ''; return; }
    setUploading(true); setErr('');
    let okCount = 0, failNames = [];
    for (const file of files) {
      try {
        await docLibraryApi.upload(subType, file, {
          category: selCat,
          auto_create_store: subCfg.autoStore ? 'true' : 'false',
        });
        okCount++;
      } catch (e2) {
        failNames.push(`${file.name}: ${e2?.response?.data?.message || e2?.message || '失敗'}`);
      }
    }
    await loadCategories();
    await loadDocs();
    setUploading(false);
    e.target.value = '';
    if (failNames.length > 0) {
      setErr(`成功 ${okCount} / 失敗 ${failNames.length}：\n` + failNames.join('\n'));
    }
  }

  async function deleteDoc(id) {
    if (!window.confirm('刪除這個文件？')) return;
    try { await docLibraryApi.remove(id); await loadCategories(); await loadDocs(); }
    catch (e) { alert(e?.message || '刪除失敗'); }
  }

  async function editTags(d) {
    const cur = (d.tags || []).join(',');
    const tg = window.prompt('輸入 tag（用逗號分隔，例：寄賣,2024,主合約）：', cur);
    if (tg === null) return;
    try {
      await docLibraryApi.update(d.id, { tags: tg });
      await loadDocs();
    } catch (e) { alert(e?.message || '更新失敗'); }
  }

  async function editName(d) {
    const cur = d.original_name || '';
    const newName = window.prompt('改檔名（含副檔名，例：寄賣合約_2024.pdf）：', cur);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed) return alert('檔名不能空白');
    try {
      await docLibraryApi.update(d.id, { original_name: trimmed });
      await loadDocs();
    } catch (e) { alert(e?.message || '更新失敗'); }
  }

  function fmtSize(n) {
    if (!n) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  return (
    <div>
      {/* sub-tab */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: `1px solid ${C.border}` }}>
        {SUB_TABS.map(s => (
          <button key={s.value} onClick={() => setSubType(s.value)}
                  style={{
                    padding: '8px 14px', border: 'none', background: 'transparent',
                    fontSize: 13, fontWeight: 600,
                    color: subType === s.value ? '#9d4edd' : C.textLight,
                    borderBottom: subType === s.value ? `2px solid #9d4edd` : '2px solid transparent',
                    cursor: 'pointer', marginBottom: -1,
                  }}>
            {s.label}
          </button>
        ))}
      </div>

      {err && <div style={{ ...S.errBanner, margin: 0, marginBottom: 12 }}>❗ {err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12 }}>
        {/* 左：分類清單 */}
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 0', maxHeight: '70vh', overflow: 'auto' }}>
          <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, color: C.textLight, borderBottom: `1px solid ${C.border}` }}>
            分類（{categories.length}）
          </div>
          {loadingCat ? <div style={{ padding: 12, color: C.textLight, fontSize: 12 }}>載入中...</div> :
            categories.map(c => {
              const active = c.category === selCat;
              return (
                <button key={c.category} onClick={() => setSelCat(c.category)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '8px 12px', border: 'none',
                          background: active ? '#f3e8ff' : 'transparent',
                          color: active ? '#6b21a8' : C.textDark,
                          borderLeft: active ? `3px solid #9d4edd` : '3px solid transparent',
                          cursor: 'pointer', fontSize: 13,
                          borderBottom: `1px solid #f5f5f5`,
                        }}>
                  <div style={{ fontWeight: 600 }}>{c.category}</div>
                  <div style={{ fontSize: 11, color: C.textLight }}>{c.count} 份文件</div>
                </button>
              );
            })}
          {showAddCat ? (
            <div style={{ padding: 10 }}>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                     placeholder={subCfg.placeholder}
                     onKeyDown={e => e.key === 'Enter' && addCategory()}
                     style={{ width: '100%', padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12, marginBottom: 6, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={addCategory} style={{ ...S.btnPrimary, padding: '5px 10px', fontSize: 11, flex: 1 }}>確認</button>
                <button onClick={() => { setShowAddCat(false); setNewCatName(''); }}
                        style={{ ...S.btnGhost, padding: '5px 10px', fontSize: 11 }}>取消</button>
              </div>
              {subCfg.autoStore && (
                <div style={{ fontSize: 10, color: C.textLight, marginTop: 4 }}>
                  💡 若為新門市，會自動加到「基本資料」departments
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setShowAddCat(true)}
                    style={{ display: 'block', width: '100%', padding: '10px', border: 'none',
                             background: 'transparent', color: '#9d4edd', cursor: 'pointer',
                             fontSize: 12, fontWeight: 600 }}>
              ＋ 新增{subType === 'vendor' ? '廠商' : subType === 'rent' ? '門市' : '員工'}
            </button>
          )}
        </div>

        {/* 右：文件列表 */}
        <div>
          {selCat ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>{selCat}</div>
                <span style={{ fontSize: 11, color: C.textLight }}>{docs.length} 份文件</span>
                <div style={{ flex: 1 }} />
                <label style={{
                  padding: '6px 12px', background: '#9d4edd', color: '#fff', borderRadius: 6,
                  cursor: uploading ? 'wait' : 'pointer', fontSize: 12, fontWeight: 600,
                  opacity: uploading ? 0.6 : 1,
                }}>
                  {uploading ? '⏳ 上傳中...' : '📤 上傳文件（可多選）'}
                  <input type="file" multiple disabled={uploading} onChange={handleUpload} style={{ display: 'none' }} />
                </label>
              </div>

              {loadingDoc ? <div style={S.empty}>載入中...</div>
               : docs.length === 0 ? <div style={S.empty}>還沒上傳任何文件</div>
               : (
                <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  {docs.map((d, i) => (
                    <div key={d.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 14px', fontSize: 13,
                      borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                    }}>
                      <span style={{ fontSize: 22 }}>
                        {d.mime_type?.includes('pdf') ? '📄' :
                         d.mime_type?.startsWith('image') ? '🖼' :
                         d.mime_type?.includes('sheet') || d.mime_type?.includes('excel') ? '📊' : '📎'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: C.textDark, marginBottom: 2 }}>
                          {d.original_name || '(未命名)'}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                          {(d.tags || []).map(t => (
                            <span key={t} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10,
                                                   background: '#f3e8ff', color: '#6b21a8', fontWeight: 600 }}>
                              {t}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: C.textLight }}>
                          {fmtSize(d.size_bytes)} · {new Date(d.uploaded_at).toLocaleString('zh-TW', { hour12: false })} · {d.uploaded_by || '—'}
                        </div>
                      </div>
                      <button onClick={() => editName(d)} title="改檔名"
                              style={{ ...S.btnGhost, padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap' }}>✏ 改名</button>
                      <button onClick={() => editTags(d)} title="編輯 tag"
                              style={{ ...S.btnGhost, padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap' }}>🏷 標籤</button>
                      <a href={d.public_url} target="_blank" rel="noreferrer"
                         style={{ ...S.btnGhost, padding: '4px 10px', textDecoration: 'none', fontSize: 11 }}>↓ 下載</a>
                      <button style={S.btnDanger} onClick={() => deleteDoc(d.id)}>🗑</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={S.empty}>
              👈 點左側分類或【＋ 新增】開始
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════
// 編輯 modal
// ════════════════════════════════════════════════════════════
function ContractEditModal({ contract, onClose, onSaved }) {
  const isNew = !contract?.id;
  const type  = contract?.type || 'rent';

  const [form, setForm] = useState(() => ({
    type:           contract?.type           || 'rent',
    name:           contract?.name           || '',
    party_name:     contract?.party_name     || '',
    our_side_name:  contract?.our_side_name  || '',
    start_date:     contract?.start_date     || '',
    end_date:       contract?.end_date       || '',
    signed_date:    contract?.signed_date    || '',
    total_amount:   contract?.total_amount   ?? '',
    monthly_amount: contract?.monthly_amount ?? '',
    status:         contract?.status         || 'active',
    note:           contract?.note           || '',
    type_data:      contract?.type_data      || {},
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function up(k, v)    { setForm(f => ({ ...f, [k]: v })); }
  function upTD(k, v)  { setForm(f => ({ ...f, type_data: { ...(f.type_data || {}), [k]: v } })); }

  async function save() {
    setErr('');
    if (!form.name.trim()) return setErr('合約名稱必填');
    setSaving(true);
    try {
      const payload = { ...form };
      // 空字串轉 null
      ['start_date','end_date','signed_date','party_name','our_side_name','note'].forEach(k => {
        if (payload[k] === '') payload[k] = null;
      });
      ['total_amount','monthly_amount'].forEach(k => {
        if (payload[k] === '') payload[k] = null;
        else if (payload[k] != null) payload[k] = Number(payload[k]);
      });
      // 房租類：用 rent_schedule 的當下月租覆寫 monthly_amount 主欄
      if (payload.type === 'rent' && payload.type_data?.rent_schedule) {
        const { current } = currentRentFromSchedule(payload.type_data.rent_schedule);
        if (current && current.monthly_amount != null) {
          payload.monthly_amount = Number(current.monthly_amount);
        }
      }
      if (isNew) await contractsApi.create(payload);
      else       await contractsApi.update(contract.id, payload);
      onSaved();
    } catch (e) { setErr(e?.message || '儲存失敗'); }
    finally     { setSaving(false); }
  }

  const typeLabel = TYPES.find(t => t.value === type)?.label || type;

  return (
    <div style={S.modalBg} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalH}>
          <h2 style={S.modalT}>{isNew ? '新增' : '編輯'}{typeLabel}</h2>
          <button style={S.modalX} onClick={onClose}>✕</button>
        </div>

        {err && <div style={S.errBanner}>❗ {err}</div>}

        {/* PDF 自動讀取 */}
        <PdfImporter type={type} onParsed={(p) => {
          // 把解析結果填入 form（不覆寫已有資料）
          setForm(f => ({
            ...f,
            name:           f.name           || p.name           || '',
            party_name:     f.party_name     || p.party_name     || '',
            our_side_name:  f.our_side_name  || p.our_side_name  || '',
            signed_date:    f.signed_date    || p.signed_date    || '',
            start_date:     f.start_date     || p.start_date     || '',
            end_date:       f.end_date       || p.end_date       || '',
            monthly_amount: f.monthly_amount || p.monthly_amount || '',
            total_amount:   f.total_amount   || p.total_amount   || '',
            note:           f.note           || p.note           || '',
            type_data:      { ...(p.type_data || {}), ...(f.type_data || {}) },
          }));
        }} />

        <div style={S.formGroup}>
          <label style={S.label}>合約名稱 *</label>
          <input style={S.input} value={form.name} onChange={e => up('name', e.target.value)}
                 placeholder={type === 'rent' ? '例：北屯店房租合約' : type === 'vendor' ? '例：元大物流貨款合約' : '例：王小明 雇用合約'} />
        </div>

        <div style={S.formGroup}>
          <div style={S.row2}>
            <div>
              <label style={S.label}>{type === 'rent' ? '門市（我方）' : type === 'employee' ? '員工姓名' : '我方部門'}</label>
              <input style={S.input} value={form.our_side_name} onChange={e => up('our_side_name', e.target.value)}
                     placeholder={type === 'rent' ? '北屯店' : type === 'employee' ? '王小明' : '營運部'} />
            </div>
            <div>
              <label style={S.label}>{type === 'rent' ? '房東' : type === 'vendor' ? '廠商' : '雇主'}</label>
              <input style={S.input} value={form.party_name} onChange={e => up('party_name', e.target.value)}
                     placeholder={type === 'rent' ? '陳南舟 / 成香投資' : type === 'vendor' ? '元大物流' : '樂活光學有限公司'} />
            </div>
          </div>
        </div>

        <div style={S.formGroup}>
          <div style={S.row3}>
            <div>
              <label style={S.label}>簽約日</label>
              <input type="date" style={S.input} value={form.signed_date} onChange={e => up('signed_date', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>起始日</label>
              <input type="date" style={S.input} value={form.start_date} onChange={e => up('start_date', e.target.value)} />
            </div>
            <div>
              <label style={S.label}>到期日</label>
              <input type="date" style={S.input} value={form.end_date} onChange={e => up('end_date', e.target.value)} />
            </div>
          </div>
        </div>

        <div style={S.formGroup}>
          <div style={S.row2}>
            <div>
              <label style={S.label}>{type === 'rent' ? '月租金額' : type === 'employee' ? '月薪' : '合約總額'}</label>
              <input type="number" style={S.input}
                     value={type === 'rent' ? form.monthly_amount : form.total_amount}
                     onChange={e => up(type === 'rent' ? 'monthly_amount' : 'total_amount', e.target.value)}
                     placeholder="0" />
            </div>
            <div>
              <label style={S.label}>狀態</label>
              <select style={S.input} value={form.status} onChange={e => up('status', e.target.value)}>
                {Object.keys(STATUS_LABEL).map(k => <option key={k} value={k}>{STATUS_LABEL[k].label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── 類型專屬欄位 ───────────────────────────────── */}
        <div style={{ ...S.formGroup, marginTop: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.dark, paddingBottom: 6, borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>
            {typeLabel} · 專屬欄位
          </div>
          {type === 'rent' && <RentFields data={form.type_data} setOne={upTD} />}
          {type === 'vendor' && <VendorFields data={form.type_data} setOne={upTD} />}
          {type === 'employee' && <EmployeeFields data={form.type_data} setOne={upTD} />}
        </div>

        <div style={S.formGroup}>
          <label style={S.label}>備註</label>
          <textarea style={S.textarea} value={form.note || ''} onChange={e => up('note', e.target.value)} placeholder="任何補充說明" />
        </div>

        {/* 編輯時顯示附件 + 歷史紀錄 */}
        {!isNew && <ContractAttachmentsPanel contractId={contract.id} />}
        {!isNew && <ContractHistoryPanel contractId={contract.id} />}

        <div style={S.modalAct}>
          <button style={S.btnGhost}   onClick={onClose} disabled={saving}>取消</button>
          <button style={S.btnPrimary} onClick={save}    disabled={saving}>{saving ? '儲存中...' : (isNew ? '建立' : '更新')}</button>
        </div>
      </div>
    </div>
  );
}


// ── PDF 自動讀取上傳區
function PdfImporter({ type, onParsed }) {
  const [busy, setBusy] = useState(false);
  const [msg,  setMsg]  = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg('');
    try {
      const r = await contractsApi.parsePdf(file, type);
      if (r?.success === false) throw new Error(r.message || '解析失敗');
      onParsed(r.data || r);
      setMsg('✅ 解析完成，已填入表單（你可以再校對 / 修改）');
    } catch (err) {
      setMsg('❗ ' + (err?.response?.data?.message || err?.message || '解析失敗'));
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <div style={{ margin: '12px 18px 0', padding: '10px 12px', background: '#fff8ec', border: `1px dashed ${C.gold}`, borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: C.dark, fontWeight: 600 }}>📄 從 PDF 自動填</span>
        <label style={{
          padding: '6px 12px', background: C.dark, color: '#fff', borderRadius: 6,
          cursor: busy ? 'wait' : 'pointer', fontSize: 12, fontWeight: 600,
          opacity: busy ? 0.6 : 1,
        }}>
          {busy ? '⏳ 解析中（約 5-15 秒）...' : '選擇合約 PDF'}
          <input type="file" accept="application/pdf" disabled={busy} onChange={handleFile} style={{ display: 'none' }} />
        </label>
        <span style={{ fontSize: 11, color: C.textLight }}>
          上傳掃描 PDF，Gemini AI 會抽出簽約日 / 起迄日 / 金額 / 房東資料填到下面表單
        </span>
      </div>
      {msg && (
        <div style={{ marginTop: 8, fontSize: 12, color: msg.startsWith('✅') ? '#2d6a4f' : '#c53030' }}>
          {msg}
        </div>
      )}
    </div>
  );
}


// ── 房租專屬欄位 — 含「租金調漲時程」多段
function RentFields({ data, setOne }) {
  const schedule = Array.isArray(data.rent_schedule) ? data.rent_schedule : [];

  function setSchedule(next) { setOne('rent_schedule', next); }
  function updateSeg(i, k, v) {
    const next = schedule.map((s, idx) => idx === i ? { ...s, [k]: v } : s);
    setSchedule(next);
  }
  function addSeg() {
    setSchedule([...schedule, { from_date: '', monthly_amount: '' }]);
  }
  function removeSeg(i) {
    setSchedule(schedule.filter((_, idx) => idx !== i));
  }

  const { current, next } = currentRentFromSchedule(schedule);

  return (
    <>
      {/* 租金時程 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>租金時程（依年/期間調漲）</span>
          <div style={{ flex: 1 }} />
          {current && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#d8f3dc', color: '#2d6a4f' }}>
              目前 $ {fmtAmount(current.monthly_amount)}
            </span>
          )}
          {next && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#fff3cd', color: '#d97706' }}>
              {fmtDate(next.from_date)} 起 $ {fmtAmount(next.monthly_amount)}
            </span>
          )}
        </div>
        {schedule.length === 0 && (
          <div style={{ fontSize: 11, color: '#aaa', padding: '6px 0' }}>
            還沒設定。點下方「＋ 加一段」開始（例：110.10.01 起 $62,782 / 113.10.01 起 $65,921）
          </div>
        )}
        {schedule.map((seg, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#666', minWidth: 24 }}>#{i + 1}</span>
            <input type="date" style={S.input}
                   value={seg.from_date || ''}
                   onChange={e => updateSeg(i, 'from_date', e.target.value)} />
            <input type="number" style={S.input}
                   value={seg.monthly_amount || ''}
                   onChange={e => updateSeg(i, 'monthly_amount', e.target.value === '' ? '' : Number(e.target.value))}
                   placeholder="月租" />
            <button type="button"
                    onClick={() => removeSeg(i)}
                    style={{ ...S.btnDanger, padding: '4px 8px' }}
                    title="移除這段">🗑</button>
          </div>
        ))}
        <button type="button" onClick={addSeg} style={{ ...S.btnGhost, marginTop: 4 }}>
          ＋ 加一段
        </button>
      </div>

      <div style={{ ...S.row2, marginTop: 12 }}>
        <div>
          <label style={S.label}>押金</label>
          <input type="number" style={S.input} value={data.deposit || ''} onChange={e => setOne('deposit', e.target.value)} placeholder="80000" />
        </div>
        <div>
          <label style={S.label}>解約預告期（天）</label>
          <input type="number" style={S.input} value={data.notice_days || ''} onChange={e => setOne('notice_days', e.target.value)} placeholder="60" />
        </div>
      </div>
      <div style={S.row2}>
        <div>
          <label style={S.label}>房東帳號</label>
          <input style={S.input} value={data.landlord_account || ''} onChange={e => setOne('landlord_account', e.target.value)} placeholder="00812602158300" />
        </div>
        <div>
          <label style={S.label}>房東銀行</label>
          <input style={S.input} value={data.landlord_bank || ''} onChange={e => setOne('landlord_bank', e.target.value)} placeholder="816 0083" />
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={S.label}>解約要件</label>
        <textarea style={S.textarea}
                  value={data.termination_conditions || ''}
                  onChange={e => setOne('termination_conditions', e.target.value)}
                  placeholder="例：須於到期前 60 天書面通知；中途解約需賠 1 個月租金；違約金條款..." />
      </div>

      <div style={{ marginTop: 8 }}>
        <label style={S.label}>拆除範圍</label>
        <textarea style={S.textarea}
                  value={data.demolition_scope || ''}
                  onChange={e => setOne('demolition_scope', e.target.value)}
                  placeholder="例：須回復原狀；招牌、隔間、地板裝修需拆除；天花板照明可保留..." />
      </div>
    </>
  );
}

// ── 廠商專屬欄位 — 含「優惠/獎勵條款」動態陣列
const BENEFIT_TYPES = ['階梯回饋', '回饋', '現金折讓', '獎金', '折扣', '抵用', '其他'];
const VALUE_TYPES   = ['percent', 'amount'];
const VALUE_LABEL   = { percent: '%', amount: '$' };

function VendorFields({ data, setOne }) {
  const benefits = Array.isArray(data.benefits) ? data.benefits : [];
  function setBenefits(next) { setOne('benefits', next); }
  function update(i, k, v) { setBenefits(benefits.map((b, idx) => idx === i ? { ...b, [k]: v } : b)); }
  function addOne() { setBenefits([...benefits, { type: '階梯回饋', condition: '', value_type: 'percent', value: '', note: '' }]); }
  function removeOne(i) { setBenefits(benefits.filter((_, idx) => idx !== i)); }

  return (
    <>
      {/* 優惠/獎勵條款 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: '#666', fontWeight: 600, marginBottom: 6 }}>
          優惠 / 獎勵條款（可加多筆 — 階梯回饋、現金折讓、達標獎金等）
        </div>
        {benefits.length === 0 && (
          <div style={{ fontSize: 11, color: '#aaa', padding: '6px 0' }}>
            還沒設定。例：階梯回饋 0~50萬 → 3%；50萬~200萬 → 5%；現金折讓 提早7天 → 2%；達標獎金 年銷售500萬 → $100,000
          </div>
        )}
        {benefits.map((b, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '90px 1fr 80px 110px auto',
            gap: 6, alignItems: 'center', marginBottom: 6,
          }}>
            <select style={{ ...S.input, padding: '6px 8px' }}
                    value={b.type || '階梯回饋'}
                    onChange={e => update(i, 'type', e.target.value)}>
              {BENEFIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input style={{ ...S.input, padding: '6px 8px' }}
                   value={b.condition || ''}
                   onChange={e => update(i, 'condition', e.target.value)}
                   placeholder={b.type === '階梯回饋' ? '0~50萬' : b.type === '現金折讓' ? '提早 7 天' : b.type === '獎金' ? '年銷售達 500 萬' : '條件描述'} />
            <select style={{ ...S.input, padding: '6px 8px' }}
                    value={b.value_type || 'percent'}
                    onChange={e => update(i, 'value_type', e.target.value)}>
              {VALUE_TYPES.map(t => <option key={t} value={t}>{t === 'percent' ? '%' : '金額 $'}</option>)}
            </select>
            <input type="number" step="0.01" style={{ ...S.input, padding: '6px 8px' }}
                   value={b.value || ''}
                   onChange={e => update(i, 'value', e.target.value === '' ? '' : Number(e.target.value))}
                   placeholder={b.value_type === 'percent' ? '5' : '100000'} />
            <button type="button" onClick={() => removeOne(i)}
                    style={{ ...S.btnDanger, padding: '4px 8px' }} title="移除">🗑</button>
            {b.note !== undefined && (
              <input style={{ ...S.input, padding: '6px 8px', gridColumn: '1 / -1', fontSize: 11 }}
                     value={b.note || ''}
                     onChange={e => update(i, 'note', e.target.value)}
                     placeholder="備註（選填）" />
            )}
          </div>
        ))}
        <button type="button" onClick={addOne} style={{ ...S.btnGhost, marginTop: 4 }}>
          ＋ 加一條
        </button>
      </div>

      <div style={S.row2}>
        <div>
          <label style={S.label}>付款條件</label>
          <input style={S.input} value={data.payment_terms || ''} onChange={e => setOne('payment_terms', e.target.value)} placeholder="月結 60 天" />
        </div>
        <div>
          <label style={S.label}>成本比對目標</label>
          <input type="number" style={S.input} value={data.cost_target || ''} onChange={e => setOne('cost_target', e.target.value)} placeholder="1500000" />
        </div>
      </div>
      <div style={S.row2}>
        <div>
          <label style={S.label}>保固期（月）</label>
          <input type="number" style={S.input} value={data.warranty_months || ''} onChange={e => setOne('warranty_months', e.target.value)} placeholder="12" />
        </div>
        <div>
          <label style={S.label}>結帳週期</label>
          <input style={S.input} value={data.billing_cycle || ''} onChange={e => setOne('billing_cycle', e.target.value)} placeholder="每月 / 每季" />
        </div>
      </div>
    </>
  );
}

// ── 員工專屬欄位
const ADJ_TYPES = [
  { value: 'annual',      label: '年度調薪' },
  { value: 'performance', label: '績效制' },
  { value: 'both',        label: '年度 + 績效' },
  { value: 'none',        label: '無固定調薪' },
];

function EmployeeFields({ data, setOne }) {
  return (
    <>
      <div style={S.row2}>
        <div>
          <label style={S.label}>職位</label>
          <input style={S.input} value={data.position || ''} onChange={e => setOne('position', e.target.value)} placeholder="營運專員" />
        </div>
        <div>
          <label style={S.label}>試用期結束日</label>
          <input type="date" style={S.input} value={data.probation_end || ''} onChange={e => setOne('probation_end', e.target.value)} />
        </div>
      </div>
      <div style={S.row2}>
        <div>
          <label style={S.label}>試用期薪資</label>
          <input type="number" style={S.input} value={data.probation_salary || ''} onChange={e => setOne('probation_salary', e.target.value)} placeholder="32000" />
        </div>
        <div>
          <label style={S.label}>轉正後薪資</label>
          <input type="number" style={S.input} value={data.formal_salary || ''} onChange={e => setOne('formal_salary', e.target.value)} placeholder="38000" />
        </div>
      </div>
      <div style={S.row2}>
        <div>
          <label style={S.label}>底薪（現行）</label>
          <input type="number" style={S.input} value={data.salary_base || ''} onChange={e => setOne('salary_base', e.target.value)} placeholder="38000" />
        </div>
        <div>
          <label style={S.label}>勞保投保級距</label>
          <input type="number" style={S.input} value={data.insurance_grade || ''} onChange={e => setOne('insurance_grade', e.target.value)} placeholder="36300" />
          <div style={S.hint}>勞保局公告的級距金額（例：36300、38200、40100）</div>
        </div>
      </div>
      <div style={S.row2}>
        <div>
          <label style={S.label}>調薪制度</label>
          <select style={S.input} value={data.adjustment_type || ''} onChange={e => setOne('adjustment_type', e.target.value)}>
            <option value="">— 請選擇 —</option>
            {ADJ_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>年度調薪月份</label>
          <select style={S.input} value={data.adjustment_month || ''} onChange={e => setOne('adjustment_month', e.target.value)}>
            <option value="">— 不固定 —</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m} 月</option>
            ))}
          </select>
        </div>
      </div>
      <div style={S.row2}>
        <div>
          <label style={S.label}>離職預告期（天）</label>
          <input type="number" style={S.input} value={data.resignation_notice_days || ''} onChange={e => setOne('resignation_notice_days', e.target.value)} placeholder="30" />
        </div>
        <div>
          <label style={S.label}>身分證末四碼（人資對碼用）</label>
          <input style={S.input} value={data.id_last4 || ''} onChange={e => setOne('id_last4', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="6789" maxLength={4} />
        </div>
      </div>
    </>
  );
}


// ── 附件區（編輯時才會出現）
function ContractAttachmentsPanel({ contractId }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true); setErr('');
    try {
      const r = await filesApi.list('contract', contractId);
      setFiles(r.data || []);
    } catch (e) { setErr(e?.message || '載入失敗'); }
    finally     { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [contractId]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setErr('');
    try {
      await filesApi.upload('contract', contractId, file, { category: 'contract_pdf' });
      await load();
    } catch (err) {
      setErr(err?.response?.data?.message || err?.message || '上傳失敗');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('刪除這個附件？')) return;
    try { await filesApi.remove(id); await load(); }
    catch (e) { alert(e?.message || '刪除失敗'); }
  }

  function fmtSize(n) {
    if (!n) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  return (
    <div style={{ padding: '12px 18px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 6, borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.dark }}>📎 附件</span>
        <div style={{ flex: 1 }} />
        <label style={{
          ...S.btnGhost, padding: '4px 10px', cursor: uploading ? 'wait' : 'pointer',
          opacity: uploading ? 0.6 : 1, display: 'inline-flex', alignItems: 'center',
        }}>
          {uploading ? '⏳ 上傳中...' : '＋ 上傳檔案'}
          <input type="file" disabled={uploading} onChange={handleUpload} style={{ display: 'none' }} />
        </label>
      </div>

      {err && <div style={{ ...S.errBanner, margin: 0, marginBottom: 8 }}>❗ {err}</div>}

      {loading ? <div style={{ fontSize: 12, color: C.textLight, padding: 8 }}>載入中...</div>
       : files.length === 0
       ? <div style={{ fontSize: 12, color: C.textLight, padding: 10 }}>還沒上傳任何附件（例：合約掃描 PDF、補充協議）</div>
       : (
         <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
           {files.map((f, i) => (
             <div key={f.id} style={{
               display: 'flex', alignItems: 'center', gap: 10,
               padding: '8px 12px', fontSize: 12,
               borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
             }}>
               <span style={{ fontSize: 16 }}>
                 {f.mime_type?.includes('pdf') ? '📄' :
                  f.mime_type?.startsWith('image') ? '🖼' :
                  f.mime_type?.includes('sheet') || f.mime_type?.includes('excel') ? '📊' :
                  '📎'}
               </span>
               <div style={{ flex: 1, minWidth: 0 }}>
                 <div style={{ fontWeight: 600, color: C.textDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                   {f.original_name || '(未命名)'}
                 </div>
                 <div style={{ fontSize: 10, color: C.textLight }}>
                   {fmtSize(f.size_bytes)} · {new Date(f.uploaded_at).toLocaleString('zh-TW', { hour12: false })} · {f.uploaded_by || '—'}
                 </div>
               </div>
               <a href={f.public_url} target="_blank" rel="noreferrer"
                  style={{ ...S.btnGhost, padding: '4px 10px', textDecoration: 'none' }}>
                 ↓ 下載
               </a>
               <button style={S.btnDanger} onClick={() => handleDelete(f.id)} title="刪除附件">🗑</button>
             </div>
           ))}
         </div>
       )}
    </div>
  );
}


// ── 歷史記錄面板（編輯時才會出現）
function ContractHistoryPanel({ contractId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await contractsApi.listHistory(contractId, 100);
        if (!cancelled) setItems(r.data || []);
      } catch (e) { if (!cancelled) setErr(e?.message || '載入失敗'); }
      finally     { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [contractId]);

  function fmtVal(v) {
    if (!v) return <span style={{ color: '#bbb' }}>—</span>;
    if (v.length > 80) return <span title={v}>{v.slice(0, 80)}...</span>;
    return v;
  }

  return (
    <div style={{ padding: '12px 18px 0' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.dark, paddingBottom: 6, borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>
        📜 變更歷史
      </div>
      {loading ? <div style={{ fontSize: 12, color: C.textLight, padding: 10 }}>載入中...</div>
       : err   ? <div style={{ fontSize: 12, color: '#c53030', padding: 10 }}>{err}</div>
       : items.length === 0 ? <div style={{ fontSize: 12, color: C.textLight, padding: 10 }}>還沒有任何變更紀錄</div>
       : (
        <div style={{ maxHeight: 260, overflow: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ ...S.th, fontSize: 11, padding: '6px 8px' }}>時間</th>
                <th style={{ ...S.th, fontSize: 11, padding: '6px 8px' }}>欄位</th>
                <th style={{ ...S.th, fontSize: 11, padding: '6px 8px' }}>原值</th>
                <th style={{ ...S.th, fontSize: 11, padding: '6px 8px' }}>新值</th>
                <th style={{ ...S.th, fontSize: 11, padding: '6px 8px' }}>異動人</th>
              </tr>
            </thead>
            <tbody>
              {items.map(h => (
                <tr key={h.id}>
                  <td style={{ ...S.td, fontSize: 11, padding: '6px 8px', whiteSpace: 'nowrap' }}>
                    {new Date(h.changed_at).toLocaleString('zh-TW', { hour12: false })}
                  </td>
                  <td style={{ ...S.td, fontSize: 11, padding: '6px 8px', fontWeight: 600 }}>{h.field}</td>
                  <td style={{ ...S.td, fontSize: 11, padding: '6px 8px', color: '#c53030' }}>{fmtVal(h.old_value)}</td>
                  <td style={{ ...S.td, fontSize: 11, padding: '6px 8px', color: '#2d6a4f' }}>{fmtVal(h.new_value)}</td>
                  <td style={{ ...S.td, fontSize: 11, padding: '6px 8px', color: C.textLight }}>{h.changed_by || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
