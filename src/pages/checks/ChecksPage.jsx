// pages/checks/ChecksPage.jsx
// 支票紀錄系統（v2）：今日出款清單 / 批次管理 / 通知設定
// 品牌色：#50422d / #8b6f4e / #cdbea2 / #ffffff

import { useState, useEffect, useCallback, useRef } from 'react';
import { checksApi, personnelApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// ── 品牌色 ───────────────────────────────────────────────────
const C = {
  dark:   '#50422d',
  mid:    '#8b6f4e',
  light:  '#cdbea2',
  bg:     '#f5f0ea',    // 頁面背景（淺米色）
  bgCard: '#ffffff',
  border: '#e0d5c8',
  textDark:  '#3a2e1e',
  textMid:   '#6b5640',
  textLight: '#9a8878',
};

// ── 支票狀態 ─────────────────────────────────────────────────
const STATUS_LABEL = { pending: '待出款', paid: '已出款', voided: '作廢', bounced: '退票' };
const STATUS_COLOR = {
  pending: { bg: '#fff8ec', text: '#8b6f4e', border: '#e5c99a' },
  paid:    { bg: '#f0fff4', text: '#2d6a4f', border: '#b7e4c7' },
  voided:  { bg: '#f5f5f5', text: '#888',    border: '#ddd' },
  bounced: { bg: '#fff0f0', text: '#c53030', border: '#feb2b2' },
};

// ── 角色權限 ─────────────────────────────────────────────────
const canManage = (role) => ['operation_lead','super_admin'].includes(role);

// ── 金額格式 ─────────────────────────────────────────────────
const fmtAmt = (n) =>
  n != null
    ? new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n)
    : '—';

// ── Tabs ────────────────────────────────────────────────────
const TABS = [
  { key: 'today',   label: '今日出款清單', icon: '📋' },
  { key: 'batches', label: '支票批次管理', icon: '🗂️' },
  { key: 'notify',  label: '通知設定',     icon: '🔔' },
];

