// 人員「查規範」手機頁：/rules?app_number=XXXXXXXX（也可帶 &reg=規範編號、&q=關鍵字）
//   問 AI（只根據規範回答、附條文出處）／搜尋／最近更新／我的扣分／全部規範
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { regulationPublicApi as api, regulationProposeApi } from '../../services/api';
import { DocView, fmtTime, StatusBadge, RecentChange } from './ui';
import EditorView from './EditorView';
import { RegApiCtx } from './regApi';

const LS_KEY = 'rules_app_number';
const C = { bg: '#f6f2ec', card: '#fff', ink: '#2d2416', mid: '#6b5640', line: '#e6dccd', brand: '#50422d', ok: '#2f855a', bad: '#c53030' };
const card = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12 };
const input = { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', fontSize: 16, fontFamily: 'inherit', background: '#fff' };
const btnP = { border: 'none', background: C.brand, color: '#fff', borderRadius: 10, padding: '10px 14px', fontSize: 15, fontWeight: 700, cursor: 'pointer' };
const chip = { display: 'inline-block', fontFamily: 'ui-monospace,Consolas,monospace', fontSize: 12, background: '#fff3bf', border: '1px solid #ffd43b', color: '#7a5b00', borderRadius: 8, padding: '0 6px', margin: '0 2px', cursor: 'pointer' };

export default function RulesPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [app, setApp] = useState(() => (params.get('app_number') || localStorage.getItem(LS_KEY) || '').trim());
  const [me, setMe] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState(() => { const t = params.get('tab'); if (['ask', 'search', 'recent', 'mine', 'all', 'propose'].includes(t)) return t; return params.get('q') ? 'search' : 'ask'; }); // ?tab=search＝營運工具「規範查詢」直接進搜尋（2026-10-28）
  const [viewer, setViewer] = useState(params.get('reg') ? { id: Number(params.get('reg')), code: params.get('code') } : null);

  const login = useCallback(async (a) => {
    setErr('');
    const r = await api.verify(a);
    if (!r?.success) { setErr(r?.message || '確認身分失敗'); setMe(null); localStorage.removeItem(LS_KEY); return; }
    localStorage.setItem(LS_KEY, a); setMe(r.data);
  }, []);
  useEffect(() => { if (app) login(app); }, []); // eslint-disable-line
  // 提出新增／修改規範：左手權限／稱號符合才有（2026-10-28）
  const papi = useMemo(() => (me ? regulationProposeApi(app) : null), [me, app]);
  const [prop, setProp] = useState(null);       // { can, reason, matched, meta, mine }
  const [editing, setEditing] = useState(null); // versionId
  const reloadProp = useCallback(() => { if (papi) papi.me().then(r => setProp(r?.success ? r.data : { can: false, reason: r?.message || '讀不到權限' })); }, [papi]);
  useEffect(() => { reloadProp(); }, [reloadProp]);
  const startEdit = async (regId) => {
    const r = await papi.startDraft(regId);
    if (!r?.success) { window.alert(r?.message || '開始修改失敗'); return; }
    setViewer(null); setEditing(r.data.id);
  };

  if (!me) return <Login app={app} setApp={setApp} err={err} onLogin={() => login(app.trim())} />;

  const open = (id, code) => setViewer({ id: Number(id), code });
  const TABS = [['ask', '💬', '問規範'], ['recent', '🆕', '最近更新'], ['mine', '📌', '我的扣分'], ['all', '📚', '全部']];   // 關鍵字搜尋已併進「問規範」（10-28）
  if (prop?.can || tab === 'propose') TABS.push(['propose', '✏️', '提出修改']);
  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: '-apple-system,"Segoe UI","Noto Sans TC","Microsoft JhengHei",sans-serif', color: C.ink, paddingBottom: 72 }}>
      <div style={{ background: C.brand, color: '#fff', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 5 }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>樂活規範</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>{me.name}・{me.store_name}{me.jobtitle ? `・${me.jobtitle}` : ''}
          <span onClick={() => { localStorage.removeItem(LS_KEY); setMe(null); setApp(''); }} style={{ marginLeft: 8, textDecoration: 'underline', cursor: 'pointer' }}>換人</span></div>
      </div>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 12 }}>
        {(tab === 'ask' || tab === 'search') && <Ask app={app} me={me} open={open} initialMode={tab === 'search' || params.get('q') || !me.ai ? 'search' : 'ask'} initialQ={params.get('q') || ''} />}
        {tab === 'recent' && <Recent app={app} open={open} />}
        {tab === 'mine' && <Mine app={app} open={open} />}
        {tab === 'all' && <All app={app} open={open} />}
        {tab === 'propose' && <Propose app={app} prop={prop} open={open} onEdit={setEditing} reload={reloadProp} papi={papi} />}
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: `1px solid ${C.line}`, display: 'flex', zIndex: 6, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map(([k, i, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, border: 'none', background: 'none', padding: '8px 0 6px', cursor: 'pointer', color: (tab === k || (k === 'ask' && tab === 'search')) ? C.brand : '#a0aec0', fontWeight: (tab === k || (k === 'ask' && tab === 'search')) ? 800 : 500 }}>
            <div style={{ fontSize: 20 }}>{i}</div><div style={{ fontSize: 11 }}>{l}</div>
          </button>
        ))}
      </div>
      {viewer && <Viewer app={app} id={viewer.id} code={viewer.code} onClose={() => setViewer(null)} onPropose={prop?.can ? startEdit : null} />}
      {editing && papi && (
        <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 30, overflow: 'auto', padding: 8 }}>
          <div style={{ fontSize: 12, color: C.mid, margin: '2px 4px 8px' }}>改完按「送審」，審核人同意後才會上線；送審前都只有你看得到。</div>
          <RegApiCtx.Provider value={papi}>
            <EditorView stack versionId={editing} roles={prop?.meta?.roles || []} categories={prop?.meta?.categories || []} aiEnabled={!!prop?.meta?.ai}
              onClose={() => { setEditing(null); reloadProp(); }}
              onSubmitted={() => { window.alert('已送審，審核人同意後會通知你'); setEditing(null); reloadProp(); setTab('propose'); }} />
          </RegApiCtx.Provider>
        </div>
      )}
    </div>
  );
}

