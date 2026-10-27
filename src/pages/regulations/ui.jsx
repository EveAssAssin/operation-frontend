// 規範系統共用：樣式、顯示元件、文件工具
import React from 'react';

export const C = { bg: '#f6f2ec', card: '#fff', ink: '#2d2416', mid: '#6b5640', line: '#e6dccd', brand: '#50422d', ok: '#2f855a', bad: '#c53030' };
export const card  = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10 };
export const input = { width: '100%', boxSizing: 'border-box', border: `1px solid ${C.line}`, borderRadius: 6, padding: '6px 8px', fontSize: 14, fontFamily: 'inherit', background: '#fff' };
export const btn   = { border: `1px solid ${C.line}`, background: '#fff', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: 13, color: C.ink };
export const btnP  = { ...btn, background: C.brand, color: '#fff', borderColor: C.brand };
export const btnOk = { ...btn, background: C.ok, color: '#fff', borderColor: C.ok };
export const btnD  = { ...btn, color: C.bad, borderColor: '#feb2b2' };
export const btnSm = { padding: '1px 8px', fontSize: 12 };

export const TYPES = ['規定', '流程', '說明'];
const TYPE_STYLE = {
  規定: { background: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2' },
  流程: { background: '#ebf4ff', color: '#2b6cb0', border: '1px solid #bee3f8' },
  說明: { background: '#f1f3f6', color: '#4a5568', border: '1px solid #cbd5e0' },
  例:   { background: '#f0fff4', color: '#2f855a', border: '1px solid #c6f6d5' },
  註:   { background: '#fffaf0', color: '#975a16', border: '1px solid #fbd38d' },
};
export function TypeBadge({ t }) {
  if (!t) return <span style={{ fontSize: 10.5, color: '#a0aec0', marginRight: 4 }}>未分類</span>;
  return <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, padding: '0 6px', borderRadius: 8, lineHeight: '18px', marginRight: 4, ...(TYPE_STYLE[t] || {}) }}>{t}</span>;
}
const RISK = { 高: ['#fed7d7', '#9b2c2c'], 中: ['#feebc8', '#7b341e'], 低: ['#c6f6d5', '#22543d'] };
export function RiskBadge({ r }) {
  if (!r) return null;
  const [bg, fg] = RISK[r] || ['#e2e8f0', '#4a5568'];
  return <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '0 7px', background: bg, color: fg, whiteSpace: 'nowrap' }}>{r}風險</span>;
}
const STATUS = { draft: ['草稿', '#e2e8f0', '#4a5568'], pending: ['送審中', '#feebc8', '#7b341e'], returned: ['被退回', '#fed7d7', '#9b2c2c'], approved: ['已通過', '#c6f6d5', '#22543d'], discarded: ['已捨棄', '#edf2f7', '#a0aec0'], rejected: ['已駁回', '#fed7d7', '#9b2c2c'] };
export function StatusBadge({ s }) {
  const [t, bg, fg] = STATUS[s] || [s, '#e2e8f0', '#4a5568'];
  return <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '0 7px', background: bg, color: fg, whiteSpace: 'nowrap' }}>{t}</span>;
}

