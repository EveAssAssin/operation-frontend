// 跨規範一起修改（2026-11）
//   AI 檢查／編輯助理說「其他規範也建議跟著改」時，不用另開分頁：
//   在這裡由 AI 產生每份規範的修改內容（原文 → 新文字），可逐條勾選、微調文字，
//   再「逐份」或「全部」存成草稿／送審（每份規範各自一份草稿，照原本的審核流程上線）
import React, { useEffect, useRef, useState } from 'react';
import { useRegApi } from './regApi';
import { C, input, btn, btnP, btnOk, btnSm } from './ui';

const OP_LABEL = { replace_text: '修改', add_clause: '新增', delete_clause: '刪除', add_note: '加註', set_penalty: '扣分', move_clause: '移動', add_section: '新增大項', set_meta: '欄位', add_image: '照片', set_image_caption: '照片說明' };
const hasText = (o) => ['replace_text', 'add_clause', 'add_note'].includes(o.op);
const regIdOf = (code) => String(code || '').split('-')[0];

/** 只顯示建議（不再開新分頁，避免 App 端跳到登入頁） */
export function RelatedList({ items, labels = {}, fmt = (t) => t }) {
  // 代碼（1254-5.9）看不懂 → 顯示「五、9.」；只有規範編號（1254）就不顯示（2026-11-10）
  return (items || []).map((r, k) => {
    const lab = labels[r.code] ? String(labels[r.code]).replace(/^《[^》]*》/, '') : (/^\d+$/.test(String(r.code || '')) ? '' : '');
    return (
      <div key={k} style={{ fontSize: 12, marginTop: 3 }}>
        📎 <b>《{r.title}》</b>{lab && <span title={`條文代碼 ${r.code}`} style={{ color: '#8b6f4e' }}> {lab}</span>}：{fmt(r.suggestion)}
      </div>
    );
  });
}

