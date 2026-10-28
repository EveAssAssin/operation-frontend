// 規範瀏覽：左邊清單（搜尋、分類），右邊內容＋版本紀錄；可開始修改或新增規範
import React, { useEffect, useMemo, useState } from 'react';
import { regulationApi as api } from '../../services/api';
import { C, card, input, btn, btnP, btnSm, DocView, StatusBadge, fmtTime, Modal, Field, RecentChange } from './ui';

export default function BrowsePanel({ initialId, categories, onEdit, canAudit }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(initialId || null);
  const [detail, setDetail] = useState(null);
  const [verDoc, setVerDoc] = useState(null);   // 檢視舊版
  const [markChg, setMarkChg] = useState(true); // 標出最近修改的條文
  const [hits, setHits] = useState([]);          // 條文全文搜尋
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.list({ q: q || undefined, category: cat || undefined });
        setList(r?.success ? r.data : []);
        if (q.trim().length >= 2) { const h = await api.clauses(q.trim()); setHits(h?.success ? h.data.slice(0, 20) : []); } else setHits([]);
      } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q, cat]);

  useEffect(() => {
    if (!sel) { setDetail(null); return; }
    setVerDoc(null);
    api.get(sel).then(r => setDetail(r?.success ? r.data : null));
  }, [sel]);

  const grouped = useMemo(() => {
    const m = new Map();
    list.forEach(r => { const k = r.category || '（未分類）'; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    return [...m.entries()];
  }, [list]);

  const startEdit = async () => {
    setErr('');
    const r = await api.startDraft(sel);
    if (r?.success) onEdit(r.data.id); else setErr(r?.message || '無法開始修改');
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,330px) minmax(0,1fr)', gap: 12, alignItems: 'start' }}>
      <div style={{ ...card, position: 'sticky', top: 8, maxHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 10, borderBottom: `1px solid ${C.line}` }}>
          <input style={input} value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋規範標題、編號或條文內容" />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <select style={{ ...input, fontSize: 13 }} value={cat} onChange={e => setCat(e.target.value)}>
              <option value="">全部分類（{categories.reduce((s, c) => s + c.count, 0)}）</option>
              {categories.map(c => <option key={c.name} value={c.name === '（未分類）' ? '' : c.name}>{c.name}（{c.count}）</option>)}
            </select>
            <button style={{ ...btnP, whiteSpace: 'nowrap' }} onClick={() => setCreating(true)}>＋ 新規範</button>
          </div>
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          {loading && <div style={{ padding: 10, color: C.mid }}>搜尋中…</div>}
          {hits.length > 0 && (
            <div style={{ borderBottom: `2px solid ${C.line}` }}>
              <div style={{ padding: '6px 10px', fontSize: 12, color: C.mid, background: '#fcfaf6' }}>符合的條文（{hits.length}）</div>
              {hits.map(h => (
                <div key={h.code} onClick={() => setSel(h.regulation_id)} style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: `1px solid ${C.line}`, fontSize: 13 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#8b6f4e' }}>{h.code}</span> <b>{h.regulations?.title}</b>
                  <div style={{ color: C.mid, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.text}</div>
                </div>
              ))}
            </div>
          )}
          {grouped.map(([g, rows]) => (
            <div key={g}>
              <div style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, color: C.mid, background: '#fcfaf6', position: 'sticky', top: 0 }}>{g}（{rows.length}）</div>
              {rows.map(r => (
                <div key={r.id} onClick={() => setSel(r.id)} style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: `1px solid ${C.line}`, background: sel === r.id ? '#f3ede4' : undefined, fontSize: 13.5 }}>
                  {r.title} {r.open_status && <StatusBadge s={r.open_status} />}
                  <div style={{ fontSize: 11, color: '#a0aec0' }}>#{r.id} · 第 {r.current_version} 版</div>
                </div>
              ))}
            </div>
          ))}
          {!loading && !list.length && <div style={{ padding: 16, color: '#a0aec0' }}>沒有規範。第一次使用請到「設定」從 MAP 匯入。</div>}
        </div>
      </div>

      <div style={{ ...card, padding: 14, minHeight: 300 }}>
        {!detail && <div style={{ color: '#a0aec0', padding: 30, textAlign: 'center' }}>從左邊選一份規範</div>}
        {detail && (() => {
          const r = detail.regulation, doc = verDoc?.doc || detail.doc, open = detail.open_draft;
          return (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{doc?.title || r.title}</div>
                  <div style={{ fontSize: 12, color: C.mid }}>規範 {r.id} · {doc?.category || r.category || '未分類'} · {verDoc ? <b style={{ color: '#b7791f' }}>正在看第 {verDoc.version} 版（舊版）</b> : `現行第 ${r.current_version} 版`}
                    {r.source === 'map_import' && ' · 自 MAP 匯入'}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  {verDoc && <button style={btn} onClick={() => setVerDoc(null)}>回現行版</button>}
                  {canAudit && !verDoc && <button style={btn} title="用 AI 檢查這份規範的矛盾、模糊、過時等問題，結果放在「巡檢」分頁" onClick={async () => {
                    const r2 = await api.runAudit({ regulation_id: r.id });
                    setErr(r2?.success ? '已開始巡檢這份規範，約 1 分鐘後到「🔎 巡檢」分頁看結果' : (r2?.message || '無法巡檢'));
                  }}>🔎 巡檢這份</button>}
                  {open ? (
                    open.status === 'pending' ? <span style={{ fontSize: 13, color: '#b7791f' }}>第 {open.version} 版送審中</span>
                      : <button style={btnP} onClick={() => onEdit(open.id)}>繼續修改（第 {open.version} 版{open.status === 'returned' ? '・被退回' : ''}）</button>
                  ) : <button style={btnP} onClick={startEdit}>✏️ 修改這份規範</button>}
                </div>
              </div>
              {err && <div style={{ color: C.bad, fontSize: 13, marginTop: 6 }}>{err}</div>}
              {(doc?.summary || doc?.scenario || doc?.owner_dept || (doc?.roles || []).length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '2px 10px', fontSize: 13, background: '#fcfaf6', border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 12px', marginTop: 10 }}>
                  {doc.summary && <><span style={{ color: C.mid }}>摘要</span><span>{doc.summary}</span></>}
                  {doc.scenario && <><span style={{ color: C.mid }}>適用情境</span><span>{doc.scenario}</span></>}
                  {doc.owner_dept && <><span style={{ color: C.mid }}>負責部門</span><span>{doc.owner_dept}</span></>}
                  {(doc.roles || []).length > 0 && <><span style={{ color: C.mid }}>適用身分</span><span>{doc.roles.join('、')}</span></>}
                </div>
              )}
              {(doc?.parse_flags || []).length > 0 && !verDoc && (
                <div style={{ fontSize: 12, color: '#b7791f', marginTop: 6 }}>⚠ 匯入時發現格式問題：{doc.parse_flags.slice(0, 4).join('、')}{doc.parse_flags.length > 4 ? '…' : ''}</div>
              )}
              {!verDoc && <RecentChange rc={detail.recent_change} mark={markChg} onToggleMark={setMarkChg} />}
              <DocView doc={doc} highlight={!verDoc && markChg ? Object.fromEntries((detail.recent_change?.codes || []).map(c => [c, 'mod'])) : {}} />
              <details style={{ marginTop: 16 }}>
                <summary style={{ cursor: 'pointer', color: C.mid, fontWeight: 700 }}>版本紀錄（{detail.versions.length}）</summary>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginTop: 6 }}>
                  <tbody>
                    {detail.versions.map(x => (
                      <tr key={x.id} style={{ borderTop: `1px solid ${C.line}` }}>
                        <td style={{ padding: 4 }}>第 {x.version} 版</td>
                        <td style={{ padding: 4 }}><StatusBadge s={x.status} />{x.reviewer_edited && <span style={{ fontSize: 11, color: '#2b6cb0' }}> 審核人修改後通過</span>}</td>
                        <td style={{ padding: 4 }}>{x.change_note || '—'}</td>
                        <td style={{ padding: 4, color: C.mid }}>{x.created_by_name || '—'} · {fmtTime(x.published_at || x.submitted_at || x.created_at)}</td>
                        <td style={{ padding: 4 }}>{x.status === 'approved' && x.version !== r.current_version &&
                          <button style={{ ...btn, ...btnSm }} onClick={async () => { const v = await api.version(x.id); if (v?.success) setVerDoc(v.data); }}>看這版</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          );
        })()}
      </div>
      {creating && <NewRegModal categories={categories} onClose={() => setCreating(false)} onCreated={(v) => { setCreating(false); onEdit(v.id); }} />}
    </div>
  );
}

function NewRegModal({ categories, onClose, onCreated }) {
  const [title, setTitle] = useState(''); const [category, setCategory] = useState(''); const [err, setErr] = useState('');
  const create = async () => {
    const r = await api.newRegulation({ title, category });
    if (r?.success) onCreated(r.data); else setErr(r?.message || '建立失敗');
  };
  return (
    <Modal title="新增規範" onClose={onClose}>
      <div style={{ fontSize: 13, color: C.mid, marginBottom: 10 }}>建議先搜尋看看有沒有現成規範可以併入；能合併的就用「修改」的方式加進去。</div>
      <Field label="規範標題 *"><input style={input} value={title} onChange={e => setTitle(e.target.value)} autoFocus /></Field>
      <Field label="分類">
        <input style={input} list="reg-cats-new" value={category} onChange={e => setCategory(e.target.value)} />
        <datalist id="reg-cats-new">{categories.map(c => <option key={c.name} value={c.name} />)}</datalist>
      </Field>
      {err && <div style={{ color: C.bad, fontSize: 13 }}>{err}</div>}
      <div style={{ textAlign: 'right' }}><button style={btn} onClick={onClose}>取消</button> <button style={btnP} onClick={create}>建立草稿</button></div>
    </Modal>
  );
}