function Login({ app, setApp, err, onLogin }) {
  return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: '-apple-system,"Noto Sans TC","Microsoft JhengHei",sans-serif' }}>
      <div style={{ ...card, padding: 20, width: '100%', maxWidth: 360 }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>樂活規範</div>
        <div style={{ fontSize: 13, color: C.mid, marginBottom: 14 }}>請輸入你的 APP 編號（從 App 進來會自動帶入）</div>
        <input style={input} inputMode="numeric" value={app} onChange={e => setApp(e.target.value)} placeholder="APP 編號" onKeyDown={e => e.key === 'Enter' && onLogin()} />
        {err && <div style={{ color: C.bad, fontSize: 13, marginTop: 8 }}>{err}</div>}
        <button style={{ ...btnP, width: '100%', marginTop: 12 }} onClick={onLogin}>進入</button>
      </div>
    </div>
  );
}

/** 把答案裡的【條文代碼】變成可點的標籤 */
function AnswerText({ text, cites, open }) {
  const map = new Map((cites || []).map(c => [c.code, c]));
  return (
    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>
      {String(text || '').split(/(【[^】]+】)/g).map((p, i) => {
        const m = p.match(/^【([^】]+)】$/);
        if (m && map.has(m[1])) return <span key={i} style={chip} onClick={() => open(map.get(m[1]).regulation_id, m[1])}>{m[1]}</span>;
        return p;
      })}
    </div>
  );
}

