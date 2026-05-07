// pages/quests/QuestsPage.jsx
// 任務派發系統：列表 + 建立 + 詳情
// 任務會送到「市場部」employee_groups，由市場部任務系統發放點數

import { useState, useEffect, useCallback } from 'react';
import { questsApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// ── 品牌色（沿用 Checks 風格）────────────────────────────────
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
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* 頁首 */}
      <div style={{ background: C.dark, padding: '20px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              📋 任務派發
            </div>
            <div style={{ color: C.light, fontSize: 13 }}>
              指派任務給市場部，由市場部任務系統發放點數
            </div>
          </div>
          <button onClick={() => setCreating(true)} style={{
            padding: '10px 20px', background: '#fff', color: C.dark, border: 'none',
            borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14,
          }}>＋ 建立新任務</button>
        </div>
      </div>

      {/* 內容 */}
      <div style={{ padding: '24px 28px' }}>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#f9f5ee' }}>
              <tr>
                <Th>狀態</Th>
                <Th>標題</Th>
                <Th>截止時間</Th>
                <Th>建立者</Th>
                <Th>建立時間</Th>
                <Th>動作</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: C.textLight }}>載入中…</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: C.textLight }}>還沒有任務，點右上角「＋ 建立新任務」開始</td></tr>
              ) : list.map(q => (
                <tr key={q.id} style={{ borderTop: `1px solid ${C.border}` }}>
                  <Td><StatusBadge status={q.status} /></Td>
                  <Td><div style={{ fontWeight: 600, color: C.textDark }}>{q.title}</div>{q.description && <div style={{ color: C.textLight, fontSize: 12, marginTop: 2 }}>{q.description.slice(0, 60)}{q.description.length > 60 ? '…' : ''}</div>}</Td>
                  <Td>{fmtDateTime(q.task_deadline)}</Td>
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
      </div>

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreated={async () => { setCreating(false); await load(); }}
          user={user}
        />
      )}
      {detailId && (
        <DetailModal id={detailId} onClose={() => setDetailId(null)} onUpdated={load} />
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
  const [groupId, setGroupId]           = useState('');
  const [awardPoints, setAwardPoints]   = useState(true);
  const [submitText, setSubmitText]     = useState(true);
  const [submitImage, setSubmitImage]   = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  useEffect(() => {
    (async () => {
      setGroupsLoading(true); setGroupsError(null);
      try {
        const res = await questsApi.getGroups();
        // 兼容多種可能的結構：{ success, data: [...] } 或 { data: [...] } 或 [...]
        const arr =
          Array.isArray(res?.data) ? res.data
          : Array.isArray(res?.data?.data) ? res.data.data
          : Array.isArray(res) ? res
          : [];
        setGroups(arr);
        if (arr.length && !groupId) setGroupId(arr[0].id || arr[0].group_id);
      } catch (e) {
        setGroupsError(e.response?.data?.message || e.message);
      } finally { setGroupsLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!title.trim()) { alert('請輸入任務標題'); return; }
    if (!deadline)     { alert('請選擇截止時間'); return; }
    if (!groupId)      { alert('請選擇指派群組'); return; }

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
        // 把 datetime-local（無時區）補成 :00 結尾的 ISO
        task_deadline: deadline.length === 16 ? `${deadline}:00` : deadline,
        award_points: awardPoints,
        required_submission,
        assignees: [{ type: 'group', group_id: groupId }],
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

      <Field label="指派群組（市場部 employee_groups）*">
        {groupsLoading ? (
          <div style={{ color: C.textLight, fontSize: 13 }}>載入群組中…</div>
        ) : groupsError ? (
          <div style={{ color: '#c53030', fontSize: 13 }}>
            無法載入群組：{groupsError}
            <div style={{ marginTop: 6 }}>
              <input value={groupId} onChange={e => setGroupId(e.target.value)} style={inputStyle} placeholder="（手動填 group_id UUID）" />
            </div>
          </div>
        ) : groups.length === 0 ? (
          <div style={{ color: C.textLight, fontSize: 13 }}>市場部還沒有群組可選</div>
        ) : (
          <select value={groupId} onChange={e => setGroupId(e.target.value)} style={inputStyle}>
            {groups.map(g => {
              const id = g.id || g.group_id;
              const name = g.name || g.group_name || id;
              return <option key={id} value={id}>{name}</option>;
            })}
          </select>
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
// 詳情 Modal
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <Row label="指派">
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
function Td({ children }) {
  return <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>{children}</td>;
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
function Modal({ title, onClose, children, wide }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '60px 20px', overflowY: 'auto', zIndex: 1000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 12, padding: 24,
        width: wide ? 720 : 520, maxWidth: '100%',
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
const preStyle = {
  background: '#f9f5ee', border: `1px solid ${C.border}`, borderRadius: 6,
  padding: 10, fontSize: 12, overflow: 'auto', maxHeight: 220, margin: 0,
};

// ── 工具：預設截止時間（今天 +7 天 23:59）────────────────────
function defaultDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  // datetime-local 需要 'YYYY-MM-DDTHH:MM'（本地時區）
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
