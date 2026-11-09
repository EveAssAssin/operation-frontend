// pages/reportAi/ReportAiPage.jsx —— 月報 AI（2026-11-09）
// 上：門市多選＋月份（隨每句話送給 AI）；左：對話（AI 開的動作單卡片在訊息下方，按「確認執行」才寫帳）；右：待確認單／待追蹤／筆記／開發需求
// 每則 AI 回覆有 👍／👎／糾正：糾正內容立刻變成 AI 的工作筆記（越用越準）
import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const C = { primary: '#50422d', gold: '#8b6f4e', border: '#e5ddd0', muted: '#8b7d68', ok: '#15803d', warn: '#b45309', danger: '#dc2626', bg: '#faf8f5' };
const KIND_ZH = { post: '開帳', amortize: '分攤', void: '作廢', fixed: '固定支出', ack: '查帳標記', status: '月報狀態', subject: '新增科目' };
const ST_ZH = { pending: '待確認', applied: '已執行', partial: '部分成功', rejected: '已退回', failed: '失敗' };
const ST_COLOR = { pending: C.warn, applied: C.ok, partial: C.warn, rejected: C.muted, failed: C.danger };
const ymNow = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7);
const ymAdd = (ym, n) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
const Btn = ({ kind = 'ghost', small, ...p }) => <button {...p} style={{ background: kind === 'primary' ? C.gold : '#fff', color: kind === 'primary' ? '#fff' : kind === 'danger' ? C.danger : C.primary, border: `1px solid ${kind === 'primary' ? C.gold : C.border}`, borderRadius: 8, padding: small ? '3px 9px' : '7px 12px', fontSize: small ? 12 : 14, cursor: p.disabled ? 'default' : 'pointer', opacity: p.disabled ? 0.5 : 1, whiteSpace: 'nowrap', ...(p.style || {}) }} />;
const Muted = ({ children, style }) => <span style={{ color: C.muted, fontSize: 12, ...(style || {}) }}>{children}</span>;

