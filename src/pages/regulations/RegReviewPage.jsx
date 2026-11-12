// 推播連結進入的規範審核頁：/rules/review?t=票券&v=版本（不需登入，2026-11-09 Louis：點推播落到登入頁）
//   票券 24 小時、只限現任審核人；範圍 v＝只審那一份、p＝待審清單（AI 整理推播）。
//   進來後把 t 從網址列拿掉（存 sessionStorage，重新整理還能用）；過期 → 指引從 App 營運工具或後台審核。
import React, { useEffect, useMemo, useState } from 'react';
import { regulationReviewApi } from '../../services/api';
import ReviewPanel from './ReviewPanel';
import { C } from './ui';

const SS = 'reg_review_ticket';

export default function RegReviewPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [ticket] = useState(() => {
    const t = params.get('t');
    if (t) { try { sessionStorage.setItem(SS, t); } catch { /* */ } return t; }
    try { return sessionStorage.getItem(SS) || ''; } catch { return ''; }
  });
  const vid = Number(params.get('v')) || null;
  const api = useMemo(() => regulationReviewApi(ticket), [ticket]);
  const [me, setMe] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    // 票券不要留在網址列（截圖／轉傳）
    if (params.get('t')) { const q = new URLSearchParams(params); q.delete('t'); window.history.replaceState(null, '', `${window.location.pathname}${q.toString() ? `?${q}` : ''}`); }
    if (!ticket) { setErr({ code: 'TICKET_BAD', message: '連結不完整' }); return; }
    api.me().then((r) => (r?.success ? setMe(r.data) : setErr({ code: r?.code, message: r?.message || '連結無效' })));
  }, []); // eslint-disable-line

  const wrap = { minHeight: '100vh', background: C.bg, padding: '12px 10px 40px', boxSizing: 'border-box', color: C.ink, fontFamily: 'inherit' };
  if (err) {
    return (
      <div style={wrap}>
        <div data-yaya="rv-expired" style={{ maxWidth: 480, margin: '40px auto', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>{err.code === 'TICKET_EXPIRED' ? '⏰' : '🔒'}</div>
          <div style={{ fontSize: 17, fontWeight: 800, margin: '6px 0' }}>{err.message}</div>
          <div style={{ fontSize: 14, color: C.mid, lineHeight: 1.6 }}>
            審核連結 24 小時內有效，而且只有指定審核人能用。<br />
            請從 App「樂活人員 → 營運工具 → 規範查詢」或營運部後台「規範管理 → 審核」繼續。
          </div>
          <a href="/regulations?tab=review" style={{ display: 'inline-block', marginTop: 14, padding: '10px 18px', borderRadius: 10, background: C.brand, color: '#fff', textDecoration: 'none', fontWeight: 700 }}>到後台審核</a>
        </div>
      </div>
    );
  }
  if (!me) return <div style={{ ...wrap, textAlign: 'center', paddingTop: 80, color: C.mid }}>讀取中…</div>;
  return (
    <div style={wrap}>
      <div data-yaya="rv-head" style={{ maxWidth: 1200, margin: '0 auto 10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 18 }}>📋 規範審核</b>
        <span style={{ fontSize: 12.5, color: C.mid }}>審核人：{me.reviewer?.name || '—'}・連結有效到 {new Date(me.expires_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}</span>
      </div>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <ReviewPanel api={api} initialVid={vid || me.version_id} isReviewer allowEdit roles={me.roles || []} categories={me.categories || []} allowLow={me.scope === 'p'} hideFilter />{/* 2026-11-12 Louis：推播連結也能「✏️ 修改內容 → 修改後通過」（票券只限現任審核人，後端同一支 approve） */}
      </div>
    </div>
  );
}
