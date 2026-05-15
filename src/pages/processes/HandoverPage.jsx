// pages/processes/HandoverPage.jsx
// 門市交接表 - 管理端
// 3 個 tab：
//   交接列表  - 看所有已建立的交接、各 stage、複製 QR 連結
//   建立交接  - 選門市 → 套模板 → 微調品項 → 建立 → 顯示 QR / 連結
//   模板管理  - 每門市的可重用品項清單

import { useState, useEffect, useCallback } from 'react';
import { processesApi } from '../../services/api';

const C = { dark:'#50422d', mid:'#8b6f4e', light:'#cdbea2', bg:'#f5f0ea',
  bgCard:'#ffffff', border:'#e0d5c8', textDark:'#3a2e1e', textMid:'#6b5640', textLight:'#9a8878' };

const STAGE_LABEL = {
  pending_original: '⏳ 等原交接方',
  pending_new:      '⏳ 等新交接方',
  pending_third:    '⏳ 等第三方確認',
  completed:        '✅ 已完成',
  cancelled:        '🚫 已取消',
};
const STAGE_COLOR = {
  pending_original: { bg:'#fff8ec', text:'#8b6f4e', border:'#e5c99a' },
  pending_new:      { bg:'#f0f4ff', text:'#3b5bdb', border:'#bac8ff' },
  pending_third:    { bg:'#f0f4ff', text:'#3b5bdb', border:'#bac8ff' },
  completed:        { bg:'#f0fff4', text:'#2d6a4f', border:'#b7e4c7' },
  cancelled:        { bg:'#f5f5f5', text:'#888',    border:'#ddd' },
};

const ITEM_TYPE_LABEL = { check:'勾選', number:'數字', count_module:'盤點(下版做)' };

const TABS = [
  { key:'list',     label:'交接列表',  icon:'📋' },
  { key:'create',   label:'建立交接',  icon:'＋' },
  { key:'template', label:'模板管理',  icon:'⚙️' },
];

const fmtDateTime = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleString('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false });
};

const publicUrl = (id) => `${window.location.origin}/handover/${id}`;
const qrSrc     = (text, size=200) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;

// ════════════════════════════════════════════════════════════
export default function HandoverPage() {
  const [tab, setTab] = useState('list');
  return (
    <div style={{ background: C.bg, minHeight:'100vh', fontFamily:'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: C.dark, padding:'20px 28px 0' }}>
        <div style={{ color:'#fff', fontSize:20, fontWeight:700, marginBottom:4 }}>📝 門市交接表</div>
        <div style={{ color: C.light, fontSize:13, marginBottom:16 }}>
          建立交接 → 連結傳給原交接方 → 完成後產生新 QR 給新方 → 第三方確認
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding:'8px 18px', border:'none', borderRadius:'8px 8px 0 0', cursor:'pointer',
              fontSize:13, fontWeight: tab===t.key ? 700 : 500,
              background: tab===t.key ? C.bg : 'transparent',
              color:      tab===t.key ? C.dark : C.light,
            }}>{t.icon} {t.label}</button>
          ))}
        </div>
      </div>
      <div style={{ padding:'24px 28px' }}>
        {tab==='list'     && <ListPanel onSwitchToCreate={() => setTab('create')} />}
        {tab==='create'   && <CreatePanel onCreated={() => setTab('list')} />}
        {tab==='template' && <TemplatePanel />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 1：交接列表
// ════════════════════════════════════════════════════════════
function ListPanel({ onSwitchToCreate }) {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR]   = useState(null);  // {id, url}

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await processesApi.listHandovers({ limit: 100 });
      setList(Array.isArray(res?.data) ? res.data : []);
    } catch (e) { alert('載入失敗：' + (e.response?.data?.message || e.message)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ color: C.textMid, fontSize:13 }}>{loading ? '…' : `共 ${list.length} 筆`}</div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={load} style={btnGhost}>🔄 重新整理</button>
          <button onClick={onSwitchToCreate} style={btnPrimary}>＋ 建立交接</button>
        </div>
      </div>

      <div style={{ background: C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead style={{ background:'#f9f5ee' }}>
            <tr><Th>狀態</Th><Th>門市</Th><Th>原交接</Th><Th>新交接</Th><Th>第三方</Th><Th>建立時間</Th><Th>動作</Th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={emptyCell}>載入中…</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={7} style={emptyCell}>還沒有交接，按右上角「＋ 建立交接」開始</td></tr>
            ) : list.map(h => (
              <tr key={h.id} style={{ borderTop:`1px solid ${C.border}` }}>
                <Td><StageBadge stage={h.stage} /></Td>
                <Td><div style={{ fontWeight:600 }}>{h.store_name}</div><div style={{ fontSize:11, color: C.textLight }}>{h.store_erpid}</div></Td>
                <Td>{h.original_name || '—'}<div style={{ fontSize:11, color:C.textLight }}>{fmtDateTime(h.original_filled_at)}</div></Td>
                <Td>{h.new_name || '—'}<div style={{ fontSize:11, color:C.textLight }}>{fmtDateTime(h.new_filled_at)}</div></Td>
                <Td>{h.third_name || '—'}<div style={{ fontSize:11, color:C.textLight }}>{fmtDateTime(h.third_confirmed_at)}</div></Td>
                <Td>{fmtDateTime(h.created_at)}<div style={{ fontSize:11, color: C.textLight }}>{h.created_by_name}</div></Td>
                <Td>
                  <button onClick={() => setShowQR({ id: h.id, url: publicUrl(h.id) })} style={btnGhost}>QR / 連結</button>
                  <a href={publicUrl(h.id)} target="_blank" rel="noreferrer" style={{ ...btnGhost, marginLeft:6, textDecoration:'none', display:'inline-block' }}>開啟</a>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showQR && <QRModal {...showQR} onClose={() => setShowQR(null)} />}
    </>
  );
}

