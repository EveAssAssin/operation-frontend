// components/ReportBug.jsx
// 側邊「🐞 回報問題／優化需求」（2026-11-03 營運：行政人員用電腦登入，讓他們直接回報，Claude 讀得到不用轉傳）
// 走寵物服務同一條回報管道：POST https://lohas-pet.onrender.com/pub/webreport(/img)
//   → lohas-pet bug_reports（page = web:operation）→ 市場部「芽芽回報」後台＋LINE 通知
// 自動帶：登入者客編／姓名、目前頁面、除錯資訊（/ydebug.js：最近錯誤、失敗的 API、點擊、換頁；不收輸入內容與憑證）
// 截圖：選檔或直接 Ctrl+V 貼上，瀏覽器先縮成 JPEG（伺服器上限 800KB、最多 3 張）

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';

const PET = 'https://lohas-pet.onrender.com';
const SYS = 'operation';
const KINDS = [
  { v: 'bug', label: '🐞 系統有問題（BUG）' },
  { v: 'idea', label: '💡 優化需求／建議' },
];

// 頁面一載入就掛除錯收集（才收得到回報之前發生的錯誤）
export function useReportDebug() {
  useEffect(() => {
    if (window.__yayaDebug || document.getElementById('yaya-debug-js')) return;
    const s = document.createElement('script');
    s.id = 'yaya-debug-js';
    s.src = PET + '/ydebug.js';
    s.async = true;
    document.head.appendChild(s);
  }, []);
}

function shrink(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let max = 1600, q = 0.82, out = '';
        for (let i = 0; i < 5; i++) {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          const g = c.getContext('2d');
          g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
          g.drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (out.length * 0.75 < 760 * 1024) break;
          max = Math.round(max * 0.8); q = Math.max(0.6, q - 0.08);
        }
        URL.revokeObjectURL(url);
        resolve(out);
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('讀不到這張圖')); };
    img.src = url;
  });
}

// 截目前畫面：優先用瀏覽器內建「分享畫面」（Chrome／Edge 會直接選這個分頁，畫面最準），
// 不支援或被拒就退回 html2canvas（依網頁內容重畫，不用權限但少數圖可能畫不出來）
function canvasToJpeg(c) {
  let w = c.width, h = c.height, q = 0.82, out = '';
  for (let i = 0; i < 5; i++) {
    const k = Math.min(1, 1600 / Math.max(w, h));
    const d = document.createElement('canvas');
    d.width = Math.round(w * k); d.height = Math.round(h * k);
    const g = d.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, d.width, d.height);
    g.drawImage(c, 0, 0, d.width, d.height);
    out = d.toDataURL('image/jpeg', q);
    if (out.length * 0.75 < 760 * 1024) break;
    w = Math.round(w * 0.8); h = Math.round(h * 0.8); q = Math.max(0.6, q - 0.08);
  }
  return out;
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));
async function grabWithDisplayMedia(stream) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.srcObject = stream;
  await v.play();
  await wait(500); // 等對話框收起來、畫面更新
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  stream.getTracks().forEach(t => t.stop());
  return canvasToJpeg(c);
}
let h2cLoading = null;
function loadHtml2canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (!h2cLoading) h2cLoading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = () => res(window.html2canvas); s.onerror = () => { h2cLoading = null; rej(new Error('截圖工具載入失敗')); };
    document.head.appendChild(s);
  });
  return h2cLoading;
}
async function grabWithHtml2canvas() {
  const h2c = await loadHtml2canvas();
  await wait(200);
  const c = await h2c(document.body, {
    useCORS: true, logging: false, scale: Math.min(2, window.devicePixelRatio || 1),
    x: window.scrollX, y: window.scrollY, width: window.innerWidth, height: window.innerHeight,
    ignoreElements: (el) => el.getAttribute && /^op-report-(mask|fab)$/.test(el.getAttribute('data-yaya') || ''),
  });
  return canvasToJpeg(c);
}