// ════════════════════════════════════════════════════════════
// 主頁面
// ════════════════════════════════════════════════════════════
export default function ChecksPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('today');

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* ── 頁首 ── */}
      <div style={{ background: C.dark, padding: '20px 28px 0' }}>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          🏦 支票紀錄系統
        </div>
        <div style={{ color: C.light, fontSize: 13, marginBottom: 16 }}>
          管理應付票據批次與每日出款提醒
        </div>
        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '8px 18px',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: tab === t.key ? 700 : 500,
              background: tab === t.key ? C.bg : 'transparent',
              color: tab === t.key ? C.dark : C.light,
              transition: 'all 0.15s',
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 內容 ── */}
      <div style={{ padding: '24px 28px' }}>
        {tab === 'today'   && <TodayPanel   user={user} />}
        {tab === 'batches' && <BatchesPanel user={user} />}
        {tab === 'notify'  && <NotifyPanel  user={user} />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 1：今日出款清單
// ════════════════════════════════════════════════════════════
function TodayPanel() {
  const [data, setData]       = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, u] = await Promise.all([
        checksApi.getToday(),
        checksApi.getUpcoming(7),
      ]);
      setData(t.data);
      setUpcoming(u.data || []);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handlePay(checkId) {
    if (!window.confirm('確定標記此張支票為「已出款」？')) return;
    try {
      await checksApi.payCheck(checkId);
      load();
    } catch (e) { alert(e.message || '操作失敗'); }
  }

  if (loading) return <Loading />;

  const today = data?.date || '—';
  const summary = data?.summary || [];
  const grouped = data?.grouped || {};

  // 渲染單一支票列
  function CheckRow({ c, i }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '12px 18px',
        borderTop: i > 0 ? `1px solid ${C.border}` : 'none',
        background: c.is_overdue ? '#fff8f0' : (i % 2 === 0 ? '#fff' : '#faf7f4'),
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: C.textDark, fontSize: 14 }}>
            {c.batch?.subject?.name || '—'}
            <span style={{ fontWeight: 400, color: C.textMid, marginLeft: 8, fontSize: 13 }}>
              第 {c.seq_no} 張
            </span>
            {c.is_overdue && (
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 700,
                background: '#fed7d7', color: '#c53030',
                padding: '1px 7px', borderRadius: 999,
              }}>逾期</span>
            )}
          </div>
          <div style={{ color: C.textLight, fontSize: 12, marginTop: 2 }}>
            到期日：{c.due_date}
            {c.check_no && ` · 票號：${c.check_no}`}
            {c.batch?.bank_name && ` · ${c.batch.bank_name}`}
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 100 }}>
          <div style={{ fontWeight: 700, color: c.is_overdue ? '#c53030' : C.dark, fontSize: 16 }}>{fmtAmt(c.amount)}</div>
        </div>
        <button onClick={() => handlePay(c.id)} style={{
          marginLeft: 16, padding: '6px 14px',
          background: C.mid, color: '#fff',
          border: 'none', borderRadius: 6, cursor: 'pointer',
          fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          標記已出款
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* 日期 Banner */}
      <div style={{
        background: C.dark, color: '#fff', borderRadius: 12,
        padding: '16px 22px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 13, color: C.light, marginBottom: 2 }}>今日應付票據</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{today}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {data?.overdue_count > 0 && (
            <div style={{
              background: '#c53030', borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 700,
            }}>逾期 {data.overdue_count} 張</div>
          )}
          <div style={{
            background: data?.total > 0 ? '#e53e3e' : '#38a169',
            borderRadius: 999, padding: '6px 18px', fontSize: 15, fontWeight: 700,
          }}>
            {data?.total > 0 ? `⚠ ${data.total} 張待出款` : '✓ 今日無應付票據'}
          </div>
        </div>
      </div>

      {/* 出款清單（依出款人分群）*/}
      {summary.length === 0 ? (
        <EmptyBox text="今日無需出款的票據" />
      ) : (
        summary.map(s => {
          const drawerChecks = grouped[s.drawer_name] || { today: [], overdue: [] };
          const allChecks = [...(drawerChecks.today || []), ...(drawerChecks.overdue || [])];
          return (
            <div key={s.drawer_name} style={{ marginBottom: 20 }}>
              <div style={{
                background: C.mid, color: '#fff',
                padding: '10px 18px', borderRadius: '10px 10px 0 0',
                fontWeight: 700, fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>
                  👤 {s.drawer_name}
                  <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 10, color: C.light }}>
                    共 {allChecks.length} 張
                  </span>
                </span>
                <span style={{ fontSize: 14 }}>合計 {fmtAmt(s.total_amount)}</span>
              </div>
              <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                {allChecks.map((c, i) => <CheckRow key={c.id} c={c} i={i} />)}
              </div>
            </div>
          );
        })
      )}

      {/* 近 7 天預告 */}
      {upcoming.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontWeight: 700, color: C.textDark, fontSize: 14, marginBottom: 12 }}>
            📅 未來 7 天應付票據預告
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {upcoming.map(c => (
              <div key={c.id} style={{
                background: '#fff', border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '8px 14px', fontSize: 12,
              }}>
                <span style={{ color: C.mid, fontWeight: 600 }}>
                  {c.batch?.subject?.name || '—'}
                </span>
                <span style={{ color: C.textLight, margin: '0 6px' }}>·</span>
                <span style={{ color: C.textDark }}>{c.display_date || c.due_date}</span>
                <span style={{ color: C.textLight, margin: '0 6px' }}>·</span>
                <span style={{ color: C.dark, fontWeight: 600 }}>{fmtAmt(c.amount)}</span>
                {c.days_until === 0 && (
                  <span style={{ marginLeft: 6, color: '#e53e3e', fontWeight: 700 }}>今日</span>
                )}
                {c.days_until > 0 && (
                  <span style={{ marginLeft: 6, color: C.textLight }}>+{c.days_until}天</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 2：支票批次管理
// ════════════════════════════════════════════════════════════
function BatchesPanel({ user }) {
  const [batches, setBatches]       = useState([]);
  const [subjects, setSubjects]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDrawer, setFilterDrawer] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedData, setExpandedData] = useState(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null); // batch object to edit
  const [showMerge, setShowMerge] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, s] = await Promise.all([
        checksApi.getBatches({ status: filterStatus || undefined, drawer_name: filterDrawer || undefined }),
        checksApi.getSubjects(),
      ]);
      setBatches(b.data || []);
      setSubjects(s.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterStatus, filterDrawer]);

  useEffect(() => { load(); }, [load]);

  async function expandBatch(id) {
    if (expandedId === id) { setExpandedId(null); setExpandedData(null); return; }
    setExpandedId(id);
    setExpandedLoading(true);
    try {
      const res = await checksApi.getBatch(id);
      setExpandedData(res.data);
    } catch(e) { console.error(e); }
    finally { setExpandedLoading(false); }
  }

  async function handlePay(checkId) {
    if (!window.confirm('確定標記「已出款」？')) return;
    try {
      await checksApi.payCheck(checkId);
      const res = await checksApi.getBatch(expandedId);
      setExpandedData(res.data);
      load();
    } catch (e) { alert(e.message || '操作失敗'); }
  }

  async function handleVoid(checkId) {
    const reason = prompt('作廢原因（可填可不填）：');
    if (reason === null) return;
    try {
      await checksApi.voidCheck(checkId, reason);
      const res = await checksApi.getBatch(expandedId);
      setExpandedData(res.data);
      load();
    } catch (e) { alert(e.message || '操作失敗'); }
  }

  async function handleBounce(checkId) {
    if (!window.confirm('確定標記退票？')) return;
    try {
      await checksApi.bounceCheck(checkId);
      const res = await checksApi.getBatch(expandedId);
      setExpandedData(res.data);
      load();
    } catch (e) { alert(e.message || '操作失敗'); }
  }

  async function handleDeleteBatch(e, batchId, batchNo) {
    e.stopPropagation();
    if (!window.confirm(`確定刪除批次 ${batchNo}？\n此操作將同時刪除該批次所有支票，無法復原！`)) return;
    try {
      await checksApi.deleteBatch(batchId);
      if (expandedId === batchId) { setExpandedId(null); setExpandedData(null); }
      load();
    } catch (e) { alert(e.message || '刪除失敗'); }
  }

  async function handleBulkPayPast() {
    if (!window.confirm('確定將今天以前所有「待出款」票據全部標記為已付款？')) return;
    try {
      const res = await checksApi.bulkPayPast();
      alert(res.data?.message || '完成');
      load();
    } catch (e) { alert(e.message || '操作失敗'); }
  }

  async function handleClearAll() {
    const confirm1 = window.confirm('⚠️ 警告：此操作將刪除所有支票批次與支票資料，無法復原！\n確定清除全部？');
    if (!confirm1) return;
    const input = window.prompt('請輸入 "確認清除" 以繼續：');
    if (input !== '確認清除') return;
    try {
      await checksApi.clearAll();
      alert('所有資料已清除，請重新匯入');
      setExpandedId(null); setExpandedData(null);
      load();
    } catch (e) { alert(e.message || '清除失敗'); }
  }

  const DRAWER_OPTIONS = ['黃信儒', '黃志雄'];
  const BATCH_STATUS_LABEL = { active: '進行中', completed: '已完成', voided: '已作廢' };
  const BATCH_STATUS_COLOR = {
    active:    { bg: '#fff8ec', text: '#8b6f4e', border: '#e5c99a' },
    completed: { bg: '#f0fff4', text: '#2d6a4f', border: '#b7e4c7' },
    voided:    { bg: '#f5f5f5', text: '#888',    border: '#ddd' },
  };

  return (
    <div>
      {/* 操作列 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="">全部狀態</option>
          <option value="active">進行中</option>
          <option value="completed">已完成</option>
          <option value="voided">已作廢</option>
        </select>
        <select value={filterDrawer} onChange={e => setFilterDrawer(e.target.value)} style={selectStyle}>
          <option value="">全部出款人</option>
          {DRAWER_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {canManage(user?.role) && (
          <>
            <button onClick={handleBulkPayPast} style={{ ...btnStyle, background: '#8b6f4e' }} title="將今天以前的所有待出款票一鍵標記為已付款">
              ✅ 補標已出款
            </button>
            <button onClick={() => setShowMerge(true)} style={{ ...btnStyle, background: C.mid }}>
              🔀 合併科目
            </button>
            <button onClick={() => setShowImport(true)} style={{ ...btnStyle, background: C.mid }}>
              📤 匯入 Excel
            </button>
            <button onClick={() => setShowCreate(true)} style={{ ...btnStyle, background: C.dark }}>
              ＋ 新增批次
            </button>
            <button onClick={handleClearAll} style={{ ...btnStyle, background: '#c53030' }} title="清除全部資料後重新匯入">
              🗑 清除全部
            </button>
          </>
        )}
      </div>

      {loading ? <Loading /> : batches.length === 0 ? (
        <EmptyBox text="沒有符合條件的批次" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {batches.map(b => {
            const sc = BATCH_STATUS_COLOR[b.status] || BATCH_STATUS_COLOR.active;
            const paidCnt    = (b.checks || []).filter(c => c.status === 'paid').length;
            const pendingCnt = (b.checks || []).filter(c => c.status === 'pending').length;
            const isExpanded = expandedId === b.id;

            return (
              <div key={b.id} style={{
                background: '#fff', border: `1px solid ${C.border}`,
                borderRadius: 10, overflow: 'hidden',
              }}>
                {/* 批次列 */}
                <div
                  onClick={() => expandBatch(b.id)}
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '14px 18px', cursor: 'pointer',
                    borderBottom: isExpanded ? `1px solid ${C.border}` : 'none',
                    background: isExpanded ? '#faf7f4' : '#fff',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: C.textDark, fontSize: 15 }}>
                        {b.subject?.name || '（未分類）'}
                      </span>
                      <span style={{
                        ...badgeStyle,
                        background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                      }}>
                        {BATCH_STATUS_LABEL[b.status]}
                      </span>
                      {b.renewal_needed && (
                        <span style={{ ...badgeStyle, background: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2' }}>
                          需續票
                        </span>
                      )}
                    </div>
                    <div style={{ color: C.textLight, fontSize: 12, display: 'flex', gap: 14 }}>
                      <span>👤 {b.drawer_name}</span>
                      <span>🏦 {b.bank_name}</span>
                      <span>📋 {b.batch_no}</span>
                      <span>✓ {paidCnt} / {b.check_count} 張</span>
                      {pendingCnt > 0 && <span style={{ color: '#e53e3e' }}>待出款 {pendingCnt} 張</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: 14 }}>
                    {b.total_amount && (
                      <div style={{ fontWeight: 700, color: C.dark, fontSize: 15 }}>{fmtAmt(b.total_amount)}</div>
                    )}
                    <div style={{ color: C.textLight, fontSize: 11 }}>{b.check_count} 張</div>
                  </div>
                  {canManage(user?.role) && (
                    <>
                      <button
                        onClick={e => { e.stopPropagation(); setEditingBatch(b); }}
                        title="編輯批次"
                        style={{
                          background: 'none', border: `1px solid ${C.border}`,
                          borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                          color: C.textMid, fontSize: 14, marginRight: 4,
                        }}
                      >✏️</button>
                      <button
                        onClick={e => handleDeleteBatch(e, b.id, b.batch_no)}
                        title="刪除此批次"
                        style={{
                          background: 'none', border: '1px solid #fed7d7',
                          borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                          color: '#c53030', fontSize: 14, marginRight: 8,
                        }}
                      >🗑</button>
                    </>
                  )}
                  <span style={{ color: C.light, fontSize: 18 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* 展開：個別支票列表 */}
                {isExpanded && (
                  expandedLoading ? (
                    <div style={{ padding: 20, textAlign: 'center', color: C.textLight }}>載入中...</div>
                  ) : expandedData?.checks?.map((c, i) => {
                    const sc2 = STATUS_COLOR[c.status] || STATUS_COLOR.pending;
                    return (
                      <div key={c.id} style={{
                        display: 'flex', alignItems: 'center',
                        padding: '10px 22px 10px 32px',
                        borderTop: `1px solid ${C.border}`,
                        background: i % 2 === 0 ? '#fff' : '#faf7f4',
                      }}>
                        <div style={{ width: 28, color: C.textLight, fontSize: 12 }}>#{c.seq_no}</div>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: C.textDark, fontSize: 13, fontWeight: 500 }}>
                            到期：{c.due_date}
                          </span>
                          {c.display_date && c.display_date !== c.due_date && (
                            <span style={{ color: C.textLight, fontSize: 11, marginLeft: 8 }}>
                              （提醒日：{c.display_date}）
                            </span>
                          )}
                          {c.check_no && (
                            <span style={{ color: C.textLight, fontSize: 11, marginLeft: 8 }}>票號：{c.check_no}</span>
                          )}
                        </div>
                        <div style={{ fontWeight: 600, color: C.dark, width: 110, textAlign: 'right' }}>
                          {fmtAmt(c.amount)}
                        </div>
                        <div style={{ width: 70, textAlign: 'center' }}>
                          <span style={{
                            ...badgeStyle,
                            background: sc2.bg, color: sc2.text, border: `1px solid ${sc2.border}`,
                          }}>
                            {STATUS_LABEL[c.status]}
                          </span>
                        </div>
                        {canManage(user?.role) && c.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                            <button onClick={() => handlePay(c.id)} style={{
                              ...smallBtnStyle, background: '#38a169', color: '#fff',
                            }}>出款</button>
                            <button onClick={() => handleVoid(c.id)} style={{
                              ...smallBtnStyle, background: '#a0aec0', color: '#fff',
                            }}>作廢</button>
                          </div>
                        )}
                        {canManage(user?.role) && c.status === 'paid' && (
                          <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                            <button onClick={() => handleBounce(c.id)} style={{
                              ...smallBtnStyle, background: '#e53e3e', color: '#fff',
                            }}>退票</button>
                          </div>
                        )}
                        {(c.status === 'voided' || c.status === 'bounced') && (
                          <div style={{ width: 80, marginLeft: 8 }} />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateBatchModal
          subjects={subjects}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSaved={() => { setShowImport(false); load(); }}
        />
      )}

      {editingBatch && (
        <EditBatchModal
          batch={editingBatch}
          subjects={subjects}
          onClose={() => setEditingBatch(null)}
          onSaved={() => {
            setEditingBatch(null);
            // 若展開中的批次被編輯，重新載入展開資料
            if (expandedId === editingBatch.id) {
              checksApi.getBatch(expandedId).then(r => setExpandedData(r.data));
            }
            load();
          }}
        />
      )}

      {showMerge && (
        <MergeSubjectsModal
          subjects={subjects}
          onClose={() => setShowMerge(false)}
          onSaved={() => { setShowMerge(false); load(); }}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 3：通知設定
// ════════════════════════════════════════════════════════════
// ── 人員快搜元件 ─────────────────────────────────────────────
function EmployeePicker({ onSelect }) {
  const [keyword, setKeyword]   = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen]         = useState(false);
  const timer = useRef(null);

  function handleChange(e) {
    const v = e.target.value;
    setKeyword(v);
    setOpen(true);
    clearTimeout(timer.current);
    if (!v.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await personnelApi.getEmployees({ keyword: v, limit: 20 });
        setResults(res.data?.employees || []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
  }

  function handleSelect(emp) {
    onSelect({ name: emp.name, app_number: emp.app_number });
    setKeyword(emp.name);
    setOpen(false);
    setResults([]);
  }

  return (
    <div style={{ position: 'relative' }}>
      <label style={labelStyle}>搜尋人員 *</label>
      <input
        value={keyword}
        onChange={handleChange}
        onFocus={() => keyword && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={inputStyle}
        placeholder="輸入姓名搜尋..."
        autoComplete="off"
      />
      {open && (results.length > 0 || searching) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: `1px solid ${C.border}`,
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {searching && (
            <div style={{ padding: '10px 14px', color: C.textLight, fontSize: 13 }}>搜尋中...</div>
          )}
          {results.map(emp => (
            <div
              key={emp.id}
              onMouseDown={() => handleSelect(emp)}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 13,
                borderTop: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#faf7f4'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <div style={{ fontWeight: 600, color: C.textDark }}>{emp.name}</div>
              <div style={{ color: C.textLight, fontSize: 11 }}>
                {emp.jobtitle} · {emp.store_name} · {emp.app_number}
              </div>
            </div>
          ))}
          {!searching && results.length === 0 && keyword && (
            <div style={{ padding: '10px 14px', color: C.textLight, fontSize: 13 }}>找不到符合的人員</div>
          )}
        </div>
      )}
    </div>
  );
}

function NotifyPanel({ user }) {
  const [targets, setTargets]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [selected, setSelected] = useState(null);  // { name, app_number }
  const [notes, setNotes]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await checksApi.getTargets();
      setTargets(res.data || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(t) {
    try {
      await checksApi.updateTarget(t.id, { is_active: !t.is_active });
      load();
    } catch(e) { alert(e.message || '操作失敗'); }
  }

  async function handleDelete(id) {
    if (!window.confirm('確定刪除此通知對象？')) return;
    try { await checksApi.deleteTarget(id); load(); }
    catch(e) { alert(e.message || '操作失敗'); }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!selected?.app_number) return alert('請先選擇人員');
    try {
      await checksApi.createTarget({ ...selected, notes });
      setShowAdd(false);
      setSelected(null);
      setNotes('');
      load();
    } catch(e) { alert(e.message || '操作失敗'); }
  }

  async function handleTest() {
    if (!window.confirm('確定發送測試通知？')) return;
    try {
      await checksApi.testNotify();
      alert('測試通知已發送');
    } catch(e) { alert(e.message || '發送失敗'); }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      {/* 說明列 */}
      <div style={{
        background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10,
        padding: '14px 18px', marginBottom: 16, fontSize: 13, color: C.textMid, lineHeight: 1.7,
      }}>
        📱 每天早上 <strong>10:00</strong>，透過<strong>工單系統 LINE Bot</strong> 推播出款提醒給以下人員。<br />
        格式：「有 XX 戶名，NT$XXX 要出款」，逾期未出款也會一併列出。
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        <button onClick={handleTest} style={{ ...btnStyle, background: C.mid }}>
          🧪 測試推播
        </button>
        {canManage(user?.role) && (
          <button onClick={() => setShowAdd(!showAdd)} style={{ ...btnStyle, background: C.dark }}>
            ＋ 新增通知對象
          </button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} style={{
          background: '#fff', border: `1px solid ${C.border}`,
          borderRadius: 10, padding: 20, marginBottom: 16,
        }}>
          <div style={{ fontWeight: 700, color: C.textDark, marginBottom: 14 }}>新增通知對象</div>
          <EmployeePicker onSelect={emp => setSelected(emp)} />

          {/* 選定後顯示確認卡片 */}
          {selected && (
            <div style={{
              marginTop: 10, padding: '10px 14px',
              background: '#faf5ee', border: `1px solid ${C.mid}`,
              borderRadius: 8, fontSize: 13, color: C.textDark,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>✓</span>
              <div>
                <div style={{ fontWeight: 700 }}>{selected.name}</div>
                <div style={{ color: C.textLight, fontSize: 11 }}>app_number：{selected.app_number}</div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>備註（選填）</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              style={inputStyle} placeholder="選填" />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setShowAdd(false); setSelected(null); setNotes(''); }}
              style={{ ...btnStyle, background: '#e2e8f0', color: C.textDark }}>取消</button>
            <button type="submit" style={{ ...btnStyle, background: C.dark }}>新增</button>
          </div>
        </form>
      )}

      {loading ? <Loading /> : targets.length === 0 ? <EmptyBox text="尚未設定通知對象" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {targets.map(t => (
            <div key={t.id} style={{
              background: '#fff', border: `1px solid ${C.border}`,
              borderRadius: 10, padding: '12px 18px',
              display: 'flex', alignItems: 'center', gap: 12,
              opacity: t.is_active ? 1 : 0.5,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: C.textDark }}>{t.name}</div>
                <div style={{ color: C.textLight, fontSize: 12 }}>
                  📱 工單系統 LINE Bot · {t.app_number}
                </div>
                {t.notes && <div style={{ color: C.textLight, fontSize: 12 }}>{t.notes}</div>}
              </div>
              <span style={{
                ...badgeStyle,
                ...(t.is_active
                  ? { background: '#f0fff4', color: '#2d6a4f', border: '1px solid #b7e4c7' }
                  : { background: '#f5f5f5', color: '#888', border: '1px solid #ddd' }),
              }}>
                {t.is_active ? '啟用' : '停用'}
              </span>
              <button onClick={() => handleToggle(t)} style={{ ...smallBtnStyle, background: C.mid, color: '#fff' }}>
                {t.is_active ? '停用' : '啟用'}
              </button>
              {canManage(user?.role) && (
                <button onClick={() => handleDelete(t.id)} style={{ ...smallBtnStyle, background: '#e53e3e', color: '#fff' }}>刪除</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 合併科目 Modal
// ════════════════════════════════════════════════════════════
function MergeSubjectsModal({ subjects, onClose, onSaved }) {
  const [keepId,    setKeepId]    = useState('');
  const [mergeIds,  setMergeIds]  = useState([]);   // 要被合併掉的
  const [saving,    setSaving]    = useState(false);

  // 切換「被合併」選項（keepId 那個不能選）
  function toggleMerge(id) {
    setMergeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  // 當 keepId 改變，把 keepId 從 mergeIds 中移除
  function handleKeepChange(id) {
    setKeepId(id);
    setMergeIds(prev => prev.filter(x => x !== id));
  }

  async function handleSave() {
    if (!keepId)              return alert('請選擇要保留的科目');
    if (mergeIds.length === 0) return alert('請至少勾選一個要合併掉的科目');
    setSaving(true);
    try {
      const res = await checksApi.mergeSubjects(keepId, mergeIds);
      const kept = res.data?.kept?.name || '—';
      alert(`合併完成！已保留「${kept}」，合併了 ${mergeIds.length} 個科目`);
      onSaved();
    } catch(e) {
      alert(e.message || '合併失敗');
    } finally { setSaving(false); }
  }

  const keepName = subjects.find(s => s.id === keepId)?.name || '';

  return (
    <Modal title="🔀 合併科目" onClose={onClose} width={500}>
      {/* Step 1：選保留科目 */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>① 選擇要保留的科目（主科目）</label>
        <select value={keepId} onChange={e => handleKeepChange(e.target.value)} style={inputStyle}>
          <option value="">— 請選擇 —</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Step 2：勾選要合併掉的 */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>② 勾選要合併掉的科目（將被刪除）</label>
        <div style={{
          border: `1px solid ${C.border}`, borderRadius: 8,
          maxHeight: 260, overflowY: 'auto', background: '#faf7f4',
        }}>
          {subjects.filter(s => s.id !== keepId).map(s => (
            <label key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              borderBottom: `1px solid ${C.border}`,
              cursor: 'pointer',
              background: mergeIds.includes(s.id) ? '#fff3cd' : 'transparent',
            }}>
              <input
                type="checkbox"
                checked={mergeIds.includes(s.id)}
                onChange={() => toggleMerge(s.id)}
                style={{ width: 16, height: 16, accentColor: C.mid }}
              />
              <span style={{ fontSize: 14, color: C.textDark }}>{s.name}</span>
            </label>
          ))}
          {subjects.length <= 1 && (
            <div style={{ padding: 16, color: C.textLight, textAlign: 'center' }}>沒有可合併的科目</div>
          )}
        </div>
      </div>

      {/* 預覽 */}
      {keepId && mergeIds.length > 0 && (
        <div style={{
          background: '#fff8ec', border: '1px solid #e5c99a',
          borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13,
        }}>
          <strong style={{ color: C.dark }}>合併預覽：</strong>
          <div style={{ marginTop: 6, color: C.textMid }}>
            {mergeIds.map(id => subjects.find(s => s.id === id)?.name).join('、')}
            <span style={{ color: C.textLight }}> → 全部改為 </span>
            <strong style={{ color: C.dark }}>「{keepName}」</strong>
          </div>
          <div style={{ color: '#c53030', fontSize: 12, marginTop: 6 }}>
            ⚠ 被合併的科目將永久刪除，操作無法復原
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ ...btnStyle, background: '#e2e8f0', color: C.textDark }}>取消</button>
        <button
          onClick={handleSave}
          disabled={saving || !keepId || mergeIds.length === 0}
          style={{ ...btnStyle, background: C.dark, opacity: (saving || !keepId || mergeIds.length === 0) ? 0.5 : 1 }}
        >
          {saving ? '合併中...' : `✓ 確認合併（${mergeIds.length} 個）`}
        </button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
// 編輯批次 Modal
// ════════════════════════════════════════════════════════════
function EditBatchModal({ batch, subjects, onClose, onSaved }) {
  const [form, setForm] = useState({
    subject_id:    batch.subject?.id   ?? '',
    drawer_name:   batch.drawer_name   ?? '黃信儒',
    bank_name:     batch.bank_name     ?? '高銀',
    renewal_needed: batch.renewal_needed ?? false,
    notes:         batch.notes         ?? '',
  });
  const [saving, setSaving] = useState(false);
  // 新增科目
  const [newSubject, setNewSubject] = useState('');
  const [addingSubject, setAddingSubject] = useState(false);
  const [subjectList, setSubjectList] = useState(subjects);

  async function handleAddSubject() {
    if (!newSubject.trim()) return;
    try {
      const res = await checksApi.createSubject(newSubject.trim());
      const created = res.data;
      setSubjectList(prev => [...prev, created]);
      setForm(p => ({ ...p, subject_id: created.id }));
      setNewSubject('');
      setAddingSubject(false);
    } catch(e) { alert(e.message || '新增失敗'); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await checksApi.updateBatch(batch.id, {
        ...form,
        subject_id: form.subject_id || null,
      });
      onSaved();
    } catch(e) { alert(e.message || '儲存失敗'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={`編輯批次：${batch.batch_no}`} onClose={onClose} width={520}>
      <form onSubmit={handleSubmit}>
        {/* 科目 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <label style={{ ...labelStyle, marginBottom: 0, flex: 1 }}>支票科目</label>
            <button type="button" onClick={() => setAddingSubject(v => !v)}
              style={{ fontSize: 11, color: C.mid, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {addingSubject ? '取消' : '＋ 新增科目'}
            </button>
          </div>
          <select
            value={form.subject_id}
            onChange={e => setForm(p => ({ ...p, subject_id: e.target.value }))}
            style={inputStyle}
          >
            <option value="">— 選擇科目（可留空）—</option>
            {subjectList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {addingSubject && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                placeholder="輸入新科目名稱"
                autoFocus
              />
              <button type="button" onClick={handleAddSubject}
                style={{ ...btnStyle, background: C.mid, whiteSpace: 'nowrap' }}>新增</button>
            </div>
          )}
        </div>

        {/* 出款人 & 銀行 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>出款人</label>
            <select value={form.drawer_name} onChange={e => setForm(p => ({ ...p, drawer_name: e.target.value }))} style={inputStyle}>
              <option value="黃信儒">黃信儒</option>
              <option value="黃志雄">黃志雄</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>出款銀行</label>
            <select value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} style={inputStyle}>
              <option value="高銀">高銀</option>
              <option value="三信">三信</option>
            </select>
          </div>
        </div>

        {/* 續票提醒 */}
        <div style={{ marginBottom: 14 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            padding: '10px 14px', borderRadius: 8,
            border: `1.5px solid ${form.renewal_needed ? C.mid : C.border}`,
            background: form.renewal_needed ? '#faf5ee' : '#fafafa',
          }}>
            <input type="checkbox" checked={form.renewal_needed}
              onChange={e => setForm(p => ({ ...p, renewal_needed: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: C.mid, cursor: 'pointer' }} />
            <div>
              <div style={{ fontWeight: 600, color: C.dark, fontSize: 13 }}>🔔 需要續票提醒</div>
              <div style={{ color: C.textLight, fontSize: 11 }}>剩最後 1 張待出款時自動通知</div>
            </div>
          </label>
        </div>

        {/* 備註 */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>備註</label>
          <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            style={inputStyle} placeholder="選填" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose}
            style={{ ...btnStyle, background: '#e2e8f0', color: C.textDark }}>取消</button>
          <button type="submit" disabled={saving}
            style={{ ...btnStyle, background: C.dark, opacity: saving ? 0.7 : 1 }}>
            {saving ? '儲存中...' : '儲存'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
// 新增批次 Modal
// ════════════════════════════════════════════════════════════
function CreateBatchModal({ subjects, onClose, onSaved }) {
  const [form, setForm] = useState({
    subject_id: '', drawer_name: '黃信儒', bank_name: '高銀',
    renewal_needed: false, notes: '',
  });
  const [checks, setChecks] = useState([
    { seq_no: 1, due_date: '', amount: '', check_no: '' },
  ]);
  const [saving, setSaving] = useState(false);

  function addRow() {
    setChecks(prev => {
      const last = prev[prev.length - 1];

      // 下個月同一天：若該月沒有同一天（如 1/31 → 2月無31日）則留空
      let nextDate = '';
      if (last?.due_date) {
        const d = new Date(last.due_date);
        const origDay = d.getDate();
        d.setMonth(d.getMonth() + 1);
        nextDate = d.getDate() === origDay ? d.toISOString().slice(0, 10) : '';
      }

      return [...prev, {
        seq_no:   prev.length + 1,
        due_date: nextDate,
        amount:   last?.amount  ?? '',   // 複製上一張金額
        check_no: '',                    // 票號不複製
        _autoDate: !!nextDate,           // 標記是否為自動填入
      }];
    });
  }
  function removeRow(i) {
    setChecks(prev => prev.filter((_, j) => j !== i).map((c, j) => ({ ...c, seq_no: j + 1 })));
  }
  function setCheck(i, field, value) {
    setChecks(prev => prev.map((c, j) => j === i ? { ...c, [field]: value } : c));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (checks.some(c => !c.due_date)) return alert('請填寫所有支票的到期日');
    setSaving(true);
    try {
      await checksApi.createBatch({
        ...form,
        subject_id: form.subject_id || null,
        checks: checks.map(c => ({
          ...c,
          amount: c.amount ? parseFloat(c.amount) : null,
        })),
      });
      onSaved();
    } catch(e) { alert(e.message || '建立失敗'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="新增支票批次" onClose={onClose} width={700}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>支票科目</label>
            <select value={form.subject_id} onChange={e => setForm(p => ({ ...p, subject_id: e.target.value }))} style={inputStyle}>
              <option value="">— 選擇科目 —</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>出款人 *</label>
            <select value={form.drawer_name} onChange={e => setForm(p => ({ ...p, drawer_name: e.target.value }))} style={inputStyle} required>
              <option value="黃信儒">黃信儒</option>
              <option value="黃志雄">黃志雄</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>出款銀行</label>
            <select value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} style={inputStyle}>
              <option value="高銀">高銀</option>
              <option value="三信">三信</option>
            </select>
          </div>
        </div>
        {/* 續票提醒勾選 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            padding: '10px 14px', borderRadius: 8,
            border: `1.5px solid ${form.renewal_needed ? C.mid : C.border}`,
            background: form.renewal_needed ? '#faf5ee' : '#fafafa',
            transition: 'all 0.15s',
          }}>
            <input
              type="checkbox"
              checked={form.renewal_needed}
              onChange={e => setForm(p => ({ ...p, renewal_needed: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: C.mid, cursor: 'pointer' }}
            />
            <div>
              <div style={{ fontWeight: 600, color: C.dark, fontSize: 13 }}>
                🔔 需要續票提醒
              </div>
              <div style={{ color: C.textLight, fontSize: 11, marginTop: 2 }}>
                批次剩最後 1 張待出款時，自動 LINE 通知指定人員
              </div>
            </div>
          </label>
        </div>
        <div>
          <label style={labelStyle}>備註</label>
          <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            style={{ ...inputStyle, marginBottom: 16 }} placeholder="選填" />
        </div>

        {/* 支票列表 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontWeight: 600, color: C.textDark }}>支票明細</div>
          <div style={{ color: C.textLight, fontSize: 11 }}>
            新增下一張時自動帶入：金額、下個月同日
          </div>
        </div>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 40px', background: '#f5f0ea', padding: '8px 12px', gap: 8 }}>
            {['#','到期日 *','金額','票號',''].map((h, i) => (
              <div key={i} style={{ color: C.textMid, fontSize: 12, fontWeight: 600 }}>{h}</div>
            ))}
          </div>
          {checks.map((c, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 40px',
              padding: '8px 12px', gap: 8, borderTop: `1px solid ${C.border}`,
              background: i % 2 === 0 ? '#fff' : '#faf7f4',
            }}>
              <div style={{ color: C.textLight, fontSize: 12, lineHeight: '34px' }}>#{c.seq_no}</div>
              {/* 到期日：自動填入時顯示淡藍色邊框提示 */}
              <div style={{ position: 'relative' }}>
                <input
                  type="date"
                  value={c.due_date}
                  onChange={e => setCheck(i, 'due_date', e.target.value)}
                  style={{
                    ...inputStyle, marginBottom: 0,
                    borderColor: c._autoDate && c.due_date ? C.mid : C.border,
                  }}
                  required
                />
                {c._autoDate && c.due_date && (
                  <div style={{ fontSize: 10, color: C.mid, marginTop: 2 }}>↩ 自動帶入</div>
                )}
              </div>
              <input type="number" value={c.amount} onChange={e => setCheck(i, 'amount', e.target.value)}
                style={{ ...inputStyle, marginBottom: 0 }} placeholder="金額（可空）" />
              <input value={c.check_no} onChange={e => setCheck(i, 'check_no', e.target.value)}
                style={{ ...inputStyle, marginBottom: 0 }} placeholder="票號（可空）" />
              <button type="button" onClick={() => removeRow(i)}
                style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow} style={{ ...btnStyle, background: '#e2e8f0', color: C.textDark, marginBottom: 20 }}>
          ＋ 加入一張支票
        </button>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ ...btnStyle, background: '#e2e8f0', color: C.textDark }}>取消</button>
          <button type="submit" disabled={saving} style={{ ...btnStyle, background: C.dark, opacity: saving ? 0.7 : 1 }}>
            {saving ? '建立中...' : '建立批次'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
// Excel 匯入 Modal
// ════════════════════════════════════════════════════════════
function ImportModal({ onClose, onSaved }) {
  const [step, setStep]       = useState('upload'); // upload / preview / done
  const [parsed, setParsed]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const fileRef = useRef();

  async function handleParse() {
    const file = fileRef.current?.files[0];
    if (!file) return alert('請選擇 Excel 檔案');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await checksApi.importParse(fd);
      setParsed(res.data);
      setStep('preview');
    } catch(e) { alert(e.message || '解析失敗'); }
    finally { setLoading(false); }
  }

  async function handleConfirm() {
    if (!window.confirm(`確定匯入 ${parsed.batch_count} 個批次、${parsed.total_rows} 張支票？`)) return;
    setLoading(true);
    try {
      const res = await checksApi.importConfirm({ batches: parsed.batches });
      setResult(res.data);
      setStep('done');
    } catch(e) { alert(e.message || '匯入失敗'); }
    finally { setLoading(false); }
  }

  return (
    <Modal title="Excel 匯入支票" onClose={onClose} width={700}>
      {step === 'upload' && (
        <div>
          <div style={{ color: C.textMid, fontSize: 13, marginBottom: 20, lineHeight: 1.7 }}>
            上傳現有的支票 Excel 檔案（.xlsx），系統會自動解析：
            <ul style={{ marginTop: 8 }}>
              <li>出款戶名 → 出款人 + 銀行</li>
              <li>支票備註（如「東山12-1」）→ 科目 + 批次 + 序號</li>
              <li>到期日自動判斷：過去的日期 → 已出款</li>
              <li>非標準欄位自動跳過</li>
            </ul>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ marginBottom: 20 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={onClose} style={{ ...btnStyle, background: '#e2e8f0', color: C.textDark }}>取消</button>
            <button onClick={handleParse} disabled={loading} style={{ ...btnStyle, background: C.dark }}>
              {loading ? '解析中...' : '解析檔案'}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && parsed && (
        <div>
          {/* 統計 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: '解析批次', value: parsed.batch_count },
              { label: '總支票數', value: parsed.total_rows },
              { label: '待出款',   value: parsed.batches.reduce((s, b) => s + b.pending_count, 0) },
              { label: '跳過筆數', value: parsed.skipped_count },
            ].map(item => (
              <div key={item.label} style={{
                background: '#faf7f4', border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '12px 16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.dark }}>{item.value}</div>
                <div style={{ fontSize: 12, color: C.textLight }}>{item.label}</div>
              </div>
            ))}
          </div>

          {/* 批次預覽 */}
          <div style={{ maxHeight: 320, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 70px 60px', background: '#f5f0ea', padding: '8px 14px', fontSize: 12, fontWeight: 600, color: C.textMid }}>
              <div>科目</div><div>出款人</div><div>銀行</div><div>張數</div><div>待出款</div>
            </div>
            {parsed.batches.map((b, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 80px 70px 60px',
                padding: '8px 14px', fontSize: 13, borderTop: `1px solid ${C.border}`,
                background: i % 2 === 0 ? '#fff' : '#faf7f4',
              }}>
                <div style={{ fontWeight: 500, color: C.textDark }}>{b.subject || '（未分類）'}</div>
                <div style={{ color: C.textMid }}>{b.drawer_name}</div>
                <div style={{ color: C.textMid }}>{b.bank_name}</div>
                <div style={{ color: C.textMid }}>{b.check_count}</div>
                <div style={{ color: b.pending_count > 0 ? '#e53e3e' : '#38a169', fontWeight: 600 }}>{b.pending_count}</div>
              </div>
            ))}
          </div>

          {/* 跳過記錄 */}
          {parsed.skipped_count > 0 && (
            <div style={{ marginTop: 12, color: C.textLight, fontSize: 12 }}>
              ⚠ 跳過 {parsed.skipped_count} 筆（非標準出款戶名或無法解析日期）
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button onClick={() => setStep('upload')} style={{ ...btnStyle, background: '#e2e8f0', color: C.textDark }}>重新上傳</button>
            <button onClick={handleConfirm} disabled={loading} style={{ ...btnStyle, background: C.dark }}>
              {loading ? '匯入中...' : `確認匯入 ${parsed.batch_count} 批次`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={{ fontWeight: 700, color: C.textDark, fontSize: 18, marginBottom: 8 }}>匯入完成！</div>
          <div style={{ color: C.textMid, fontSize: 14 }}>
            成功匯入 {result.imported_batches} 個批次、{result.imported_checks} 張支票
          </div>
          {result.errors?.length > 0 && (
            <div style={{ color: '#e53e3e', fontSize: 12, marginTop: 8 }}>
              {result.errors.length} 個批次匯入失敗
            </div>
          )}
          <button onClick={onSaved} style={{ ...btnStyle, background: C.dark, marginTop: 24 }}>完成</button>
        </div>
      )}
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
// 共用元件
// ════════════════════════════════════════════════════════════
function Modal({ title, onClose, children, width = 560 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width, maxWidth: '95vw',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 22px', borderBottom: `1px solid ${C.border}`,
          background: C.dark, borderRadius: '14px 14px 0 0',
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{title}</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.light, fontSize: 22, lineHeight: 1,
          }}>✕</button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: C.textLight }}>載入中...</div>
  );
}

function EmptyBox({ text }) {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 20px', color: C.textLight,
      background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`,
    }}>
      {text}
    </div>
  );
}

// ── 樣式常數 ─────────────────────────────────────────────────
const selectStyle = {
  padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 7,
  background: '#fff', color: C.textDark, fontSize: 13,
  cursor: 'pointer', minWidth: 110,
};
const btnStyle = {
  padding: '8px 16px', border: 'none', borderRadius: 7,
  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const smallBtnStyle = {
  padding: '4px 10px', border: 'none', borderRadius: 5,
  fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const badgeStyle = {
  display: 'inline-block', fontSize: 11, fontWeight: 600,
  padding: '2px 8px', borderRadius: 999,
};
const labelStyle = {
  display: 'block', fontSize: 12, color: C.textMid,
  fontWeight: 600, marginBottom: 4,
};
const inputStyle = {
  width: '100%', padding: '8px 10px',
  border: `1px solid ${C.border}`, borderRadius: 6,
  fontSize: 13, color: C.textDark, boxSizing: 'border-box',
  marginBottom: 0,
};
