// pages/recruitment/RecruitmentPage.jsx
// 人力招募模組：人力需求 / 履歷紀錄 / 面試紀錄

import { useState, useEffect, useCallback, useRef } from 'react';
import { recruitmentApi, personnelApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// ── 工具 ─────────────────────────────────────────────────────
function today() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Taipei' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Taipei' });
}

// ── 樣式常數 ──────────────────────────────────────────────────
const C = { dark: '#50422d', mid: '#8b6f4e', light: '#cdbea2', bg: '#f5f0ea', border: '#e0d5c8' };
const S = {
  page:      { padding: '24px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#1a202c' },
  card:      { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '20px', marginBottom: 16 },
  tabBar:    { display: 'flex', gap: 4, marginBottom: 20, borderBottom: `2px solid ${C.border}`, paddingBottom: 0 },
  tab:  (a) => ({ padding: '9px 20px', cursor: 'pointer', border: 'none', background: 'none', fontSize: 14, fontWeight: 600, color: a ? C.dark : '#9a8878', borderBottom: a ? `2px solid ${C.dark}` : '2px solid transparent', marginBottom: -2, transition: 'all 0.15s' }),
  th:        { background: '#f7fafc', padding: '9px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: 600, color: '#4a5568', whiteSpace: 'nowrap', fontSize: 13 },
  thR:       { background: '#f7fafc', padding: '9px 12px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', fontWeight: 600, color: '#4a5568', fontSize: 13 },
  td:        { padding: '9px 12px', borderBottom: '1px solid #edf2f7', fontSize: 13, verticalAlign: 'middle' },
  tdR:       { padding: '9px 12px', borderBottom: '1px solid #edf2f7', fontSize: 13, textAlign: 'right', verticalAlign: 'middle' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  btnP:      { padding: '7px 16px', background: C.dark, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  btnS:      { padding: '7px 14px', background: '#fff', color: '#4a5568', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, cursor: 'pointer' },
  btnSm:     { padding: '3px 10px', background: '#fff', color: C.mid, border: `1px solid ${C.light}`, borderRadius: 5, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' },
  inp:       { padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
  sel:       { padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, background: '#fff', cursor: 'pointer' },
  label:     { fontSize: 12, fontWeight: 600, color: '#718096', marginBottom: 4, display: 'block' },
  alert: (t) => ({ padding: '9px 14px', borderRadius: 6, marginBottom: 12, fontSize: 13, background: t==='error'?'#fff5f5':'#f0fff4', color: t==='error'?'#c53030':'#276749', border:`1px solid ${t==='error'?'#feb2b2':'#9ae6b4'}` }),
  overlay:   { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' },
  modal:     { background:'#fff', borderRadius:12, padding:28, width:480, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' },
};

function Badge({ text, color='#718096', bg='#f7fafc', border='#e2e8f0' }) {
  return <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:999, fontSize:11, fontWeight:700, background:bg, color, border:`1px solid ${border}`, whiteSpace:'nowrap' }}>{text}</span>;
}

const STATUS_BADGE = {
  pending:          <Badge text="待處理"      color="#d69e2e" bg="#fffff0" border="#f6e05e" />,
  rejected:         <Badge text="婉拒"        color="#718096" bg="#f7fafc" border="#e2e8f0" />,
  invited:          <Badge text="待面試"      color="#2b6cb0" bg="#ebf8ff" border="#90cdf4" />,
  notified_intent:  <Badge text="發出詢問意願通知" color="#c05621" bg="#fffaf0" border="#fbd38d" />,
  notified_chat:    <Badge text="發出聊聊通知"    color="#6b46c1" bg="#faf5ff" border="#d6bcfa" />,
  notified_invite:  <Badge text="發出邀約面試通知" color="#0369a1" bg="#e0f2fe" border="#7dd3fc" />,
};
const NEED_BADGE = {
  open:      <Badge text="招募中"  color="#2b6cb0" bg="#ebf8ff" border="#90cdf4" />,
  fulfilled: <Badge text="已補齊"  color="#276749" bg="#f0fff4" border="#9ae6b4" />,
  closed:    <Badge text="已結案"  color="#718096" bg="#f7fafc" border="#e2e8f0" />,
};
const RESULT_BADGE = {
  pass:      <Badge text="✅ 通過"    color="#276749" bg="#f0fff4" border="#9ae6b4" />,
  fail:      <Badge text="❌ 不通過"  color="#c53030" bg="#fff5f5" border="#feb2b2" />,
  no_show:   <Badge text="🚫 未到場"  color="#c05621" bg="#fffaf0" border="#fbd38d" />,
  found_job: <Badge text="💼 已找到工作" color="#6b46c1" bg="#faf5ff" border="#d6bcfa" />,
};

// ════════════════════════════════════════════════════════════
// Tab 1：人力需求表
// ════════════════════════════════════════════════════════════
function NeedsTab({ storeMap }) {
  const [needs, setNeeds]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg]         = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('open');
  const [form, setForm] = useState({ store_erpid:'', store_name:'', total_needed:1, urgent_needed:0, note:'' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await recruitmentApi.getNeeds(statusFilter || undefined);
      setNeeds(r.data || []);
    } catch (e) { setMsg({ type:'error', text: e.message }); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await recruitmentApi.createNeed(form);
      setMsg({ type:'success', text:'人力需求已建立' });
      setShowForm(false);
      setForm({ store_erpid:'', store_name:'', total_needed:1, urgent_needed:0, note:'' });
      load();
    } catch (e) { setMsg({ type:'error', text: e.message }); }
  }

  async function patchNeed(id, updates) {
    try {
      await recruitmentApi.updateNeed(id, updates);
      load();
    } catch (e) { setMsg({ type:'error', text: e.message }); }
  }

  // 當 store_erpid 變動時，自動帶入 store_name
  function handleStoreSelect(e) {
    const erpid = e.target.value;
    const name  = storeMap[erpid] || '';
    setForm(f => ({ ...f, store_erpid: erpid, store_name: name }));
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ display:'flex', gap:8 }}>
          <select style={S.sel} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">全部</option>
            <option value="open">招募中</option>
            <option value="fulfilled">已補齊</option>
            <option value="closed">已結案</option>
          </select>
        </div>
        <button style={S.btnP} onClick={() => setShowForm(v=>!v)}>+ 手動新增需求</button>
      </div>

      {msg && <div style={S.alert(msg.type)}>{msg.text}</div>}

      {/* 手動新增表單 */}
      {showForm && (
        <div style={{ ...S.card, marginBottom:16, background:'#fafaf7' }}>
          <form onSubmit={handleCreate}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={S.label}>門市</label>
                <select style={S.sel} value={form.store_erpid} onChange={handleStoreSelect} required>
                  <option value="">選擇門市…</option>
                  {Object.entries(storeMap).map(([id,name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>缺額（總）</label>
                <input style={S.inp} type="number" min={1} value={form.total_needed} onChange={e=>setForm(f=>({...f,total_needed:+e.target.value}))} required />
              </div>
              <div>
                <label style={S.label}>急缺人數</label>
                <input style={S.inp} type="number" min={0} value={form.urgent_needed} onChange={e=>setForm(f=>({...f,urgent_needed:+e.target.value}))} />
              </div>
              <div>
                <label style={S.label}>備註</label>
                <input style={S.inp} value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="選填" />
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={S.btnP} type="submit">建立</button>
              <button style={S.btnS} type="button" onClick={()=>setShowForm(false)}>取消</button>
            </div>
          </form>
        </div>
      )}

      <div style={S.card}>
        {loading ? (
          <div style={{ textAlign:'center', color:'#a0aec0', padding:32 }}>載入中...</div>
        ) : needs.length === 0 ? (
          <div style={{ textAlign:'center', color:'#a0aec0', padding:32 }}>目前無人力需求資料</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>門市</th>
                <th style={S.thR}>總缺</th>
                <th style={S.thR}>急缺</th>
                <th style={S.thR}>已補</th>
                <th style={S.thR}>剩餘</th>
                <th style={S.th}>狀態</th>
                <th style={S.th}>來源</th>
                <th style={S.th}>建立時間</th>
                <th style={S.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {needs.map(n => {
                const remaining = Math.max(0, n.total_needed - n.filled);
                return (
                  <tr key={n.id}>
                    <td style={S.td}>
                      <span style={{ fontWeight:600 }}>{n.store_name}</span>
                      {n.note && <div style={{ fontSize:11, color:'#9a8878', marginTop:2 }}>{n.note}</div>}
                    </td>
                    <td style={S.tdR}>{n.total_needed}</td>
                    <td style={S.tdR}>{n.urgent_needed > 0 ? <span style={{ color:'#c53030', fontWeight:700 }}>{n.urgent_needed}</span> : 0}</td>
                    <td style={S.tdR}>{n.filled}</td>
                    <td style={S.tdR}><span style={{ fontWeight:600, color: remaining>0?'#c53030':'#276749' }}>{remaining}</span></td>
                    <td style={S.td}>{NEED_BADGE[n.status] || n.status}</td>
                    <td style={S.td}><Badge text={n.source==='hub'?'Hub':'手動'} color="#6b46c1" bg="#faf5ff" border="#d6bcfa" /></td>
                    <td style={S.td}>{fmtDateTime(n.created_at)}</td>
                    <td style={S.td}>
                      <div style={{ display:'flex', gap:5 }}>
                        {n.status === 'open' && (
                          <>
                            <button style={S.btnSm} onClick={() => patchNeed(n.id, { filled: n.filled + 1 })}>+1 到職</button>
                            <button style={{ ...S.btnSm, color:'#718096' }} onClick={() => patchNeed(n.id, { status:'closed' })}>結案</button>
                          </>
                        )}
                        {n.status !== 'open' && (
                          <button style={S.btnSm} onClick={() => patchNeed(n.id, { status:'open' })}>重開</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 2：履歷紀錄
// ════════════════════════════════════════════════════════════
function ResumesTab({ storeMap }) {
  const [viewAll, setViewAll]     = useState(false);   // 全部瀏覽模式
  const [date, setDate]           = useState(today());
  const [platform, setPlatform]   = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // 全部 / pending / invited / rejected
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [addForm, setAddForm]     = useState({ name:'', code:'', phone:'', target_store_erpid:'', platform:'1111' });
  const [actionModal, setActionModal] = useState(null); // { applicant, type:'reject'|'invite' }
  const [actionForm, setActionForm]   = useState({ reject_reason:'', interview_date:'', interview_time:'' });
  // 編輯 / 刪除
  const [editModal, setEditModal]   = useState(null);
  const [editForm, setEditForm]     = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        platform: platform || undefined,
        status:   statusFilter || undefined,
      };
      if (viewAll) {
        const r = await recruitmentApi.getAllApplicants(params);
        setApplicants(r.data || []);
      } else {
        const r = await recruitmentApi.getApplicants({ ...params, date });
        setApplicants(r.data || []);
      }
    } catch (e) { setMsg({ type:'error', text: e.message }); }
    finally { setLoading(false); }
  }, [date, platform, statusFilter, viewAll]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    try {
      await recruitmentApi.createApplicant({ ...addForm, date, target_store_name: storeMap[addForm.target_store_erpid] || '' });
      setMsg({ type:'success', text:'投遞者已新增' });
      setShowAdd(false);
      setAddForm({ name:'', code:'', phone:'', target_store_erpid:'', platform: addForm.platform });
      load();
    } catch (e) { setMsg({ type:'error', text: e.message }); }
  }

  async function handleAction(e) {
    e.preventDefault();
    const { applicant, type } = actionModal;
    try {
      const body = { status: type === 'reject' ? 'rejected' : 'invited' };
      if (type === 'reject') body.reject_reason  = actionForm.reject_reason;
      if (type === 'invite') {
        body.interview_date = actionForm.interview_date;
        body.interview_time = actionForm.interview_time || null;
      }
      await recruitmentApi.updateApplicant(applicant.id, body);
      setMsg({ type:'success', text: type==='reject' ? '已標記婉拒' : '已安排面試，面試紀錄已建立' });
      setActionModal(null);
      setActionForm({ reject_reason:'', interview_date:'', interview_time:'' });
      load();
    } catch (e) { setMsg({ type:'error', text: e.message }); }
  }

  async function handleQuickStatus(applicantId, newStatus) {
    try {
      await recruitmentApi.updateApplicant(applicantId, { status: newStatus });
      load();
    } catch (e) { setMsg({ type:'error', text: e.message }); }
  }

  function openEdit(a) {
    setEditModal(a);
    setEditForm({
      name:               a.name || '',
      code:               a.code || '',
      phone:              a.phone || '',
      platform:           a.platform || '1111',
      target_store_erpid: a.target_store_erpid || '',
      interview_date:     a.interview_date || '',
      interview_time:     a.interview_time || '',
    });
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setEditSaving(true);
    try {
      await recruitmentApi.editApplicant(editModal.id, {
        ...editForm,
        target_store_name: storeMap[editForm.target_store_erpid] || '',
      });
      setMsg({ type:'success', text:'投遞資料已更新' });
      setEditModal(null);
      load();
    } catch (e) { setMsg({ type:'error', text: e.message }); }
    finally { setEditSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await recruitmentApi.deleteApplicant(deleteTarget.id);
      setMsg({ type:'success', text:`已刪除「${deleteTarget.name}」的投遞紀錄` });
      setDeleteTarget(null);
      load();
    } catch (e) { setMsg({ type:'error', text: e.message }); }
    finally { setDeleting(false); }
  }

  return (
    <div>
      {/* 篩選列 */}
      <div style={{ display:'flex', gap:10, marginBottom:14, alignItems:'center', flexWrap:'wrap' }}>
        {/* 全部 / 依日期 切換 */}
        <div style={{ display:'flex', border:`1px solid ${C.border}`, borderRadius:6, overflow:'hidden' }}>
          <button
            style={{ padding:'7px 14px', fontSize:13, border:'none', cursor:'pointer', fontWeight:600,
              background: !viewAll ? C.dark : '#fff', color: !viewAll ? '#fff' : '#718096' }}
            onClick={() => setViewAll(false)}
          >依日期</button>
          <button
            style={{ padding:'7px 14px', fontSize:13, border:'none', cursor:'pointer', fontWeight:600,
              background: viewAll ? C.dark : '#fff', color: viewAll ? '#fff' : '#718096' }}
            onClick={() => setViewAll(true)}
          >全部瀏覽</button>
        </div>
        {!viewAll && (
          <input style={{ ...S.inp, width:150 }} type="date" value={date} onChange={e=>setDate(e.target.value)} />
        )}
        <select style={S.sel} value={platform} onChange={e=>setPlatform(e.target.value)}>
          <option value="">全部平台</option>
          <option value="1111">1111</option>
          <option value="104">104</option>
          <option value="518">518</option>
        </select>
        <select style={S.sel} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="">全部狀態</option>
          <option value="pending">待處理</option>
          <option value="notified_intent">發出詢問意願通知</option>
          <option value="notified_chat">發出聊聊通知</option>
          <option value="notified_invite">發出邀約面試通知</option>
          <option value="invited">待面試</option>
          <option value="rejected">已婉拒</option>
        </select>
        <button style={S.btnP} onClick={()=>setShowAdd(v=>!v)}>+ 新增投遞者</button>
      </div>

      {msg && <div style={S.alert(msg.type)}>{msg.text}</div>}

      {/* 新增表單 */}
      {showAdd && (
        <div style={{ ...S.card, background:'#fafaf7', marginBottom:16 }}>
          <form onSubmit={handleAdd}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10, marginBottom:12 }}>
              <div>
                <label style={S.label}>平台</label>
                <select style={S.sel} value={addForm.platform} onChange={e=>setAddForm(f=>({...f,platform:e.target.value}))} required>
                  <option value="1111">1111</option>
                  <option value="104">104</option>
                  <option value="518">518</option>
                </select>
              </div>
              <div>
                <label style={S.label}>姓名</label>
                <input style={S.inp} value={addForm.name} onChange={e=>setAddForm(f=>({...f,name:e.target.value}))} required />
              </div>
              <div>
                <label style={S.label}>代碼</label>
                <input style={S.inp} value={addForm.code} onChange={e=>setAddForm(f=>({...f,code:e.target.value}))} placeholder="選填" />
              </div>
              <div>
                <label style={S.label}>手機號碼</label>
                <input style={S.inp} type="tel" value={addForm.phone} onChange={e=>setAddForm(f=>({...f,phone:e.target.value}))} placeholder="09xxxxxxxx（選填）" />
              </div>
              <div>
                <label style={S.label}>投遞門市</label>
                <select style={S.sel} value={addForm.target_store_erpid} onChange={e=>setAddForm(f=>({...f,target_store_erpid:e.target.value}))}>
                  <option value="">選擇門市…</option>
                  {Object.entries(storeMap).map(([id,name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={S.btnP} type="submit">存檔</button>
              <button style={S.btnS} type="button" onClick={()=>setShowAdd(false)}>取消</button>
            </div>
          </form>
        </div>
      )}

      <div style={S.card}>
        {loading ? (
          <div style={{ textAlign:'center', color:'#a0aec0', padding:32 }}>載入中...</div>
        ) : applicants.length === 0 ? (
          <div style={{ textAlign:'center', color:'#a0aec0', padding:32 }}>本日無投遞紀錄</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>平台</th>
                <th style={S.th}>姓名</th>
                <th style={S.th}>代碼</th>
                <th style={S.th}>應徵門市</th>
                {viewAll && <th style={S.th}>投遞日期</th>}
                <th style={S.th}>狀態</th>
                <th style={S.th}>面試日期 / 時間</th>
                <th style={S.th}>備註</th>
                <th style={S.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map(a => (
                <tr key={a.id}>
                  <td style={S.td}><Badge text={a.platform} color="#6b46c1" bg="#faf5ff" border="#d6bcfa" /></td>
                  <td style={S.td}><span style={{ fontWeight:600 }}>{a.name}</span></td>
                  <td style={S.td}><span style={{ fontFamily:'monospace', color:'#718096', fontSize:12 }}>{a.code || '—'}</span></td>
                  <td style={S.td}>{a.target_store_name || '—'}</td>
                  {viewAll && <td style={S.td}><span style={{ fontSize:12, color:'#718096' }}>{fmtDate(a.date)}</span></td>}
                  <td style={S.td}>{STATUS_BADGE[a.status] || a.status}</td>
                  <td style={S.td}>
                    {a.interview_date
                      ? <span>{fmtDate(a.interview_date)}{a.interview_time && <span style={{ marginLeft:6, color:'#2b6cb0', fontWeight:600 }}>⏰ {a.interview_time}</span>}</span>
                      : <span style={{ color:'#a0aec0' }}>—</span>}
                  </td>
                  <td style={S.td}><span style={{ fontSize:12, color:'#9a8878' }}>{a.reject_reason || '—'}</span></td>
                  <td style={S.td}>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {!['invited','rejected'].includes(a.status) && (
                        <>
                          {a.status !== 'notified_intent' && (
                            <button style={{ ...S.btnSm, color:'#c05621', borderColor:'#fbd38d' }}
                              onClick={()=>handleQuickStatus(a.id,'notified_intent')}>詢問意願</button>
                          )}
                          {a.status !== 'notified_chat' && (
                            <button style={{ ...S.btnSm, color:'#6b46c1', borderColor:'#d6bcfa' }}
                              onClick={()=>handleQuickStatus(a.id,'notified_chat')}>發出聊聊</button>
                          )}
                          {a.status !== 'notified_invite' && (
                            <button style={{ ...S.btnSm, color:'#0369a1', borderColor:'#7dd3fc' }}
                              onClick={()=>handleQuickStatus(a.id,'notified_invite')}>邀約通知</button>
                          )}
                          <button style={S.btnSm}
                            onClick={()=>{ setActionModal({applicant:a,type:'invite'}); setActionForm({reject_reason:'',interview_date:today()}); }}>待面試</button>
                          <button style={{ ...S.btnSm, color:'#718096' }}
                            onClick={()=>{ setActionModal({applicant:a,type:'reject'}); setActionForm({reject_reason:'',interview_date:''}); }}>婉拒</button>
                        </>
                      )}
                      <button style={{ ...S.btnSm, color:'#2b6cb0' }} onClick={()=>openEdit(a)}>✏️ 修改</button>
                      <button style={{ ...S.btnSm, color:'#c53030', borderColor:'#feb2b2' }} onClick={()=>setDeleteTarget(a)}>🗑 刪除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 操作 Modal（邀請 / 婉拒） */}
      {actionModal && (
        <div style={S.overlay} onClick={e=>{ if(e.target===e.currentTarget) setActionModal(null); }}>
          <div style={S.modal}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>
              {actionModal.type==='reject' ? '婉拒投遞者' : '安排面試（待面試）'}
            </div>
            <form onSubmit={handleAction}>
              {actionModal.type === 'reject' && (
                <div style={{ marginBottom:14 }}>
                  <label style={S.label}>婉拒原因（必填）</label>
                  <textarea
                    style={{ ...S.inp, height:80, resize:'vertical' }}
                    value={actionForm.reject_reason}
                    onChange={e=>setActionForm(f=>({...f,reject_reason:e.target.value}))}
                    required
                  />
                </div>
              )}
              {actionModal.type === 'invite' && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div>
                      <label style={S.label}>面試日期（必填）</label>
                      <input
                        style={S.inp} type="date"
                        value={actionForm.interview_date}
                        onChange={e=>setActionForm(f=>({...f,interview_date:e.target.value}))}
                        required
                      />
                    </div>
                    <div>
                      <label style={S.label}>面試時間（選填）</label>
                      <input
                        style={S.inp} type="time"
                        value={actionForm.interview_time}
                        onChange={e=>setActionForm(f=>({...f,interview_time:e.target.value}))}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div style={{ display:'flex', gap:8 }}>
                <button style={S.btnP} type="submit">{actionModal.type==='reject'?'確認婉拒':'確認安排'}</button>
                <button style={S.btnS} type="button" onClick={()=>setActionModal(null)}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 編輯 Modal */}
      {editModal && (
        <div style={S.overlay} onClick={e=>{ if(e.target===e.currentTarget) setEditModal(null); }}>
          <div style={S.modal}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <strong style={{ fontSize:16 }}>修改投遞資料</strong>
              <button style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#718096' }} onClick={()=>setEditModal(null)}>✕</button>
            </div>
            <form onSubmit={handleEditSave}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                <div>
                  <label style={S.label}>平台</label>
                  <select style={S.sel} value={editForm.platform} onChange={e=>setEditForm(f=>({...f,platform:e.target.value}))} required>
                    <option value="1111">1111</option>
                    <option value="104">104</option>
                    <option value="518">518</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>姓名</label>
                  <input style={S.inp} value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} required />
                </div>
                <div>
                  <label style={S.label}>代碼</label>
                  <input style={S.inp} value={editForm.code} onChange={e=>setEditForm(f=>({...f,code:e.target.value}))} placeholder="選填" />
                </div>
                <div>
                  <label style={S.label}>手機號碼</label>
                  <input style={S.inp} type="tel" value={editForm.phone} onChange={e=>setEditForm(f=>({...f,phone:e.target.value}))} placeholder="09xxxxxxxx（選填）" />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={S.label}>投遞門市</label>
                  <select style={{ ...S.sel, width:'100%' }} value={editForm.target_store_erpid} onChange={e=>setEditForm(f=>({...f,target_store_erpid:e.target.value}))}>
                    <option value="">選擇門市…</option>
                    {Object.entries(storeMap).map(([id,name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>面試日期（選填）</label>
                  <input style={S.inp} type="date" value={editForm.interview_date} onChange={e=>setEditForm(f=>({...f,interview_date:e.target.value}))} />
                </div>
                <div>
                  <label style={S.label}>面試時間（選填）</label>
                  <input style={S.inp} type="time" value={editForm.interview_time} onChange={e=>setEditForm(f=>({...f,interview_time:e.target.value}))} />
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button style={S.btnP} type="submit" disabled={editSaving}>{editSaving?'儲存中...':'儲存'}</button>
                <button style={S.btnS} type="button" onClick={()=>setEditModal(null)}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 刪除確認 Modal */}
      {deleteTarget && (
        <div style={S.overlay} onClick={e=>{ if(e.target===e.currentTarget) setDeleteTarget(null); }}>
          <div style={{ ...S.modal, maxWidth:360 }}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:10, color:'#c53030' }}>🗑 確認刪除</div>
            <p style={{ fontSize:14, color:'#4a5568', marginBottom:6 }}>
              確定要刪除 <strong>「{deleteTarget.name}」</strong> 的投遞紀錄嗎？
            </p>
            {deleteTarget.status === 'invited' && (
              <p style={{ fontSize:13, color:'#c53030', background:'#fff5f5', border:'1px solid #feb2b2', borderRadius:6, padding:'8px 12px', marginBottom:12 }}>
                ⚠️ 此投遞者已邀請面試，刪除時將一併刪除相關面試紀錄。
              </p>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button
                style={{ ...S.btnP, background:'#c53030' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? '刪除中...' : '確認刪除'}
              </button>
              <button style={S.btnS} onClick={()=>setDeleteTarget(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 3：面試紀錄
// ════════════════════════════════════════════════════════════
const EDUCATION_URL = 'https://lms.ruki-ai.com';

function InterviewsTab() {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('pending');
  const [msg, setMsg]               = useState(null);
  const [expanded, setExpanded]     = useState(null);
  const [editForm, setEditForm]     = useState({});
  const [uploading, setUploading]   = useState(false);
  const [smsPhone, setSmsPhone]     = useState({});   // { [interviewId]: phone }
  const [smsUrl, setSmsUrl]         = useState({});   // { [interviewId]: onboarding_url }
  const [smsSending, setSmsSending] = useState(null); // interviewId currently sending
  const audioRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await recruitmentApi.getInterviews(filter || undefined);
      setInterviews(r.data || []);
    } catch (e) { setMsg({ type:'error', text: e.message }); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(id, interview) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    setEditForm({ notes: interview.notes || '', result: interview.result || '', pending_reason: interview.pending_reason || '' });
    // 預填 SMS 欄位
    const ap = interview.recruitment_applicants || {};
    if (ap.phone) setSmsPhone(p => ({ ...p, [id]: p[id] ?? ap.phone }));
    if (interview.onboarding_url) setSmsUrl(u => ({ ...u, [id]: u[id] ?? interview.onboarding_url }));
  }

  async function handleSave(id) {
    try {
      await recruitmentApi.updateInterview(id, {
        notes:          editForm.notes,
        result:         editForm.result || null,
        pending_reason: editForm.result === '' ? (editForm.pending_reason || null) : null,
      });
      setMsg({ type:'success', text:'面試紀錄已儲存' });
      load();
    } catch (e) { setMsg({ type:'error', text: e.message }); }
  }

  async function handleAudio(interviewId, file) {
    if (!file) return;
    setUploading(true);
    try {
      await recruitmentApi.uploadAudio(interviewId, file);
      setMsg({ type:'success', text:'錄音檔已上傳' });
      load();
    } catch (e) { setMsg({ type:'error', text: e.message }); }
    finally { setUploading(false); }
  }

  async function markEducationLinked(id) {
    try {
      await recruitmentApi.updateInterview(id, { education_linked: true });
      setMsg({ type:'success', text:'已標記新人教育訓練建檔完成' });
      load();
    } catch (e) { setMsg({ type:'error', text: e.message }); }
  }

  async function handleSendSms(iv) {
    const phone = (smsPhone[iv.id] || '').trim();
    const url   = (smsUrl[iv.id]   || iv.onboarding_url || '').trim();
    if (!phone) { setMsg({ type:'error', text:'請輸入手機號碼' }); return; }
    if (!url)   { setMsg({ type:'error', text:'請輸入到職連結' }); return; }
    setSmsSending(iv.id);
    try {
      await recruitmentApi.sendSms(iv.id, phone, url);
      setMsg({ type:'success', text:`簡訊已發送至 ${phone}` });
    } catch (e) { setMsg({ type:'error', text: e.message }); }
    finally { setSmsSending(null); }
  }

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        {[
          { v:'pending',   label:'待面試' },
          { v:'pass',      label:'✅ 已通過' },
          { v:'fail',      label:'❌ 未通過' },
          { v:'no_show',   label:'🚫 未到場' },
          { v:'found_job', label:'💼 已找到工作' },
          { v:'',          label:'全部' },
        ].map(({ v, label }) => (
          <button key={v} style={{ ...S.btnS, ...(filter===v?{background:C.dark,color:'#fff',border:`1px solid ${C.dark}`}:{}) }} onClick={()=>setFilter(v)}>
            {label}
          </button>
        ))}
      </div>

      {msg && <div style={S.alert(msg.type)}>{msg.text}</div>}

      <div style={S.card}>
        {loading ? (
          <div style={{ textAlign:'center', color:'#a0aec0', padding:32 }}>載入中...</div>
        ) : interviews.length === 0 ? (
          <div style={{ textAlign:'center', color:'#a0aec0', padding:32 }}>無面試紀錄</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>應徵者</th>
                <th style={S.th}>平台</th>
                <th style={S.th}>應徵門市</th>
                <th style={S.th}>面試日期</th>
                <th style={S.th}>結果</th>
                <th style={S.th}>錄音</th>
                <th style={S.th}>教訓建檔</th>
                <th style={S.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {interviews.map(iv => {
                const ap = iv.recruitment_applicants || {};
                const isOpen = expanded === iv.id;
                return (
                  <>
                    <tr key={iv.id} style={{ background: isOpen ? '#f7f5f2' : 'transparent' }}>
                      <td style={S.td}><span style={{ fontWeight:600 }}>{ap.name || '—'}</span>{ap.code && <span style={{ fontSize:11, color:'#9a8878', marginLeft:6 }}>#{ap.code}</span>}</td>
                      <td style={S.td}>{ap.platform && <Badge text={ap.platform} color="#6b46c1" bg="#faf5ff" border="#d6bcfa" />}</td>
                      <td style={S.td}>{ap.target_store_name || '—'}</td>
                      <td style={S.td}>
                        {fmtDate(ap.interview_date || iv.created_at)}
                        {ap.interview_time && <span style={{ marginLeft:6, color:'#2b6cb0', fontWeight:600, fontSize:12 }}>⏰ {ap.interview_time}</span>}
                      </td>
                      <td style={S.td}>{iv.result ? RESULT_BADGE[iv.result] : <Badge text="待面試" color="#d69e2e" bg="#fffff0" border="#f6e05e" />}</td>
                      <td style={S.td}>{iv.audio_url ? <a href={iv.audio_url} target="_blank" rel="noreferrer" style={{ color:'#2b6cb0', fontSize:12 }}>🎙 播放</a> : <span style={{ color:'#a0aec0', fontSize:12 }}>—</span>}</td>
                      <td style={S.td}>
                        {iv.result === 'pass'
                          ? iv.education_linked
                            ? <Badge text="✅ 已建檔" color="#276749" bg="#f0fff4" border="#9ae6b4" />
                            : <Badge text="待建檔"   color="#c53030" bg="#fff5f5" border="#feb2b2" />
                          : <span style={{ color:'#a0aec0', fontSize:12 }}>—</span>}
                      </td>
                      <td style={S.td}>
                        <button style={S.btnSm} onClick={()=>toggleExpand(iv.id, iv)}>
                          {isOpen ? '▲ 收合' : '▼ 填寫'}
                        </button>
                      </td>
                    </tr>

                    {/* 展開編輯區 */}
                    {isOpen && (
                      <tr key={`${iv.id}-edit`}>
                        <td colSpan={8} style={{ padding:'0 12px 14px', background:'#f7f5f2' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, paddingTop:12 }}>

                            {/* 左：文字紀錄 + 結果 */}
                            <div>
                              <label style={S.label}>面試紀錄</label>
                              <textarea
                                style={{ ...S.inp, height:100, resize:'vertical', marginBottom:10 }}
                                value={editForm.notes}
                                onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))}
                                placeholder="輸入面試觀察與評語..."
                              />
                              <label style={S.label}>面試結果</label>
                              <div style={{ display:'flex', gap:10, marginBottom:10, flexWrap:'wrap' }}>
                                {[
                                  { v:'pass',      label:'✅ 通過' },
                                  { v:'fail',      label:'❌ 不通過' },
                                  { v:'no_show',   label:'🚫 面試未到' },
                                  { v:'found_job', label:'💼 找到工作' },
                                  { v:'',          label:'（未決定）' },
                                ].map(({ v, label }) => (
                                  <label key={v} style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, cursor:'pointer' }}>
                                    <input type="radio" name={`result-${iv.id}`} value={v} checked={editForm.result===v} onChange={()=>setEditForm(f=>({...f,result:v}))} />
                                    {label}
                                  </label>
                                ))}
                              </div>

                              {/* 未決定追蹤原因 */}
                              {editForm.result === '' && (
                                <div style={{ marginBottom:10 }}>
                                  <label style={{ ...S.label, color:'#c05621' }}>追蹤原因（選填）</label>
                                  <textarea
                                    style={{ ...S.inp, height:60, resize:'vertical', borderColor:'#fbd38d' }}
                                    value={editForm.pending_reason}
                                    onChange={e=>setEditForm(f=>({...f,pending_reason:e.target.value}))}
                                    placeholder="記錄未決定原因，例如：需再安排第二次面試、待確認薪資條件..."
                                  />
                                </div>
                              )}

                              <button style={S.btnP} onClick={()=>handleSave(iv.id)}>儲存</button>
                            </div>

                            {/* 右：錄音上傳 + 教訓系統 */}
                            <div>
                              <label style={S.label}>上傳錄音檔</label>
                              <input
                                type="file" accept="audio/*"
                                ref={audioRef}
                                style={{ display:'none' }}
                                onChange={e=>handleAudio(iv.id, e.target.files[0])}
                              />
                              <button
                                style={{ ...S.btnS, marginBottom:10 }}
                                onClick={()=>audioRef.current.click()}
                                disabled={uploading}
                              >
                                {uploading ? '上傳中...' : '🎙 選擇錄音檔'}
                              </button>
                              {iv.audio_url && (
                                <div style={{ marginBottom:10 }}>
                                  <audio controls src={iv.audio_url} style={{ width:'100%', marginTop:4 }} />
                                </div>
                              )}

                              {/* 面試通過後的教育訓練引導 */}
                              {editForm.result === 'pass' && (
                                <div style={{ background:'#f0fff4', border:'1px solid #9ae6b4', borderRadius:8, padding:'12px 14px' }}>
                                  <div style={{ fontWeight:600, fontSize:13, color:'#276749', marginBottom:8 }}>🎉 面試通過！下一步</div>

                                  {/* 前往教育訓練系統 */}
                                  <a
                                    href={`${EDUCATION_URL}/hq/enrollments/new?app_number=${encodeURIComponent(user?.app_number || '')}&interview_id=${iv.id}`}
                                    target="_blank" rel="noreferrer"
                                    style={{ display:'inline-block', padding:'7px 14px', background:'#276749', color:'#fff', borderRadius:6, fontSize:13, textDecoration:'none', marginBottom:8 }}
                                  >
                                    前往教育訓練系統建立新人 →
                                  </a>

                                  {/* 建檔狀態 */}
                                  <div style={{ marginBottom:10 }}>
                                    {iv.education_linked
                                      ? <Badge text="✅ 已建檔" color="#276749" bg="#f0fff4" border="#9ae6b4" />
                                      : <button style={{ ...S.btnSm }} onClick={()=>markEducationLinked(iv.id)}>✅ 手動確認建檔完成</button>
                                    }
                                  </div>

                                  {/* SMS 區塊：面試通過即顯示 */}
                                  <div style={{ borderTop:'1px solid #9ae6b4', paddingTop:10 }}>
                                    <div style={{ fontSize:12, fontWeight:600, color:'#276749', marginBottom:6 }}>📱 發送到職簡訊</div>
                                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                      <input
                                        style={S.inp}
                                        type="tel"
                                        placeholder="新人手機（09xxxxxxxx）"
                                        value={smsPhone[iv.id] ?? (ap.phone || '')}
                                        onChange={e => setSmsPhone(p => ({ ...p, [iv.id]: e.target.value }))}
                                      />
                                      <input
                                        style={S.inp}
                                        type="url"
                                        placeholder="到職連結（教育系統建立後自動填入，或手動貼上）"
                                        value={smsUrl[iv.id] ?? (iv.onboarding_url || '')}
                                        onChange={e => setSmsUrl(u => ({ ...u, [iv.id]: e.target.value }))}
                                      />
                                      <button
                                        style={{ ...S.btnP, background:'#2b6cb0', fontSize:13, alignSelf:'flex-start' }}
                                        onClick={() => handleSendSms(iv)}
                                        disabled={smsSending === iv.id}
                                      >
                                        {smsSending === iv.id ? '發送中...' : '📱 發送到職簡訊'}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 主頁面
// ════════════════════════════════════════════════════════════
export default function RecruitmentPage() {
  const [tab, setTab]       = useState('needs');
  const [storeMap, setStoreMap] = useState({});

  useEffect(() => {
    personnelApi.getDepartments()
      .then(r => {
        const m = {};
        for (const d of (r.data || [])) {
          if (d.store_erpid) m[d.store_erpid] = d.store_name;
        }
        setStoreMap(m);
      })
      .catch(() => {});
  }, []);

  const TABS = [
    { key:'needs',      label:'📋 人力需求' },
    { key:'resumes',    label:'📄 履歷紀錄' },
    { key:'interviews', label:'🗣 面試紀錄' },
  ];

  return (
    <div style={S.page}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700, margin:'0 0 4px' }}>人力招募</h1>
        <p style={{ fontSize:13, color:'#718096', margin:0 }}>管理門市缺額需求、履歷整理與面試流程</p>
      </div>

      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.key} style={S.tab(tab===t.key)} onClick={()=>setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'needs'      && <NeedsTab      storeMap={storeMap} />}
      {tab === 'resumes'    && <ResumesTab    storeMap={storeMap} />}
      {tab === 'interviews' && <InterviewsTab />}
    </div>
  );
}