function Ask({ app, me, open, initialMode = 'ask', initialQ = '' }) {
  const [mode, setMode] = useState(me.ai ? initialMode : 'search');   // ask＝問 AI、search＝關鍵字找標題／條文
  const modeBar = (
    <div data-yaya="rules-mode" style={{ display: 'flex', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: 3, marginBottom: 10 }}>
      {[['ask', '💬 問 AI'], ['search', '🔍 關鍵字查詢']].map(([k, l]) => (
        <button key={k} disabled={k === 'ask' && !me.ai} onClick={() => setMode(k)} style={{ flex: 1, border: 'none', borderRadius: 9, padding: '8px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          background: mode === k ? C.brand : 'transparent', color: mode === k ? '#fff' : (k === 'ask' && !me.ai ? '#cbd5e0' : C.mid) }}>{l}</button>
      ))}
    </div>
  );
  if (mode === 'search') return <div>{modeBar}<Search app={app} open={open} initial={initialQ} /></div>;
  return <AskAi app={app} me={me} open={open} modeBar={modeBar} />;
}

function AskAi({ app, me, open, modeBar }) {
  const [q, setQ] = useState('');
  const [thread, setThread] = useState([]);
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [thread, busy]);
  const send = async (text) => {
    const question = (text ?? q).trim(); if (!question || busy) return;
    setQ(''); setBusy(true);
    const history = thread.filter(t => t.a).slice(-3).map(t => ({ q: t.q, a: t.a }));
    setThread(t => [...t, { q: question }]);
    const r = await api.ask(app, question, history);
    setBusy(false);
    setThread(t => t.map((x, i) => (i === t.length - 1 ? (r?.success ? { ...x, a: r.data.answer, cites: r.data.citations, found: r.data.found, id: r.data.id } : { ...x, err: r?.message || '失敗' }) : x)));
  };
  const fb = async (i, helpful) => {
    const t = thread[i]; if (!t.id) return;
    await api.feedback(app, t.id, helpful);
    setThread(th => th.map((x, k) => (k === i ? { ...x, fb: helpful } : x)));
  };
  return (
    <div>
      {modeBar}
      {!thread.length && (
        <div style={{ ...card, padding: 14, marginBottom: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>有規範問題，直接問我</div>
          <div style={{ fontSize: 13, color: C.mid, marginBottom: 10 }}>我只會根據公司規範回答，每個重點都附條文出處，點黃色代碼可以看原文。規範沒寫到的，我會直接說沒有。</div>
          {['客人沒帶取件單，可以交件嗎？', '零用金短少要怎麼處理？', '結帳可以在幾點做？'].map(s => (
            <div key={s} onClick={() => send(s)} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: '8px 10px', marginTop: 6, cursor: 'pointer', fontSize: 14 }}>{s}</div>
          ))}
        </div>
      )}
      {thread.map((t, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><div style={{ background: C.brand, color: '#fff', borderRadius: '14px 14px 2px 14px', padding: '8px 12px', maxWidth: '85%' }}>{t.q}</div></div>
          <div style={{ ...card, padding: 12, marginTop: 6, borderRadius: '14px 14px 14px 2px' }}>
            {!t.a && !t.err && <div style={{ color: C.mid }}>查規範中…</div>}
            {t.err && <div style={{ color: C.bad }}>{t.err}</div>}
            {t.a && (
              <>
                {!t.found && <div style={{ fontSize: 12, background: '#fffaf0', color: '#975a16', borderRadius: 8, padding: '4px 8px', marginBottom: 6 }}>⚠ 規範裡沒有找到明確答案，請以主管說明為準</div>}
                <AnswerText text={t.a} cites={t.cites} open={open} />
                {t.cites?.length > 0 && (
                  <div style={{ marginTop: 8, borderTop: `1px dashed ${C.line}`, paddingTop: 6 }}>
                    <div style={{ fontSize: 12, color: C.mid }}>出處</div>
                    {t.cites.map(c => (
                      <div key={c.code} onClick={() => open(c.regulation_id, c.code)} style={{ fontSize: 13, padding: '5px 0', cursor: 'pointer', borderBottom: `1px solid ${C.line}` }}>
                        <span style={chip}>{c.code}</span> <b>{c.title}</b> {c.display_no}
                        <div style={{ color: C.mid, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.text}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 8, fontSize: 13, color: C.mid }}>
                  {t.fb === undefined ? <>這個回答有幫助嗎？ <span style={{ cursor: 'pointer', marginLeft: 6 }} onClick={() => fb(i, true)}>👍 有</span> <span style={{ cursor: 'pointer', marginLeft: 10 }} onClick={() => fb(i, false)}>👎 沒有</span></>
                    : t.fb ? '謝謝回饋 👍' : '謝謝，我們會檢討這條規範有沒有寫清楚'}
                </div>
              </>
            )}
          </div>
        </div>
      ))}
      <div ref={end} />
      <div style={{ position: 'sticky', bottom: 70, display: 'flex', gap: 6, background: C.bg, paddingTop: 6 }}>
        <input style={input} value={q} onChange={e => setQ(e.target.value)} placeholder="輸入你的問題" onKeyDown={e => e.key === 'Enter' && send()} />
        <button style={btnP} disabled={busy || !q.trim()} onClick={() => send()}>{busy ? '…' : '問'}</button>
      </div>
    </div>
  );
}

const hl = (text, q) => {
  if (!q) return text;
  const parts = String(text).split(q);
  return parts.flatMap((p, i) => (i ? [<mark key={i} style={{ background: '#fff3bf' }}>{q}</mark>, p] : [p]));
};

function Search({ app, open, initial }) {
  const [q, setQ] = useState(initial);
  const [all, setAll] = useState(false);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const s = q.replace(/[㄀-ㄯˇˊˋ˙]/g, '').trim();
    if (!s) { setRes(null); return; }
    setBusy(true);
    const t = setTimeout(async () => { const r = await api.search(app, s, all); setRes(r?.success ? r.data : { regulations: [], clauses: [], err: r?.message }); setBusy(false); }, 350);
    return () => clearTimeout(t);
  }, [q, all, app]);
  const kw = q.trim();
  return (
    <div>
      <input style={input} value={q} onChange={e => setQ(e.target.value)} placeholder="輸入關鍵字，例如：結帳、零用金、交件" autoFocus />
      <label style={{ fontSize: 12, color: C.mid, display: 'flex', gap: 6, alignItems: 'center', margin: '6px 2px' }}>
        <input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> 也查不適用我身分的規範
      </label>
      {busy && <div style={{ color: C.mid, padding: 8 }}>搜尋中…</div>}
      {res?.err && <div style={{ color: C.bad }}>{res.err}</div>}
      {res && !busy && (
        <>
          {res.regulations.length > 0 && (
            <div style={{ ...card, marginTop: 6 }}>
              <div style={{ padding: '8px 12px', fontSize: 12, color: C.mid }}>規範名稱（{res.regulations.length}）</div>
              {res.regulations.map(r => (
                <div key={r.id} onClick={() => open(r.id)} style={{ padding: '10px 12px', borderTop: `1px solid ${C.line}`, cursor: 'pointer' }}>
                  <b>{hl(r.title, kw)}</b><div style={{ fontSize: 12, color: C.mid }}>{r.category}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ ...card, marginTop: 10 }}>
            <div style={{ padding: '8px 12px', fontSize: 12, color: C.mid }}>條文（{res.clauses.length}{res.clauses.length >= 80 ? '，只顯示前 80 條，請再縮小關鍵字' : ''}）</div>
            {res.clauses.map(c => (
              <div key={c.code} onClick={() => open(c.regulation_id, c.code)} style={{ padding: '10px 12px', borderTop: `1px solid ${C.line}`, cursor: 'pointer' }}>
                <div style={{ fontSize: 12 }}><span style={chip}>{c.code}</span> <b>{c.regulations?.title}</b> {c.display_no}{c.penalty != null ? <span style={{ color: C.bad }}>　扣 {c.penalty}</span> : ''}</div>
                <div style={{ fontSize: 14, marginTop: 3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{hl(c.text, kw)}</div>
              </div>
            ))}
            {!res.clauses.length && <div style={{ padding: 14, color: '#a0aec0' }}>沒有找到條文，換個說法試試，或到「💬 問 AI」直接問</div>}
          </div>
        </>
      )}
    </div>
  );
}

function Recent({ app, open }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.recent(app, 60).then(r => setRows(r?.success ? r.data : [])); }, [app]);
  if (!rows) return <div style={{ color: C.mid, padding: 10 }}>載入中…</div>;
  if (!rows.length) return <div style={{ ...card, padding: 16, color: C.mid }}>最近 60 天沒有跟你有關的規範更新。</div>;
  const now = Date.now();
  return rows.map((r, i) => {
    const started = new Date(r.penalty_from).getTime() <= now;
    return (
      <div key={i} style={{ ...card, padding: 12, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <b onClick={() => open(r.regulation_id)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>{r.title}</b>
          <span style={{ fontSize: 12, color: C.mid, whiteSpace: 'nowrap' }}>第 {r.version} 版</span>
        </div>
        <div style={{ fontSize: 12, marginTop: 2, color: started ? C.mid : C.bad, fontWeight: started ? 400 : 700 }}>
          {fmtTime(r.published_at)} 發佈・{started ? '已開始' : `${new Date(r.penalty_from).toLocaleDateString('zh-TW')} 起`}適用扣分
        </div>
        {r.summary?.length > 0 && <ul style={{ margin: '6px 0', paddingLeft: 18, fontSize: 14 }}>{r.summary.map((s, k) => <li key={k}>{s}</li>)}</ul>}
        {r.changes.slice(0, 8).map((c, k) => (
          <div key={k} onClick={() => r.is_current && c.kind !== 'del' && open(r.regulation_id, c.code)} style={{ fontSize: 13, borderLeft: `3px solid ${c.kind === 'add' ? '#38a169' : c.kind === 'del' ? C.bad : '#d69e2e'}`, padding: '3px 8px', margin: '6px 0', cursor: 'pointer' }}>
            <span style={chip}>{c.code}</span> {c.kind === 'add' ? '新增' : c.kind === 'del' ? '刪除' : '修改'}
            {c.old && c.kind !== 'add' && <div style={{ color: '#9b2c2c', textDecoration: 'line-through' }}>{c.old}</div>}
            {c.new && c.kind !== 'del' && <div style={{ color: '#22543d' }}>{c.new}</div>}
          </div>
        ))}
        {r.changes.length > 8 && <div style={{ fontSize: 12, color: C.mid }}>還有 {r.changes.length - 8} 處，點標題看全文</div>}
      </div>
    );
  });
}

function Mine({ app, open }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.myDeductions(app).then(r => setRows(r?.success ? r.data : [])); }, [app]);
  if (!rows) return <div style={{ color: C.mid, padding: 10 }}>載入中…</div>;
  if (!rows.length) return <div style={{ ...card, padding: 16, color: C.mid }}>目前沒有引用條文的扣分紀錄 👍<div style={{ fontSize: 12, marginTop: 4 }}>（規範系統上線前的扣分請到 MAP 查詢）</div></div>;
  return rows.map(d => (
    <div key={d.id} onClick={() => open(d.regulation_id, d.clause_code)} style={{ ...card, padding: 12, marginBottom: 10, cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <b style={{ color: d.score < 0 ? C.bad : C.ok, fontSize: 18 }}>{d.score} 分</b>
        <span style={{ fontSize: 12, color: C.mid }}>{d.status === 'pending' ? '審核中' : '已生效'}・{d.incident_date || fmtTime(d.created_at)}</span>
      </div>
      <div style={{ fontSize: 13, marginTop: 4 }}><span style={chip}>{d.clause_code}</span> {d.regulation_title}（第 {d.version} 版）</div>
      <div style={{ fontSize: 14, marginTop: 4 }}>{d.clause_text}</div>
      {d.note && <div style={{ fontSize: 13, color: C.mid, marginTop: 4 }}>說明：{d.note}</div>}
    </div>
  ));
}

function All({ app, open }) {
  const [rows, setRows] = useState(null);
  const [all, setAll] = useState(false);
  const [openCat, setOpenCat] = useState(null);
  useEffect(() => { setRows(null); api.list(app, all).then(r => setRows(r?.success ? r.data : [])); }, [app, all]);
  const groups = useMemo(() => {
    const m = new Map(); (rows || []).forEach(r => { const k = r.category || '其他'; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-Hant'));
  }, [rows]);
  return (
    <div>
      <label style={{ fontSize: 12, color: C.mid, display: 'flex', gap: 6, alignItems: 'center', margin: '0 2px 8px' }}>
        <input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> 顯示不適用我身分的規範
      </label>
      {!rows && <div style={{ color: C.mid }}>載入中…</div>}
      {groups.map(([g, list]) => (
        <div key={g} style={{ ...card, marginBottom: 8 }}>
          <div onClick={() => setOpenCat(openCat === g ? null : g)} style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontWeight: 700 }}>
            <span>{g}</span><span style={{ color: C.mid, fontWeight: 400 }}>{list.length} ›</span>
          </div>
          {openCat === g && list.map(r => (
            <div key={r.id} onClick={() => open(r.id)} style={{ padding: '10px 12px 10px 20px', borderTop: `1px solid ${C.line}`, cursor: 'pointer', fontSize: 14 }}>{r.title}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Viewer({ app, id, code, onClose, onPropose }) {
  const [data, setData] = useState(null);
  const [mark, setMark] = useState(true);
  const [err, setErr] = useState('');
  useEffect(() => {
    api.regulation(app, id).then(r => (r?.success ? setData(r.data) : setErr(r?.message || '讀取失敗')));
  }, [app, id]);
  useEffect(() => {
    if (!data || !code) return;
    setTimeout(() => document.getElementById(`c-${code}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  }, [data, code]);
  const d = data?.doc, r = data?.regulation;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 20, overflow: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, background: C.brand, color: '#fff', padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', zIndex: 2 }}>
        <span onClick={onClose} style={{ fontSize: 22, cursor: 'pointer' }}>‹</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r?.title || '載入中…'}</div>
          {r && <div style={{ fontSize: 11, opacity: 0.85 }}>規範 {r.id}・第 {r.current_version} 版・{fmtTime(data.published_at)}</div>}
        </div>
        {onPropose && r && <button data-yaya="rules-propose-edit" onClick={() => onPropose(r.id)} style={{ border: '1px solid #fff', background: 'transparent', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>✏️ 提出修改</button>}
      </div>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '8px 12px 40px', fontSize: 15 }}>
        {err && <div style={{ color: C.bad }}>{err}</div>}
        {d && (
          <>
            {(d.summary || d.scenario) && (
              <div style={{ background: '#fcfaf6', border: `1px solid ${C.line}`, borderRadius: 10, padding: '8px 12px', fontSize: 14, marginTop: 6 }}>
                {d.summary && <div><b>摘要：</b>{d.summary}</div>}
                {d.scenario && <div><b>什麼時候用：</b>{d.scenario}</div>}
              </div>
            )}
            <RecentChange rc={data.recent_change} mark={mark} onToggleMark={setMark} />
            <DocView doc={d} compact highlight={{ ...(mark ? Object.fromEntries((data.recent_change?.codes || []).map(c => [c, 'mod'])) : {}), ...(code ? { [code]: 'focus' } : {}) }} />
            <div style={{ fontSize: 12, color: C.mid, marginTop: 14 }}>每一條都可能被引用扣分；沒有另外標扣分的，依規範預設分數（{r.score}）。</div>
          </>
        )}
      </div>
    </div>
  );
}

// ── 提出新增／修改規範（左手權限／稱號符合才可以；送審後審核人同意才上線）──
function Propose({ app, prop, open, onEdit, reload, papi }) {
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState(null);
  useEffect(() => {
    const s = q.trim(); if (!s) { setHits(null); return; }
    const t = setTimeout(() => api.search(app, s, true).then(r => setHits(r?.success ? r.data.regulations : [])), 350);
    return () => clearTimeout(t);
  }, [q, app]);
  if (!prop) return <div style={{ color: C.mid }}>讀取權限中…</div>;
  if (!prop.can) return <div style={{ ...card, padding: 14, fontSize: 14 }}>🔒 {prop.reason || '你目前沒有提出新增或修改規範的權限'}<div style={{ fontSize: 12, color: C.mid, marginTop: 6 }}>權限依左手稱號判斷，取得稱號後約 10 分鐘生效。</div></div>;
  const create = async () => {
    if (!title.trim()) { window.alert('請填規範標題'); return; }
    setBusy(true);
    const r = await papi.newRegulation({ title: title.trim(), category: cat.trim() });
    setBusy(false);
    if (!r?.success) { window.alert(r?.message || '建立失敗'); return; }
    setTitle(''); setCat(''); onEdit(r.data.id); reload();
  };
  const edit = async (id) => {
    const r = await papi.startDraft(id);
    if (!r?.success) { window.alert(r?.message || '開始修改失敗'); return; }
    onEdit(r.data.id);
  };
  const stHint = { draft: '還沒送審，點進去繼續改', returned: '被退回，點進去修改後再送審', pending: '等審核人審核', approved: '已上線', discarded: '已捨棄' };
  return (
    <div>
      <div data-yaya="rules-propose-head" style={{ ...card, padding: 12, fontSize: 13, color: C.mid, marginBottom: 10 }}>
        你可以提出新增或修改規範。改好按「送審」，<b style={{ color: C.ink }}>審核人同意後才會上線</b>，結果會推播通知你。
        {prop.matched?.length > 0 && <div style={{ marginTop: 4, fontSize: 12 }}>依據：{prop.matched.join('、')}</div>}
      </div>

      <div data-yaya="rules-propose-edit-search" style={{ ...card, padding: 12, marginBottom: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>修改現有規範</div>
        <input style={input} value={q} onChange={e => setQ(e.target.value)} placeholder="輸入規範標題關鍵字" />
        {hits && hits.length === 0 && <div style={{ fontSize: 13, color: C.mid, marginTop: 6 }}>找不到標題有這個字的規範</div>}
        {(hits || []).map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${C.line}` }}>
            <span onClick={() => open(r.id)} style={{ flex: 1, fontSize: 14, cursor: 'pointer' }}>{r.title}<span style={{ fontSize: 11, color: C.mid }}>　{r.category}</span></span>
            <button style={{ ...btnP, padding: '6px 10px', fontSize: 13 }} onClick={() => edit(r.id)}>修改</button>
          </div>
        ))}
        <div style={{ fontSize: 12, color: C.mid, marginTop: 6 }}>也可以在任何規範全文右上角按「✏️ 提出修改」。</div>
      </div>

      <div data-yaya="rules-propose-new" style={{ ...card, padding: 12, marginBottom: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>新增一份規範</div>
        <input style={input} value={title} onChange={e => setTitle(e.target.value)} placeholder="規範標題" />
        <input style={{ ...input, marginTop: 6 }} value={cat} onChange={e => setCat(e.target.value)} placeholder="分類（選填）" list="rules-cats" />
        <datalist id="rules-cats">{(prop.meta?.categories || []).map(c => <option key={c} value={c} />)}</datalist>
        <button style={{ ...btnP, width: '100%', marginTop: 8 }} disabled={busy} onClick={create}>{busy ? '建立中…' : '建立草稿並開始寫'}</button>
        <div style={{ fontSize: 12, color: C.mid, marginTop: 6 }}>習慣用 Word 寫的：建好草稿後在編輯器按「📄 上傳 Word 轉成系統格式」，AI 會轉成一條一條的條文（表格、圖片都會帶過來）。</div>
      </div>

      <div data-yaya="rules-propose-mine" style={{ ...card, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>我提出的</div>
        {!(prop.mine || []).length && <div style={{ fontSize: 13, color: C.mid }}>還沒有</div>}
        {(prop.mine || []).map(v => {
          const canOpen = ['draft', 'returned', 'pending'].includes(v.status);
          return (
            <div key={v.id} onClick={() => (canOpen ? onEdit(v.id) : v.status === 'approved' && open(v.regulation_id))} style={{ padding: '8px 0', borderBottom: `1px solid ${C.line}`, cursor: 'pointer' }}>
              <div style={{ fontSize: 14 }}><StatusBadge s={v.status} /> {v.title || `規範 ${v.regulation_id}`}<span style={{ fontSize: 11, color: C.mid }}>　第 {v.version} 版</span></div>
              <div style={{ fontSize: 12, color: C.mid }}>{stHint[v.status] || ''}{v.change_note ? `・${v.change_note}` : ''}{v.updated_at ? `・${fmtTime(v.updated_at)}` : ''}</div>
              {v.status === 'returned' && v.review_note && <div style={{ fontSize: 12, color: C.bad }}>退回原因：{v.review_note}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