function OrderCard({ o, onDone }) {
  const [busy, setBusy] = useState(false);
  const act = async (what) => { setBusy(true); try { const r = await api.post(`/report-ai/orders/${o.id}/${what}`); if (what === 'apply' && r.data && r.data.result) { const bad = (Array.isArray(r.data.result) ? r.data.result : []).filter((x) => x.error); if (bad.length) alert('部分沒成功：\n' + bad.map((x) => `${x.store || x.id || ''}：${x.error}`).join('\n')); } onDone && onDone(); } catch (e) { alert(e.message || '失敗'); } finally { setBusy(false); } };
  return <div style={{ border: `1px solid ${C.border}`, borderLeft: `4px solid ${ST_COLOR[o.status] || C.muted}`, borderRadius: 10, padding: 10, background: '#fff', marginTop: 6 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b style={{ fontSize: 13 }}>#{o.id} {KIND_ZH[o.kind] || o.kind}</b><span style={{ fontSize: 12, color: ST_COLOR[o.status] }}>{ST_ZH[o.status] || o.status}</span></div>
    <div style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{o.summary}</div>
    {o.reason && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>原因：{o.reason}</div>}
    <details style={{ fontSize: 11, color: C.muted, marginTop: 4 }}><summary>明細</summary><pre style={{ whiteSpace: 'pre-wrap', margin: 0, maxHeight: 220, overflow: 'auto' }}>{JSON.stringify(o.payload, null, 1)}</pre>{o.result && <pre style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0', color: C.ok }}>{JSON.stringify(o.result, null, 1)}</pre>}</details>
    {o.error && <div style={{ fontSize: 12, color: C.danger, marginTop: 4 }}>{o.error}</div>}
    {o.status === 'pending' && <div style={{ display: 'flex', gap: 6, marginTop: 6 }}><Btn small kind="primary" disabled={busy} onClick={() => act('apply')}>✓ 確認執行</Btn><Btn small disabled={busy} onClick={() => act('reject')}>退回</Btn></div>}
    {o.decided_by && <Muted style={{ display: 'block', marginTop: 4 }}>{o.decided_by}・{new Date(o.decided_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</Muted>}
  </div>;
}

function Feedback({ m, scope }) {
  const [state, setState] = useState(m.fb || null); const [open, setOpen] = useState(false); const [note, setNote] = useState('');
  if (!m.run_id) return null;
  const send = async (verdict, n) => { try { await api.post('/report-ai/feedback', { run_id: m.run_id, verdict, note: n || undefined, scope }); setState(verdict); setOpen(false); } catch (e) { alert(e.message || '失敗'); } };
  return <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
    <span onClick={() => send('approved')} style={{ cursor: 'pointer', opacity: state === 'approved' ? 1 : 0.5 }} title="回答得好">👍</span>
    <span onClick={() => setOpen(!open)} style={{ cursor: 'pointer', opacity: state && state !== 'approved' ? 1 : 0.5 }} title="不對／要糾正">👎</span>
    {state && <Muted>{state === 'approved' ? '已記為好範例' : '已記成筆記，下次會照做'}</Muted>}
    {open && <div style={{ display: 'flex', gap: 4, flex: 1 }}><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="哪裡不對、以後該怎麼做（會直接變成 AI 的筆記）" style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 8, padding: 4, fontSize: 12 }} /><Btn small onClick={() => note.trim() && send('edited', note.trim())}>送出糾正</Btn></div>}
  </div>;
}

export default function ReportAiPage() {
  const { user } = useAuth();
  const [stores, setStores] = useState([]); const [sel, setSel] = useState([]); const [ym, setYm] = useState(ymAdd(ymNow(), -1)); const [pick, setPick] = useState(false); const [q, setQ] = useState('');
  const [chats, setChats] = useState([]); const [chat, setChat] = useState(null); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [side, setSide] = useState('orders'); const [orders, setOrders] = useState([]); const [issues, setIssues] = useState([]); const [notes, setNotes] = useState([]); const [needs, setNeeds] = useState([]);
  const endRef = useRef(null);
  const loadSide = () => { api.get('/report-ai/orders', { params: { status: 'pending' } }).then((r) => setOrders(r.data || [])).catch(() => {}); api.get('/report-ai/issues').then((r) => setIssues(r.data || [])).catch(() => {}); api.get('/report-ai/dev-needs').then((r) => setNeeds(r.data || [])).catch(() => {}); };
  const loadNotes = () => api.get('/report-ai/notes').then((r) => setNotes(r.data || [])).catch(() => {});
  const open = (id) => api.get(`/report-ai/chats/${id}`).then((r) => { setChat(r.data); if (r.data.stores && r.data.stores.length) setSel(r.data.stores); if (r.data.ym) setYm(r.data.ym); }).catch((e) => setErr(e.message));
  useEffect(() => { api.get('/report-ai/stores').then((r) => setStores(r.data || [])); api.get('/report-ai/chats').then((r) => { setChats(r.data || []); if (r.data && r.data[0]) open(r.data[0].id); }); loadSide(); }, []);
  useEffect(() => { endRef.current && endRef.current.scrollIntoView({ behavior: 'smooth' }); }, [chat]);
  const send = async () => {
    const m = msg.trim(); if (!m || busy) return; setBusy(true); setErr(''); setMsg('');
    setChat((c) => ({ ...(c || { messages: [], orders: [] }), messages: [...((c && c.messages) || []), { role: 'user', content: m, stores: sel, ym }, { role: 'assistant', content: '…思考中（查帳可能要 20～60 秒）', pending: true }] }));
    try { const r = await api.post('/report-ai/chat', { chat_id: chat && chat.id, stores: sel, ym, message: m }); await open(r.data.chat_id); api.get('/report-ai/chats').then((x) => setChats(x.data || [])); loadSide(); }
    catch (e) { setErr(e.message || '失敗'); setChat((c) => ({ ...c, messages: (c.messages || []).filter((x) => !x.pending) })); }
    finally { setBusy(false); }
  };
  const orderMap = Object.fromEntries(((chat && chat.orders) || []).map((o) => [o.id, o]));
  const nameOf = (id) => (stores.find((s) => s.erpid === id) || {}).name || id;
  const scope = sel.length === 1 ? `store:${sel[0]}` : 'global';
  const filtered = stores.filter((s) => !q || s.name.includes(q));
  return <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 12, height: 'calc(100vh - 48px)' }}>
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ position: 'relative' }}>
          <Btn small onClick={() => setPick(!pick)}>🏪 門市：{sel.length ? (sel.length <= 3 ? sel.map(nameOf).join('、') : `${sel.length} 家`) : '未選'} ▾</Btn>
          {pick && <div style={{ position: 'absolute', zIndex: 10, top: 30, left: 0, width: 300, maxHeight: 360, overflow: 'auto', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, boxShadow: '0 6px 20px rgba(0,0,0,.12)' }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="找門市" style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 6, padding: 4, fontSize: 12 }} /><Btn small onClick={() => setSel(filtered.map((s) => s.erpid))}>全選</Btn><Btn small onClick={() => setSel([])}>清除</Btn></div>
            {filtered.map((s) => <label key={s.erpid} style={{ display: 'block', fontSize: 13, padding: '2px 0' }}><input type="checkbox" checked={sel.includes(s.erpid)} onChange={(e) => setSel(e.target.checked ? [...sel, s.erpid] : sel.filter((x) => x !== s.erpid))} /> {s.name} <Muted>{s.erpid}</Muted></label>)}
            <Btn small kind="primary" onClick={() => setPick(false)} style={{ marginTop: 6 }}>完成</Btn>
          </div>}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Btn small onClick={() => setYm(ymAdd(ym, -1))}>‹</Btn><b>{ym}</b><Btn small onClick={() => setYm(ymAdd(ym, 1))}>›</Btn></div>
        <Btn small onClick={() => { setChat(null); setErr(''); }}>＋ 新對話</Btn>
        <select value={chat ? chat.id : ''} onChange={(e) => e.target.value && open(Number(e.target.value))} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 4, fontSize: 12, maxWidth: 220 }}><option value="">歷史對話…</option>{chats.map((c) => <option key={c.id} value={c.id}>{c.ym || ''} {c.title}</option>)}</select>
        <Muted>選好門市和月份再問；AI 不會直接寫帳，會開「動作單」等你確認。</Muted>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
        {!chat && <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.8 }}>例：<br />「這三家店 10 月哪裡不合理？」「十甲的鏡片為什麼比上月多，是哪幾張單？」「哪幾家店還沒有房租／薪資？」<br />「幫我開服務費每間店 3,000，9 月帳，分期 9、10 月」「北屯從 11 月起房租改 35,000」「這筆重複的雜費作廢」<br />「十甲那筆鏡片差額等廠商回覆，先掛著」「以後電費有估算數不用提醒我，後甲是兩個月繳一次」</div>}
        {chat && (chat.messages || []).map((m, i) => <div key={i} style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
          {m.role === 'user' && m.stores && m.stores.length > 0 && <Muted style={{ marginBottom: 2 }}>🏪 {m.stores.map(nameOf).join('、')}・{m.ym}</Muted>}
          <div style={{ maxWidth: '88%', background: m.role === 'user' ? C.gold : '#f6f2ea', color: m.role === 'user' ? '#fff' : C.primary, borderRadius: 12, padding: '8px 12px', fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{m.content}</div>
          {m.drafts && m.drafts.length > 0 && m.drafts.map((d, k) => <div key={k} style={{ width: '88%', marginTop: 6, border: `1px dashed ${C.border}`, borderRadius: 10, padding: 8, background: '#fff', fontSize: 13 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>✉️ 給 {d.to} 的訊息草稿</b><Btn small onClick={() => navigator.clipboard.writeText(d.text)}>複製</Btn></div><div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{d.text}</div></div>)}
          {m.orders && m.orders.length > 0 && <div style={{ width: '88%' }}>{m.orders.map((id) => orderMap[id] && <OrderCard key={id} o={orderMap[id]} onDone={() => { open(chat.id); loadSide(); }} />)}</div>}
          {m.role === 'assistant' && !m.pending && <Feedback m={m} scope={scope} />}
        </div>)}
        <div ref={endRef} />
      </div>
      {err && <div style={{ color: C.danger, fontSize: 12, marginTop: 4 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} rows={2} placeholder="問月報、查帳，或說要開什麼帳（Enter 送出、Shift+Enter 換行）" style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, fontSize: 14, resize: 'none' }} />
        <Btn kind="primary" disabled={busy} onClick={send}>{busy ? '想中…' : '送出'}</Btn>
      </div>
    </div>
    <div style={{ overflowY: 'auto', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        <Btn small kind={side === 'orders' ? 'primary' : 'ghost'} onClick={() => setSide('orders')}>待確認 {orders.length}</Btn>
        <Btn small kind={side === 'issues' ? 'primary' : 'ghost'} onClick={() => setSide('issues')}>待追蹤 {issues.length}</Btn>
        <Btn small kind={side === 'notes' ? 'primary' : 'ghost'} onClick={() => { setSide('notes'); loadNotes(); }}>AI 筆記</Btn>
        <Btn small kind={side === 'needs' ? 'primary' : 'ghost'} onClick={() => setSide('needs')}>開發需求 {needs.filter((n) => n.status === 'open').length}</Btn>
      </div>
      {side === 'orders' && (orders.length ? orders.map((o) => <OrderCard key={o.id} o={o} onDone={() => { loadSide(); chat && open(chat.id); }} />) : <Muted>沒有待確認的動作單</Muted>)}
      {side === 'issues' && <div>
        <Btn small onClick={async () => { const s = prompt('要追蹤什麼？（一句話）'); if (!s) return; await api.post('/report-ai/issues', { scope: scope, ym, kind: 'follow', summary: s }); loadSide(); }} style={{ marginBottom: 6 }}>＋ 加一件待追蹤</Btn>
        {issues.length ? issues.map((i) => <div key={i.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: '#fff', marginBottom: 6, fontSize: 13 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>#{i.id} {i.kind}</b><Muted>{i.scope.startsWith('store:') ? nameOf(i.scope.slice(6)) : i.scope}{i.ym ? '・' + i.ym : ''}・{i.status}</Muted></div><div style={{ marginTop: 2 }}>{i.summary}</div>{i.due && <Muted>到期 {i.due}</Muted>}<div style={{ display: 'flex', gap: 4, marginTop: 4 }}><Btn small onClick={() => api.patch(`/report-ai/issues/${i.id}`, { status: 'resolved', note: '人工結案' }).then(loadSide)}>結案</Btn>{i.status !== 'watching' && <Btn small onClick={() => api.patch(`/report-ai/issues/${i.id}`, { status: 'watching' }).then(loadSide)}>持續看</Btn>}</div></div>) : <Muted>沒有待追蹤</Muted>}
      </div>}
      {side === 'notes' && (notes.length ? notes.map((n, k) => <div key={k} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: '#fff', marginBottom: 6, fontSize: 12 }}><b>[{n.scope.startsWith('store:') ? nameOf(n.scope.slice(6)) : n.scope} / {n.key}]</b> <Muted>{String(n.updated_at).slice(0, 10)}・{n.updated_by}</Muted><div style={{ whiteSpace: 'pre-wrap', marginTop: 2 }}>{n.content}</div></div>) : <Muted>AI 還沒有筆記；它會在對話中自己累積，你的糾正也會進來。</Muted>)}
      {side === 'needs' && (needs.length ? needs.map((n) => <div key={n.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: '#fff', marginBottom: 6, fontSize: 13 }}><b>{n.title}</b> <Muted>{n.status}</Muted><div style={{ fontSize: 12, whiteSpace: 'pre-wrap', marginTop: 2 }}>{n.text}</div>{user && user.role === 'super_admin' && n.status === 'open' && <div style={{ display: 'flex', gap: 4, marginTop: 4 }}><Btn small onClick={() => api.put(`/report-ai/dev-needs/${n.id}`, { status: 'planned' }).then(loadSide)}>排進開發</Btn><Btn small onClick={() => api.put(`/report-ai/dev-needs/${n.id}`, { status: 'rejected' }).then(loadSide)}>不做</Btn></div>}</div>) : <Muted>沒有開發需求</Muted>)}
    </div>
  </div>;
}
