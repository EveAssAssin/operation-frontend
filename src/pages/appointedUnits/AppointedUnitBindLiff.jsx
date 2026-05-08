// pages/appointedUnits/AppointedUnitBindLiff.jsx
// LIFF 入口：特約廠商綁定流程
//   1. 在 LINE App 內開啟（透過 LIFF SDK 拿到 userId / displayName）
//   2. 顯示綁定狀態 — 若已綁定就顯示資訊，提供解綁
//   3. 若未綁定，提供兩種選擇：員工綁定 / 管理員綁定（一次性碼）
//
// LIFF SDK 從 CDN 動態載入，避免增加 npm 依賴。

import { useEffect, useState } from 'react';
import { appointedUnitsPublicApi, appointedUnitsApi } from '../../services/api';

// 樂活品牌色（綁定頁簡化版）
const C = {
  primary:    '#06C755',  // LINE 綠
  primaryD:   '#04a045',
  bg:         '#f5f5f5',
  card:       '#ffffff',
  border:     '#e0e0e0',
  text:       '#222',
  textMid:    '#666',
  textLight:  '#999',
  danger:     '#c53030',
  warn:       '#d97706',
};

// 動態載入 LIFF SDK
function loadLiffSdk() {
  return new Promise((resolve, reject) => {
    if (window.liff) return resolve(window.liff);
    const s = document.createElement('script');
    s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    s.async = true;
    s.onload = () => resolve(window.liff);
    s.onerror = () => reject(new Error('無法載入 LIFF SDK'));
    document.head.appendChild(s);
  });
}

export default function AppointedUnitBindLiff() {
  const [phase, setPhase]     = useState('init');   // init | ready | error
  const [error, setError]     = useState('');
  const [profile, setProfile] = useState(null);
  const [binding, setBinding] = useState(null);
  const [mode, setMode]       = useState(null);     // null | 'employee' | 'admin'

  // 取設定 + 初始化 LIFF
  useEffect(() => {
    (async () => {
      try {
        let liffId = '';
        try {
          const cfg = await appointedUnitsApi.getConfig();
          liffId = cfg?.data?.liff_id || '';
        } catch (_) { /* 後台 config 失敗就退到 query 參數 */ }
        if (!liffId) {
          // fallback：從 query 取
          const q = new URLSearchParams(window.location.search);
          liffId = q.get('liffId') || '';
        }
        if (!liffId) {
          setPhase('error'); setError('系統未設定 LIFF ID');
          return;
        }

        const liff = await loadLiffSdk();
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login();
          return; // login 會跳走，不繼續
        }

        const p = await liff.getProfile();
        setProfile(p);
        // 詢問現有綁定
        try {
          const r = await appointedUnitsPublicApi.bindStatus(p.userId);
          setBinding(r?.binding || null);
        } catch (_) {}
        setPhase('ready');
      } catch (e) {
        console.error(e);
        setPhase('error');
        setError(e?.message || '初始化失敗');
      }
    })();
  }, []);

  if (phase === 'init') return <FullScreen>初始化中...</FullScreen>;
  if (phase === 'error') return <FullScreen>{error || '發生錯誤'}</FullScreen>;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 20 }}>
        {/* 頁首 */}
        <div style={{ textAlign: 'center', marginTop: 12, marginBottom: 24 }}>
          {profile?.pictureUrl && (
            <img src={profile.pictureUrl} alt="" style={{ width: 64, height: 64, borderRadius: '50%', marginBottom: 8 }} />
          )}
          <div style={{ fontSize: 18, fontWeight: 700 }}>樂活特約廠商</div>
          <div style={{ fontSize: 12, color: C.textMid }}>{profile?.displayName}</div>
        </div>

        {/* 已綁定 */}
        {binding && binding.status === 'active' && !mode && (
          <BoundCard binding={binding} profile={profile} onUnbound={() => setBinding(null)} />
        )}

        {/* 未綁定 — 選擇模式 */}
        {(!binding || binding.status !== 'active') && !mode && (
          <ModeSelect onSelect={setMode} />
        )}

        {/* 員工綁定 */}
        {mode === 'employee' && (
          <EmployeeBindForm
            profile={profile}
            onCancel={() => setMode(null)}
            onSuccess={(b) => { setBinding(b); setMode(null); }}
          />
        )}

        {/* 管理員綁定 */}
        {mode === 'admin' && (
          <AdminBindForm
            profile={profile}
            onCancel={() => setMode(null)}
            onSuccess={(b) => { setBinding(b); setMode(null); }}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function FullScreen({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui', color: C.textMid, fontSize: 14, padding: 20, textAlign: 'center',
    }}>
      <div>{children}</div>
    </div>
  );
}

