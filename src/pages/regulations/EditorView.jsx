// 修改中的版本（草稿／被退回）：編輯、存檔、預先檢查、送審、捨棄
import React, { useEffect, useState } from 'react';
import { regulationApi as api } from '../../services/api';
import DocEditor from './DocEditor';
import { C, card, input, btn, btnP, btnD, RiskBadge, StatusBadge, Field, clone } from './ui';

export default function EditorView({ versionId, roles, categories, onClose, onSubmitted }) {
  const [v, setV] = useState(null);
  const [doc, setDoc] = useState(null);
  const [note, setNote] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = async () => {
    const r = await api.version(versionId);
    if (!r?.success) { setMsg({ err: true, text: r?.message || '讀取失敗' }); return; }
    setV(r.data); setDoc(clone(r.data.doc)); setNote(r.data.change_note || ''); setDirty(false);
  };
  useEffect(() => { load(); }, [versionId]); // eslint-disable-line

  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const save = async () => {
    setBusy('save'); setMsg(null);
    try {
      const r = await api.saveDraft(versionId, { doc, change_note: note });
      if (!r?.success) throw new Error(r?.message || '儲存失敗');
      setV(r.data); setDoc(clone(r.data.doc)); setDirty(false); setMsg({ text: '已儲存草稿' });
      return true;
    } catch (e) { setMsg({ err: true, text: e.message }); return false; } finally { setBusy(''); }
  };
  const check = async () => {
    if (dirty && !(await save())) return;
    setBusy('check');
    try { const r = await api.preview(versionId); if (!r?.success) throw new Error(r?.message); setPreview(r.data); }
    catch (e) { setMsg({ err: true, text: e.message || '檢查失敗' }); } finally { setBusy(''); }
  };
  const submit = async () => {
    if (dirty && !(await save())) return;
    if (!window.confirm('確定送審？送出後到審核完成前不能再修改。')) return;
    setBusy('submit'); setMsg(null);
    try {
      const r = await api.submit(versionId);
      if (!r?.success) throw new Error(r?.message || '送審失敗');
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
    <div style={{ ...card, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <b style={{ fontSize: 18 }}>{doc.title || '（未命名規範）'}</b>
          <span style={{ marginLeft: 8, fontSize: 12, color: C.mid }}>規範 {v.regulation_id} · 第 {v.version} 版</span> <StatusBadge s={v.status} />
          {dirty && <span style={{ marginLeft: 6, fontSize: 12, color: '#b7791f' }}>● 有未儲存的修改</span>}
        </div>
        <button style={btn} onClick={() => { if (!dirty || window.confirm('有未儲存的修改，確定離開？')) onClose?.(); }}>← 返回</button>
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
          <DocEditor doc={doc} roles={roles} categories={categories} onChange={(d) => { setDoc(d); setDirty(true); setPreview(null); }} />
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
            <button style={btn} disabled={!!busy} onClick={save}>{busy === 'save' ? '儲存中…' : '儲存草稿'}</button>
            <button style={btn} disabled={!!busy} onClick={check}>{busy === 'check' ? '檢查中…' : '預先檢查'}</button>
            <button style={btnP} disabled={!!busy} onClick={submit}>{busy === 'submit' ? '送審中（AI 分析中）…' : '送審'}</button>
          </div>
        </>
      )}
    </div>
  );
}
