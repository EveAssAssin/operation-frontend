// pages/recruitment/RecruitmentPage.jsx
// 人力招募模組：人力需求 / 履歷紀錄 / 面試紀錄

import { useState, useEffect, useCallback, useRef } from 'react';
import { recruitmentApi, personnelApi } from '../../services/api';

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
  pending:  <Badge text="待處理" color="#d69e2e" bg="#fffff0" border="#f6e05e" />,
  rejected: <Badge text="婉拒"   color="#718096" bg="#f7fafc" border="#e2e8f0" />,
  invited:  <Badge text="邀請面試" color="#2b6cb0" bg="#ebf8ff" border="#90cdf4" />,
};
const NEED_BADGE = {
  open:      <Badge text="招募中"  color="#2b6cb0" bg="#ebf8ff" border="#90cdf4" />,
  fulfilled: <Badge text="已補齊"  color="#276749" bg="#f0fff4" border="#9ae6b4" />,
  closed:    <Badge text="已結案"  color="#718096" bg="#f7fafc" border="#e2e8f0" />,
};
const RESULT_BADGE = {
  pass: <Badge text="✅ 通過" color="#276749" bg="#f0fff4" border="#9ae6b4" />,
  fail: <Badge text="❌ 不通過" color="#c53030" bg="#fff5f5" border="#feb2b2" />,
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
  const [date, setDate]           = useState(today());
  const [platform, setPlatform]   = useState('');
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [addForm, setAddForm]     = useState({ name:'', code:'', target_store_erpid:'', platform:'1111' });
  const [actionModal, setActionModal] = useState(null); // { applicant, type:'reject'|'invite' }
  const [actionForm, setActionForm]   = useState({ reject_reason:'', interview_date:'' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await recruitmentApi.getApplicants({ date, platform: platform || undefined });
      setApplicants(r.data || []);
    } catch (e) { setMsg({ type:'error', text: e.message }); }
    finally { setLoading(false); }
  }, [date, platform]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    try {
      await recruitmentApi.createApplicant({ ...addForm, date, target_store_name: storeMap[addForm.target_store_erpid] || '' });
      setMsg({ type:'success', text:'投遞者已新增' });
      setShowAdd(false);
      setAddForm({ name:'', code:'', target_store_erpid:'', platform: addForm.platform });
      load();
    } catch (e) { setMsg({ type:'error', text: e.message }); }
  }

  async function handleAction(e) {
    e.preventDefault();
    const { applicant, type } = actionModal;
    try {
      const body = { status: type === 'reject' ? 'rejected' : 'invited' };
      if (type === 'reject')  body.reject_reason  = actionForm.reject_reason;
      if (type === 'invite')  body.interview_date = actionForm.interview_date;
      await recruitmentApi.updateApplicant(applicant.id, body);
      setMsg({ type:'success', text: type==='reject' ? '已標記婉拒' : '已邀請面試，面試紀錄已建立' });
      setActionModal(null);
      setActionForm({ reject_reason:'', interview_date:'' });
      load();
    } catch (e) { setMsg({ type:'error', text: e.message }); }
  }

  return (
    <div>
      {/* 篩選列 */}
      <div style={{ display:'flex', gap:10, marginBottom:14, alignItems:'center', flexWrap:'wrap' }}>
        <input style={{ ...S.inp, width:150 }} type="date" value={date} onChange={e=>setDate(e.target.value)} />
        <select style={S.sel} value={platform} onChange={e=>setPlatform(e.target.value)}>
          <option value="">全部平台</option>
          <option value="1111">1111</option>
          <option value="104">104</option>
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
                <th style={S.th}>狀態</th>
                <th style={S.th}>面試日期</th>
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
                  <td style={S.td}>{STATUS_BADGE[a.status] || a.status}</td>
                  <td style={S.td}>{a.interview_date ? fmtDate(a.interview_date) : '—'}</td>
                  <td style={S.td}><span style={{ fontSize:12, color:'#9a8878' }}>{a.reject_reason || '—'}</span></td>
                  <td style={S.td}>
                    {a.status === 'pending' && (
                      <div style={{ display:'flex', gap:5 }}>
                        <button style={S.btnSm} onClick={()=>{ setActionModal({applicant:a,type:'invite'}); setActionForm({reject_reason:'',interview_date:today()}); }}>邀請面試</button>
                        <button style={{ ...S.btnSm, color:'#718096' }} onClick={()=>{ setActionModal({applicant:a,type:'reject'}); setActionForm({reject_reason:'',interview_date:''}); }}>婉拒</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 操作 Modal */}
      {actionModal && (
        <div style={S.overlay} onClick={e=>{ if(e.target===e.currentTarget) setActionModal(null); }}>
          <div style={S.modal}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>
              {actionModal.type==='reject' ? '婉拒投遞者' : '邀請面試'}
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
                  <label style={S.label}>面試日期（必填）</label>
                  <input
                    style={S.inp} type="date"
                    value={actionForm.interview_date}
                    onChange={e=>setActionForm(f=>({...f,interview_date:e.target.value}))}
                    required
                  />
                </div>
              )}
              <div style={{ display:'flex', gap:8 }}>
                <button style={S.btnP} type="submit">{actionModal.type==='reject'?'確認婉拒':'確認邀請'}</button>
                <button style={S.btnS} type="button" onClick={()=>setActionModal(null)}>取消</button>
              </div>
            </form>
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
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('pending');
  const [msg, setMsg]               = useState(null);
  const [expanded, setExpanded]     = useState(null);
  const [editForm, setEditForm]     = useState({});
  const [uploading, setUploading]   = useState(false);
  const [smsPhone, setSmsPhone]     = useState({});   // { [interviewId]: phone }
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
    setEditForm({ notes: interview.notes || '', result: interview.result || '' });
  }

  async function handleSave(id) {
    try {
      await recruitmentApi.updateInterview(id, { notes: editForm.notes, result: editForm.result || null });
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
    if (!phone) { setMsg({ type:'error', text:'請輸入手機號碼' }); return; }
    setSmsSending(iv.id);
    try {
      await recruitmentApi.sendSms(iv.id, phone);
      setMsg({ type:'success', text:`簡訊已發送至 ${phone}` });
    } catch (e) { setMsg({ type:'error', text: e.message }); }
    finally { setSmsSending(null); }
  }

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {['pending','pass','fail',''].map(v => (
          <button key={v} style={{ ...S.btnS, ...(filter===v?{background:C.dark,color:'#fff',border:`1px solid ${C.dark}`}:{}) }} onClick={()=>setFilter(v)}>
            {v==='pending'?'待面試':v==='pass'?'已通過':v==='fail'?'未通過':'全部'}
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
                      <td style={S.td}>{fmtDate(ap.interview_date || iv.created_at)}</td>
                      <td style={S.td}>{iv.result ? RESULT_BADGE[iv.result] : <Badge text="待面試" color="#d69e2e" bg="#fffff0" border="#f6e05e" />}</td>
                      <td style={S.td}>{iv.audio_url ? <a href={iv.audio_url} target="_blank" rel="noreferrer" style={{ color:'#2b6cb0', fontSize:12 }}>🎙 播放</a> : <span style={{ color:'#a0aec0', fontSize:12 }}>—</span>}</td>
                      <td style={S.td}>
                        {iv.result === 'pass'
                          ? iv.education_linked
                            ? <Badge text="✅ 已建檔" color="#276749" bg="#f0fff4" border="#9ae6b4" />
                            : <Badge text="待建檔" color="#c53030" bg="#fff5f5" border="#feb2b2" />
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
                              <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                                {['pass','fail',''].map(r => (
                                  <label key={r} style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, cursor:'pointer' }}>
                                    <input type="radio" name={`result-${iv.id}`} value={r} checked={editForm.result===r} onChange={()=>setEditForm(f=>({...f,result:r}))} />
                                    {r==='pass'?'✅ 通過':r==='fail'?'❌ 不通過':'（未決定）'}
                                  </label>
                                ))}
                              </div>
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

                                  {/* 前往教育訓練系統（帶 interview_id 讓對方系統能回呼） */}
                                  <a
                                    href={`${EDUCATION_URL}/new-hire?interview_id=${iv.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ display:'inline-block', padding:'7px 14px', background:'#276749', color:'#fff', borderRadius:6, fontSize:13, textDecoration:'none', marginBottom:10 }}
                                  >
                                    前往教育訓練系統建立新人 →
                                  </a>

                                  {/* 教育系統回呼後：顯示到職連結 + 發 SMS */}
                                  {iv.education_linked && iv.onboarding_url ? (
                                    <div style={{ marginTop:4 }}>
                                      <Badge text="✅ 已建檔" color="#276749" bg="#f0fff4" border="#9ae6b4" />
                                      <div style={{ marginTop:8, marginBottom:6, fontSize:12, color:'#4a5568' }}>
                                        到職連結：
                                        <a href={iv.onboarding_url} target="_blank" rel="noreferrer"
                                          style={{ color:'#2b6cb0', marginLeft:4, wordBreak:'break-all' }}>
                                          {iv.onboarding_url}
                                        </a>
                                      </div>
                                      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                                        <input
                                          style={{ ...S.inp, width:160 }}
                                          type="tel"
                                          placeholder="新人手機（09xxxxxxxx）"
                                          value={smsPhone[iv.id] || ''}
                                          onChange={e => setSmsPhone(p => ({ ...p, [iv.id]: e.target.value }))}
                                        />
                                        <button
                                          style={{ ...S.btnP, background:'#2b6cb0', fontSize:13 }}
                                          onClick={() => handleSendSms(iv)}
                                          disabled={smsSending === iv.id}
                                        >
                                          {smsSending === iv.id ? '發送中...' : '📱 發送到職簡訊'}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      {/* 尚未收到教育系統回呼 → 手動確認 */}
                                      {!iv.education_linked && (
                                        <button style={{ ...S.btnSm, marginTop:4 }} onClick={()=>markEducationLinked(iv.id)}>
                                          ✅ 手動確認已在教訓系統建檔完成
                                        </button>
                                      )}
                                      {iv.education_linked && !iv.onboarding_url && (
                                        <div style={{ fontSize:12, color:'#718096', marginTop:6 }}>
                                          已建檔，等待教育系統回傳到職連結…
                                        </div>
                                      )}
                                    </div>
                                  )}
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
