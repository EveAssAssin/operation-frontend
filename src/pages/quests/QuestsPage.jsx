// pages/quests/QuestsPage.jsx
// 任務派發 + 審核：3 個 tab
//   派發       - 列表 + 建立任務（送往市場部）
//   待審核交付 - 員工提交的待審清單，每筆可 通過 / 退回重交 / 駁回
//   審核紀錄   - 已審清單（唯讀）

import { useState, useEffect, useCallback } from 'react';
import { questsApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// ── 品牌色 ───────────────────────────────────────────────────
const C = {
  dark:   '#50422d',
  mid:    '#8b6f4e',
  light:  '#cdbea2',
  bg:     '#f5f0ea',
  bgCard: '#ffffff',
  border: '#e0d5c8',
  textDark:  '#3a2e1e',
  textMid:   '#6b5640',
  textLight: '#9a8878',
};

// ── 狀態樣式 ─────────────────────────────────────────────────
const STATUS_LABEL = { pending: '待送出', sent: '已送出', failed: '送出失敗' };
const STATUS_COLOR = {
  pending: { bg: '#fff8ec', text: '#8b6f4e', border: '#e5c99a' },
  sent:    { bg: '#f0fff4', text: '#2d6a4f', border: '#b7e4c7' },
  failed:  { bg: '#fff0f0', text: '#c53030', border: '#feb2b2' },
};

// 審核狀態
const REVIEW_LABEL = {
  approved:         '✅ 已通過',
  rejected:         '❌ 已駁回',
  reject_resubmit:  '↩️ 退回重交',
  pending:          '⏳ 待審核',
};
const REVIEW_COLOR = {
  approved:        { bg: '#f0fff4', text: '#2d6a4f', border: '#b7e4c7' },
  rejected:        { bg: '#fff0f0', text: '#c53030', border: '#feb2b2' },
  reject_resubmit: { bg: '#fff8ec', text: '#8b6f4e', border: '#e5c99a' },
  pending:         { bg: '#f0f4ff', text: '#3b5bdb', border: '#bac8ff' },
};

const TABS = [
  { key: 'dispatch', label: '任務派發',     icon: '📋' },
  { key: 'pending',  label: '待審核交付',   icon: '⏳' },
  { key: 'reviewed', label: '審核紀錄',     icon: '📚' },
];

// ── 工具 ─────────────────────────────────────────────────────
const fmtDateTime = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
};

