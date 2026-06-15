// pages/systemUpdates/SystemUpdatesPage.jsx
// 「系統更新」展示開發績效
//   左：成員 tab
//   右上：每日詳細 commits
//   右下：本月重點摘要（依 conventional commit type 分類）

import { useEffect, useState, useMemo } from 'react';
import { systemUpdatesApi } from '../../services/api';

const C = {
  dark:   '#50422d', gold:  '#8b6f4e', sand:  '#cdbea2',
  bg:     '#faf8f5', bgCard:'#ffffff', border:'#e8e3dc',
  textDark:  '#3a2e1e', textMid: '#6b5640', textLight: '#9a8878',
};

const TYPE_LABEL = {
  feat:     { label: '✨ 新增功能',   color: '#2d6a4f', bg: '#d8f3dc' },
  fix:      { label: '🐛 修 Bug',     color: '#c53030', bg: '#fde8e8' },
  chore:    { label: '🔧 雜項調整',   color: '#6b5640', bg: '#f5f0ea' },
  refactor: { label: '♻ 重構',        color: '#1e40af', bg: '#dbeafe' },
  docs:     { label: '📝 文件',       color: '#92400e', bg: '#fef3c7' },
  style:    { label: '💄 樣式調整',   color: '#9d4edd', bg: '#e9d8fd' },
  test:     { label: '🧪 測試',       color: '#1d4ed8', bg: '#dbeafe' },
  perf:     { label: '⚡ 效能優化',   color: '#15803d', bg: '#dcfce7' },
  other:    { label: '📦 其他',       color: '#777',    bg: '#eee' },
};
const TYPE_ORDER = ['feat', 'fix', 'refactor', 'perf', 'chore', 'style', 'docs', 'test', 'other'];