function BoundCard({ binding, profile, onUnbound }) {
  const [busy, setBusy] = useState(false);
  async function handleUnbind() {
    if (!window.confirm('確定要解除綁定嗎？解除後將不再收到此 LINE 帳號的推播。')) return;
    setBusy(true);
    try {
      await appointedUnitsPublicApi.unbind(profile.userId, 'user_request');
      onUnbound();
    } catch (e) { alert('失敗：' + (e?.message || e)); }
    finally { setBusy(false); }
  }
  return (
    <div style={cardStyle}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 36 }}>✅</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>已完成綁定</div>
      </div>
      <Row label="特約單位" value={`${binding.unit_name_snap || ''}（${binding.unit_code}）`} />
      <Row label="身分" value={binding.binding_role === 'admin' ? '管理員' : '員工'} />
      {binding.client_id && <Row label="客編" value={binding.client_id} />}
      <Row label="綁定時間" value={new Date(binding.bound_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })} />
      <button style={{ ...primaryBtn, background: C.danger, marginTop: 20 }} disabled={busy} onClick={handleUnbind}>
        {busy ? '處理中...' : '解除綁定'}
      </button>
    </div>
  );
}

function ModeSelect({ onSelect }) {
  return (
    <>
      <div style={{ ...cardStyle, marginBottom: 16, cursor: 'pointer' }} onClick={() => onSelect('employee')}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🧑‍💼</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>我是廠商員工</div>
        <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6 }}>
          使用 <b>特約廠商代碼</b> + <b>手機末 4 碼</b> 完成綁定
        </div>
      </div>
      <div style={{ ...cardStyle, cursor: 'pointer' }} onClick={() => onSelect('admin')}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>👔</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>我是廠商管理員</div>
        <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6 }}>
          使用樂活窗口提供的 <b>一次性綁定碼</b> 完成綁定
        </div>
      </div>
    </>
  );
}

