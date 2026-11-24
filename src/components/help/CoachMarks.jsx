// components/help/CoachMarks.jsx —— 矇版使用說明（2026-10-20）
// steps: [{ sel: 'CSS 選擇器（通常 [data-tour="…"]）', title, body }]；找不到元素的那一步改成畫面中間的說明框
// 2026-11-24 營運：不再自動跳出（每次打開都跳很煩）→ 只有使用者按了才顯示：
//   ① 右下角 🐞 打開 →「📖 這一頁的教學」按鈕（這裡登記的 start）② 頁面上原本的「📖 使用說明」按鈕
// 第三個參數 available：這一頁現在有沒有這份教學（例如月報總覽／單店各一份）；true＝登記到 🐞 的教學清單
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// ── 目前頁面可用的教學（給 ReportBug 的教學按鈕用）──
const registry = new Map();   // id → { label, start }
let seq = 0;
export function availableTours() { return [...registry.values()]; }
/** 不是 useCoachMarks 的說明（例如自己做的說明框）也登記到 🐞 的教學清單 */
export function useRegisterTour(label, start, available = true) {
  const id = useRef(null);
  if (id.current == null) id.current = `g${++seq}`;
  useEffect(() => {
    if (!available) return undefined;
    const k = id.current; registry.set(k, { label, start });
    return () => { registry.delete(k); };
  }, [label, start, available]);
}

export function useCoachMarks(steps, storageKey, available = true, label) {
  const [idx, setIdx] = useState(-1);
  const start = useCallback(() => setIdx(0), []);
  const id = useRef(null);
  if (id.current == null) id.current = `t${++seq}`;
  useEffect(() => {
    if (!available || !steps || !steps.length) return undefined;
    registry.set(id.current, { label: label || (steps[0] && steps[0].title) || '使用說明', start });
    const k = id.current;
    return () => { registry.delete(k); };
  }, [available, steps, label, start]);
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
