// pages/handover/PublicHandoverPage.jsx
// 門市交接表 — 公開填寫頁（QR 掃描後進入）
// /handover/:id
//
// 流程：
//   pending_original  → 顯示給原交接方掃 / 填寫 → 送出後 stage=pending_new
//   pending_new       → 顯示給新交接方掃 / 看內容 + 加備註 → 送出後 stage=pending_third
//   pending_third     → 顯示給第三方掃 / 看完整內容 + 加備註 → 送出後 completed
//   completed         → 唯讀完整內容
//
// LIFF：嘗試自動拿 LINE UID → 對應員工。失敗時提供手動填員工編號 fallback。

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { handoverPublicApi } from '../../services/api';

const C = { dark:'#50422d', mid:'#8b6f4e', light:'#cdbea2', bg:'#f5f0ea',
  bgCard:'#ffffff', border:'#e0d5c8', textDark:'#3a2e1e', textMid:'#6b5640', textLight:'#9a8878' };

const STAGE_LABEL = {
  pending_original: '⏳ 等待原交接方填寫',
  pending_new:      '⏳ 等待新交接方確認',
  pending_third:    '⏳ 等待第三方最後確認',
  completed:        '✅ 已完成',
  cancelled:        '🚫 已取消',
};

const LIFF_ID = import.meta.env.VITE_LIFF_ID || '';
const LIFF_SDK = 'https://static.line-scdn.net/liff/edge/2/sdk.js';

const fmtDateTime = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false });
};

const qrSrc = (text, size=240) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;

