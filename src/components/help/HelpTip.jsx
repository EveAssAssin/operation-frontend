// components/help/HelpTip.jsx —— 每個項目右邊的「?」（2026-10-20）：點了開說明框（系統邏輯／操作辦法），點外面或 ✕ 關
import { useEffect, useRef, useState } from 'react';

export default function HelpTip({ title, body, size = 16 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [open]);
  if (!body) return null;
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block', marginLeft: 4 }} onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="說明" onClick={() => setOpen(!open)} style={{
        width: size, height: size, borderRadius: '50%', border: '1px solid #a0aec0', background: open ? '#3182ce' : '#fff',
        color: open ? '#fff' : '#4a5568', fontSize: size * 0.7, lineHeight: `${size - 2}px`, padding: 0, cursor: 'pointer', verticalAlign: 'middle',
      }}>?</button>
      {open && (
        <div style={{ position: 'absolute', zIndex: 50, top: size + 6, left: -8, width: 320, maxWidth: '80vw', background: '#fff', border: '1px solid #cbd5e0',
          borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.15)', padding: '10px 12px', fontSize: 13, color: '#2d3748', fontWeight: 400, textAlign: 'left', whiteSpace: 'normal' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <b>{title}</b><button type="button" onClick={() => setOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#718096' }}>✕</button>
          </div>
          {String(body).split('\n').map((l, i) => <div key={i} style={{ marginBottom: 4 }}>{l}</div>)}
        </div>
      )}
    </span>
  );
}
