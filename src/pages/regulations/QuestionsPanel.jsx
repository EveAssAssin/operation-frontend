// 人員在「查規範」問了什麼：找不到答案、覺得沒幫助的問題 → 代表規範沒寫到或寫不清楚
import React, { useEffect, useState } from 'react';
import { regulationApi as api } from '../../services/api';
import { C, card, btn, btnSm, fmtTime } from './ui';

export default function QuestionsPanel() {
  const [f, setF] = useState('false');
  const [rows, setRows] = useState(null);
  useEffect(() => { setRows(null); api.questions(f || undefined).then(r => setRows(r?.success ? r.data : [])); }, [f]);
  return (
    <div style={card}>
      <div style={{ padding: 8, display: 'flex', gap: 6, borderBottom: `1px solid ${C.line}`, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['false', '規範裡找不到答案'], ['unhelpful', '人員覺得沒幫助'], ['', '全部提問']].map(([k, l]) => (
          <button key={k} style={{ ...btn, ...btnSm, ...(f === k ? { background: C.brand, color: '#fff', borderColor: C.brand } : {}) }} onClick={() => setF(k)}>{l}</button>
        ))}
        <span style={{ fontSize: 12, color: C.mid, marginLeft: 'auto' }}>人員查規範網址：<code>{window.location.origin}/rules?app_number=APP編號</code></span>
      </div>
      {!rows && <div style={{ padding: 16, color: C.mid }}>載入中…</div>}
      {rows && !rows.length && <div style={{ padding: 16, color: '#a0aec0' }}>沒有資料</div>}
      {(rows || []).map(q => (
        <div key={q.id} style={{ padding: '10px 12px', borderBottom: `1px solid ${C.line}`, fontSize: 13 }}>
          <div><b>{q.question}</b> {q.found === false && <span style={{ fontSize: 11, background: '#fffaf0', color: '#975a16', borderRadius: 6, padding: '0 6px' }}>找不到</span>}
            {q.helpful === false && <span style={{ fontSize: 11, background: '#fed7d7', color: '#9b2c2c', borderRadius: 6, padding: '0 6px', marginLeft: 4 }}>👎 沒幫助</span>}
            {q.helpful === true && <span style={{ fontSize: 11, marginLeft: 4 }}>👍</span>}</div>
          <div style={{ color: C.mid, fontSize: 12 }}>{q.employee_name}・{q.store_name}・{fmtTime(q.created_at)}{q.citations?.length ? `・引用 ${q.citations.join('、')}` : ''}</div>
          <details><summary style={{ cursor: 'pointer', color: C.mid, fontSize: 12 }}>AI 回答</summary><div style={{ whiteSpace: 'pre-wrap' }}>{q.answer}</div></details>
        </div>
      ))}
    </div>
  );
}
