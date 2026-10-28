// 修改中的版本（草稿／被退回）：編輯器＋右側 AI 面板（編輯助理、AI 檢查）
import React, { useEffect, useRef, useState } from 'react';
import { useRegApi } from './regApi';
import DocEditor from './DocEditor';
import { applyOps, changeLabel } from './docOps';
import { C, card, input, btn, btnP, btnD, btnOk, btnSm, RiskBadge, StatusBadge, Field, clone, fmtTime } from './ui';

export default function EditorView({ versionId, roles, categories, aiEnabled, onClose, onSubmitted, stack = false }) {   // stack＝手機（App 查規範）上下排
  const api = useRegApi();
  const [v, setV] = useState(null);
  const [doc, setDoc] = useState(null);
  const [note, setNote] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [preview, setPreview] = useState(null);
  const [undo, setUndo] = useState([]);
  const [aiTab, setAiTab] = useState('assist');
  const [checks, setChecks] = useState(null);

  const load = async () => {
    const r = await api.version(versionId);
    if (!r?.success) { setMsg({ err: true, text: r?.message || '讀取失敗' }); return; }
    setV(r.data); setDoc(clone(r.data.doc)); setNote(r.data.change_note || ''); setDirty(false); setChecks(r.data.ai_checks || null);
  };
  useEffect(() => { load(); }, [versionId]); // eslint-disable-line
  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const change = (d, { pushUndo = false } = {}) => { if (pushUndo) setUndo(u => [...u.slice(-19), doc]); setDoc(d); setDirty(true); setPreview(null); };
  const save = async (docToSave = doc) => {
    setBusy('save'); setMsg(null);
    try {
      const r = await api.saveDraft(versionId, { doc: docToSave, change_note: note });
      if (!r?.success) throw new Error(r?.message || '儲存失敗');
      setV(r.data); setDoc(clone(r.data.doc)); setDirty(false); setMsg({ text: '已儲存草稿' });
      return r.data;
    } catch (e) { setMsg({ err: true, text: e.message }); return null; } finally { setBusy(''); }
  };
  const check = async () => {
    if (dirty && !(await save())) return;
    setBusy('check');
    try { const r = await api.preview(versionId); if (!r?.success) throw new Error(r?.message); setPreview(r.data); }
    catch (e) { setMsg({ err: true, text: e.message || '檢查失敗' }); } finally { setBusy(''); }
  };
  const submit = async () => {
    if (dirty && !(await save())) return;
    if (!window.confirm('確定送審？送出後到審核完成前不能再修改。' + (aiEnabled ? '\n（送審前會自動跑 AI 檢查）' : ''))) return;
    setBusy('submit'); setMsg(null);
    try {
      const r = await api.submit(versionId);
      if (!r?.success) {
        if (String(r?.message || '').startsWith('AI 檢查還有')) {
          const fresh = await api.version(versionId);
          if (fresh?.success) setChecks(fresh.data.ai_checks || null);
          setAiTab('check');
        }
        throw new Error(r?.message || '送審失敗');
      }
      onSubmitted?.(r.data);
    } catch (e) { setMsg({ err: true, text: e.message }); } finally { setBusy(''); }
  };
  const discard = async () => {
    if (!window.confirm('捨棄這份草稿？所有修改都會丟掉。')) return;
    const r = await api.discard(versionId);
    if (r?.success) onClose?.(); else setMsg({ err: true, text: r?.message || '捨棄失敗' });
  };

  if (!v || !doc) return <div style={{ ...card, padding: 20 }}>{msg?.text || '載入中…'}</div>;
  const editable = ['draft', 'returned'].includes(v.status);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: editable && !stack ? 'minmax(0,1fr) minmax(320px,400px)' : '1fr', gap: 12, alignItems: 'start' }}>
      <div style={{ ...card, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <b style={{ fontSize: 18 }}>{doc.title || '（未命名規範）'}</b>
            <span style={{ marginLeft: 8, fontSize: 12, color: C.mid }}>規範 {v.regulation_id} · 第 {v.version} 版</span> <StatusBadge s={v.status} />
            {dirty && <span style={{ marginLeft: 6, fontSize: 12, color: '#b7791f' }}>● 有未儲存的修改</span>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {undo.length > 0 && <button style={btn} onClick={() => { const prev = undo[undo.length - 1]; setUndo(u => u.slice(0, -1)); setDoc(prev); setDirty(true); }}>↶ 復原</button>}
            <button style={btn} onClick={() => { if (!dirty || window.confirm('有未儲存的修改，確定離開？')) onClose?.(); }}>← 返回</button>
          </div>
        </div>
        {v.status === 'returned' && v.review_note && (
          <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 8, padding: '8px 12px', marginTop: 10, fontSize: 13 }}>
            ↩️ 被退回（{v.reviewed_by_name}）：<b>{v.review_note}</b>
          </div>
        )}
        {!editable && <div style={{ marginTop: 10, color: C.mid }}>這個版本目前是「{v.status}」，不能修改。</div>}
        {editable && (
          <>
            <Field label="這次改了什麼（給審核人看）" style={{ marginTop: 12 }}>
              <input style={input} value={note} onChange={e => { setNote(e.target.value); setDirty(true); }} placeholder="例如：結帳時間改成 21:00 前" />
            </Field>
            <DocxImport title={doc.title} onApply={(d) => change(d, { pushUndo: true })} doc={doc} />
            <DocEditor doc={doc} roles={roles} categories={categories} onChange={(d) => change(d)} />
            {preview && (
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, marginTop: 14, background: '#fcfaf6' }}>
                <b>預先檢查</b> <RiskBadge r={preview.risk} /> <span style={{ fontSize: 12, color: C.mid }}>共 {preview.changes} 處變更</span>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
                  {preview.summary.map((s, i) => <li key={i}>{s}</li>)}
                  {preview.checks.map((c, i) => <li key={`c${i}`}>{c.lv === 'ok' ? '✅' : c.lv === 'warn' ? '⚠️' : '💡'} {c.text}</li>)}
                  {preview.risk_reasons.slice(0, 6).map((r, i) => <li key={`r${i}`} style={{ color: C.mid }}>風險原因：{r}</li>)}
                </ul>
              </div>
            )}
            {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.err ? C.bad : C.ok }}>{msg.text}</div>}
            <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: `1px solid ${C.line}`, marginTop: 14, padding: '10px 0 2px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={btnD} onClick={discard}>捨棄草稿</button>
              <span style={{ flex: 1 }} />
              <button style={btn} disabled={!!busy} onClick={() => save()}>{busy === 'save' ? '儲存中…' : '儲存草稿'}</button>
              <button style={btn} disabled={!!busy} onClick={check}>{busy === 'check' ? '檢查中…' : '預先檢查'}</button>
              <button style={btnP} disabled={!!busy} onClick={submit}>{busy === 'submit' ? '送審中（AI 分析中）…' : '送審'}</button>
            </div>
          </>
        )}
      </div>

      {editable && (
        <div style={{ ...card, position: stack ? 'static' : 'sticky', top: 8, maxHeight: stack ? '75vh' : 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${C.line}` }}>
            {[['assist', '💬 編輯助理'], ['check', `🛡 AI 檢查${checks ? `（${(checks.issues || []).filter(i => i.level === 'warn' && !checks.resolved?.[i.id]).length}）` : ''}`]].map(([k, l]) => (
              <button key={k} onClick={() => setAiTab(k)} style={{ flex: 1, background: 'none', border: 'none', padding: '9px 6px', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                color: aiTab === k ? C.ink : C.mid, borderBottom: aiTab === k ? `3px solid ${C.brand}` : '3px solid transparent' }}>{l}</button>
            ))}
          </div>
          {!aiEnabled ? (
            <div style={{ padding: 14, fontSize: 13, color: C.mid }}>AI 功能尚未啟用：請在 Render 的 operation-backend 設定環境變數 <code>ANTHROPIC_API_KEY</code>。沒啟用時仍可手動編輯、送審。</div>
          ) : aiTab === 'assist' ? (
            <AssistPanel versionId={versionId} doc={doc} onApply={(d) => change(d, { pushUndo: true })} />
          ) : (
            <CheckPanel versionId={versionId} doc={doc} dirty={dirty} checks={checks} setChecks={setChecks}
              save={save} onApply={(d) => change(d, { pushUndo: true })} />
          )}
        </div>
      )}
    </div>
  );
}

// ── 編輯助理 ────────────────────────────────────────────────
export function AssistPanel({ versionId, doc, onApply }) {
  const api = useRegApi();
  const [text, setText] = useState('');
  const [img, setImg] = useState(null);         // { url, preview }
  const [busy, setBusy] = useState('');
  const [thread, setThread] = useState([]);     // [{ ask, img, result, chosen, error }]
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [thread, busy]);

  const pickImage = async (f) => {
    if (!f) return;
    setBusy('upload');
    const r = await api.upload(f);
    setBusy('');
    if (!r?.success) { window.alert(r?.message || '上傳失敗'); return; }
    setImg({ url: r.data.url });
  };
  const send = async () => {
    const ask = text.trim();
    if (!ask && !img) return;
    const entry = { ask, img: img?.url || null };
    setThread(t => [...t, entry]); setText(''); setImg(null); setBusy('ai');
    const r = await api.assist(versionId, { message: ask, image_url: entry.img, doc });
    setBusy('');
    setThread(t => t.map(x => (x === entry ? { ...x, result: r?.success ? r.data : null, error: r?.success ? null : (r?.message || 'AI 失敗') } : x)));
  };
  const choose = (i, o) => {
    try {
      const d = applyOps(doc, o.ops);
      onApply(d);
      setThread(t => t.map((x, k) => (k === i ? { ...x, chosen: o.key } : x)));
      api.chooseOption(versionId, thread[i].result.log_index, o.key);
    } catch (e) { window.alert(`套用失敗：${e.message}（草稿內容可能在 AI 回覆後被改過，請重新詢問）`); }
  };

  return (
    <>
      <div style={{ overflow: 'auto', flex: 1, padding: 10, fontSize: 13 }}>
        {!thread.length && (
          <div style={{ color: C.mid }}>
            用說的告訴我要怎麼改，我會找出相關條文（包含其他規範），給你 2～3 個方案，按「採用」就套用到草稿。
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['結帳時間改成 21:00 前', '把這份規範裡模糊的用語改明確', '新增一條：門市只收新台幣，不收外幣'].map(s => (
                <button key={s} style={{ ...btn, ...btnSm, textAlign: 'left' }} onClick={() => setText(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {thread.map((x, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ background: C.brand, color: '#fff', borderRadius: 10, padding: '6px 10px', marginLeft: 30 }}>
              {x.img && <img src={x.img} alt="" style={{ maxWidth: 160, maxHeight: 110, borderRadius: 6, display: 'block', marginBottom: 4 }} />}
              {x.ask || '（照片）'}
            </div>
            {!x.result && !x.error && <div style={{ color: C.mid, marginTop: 6 }}>AI 正在搜尋全部規範、整理方案…（約 10～30 秒）</div>}
            {x.error && <div style={{ color: C.bad, marginTop: 6 }}>{x.error}</div>}
            {x.result && (
              <div style={{ background: '#f6f1ea', borderRadius: 10, padding: 8, marginTop: 6 }}>
                <div><b>我的理解：</b>{x.result.understanding}</div>
                {x.result.found?.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 12 }}>相關條文：{x.result.found.map(f => <span key={f.code} title={f.why} style={{ fontFamily: 'monospace', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 6, padding: '0 4px', marginRight: 3 }}>{f.code}</span>)}</div>
                )}
                {x.result.options.map(o => (
                  <div key={o.key} style={{ background: '#fff', border: `1px solid ${o.recommended ? '#38a169' : C.line}`, borderRadius: 8, padding: 8, marginTop: 8, opacity: x.chosen && x.chosen !== o.key ? 0.55 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <b>方案 {o.key}｜{o.name}</b>{o.recommended && <span style={{ fontSize: 11, background: '#38a169', color: '#fff', borderRadius: 6, padding: '0 6px', height: 18 }}>建議</span>}
                    </div>
                    <div style={{ fontSize: 12, color: C.mid, margin: '2px 0 4px' }}>{o.desc}</div>
                    {(o.preview?.changes || []).map((c, k) => (
                      <div key={k} style={{ fontSize: 12, borderLeft: `2px solid ${C.line}`, paddingLeft: 6, margin: '4px 0' }}>
                        <span style={{ fontFamily: 'monospace', color: '#8b6f4e' }}>{c.code}</span> {changeLabel(c)}
                        {c.old && c.kind !== 'add' && <div style={{ color: '#9b2c2c', textDecoration: 'line-through' }}>{c.old}</div>}
                        {c.new && c.kind !== 'del' && <div style={{ color: '#22543d', background: '#f0fff4' }}>{c.new}</div>}
                        {(c.fields || []).includes('notes') && (c.notes || []).map((n, j) => <div key={j} style={{ color: '#22543d' }}>{n.kind}：{n.text}</div>)}
                        {(c.fields || []).includes('images') && <div style={{ color: '#22543d' }}>＋照片</div>}
                      </div>
                    ))}
                    {(o.preview?.meta || []).map((m, k) => <div key={`m${k}`} style={{ fontSize: 12, color: '#22543d' }}>欄位「{m.field}」→ {Array.isArray(m.new) ? m.new.join('、') : m.new}</div>)}
                    {(o.other_regs || []).length > 0 && (
                      <div style={{ fontSize: 12, marginTop: 4, background: '#fffaf0', borderRadius: 6, padding: '4px 6px' }}>
                        📎 其他規範也建議跟著改（這次不會改到）：
                        {o.other_regs.map((r, k) => (
                          <div key={k}><a href={`/regulations?reg=${String(r.code || '').split('-')[0]}`} target="_blank" rel="noreferrer">{r.title}</a> <span style={{ fontFamily: 'monospace' }}>{r.code}</span>：{r.suggestion}</div>
                        ))}
                      </div>
                    )}
                    <button style={{ ...(x.chosen === o.key ? btnOk : btnP), ...btnSm, marginTop: 6 }} disabled={!!x.chosen} onClick={() => choose(i, o)}>
                      {x.chosen === o.key ? '✓ 已套用到草稿' : `採用方案 ${o.key}`}
                    </button>
                  </div>
                ))}
                {x.chosen && <div style={{ fontSize: 12, color: C.ok, marginTop: 6 }}>已套用，左邊可以再手動調整；記得按「儲存草稿」。不滿意可按上方「↶ 復原」。</div>}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ borderTop: `1px solid ${C.line}`, padding: 8 }}>
        {img && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><img src={img.url} alt="" style={{ height: 48, borderRadius: 4 }} /><button style={{ ...btn, ...btnSm }} onClick={() => setImg(null)}>移除照片</button></div>}
        <div style={{ display: 'flex', gap: 6 }}>
          <label style={{ ...btn, padding: '6px 9px' }} title="上傳照片">📷<input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { pickImage(e.target.files?.[0]); e.target.value = ''; }} /></label>
          <textarea style={{ ...input, minHeight: 38, resize: 'vertical' }} rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="例如：結帳時間改成 21:00 前"
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }} />
          <button style={btnP} disabled={!!busy || (!text.trim() && !img)} onClick={send}>{busy === 'ai' ? '…' : busy === 'upload' ? '上傳中' : '送出'}</button>
        </div>
        <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 3 }}>Ctrl＋Enter 送出</div>
      </div>
    </>
  );
}

// ── AI 檢查 ─────────────────────────────────────────────────
export function CheckPanel({ versionId, doc, dirty, checks, setChecks, save, onApply }) {
  const api = useRegApi();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ignoring, setIgnoring] = useState(null);
  const [reason, setReason] = useState('');

  const run = async () => {
    setErr('');
    if (dirty && !(await save())) return;
    setBusy(true);
    const r = await api.aiCheck(versionId);
    setBusy(false);
    if (r?.success) setChecks(r.data); else setErr(r?.message || 'AI 檢查失敗');
  };
  const applyFix = async (issue) => {
    try {
      const d = applyOps(doc, issue.fix.ops);
      onApply(d);
      const saved = await save(d);
      if (!saved) return;
      const r = await api.resolveIssue(versionId, issue.id, { how: 'applied' });
      if (r?.success) setChecks(r.data);
    } catch (e) { setErr(`套用失敗：${e.message}（內容可能已被改過，請重新執行 AI 檢查）`); }
  };
  const ignore = async (issue) => {
    if (!reason.trim()) return;
    const r = await api.resolveIssue(versionId, issue.id, { how: 'ignored', reason: reason.trim() });
    if (r?.success) { setChecks(r.data); setIgnoring(null); setReason(''); } else setErr(r?.message || '失敗');
  };
  const reopen = async (issue) => { const r = await api.resolveIssue(versionId, issue.id, { how: 'reopen' }); if (r?.success) setChecks(r.data); };

  const issues = checks?.issues || [];
  const open = issues.filter(i => i.level === 'warn' && !checks.resolved?.[i.id]).length;
  return (
    <div style={{ overflow: 'auto', flex: 1, padding: 10, fontSize: 13 }}>
      <div style={{ color: C.mid, marginBottom: 8 }}>
        AI 會檢查這次修改：前後矛盾、和其他規範衝突、模糊用語、缺漏（例如沒寫生效日）、適用範圍。<b>⚠️ 的問題要修正或寫原因忽略，才能送審。</b>
      </div>
      <button style={btnP} disabled={busy} onClick={run}>{busy ? 'AI 檢查中…（約 10～40 秒）' : checks ? '重新檢查' : '執行 AI 檢查'}</button>
      {checks && <span style={{ fontSize: 12, color: C.mid, marginLeft: 8 }}>上次：{fmtTime(checks.at)}{dirty ? '（之後有修改，送審時會自動重新檢查）' : ''}</span>}
      {err && <div style={{ color: C.bad, marginTop: 6 }}>{err}</div>}
      {checks && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{open ? `⚠️ 還有 ${open} 個問題要處理` : issues.length ? '✅ 必須處理的都處理完了' : '✅ 沒有發現問題'}</div>
          {issues.map(i => {
            const res = checks.resolved?.[i.id];
            return (
              <div key={i.id} style={{ border: `1px solid ${i.level === 'warn' && !res ? '#fbd38d' : C.line}`, background: i.level === 'warn' && !res ? '#fffaf0' : '#fff', borderRadius: 8, padding: 8, marginTop: 6, opacity: res ? 0.7 : 1 }}>
                <div>{i.level === 'warn' ? '⚠️' : '💡'} <span style={{ fontSize: 11, background: '#edf2f7', borderRadius: 6, padding: '0 5px' }}>{i.kind}</span> <b>{i.title}</b></div>
                <div style={{ marginTop: 2 }}>{i.detail}</div>
                {i.codes?.length > 0 && <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#8b6f4e', marginTop: 2 }}>{i.codes.join('、')}</div>}
                {(i.other_regs || []).map((r, k) => (
                  <div key={k} style={{ fontSize: 12, marginTop: 3 }}>📎 <a href={`/regulations?reg=${String(r.code || '').split('-')[0]}`} target="_blank" rel="noreferrer">{r.title}</a> {r.code}：{r.suggestion}</div>
                ))}
                {res ? (
                  <div style={{ fontSize: 12, color: C.mid, marginTop: 4 }}>{res.how === 'applied' ? '✓ 已套用修正' : `已忽略：${res.reason}`}（{res.by}） <button style={{ ...btn, ...btnSm }} onClick={() => reopen(i)}>復原</button></div>
                ) : (
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {i.fix && <button style={{ ...btnOk, ...btnSm }} onClick={() => applyFix(i)}>✓ {i.fix.label}</button>}
                    {ignoring === i.id ? (
                      <>
                        <input style={{ ...input, width: 170, padding: '2px 6px', fontSize: 12 }} value={reason} onChange={e => setReason(e.target.value)} placeholder="忽略原因（必填）" autoFocus />
                        <button style={{ ...btn, ...btnSm }} disabled={!reason.trim()} onClick={() => ignore(i)}>確定</button>
                      </>
                    ) : <button style={{ ...btn, ...btnSm }} onClick={() => { setIgnoring(i.id); setReason(''); }}>忽略</button>}
                  </div>
                )}
                {i.fix?.preview?.changes?.length > 0 && !res && (
                  <details style={{ fontSize: 12, marginTop: 4 }}><summary style={{ cursor: 'pointer', color: C.mid }}>修正內容</summary>
                    {i.fix.preview.changes.map((c, k) => (
                      <div key={k} style={{ borderLeft: `2px solid ${C.line}`, paddingLeft: 6, margin: '3px 0' }}>
                        <span style={{ fontFamily: 'monospace' }}>{c.code}</span> {changeLabel(c)}
                        {c.old && c.kind !== 'add' && <div style={{ color: '#9b2c2c', textDecoration: 'line-through' }}>{c.old}</div>}
                        {c.new && c.kind !== 'del' && <div style={{ color: '#22543d' }}>{c.new}</div>}
                      </div>
                    ))}
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 上傳 Word → AI 轉成系統格式（套用到編輯器，還沒存檔；可復原）──
export function DocxImport({ doc, title, onApply }) {
  const api = useRegApi();
  const [busy, setBusy] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const pick = async (f) => {
    if (!f) return;
    setErr(''); setRes(null); setBusy('上傳中…');
    const r = await api.importDocx(f, title);
    if (!r?.success) { setBusy(''); setErr(r?.message || '上傳失敗'); return; }
    const t0 = Date.now();
    setBusy('AI 轉換中（通常 1～3 分鐘，請不要關掉這頁）…');
    const poll = async () => {
      const p = await api.importDocxJob(r.data.job);
      if (!p?.success) { setBusy(''); setErr(p?.message || '轉換失敗'); return; }
      if (p.data.status === 'running') {
        if (Date.now() - t0 > 12 * 60 * 1000) { setBusy(''); setErr('轉換太久，請稍後再試或把 Word 分成兩份'); return; }
        setBusy(`AI 轉換中（已 ${Math.round((Date.now() - t0) / 1000)} 秒，通常 1～3 分鐘）…`); setTimeout(poll, 3000); return;
      }
      setBusy('');
      if (p.data.status === 'error') { setErr(p.data.error || '轉換失敗'); return; }
      setRes(p.data.result);
    };
    setTimeout(poll, 3000);
  };
  const hasContent = (doc?.sections || []).some(s => (s.items || []).length);
  const apply = () => {
    const x = res;
    const next = { ...doc, sections: x.sections,
      title: doc.title && doc.title !== '（未命名規範）' ? doc.title : (x.title || doc.title),
      summary: doc.summary || x.summary, scenario: doc.scenario || x.scenario };
    onApply(next); setRes(null);
  };
  return (
    <div data-yaya="reg-docx" style={{ border: `1px dashed ${C.line}`, borderRadius: 10, padding: '8px 10px', marginTop: 12, background: '#fcfaf6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ ...btn, display: 'inline-block', opacity: busy ? 0.5 : 1, pointerEvents: busy ? 'none' : 'auto' }}>📄 上傳 Word 轉成系統格式
          <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; pick(f); }} />
        </label>
        <span style={{ fontSize: 12, color: C.mid }}>照平常習慣在 Word 寫好（可含表格、圖片），AI 轉成一條一條的條文，轉完還可以在下面繼續改。</span>
      </div>
      {busy && <div style={{ fontSize: 13, color: '#b7791f', marginTop: 6 }}>⏳ {busy}</div>}
      {err && <div style={{ fontSize: 13, color: C.bad, marginTop: 6 }}>{err}</div>}
      {res && (
        <div style={{ marginTop: 8, fontSize: 13 }}>
          <b>轉好了</b>：{res.stats.sections} 個大標題、{res.stats.clauses} 條條文、{res.stats.images} 張圖{res.stats.images_unplaced ? `（${res.stats.images_unplaced} 張沒放進條文，放在最後一條）` : ''}
          {res.ai_notes?.length > 0 && <ul style={{ margin: '4px 0', paddingLeft: 18, color: C.mid }}>{res.ai_notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          {hasContent && <div style={{ color: '#b7791f' }}>⚠ 套用會取代目前編輯器裡的全部條文（可按「↶ 復原」回來；原本條文的代碼會變成新的）。</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button style={btnP} onClick={apply}>套用到編輯器</button>
            <button style={btn} onClick={() => setRes(null)}>不要</button>
          </div>
        </div>
      )}
    </div>
  );
}