function EmployeeBindForm({ profile, onCancel, onSuccess }) {
  const [unitCode, setUnitCode]   = useState('');
  const [unitName, setUnitName]   = useState('');     // 顯示用，配合 lookup
  const [last4, setLast4]         = useState('');
  const [busy, setBusy]           = useState(false);
  const [err, setErr]             = useState('');
  const [showLookup, setShowLookup] = useState(false);

  async function handleSubmit() {
    setErr('');
    if (!unitCode.trim() || !last4.trim()) return setErr('請填寫所有欄位');
    if (!/^\d{4}$/.test(last4)) return setErr('手機末 4 碼必須是 4 位數字');
    setBusy(true);
    try {
      const r = await appointedUnitsPublicApi.bindEmployee({
        line_user_id: profile.userId,
        unit_code:    unitCode.trim(),
        mobile_last4: last4.trim(),
        display_name: profile.displayName,
        picture_url:  profile.pictureUrl,
      });
      if (!r.ok) throw new Error(r.message || '綁定失敗');
      // 重抓綁定狀態
      const s = await appointedUnitsPublicApi.bindStatus(profile.userId);
      onSuccess(s?.binding);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally { setBusy(false); }
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>員工綁定</div>
      <Field label="特約廠商代碼">
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={unitCode} onChange={e => { setUnitCode(e.target.value.replace(/\s/g, '')); setUnitName(''); }}
            inputMode="numeric" placeholder="例如：560" style={{ ...input, flex: 1 }} />
          <button type="button" onClick={() => setShowLookup(true)}
            style={{ ...ghostBtn, padding: '0 14px', whiteSpace: 'nowrap', fontSize: 13 }}>
            🔍 查代碼
          </button>
        </div>
        {unitName && (
          <div style={{ marginTop: 6, fontSize: 12, color: C.textMid, padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #b7e4c7' }}>
            ✓ {unitName}
          </div>
        )}
      </Field>
      <Field label="手機末 4 碼">
        <input value={last4} onChange={e => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric" placeholder="例如：1234" style={input} maxLength={4} />
      </Field>
      {err && <div style={{ color: C.danger, fontSize: 13, marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button style={{ ...ghostBtn, flex: 1 }} onClick={onCancel}>返回</button>
        <button style={{ ...primaryBtn, flex: 2 }} disabled={busy} onClick={handleSubmit}>
          {busy ? '綁定中...' : '完成綁定'}
        </button>
      </div>

      {showLookup && (
        <CodeLookupModal
          onClose={() => setShowLookup(false)}
          onPick={(u) => { setUnitCode(u.unit_code); setUnitName(u.unit_name); setShowLookup(false); }}
        />
      )}
    </div>
  );
}

function AdminBindForm({ profile, onCancel, onSuccess }) {
  const [unitCode, setUnitCode]   = useState('');
  const [unitName, setUnitName]   = useState('');
  const [bindCode, setBindCode]   = useState('');
  const [busy, setBusy]           = useState(false);
  const [err, setErr]             = useState('');
  const [showLookup, setShowLookup] = useState(false);

  async function handleSubmit() {
    setErr('');
    if (!unitCode.trim() || !bindCode.trim()) return setErr('請填寫所有欄位');
    setBusy(true);
    try {
      const r = await appointedUnitsPublicApi.bindAdmin({
        line_user_id: profile.userId,
        unit_code:    unitCode.trim(),
        bind_code:    bindCode.trim().toUpperCase(),
        display_name: profile.displayName,
        picture_url:  profile.pictureUrl,
      });
      if (!r.ok) throw new Error(r.message || '綁定失敗');
      const s = await appointedUnitsPublicApi.bindStatus(profile.userId);
      onSuccess(s?.binding);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally { setBusy(false); }
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>管理員綁定</div>
      <div style={{ fontSize: 12, color: C.textMid, marginBottom: 12, padding: 10, background: '#fff8e6', borderRadius: 6, border: `1px solid #f3d785` }}>
        💡 一次性綁定碼由樂活窗口提供，每組只能用一次，且通常 60 分鐘內過期。
      </div>
      <Field label="特約廠商代碼">
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={unitCode} onChange={e => { setUnitCode(e.target.value.replace(/\s/g, '')); setUnitName(''); }}
            placeholder="例如：560" style={{ ...input, flex: 1 }} />
          <button type="button" onClick={() => setShowLookup(true)}
            style={{ ...ghostBtn, padding: '0 14px', whiteSpace: 'nowrap', fontSize: 13 }}>
            🔍 查代碼
          </button>
        </div>
        {unitName && (
          <div style={{ marginTop: 6, fontSize: 12, color: C.textMid, padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #b7e4c7' }}>
            ✓ {unitName}
          </div>
        )}
      </Field>
      <Field label="一次性綁定碼">
        <input value={bindCode} onChange={e => setBindCode(e.target.value.toUpperCase())} placeholder="例如：A2B4D7Q9" style={{ ...input, fontFamily: 'monospace', letterSpacing: 1 }} maxLength={16} />
      </Field>
      {err && <div style={{ color: C.danger, fontSize: 13, marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button style={{ ...ghostBtn, flex: 1 }} onClick={onCancel}>返回</button>
        <button style={{ ...primaryBtn, flex: 2 }} disabled={busy} onClick={handleSubmit}>
          {busy ? '綁定中...' : '完成綁定'}
        </button>
      </div>

      {showLookup && (
        <CodeLookupModal
          onClose={() => setShowLookup(false)}
          onPick={(u) => { setUnitCode(u.unit_code); setUnitName(u.unit_name); setShowLookup(false); }}
        />
      )}
    </div>
  );
}

// ─── 代碼查詢 Modal ──────────────────────────────────────────
function CodeLookupModal({ onClose, onPick }) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    setErr(''); setSearched(false);
    const k = keyword.trim();
    if (k.length < 2) { setErr('請輸入至少 2 個字元'); return; }
    setBusy(true);
    try {
      const r = await appointedUnitsPublicApi.lookupCode(k);
      if (!r.ok) {
        setErr(r.message || '查詢失敗');
        setResults([]);
      } else {
        setResults(Array.isArray(r.results) ? r.results : []);
      }
      setSearched(true);
    } catch (e) {
      setErr(e?.message || '查詢失敗');
      setResults([]);
    } finally { setBusy(false); }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSearch();
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '12px 12px 0 0', width: '100%', maxWidth: 480,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>查詢特約廠商代碼</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: C.textMid }}>×</button>
        </div>
        <div style={{ padding: 16, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="輸入廠商名稱（至少 2 字）"
              style={{ ...input, flex: 1 }}
              autoFocus
            />
            <button onClick={handleSearch} disabled={busy} style={{ ...primaryBtn, padding: '0 18px' }}>
              {busy ? '...' : '查詢'}
            </button>
          </div>
          {err && <div style={{ color: C.danger, fontSize: 12, marginTop: 8 }}>{err}</div>}
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {searched && results.length === 0 && !err && (
            <div style={{ textAlign: 'center', color: C.textMid, padding: 40, fontSize: 13 }}>
              查無符合的特約廠商，請確認名稱是否正確或聯絡樂活窗口
            </div>
          )}
          {results.length > 0 && (
            <div>
              {results.map(r => (
                <div key={r.unit_code}
                  onClick={() => onPick(r)}
                  style={{
                    padding: '14px 18px',
                    borderBottom: `1px solid ${C.border}`,
                    cursor: 'pointer',
                  }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{r.unit_name}</div>
                  <div style={{ fontSize: 12, color: C.textMid, marginTop: 2 }}>
                    代碼：<b>{r.unit_code}</b>
                    {r.category_name && <span style={{ marginLeft: 12 }}>類別：{r.category_name}</span>}
                  </div>
                </div>
              ))}
              {results.length === 10 && (
                <div style={{ textAlign: 'center', color: C.textLight, padding: '12px', fontSize: 11 }}>
                  最多顯示 10 筆，請輸入更精確的關鍵字
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 共用樣式 / 元件 ──────────────────────────────────────────
const cardStyle = {
  background: C.card,
  borderRadius: 12,
  padding: 20,
  border: `1px solid ${C.border}`,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};
const input = {
  width: '100%',
  padding: '12px 14px',
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 16,
  boxSizing: 'border-box',
};
const primaryBtn = {
  padding: '12px 16px',
  background: C.primary,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};
const ghostBtn = {
  padding: '12px 16px',
  background: '#fff',
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.textMid, fontSize: 13 }}>{label}</span>
      <span style={{ color: C.text, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
