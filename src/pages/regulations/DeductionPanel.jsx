// 引用條文扣分：選員工 → 搜尋條文 → 扣分單 → 審核通過寫入 MAP（事由帶條文代碼）
import React, { useCallback, useEffect, useState } from 'react';
import { regulationApi as api } from '../../services/api';
import { C, card, input, btn, btnP, btnOk, btnD, btnSm, Field, EmployeePicker, StatusBadge, fmtTime, Modal } from './ui';

export default function DeductionPanel({ canApprove }) {
  const [emp, setEmp] = useState(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [clause, setClause] = useState(null);
  const [score, setScore] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null);
  const [status, setStatus] = useState('pending');
  const [list, setList] = useState([]);
  const [rejecting, setRejecting] = useState(null);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => api.clauses(q.trim()).then(r => setHits(r?.success ? r.data : [])), 300);
    return () => clearTimeout(t);
  }, [q]);
  const loadList = useCallback(() => api.deductions({ status: status || undefined }).then(r => setList(r?.success ? r.data : [])), [status]);
  useEffect(() => { loadList(); }, [loadList]);

  const pick = (c) => { setClause(c); setHits([]); setQ(''); setScore(String(c.penalty ?? c.regulations?.score ?? -1)); };
  const create = async () => {
    setMsg(null);
    if (!emp || !clause) { setMsg({ err: true, text: '請選員工和條文' }); return; }
    const r = await api.createDeduction({ employee_erpid: emp.erpid, clause_code: clause.code, score: Number(score), incident_date: date, note });
    if (!r?.success) { setMsg({ err: true, text: r?.message || '建立失敗' }); return; }
    setMsg({ text: `已建立扣分單（${emp.name}，${clause.code}），等審核通過後寫入 MAP` });
    setEmp(null); setClause(null); setNote(''); setScore(''); loadList();
  };
  const approve = async (d) => {
    if (!window.confirm(`通過後會寫入 MAP：${d.employee_name} ${d.score} 分\n【${d.clause_code}】${d.clause_text.slice(0, 40)}`)) return;
    const r = await api.approveDeduction(d.id);
    setMsg(r?.success ? { text: `已寫入 MAP：${r.data.map_message}` } : { err: true, text: r?.message || '失敗' });
    loadList();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,420px) minmax(0,1fr)', gap: 12, alignItems: 'start' }}>
      <div style={{ ...card, padding: 14 }}>
        <b style={{ fontSize: 16 }}>開扣分單</b>
        <div style={{ fontSize: 12, color: C.mid, margin: '2px 0 10px' }}>引用到「條」：員工會看到違反哪一條、哪一版，申訴也針對這一條。</div>
        <Field label="員工 *"><EmployeePicker api={api} value={emp} onChange={setEmp} /></Field>
        <Field label="違反條文 *">
          {clause ? (
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: 8, background: '#fcfaf6' }}>
              <div style={{ fontSize: 12 }}><span style={{ fontFamily: 'monospace', color: '#8b6f4e' }}>{clause.code}</span> {clause.display_no} <b>{clause.regulations?.title}</b>（第 {clause.version} 版）</div>
              <div style={{ fontSize: 13, marginTop: 3, whiteSpace: 'pre-wrap' }}>{clause.text}</div>
              <button style={{ ...btn, ...btnSm, marginTop: 4 }} onClick={() => setClause(null)}>更換條文</button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input style={input} value={q} onChange={e => setQ(e.target.value)} placeholder="輸入關鍵字或條文代碼（例如：結帳、903-4.1）" />
              {hits.length > 0 && (
                <div style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, ...card, maxHeight: 320, overflow: 'auto', marginTop: 2 }}>
                  {hits.map(h => (
                    <div key={h.code} onClick={() => pick(h)} style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: `1px solid ${C.line}`, fontSize: 13 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#8b6f4e' }}>{h.code}</span> <b>{h.regulations?.title}</b>
                      <div style={{ color: C.mid, fontSize: 12 }}>{h.text.length > 80 ? `${h.text.slice(0, 80)}…` : h.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Field label="分數（負數＝扣分）" style={{ flex: 1 }}><input type="number" style={input} value={score} onChange={e => setScore(e.target.value)} /></Field>
          <Field label="發生日期" style={{ flex: 1 }}><input type="date" style={input} value={date} onChange={e => setDate(e.target.value)} /></Field>
        </div>
        <Field label="事證說明"><textarea style={{ ...input, minHeight: 70 }} value={note} onChange={e => setNote(e.target.value)} placeholder="時間、地點、發生經過" /></Field>
        {msg && <div style={{ fontSize: 13, color: msg.err ? C.bad : C.ok, marginBottom: 8 }}>{msg.text}</div>}
        <button style={btnP} onClick={create}>建立扣分單</button>
      </div>

      <div style={card}>
        <div style={{ padding: 8, display: 'flex', gap: 6, borderBottom: `1px solid ${C.line}` }}>
          {[['pending', '待審'], ['approved', '已寫入 MAP'], ['rejected', '已駁回'], ['', '全部']].map(([k, l]) => (
            <button key={k} style={{ ...btn, ...btnSm, ...(status === k ? { background: C.brand, color: '#fff', borderColor: C.brand } : {}) }} onClick={() => setStatus(k)}>{l}</button>
          ))}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#f6f1ea', color: C.mid }}>
              {['員工', '條文', '分數', '說明', '狀態', '建立', ''].map(h => <th key={h} style={{ padding: 6, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map(d => (
                <tr key={d.id} style={{ borderTop: `1px solid ${C.line}`, verticalAlign: 'top' }}>
                  <td style={{ padding: 6 }}><b>{d.employee_name}</b><div style={{ fontSize: 11, color: C.mid }}>{d.store_name}</div></td>
                  <td style={{ padding: 6, maxWidth: 320 }}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#8b6f4e' }}>{d.clause_code}</span> {d.regulation_title} v{d.version}
                    <div style={{ fontSize: 12, color: C.mid }}>{d.clause_text.length > 60 ? `${d.clause_text.slice(0, 60)}…` : d.clause_text}</div></td>
                  <td style={{ padding: 6, fontWeight: 700, color: d.score < 0 ? C.bad : C.ok }}>{d.score}</td>
                  <td style={{ padding: 6, fontSize: 12, maxWidth: 200 }}>{d.incident_date && <div>{d.incident_date}</div>}{d.note}</td>
                  <td style={{ padding: 6 }}><StatusBadge s={d.status} />{d.map_status === 'failed' && <div style={{ fontSize: 11, color: C.bad }}>MAP 失敗：{d.map_message}</div>}
                    {d.reject_reason && <div style={{ fontSize: 11, color: C.mid }}>{d.reject_reason}</div>}</td>
                  <td style={{ padding: 6, fontSize: 12, color: C.mid, whiteSpace: 'nowrap' }}>{d.created_by_name}<div>{fmtTime(d.created_at)}</div></td>
                  <td style={{ padding: 6, whiteSpace: 'nowrap' }}>{d.status === 'pending' && canApprove && (
                    <><button style={{ ...btnOk, ...btnSm }} onClick={() => approve(d)}>通過</button> <button style={{ ...btnD, ...btnSm }} onClick={() => setRejecting(d)}>駁回</button></>)}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#a0aec0' }}>沒有扣分單</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {rejecting && <RejectModal d={rejecting} onClose={() => setRejecting(null)} onDone={(m) => { setRejecting(null); setMsg(m); loadList(); }} />}
    </div>
  );
}

function RejectModal({ d, onClose, onDone }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title={`駁回扣分單：${d.employee_name}`} onClose={onClose}>
      <textarea style={{ ...input, minHeight: 90 }} value={reason} onChange={e => setReason(e.target.value)} placeholder="駁回原因" autoFocus />
      <div style={{ textAlign: 'right', marginTop: 10 }}>
        <button style={btn} onClick={onClose}>取消</button>{' '}
        <button style={btnD} disabled={!reason.trim()} onClick={async () => { const r = await api.rejectDeduction(d.id, reason.trim()); onDone(r?.success ? { text: '已駁回' } : { err: true, text: r?.message || '失敗' }); }}>確認駁回</button>
      </div>
    </Modal>
  );
}
