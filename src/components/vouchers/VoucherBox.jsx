// components/vouchers/VoucherBox.jsx —— 開帳原始憑證（2026-10-21）
// 只有營運部（operation_*）與超級管理員看得到；後端也會擋（403）。
// 用在：月報每一列明細、手填／調帳、分攤開帳、帳單詳情。
// 作廢用頁內二次確認（App 內建瀏覽器的 confirm 不可靠，陷阱 143）。
import { useEffect, useRef, useState } from 'react';
import { ledgerApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export const canSeeVouchers = (user) => !!user && (user.role === 'super_admin' || String(user.role || '').startsWith('operation_'));
const errMsg = (e) => (e && (e.message || e.error)) || '失敗';

export default function VoucherBox({ refType, refId, initial, readOnly, onChange, compact }) {
  const { user } = useAuth();
  const [list, setList] = useState(initial || null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const inp = useRef(null);
  const allowed = canSeeVouchers(user);

  useEffect(() => {
    if (!allowed || !refType || !refId || initial) return;
    ledgerApi.vouchers(refType, refId).then((r) => setList(r.data || [])).catch((e) => setMsg(errMsg(e)));
  }, [allowed, refType, refId, initial]);
  useEffect(() => { if (initial) setList(initial); }, [initial]);

  if (!allowed) return null;
  const files = list || [];
  const upload = async (fl) => {
    if (!fl || !fl.length) return;
    setBusy(true); setMsg('');
    try { const r = await ledgerApi.voucherUpload(refType, refId, fl); setList(r.data.files || []); onChange && onChange(r.data.files || []); }
    catch (e) { setMsg(errMsg(e)); }
    setBusy(false); if (inp.current) inp.current.value = '';
  };
  const del = async (id) => {
    setBusy(true); setMsg('');
    try { await ledgerApi.voucherVoid(id); const next = files.filter((f) => f.id !== id); setList(next); onChange && onChange(next); }
    catch (e) { setMsg(errMsg(e)); }
    setConfirmId(null); setBusy(false);
  };

  return (
    <div style={{ marginTop: compact ? 2 : 6 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {files.map((f) => (
          <div key={f.id} style={S.item} title={`${f.name || ''}${f.from ? `（${f.from}）` : ''}`}>
            <a href={f.url || '#'} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              {f.kind === 'image' && f.url
                ? <img src={f.url} alt={f.name || '憑證'} style={S.thumb} />
                : <div style={{ ...S.thumb, ...S.doc }}>{f.kind === 'pdf' ? 'PDF' : '檔案'}</div>}
            </a>
            <div style={S.cap}>{f.from || ''}</div>
            {f.deletable && !readOnly && (confirmId === f.id
              ? <div style={{ display: 'flex', gap: 2 }}><button style={S.danger} disabled={busy} onClick={() => del(f.id)}>確定作廢</button><button style={S.link} onClick={() => setConfirmId(null)}>取消</button></div>
              : <button style={S.link} onClick={() => setConfirmId(f.id)}>作廢</button>)}
          </div>
        ))}
        {!readOnly && (
          <label style={{ ...S.add, opacity: busy ? 0.5 : 1 }}>
            {busy ? '上傳中…' : '＋ 憑證'}
            <input ref={inp} type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }} disabled={busy} onChange={(e) => upload(e.target.files)} />
          </label>
        )}
        {list && !files.length && readOnly && <span style={{ fontSize: 12, color: '#a0aec0' }}>沒有憑證</span>}
      </div>
      {msg && <div style={{ fontSize: 12, color: '#c53030', marginTop: 2 }}>{msg}</div>}
    </div>
  );
}

const S = {
  item: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 64 },
  thumb: { width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0', display: 'block' },
  doc: { display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#edf2f7', color: '#4a5568', fontSize: 12, fontWeight: 600 },
  cap: { fontSize: 10, color: '#718096', textAlign: 'center', lineHeight: 1.2, marginTop: 2 },
  add: { width: 56, height: 56, border: '1px dashed #a0aec0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#4a5568', cursor: 'pointer', background: '#fafafa' },
  link: { border: 'none', background: 'none', color: '#3182ce', cursor: 'pointer', padding: 0, fontSize: 11 },
  danger: { border: 'none', background: '#c53030', color: '#fff', cursor: 'pointer', padding: '1px 4px', fontSize: 11, borderRadius: 4 },
};