// ════════════════════════════════════════════════════════════
export default function PublicHandoverPage() {
  const { id } = useParams();
  const [handover, setHandover] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const reload = useCallback(async () => {
    try {
      const res = await handoverPublicApi.get(id);
      setHandover(res.data);
      setError(null);
    } catch (e) {
      setError(e.message || '無法載入此交接表');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  if (loading) return <Page><Center>載入中…</Center></Page>;
  if (error)   return <Page><Center style={{ color:'#c53030' }}>{error}</Center></Page>;
  if (!handover) return null;

  return (
    <Page>
      <Header h={handover} />
      {handover.stage === 'pending_original' && <OriginalStage h={handover} onSubmitted={reload} />}
      {handover.stage === 'pending_new'      && <NewStage      h={handover} onSubmitted={reload} />}
      {handover.stage === 'pending_third'    && <ThirdStage    h={handover} onSubmitted={reload} />}
      {handover.stage === 'completed'        && <CompletedView h={handover} />}
      {handover.stage === 'cancelled'        && <Center style={{ color:'#888' }}>此交接表已取消</Center>}
    </Page>
  );
}

// ════════════════════════════════════════════════════════════
// 共用：頁框 + 頁首 + 中央訊息
// ════════════════════════════════════════════════════════════
function Page({ children }) {
  return (
    <div style={{ background: C.bg, minHeight:'100vh', fontFamily:'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 720, margin:'0 auto', padding:'16px' }}>
        {children}
      </div>
    </div>
  );
}
function Header({ h }) {
  return (
    <div style={{ background: C.dark, borderRadius:12, padding:'16px 20px', color:'#fff', marginBottom:16 }}>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>📝 門市交接表</div>
      <div style={{ color: C.light, fontSize:13 }}>{h.store_name}</div>
      <div style={{ marginTop:8 }}>
        <span style={{ display:'inline-block', padding:'4px 10px', borderRadius:12, fontSize:12, fontWeight:600,
          background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)' }}>
          {STAGE_LABEL[h.stage] || h.stage}
        </span>
      </div>
    </div>
  );
}
function Center({ children, style }) {
  return <div style={{ padding:48, textAlign:'center', color: C.textMid, ...style }}>{children}</div>;
}

// ════════════════════════════════════════════════════════════
// LIFF Identify Hook：嘗試拿 LINE UID → 後端轉員工
// ════════════════════════════════════════════════════════════
function useIdentify(handoverId) {
  const [profile, setProfile] = useState(null); // {member_id, name, store_name, ...}
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);
  const [needManual, setNeedManual] = useState(false);
  const [manualId, setManualId]     = useState('');

  const identifyByLineUid = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      // 1. 載 LIFF SDK（如果還沒載）
      if (!window.liff) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = LIFF_SDK; s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      if (!LIFF_ID) throw new Error('LIFF_ID 未設定');
      await window.liff.init({ liffId: LIFF_ID });
      if (!window.liff.isLoggedIn()) {
        window.liff.login(); return;
      }
      const p = await window.liff.getProfile();
      const res = await handoverPublicApi.identify(handoverId, { line_uid: p.userId });
      setProfile(res.data);
    } catch (e) {
      console.error('[LIFF identify failed]', e);
      setError(e.message || 'LIFF 認證失敗');
      setNeedManual(true);
    } finally { setBusy(false); }
  }, [handoverId]);

  const identifyByManual = useCallback(async () => {
    if (!manualId.trim()) { setError('請填員工編號'); return; }
    setBusy(true); setError(null);
    try {
      const res = await handoverPublicApi.identify(handoverId, { app_number: manualId.trim() });
      setProfile(res.data);
    } catch (e) {
      setError(e.message || '查無員工');
    } finally { setBusy(false); }
  }, [handoverId, manualId]);

  const reset = () => { setProfile(null); setError(null); setNeedManual(false); setManualId(''); };

  return { profile, busy, error, needManual, manualId, setManualId, identifyByLineUid, identifyByManual, reset };
}

function IdentifyPanel({ id, role, onIdentified }) {
  const ident = useIdentify(id);
  useEffect(() => { if (ident.profile) onIdentified(ident.profile); }, [ident.profile]);

  return (
    <Card>
      <H2>{role} 身份確認</H2>
      <P>請按下方按鈕，系統會用 LINE 登入辨識你的身份。</P>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:12 }}>
        <button onClick={ident.identifyByLineUid} disabled={ident.busy} style={btnPrimaryFull}>
          {ident.busy ? '辨識中…' : '🟢 用 LINE 登入辨識'}
        </button>
        {ident.needManual && (
          <div style={{ marginTop:8, padding:12, background:'#fff8ec', border:`1px solid #e5c99a`, borderRadius:8 }}>
            <div style={{ fontSize:12, color:'#8b6f4e', marginBottom:6 }}>
              {ident.error}。可改用「員工編號」手動辨識：
            </div>
            <input value={ident.manualId} onChange={e => ident.setManualId(e.target.value)}
              placeholder="員工編號（app_number）" style={inputStyle} />
            <button onClick={ident.identifyByManual} disabled={ident.busy} style={{ ...btnPrimaryFull, marginTop:8 }}>
              {ident.busy ? '查詢中…' : '用員工編號辨識'}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

function ConfirmIdentity({ profile, role, storeName, onConfirm, onCancel }) {
  return (
    <Card>
      <H2>確認身份</H2>
      <P>
        你（<strong>{profile.name}</strong>，{profile.member_id}）
        代表「{storeName}」交接表的<strong>{role}</strong>，要進行登入嗎？
      </P>
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button onClick={onConfirm} style={btnPrimaryFull}>是，繼續</button>
        <button onClick={onCancel}  style={btnGhostFull}>不是我，重選</button>
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════
// Stage 1：原交接方
// ════════════════════════════════════════════════════════════
function OriginalStage({ h, onSubmitted }) {
  const [profile, setProfile] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  if (!profile) return <IdentifyPanel id={h.id} role="原交接方" onIdentified={setProfile} />;
  if (!confirmed) return (
    <ConfirmIdentity profile={profile} role="原交接方" storeName={h.store_name}
      onConfirm={() => setConfirmed(true)}
      onCancel={() => setProfile(null)} />
  );
  return <OriginalForm h={h} profile={profile} onSubmitted={onSubmitted} />;
}

function OriginalForm({ h, profile, onSubmitted }) {
  // 為每個 item 維護一筆 response state
  const [responses, setResponses] = useState(() =>
    (h.items || []).map(it => ({
      item_id: it.id,
      checked: it.type === 'check' ? false : undefined,
      value:   it.type === 'number' ? '' : undefined,
      note:    '',
      photo_urls: [],
    }))
  );
  const [extraNote, setExtraNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateResp = (idx, patch) => {
    setResponses(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const uploadPhoto = async (idx, file) => {
    try {
      const res = await handoverPublicApi.uploadPhoto(h.id, file, file.name);
      updateResp(idx, { photo_urls: [...(responses[idx].photo_urls || []), res.data.url] });
    } catch (e) { alert('上傳失敗：' + e.message); }
  };
  const removePhoto = (idx, url) => {
    updateResp(idx, { photo_urls: (responses[idx].photo_urls || []).filter(u => u !== url) });
  };

  const submit = async () => {
    // 前端先檢查必填
    for (let i = 0; i < (h.items || []).length; i++) {
      const it = h.items[i]; const r = responses[i];
      if (!it.required) continue;
      if (it.type === 'check' && r.checked == null) { alert(`「${it.label}」未勾選`); return; }
      if (it.type === 'number' && (r.value == null || r.value === '')) { alert(`「${it.label}」未填數字`); return; }
    }
    setSubmitting(true);
    try {
      // 把 number value 轉成 number
      const cleanResponses = responses.map((r, i) => {
        const it = h.items[i];
        if (it.type === 'number') return { ...r, value: r.value === '' ? null : Number(r.value) };
        return r;
      });
      await handoverPublicApi.submitOriginal(h.id, {
        member_id: profile.member_id, name: profile.name,
        responses: cleanResponses, extra_note: extraNote,
      });
      alert('✅ 原交接方已完成，請把連結 / QR 交給新交接方');
      onSubmitted();
    } catch (e) {
      alert('送出失敗：' + e.message);
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <Card>
        <H2>請依下列品項逐項確認</H2>
        <P style={{ fontSize:12 }}>填寫人：{profile.name} ({profile.member_id})</P>
      </Card>
      {(h.items || []).map((it, idx) => (
        <ItemRow key={it.id} item={it} resp={responses[idx]}
          onChange={p => updateResp(idx, p)}
          onUploadPhoto={file => uploadPhoto(idx, file)}
          onRemovePhoto={url  => removePhoto(idx, url)} />
      ))}
      <Card>
        <Field label="其他重要事項（選填）">
          <textarea value={extraNote} onChange={e => setExtraNote(e.target.value)}
            rows={3} style={{ ...inputStyle, fontFamily:'inherit', resize:'vertical' }} />
        </Field>
        <button onClick={submit} disabled={submitting} style={btnPrimaryFull}>
          {submitting ? '送出中…' : '盤點完成 → 送出'}
        </button>
      </Card>
    </>
  );
}

function ItemRow({ item, resp, onChange, onUploadPhoto, onRemovePhoto }) {
  const photos = resp.photo_urls || [];
  return (
    <Card>
      <div style={{ fontWeight:600, color: C.textDark, marginBottom:8 }}>
        {item.label}
        {item.required && <span style={{ color:'#c53030', marginLeft:4 }}>*</span>}
      </div>
      {item.type === 'check' && (
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          <button onClick={() => onChange({ checked: true })}
            style={{ ...optBtn, ...(resp.checked === true ? optBtnActiveYes : {}) }}>✓ 是</button>
          <button onClick={() => onChange({ checked: false })}
            style={{ ...optBtn, ...(resp.checked === false ? optBtnActiveNo : {}) }}>✗ 否</button>
        </div>
      )}
      {item.type === 'number' && (
        <input type="number" value={resp.value ?? ''} onChange={e => onChange({ value: e.target.value })}
          placeholder="輸入數字" style={inputStyle} />
      )}
      {item.type === 'count_module' && (
        <div style={{ padding:8, background:'#f5f0ea', borderRadius:6, fontSize:12, color: C.textMid }}>
          盤點模組（下一版實作）
        </div>
      )}
      <textarea value={resp.note || ''} onChange={e => onChange({ note: e.target.value })}
        placeholder="備註（選填）" rows={2}
        style={{ ...inputStyle, marginTop:8, fontFamily:'inherit', resize:'vertical' }} />
      {item.allow_photo && (
        <div style={{ marginTop:8 }}>
          <label style={{ ...btnGhostFull, display:'inline-block', textAlign:'center' }}>
            📷 加照片
            <input type="file" accept="image/*" capture="environment" style={{ display:'none' }}
              onChange={e => { if (e.target.files?.[0]) { onUploadPhoto(e.target.files[0]); e.target.value=''; } }} />
          </label>
          {photos.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
              {photos.map(url => (
                <div key={url} style={{ position:'relative' }}>
                  <a href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="photo" style={{ width:80, height:80, objectFit:'cover', borderRadius:6, border:`1px solid ${C.border}` }} />
                  </a>
                  <button onClick={() => onRemovePhoto(url)} style={{
                    position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%',
                    border:'none', background:'#c53030', color:'#fff', cursor:'pointer', fontSize:11,
                  }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ════════════════════════════════════════════════════════════
// Stage 2：新交接方
// ════════════════════════════════════════════════════════════
function NewStage({ h, onSubmitted }) {
  const [profile, setProfile] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [extraNote, setExtraNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!profile) return <IdentifyPanel id={h.id} role="新交接方" onIdentified={setProfile} />;
  if (!confirmed) return (
    <ConfirmIdentity profile={profile} role="新交接方" storeName={h.store_name}
      onConfirm={() => setConfirmed(true)}
      onCancel={() => setProfile(null)} />
  );

  const submit = async () => {
    setSubmitting(true);
    try {
      await handoverPublicApi.submitNew(h.id, {
        member_id: profile.member_id, name: profile.name, extra_note: extraNote,
      });
      alert('✅ 新交接方已確認，請把連結 / QR 交給第三方確認人');
      onSubmitted();
    } catch (e) { alert('送出失敗：' + e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <>
      <Card>
        <H2>請檢視原交接方填寫的內容</H2>
        <P style={{ fontSize:12 }}>
          原交接方：{h.original_name}（{fmtDateTime(h.original_filled_at)}）
        </P>
      </Card>
      <ResponsesView items={h.items || []} responses={h.original_responses || []} />
      {h.original_extra_note && <Card><strong>原方其他事項：</strong><div style={{ whiteSpace:'pre-wrap', marginTop:6 }}>{h.original_extra_note}</div></Card>}
      <Card>
        <Field label="新交接方備註（選填）">
          <textarea value={extraNote} onChange={e => setExtraNote(e.target.value)}
            rows={3} style={{ ...inputStyle, fontFamily:'inherit', resize:'vertical' }} />
        </Field>
        <button onClick={submit} disabled={submitting} style={btnPrimaryFull}>
          {submitting ? '送出中…' : '確認接收 → 送出'}
        </button>
      </Card>
    </>
  );
}

// ════════════════════════════════════════════════════════════
// Stage 3：第三方確認
// ════════════════════════════════════════════════════════════
function ThirdStage({ h, onSubmitted }) {
  const [profile, setProfile] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!profile) return <IdentifyPanel id={h.id} role="第三方確認人" onIdentified={setProfile} />;
  if (!confirmed) return (
    <ConfirmIdentity profile={profile} role="第三方確認人" storeName={h.store_name}
      onConfirm={() => setConfirmed(true)}
      onCancel={() => setProfile(null)} />
  );

  const submit = async () => {
    setSubmitting(true);
    try {
      await handoverPublicApi.submitThird(h.id, {
        member_id: profile.member_id, name: profile.name, note,
      });
      alert('✅ 已完成最後確認，交接結束');
      onSubmitted();
    } catch (e) { alert('送出失敗：' + e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <>
      <CompletedDetail h={h} />
      <Card>
        <Field label="第三方確認備註（選填）">
          <textarea value={note} onChange={e => setNote(e.target.value)}
            rows={3} style={{ ...inputStyle, fontFamily:'inherit', resize:'vertical' }} />
        </Field>
        <button onClick={submit} disabled={submitting} style={btnPrimaryFull}>
          {submitting ? '送出中…' : '最後確認 → 完成交接'}
        </button>
      </Card>
    </>
  );
}

// ════════════════════════════════════════════════════════════
// Completed View
// ════════════════════════════════════════════════════════════
function CompletedView({ h }) {
  return <CompletedDetail h={h} />;
}

function CompletedDetail({ h }) {
  return (
    <>
      <Card>
        <H2>原交接方填寫</H2>
        <P style={{ fontSize:12 }}>{h.original_name}（{fmtDateTime(h.original_filled_at)}）</P>
      </Card>
      <ResponsesView items={h.items || []} responses={h.original_responses || []} />
      {h.original_extra_note && <Card><strong>原方其他事項：</strong><div style={{ whiteSpace:'pre-wrap', marginTop:6 }}>{h.original_extra_note}</div></Card>}

      {h.new_name && (
        <Card>
          <H2>新交接方確認</H2>
          <P style={{ fontSize:12 }}>{h.new_name}（{fmtDateTime(h.new_filled_at)}）</P>
          {h.new_extra_note && <div style={{ whiteSpace:'pre-wrap', marginTop:6 }}>{h.new_extra_note}</div>}
        </Card>
      )}

      {h.third_name && (
        <Card>
          <H2>第三方確認</H2>
          <P style={{ fontSize:12 }}>{h.third_name}（{fmtDateTime(h.third_confirmed_at)}）</P>
          {h.third_note && <div style={{ whiteSpace:'pre-wrap', marginTop:6 }}>{h.third_note}</div>}
        </Card>
      )}
    </>
  );
}

function ResponsesView({ items, responses }) {
  const respMap = new Map((responses || []).map(r => [r.item_id, r]));
  return (
    <>
      {items.map(it => {
        const r = respMap.get(it.id) || {};
        return (
          <Card key={it.id}>
            <div style={{ fontWeight:600, color: C.textDark, marginBottom:6 }}>{it.label}</div>
            {it.type === 'check'  && <div style={{ fontSize:14 }}>{r.checked === true ? '✓ 是' : r.checked === false ? '✗ 否' : '—'}</div>}
            {it.type === 'number' && <div style={{ fontSize:14 }}>{r.value != null ? r.value : '—'}</div>}
            {it.type === 'count_module' && <div style={{ fontSize:12, color: C.textMid }}>盤點模組（下一版）</div>}
            {r.note && <div style={{ fontSize:13, color: C.textMid, marginTop:4 }}>備註：{r.note}</div>}
            {Array.isArray(r.photo_urls) && r.photo_urls.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                {r.photo_urls.map(url => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="photo" style={{ width:80, height:80, objectFit:'cover', borderRadius:6, border:`1px solid ${C.border}` }} />
                  </a>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}

// ── 共用元件 ──────────────────────────────────────────────
function Card({ children }) {
  return <div style={{ background: C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, padding:16, marginBottom:12 }}>{children}</div>;
}
function H2({ children }) { return <div style={{ fontSize:16, fontWeight:700, color: C.textDark, marginBottom:6 }}>{children}</div>; }
function P({ children, style }) { return <div style={{ fontSize:13, color: C.textMid, ...style }}>{children}</div>; }
function Field({ label, children }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:12, color: C.textMid, fontWeight:600, marginBottom:6 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = { width:'100%', padding:'10px 12px', fontSize:14, border:`1px solid ${C.border}`, borderRadius:6, boxSizing:'border-box' };
const btnPrimaryFull = { width:'100%', padding:'12px', background:C.dark, color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:14 };
const btnGhostFull   = { width:'100%', padding:'10px', background:'transparent', color: C.textMid, border:`1px solid ${C.border}`, borderRadius:8, cursor:'pointer', fontSize:13 };
const optBtn = { flex:1, padding:'10px', background:'#fafaf7', border:`1px solid ${C.border}`, borderRadius:6, cursor:'pointer', fontSize:14, fontWeight:600 };
const optBtnActiveYes = { background:'#f0fff4', borderColor:'#b7e4c7', color:'#2d6a4f' };
const optBtnActiveNo  = { background:'#fff0f0', borderColor:'#feb2b2', color:'#c53030' };