// ════════════════════════════════════════════════════════════
// 主頁面
// ════════════════════════════════════════════════════════════
export default function QuestsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('dispatch');

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* 頁首 */}
      <div style={{ background: C.dark, padding: '20px 28px 0' }}>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          📋 任務派發
        </div>
        <div style={{ color: C.light, fontSize: 13, marginBottom: 16 }}>
          指派任務給市場部、審核員工交付（由市場部任務系統發放點數）
        </div>
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

      <div style={{ padding: '24px 28px' }}>
        {tab === 'dispatch' && <DispatchPanel user={user} />}
        {tab === 'pending'  && <PendingPanel  user={user} />}
        {tab === 'reviewed' && <ReviewedPanel user={user} />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 1：任務派發
// ════════════════════════════════════════════════════════════
function DispatchPanel({ user }) {
  const [list, setList]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await questsApi.list({ limit: 100 });
      setList(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      alert('載入失敗：' + (e.response?.data?.message || e.message));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => setCreating(true)} style={btnPrimary}>＋ 建立新任務</button>
      </div>
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: '#f9f5ee' }}>
            <tr>
              <Th>狀態</Th><Th>標題</Th><Th>截止時間</Th><Th>指派群組數</Th>
              <Th>建立者</Th><Th>建立時間</Th><Th>動作</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={emptyCell}>載入中…</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={7} style={emptyCell}>還沒有任務，點右上角「＋ 建立新任務」開始</td></tr>
            ) : list.map(q => (
              <tr key={q.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <Td><StatusBadge status={q.status} /></Td>
                <Td>
                  <div style={{ fontWeight: 600, color: C.textDark }}>{q.title}</div>
                  {q.description && (
                    <div style={{ color: C.textLight, fontSize: 12, marginTop: 2 }}>
                      {q.description.slice(0, 60)}{q.description.length > 60 ? '…' : ''}
                    </div>
                  )}
                </Td>
                <Td>{fmtDateTime(q.task_deadline)}</Td>
                <Td>{Array.isArray(q.assignees) ? q.assignees.length : 0} 組</Td>
                <Td>{q.created_by_name || '—'}</Td>
                <Td>{fmtDateTime(q.created_at)}</Td>
                <Td>
                  <button onClick={() => setDetailId(q.id)} style={btnGhost}>詳情</button>
                  {q.status === 'failed' && (
                    <button onClick={async () => {
                      if (!confirm('要重新送出這筆任務嗎？')) return;
                      try {
                        await questsApi.resend(q.id);
                        await load();
                      } catch (e) {
                        alert('重送失敗：' + (e.response?.data?.message || e.message));
                      }
                    }} style={{ ...btnGhost, color: '#c53030', marginLeft: 6 }}>重送</button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={async () => { setCreating(false); await load(); }} user={user} />}
      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} onUpdated={load} />}
    </>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 2：待審核交付
// ════════════════════════════════════════════════════════════
function PendingPanel({ user }) {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await questsApi.listPending();
      setList(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      alert('載入待審清單失敗：' + (e.response?.data?.message || e.message));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (sub) => {
    if (!confirm(`確定通過 ${sub.name} 提交的「${sub.quests?.title || '任務'}」？`)) return;
    try {
      await questsApi.approve(sub.id);
      await load();
    } catch (e) {
      alert('通過失敗：' + (e.response?.data?.message || e.message));
    }
  };
  const handleResubmit = async (sub) => {
    const reason = prompt(`退回 ${sub.name} 的提交（員工可重交）。請填理由：`);
    if (!reason || !reason.trim()) return;
    try {
      await questsApi.rejectResubmit(sub.id, reason.trim());
      await load();
    } catch (e) {
      alert('退回失敗：' + (e.response?.data?.message || e.message));
    }
  };
  const handleReject = async (sub) => {
    const reason = prompt(`駁回 ${sub.name} 的提交（任務失敗，員工不可再交）。請填理由：`);
    if (!reason || !reason.trim()) return;
    if (!confirm(`確定駁回？這會讓「${sub.quests?.title || '任務'}」對該員工失敗，無法再交`)) return;
    try {
      await questsApi.reject(sub.id, reason.trim());
      await load();
    } catch (e) {
      alert('駁回失敗：' + (e.response?.data?.message || e.message));
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ color: C.textMid, fontSize: 13 }}>
          {loading ? '…' : `共 ${list.length} 筆待審`}
        </div>
        <button onClick={load} style={btnGhost}>🔄 重新整理</button>
      </div>

      {loading ? (
        <Empty>載入中…</Empty>
      ) : list.length === 0 ? (
        <Empty>目前沒有待審核的交付 🎉</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map(sub => (
            <SubmissionCard
              key={sub.id}
              sub={sub}
              onApprove={() => handleApprove(sub)}
              onResubmit={() => handleResubmit(sub)}
              onReject={() => handleReject(sub)}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
// Tab 3：審核紀錄（唯讀）
// ════════════════════════════════════════════════════════════
function ReviewedPanel() {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit]     = useState(50);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await questsApi.listReviewed(limit);
      setList(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      alert('載入失敗：' + (e.response?.data?.message || e.message));
    } finally { setLoading(false); }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ color: C.textMid, fontSize: 13 }}>
          顯示最近 {limit} 筆，共 {loading ? '…' : list.length} 筆
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={{ ...inputStyle, width: 100 }}>
            <option value={50}>50 筆</option>
            <option value={100}>100 筆</option>
            <option value={200}>200 筆</option>
          </select>
          <button onClick={load} style={btnGhost}>🔄 重新整理</button>
        </div>
      </div>

      {loading ? (
        <Empty>載入中…</Empty>
      ) : list.length === 0 ? (
        <Empty>還沒有審核紀錄</Empty>
      ) : (
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#f9f5ee' }}>
              <tr>
                <Th>結果</Th><Th>任務</Th><Th>提交人</Th>
                <Th>提交時間</Th><Th>審核人</Th><Th>審核時間</Th><Th>理由 / 詳情</Th>
              </tr>
            </thead>
            <tbody>
              {list.map(sub => {
                const reviewStatus = sub.status || sub.review_status || 'approved';
                return (
                  <tr key={sub.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <Td><ReviewBadge status={reviewStatus} /></Td>
                    <Td>{sub.quests?.title || sub.quest_title || '—'}</Td>
                    <Td>{sub.name || sub.member_id || '—'}</Td>
                    <Td>{fmtDateTime(sub.submitted_at)}</Td>
                    <Td>{sub.reviewer_name || '—'}</Td>
                    <Td>{fmtDateTime(sub.reviewed_at)}</Td>
                    <Td style={{ maxWidth: 300 }}>
                      {sub.reject_reason
                        ? <span style={{ color: '#c53030' }}>{sub.reject_reason}</span>
                        : <span style={{ color: C.textLight }}>—</span>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
// 待審 Submission 卡片
// ════════════════════════════════════════════════════════════
function SubmissionCard({ sub, onApprove, onResubmit, onReject }) {
  const q = sub.quests || {};
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark, marginBottom: 4 }}>
            {q.title || '(任務標題缺失)'}
            {q.urgency === 'urgent' && (
              <span style={{ marginLeft: 8, fontSize: 11, background: '#fff0f0', color: '#c53030', padding: '2px 8px', borderRadius: 8 }}>緊急</span>
            )}
            {q.tag_name && (
              <span style={{ marginLeft: 8, fontSize: 11, color: C.textMid, background: '#f5f0ea', padding: '2px 8px', borderRadius: 8 }}>{q.tag_name}</span>
            )}
          </div>
          <div style={{ color: C.textMid, fontSize: 13, marginBottom: 8 }}>
            👤 {sub.name || '—'} <span style={{ color: C.textLight }}>({sub.member_id})</span>
            <span style={{ marginLeft: 12 }}>📅 提交於 {fmtDateTime(sub.submitted_at)}</span>
            {q.award_points && q.xp != null && (
              <span style={{ marginLeft: 12 }}>⭐ {q.xp} 點</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onApprove}  style={btnApprove}>✅ 通過</button>
          <button onClick={onResubmit} style={btnResubmit}>↩️ 退回重交</button>
          <button onClick={onReject}   style={btnReject}>❌ 駁回</button>
        </div>
      </div>

      {/* submission_data 動態渲染 */}
      <div style={{ marginTop: 12, padding: 12, background: '#fafaf7', border: `1px solid ${C.border}`, borderRadius: 6 }}>
        <div style={{ fontSize: 12, color: C.textMid, fontWeight: 600, marginBottom: 6 }}>交付內容</div>
        <SubmissionData data={sub.submission_data} />
      </div>
    </div>
  );
}

function SubmissionData({ data }) {
  if (data == null || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return <div style={{ color: C.textLight, fontSize: 13 }}>（無內容）</div>;
  }
  if (typeof data === 'string') {
    return <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: C.textDark }}>{data}</div>;
  }
  // object：嘗試辨識 text / image / images / answer 等常見欄位
  const text = data.text || data.answer || data.note || data.content;
  const imgs =
    Array.isArray(data.images) ? data.images
    : Array.isArray(data.photos) ? data.photos
    : (data.image_url ? [data.image_url] : (data.image ? [data.image] : []));

  const otherKeys = Object.keys(data).filter(k => !['text','answer','note','content','images','photos','image_url','image'].includes(k));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {text && (
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: C.textDark }}>{String(text)}</div>
      )}
      {imgs.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {imgs.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer">
              <img src={url} alt={`提交圖片 ${i+1}`} style={{
                maxWidth: 160, maxHeight: 160, objectFit: 'cover',
                borderRadius: 6, border: `1px solid ${C.border}`,
              }} />
            </a>
          ))}
        </div>
      )}
      {otherKeys.length > 0 && (
        <details>
          <summary style={{ fontSize: 12, color: C.textMid, cursor: 'pointer' }}>原始 JSON</summary>
          <pre style={preStyle}>{JSON.stringify(data, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 建立任務 Modal
// ════════════════════════════════════════════════════════════
function CreateModal({ onClose, onCreated, user }) {
  const [groups, setGroups]               = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError]     = useState(null);

  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [deadline, setDeadline]         = useState(defaultDeadline());
  const [groupIds, setGroupIds]         = useState([]);
  const [manualGroupId, setManualGroupId] = useState('');
  const [awardPoints, setAwardPoints]   = useState(true);
  const [submitText, setSubmitText]     = useState(true);
  const [submitImage, setSubmitImage]   = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  useEffect(() => {
    (async () => {
      setGroupsLoading(true); setGroupsError(null);
      try {
        const res = await questsApi.getGroups(true);
        const arr =
          Array.isArray(res?.data) ? res.data
          : Array.isArray(res?.data?.data) ? res.data.data
          : Array.isArray(res) ? res
          : [];
        setGroups(arr);
      } catch (e) {
        setGroupsError(e.response?.data?.message || e.message);
      } finally { setGroupsLoading(false); }
    })();
  }, []);

  const toggleGroup = (id) => {
    setGroupIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const selectAllGroups = () => setGroupIds(groups.map(g => g.id || g.group_id));
  const clearAllGroups  = () => setGroupIds([]);

  const submit = async () => {
    if (!title.trim()) { alert('請輸入任務標題'); return; }
    if (!deadline)     { alert('請選擇截止時間'); return; }

    let assignees;
    if (groupsError) {
      const ids = manualGroupId.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
      if (ids.length === 0) { alert('請至少填一個 group_id'); return; }
      assignees = ids.map(id => ({ type: 'group', group_id: id }));
    } else {
      if (groupIds.length === 0) { alert('請至少選擇一個指派群組'); return; }
      assignees = groupIds.map(id => ({ type: 'group', group_id: id }));
    }

    const required_submission = [];
    if (submitText)  required_submission.push('text');
    if (submitImage) required_submission.push('image');
    if (required_submission.length === 0) {
      alert('至少要勾選一項繳交內容（文字 / 圖片）');
      return;
    }

    setSubmitting(true);
    try {
      await questsApi.create({
        title: title.trim(),
        description: description.trim(),
        task_deadline: deadline.length === 16 ? `${deadline}:00` : deadline,
        award_points: awardPoints,
        required_submission,
        assignees,
      });
      onCreated();
    } catch (e) {
      alert('建立失敗：' + (e.response?.data?.message || e.message));
    } finally { setSubmitting(false); }
  };

  return (
    <Modal onClose={onClose} title="建立新任務">
      <Field label="任務標題 *">
        <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="例如：本週門市拜訪回報" />
      </Field>

      <Field label="任務說明">
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="說明任務內容、要求、繳交格式…" />
      </Field>

      <Field label="截止時間 *">
        <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} style={inputStyle} />
      </Field>

      <Field label={`指派群組（市場部 employee_groups，可複選）* ${groupIds.length > 0 ? `已選 ${groupIds.length} 組` : ''}`}>
        {groupsLoading ? (
          <div style={{ color: C.textLight, fontSize: 13 }}>載入群組中…</div>
        ) : groupsError ? (
          <div>
            <div style={{ color: '#c53030', fontSize: 13, marginBottom: 6 }}>
              無法載入群組：{groupsError}
            </div>
            <input value={manualGroupId} onChange={e => setManualGroupId(e.target.value)} style={inputStyle}
              placeholder="手動填 group_id UUID（多組用逗號或空白分隔）" />
          </div>
        ) : groups.length === 0 ? (
          <div style={{ color: C.textLight, fontSize: 13 }}>市場部還沒有群組可選</div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <button type="button" onClick={selectAllGroups} style={btnTinyGhost}>全選</button>
              <button type="button" onClick={clearAllGroups}  style={btnTinyGhost}>全清</button>
            </div>
            <div style={{
              maxHeight: 240, overflowY: 'auto', border: `1px solid ${C.border}`,
              borderRadius: 6, padding: 8, background: '#fafaf7',
            }}>
              {groups.map(g => {
                const id = g.id || g.group_id;
                const name = g.name || g.group_name || id;
                const memberCount = g.member_count != null ? g.member_count
                  : (Array.isArray(g.members) ? g.members.length : null);
                const checked = groupIds.includes(id);
                return (
                  <label key={id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 4px',
                    cursor: 'pointer', borderRadius: 4,
                    background: checked ? '#fff8ec' : 'transparent',
                  }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleGroup(id)}
                      style={{ marginTop: 3 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: C.textDark, fontWeight: 600 }}>
                        {name}
                        {memberCount != null && (
                          <span style={{ color: C.textLight, fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                            ({memberCount} 人)
                          </span>
                        )}
                      </div>
                      {g.description && (
                        <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{g.description}</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </Field>

      <Field label="繳交內容 *">
        <label style={{ marginRight: 16 }}>
          <input type="checkbox" checked={submitText} onChange={e => setSubmitText(e.target.checked)} /> 文字
        </label>
        <label>
          <input type="checkbox" checked={submitImage} onChange={e => setSubmitImage(e.target.checked)} /> 圖片
        </label>
      </Field>

      <Field label="獎勵點數">
        <label>
          <input type="checkbox" checked={awardPoints} onChange={e => setAwardPoints(e.target.checked)} />
          {' '}完成後由市場部任務系統發放點數
        </label>
      </Field>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
        <button onClick={onClose} style={btnGhost} disabled={submitting}>取消</button>
        <button onClick={submit} style={btnPrimary} disabled={submitting}>
          {submitting ? '送出中…' : '建立並送出'}
        </button>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
// 派發任務詳情 Modal
// ════════════════════════════════════════════════════════════
function DetailModal({ id, onClose, onUpdated }) {
  const [quest, setQuest]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await questsApi.get(id);
        setQuest(res.data);
      } catch (e) {
        alert('讀取失敗：' + (e.response?.data?.message || e.message));
        onClose();
      } finally { setLoading(false); }
    })();
  }, [id]);

  const resend = async () => {
    if (!confirm('要重新送出這筆任務嗎？')) return;
    setResending(true);
    try {
      const res = await questsApi.resend(id);
      setQuest(res.data);
      onUpdated && onUpdated();
    } catch (e) {
      alert('重送失敗：' + (e.response?.data?.message || e.message));
    } finally { setResending(false); }
  };

  return (
    <Modal onClose={onClose} title="任務詳情" wide>
      {loading || !quest ? (
        <div style={{ padding: 24, textAlign: 'center', color: C.textLight }}>載入中…</div>
      ) : (
        <>
          <Row label="狀態"><StatusBadge status={quest.status} /></Row>
          <Row label="標題">{quest.title}</Row>
          <Row label="說明"><div style={{ whiteSpace: 'pre-wrap' }}>{quest.description || '—'}</div></Row>
          <Row label="截止時間">{fmtDateTime(quest.task_deadline)}</Row>
          <Row label="建立者">{quest.created_by_name || '—'}</Row>
          <Row label="建立時間">{fmtDateTime(quest.created_at)}</Row>
          <Row label="獎勵點數">{quest.award_points ? '是' : '否'}</Row>
          <Row label="繳交內容">{(quest.required_submission || []).join(', ')}</Row>
          <Row label={`指派群組（${Array.isArray(quest.assignees) ? quest.assignees.length : 0} 組）`}>
            <pre style={preStyle}>{JSON.stringify(quest.assignees, null, 2)}</pre>
          </Row>
          <Row label="市場部 task_id">{quest.market_task_id || '—'}</Row>
          {quest.last_error && <Row label="最後錯誤"><span style={{ color: '#c53030' }}>{quest.last_error}</span></Row>}
          <Row label="送出 payload">
            <pre style={preStyle}>{JSON.stringify(quest.request_payload, null, 2)}</pre>
          </Row>
          <Row label="市場部回應">
            <pre style={preStyle}>{JSON.stringify(quest.response_payload, null, 2)}</pre>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            {quest.status === 'failed' && (
              <button onClick={resend} style={btnPrimary} disabled={resending}>
                {resending ? '重送中…' : '重送'}
              </button>
            )}
            <button onClick={onClose} style={btnGhost}>關閉</button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
// 共用元件
// ════════════════════════════════════════════════════════════
function Th({ children }) {
  return <th style={{ textAlign: 'left', padding: '10px 12px', color: C.textMid, fontWeight: 600, fontSize: 12 }}>{children}</th>;
}
function Td({ children, style }) {
  return <td style={{ padding: '10px 12px', verticalAlign: 'top', ...(style || {}) }}>{children}</td>;
}
function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.pending;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>{STATUS_LABEL[status] || status}</span>
  );
}
function ReviewBadge({ status }) {
  const c = REVIEW_COLOR[status] || REVIEW_COLOR.pending;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>{REVIEW_LABEL[status] || status}</span>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: C.textMid, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', borderTop: `1px solid ${C.border}`, padding: '10px 0' }}>
      <div style={{ width: 130, color: C.textMid, fontSize: 12, fontWeight: 600 }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13, color: C.textDark }}>{children}</div>
    </div>
  );
}
function Empty({ children }) {
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: 40, textAlign: 'center', color: C.textLight, fontSize: 14,
    }}>{children}</div>
  );
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '60px 20px', overflowY: 'auto', zIndex: 1000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, padding: 24,
        width: wide ? 720 : 560, maxWidth: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: C.dark }}>{title}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 24, cursor: 'pointer', color: C.textLight }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── styles ──────────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 14,
  border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: 'border-box',
};
const btnPrimary = {
  padding: '8px 18px', background: C.dark, color: '#fff',
  border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13,
};
const btnGhost = {
  padding: '6px 12px', background: 'transparent', color: C.textMid,
  border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 12,
};
const btnTinyGhost = {
  padding: '4px 10px', background: 'transparent', color: C.textMid,
  border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 11,
};
const btnApprove = {
  padding: '6px 14px', background: '#2d6a4f', color: '#fff',
  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
};
const btnResubmit = {
  padding: '6px 14px', background: '#fff8ec', color: '#8b6f4e',
  border: '1px solid #e5c99a', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
};
const btnReject = {
  padding: '6px 14px', background: '#fff', color: '#c53030',
  border: '1px solid #feb2b2', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
};
const preStyle = {
  background: '#f9f5ee', border: `1px solid ${C.border}`, borderRadius: 6,
  padding: 10, fontSize: 12, overflow: 'auto', maxHeight: 220, margin: 0,
};
const emptyCell = { padding: 32, textAlign: 'center', color: C.textLight };

// ── 預設截止時間（今天 +7 天 23:59）──────────────────────────
function defaultDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