function QRModal({ id, url, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Modal title="交接表 QR / 連結" onClose={onClose}>
      <div style={{ textAlign:'center' }}>
        <img src={qrSrc(url, 280)} alt="QR" style={{ width:280, height:280, border:`1px solid ${C.border}`, borderRadius:8 }} />
        <div style={{ marginTop:12, fontSize:12, color: C.textMid, wordBreak:'break-all' }}>{url}</div>
        <div style={{ marginTop:16, display:'flex', gap:8, justifyContent:'center' }}>
          <button onClick={copy} style={btnPrimary}>{copied ? '✅ 已複製' : '複製連結'}</button>
          <a href={url} target="_blank" rel="noreferrer" style={{ ...btnGhost, textDecoration:'none' }}>新分頁開啟</a>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 2：建立交接
// ════════════════════════════════════════════════════════════
function CreatePanel({ onCreated }) {
  const [stores, setStores]               = useState([]);
  const [storeErpid, setStoreErpid]       = useState('');
  const [templates, setTemplates]         = useState([]);
  const [templateId, setTemplateId]       = useState('');
  const [items, setItems]                 = useState([]);
  const [submitting, setSubmitting]       = useState(false);
  const [created, setCreated]             = useState(null);

  // 載門市
  useEffect(() => {
    (async () => {
      try {
        const res = await processesApi.listStores();
        setStores(res.data || []);
      } catch (e) { console.error(e); }
    })();
  }, []);

  // 選門市後載模板
  useEffect(() => {
    setTemplates([]); setTemplateId(''); setItems([]);
    if (!storeErpid) return;
    (async () => {
      try {
        const res = await processesApi.listTemplates(storeErpid);
        const tmpls = res.data || [];
        setTemplates(tmpls);
        if (tmpls.length > 0) {
          setTemplateId(tmpls[0].id);
          setItems(JSON.parse(JSON.stringify(tmpls[0].items || [])));
        }
      } catch (e) { console.error(e); }
    })();
  }, [storeErpid]);

  // 選模板後同步 items 預覽
  useEffect(() => {
    if (!templateId) return;
    const t = templates.find(x => x.id === templateId);
    if (t) setItems(JSON.parse(JSON.stringify(t.items || [])));
  }, [templateId, templates]);

  const store = stores.find(s => s.erpid === storeErpid);

  const submit = async () => {
    if (!storeErpid) { alert('請選門市'); return; }
    if (!Array.isArray(items) || items.length === 0) { alert('交接表至少要有一個品項（請先在模板管理建好）'); return; }
    setSubmitting(true);
    try {
      const res = await processesApi.createHandover({
        template_id:  templateId || null,
        custom_items: items,  // snapshot 當下狀態
        store_erpid:  storeErpid,
        store_name:   store?.name || '',
      });
      setCreated(res.data);
    } catch (e) {
      alert('建立失敗：' + (e.response?.data?.message || e.message));
    } finally { setSubmitting(false); }
  };

  if (created) {
    const url = publicUrl(created.id);
    return (
      <div style={{ background: C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, padding:24, textAlign:'center' }}>
        <div style={{ fontSize:18, fontWeight:700, color: C.textDark, marginBottom:8 }}>✅ 交接表已建立</div>
        <div style={{ color: C.textMid, fontSize:13, marginBottom:16 }}>{created.store_name}</div>
        <img src={qrSrc(url, 280)} alt="QR" style={{ width:280, height:280, border:`1px solid ${C.border}`, borderRadius:8 }} />
        <div style={{ marginTop:12, fontSize:12, color: C.textMid, wordBreak:'break-all' }}>{url}</div>
        <div style={{ marginTop:16, display:'flex', gap:8, justifyContent:'center' }}>
          <button onClick={() => navigator.clipboard?.writeText(url)} style={btnPrimary}>複製連結</button>
          <button onClick={() => { setCreated(null); onCreated(); }} style={btnGhost}>回列表</button>
        </div>
        <div style={{ marginTop:12, fontSize:12, color: C.textLight }}>
          原交接方掃此 QR 進入；填完後系統會自動產生下一張 QR 給新交接方
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, padding:20 }}>
      <Field label="門市 *">
        <select value={storeErpid} onChange={e => setStoreErpid(e.target.value)} style={inputStyle}>
          <option value="">請選擇門市</option>
          {stores.map(s => <option key={s.erpid} value={s.erpid}>{s.name}</option>)}
        </select>
      </Field>

      {storeErpid && (
        <>
          <Field label={`套用模板（${templates.length} 個可選）`}>
            {templates.length === 0 ? (
              <div style={{ color: C.textLight, fontSize:13 }}>
                此門市還沒有模板，請先到「模板管理」tab 建一個
              </div>
            ) : (
              <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={inputStyle}>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}（{(t.items || []).length} 項）</option>)}
              </select>
            )}
          </Field>

          {items.length > 0 && (
            <Field label={`品項預覽（${items.length} 項，可在下方微調，不會回寫到模板）`}>
              <ItemEditor items={items} onChange={setItems} />
            </Field>
          )}
        </>
      )}

      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:20 }}>
        <button onClick={submit} style={btnPrimary} disabled={submitting || !storeErpid || items.length === 0}>
          {submitting ? '建立中…' : '建立並產生 QR'}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 3：模板管理