export const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
export const cnNo = (i) => CN[i] || String(i + 1);
export function noOf(level, path) {
  if (level === 1) return `${path[0] + 1}.`;
  if (level === 2) return `${path[0] + 1}-${path[1] + 1}.`;
  return `${path[0] + 1}-${path[1] + 1}.${path.slice(2).map(n => n + 1).join('.')}`;
}
export const linkify = (s) => String(s || '').split(/(『[^』]+』)/g).map((p, i) => p.startsWith('『') ? <b key={i} style={{ color: '#1e40af' }}>{p}</b> : p);
export const fmtTime = (t) => (t ? new Date(t).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const clone = (o) => JSON.parse(JSON.stringify(o));

/** 規範內容顯示（唯讀） */
export function DocView({ doc, highlight = {}, compact = false }) {
  if (!doc) return null;
  const Clause = ({ c, level, path }) => {
    const h = c.code && highlight[c.code];
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: `${compact ? 0 : 92}px 1fr`, gap: 6, padding: '6px 4px', borderBottom: '1px dashed #efe6d8', marginLeft: (level - 1) * 20,
          background: h === 'add' ? '#f0fff4' : h === 'mod' ? '#fffbea' : undefined, borderLeft: h ? `3px solid ${h === 'add' ? '#38a169' : '#d69e2e'}` : '3px solid transparent' }}>
          {!compact && <div style={{ fontFamily: 'ui-monospace,Consolas,monospace', fontSize: 11, color: '#8b6f4e', paddingTop: 2 }}>{c.code}</div>}
          <div>
            <b style={{ marginRight: 4 }}>{noOf(level, path)}</b>
            {c.pen != null && <span style={{ fontSize: 11, color: C.bad, marginRight: 4, border: '1px solid #feb2b2', borderRadius: 6, padding: '0 5px' }}>扣 {c.pen}</span>}
            <span style={{ whiteSpace: 'pre-wrap' }}>{linkify(c.text)}</span>
            {(c.notes || []).map((n, i) => (
              <div key={i} style={{ fontSize: 13, color: '#5a4a36', marginTop: 3, paddingLeft: 10, borderLeft: `2px solid ${n.kind === '例' ? '#c6f6d5' : '#fbd38d'}`, whiteSpace: 'pre-wrap' }}>
                <TypeBadge t={n.kind} />{linkify(n.text)}
              </div>
            ))}
            {(c.images || []).length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                {c.images.map((im, i) => (
                  <figure key={i} style={{ margin: 0, maxWidth: 260 }}>
                    <a href={im.url} target="_blank" rel="noreferrer"><img src={im.url} alt={im.caption || ''} style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 6, border: `1px solid ${C.line}` }} /></a>
                    {im.caption && <figcaption style={{ fontSize: 12, color: C.mid }}>{im.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            )}
            {(c.flags || []).length > 0 && <div style={{ fontSize: 11, color: '#b7791f', marginTop: 2 }}>⚠ {c.flags.join('、')}</div>}
          </div>
        </div>
        {(c.subs || []).map((s, i) => <Clause key={s.code || i} c={s} level={level + 1} path={[...path, i]} />)}
      </>
    );
  };
  return (
    <div>
      {(doc.sections || []).map((s, si) => (
        <div key={si} style={{ marginTop: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800, borderBottom: `2px solid ${C.line}`, paddingBottom: 3, marginBottom: 2 }}>{cnNo(si)}、{s.title || '（未命名大項）'}</div>
          {(s.items || []).map((c, i) => <Clause key={c.code || i} c={c} level={1} path={[i]} />)}
        </div>
      ))}
    </div>
  );
}

export function Modal({ title, children, onClose, width = 560 }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <b style={{ fontSize: 16 }}>{title}</b><button style={{ ...btn, border: 'none' }} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, style }) {
  return <div style={{ display: 'block', marginBottom: 10, ...style }}><div style={{ fontSize: 12, color: C.mid, marginBottom: 3 }}>{label}</div>{children}</div>;
}

/** 員工搜尋選擇（姓名、門市、ERP 編號或 APP 編號） */
export function EmployeePicker({ api, value, onChange, placeholder = '輸入姓名、門市、ERP 或 APP 編號' }) {
  const [q, setQ] = React.useState('');
  const [list, setList] = React.useState([]);
  const [state, setState] = React.useState('');   // '' | 'loading' | 'empty' | 'error'
  React.useEffect(() => {
    const s = q.replace(/[\u3100-\u312F\u02C7\u02CA\u02CB\u02D9]/g, '').trim();   // 注音還沒選字時先不查
    if (!s) { setList([]); setState(''); return; }
    setState('loading');
    const t = setTimeout(() => api.employees(s)
      .then(r => { const rows = r?.success ? r.data : []; setList(rows); setState(r?.success ? (rows.length ? '' : 'empty') : 'error'); })
      .catch(() => { setList([]); setState('error'); }), 350);
    return () => clearTimeout(t);
  }, [q, api]);
  if (value) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: `1px solid ${C.line}`, borderRadius: 6, background: '#f0fff4' }}>
      <span>✓ <b>{value.name}</b>（{value.store_name || '—'}，ERP {value.erpid}{value.app_number ? `，APP ${value.app_number}` : '，⚠ 沒有 APP 編號'}）</span>
      <button type="button" style={{ ...btn, ...btnSm, marginLeft: 'auto' }} onClick={() => onChange(null)}>重選</button>
    </div>
  );
  return (
    <div style={{ position: 'relative' }}>
      <input style={input} value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} />
      {(list.length > 0 || state) && (
        <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, ...card, maxHeight: 260, overflow: 'auto', marginTop: 2, boxShadow: '0 6px 18px rgba(0,0,0,.12)' }}>
          {state === 'loading' && !list.length && <div style={{ padding: '8px 10px', color: C.mid }}>搜尋中…</div>}
          {state === 'empty' && <div style={{ padding: '8px 10px', color: C.mid }}>找不到符合的在職員工</div>}
          {state === 'error' && <div style={{ padding: '8px 10px', color: C.bad }}>搜尋失敗，請重新整理頁面再試</div>}
          {list.map(e => (
            <button type="button" key={e.erpid} onMouseDown={(ev) => ev.preventDefault()} onClick={() => { onChange(e); setQ(''); setList([]); setState(''); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', cursor: 'pointer', border: 'none', borderBottom: `1px solid ${C.line}`, background: '#fff', fontSize: 14 }}>
              <b>{e.name}</b> <span style={{ color: C.mid, fontSize: 12 }}>{e.store_name} · {e.jobtitle || ''} · ERP {e.erpid}{e.app_number ? '' : ' · 沒有 APP 編號'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
