// 頁內對話框（陷阱 143：App 內建瀏覽器沒有 alert／confirm／prompt，呼叫了也不會跳、confirm 永遠當成「取消」）
//   uiAlert(text)   → Promise<void>
//   uiConfirm(text) → Promise<boolean>
// 不依賴 React：直接在 body 掛一層遮罩，關掉就移除。給 App 會打開的頁面（查規範 /rules、規範編輯器）用。
function open(text, withCancel) {
  return new Promise((resolve) => {
    const mask = document.createElement('div');
    mask.setAttribute('role', 'dialog');
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:14px;max-width:420px;width:100%;padding:18px 16px 14px;box-shadow:0 8px 30px rgba(0,0,0,.25);font-family:inherit;color:#2d2416';
    const p = document.createElement('div');
    p.style.cssText = 'white-space:pre-wrap;font-size:15px;line-height:1.6;margin-bottom:14px;word-break:break-word';
    p.textContent = String(text ?? '');
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';
    const mk = (label, primary, val) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.style.cssText = `border:${primary ? 'none' : '1px solid #e6dccd'};background:${primary ? '#50422d' : '#fff'};color:${primary ? '#fff' : '#50422d'};border-radius:10px;padding:9px 16px;font-size:15px;font-weight:700;cursor:pointer`;
      b.onclick = () => { mask.remove(); resolve(val); };
      return b;
    };
    if (withCancel) row.appendChild(mk('取消', false, false));
    const okBtn = mk(withCancel ? '確定' : '知道了', true, withCancel ? true : undefined);
    row.appendChild(okBtn);
    box.appendChild(p); box.appendChild(row); mask.appendChild(box);
    document.body.appendChild(mask);
    try { okBtn.focus(); } catch { /* ignore */ }
  });
}
export const uiAlert = (text) => open(text, false);
export const uiConfirm = (text) => open(text, true);