// ════════════════════════════════════════════════════════════
function TemplatePanel() {
  const [stores, setStores]         = useState([]);
  const [storeErpid, setStoreErpid] = useState('');
  const [templates, setTemplates]   = useState([]);
  const [editing, setEditing]       = useState(null); // template object or {new:true}

  useEffect(() => {
    (async () => {
      try {
        const res = await processesApi.listStores();
        setStores(res.data || []);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const loadTemplates = useCallback(async () => {
    if (!storeErpid) { setTemplates([]); return; }
    try {
      const res = await processesApi.listTemplates(storeErpid);
      setTemplates(res.data || []);
    } catch (e) { console.error(e); }
  }, [storeErpid]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const store = stores.find(s => s.erpid === storeErpid);

  const handleNew = () => {
    if (!store) { alert('請先選門市'); return; }
    setEditing({ new: true, store_erpid: store.erpid, store_name: store.name, name:'預設交接表', items: [] });
  };

  const handleDelete = async (t) => {
    if (!confirm(`確定刪除模板「${t.name}」？`)) return;
    try {
      await processesApi.deleteTemplate(t.id);
      await loadTemplates();
    } catch (e) { alert('刪除失敗：' + (e.response?.data?.message || e.message)); }
  };

  return (
    <div style={{ background: C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, padding:20 }}>
      <Field label="選門市">
        <select value={storeErpid} onChange={e => setStoreErpid(e.target.value)} style={inputStyle}>
          <option value="">請選擇門市</option>
          {stores.map(s => <option key={s.erpid} value={s.erpid}>{s.name}</option>)}
        </select>
      </Field>

      {storeErpid && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div style={{ color: C.textMid, fontSize:13 }}>共 {templates.length} 個模板</div>
            <button onClick={handleNew} style={btnPrimary}>＋ 新增模板</button>
          </div>

          {templates.length === 0 ? (
            <div style={{ padding:24, textAlign:'center', color: C.textLight, border:`1px dashed ${C.border}`, borderRadius:8 }}>
              尚未建立模板
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {templates.map(t => (
                <div key={t.id} style={{ display:'flex', justifyContent:'space-between', padding:'12px 14px', border:`1px solid ${C.border}`, borderRadius:8 }}>
                  <div>
                    <div style={{ fontWeight:600, color: C.textDark }}>{t.name}</div>
                    <div style={{ fontSize:12, color: C.textLight, marginTop:2 }}>
                      {(t.items || []).length} 個品項 · {t.is_active ? '啟用中' : '停用'} · 更新於 {fmtDateTime(t.updated_at)}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => setEditing(t)} style={btnGhost}>編輯</button>
                    <button onClick={() => handleDelete(t)} style={{ ...btnGhost, color:'#c53030' }}>刪除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editing && (
        <TemplateEditModal
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await loadTemplates(); }}
        />
      )}
    </div>
  );
}

function TemplateEditModal({ template, onClose, onSaved }) {
  const [name, setName]   = useState(template.name || '預設交接表');
  const [items, setItems] = useState(JSON.parse(JSON.stringify(template.items || [])));
  const [active, setActive] = useState(template.is_active !== false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { alert('請填模板名稱'); return; }
    setSaving(true);
    try {
      if (template.new) {
        await processesApi.createTemplate({
          store_erpid: template.store_erpid,
          store_name:  template.store_name,
          name: name.trim(),
          items,
          is_active: active,
        });
      } else {
        await processesApi.updateTemplate(template.id, { name: name.trim(), items, is_active: active });
      }
      onSaved();
    } catch (e) {
      alert('儲存失敗：' + (e.response?.data?.message || e.message));
    } finally { setSaving(false); }
  };

  return (
    <Modal title={template.new ? '新增模板' : '編輯模板'} onClose={onClose} wide>
      <Field label="模板名稱 *">
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="門市">
        <div style={{ color: C.textMid, fontSize:13 }}>{template.store_name}（{template.store_erpid}）</div>
      </Field>
      <Field label={`品項清單（${items.length} 項）`}>
        <ItemEditor items={items} onChange={setItems} />
      </Field>
      <Field label="狀態">
        <label><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> 啟用此模板</label>
      </Field>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
        <button onClick={onClose} style={btnGhost} disabled={saving}>取消</button>
        <button onClick={save} style={btnPrimary} disabled={saving}>{saving ? '儲存中…' : '儲存'}</button>
      </div>
    </Modal>
  );
}

// ── 品項編輯器（公用）──────────────────────────────────────
function ItemEditor({ items, onChange }) {
  const updateItem = (idx, patch) => onChange(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));
  const addItem    = (type) => onChange([...items, {
    id: cryptoRandomId(),
    label: '',
    type,
    required: true,
    allow_photo: true,
  }]);
  const move       = (idx, dir) => {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div>
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
        {items.length === 0 ? (
          <div style={{ padding:16, textAlign:'center', color: C.textLight, border:`1px dashed ${C.border}`, borderRadius:6 }}>
            尚未加入品項，點下方按鈕加一個
          </div>
        ) : items.map((it, idx) => (
          <div key={it.id || idx} style={{
            display:'grid',
            gridTemplateColumns: '40px 1fr 110px auto auto auto',
            gap: 6, alignItems: 'center',
            padding:'6px 8px', border:`1px solid ${C.border}`, borderRadius:6,
            background: '#fafaf7',
          }}>
            <div style={{ display:'flex', flexDirection:'column' }}>
              <button onClick={() => move(idx, -1)} style={tinyBtn}>↑</button>
              <button onClick={() => move(idx, +1)} style={tinyBtn}>↓</button>
            </div>
            <input value={it.label} onChange={e => updateItem(idx, { label: e.target.value })}
              placeholder="品項名稱（如：店面鑰匙）" style={inputStyle} />
            <select value={it.type} onChange={e => updateItem(idx, { type: e.target.value })} style={inputStyle}>
              <option value="check">勾選</option>
              <option value="number">數字</option>
              <option value="count_module" disabled>盤點(下版)</option>
            </select>
            <label style={{ fontSize:12, color: C.textMid, whiteSpace:'nowrap' }}>
              <input type="checkbox" checked={it.required !== false} onChange={e => updateItem(idx, { required: e.target.checked })} /> 必填
            </label>
            <label style={{ fontSize:12, color: C.textMid, whiteSpace:'nowrap' }}>
              <input type="checkbox" checked={it.allow_photo !== false} onChange={e => updateItem(idx, { allow_photo: e.target.checked })} /> 可附照片
            </label>
            <button onClick={() => removeItem(idx)} style={{ ...tinyBtn, color:'#c53030' }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <button onClick={() => addItem('check')}  style={btnTinyGhost}>＋ 勾選項目</button>
        <button onClick={() => addItem('number')} style={btnTinyGhost}>＋ 數字項目</button>
      </div>
    </div>
  );
}

// ── 共用元件 ──────────────────────────────────────────────
function Th({ children }) { return <th style={{ textAlign:'left', padding:'10px 12px', color: C.textMid, fontWeight:600, fontSize:12 }}>{children}</th>; }
function Td({ children }) { return <td style={{ padding:'10px 12px', verticalAlign:'top' }}>{children}</td>; }
function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:12, color: C.textMid, fontWeight:600, marginBottom:6 }}>{label}</div>
      {children}
    </div>
  );
}
function StageBadge({ stage }) {
  const c = STAGE_COLOR[stage] || STAGE_COLOR.pending_original;
  return <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:12, fontSize:12, fontWeight:600,
    background:c.bg, color:c.text, border:`1px solid ${c.border}` }}>{STAGE_LABEL[stage] || stage}</span>;
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
      display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'60px 20px', overflowY:'auto', zIndex:1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:12, padding:24,
        width: wide ? 720 : 480, maxWidth:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h3 style={{ margin:0, color:C.dark }}>{title}</h3>
          <button onClick={onClose} style={{ border:'none', background:'transparent', fontSize:24, cursor:'pointer', color: C.textLight }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputStyle  = { width:'100%', padding:'8px 10px', fontSize:14, border:`1px solid ${C.border}`, borderRadius:6, boxSizing:'border-box' };
const btnPrimary  = { padding:'8px 18px', background:C.dark, color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontWeight:600, fontSize:13 };
const btnGhost    = { padding:'6px 12px', background:'transparent', color: C.textMid, border:`1px solid ${C.border}`, borderRadius:6, cursor:'pointer', fontSize:12 };
const btnTinyGhost= { padding:'4px 10px', background:'transparent', color: C.textMid, border:`1px solid ${C.border}`, borderRadius:4, cursor:'pointer', fontSize:11 };
const tinyBtn     = { padding:'2px 6px', background:'transparent', color: C.textMid, border:'none', cursor:'pointer', fontSize:11 };
const emptyCell   = { padding:32, textAlign:'center', color: C.textLight };

function cryptoRandomId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