async function post(path, body) {
  const r = await fetch(PET + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  if (!j) throw new Error('伺服器沒有回應（HTTP ' + r.status + '）');
  return j;
}

export default function ReportBug({ user, onClose }) {
  const location = useLocation();
  const [kind, setKind] = useState('bug');
  const [text, setText] = useState('');
  const [shots, setShots] = useState([]); // dataURL
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const fileRef = useRef(null);
  const where = location.pathname;
  const pageTitle = (document.querySelector('main h1, main h2')?.textContent || '').trim().slice(0, 40);

  async function addFiles(files) {
    setErr('');
    const list = Array.from(files || []).filter(f => /^image\//.test(f.type));
    for (const f of list) {
      try {
        const d = await shrink(f);
        setShots(s => (s.length >= 3 ? s : [...s, d]));
      } catch (e) { setErr(e.message || '圖片讀不到'); }
    }
  }

  useEffect(() => {
    const onPaste = (e) => {
      const items = Array.from(e.clipboardData?.items || []).filter(i => i.kind === 'file' && /^image\//.test(i.type));
      if (!items.length) return;
      e.preventDefault();
      addFiles(items.map(i => i.getAsFile()).filter(Boolean));
    };
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('paste', onPaste); window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  async function captureScreen() {
    if (shots.length >= 3) { setErr('最多附 3 張圖'); return; }
    setErr('');
    let stream = null;
    const md = navigator.mediaDevices;
    if (md && md.getDisplayMedia) {
      setCapturing(true);
      try {
        // 要在點擊當下呼叫（瀏覽器規定）；Chrome／Edge 會優先選這個分頁
        stream = await md.getDisplayMedia({
          video: { displaySurface: 'browser' }, audio: false,
          preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude',
        });
      } catch (e) {
        stream = null; // 按了取消或不支援 → 改用重畫的方式
      }
    }
    setCapturing(true);
    try {
      const d = stream ? await grabWithDisplayMedia(stream) : await grabWithHtml2canvas();
      setShots(s => (s.length >= 3 ? s : [...s, d]));
    } catch (e) {
      setErr('截不到畫面：' + (e.message || '請改用鍵盤截圖後 Ctrl+V 貼上'));
    } finally {
      if (stream) stream.getTracks().forEach(t => t.stop());
      setCapturing(false);
    }
  }

  async function submit() {
    if (busy) return;
    const t = text.trim();
    if (!t && !shots.length) { setErr('寫一句發生什麼事，或附上截圖'); return; }
    setBusy(true); setErr('');
    try {
      const who = String(user?.app_number || user?.member_id || '').trim();
      const keys = [];
      for (const img of shots) {
        const o = await post('/pub/webreport/img', { sys: SYS, who, img });
        if (!o.ok) throw new Error(o.message || '圖片上傳失敗');
        keys.push(o.key);
      }
      let debug = null;
      try {
        debug = window.__yayaDebug ? window.__yayaDebug.collect({
          web: { sys: SYS, sys_title: '營運部系統', kind, page_title: pageTitle, role: user?.role || '', desktop: true },
        }) : null;
      } catch { debug = null; }
      const head = kind === 'idea' ? '【💡 優化需求】' : '【🐞 BUG】';
      const o = await post('/pub/webreport', {
        sys: SYS, sysName: '營運部系統', who,
        name: user?.name || '',
        where: where + (pageTitle ? '（' + pageTitle + '）' : ''),
        text: (head + (t || '（見截圖）')).slice(0, 500),
        imgs: keys, debug,
      });
      if (!o.ok) throw new Error(o.message || '送出失敗');
      setDone(o.id);
    } catch (e) {
      setErr(e.message || '送出失敗，再試一次');
    } finally { setBusy(false); }
  }

  return createPortal(
    <div style={{ ...S.mask, ...(capturing ? { visibility: 'hidden' } : null) }} data-yaya="op-report-mask" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div style={S.box} data-yaya="op-report">
        {done ? (
          <>
            <div style={S.title}>✅ 已送出（#{done}）</div>
            <p style={S.p}>已通知負責的同仁，處理好會回覆你。頁面路徑和最近的錯誤紀錄已經一起附上，不用再另外截給誰。</p>
            <div style={S.row}><button style={S.primary} onClick={onClose}>好</button></div>
          </>
        ) : (
          <>
            <div style={S.title}>回報問題／優化需求</div>
            <div style={S.kinds}>
              {KINDS.map(k => (
                <button key={k.v} onClick={() => setKind(k.v)}
                  style={{ ...S.kind, ...(kind === k.v ? S.kindOn : null) }}>{k.label}</button>
              ))}
            </div>
            <div style={S.meta}>頁面：{where}{pageTitle ? `（${pageTitle}）` : ''}　回報人：{user?.name || '—'}</div>
            <textarea style={S.ta} autoFocus maxLength={480} value={text} onChange={e => setText(e.target.value)}
              placeholder={kind === 'idea'
                ? '想改成怎樣？例：月報可以多一欄「去年同月」比較'
                : '發生什麼事？例：按「月報完成」跳出錯誤、數字跟試算表對不起來（哪一格）'} />
            <div style={S.count}>{text.length}/480</div>
            <div style={S.shots}>
              {shots.map((d, i) => (
                <div key={i} style={S.shot}>
                  <img src={d} alt="" style={S.shotImg} />
                  <button style={S.x} onClick={() => setShots(s => s.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
              {shots.length < 3 && (
                <button style={{ ...S.add, borderStyle: 'solid', background: '#fff5e6', fontWeight: 700 }} data-yaya="op-report-shot"
                  disabled={capturing || busy} onClick={captureScreen}
                  title="把目前看到的畫面截下來（這個視窗會先藏起來）">📸 截目前<br />畫面</button>
              )}
              {shots.length < 3 && (
                <button style={S.add} onClick={() => fileRef.current?.click()}>＋ 選圖片<br /><span style={{ fontSize: 11 }}>或 Ctrl+V 貼上</span></button>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            </div>
            {err && <div style={S.err}>{err}</div>}
            <div style={S.row}>
              <button style={S.ghost} disabled={busy} onClick={onClose}>取消</button>
              <button style={S.primary} disabled={busy} onClick={submit}>{busy ? '送出中…' : '送出'}</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

// 懸浮回報鈕（2026-11-03 營運：側邊欄按鈕在其他彈跳視窗開著時按不到）
// 掛在 body 最上層、z-index 最大，任何視窗開著都點得到；可拖曳移位（記在 localStorage）
const FAB_KEY = 'op_report_fab_pos';
export function ReportFab({ onOpen, hidden }) {
  const [pos, setPos] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem(FAB_KEY) || 'null'); if (p && p.r >= 0 && p.b >= 0) return p; } catch { /* 略 */ }
    return { r: 18, b: 18 };
  });
  const drag = useRef(null);
  const clamp = (p) => ({
    r: Math.max(4, Math.min(window.innerWidth - 56, p.r)),
    b: Math.max(4, Math.min(window.innerHeight - 56, p.b)),
  });
  useEffect(() => {
    const onResize = () => setPos(p => clamp(p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  function onPointerDown(e) {
    drag.current = { x: e.clientX, y: e.clientY, r: pos.r, b: pos.b, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
    d.moved = true;
    setPos(clamp({ r: d.r - dx, b: d.b - dy }));
  }
  function onPointerUp() {
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (d.moved) { try { localStorage.setItem(FAB_KEY, JSON.stringify(pos)); } catch { /* 略 */ } return; }
    onOpen();
  }
  if (hidden) return null;
  return createPortal(
    <button type="button" data-yaya="op-report-fab"
      title="回報問題／優化需求（可拖曳移到別的位置）"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
      style={{
        position: 'fixed', right: pos.r, bottom: pos.b, zIndex: 2147483000,
        width: 52, height: 52, borderRadius: 26, border: '2px solid #fff',
        background: '#c05621', color: '#fff', fontSize: 24, lineHeight: '48px', padding: 0,
        boxShadow: '0 4px 14px rgba(0,0,0,.3)', cursor: 'grab', touchAction: 'none', userSelect: 'none',
      }}>🐞</button>,
    document.body,
  );
}

const S = {
  mask: { position: 'fixed', inset: 0, background: 'rgba(30,24,16,.45)', zIndex: 2147483001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: { background: '#fff', borderRadius: 12, width: 'min(520px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: 22, boxShadow: '0 12px 40px rgba(0,0,0,.25)' },
  title: { fontSize: 18, fontWeight: 700, color: '#50422d', marginBottom: 12 },
  p: { fontSize: 14, color: '#4a4033', lineHeight: 1.7 },
  kinds: { display: 'flex', gap: 8, marginBottom: 10 },
  kind: { flex: 1, padding: '9px 8px', borderRadius: 8, border: '1px solid #cdbea2', background: '#faf8f5', color: '#50422d', cursor: 'pointer', fontSize: 14 },
  kindOn: { background: '#50422d', color: '#fff', borderColor: '#50422d', fontWeight: 700 },
  meta: { fontSize: 12, color: '#8b7d68', marginBottom: 6 },
  ta: { width: '100%', minHeight: 120, boxSizing: 'border-box', border: '1px solid #cdbea2', borderRadius: 8, padding: 10, fontSize: 14, lineHeight: 1.6, resize: 'vertical', fontFamily: 'inherit' },
  count: { textAlign: 'right', fontSize: 11, color: '#a99c86' },
  shots: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  shot: { position: 'relative', width: 88, height: 88 },
  shotImg: { width: 88, height: 88, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2d8c6' },
  x: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, border: 'none', background: '#c53030', color: '#fff', cursor: 'pointer', lineHeight: '20px' },
  add: { width: 88, height: 88, borderRadius: 8, border: '1px dashed #cdbea2', background: '#faf8f5', color: '#8b6f4e', cursor: 'pointer', fontSize: 13 },
  err: { marginTop: 10, color: '#c53030', fontSize: 13 },
  row: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  ghost: { padding: '8px 16px', borderRadius: 8, border: '1px solid #cdbea2', background: '#fff', color: '#50422d', cursor: 'pointer' },
  primary: { padding: '8px 20px', borderRadius: 8, border: 'none', background: '#50422d', color: '#fff', cursor: 'pointer', fontWeight: 700 },
};
