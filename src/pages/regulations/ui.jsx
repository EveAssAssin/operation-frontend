// 規範系統共用：樣式、顯示元件、文件工具
import React, { useState } from 'react';

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
/** 條文內文：markdown 表格（| a | b |）畫成表格，其他照原樣換行；格子裡的 <br> 換行 */
const isMdTable = (s) => { const l = String(s || '').split('\n'); return l.length >= 2 && /^\|.*\|$/.test(l[0].trim()) && /^\|\s*-{3}/.test(l[1].trim()); };
const cellsOf = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
const brText = (t) => String(t).split(/<br\s*\/?>/i).map((x, i) => <span key={i}>{i > 0 && <br />}{linkify(x)}</span>);
export function ClauseText({ text }) {
  const s = String(text || '');
  if (!isMdTable(s)) return <span style={{ whiteSpace: 'pre-wrap' }}>{linkify(s)}</span>;
  const lines = s.split('\n').filter(l => l.trim());
  const head = cellsOf(lines[0]); const body = lines.slice(2).map(cellsOf);
  const td = { border: '1px solid #e2d6c3', padding: '4px 6px', verticalAlign: 'top', fontSize: 12.5, minWidth: 60 };
  return (
    <div style={{ overflowX: 'auto', marginTop: 4, maxWidth: '100%' }}>
      <table style={{ borderCollapse: 'collapse', background: '#fff' }}>
        <thead><tr>{head.map((h, i) => <th key={i} style={{ ...td, background: '#f5efe6', fontWeight: 600, whiteSpace: 'nowrap' }}>{brText(h)}</th>)}</tr></thead>
        <tbody>{body.map((r, i) => <tr key={i}>{head.map((_, j) => <td key={j} style={td}>{brText(r[j] || '')}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
export const fmtTime = (t) => (t ? new Date(t).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const clone = (o) => JSON.parse(JSON.stringify(o));

/** 規範內容顯示（唯讀） */
export function DocView({ doc, highlight = {}, compact = false, toc = true }) {
  const [zoom, setZoom] = useState(null);   // 點圖片放大
  if (!doc) return null;
  const secs = doc.sections || [];
  const goSec = (si) => document.getElementById(`sec-${si}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const Clause = ({ c, level, path }) => {
    const h = c.code && highlight[c.code];
    return (
      <>
        <div id={c.code ? `c-${c.code}` : undefined} style={{ display: 'grid', gridTemplateColumns: `${compact ? 0 : 92}px 1fr`, gap: 6, padding: '6px 4px', borderBottom: '1px dashed #efe6d8', marginLeft: (level - 1) * (compact ? 12 : 20),
          background: h === 'add' ? '#f0fff4' : h === 'mod' ? '#fffbea' : h === 'focus' ? '#fff3bf' : undefined,
          borderLeft: h ? `3px solid ${h === 'add' ? '#38a169' : h === 'focus' ? '#f59f00' : '#d69e2e'}` : '3px solid transparent', scrollMarginTop: 70 }}>
          {!compact && <div style={{ fontFamily: 'ui-monospace,Consolas,monospace', fontSize: 11, color: '#8b6f4e', paddingTop: 2 }}>{c.code}</div>}
          <div>
            {compact && c.code && <span style={{ fontFamily: 'ui-monospace,Consolas,monospace', fontSize: 10.5, color: '#a0896b', marginRight: 4 }}>{c.code}</span>}
            <b style={{ marginRight: 4 }}>{noOf(level, path)}</b>
            {c.pen != null && <span style={{ fontSize: 11, color: C.bad, marginRight: 4, border: '1px solid #feb2b2', borderRadius: 6, padding: '0 5px' }}>扣 {c.pen}</span>}
            <ClauseText text={c.text} />
            {(c.notes || []).map((n, i) => (
              <div key={i} style={{ fontSize: 13, color: '#5a4a36', marginTop: 3, paddingLeft: 10, borderLeft: `2px solid ${n.kind === '例' ? '#c6f6d5' : '#fbd38d'}`, whiteSpace: 'pre-wrap' }}>
                <TypeBadge t={n.kind} />{linkify(n.text)}
              </div>
            ))}
            {(c.images || []).length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                {c.images.map((im, i) => (
                  <figure key={i} style={{ margin: 0, maxWidth: compact ? '100%' : 360 }}>
                    <img src={im.url} alt={im.caption || ''} onClick={() => setZoom(im)} style={{ maxWidth: '100%', maxHeight: compact ? 360 : 260, borderRadius: 6, border: `1px solid ${C.line}`, cursor: 'zoom-in', display: 'block' }} />
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
      {toc && secs.length > 1 && (
        <div data-yaya="reg-toc" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0 4px', padding: '8px 8px 6px', background: '#fcfaf6', border: `1px solid ${C.line}`, borderRadius: 10 }}>
          <span style={{ fontSize: 12, color: C.mid, width: '100%' }}>📑 快速前往</span>
          {secs.map((s, si) => (
            <button key={si} onClick={() => goSec(si)} style={{ border: `1px solid ${C.line}`, background: '#fff', borderRadius: 16, padding: '3px 10px', fontSize: 13, cursor: 'pointer', color: C.ink, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cnNo(si)}、{s.title || '（未命名大項）'}
            </button>
          ))}
        </div>
      )}
      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <img src={zoom.url} alt={zoom.caption || ''} style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }} />
          {zoom.caption && <div style={{ color: '#fff', marginTop: 8, fontSize: 14 }}>{zoom.caption}</div>}
          <div style={{ color: '#ddd', marginTop: 8, fontSize: 12 }}>點一下關閉</div>
        </div>
      )}
      {secs.map((s, si) => (
        <div key={si} id={`sec-${si}`} style={{ marginTop: 12, scrollMarginTop: 64 }}>
          <div style={{ fontSize: 16, fontWeight: 800, borderBottom: `2px solid ${C.line}`, paddingBottom: 3, marginBottom: 2, display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ flex: 1 }}>{cnNo(si)}、{s.title || '（未命名大項）'}</span>
            {toc && secs.length > 1 && <span onClick={() => document.querySelector('[data-yaya="reg-toc"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} style={{ fontSize: 11, fontWeight: 400, color: C.mid, cursor: 'pointer' }}>↑ 目錄</span>}
          </div>
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

/** 規範最上方「最近修改」：AI 白話說明這次改了什麼（30 天內、本系統審核通過的版本） */
export function RecentChange({ rc, mark, onToggleMark }) {
  if (!rc) return null;
  const d = rc.published_at ? new Date(rc.published_at) : null;
  const n = rc.counts || {};
  return (
    <div data-yaya="reg-recent" style={{ background: '#fffbea', border: '1px solid #f6e05e', borderRadius: 10, padding: '8px 12px', marginTop: 10, fontSize: 14 }}>
      <div style={{ fontWeight: 800, color: '#975a16' }}>🆕 最近修改{d ? `（${d.getMonth() + 1}/${d.getDate()} 第 ${rc.version} 版）` : ''}</div>
      {(rc.summary || []).length > 0
        ? <ul style={{ margin: '4px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>{rc.summary.map((x, i) => <li key={i}>{x}</li>)}</ul>
        : rc.change_note ? <div style={{ marginTop: 4 }}>{rc.change_note}</div> : null}
      <div style={{ fontSize: 12, color: C.mid, marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span>{[n.add ? `新增 ${n.add} 條` : '', n.mod ? `修改 ${n.mod} 條` : '', n.del ? `刪除 ${n.del} 條` : ''].filter(Boolean).join('・') || '調整基本資料'}{rc.ai ? '・說明由 AI 整理' : ''}</span>
        {onToggleMark && (rc.codes || []).length > 0 && <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={!!mark} onChange={e => onToggleMark(e.target.checked)} />在內文標出修改的條文</label>}
      </div>
    </div>
  );
}
