// 門市月報「查帳提醒」—— 系統先把看起來不合理的數字挑出來（services/monthlyAudit.js），會計逐則確認
// 全部門市一覽：列全部；單店月報：只列這家店＋全公司的
import { useState, useEffect, useCallback } from 'react';
import { ledgerApi } from '../../services/api';

const SEV = {
  high: { label: '要先查', color: '#c53030', bg: '#fff5f5' },
  mid: { label: '要看一下', color: '#c05621', bg: '#fffaf0' },
  low: { label: '小提醒', color: '#718096', bg: '#f7fafc' },
};
const ACK = { ok: '確認沒問題', fixed: '已處理', follow: '要追蹤' };
const fmt = (n) => (n === null || n === undefined ? '' : Math.round(n).toLocaleString('zh-TW'));
const errMsg = (e) => (e && e.response && e.response.data && e.response.data.message) || (e && e.message) || '讀取失敗';

export default function AuditPanel({ ym, store, onPickStore, canEdit = true }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(null);   // { f, status, note }
  const [ai, setAi] = useState({});               // store → { loading, text, enabled, err }
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async (fresh) => {
    setLoading(true); setErr('');
    try { const r = await ledgerApi.audit(ym, fresh); setData(r.data); } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  }, [ym]);
  useEffect(() => { load(false); }, [load]);

  const list = (data ? data.findings : []).filter((f) => (!store || f.store === store || f.store === '*') && (showAll || !f.ack));
  const counts = data ? (store
    ? ['high', 'mid', 'low'].reduce((o, k) => ({ ...o, [k]: data.findings.filter((f) => !f.ack && f.sev === k && (f.store === store || f.store === '*')).length }), {})
    : data.counts) : null;

  const saveAck = async () => {
    if (!editing) return;
    try {
      await ledgerApi.auditAck({ store: editing.f.store, ym, rule_key: editing.f.key, status: editing.status, note: editing.note });
      setEditing(null); await load(false);
    } catch (e) { setErr(errMsg(e)); }
  };
  const undoAck = async (id) => { try { await ledgerApi.auditUnack(id); await load(false); } catch (e) { setErr(errMsg(e)); } };
  const explain = async (st) => {
    setAi((a) => ({ ...a, [st]: { loading: true } }));
    try { const r = await ledgerApi.auditExplain({ ym, store: st }); setAi((a) => ({ ...a, [st]: r.data })); }
    catch (e) { setAi((a) => ({ ...a, [st]: { err: errMsg(e) } })); }
  };

  return (
    <div style={S.card} data-yaya="mr-audit">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700 }}>🔍 查帳提醒{store ? '（這家店）' : '（全部門市）'}</div>
        {counts && <>
          <span style={S.pill(SEV.high.color)}>要先查 {counts.high}</span>
          <span style={S.pill(SEV.mid.color)}>要看一下 {counts.mid}</span>
          <span style={S.pill(SEV.low.color)}>小提醒 {counts.low}</span>
        </>}
        <label style={{ fontSize: 13, color: '#4a5568' }}><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> 也顯示已確認的</label>
        <button style={S.btn} onClick={() => load(true)} disabled={loading}>{loading ? '檢查中…' : '重新檢查'}</button>
        <button style={S.link} onClick={() => setCollapsed(!collapsed)}>{collapsed ? '展開' : '收起'}</button>
      </div>
      {data && <div style={S.sub}>{data.base}（{data.prev_ym}）。{data.month_open ? '⚠ 這個月還沒結束，很多帳還沒進來，提醒會比較多。' : ''}系統只是挑出「看起來不合理」的，不代表一定錯。</div>}
      {err && <div style={{ color: '#c53030', marginTop: 6 }}>{err}</div>}
      {store && !collapsed && (
        <div style={{ marginTop: 8 }}>
          <button style={S.btn} onClick={() => explain(store)} disabled={ai[store] && ai[store].loading}>🤖 請 AI 幫我看這家店</button>
          {ai[store] && ai[store].loading && <span style={S.sub}>　AI 在看…</span>}
          {ai[store] && ai[store].err && <span style={{ color: '#c53030' }}>　{ai[store].err}</span>}
          {ai[store] && ai[store].enabled === false && <span style={S.sub}>　AI 說明還沒開（營運部後端要設 ANTHROPIC_API_KEY）</span>}
          {ai[store] && ai[store].text && <div style={S.ai}>{ai[store].text}</div>}
        </div>
      )}
      {!collapsed && (
        <div style={{ marginTop: 8, maxHeight: store ? 'none' : 520, overflow: 'auto' }}>
          {data && list.length === 0 && <div style={S.sub}>沒有待看的提醒 👍</div>}
          {list.map((f) => {
            const sv = SEV[f.sev] || SEV.low;
            const isEdit = editing && editing.f.store === f.store && editing.f.key === f.key;
            return (
              <div key={`${f.store}|${f.key}`} style={{ ...S.row, background: f.ack ? '#f0fff4' : sv.bg, borderLeft: `4px solid ${f.ack ? '#38a169' : sv.color}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ color: sv.color, fontWeight: 700, fontSize: 12 }}>{sv.label}</span>
                  {!store && f.store !== '*' && <button style={S.link} onClick={() => onPickStore && onPickStore(f.store)}>{f.store_name}</button>}
                  {(!store && f.store === '*') && <b>全公司</b>}
                  <span style={{ fontWeight: 600 }}>{f.title}</span>
                </div>
                <div style={{ fontSize: 13, color: '#4a5568', marginTop: 2 }}>{f.detail}</div>
                {f.ack && (
                  <div style={{ fontSize: 12, color: '#2f855a', marginTop: 2 }}>
                    ✔ {ACK[f.ack.status]}{f.ack.note ? `：${f.ack.note}` : ''}（{f.ack.created_by || ''}）
                    {canEdit && <button style={S.link} onClick={() => undoAck(f.ack.id)}>取消</button>}
                  </div>
                )}
                {!f.ack && canEdit && !isEdit && (
                  <div style={{ marginTop: 4, display: 'flex', gap: 6 }}>
                    {Object.entries(ACK).map(([k, v]) => <button key={k} style={S.small} onClick={() => setEditing({ f, status: k, note: '' })}>{v}</button>)}
                  </div>
                )}
                {isEdit && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 13 }}>{ACK[editing.status]}</b>
                    <input style={{ flex: 1, minWidth: 220, padding: 4 }} placeholder="說明（選填）：例 9 月帳單 10/25 才到" value={editing.note}
                      onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
                    <button style={S.btn} onClick={saveAck}>存</button>
                    <button style={S.link} onClick={() => setEditing(null)}>取消</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 },
  sub: { fontSize: 12, color: '#718096', marginTop: 4 },
  pill: (c) => ({ fontSize: 12, color: '#fff', background: c, borderRadius: 10, padding: '1px 8px' }),
  btn: { padding: '4px 10px', border: '1px solid #cbd5e0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 },
  small: { padding: '2px 8px', border: '1px solid #cbd5e0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12 },
  link: { border: 'none', background: 'none', color: '#3182ce', cursor: 'pointer', padding: 0, fontSize: 13 },
  row: { padding: '8px 10px', borderRadius: 6, marginBottom: 6 },
  ai: { marginTop: 8, whiteSpace: 'pre-wrap', background: '#ebf8ff', borderRadius: 6, padding: 10, fontSize: 14 },
};