export default function RelatedEdits({ versionId, items, doc, onAllDone }) {
  const api = useRegApi();
  const [phase, setPhase] = useState('idle');       // idle | loading | ready | error
  const [err, setErr] = useState('');
  const [regs, setRegs] = useState([]);
  const [busyAll, setBusyAll] = useState('');
  const doneRef = useRef(false);
  const regCount = new Set((items || []).map(i => regIdOf(i.code)).filter(Boolean)).size;

  const load = async () => {
    setPhase('loading'); setErr(''); doneRef.current = false;
    const r = await api.relatedDraft(versionId, { items, doc });
    if (!r?.success) { setPhase('error'); setErr(r?.message || 'AI 產生失敗，請再試一次'); return; }
    setRegs((r.data.regs || []).map(g => ({ ...g, note: g.change_note || '', ops: (g.ops || []).map(o => ({ ...o, on: true })), st: null })));
    setPhase('ready');
  };

  // 全部處理完（每份都已存草稿或送審，或本來就不能改）→ 通知外層
  useEffect(() => {
    if (phase !== 'ready' || doneRef.current || !regs.length) return;
    const ok = regs.filter(g => !g.error);
    if (ok.length && ok.every(g => ['submitted', 'drafted'].includes(g.st?.state))) {
      doneRef.current = true;
      onAllDone?.(ok.map(g => ({ title: g.title, state: g.st.state })));
    }
  }, [regs, phase, onAllDone]);

  const setG  = (gi, patch) => setRegs(rs => rs.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const setOp = (gi, oi, patch) => setRegs(rs => rs.map((g, i) => (i !== gi ? g : { ...g, ops: g.ops.map((o, j) => (j === oi ? { ...o, ...patch } : o)) })));

  const send = async (gi, submit, list = regs) => {
    const g = list[gi];
    const ops = g.ops.filter(o => o.on).map(({ on, old, ...o }) => o);
    if (!ops.length) { setG(gi, { st: { state: 'err', msg: '沒有勾選要修改的條文' } }); return null; }
    if (ops.some(o => hasText(o) && !String(o.text || '').trim())) { setG(gi, { st: { state: 'err', msg: '有條文內容是空的' } }); return null; }
    setG(gi, { st: { state: 'busy', msg: submit ? '送審中（會先跑 AI 檢查，約 10～40 秒）…' : '儲存中…' } });
    const r = await api.relatedApply(g.regulation_id, { ops, change_note: g.note, submit });
    if (!r?.success) { setG(gi, { st: { state: 'err', msg: r?.message || '失敗' } }); return null; }
    const d = r.data;
    const st = d.status === 'submitted'
      ? { state: 'submitted', msg: '✓ 已送審，等審核人通過就上線' }
      : { state: 'drafted', msg: d.message ? `已存成草稿，但還不能送審：${d.message}` : '✓ 已存成草稿（還沒送審，可到「草稿」繼續改）' };
    setG(gi, { st: { ...st, version_id: d.version_id } });
    return st.state;
  };
  const sendAll = async (submit) => {
    setBusyAll(submit ? 'submit' : 'draft');
    const snapshot = regs;
    for (let i = 0; i < snapshot.length; i++) {
      const g = snapshot[i];
      if (g.error || g.st?.state === 'submitted' || (!submit && g.st?.state === 'drafted')) continue;
      // eslint-disable-next-line no-await-in-loop
      await send(i, submit, snapshot);
    }
    setBusyAll('');
  };

  if (phase === 'idle') {
    return <button style={{ ...btnP, ...btnSm, marginTop: 6 }} onClick={load}>✏️ 一起修改這 {regCount} 份規範</button>;
  }
  if (phase === 'loading') return <div style={{ fontSize: 12, color: '#b7791f', marginTop: 6 }}>⏳ AI 正在讀取 {regCount} 份規範、產生修改內容…（約 15～40 秒）</div>;
  if (phase === 'error') return <div style={{ fontSize: 12, color: C.bad, marginTop: 6 }}>{err} <button style={{ ...btn, ...btnSm }} onClick={load}>重試</button></div>;

  const pending = regs.filter(g => !g.error && g.st?.state !== 'submitted').length;
  return (
    <div style={{ marginTop: 8, border: `1px solid ${C.line}`, borderRadius: 8, background: '#fff', padding: 8 }}>
      <div style={{ fontSize: 12, color: C.mid, marginBottom: 6 }}>
        每份規範會各自開一份草稿、照原本流程送審。紅字是原文，綠框可以直接改；不想改的條文把勾勾拿掉。
      </div>
      {regs.map((g, gi) => {
        const locked = g.st?.state === 'submitted' || g.st?.state === 'busy';
        return (
          <div key={g.regulation_id} style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: 8, marginBottom: 8, background: g.st?.state === 'submitted' ? '#f0fff4' : '#fcfaf6' }}>
            <div style={{ fontWeight: 700 }}>《{g.title}》 <span style={{ fontSize: 11, color: C.mid, fontWeight: 400 }}>#{g.regulation_id}</span></div>
            {g.open_draft && !g.error && <div style={{ fontSize: 11, color: '#b7791f' }}>這份規範已有草稿（{g.open_draft.by || '其他人'}），會加進那份草稿</div>}
            {(g.items || []).map((it, k) => <div key={k} style={{ fontSize: 11, color: C.mid }}>建議 {it.code}：{it.suggestion}</div>)}
            {g.error ? <div style={{ color: C.bad, fontSize: 12, marginTop: 4 }}>⚠ {g.error}</div> : (
              <>
                {g.ai_failed && <div style={{ fontSize: 11, color: '#b7791f', marginTop: 4 }}>AI 這次沒辦法直接產生，下面先放原文，請直接改成你要的內容。</div>}
                {g.ops.map((o, oi) => (
                  <div key={oi} style={{ borderLeft: `3px solid ${o.on ? '#38a169' : C.line}`, paddingLeft: 6, margin: '6px 0', opacity: o.on ? 1 : 0.5 }}>
                    <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="checkbox" checked={o.on} disabled={locked} onChange={e => setOp(gi, oi, { on: e.target.checked })} />
                      <b>{OP_LABEL[o.op] || o.op}</b>
                      <span style={{ fontFamily: 'monospace', color: '#8b6f4e' }}>{o.code || o.after_code || o.parent_code || ''}</span>
                    </label>
                    {o.old && o.op !== 'add_note' && <div style={{ fontSize: 12, color: '#9b2c2c', textDecoration: o.op === 'replace_text' || o.op === 'delete_clause' ? 'line-through' : 'none', marginTop: 2 }}>{o.old}</div>}
                    {o.op === 'add_note' && o.old && <div style={{ fontSize: 12, color: C.mid, marginTop: 2 }}>原條文：{o.old}</div>}
                    {hasText(o) && (
                      <textarea style={{ ...input, marginTop: 3, fontSize: 12, borderColor: '#9ae6b4', background: '#f0fff4' }} disabled={locked || !o.on}
                        rows={Math.min(8, Math.max(2, Math.ceil(String(o.text || '').length / 32)))}
                        value={o.text || ''} onChange={e => setOp(gi, oi, { text: e.target.value })} />
                    )}
                    {o.op === 'set_penalty' && (
                      <input type="number" style={{ ...input, width: 90, marginTop: 3, fontSize: 12 }} disabled={locked || !o.on}
                        value={o.pen ?? ''} onChange={e => setOp(gi, oi, { pen: e.target.value === '' ? null : Number(e.target.value) })} />
                    )}
                    {o.op === 'delete_clause' && <div style={{ fontSize: 11, color: C.bad }}>刪除這一條</div>}
                  </div>
                ))}
                <input style={{ ...input, fontSize: 12, marginTop: 4 }} disabled={locked} value={g.note} onChange={e => setG(gi, { note: e.target.value })} placeholder="這次改了什麼（給審核人看）" />
                <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {g.st?.state !== 'submitted' && (
                    <>
                      <button style={{ ...btn, ...btnSm }} disabled={locked || !!busyAll} onClick={() => send(gi, false)}>存成草稿</button>
                      <button style={{ ...btnOk, ...btnSm }} disabled={locked || !!busyAll} onClick={() => send(gi, true)}>送審這份</button>
                    </>
                  )}
                  {g.st && <span style={{ fontSize: 12, color: g.st.state === 'err' ? C.bad : g.st.state === 'busy' ? '#b7791f' : g.st.msg.startsWith('✓') ? C.ok : '#b7791f' }}>{g.st.msg}</span>}
                </div>
              </>
            )}
          </div>
        );
      })}
      {pending > 1 && (
        <div style={{ display: 'flex', gap: 6, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
          <button style={{ ...btn, ...btnSm }} disabled={!!busyAll} onClick={() => sendAll(false)}>{busyAll === 'draft' ? '儲存中…' : '全部存成草稿'}</button>
          <button style={{ ...btnP, ...btnSm }} disabled={!!busyAll} onClick={() => sendAll(true)}>{busyAll === 'submit' ? '逐份送審中…' : `全部送審（${pending} 份）`}</button>
        </div>
      )}
    </div>
  );
}
