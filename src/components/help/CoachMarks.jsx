// components/help/CoachMarks.jsx —— 矇版使用說明（2026-10-20）
// steps: [{ sel: 'CSS 選擇器（通常 [data-tour="…"]）', title, body }]；找不到元素的那一步改成畫面中間的說明框
// storageKey：第一次進頁面自動跑一次，看過就記在 localStorage；外面放「📖 使用說明」按鈕呼叫 start() 重看
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

export function useCoachMarks(steps, storageKey, autoStart = true) {
  const [idx, setIdx] = useState(-1);
  const start = useCallback(() => setIdx(0), []);
  useEffect(() => {
    if (!autoStart) return undefined;
    let seen = false;
    try { seen = !!localStorage.getItem(storageKey); } catch (e) { /* */ }
    if (seen) return undefined;
    const t = setTimeout(() => setIdx(0), 900);
    return () => clearTimeout(t);
  }, [storageKey, autoStart]);
  const close = useCallback(() => { setIdx(-1); try { localStorage.setItem(storageKey, '1'); } catch (e) { /* */ } }, [storageKey]);
  const overlay = idx >= 0 && idx < steps.length
    ? <CoachOverlay step={steps[idx]} i={idx} n={steps.length} onPrev={() => setIdx(idx - 1)} onNext={() => (idx + 1 >= steps.length ? close() : setIdx(idx + 1))} onClose={close} />
    : null;
  return { start, overlay };
}

function CoachOverlay({ step, i, n, onPrev, onNext, onClose }) {
  const [rect, setRect] = useState(null);
  useLayoutEffect(() => {
    let el = null;
    try { el = step.sel ? document.querySelector(step.sel) : null; } catch (e) { el = null; }
    if (!el) { setRect(null); return undefined; }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const upd = () => { const r = el.getBoundingClientRect(); setRect({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 }); };
    const t = setTimeout(upd, 350);
    window.addEventListener('resize', upd); window.addEventListener('scroll', upd, true);
    return () => { clearTimeout(t); window.removeEventListener('resize', upd); window.removeEventListener('scroll', upd, true); };
  }, [step]);
  const vw = window.innerWidth, vh = window.innerHeight;
  const boxW = Math.min(360, vw - 24);
  let box = { top: vh / 2 - 90, left: vw / 2 - boxW / 2 };
  if (rect) {
    const below = rect.top + rect.height + 12;
    box = { top: below + 170 < vh ? below : Math.max(12, rect.top - 190), left: Math.min(Math.max(12, rect.left), vw - boxW - 12) };
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      {rect
        ? <div style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width, height: rect.height, borderRadius: 8, boxShadow: '0 0 0 9999px rgba(0,0,0,.55)', border: '2px solid #63b3ed', pointerEvents: 'none', transition: 'all .2s' }} />
        : <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)' }} />}
      <div style={{ position: 'fixed', top: box.top, left: box.left, width: boxW, background: '#fff', borderRadius: 10, padding: 14, boxShadow: '0 8px 30px rgba(0,0,0,.3)', fontSize: 14 }}>
        <div style={{ fontSize: 12, color: '#718096' }}>使用說明 {i + 1}／{n}</div>
        <div style={{ fontWeight: 700, margin: '4px 0 6px' }}>{step.title}</div>
        {String(step.body || '').split('\n').map((l, k) => <div key={k} style={{ marginBottom: 4, color: '#2d3748' }}>{l}</div>)}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={btn('#fff', '#4a5568')}>略過</button>
          {i > 0 && <button type="button" onClick={onPrev} style={btn('#fff', '#2b6cb0')}>上一步</button>}
          <button type="button" onClick={onNext} style={btn('#2b6cb0', '#fff')}>{i + 1 >= n ? '完成' : '下一步'}</button>
        </div>
      </div>
    </div>
  );
}
const btn = (bg, c) => ({ padding: '5px 12px', borderRadius: 6, border: '1px solid #cbd5e0', background: bg, color: c, cursor: 'pointer', fontSize: 13 });
