// ClauseRef —— 條文代碼變成可點的中文編號，點了跳出原文（2026-11-10 Louis）
//   本規範：用編輯器目前內容（還沒存也看得到）；其他規範：打 /clauses/lookup 查現行版（結果快取）
//   文字裡的「1254-5.9」「[900002-3.2]」都會換；找不到的條文也標出是哪份規範、說明找不到
import { useState, Fragment } from 'react';
import { useRegApi } from './regApi';

const cache = new Map();   // code → lookup 結果
const RE = /\[?(\d{2,8}-\d+(?:\.\d+)*[a-z]?)\]?/g;
const chip = { display: 'inline-block', background: '#faf5ef', border: '1px solid #ecdcc8', borderRadius: 6, padding: '0 5px', margin: '0 2px', cursor: 'pointer', color: '#8b6f4e', fontWeight: 600 };

export function ClauseRef({ code, mine = {}, others = {} }) {
  const api = useRegApi();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState(() => cache.get(code) || null);
  const [err, setErr] = useState('');
  const m = mine[code];
  const label = m ? `本規範 ${m.no}` : info ? (info.exists ? `《${info.title}》${info.display_no}` : `《${info.title || '未知規範'}》（找不到）`) : (others[code] || code);
  const toggle = async () => {
    const next = !open; setOpen(next);
    if (next && !m && !info) {
      try {
        if (!api.lookupClauses) throw new Error('這個入口查不到其他規範');
        const r = await api.lookupClauses([code]);
        const x = (r?.data || [])[0];
        if (x) { cache.set(code, x); setInfo(x); } else setErr('查不到');
      } catch (e) { setErr(e.message || '查不到'); }
    }
  };
  return (
    <span style={{ position: 'relative', display: 'inline' }}>
      <span style={chip} title={`條文代碼 ${code}（點一下看原文）`} onClick={(e) => { e.stopPropagation(); toggle(); }}>{label}</span>
      {open && (
        <span onClick={(e) => e.stopPropagation()} style={{ display: 'block', position: 'relative', zIndex: 5, margin: '4px 0 6px', background: '#fff', border: '1px solid #ecdcc8', borderLeft: '3px solid #8b6f4e', borderRadius: 8, padding: '8px 10px', boxShadow: '0 4px 14px rgba(0,0,0,.08)', fontWeight: 400, color: '#2d3748', whiteSpace: 'normal' }}>
          {m ? (<>
            <span style={{ display: 'block', fontSize: 11, color: '#718096' }}>本規範（正在修改的這份）・{m.section ? `${m.section}・` : ''}{m.no}</span>
            <span style={{ display: 'block', marginTop: 2 }}>{m.full || '（空白）'}</span>
            {(m.notes || []).map((n, i) => <span key={i} style={{ display: 'block', fontSize: 12, color: '#4a5568', marginTop: 2 }}>{n.kind || '註'}：{n.text}</span>)}
          </>) : info ? (info.exists ? (<>
            <span style={{ display: 'block', fontSize: 11, color: '#718096' }}>其他規範《{info.title}》・{info.section_title ? `${info.section_title}・` : ''}{info.display_no}（現行版）</span>
            <span style={{ display: 'block', marginTop: 2 }}>{info.text}</span>
            {(info.notes || []).map((n, i) => <span key={i} style={{ display: 'block', fontSize: 12, color: '#4a5568', marginTop: 2 }}>{n.kind || '註'}：{n.text}</span>)}
            {info.penalty != null && <span style={{ display: 'block', fontSize: 11, color: '#9b2c2c', marginTop: 2 }}>違反扣分：{info.penalty}</span>}
          </>) : <span>《{info.title || '未知規範'}》現行版裡找不到這一條（可能已刪除，或引用的代碼寫錯）。</span>)
            : err ? <span style={{ color: '#9b2c2c' }}>{err}</span> : <span style={{ color: '#718096' }}>讀取中…</span>}
          <span style={{ display: 'block', textAlign: 'right', marginTop: 4 }}><span style={{ fontSize: 11, color: '#718096', cursor: 'pointer' }} onClick={() => setOpen(false)}>收起</span></span>
        </span>
      )}
    </span>
  );
}

/** 文字 → 文字＋可點的條文（取代 humanize 的字串版） */
export function RefText({ text, mine, others }) {
  const s = String(text || ''); const out = []; let last = 0; let k = 0;
  s.replace(RE, (m, code, idx) => { if (idx > last) out.push(<Fragment key={k++}>{s.slice(last, idx)}</Fragment>); out.push(<ClauseRef key={k++} code={code} mine={mine} others={others} />); last = idx + m.length; return m; });
  if (last < s.length) out.push(<Fragment key={k++}>{s.slice(last)}</Fragment>);
  return <>{out}</>;
}
