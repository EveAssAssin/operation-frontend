// pages/scheduledNotify/ScheduledNotifyPage.jsx
// 「排程推播」模組
//   - 列表（標題 / 排程說明 / 下次執行 / 上次狀態 / 啟用 / 操作）
//   - 新增/編輯 modal（依 schedule_type 動態切換 UI）
//   - 立即測試 + 歷史紀錄

import { useState, useEffect, useCallback } from 'react';
import { scheduledNotifyApi } from '../../services/api';

const C = {
  dark: '#50422d', mid: '#8b6f4e', light: '#cdbea2',
  bg: '#f5f0ea', bgCard: '#ffffff', border: '#e0d5c8',
  textDark: '#3a2e1e', textMid: '#6b5640', textLight: '#9a8878',
};

const fmtDateTime = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
};

const btn = (variant = 'default') => {
  const base = { padding: '7px 14px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
  if (variant === 'primary') return { ...base, background: C.dark, color: '#fff' };
  if (variant === 'danger')  return { ...base, background: '#c53030', color: '#fff' };
  if (variant === 'ghost')   return { ...base, background: '#fff', color: C.textDark, border: `1px solid ${C.border}` };
  if (variant === 'success') return { ...base, background: '#2d6a4f', color: '#fff' };
  return { ...base, background: C.mid, color: '#fff' };
};

const inputStyle = () => ({
  width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`,
  borderRadius: 6, fontSize: 13, background: '#fff', boxSizing: 'border-box',
});

const WEEKDAY_LABELS = ['', '一', '二', '三', '四', '五', '六', '日'];

function scheduleSummary(notif) {
  const { schedule_type, schedule_config: cfg = {} } = notif;
  if (schedule_type === 'once')    return `一次性 · ${fmtDateTime(cfg.datetime)}`;
  if (schedule_type === 'daily')   return `每天 · ${cfg.time || '?'}`;
  if (schedule_type === 'weekly')  {
    const days = (cfg.days_of_week || []).map(d => WEEKDAY_LABELS[d]).join('/');
    return `每週${days} · ${cfg.time || '?'}`;
  }
  if (schedule_type === 'monthly') return `每月 ${cfg.day_of_month || '?'} 號 · ${cfg.time || '?'}`;
  return schedule_type;
}

function recipientSummary(notif) {
  const ai = (notif.recipient_app_numbers || []).length;
  const rs = (notif.recipient_roles || []).length;
  const parts = [];
  if (ai) parts.push(`${ai} 個人`);
  if (rs) parts.push(`${rs} 角色群`);
  return parts.join(' + ') || '—';
}

// ════════════════════════════════════════════════════════════
//                         主頁面
// ════════════════════════════════════════════════════════════
export default function ScheduledNotifyPage() {
  const [list, setList]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // null | {} 新增 | row 編輯
  const [viewLogs, setViewLogs] = useState(null); // { notif } 看單筆 / 'all'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await scheduledNotifyApi.list();
      setList(Array.isArray(r?.data) ? r.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleToggle(n) {
    try { await scheduledNotifyApi.update(n.id, { enabled: !n.enabled }); load(); }
    catch (e) { alert('失敗：' + (e?.message || e)); }
  }
  async function handleRunNow(n) {
    if (!window.confirm(`立刻推播「${n.title}」一次？（測試用，不影響排程）`)) return;
    try {
      const r = await scheduledNotifyApi.runNow(n.id);
      alert(`已觸發：推給 ${r?.data?.recipient_count || 0} 人\n狀態：${r?.data?.status}${r?.data?.error ? `\n錯誤：${r.data.error}` : ''}`);
    } catch (e) { alert('失敗：' + (e?.message || e)); }
  }
  async function handleDelete(n) {
    if (!window.confirm(`確定刪除排程「${n.title}」？`)) return;
    try { await scheduledNotifyApi.remove(n.id); load(); }
    catch (e) { alert('失敗：' + (e?.message || e)); }
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: C.dark, padding: '20px 28px' }}>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>⏰ 排程推播</div>
        <div style={{ color: C.light, fontSize: 13 }}>
          自訂排程：每天 / 每週 / 每月 / 一次性 — LINE 推播給個人或角色群
        </div>
      </div>

      <div style={{ padding: '20px 28px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button style={btn('primary')} onClick={() => setEditing({})}>+ 新增排程</button>
          <div style={{ flex: 1 }} />
          <button style={btn('ghost')} onClick={() => setViewLogs('all')}>🕐 歷史紀錄</button>
        </div>

        <div style={{ background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: C.bg }}>
              <tr>
                <th style={th()}>標題</th>
                <th style={th()}>排程</th>
                <th style={th()}>收件人</th>
                <th style={th()}>下次執行</th>
                <th style={th()}>上次</th>
                <th style={th()}>啟用</th>
                <th style={th()}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={td('center')}>載入中...</td></tr>}
              {!loading && list.length === 0 && <tr><td colSpan={7} style={td('center')}>尚無排程，點「+ 新增排程」</td></tr>}
              {!loading && list.map(n => (
                <tr key={n.id} style={{ borderTop: `1px solid ${C.border}`, opacity: n.enabled ? 1 : 0.55 }}>
                  <td style={td()}>
                    <b>{n.title}</b>
                    <div style={{ fontSize: 11, color: C.textLight, marginTop: 2, maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.message}</div>
                  </td>
                  <td style={td()}><span style={{ fontSize: 12 }}>{scheduleSummary(n)}</span></td>
                  <td style={td()}><span style={{ fontSize: 12 }}>{recipientSummary(n)}</span></td>
                  <td style={td()}>
                    {n.completed && <span style={{ color: C.textLight, fontSize: 12 }}>已完成（一次性）</span>}
                    {!n.completed && <span style={{ fontSize: 12 }}>{fmtDateTime(n.next_run_at)}</span>}
                  </td>
                  <td style={td()}>
                    {n.last_run_at ? (
                      <>
                        <span style={{ fontSize: 11, color: C.textMid }}>{fmtDateTime(n.last_run_at)}</span>
                        <div>
                          {n.last_run_status === 'success' && <span style={pill('#f0fff4', '#2d6a4f', '#b7e4c7')}>{n.last_run_recipient_count} 人</span>}
                          {n.last_run_status === 'failed'  && <span style={pill('#fff0f0', '#c53030', '#feb2b2')}>失敗</span>}
                        </div>
                      </>
                    ) : <span style={{ color: C.textLight }}>—</span>}
                  </td>
                  <td style={td()}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!n.enabled} onChange={() => handleToggle(n)} />
                    </label>
                  </td>
                  <td style={td()}>
                    <button style={btn('success')} title="立即測試" onClick={() => handleRunNow(n)}>▶</button>
                    <button style={{ ...btn('ghost'), marginLeft: 4 }} onClick={() => setEditing(n)}>✏️</button>
                    <button style={{ ...btn('ghost'), marginLeft: 4 }} onClick={() => setViewLogs({ notif: n })}>🕐</button>
                    <button style={{ ...btn('danger'), marginLeft: 4 }} onClick={() => handleDelete(n)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing  !== null && <EditorModal initial={editing} onClose={() => { setEditing(null); load(); }} />}
      {viewLogs !== null && <LogsModal target={viewLogs} onClose={() => setViewLogs(null)} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//                   新增 / 編輯 modal
// ════════════════════════════════════════════════════════════
function EditorModal({ initial, onClose }) {
  const isNew = !initial.id;
  const [form, setForm] = useState(() => ({
    title:           initial.title || '',
    message:         initial.message || '',
    schedule_type:   initial.schedule_type   || 'daily',
    schedule_config: initial.schedule_config || { time: '09:00' },
    recipient_app_numbers: initial.recipient_app_numbers || [],
    recipient_roles:       initial.recipient_roles || [],
    enabled:         initial.enabled !== false,
  }));
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [vars,  setVars]  = useState([]);
  const [preview, setPreview] = useState({ rendered: '', next_run_at: null });
  const [busy, setBusy] = useState(false);

  // 載入選項
  useEffect(() => {
    (async () => {
      try {
        const [u, r, v] = await Promise.all([
          scheduledNotifyApi.getSystemUsers(),
          scheduledNotifyApi.getRoles(),
          scheduledNotifyApi.getVariables(),
        ]);
        setUsers(Array.isArray(u?.data) ? u.data : []);
        setRoles(Array.isArray(r?.data) ? r.data : []);
        setVars(Array.isArray(v?.data) ? v.data : []);
      } catch (e) { console.error(e); }
    })();
  }, []);

  // 變化時即時預覽
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const r = await scheduledNotifyApi.preview({
          message: form.message,
          schedule_type: form.schedule_type,
          schedule_config: form.schedule_config,
        });
        setPreview(r?.data || { rendered: '', next_run_at: null });
      } catch (e) { /* 預覽失敗忽略 */ }
    }, 350);
    return () => clearTimeout(t);
  }, [form.message, form.schedule_type, form.schedule_config]);

  // schedule_type 切換時清空 config，給合理預設
  function setScheduleType(t) {
    const defaults = {
      once:    { datetime: '' },
      daily:   { time: '09:00' },
      weekly:  { time: '13:00', days_of_week: [1] },
      monthly: { time: '10:00', day_of_month: 1, fallback: 'prev' },
    };
    setForm(f => ({ ...f, schedule_type: t, schedule_config: defaults[t] }));
  }

  function toggleUser(appNumber) {
    setForm(f => {
      const has = f.recipient_app_numbers.includes(appNumber);
      return { ...f, recipient_app_numbers: has
        ? f.recipient_app_numbers.filter(x => x !== appNumber)
        : [...f.recipient_app_numbers, appNumber] };
    });
  }
  function toggleRole(role) {
    setForm(f => {
      const has = f.recipient_roles.includes(role);
      return { ...f, recipient_roles: has
        ? f.recipient_roles.filter(x => x !== role)
        : [...f.recipient_roles, role] };
    });
  }
  function toggleWeekday(d) {
    setForm(f => {
      const arr = f.schedule_config.days_of_week || [];
      const has = arr.includes(d);
      return { ...f, schedule_config: { ...f.schedule_config, days_of_week: has ? arr.filter(x => x !== d) : [...arr, d].sort() } };
    });
  }
  function insertVar(k) {
    setForm(f => ({ ...f, message: (f.message || '') + `{${k}}` }));
  }

  async function handleSave() {
    if (!form.title.trim() || !form.message.trim()) return alert('標題與訊息必填');
    if (form.recipient_app_numbers.length === 0 && form.recipient_roles.length === 0)
      return alert('至少選一個收件人或角色群');
    setBusy(true);
    try {
      if (isNew) await scheduledNotifyApi.create(form);
      else       await scheduledNotifyApi.update(initial.id, form);
      onClose();
    } catch (e) { alert('失敗：' + (e?.message || e)); }
    finally { setBusy(false); }
  }

  const cfg = form.schedule_config || {};

  return (
    <Modal onClose={onClose} title={`${isNew ? '新增' : '編輯'} 排程推播`} width={760}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* 標題 */}
        <Field label="排程標題 *">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                 placeholder="例：每日早安 / 月底結帳提醒" style={inputStyle()} />
        </Field>

        {/* 訊息 + 變數 */}
        <Field label="推播訊息 *">
          <textarea rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="可以用 {date} {weekday} 等變數" style={{ ...inputStyle(), resize: 'vertical' }} />
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <span style={{ fontSize: 11, color: C.textMid, alignSelf: 'center' }}>插入變數：</span>
            {vars.map(v => (
              <button key={v.key} onClick={() => insertVar(v.key)}
                style={{ padding: '2px 8px', fontSize: 11, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer' }}
                title={`${v.desc}（範例：${v.example}）`}>
                {`{${v.key}}`}
              </button>
            ))}
          </div>
          {preview.rendered && (
            <div style={{ marginTop: 8, padding: 10, background: '#fff8ec', border: `1px solid #e5c99a`, borderRadius: 6, fontSize: 12 }}>
              <div style={{ fontSize: 10, color: '#8b6f4e', fontWeight: 700, marginBottom: 4 }}>📱 預覽（用當下時間展開）</div>
              <div style={{ whiteSpace: 'pre-wrap', color: '#3a2e1e' }}>{preview.rendered}</div>
            </div>
          )}
        </Field>

        {/* 排程類型 */}
        <Field label="排程方式 *">
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {[
              { v: 'once',    l: '一次性' },
              { v: 'daily',   l: '每天'   },
              { v: 'weekly',  l: '每週'   },
              { v: 'monthly', l: '每月'   },
            ].map(opt => (
              <button key={opt.v} onClick={() => setScheduleType(opt.v)}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                  background: form.schedule_type === opt.v ? C.dark : '#fff',
                  color: form.schedule_type === opt.v ? '#fff' : C.textDark,
                  border: form.schedule_type === opt.v ? 'none' : `1px solid ${C.border}`,
                }}>{opt.l}</button>
            ))}
          </div>

          {form.schedule_type === 'once' && (
            <input type="datetime-local"
              value={cfg.datetime ? cfg.datetime.slice(0, 16) : ''}
              onChange={e => setForm(f => ({ ...f, schedule_config: { datetime: e.target.value ? new Date(e.target.value).toISOString() : '' } }))}
              style={inputStyle()} />
          )}

          {form.schedule_type === 'daily' && (
            <input type="time" value={cfg.time || '09:00'}
              onChange={e => setForm(f => ({ ...f, schedule_config: { time: e.target.value } }))}
              style={{ ...inputStyle(), width: 160 }} />
          )}

          {form.schedule_type === 'weekly' && (
            <div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {[1,2,3,4,5,6,7].map(d => {
                  const on = (cfg.days_of_week || []).includes(d);
                  return (
                    <button key={d} onClick={() => toggleWeekday(d)}
                      style={{
                        width: 38, height: 38, borderRadius: '50%', fontSize: 14, cursor: 'pointer',
                        background: on ? C.dark : '#fff',
                        color: on ? '#fff' : C.textDark,
                        border: on ? 'none' : `1px solid ${C.border}`,
                      }}>{WEEKDAY_LABELS[d]}</button>
                  );
                })}
              </div>
              <input type="time" value={cfg.time || '13:00'}
                onChange={e => setForm(f => ({ ...f, schedule_config: { ...cfg, time: e.target.value } }))}
                style={{ ...inputStyle(), width: 160 }} />
            </div>
          )}

          {form.schedule_type === 'monthly' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={cfg.day_of_month || 1}
                onChange={e => setForm(f => ({ ...f, schedule_config: { ...cfg, day_of_month: Number(e.target.value) } }))}
                style={{ ...inputStyle(), width: 100 }}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d =>
                  <option key={d} value={d}>{d} 號</option>
                )}
              </select>
              <input type="time" value={cfg.time || '10:00'}
                onChange={e => setForm(f => ({ ...f, schedule_config: { ...cfg, time: e.target.value } }))}
                style={{ ...inputStyle(), width: 160 }} />
              <select value={cfg.fallback || 'prev'}
                onChange={e => setForm(f => ({ ...f, schedule_config: { ...cfg, fallback: e.target.value } }))}
                style={{ ...inputStyle(), width: 220 }}>
                <option value="prev">月底沒這天 → 用前一天</option>
                <option value="skip">月底沒這天 → 跳過</option>
                <option value="next">月底沒這天 → 順延下月 1 號</option>
              </select>
            </div>
          )}

          {preview.next_run_at && (
            <div style={{ marginTop: 6, fontSize: 11, color: C.textMid }}>
              👉 下次執行：{fmtDateTime(preview.next_run_at)}
            </div>
          )}
        </Field>

        {/* 收件人：角色群 */}
        <Field label="收件人 — 角色群">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {roles.map(r => {
              const on = form.recipient_roles.includes(r.value);
              return (
                <button key={r.value} onClick={() => toggleRole(r.value)}
                  style={{
                    padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
                    background: on ? '#fff8ec' : '#fff',
                    color: on ? C.dark : C.textDark,
                    border: `1px solid ${on ? C.mid : C.border}`,
                  }}>{on ? '✓' : '○'} {r.label}</button>
              );
            })}
          </div>
        </Field>

        {/* 收件人：個別 */}
        <Field label={`收件人 — 個別人員（已選 ${form.recipient_app_numbers.length}）`}>
          <div style={{ maxHeight: 180, overflow: 'auto', border: `1px solid ${C.border}`, borderRadius: 6, padding: 6 }}>
            {users.map(u => {
              const on = form.recipient_app_numbers.includes(u.app_number);
              return (
                <label key={u.app_number} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={() => toggleUser(u.app_number)} />
                  <span style={{ fontSize: 13 }}>{u.name}（{u.app_number}）</span>
                  <span style={{ fontSize: 11, color: C.textLight }}>— {u.role}</span>
                </label>
              );
            })}
            {users.length === 0 && <div style={{ padding: 10, color: C.textLight, fontSize: 12 }}>載入中...</div>}
          </div>
        </Field>

        {/* 啟用 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={!!form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} />
          <span style={{ fontSize: 13 }}>啟用此排程（取消勾選=暫停）</span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button style={btn('ghost')} onClick={onClose}>取消</button>
          <button style={btn('primary')} disabled={busy} onClick={handleSave}>{busy ? '處理中...' : '儲存'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
//                   歷史紀錄 modal
// ════════════════════════════════════════════════════════════
function LogsModal({ target, onClose }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const title = target === 'all' ? '🕐 全部歷史紀錄' : `🕐 ${target.notif?.title} — 歷史`;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = target === 'all'
          ? await scheduledNotifyApi.listAllLogs()
          : await scheduledNotifyApi.listLogs(target.notif.id);
        setList(Array.isArray(r?.data) ? r.data : []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [target]);

  return (
    <Modal onClose={onClose} title={title} width={820}>
      <div style={{ maxHeight: 500, overflow: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: C.bg, position: 'sticky', top: 0 }}>
            <tr>
              <th style={th()}>時間</th>
              <th style={th()}>排程</th>
              <th style={th()}>訊息</th>
              <th style={th()}>收件數</th>
              <th style={th()}>狀態</th>
              <th style={th()}>來源</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={td('center')}>載入中...</td></tr>}
            {!loading && list.length === 0 && <tr><td colSpan={6} style={td('center')}>無紀錄</td></tr>}
            {!loading && list.map(l => (
              <tr key={l.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={td()}>{fmtDateTime(l.triggered_at)}</td>
                <td style={td()}>{l.title}</td>
                <td style={td()}><div style={{ maxWidth: 280, whiteSpace: 'pre-wrap', fontSize: 11 }}>{l.message_rendered}</div></td>
                <td style={td()}>{l.recipient_count}</td>
                <td style={td()}>
                  {l.status === 'success' && <span style={pill('#f0fff4','#2d6a4f','#b7e4c7')}>成功</span>}
                  {l.status === 'failed'  && <span style={pill('#fff0f0','#c53030','#feb2b2')}>失敗</span>}
                  {l.error && <div style={{ fontSize: 10, color: '#c53030', marginTop: 2 }}>{l.error}</div>}
                </td>
                <td style={td()}>
                  {l.is_manual ? <span style={pill('#f0f4ff','#3b5bdb','#bac8ff')}>手動</span> : <span style={pill('#f3f3f3','#888','#ccc')}>排程</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
//                       共用元件
// ════════════════════════════════════════════════════════════
function th() { return { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.textDark, borderBottom: `1px solid ${C.border}` }; }
function td(align = 'left') { return { padding: '10px 12px', textAlign: align, fontSize: 13, color: C.textDark, verticalAlign: 'top' }; }
function pill(bg, color, border) { return { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color, border: `1px solid ${border}` }; }

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

function Modal({ onClose, title, children, width = 800 }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: width, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark }}>{title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: C.textMid }}>×</button>
        </div>
        <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}