function fmtDate(s) {
  if (!s) return '—';
  return s.slice(0, 10);
}
function fmtDateTime(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function SystemUpdatesPage() {
  const [members,  setMembers]  = useState([]);
  const [selMid,   setSelMid]   = useState(null);
  const [loadingM, setLoadingM] = useState(true);
  const [err, setErr] = useState('');

  // 載入成員清單
  useEffect(() => {
    (async () => {
      setLoadingM(true);
      try {
        const r = await systemUpdatesApi.listMembers();
        const list = r.data || [];
        setMembers(list);
        if (list.length > 0) setSelMid(list[0].id);
      } catch (e) {
        setErr(e?.message || '載入成員失敗');
      } finally {
        setLoadingM(false);
      }
    })();
  }, []);

  if (loadingM) return <div style={{ padding: 30, color: C.textLight }}>載入中...</div>;
  if (err)      return <div style={{ padding: 30, color: '#c53030' }}>{err}</div>;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* 標頭 */}
      <div style={{ background: C.dark, padding: '20px 28px' }}>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>🚀 系統更新</div>
        <div style={{ color: C.sand, fontSize: 13 }}>展示開發績效：每日詳細變動 + 本月重點摘要</div>
      </div>

      <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
        {/* 左：成員 tab */}
        <div style={{ background: C.bgCard, borderRadius: 10, border: `1px solid ${C.border}`, padding: '8px 0', height: 'fit-content', position: 'sticky', top: 16 }}>
          <div style={{ padding: '6px 14px 10px', fontSize: 11, fontWeight: 700, color: C.textLight, borderBottom: `1px solid ${C.border}` }}>
            成員
          </div>
          {members.map(m => {
            const active = m.id === selMid;
            return (
              <button key={m.id}
                onClick={() => setSelMid(m.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: active ? '#fff8ec' : 'transparent',
                  color: active ? C.dark : C.textDark,
                  border: 'none',
                  borderLeft: active ? `3px solid ${C.dark}` : '3px solid transparent',
                  padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                }}>
                <div style={{ fontWeight: 600 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>
                  {(m.repos || []).length} 個 repo
                </div>
              </button>
            );
          })}
        </div>

        {/* 右：上下兩區塊 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {selMid && <DailyBlock memberId={selMid} member={members.find(m => m.id === selMid)} />}
          {selMid && <MonthlyBlock memberId={selMid} />}
        </div>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════
// 每日詳細
// ════════════════════════════════════════════════════════════
function DailyBlock({ memberId, member }) {
  const [mode, setMode] = useState('days');   // 'days' | 'range'
  const [days, setDays] = useState(14);
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // AI 摘要
  const [ai, setAi]       = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr,    setAiErr]    = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setErr('');
      try {
        const params = mode === 'range' && fromDate && toDate ? { from: fromDate, to: toDate } : { days };
        const r = await systemUpdatesApi.getDaily(memberId, params);
        if (!cancelled) setData(r.data);
      } catch (e) {
        if (!cancelled) setErr(e?.message || '載入失敗');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [memberId, mode, days, fromDate, toDate]);

  async function runAi() {
    setAiLoading(true); setAiErr(''); setAi(null);
    try {
      const params = mode === 'range' && fromDate && toDate ? { from: fromDate, to: toDate } : { days };
      const r = await systemUpdatesApi.aiSummarize(memberId, params);
      setAi(r.data);
    } catch (e) {
      setAiErr(e?.response?.data?.message || e?.message || 'AI 摘要失敗');
    } finally {
      setAiLoading(false);
    }
  }

  function repoBadge(label) {
    // 判斷前端/後端（依 repo label）
    const isBackend  = /後端|backend/i.test(label || '');
    const isFrontend = /前端|frontend/i.test(label || '');
    if (isBackend)  return { text: '📦 後端', bg: '#e0e7ff', color: '#3730a3' };
    if (isFrontend) return { text: '🎨 前端', bg: '#fef3c7', color: '#92400e' };
    return { text: label || '?', bg: '#eee', color: '#666' };
  }

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.dark }}>
          📅 每日更新詳細
        </div>
        <div style={{ flex: 1 }} />

        {/* 模式切換 */}
        <div style={{ display: 'inline-flex', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, padding: 2 }}>
          <button onClick={() => setMode('days')}
                  style={{ padding: '4px 10px', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                           background: mode === 'days' ? C.dark : 'transparent', color: mode === 'days' ? '#fff' : C.textMid }}>
            最近 N 天
          </button>
          <button onClick={() => setMode('range')}
                  style={{ padding: '4px 10px', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                           background: mode === 'range' ? C.dark : 'transparent', color: mode === 'range' ? '#fff' : C.textMid }}>
            日期區間
          </button>
        </div>

        {mode === 'days' && (
          <select value={days} onChange={e => setDays(Number(e.target.value))}
                  style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12 }}>
            {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d} 天</option>)}
          </select>
        )}
        {mode === 'range' && (
          <>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                   style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12 }} />
            <span style={{ fontSize: 12, color: C.textLight }}>~</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                   style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12 }} />
          </>
        )}

        <button onClick={runAi} disabled={aiLoading || loading}
                style={{ padding: '5px 12px', borderRadius: 6, border: 'none',
                         background: '#9d4edd', color: '#fff', fontSize: 12, fontWeight: 600,
                         cursor: aiLoading ? 'wait' : 'pointer', opacity: aiLoading ? 0.6 : 1 }}>
          {aiLoading ? '⏳ AI 整理中...' : '✨ AI 中文摘要'}
        </button>
      </div>

      {/* AI 摘要結果 */}
      {aiErr && <div style={{ padding: 10, background: '#fde8e8', color: '#c53030', borderRadius: 6, fontSize: 12, marginBottom: 10 }}>{aiErr}</div>}
      {ai && (
        <div style={{ padding: 12, background: '#f3e8ff', border: `1px solid #d8b4fe`, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b21a8', marginBottom: 6 }}>✨ AI 中文摘要</div>
          <div style={{ fontSize: 13, color: C.textDark, lineHeight: 1.7, marginBottom: 8 }}>{ai.summary}</div>
          {ai.categories && Object.entries(ai.categories).map(([cat, items]) => (
            items && items.length > 0 && (
              <div key={cat} style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6b21a8' }}>{cat}（{items.length}）</div>
                <ul style={{ margin: '2px 0 0 18px', padding: 0, fontSize: 12, color: C.textDark, lineHeight: 1.7 }}>
                  {items.slice(0, 20).map((it, i) => <li key={i}>{it}</li>)}
                </ul>
              </div>
            )
          ))}
        </div>
      )}

      {(member?.repos || []).length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: C.textLight, background: '#faf8f5', borderRadius: 8 }}>
          此成員尚未設定 GitHub repo
        </div>
      ) : loading ? (
        <div style={{ padding: 24, color: C.textLight }}>載入 commits 中...</div>
      ) : err ? (
        <div style={{ padding: 12, background: '#fde8e8', color: '#c53030', borderRadius: 8 }}>{err}</div>
      ) : !data || data.total === 0 ? (
        <div style={{ padding: 24, color: C.textLight }}>近 {days} 天沒有新 commits</div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: C.textLight, marginBottom: 10 }}>
            共 {data.total} 筆變動，涵蓋 {(data.repos || []).length} 個 repo
          </div>
          {(data.days || []).map(day => (
            <div key={day.date} style={{ marginBottom: 14, paddingBottom: 10, borderBottom: `1px dashed ${C.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 6 }}>
                {day.date} <span style={{ color: C.textLight, fontWeight: 400, fontSize: 11 }}>· {day.commits.length} 筆</span>
              </div>
              {day.commits.map(c => {
                const t = TYPE_LABEL[c.type] || TYPE_LABEL.other;
                const rb = repoBadge(c.repo_label);
                const zh = ai?.items?.find(x => x.sha === c.sha)?.zh;
                return (
                  <div key={c.sha} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0' }}>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: t.bg, color: t.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {t.label}
                    </span>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: rb.bg, color: rb.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {rb.text}
                    </span>
                    <div style={{ flex: 1, fontSize: 12, color: C.textDark, lineHeight: 1.6 }}>
                      {c.subject}
                      {c.scope && <span style={{ color: C.textLight, marginLeft: 4 }}>({c.scope})</span>}
                      {zh && (
                        <div style={{ fontSize: 12, color: '#6b21a8', marginTop: 2, fontWeight: 500 }}>
                          ✨ {zh}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: C.textLight, marginTop: 2 }}>
                        {fmtDateTime(c.date)} · {c.sha.slice(0, 7)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}
    </div>
  );
}


// ════════════════════════════════════════════════════════════
// 本月摘要
// ════════════════════════════════════════════════════════════
function MonthlyBlock({ memberId }) {
  const [months,   setMonths]   = useState([]);
  const [selYM,    setSelYM]    = useState('');
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await systemUpdatesApi.listMonths();
        const list = r.data || [];
        setMonths(list);
        if (list.length > 0) setSelYM(list[0]);
      } catch (e) { setErr(e?.message || '載入月份失敗'); }
    })();
  }, []);

  useEffect(() => {
    if (!selYM) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setErr('');
      try {
        const r = await systemUpdatesApi.getMonthly(memberId, selYM);
        if (!cancelled) setData(r.data);
      } catch (e) {
        if (!cancelled) setErr(e?.message || '載入失敗');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [memberId, selYM]);

  // 整理顯示順序
  const sortedTypes = useMemo(() => {
    if (!data?.by_type) return [];
    return TYPE_ORDER.filter(t => (data.by_type[t] || []).length > 0)
      .concat(Object.keys(data.by_type).filter(t => !TYPE_ORDER.includes(t)));
  }, [data]);

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.dark }}>📊 本月重點摘要</div>
        <div style={{ flex: 1 }} />
        <select value={selYM} onChange={e => setSelYM(e.target.value)}
                style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12 }}>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 24, color: C.textLight }}>載入中...</div>
      ) : err ? (
        <div style={{ padding: 12, background: '#fde8e8', color: '#c53030', borderRadius: 8 }}>{err}</div>
      ) : !data || data.total === 0 ? (
        <div style={{ padding: 24, color: C.textLight }}>{selYM} 沒有 commits</div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: C.textLight, marginBottom: 12 }}>
            {selYM} 共 {data.total} 筆變動
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 14 }}>
            {sortedTypes.map(t => {
              const cs = data.by_type[t] || [];
              const tl = TYPE_LABEL[t] || TYPE_LABEL.other;
              return (
                <div key={t} style={{ background: tl.bg, padding: '8px 10px', borderRadius: 8, color: tl.color }}>
                  <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>{tl.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{cs.length}</div>
                </div>
              );
            })}
          </div>
          {sortedTypes.map(t => {
            const cs = data.by_type[t] || [];
            const tl = TYPE_LABEL[t] || TYPE_LABEL.other;
            return (
              <div key={t} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: tl.color, marginBottom: 4 }}>
                  {tl.label} <span style={{ fontSize: 11, fontWeight: 400 }}>({cs.length})</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: C.textDark, lineHeight: 1.8 }}>
                  {cs.slice(0, 30).map(c => (
                    <li key={c.sha}>
                      {c.subject}
                      {c.scope && <span style={{ color: C.textLight }}> ({c.scope})</span>}
                      <span style={{ color: C.textLight, marginLeft: 8, fontSize: 10 }}>
                        {fmtDate(c.date)} · {c.repo_label}
                      </span>
                    </li>
                  ))}
                  {cs.length > 30 && <li style={{ color: C.textLight }}>...另有 {cs.length - 30} 筆</li>}
                </ul>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
