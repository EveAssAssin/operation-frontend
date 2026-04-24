// pages/salesEvents/SalesEventsPage.jsx
// 業績系統活動模組 — 行事曆 + 外部活動 CRUD

import { useState, useEffect, useCallback } from 'react';
import { salesEventsApi } from '../../services/api';

// ── 常數 ─────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value: 'contact_lens',     label: '🔵 隱形眼鏡活動' },
  { value: 'special_contract', label: '🟠 特約活動'     },
];
const TYPE_LABELS = {
  contact_lens:     { text: '隱形眼鏡活動', color: '#2b6cb0', bg: '#ebf8ff', border: '#bee3f8' },
  special_contract: { text: '特約活動',     color: '#c05621', bg: '#fffaf0', border: '#fbd38d' },
};

// ── 工具函式 ─────────────────────────────────────────────────
function today() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
}
function monthStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function firstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}
function dateInRange(date, start, end) {
  return date >= start && date <= end;
}

// ── Badge ────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const t = TYPE_LABELS[type] || { text: type, color: '#4a5568', bg: '#edf2f7', border: '#e2e8f0' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
      color: t.color, background: t.bg, border: `1px solid ${t.border}`,
    }}>{t.text}</span>
  );
}

// ── 活動新增/編輯 Modal ─────────────────────────────────────
function EventModal({ event, onClose, onSave }) {
  const isEdit = !!event?.id;
  const [form, setForm] = useState({
    event_type:          event?.event_type          || 'contact_lens',
    name:                event?.name                || '',
    start_date:          event?.start_date          || today(),
    end_date:            event?.end_date            || today(),
    description:         event?.description         || '',
    notes:               event?.notes               || '',
    push_on_start:       event?.push_on_start       ?? false,
    push_on_start_time:  event?.push_on_start_time  || '09:00',
    push_on_start_adv:   event?.push_on_start_adv   ?? false,
    push_on_start_adv_min:  event?.push_on_start_adv_min  || 1440,
    push_on_start_adv_time: event?.push_on_start_adv_time || '09:00',
    push_on_end:         event?.push_on_end         ?? false,
    push_on_end_time:    event?.push_on_end_time    || '09:00',
  });
  const [saving, setSaving]  = useState(false);
  const [error,  setError]   = useState('');
  const [showPush, setShowPush] = useState(false);

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSave() {
    if (!form.name.trim())  return setError('活動名稱為必填');
    if (!form.start_date)   return setError('開始日期為必填');
    if (!form.end_date)     return setError('結束日期為必填');
    if (form.end_date < form.start_date) return setError('結束日期不可早於開始日期');

    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        name:        form.name.trim(),
        description: form.description.trim() || null,
        notes:       form.notes.trim()       || null,
      };
      if (isEdit) {
        await salesEventsApi.updateExternalEvent(event.id, payload);
      } else {
        await salesEventsApi.createExternalEvent(payload);
      }
      onSave();
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  }

  const ipt = {
    width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0',
    borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };
  const label = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: '#4a5568', marginBottom: 4,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      overflowY: 'auto', padding: '20px 0',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '28px 28px 24px',
        width: 480, maxWidth: '94vw', boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
        margin: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>
            {isEdit ? '編輯活動' : '新增外部活動'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#718096', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={label}>活動類型</label>
            <select value={form.event_type} onChange={e => set('event_type', e.target.value)} style={ipt}>
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label style={label}>活動名稱 *</label>
            <input style={ipt} value={form.name} onChange={e => set('name', e.target.value)} placeholder="例：台北門市隱形眼鏡特賣" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={label}>開始日期 *</label>
              <input type="date" style={ipt} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label style={label}>結束日期 *</label>
              <input type="date" style={ipt} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          <div>
            <label style={label}>對外說明（description）</label>
            <input style={ipt} value={form.description} onChange={e => set('description', e.target.value)} placeholder="顯示給消費者的活動說明" />
          </div>

          <div>
            <label style={label}>內部備注（notes）</label>
            <textarea
              style={{ ...ipt, resize: 'vertical', minHeight: 60 }}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="僅供內部參考，不對外顯示"
            />
          </div>

          {/* 推播設定（可展開） */}
          <div>
            <button type="button" onClick={() => setShowPush(p => !p)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: '#4a5568', fontWeight: 600, padding: 0,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {showPush ? '▾' : '▸'} 推播設定（選填）
            </button>
            {showPush && (
              <div style={{ marginTop: 10, padding: '12px 14px', background: '#f9f7f4', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* 開始推播 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input type="checkbox" checked={form.push_on_start} onChange={e => set('push_on_start', e.target.checked)} />
                  <span style={{ fontSize: 13, color: '#4a5568', minWidth: 100 }}>活動開始當天推播</span>
                  {form.push_on_start && (
                    <input type="time" style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}
                      value={form.push_on_start_time} onChange={e => set('push_on_start_time', e.target.value)} />
                  )}
                </div>
                {/* 提前推播 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input type="checkbox" checked={form.push_on_start_adv} onChange={e => set('push_on_start_adv', e.target.checked)} />
                  <span style={{ fontSize: 13, color: '#4a5568', minWidth: 100 }}>提前推播</span>
                  {form.push_on_start_adv && (
                    <>
                      <input type="number" min={1} style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, width: 70 }}
                        value={form.push_on_start_adv_min} onChange={e => set('push_on_start_adv_min', Number(e.target.value))} />
                      <span style={{ fontSize: 12, color: '#718096' }}>分鐘前</span>
                      <input type="time" style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}
                        value={form.push_on_start_adv_time} onChange={e => set('push_on_start_adv_time', e.target.value)} />
                    </>
                  )}
                </div>
                {/* 結束推播 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input type="checkbox" checked={form.push_on_end} onChange={e => set('push_on_end', e.target.checked)} />
                  <span style={{ fontSize: 13, color: '#4a5568', minWidth: 100 }}>活動結束當天推播</span>
                  {form.push_on_end && (
                    <input type="time" style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }}
                      value={form.push_on_end_time} onChange={e => set('push_on_end_time', e.target.value)} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8, color: '#c53030', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0',
            background: '#fff', fontSize: 14, cursor: 'pointer', color: '#4a5568',
          }}>取消</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '9px 20px', borderRadius: 8, border: 'none',
            background: saving ? '#a0aec0' : '#2d6a4f',
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? '儲存中...' : (isEdit ? '儲存變更' : '新增活動')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 推播設定 Modal ────────────────────────────────────────────
function PushModal({ eventItem, onClose, onSave }) {
  const isPromotion = eventItem?.source === 'promotion';
  const [form, setForm] = useState({
    push_on_start:          eventItem?.push_on_start          ?? false,
    push_on_start_time:     eventItem?.push_on_start_time     || '09:00',
    push_on_start_adv:      eventItem?.push_on_start_adv      ?? false,
    push_on_start_adv_min:  eventItem?.push_on_start_adv_min  || 60,
    push_on_start_adv_time: eventItem?.push_on_start_adv_time || '08:00',
    push_on_end:            eventItem?.push_on_end            ?? false,
    push_on_end_time:       eventItem?.push_on_end_time       || '09:00',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      // 外部活動推播設定透過 PUT 整合進活動本身
      await salesEventsApi.updateExternalEvent(eventItem.id, {
        event_type:  eventItem.event_type,
        name:        eventItem.name,
        start_date:  eventItem.start_date,
        end_date:    eventItem.end_date,
        description: eventItem.description,
        notes:       eventItem.notes,
        ...form,
      });
      onSave();
    } catch (e) {
      setError(e.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  }

  const ipt = {
    padding: '7px 10px', border: '1px solid #e2e8f0',
    borderRadius: 6, fontSize: 13, outline: 'none',
  };
  const Row = ({ label, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f7f4f0' }}>
      <span style={{ fontSize: 13, color: '#4a5568', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{children}</div>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '28px 28px 24px',
        width: 460, maxWidth: '94vw', boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>推播設定</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#718096' }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: '#a0aec0', marginBottom: 16 }}>
          {eventItem?.name}
        </div>

        <Row label="活動開始當天推播">
          <input type="checkbox" checked={form.push_on_start} onChange={e => set('push_on_start', e.target.checked)} />
          {form.push_on_start && (
            <input type="time" style={ipt} value={form.push_on_start_time} onChange={e => set('push_on_start_time', e.target.value)} />
          )}
        </Row>

        <Row label="活動開始前預告推播">
          <input type="checkbox" checked={form.push_on_start_adv} onChange={e => set('push_on_start_adv', e.target.checked)} />
          {form.push_on_start_adv && (
            <>
              <input type="number" style={{ ...ipt, width: 60 }} value={form.push_on_start_adv_min}
                onChange={e => set('push_on_start_adv_min', Number(e.target.value))} min={1} />
              <span style={{ fontSize: 12, color: '#718096' }}>分鐘前</span>
              <input type="time" style={ipt} value={form.push_on_start_adv_time} onChange={e => set('push_on_start_adv_time', e.target.value)} />
            </>
          )}
        </Row>

        <Row label="活動結束當天推播">
          <input type="checkbox" checked={form.push_on_end} onChange={e => set('push_on_end', e.target.checked)} />
          {form.push_on_end && (
            <input type="time" style={ipt} value={form.push_on_end_time} onChange={e => set('push_on_end_time', e.target.value)} />
          )}
        </Row>

        {error && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8, color: '#c53030', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0',
            background: '#fff', fontSize: 14, cursor: 'pointer', color: '#4a5568',
          }}>取消</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '9px 20px', borderRadius: 8, border: 'none',
            background: saving ? '#a0aec0' : '#744210',
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? '儲存中...' : '儲存推播設定'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 行事曆格子 ────────────────────────────────────────────────
function CalendarView({ year, month, calendarData }) {
  const totalDays = daysInMonth(year, month);
  const startDow  = firstDayOfWeek(year, month);
  const pad       = startDow; // 0–6 empty cells before day 1
  const DOW_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

  // Build events-by-date map
  const byDate = {};
  const addToDate = (dateStr, item) => {
    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push(item);
  };

  // API 回傳扁平 events 陣列；外部活動沒有 source 欄位，用 event_type 識別
  const allEvents = (calendarData?.events || []).map(ev => ({
    ...ev,
    source: ev.source || 'external',
  }));

  allEvents.forEach(ev => {
    if (!ev.start_date || !ev.end_date) return;
    // mark each day in range
    let d = new Date(ev.start_date + 'T00:00:00');
    const end = new Date(ev.end_date + 'T00:00:00');
    while (d <= end) {
      const key = d.toLocaleDateString('sv-SE');
      const [y2, m2] = key.split('-').map(Number);
      if (y2 === year && m2 === month + 1) addToDate(key, ev);
      d.setDate(d.getDate() + 1);
    }
  });

  const todayStr = today();

  const cells = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const SOURCE_COLORS = {
    promotion: { dot: '#e53e3e', label: '促銷' },
    external:  { dot: '#2b6cb0', label: '外部' },
    ad:        { dot: '#d69e2e', label: '廣告' },
  };

  return (
    <div>
      {/* Day-of-week header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
        {DOW_LABELS.map((d, i) => (
          <div key={i} style={{
            textAlign: 'center', fontSize: 12, fontWeight: 700,
            color: i === 0 ? '#e53e3e' : i === 6 ? '#2b6cb0' : '#718096',
            padding: '6px 0',
          }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`pad-${idx}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const events  = byDate[dateStr] || [];
          const isToday = dateStr === todayStr;
          const dow     = (pad + day - 1) % 7;

          return (
            <div key={dateStr} style={{
              minHeight: 72, padding: '4px 5px', borderRadius: 6,
              background: isToday ? '#f0fdf4' : '#fafaf8',
              border: `1px solid ${isToday ? '#68d391' : '#ede8e0'}`,
              overflow: 'hidden',
            }}>
              <div style={{
                fontSize: 12, fontWeight: isToday ? 700 : 500, marginBottom: 3,
                color: isToday ? '#276749' : dow === 0 ? '#e53e3e' : dow === 6 ? '#2b6cb0' : '#2d3748',
              }}>{day}</div>
              {events.slice(0, 3).map((ev, ei) => {
                const sc = SOURCE_COLORS[ev.source] || { dot: '#a0aec0' };
                return (
                  <div key={ei} style={{
                    fontSize: 10, lineHeight: '14px', marginBottom: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    color: '#4a5568',
                  }}>
                    <span style={{
                      display: 'inline-block', width: 6, height: 6,
                      borderRadius: '50%', background: sc.dot,
                      marginRight: 3, verticalAlign: 'middle',
                    }} />
                    {ev.name}
                  </div>
                );
              })}
              {events.length > 3 && (
                <div style={{ fontSize: 10, color: '#a0aec0' }}>+{events.length - 3} 更多</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
        {Object.entries(SOURCE_COLORS).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#718096' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.dot, display: 'inline-block' }} />
            {v.label}活動
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 活動列表 Tab ──────────────────────────────────────────────
function ExternalEventsTab({ events, loading, onAdd, onEdit, onDelete, onRefresh }) {
  const [delConfirm, setDelConfirm] = useState(null);
  const [deleting,   setDeleting]   = useState(false);

  async function doDelete(id) {
    setDeleting(true);
    try {
      await salesEventsApi.deleteExternalEvent(id);
      setDelConfirm(null);
      onRefresh();
    } catch (e) {
      alert(e.message || '刪除失敗');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: '#a0aec0' }}>載入中...</div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: '#718096' }}>共 {events.length} 筆外部活動</div>
        <button onClick={onAdd} style={{
          padding: '8px 16px', background: '#2d6a4f', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>＋ 新增活動</button>
      </div>

      {events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#a0aec0', fontSize: 14 }}>
          尚無外部活動紀錄
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map(ev => (
            <div key={ev.id} style={{
              background: '#fff', border: '1px solid #ede8e0',
              borderRadius: 12, padding: '14px 18px',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <TypeBadge type={ev.event_type} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{ev.name}</span>
                </div>
                <div style={{ fontSize: 13, color: '#718096' }}>
                  📅 {ev.start_date} ～ {ev.end_date}
                </div>
                {ev.description && (
                  <div style={{ fontSize: 12, color: '#718096', marginTop: 4 }}>{ev.description}</div>
                )}
                {ev.notes && (
                  <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 2 }}>備注：{ev.notes}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => onEdit(ev)} style={{
                  padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0',
                  background: '#fff', fontSize: 12, cursor: 'pointer', color: '#4a5568',
                }}>編輯</button>
                <button onClick={() => setDelConfirm(ev)} style={{
                  padding: '6px 12px', borderRadius: 6, border: '1px solid #fed7d7',
                  background: '#fff5f5', fontSize: 12, cursor: 'pointer', color: '#c53030',
                }}>刪除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 刪除確認 */}
      {delConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: '28px 32px',
            maxWidth: 360, width: '90vw', textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>確認刪除？</div>
            <div style={{ fontSize: 14, color: '#718096', marginBottom: 24 }}>
              活動「{delConfirm.name}」將被永久刪除。
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDelConfirm(null)} style={{
                padding: '9px 20px', borderRadius: 8, border: '1px solid #e2e8f0',
                background: '#fff', fontSize: 14, cursor: 'pointer',
              }}>取消</button>
              <button onClick={() => doDelete(delConfirm.id)} disabled={deleting} style={{
                padding: '9px 20px', borderRadius: 8, border: 'none',
                background: deleting ? '#a0aec0' : '#e53e3e',
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                {deleting ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 行事曆 Tab ────────────────────────────────────────────────
function CalendarTab({ onAdd }) {
  const now   = new Date();
  const [viewDate, setViewDate] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [calData,  setCalData]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [pushModal, setPushModal] = useState(null);

  const loadCalendar = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const mStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}`;
      const res = await salesEventsApi.getCalendar(mStr);
      setCalData(res.data || res);
    } catch (e) {
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [viewDate]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  function prevMonth() {
    setViewDate(p => {
      if (p.month === 0) return { year: p.year - 1, month: 11 };
      return { year: p.year, month: p.month - 1 };
    });
  }
  function nextMonth() {
    setViewDate(p => {
      if (p.month === 11) return { year: p.year + 1, month: 0 };
      return { year: p.year, month: p.month + 1 };
    });
  }

  const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  // 可設定推播的活動：editable=true（外部活動）
  const editableEvents = (calData?.events || []).filter(e => e.editable);

  return (
    <div>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={prevMonth} style={{
          padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
          background: '#fff', cursor: 'pointer', fontSize: 14,
        }}>‹</button>
        <span style={{ fontWeight: 700, fontSize: 18, color: '#1a1a2e', minWidth: 100, textAlign: 'center' }}>
          {viewDate.year} 年 {MONTH_NAMES[viewDate.month]}
        </span>
        <button onClick={nextMonth} style={{
          padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
          background: '#fff', cursor: 'pointer', fontSize: 14,
        }}>›</button>
        <button onClick={loadCalendar} style={{
          padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0',
          background: '#fff', cursor: 'pointer', fontSize: 12, color: '#718096',
        }}>↻ 重新整理</button>
        <button onClick={onAdd} style={{
          marginLeft: 'auto', padding: '8px 16px', background: '#2d6a4f', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>＋ 新增外部活動</button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8, color: '#c53030', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#a0aec0' }}>載入中...</div>
      ) : (
        <CalendarView year={viewDate.year} month={viewDate.month} calendarData={calData} />
      )}

      {/* 推播設定面板（外部活動） */}
      {editableEvents.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#4a5568', marginBottom: 12 }}>
            📣 本月外部活動推播設定
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {editableEvents.map(ev => (
              <div key={ev.id} style={{
                background: '#fff', border: '1px solid #ede8e0', borderRadius: 10,
                padding: '10px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <TypeBadge type={ev.event_type} />
                  <span style={{ fontSize: 13, color: '#2d3748', fontWeight: 600, marginLeft: 8 }}>{ev.name}</span>
                  <span style={{ fontSize: 12, color: '#a0aec0', marginLeft: 10 }}>
                    {ev.start_date} ～ {ev.end_date}
                  </span>
                </div>
                <button onClick={() => setPushModal({ ...ev })} style={{
                  padding: '5px 12px', borderRadius: 6, border: '1px solid #fbd38d',
                  background: '#fffaf0', fontSize: 12, cursor: 'pointer', color: '#744210',
                }}>推播設定</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {pushModal && (
        <PushModal
          eventItem={pushModal}
          onClose={() => setPushModal(null)}
          onSave={() => { setPushModal(null); loadCalendar(); }}
        />
      )}
    </div>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────
export default function SalesEventsPage() {
  const [tab,         setTab]    = useState('calendar');   // 'calendar' | 'events'
  const [extEvents,   setExtEvents]  = useState([]);
  const [evtLoading,  setEvtLoading] = useState(false);
  const [eventModal,  setEventModal] = useState(null);     // null | {} | {event obj}

  const loadExternalEvents = useCallback(async () => {
    setEvtLoading(true);
    try {
      const res = await salesEventsApi.getExternalEvents();
      setExtEvents(res.data || res || []);
    } catch (e) {
      console.error(e);
    } finally {
      setEvtLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'events') loadExternalEvents();
  }, [tab, loadExternalEvents]);

  function TAB(id, label, icon) {
    const active = tab === id;
    return (
      <button key={id} onClick={() => setTab(id)} style={{
        padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontSize: 14, fontWeight: active ? 700 : 500,
        background: active ? '#2d6a4f' : 'transparent',
        color: active ? '#fff' : '#718096',
      }}>{icon} {label}</button>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px' }}>
          業績活動管理
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#718096' }}>
          查看業績系統行事曆、管理外部活動（隱形眼鏡 / 特約），以及設定推播通知。
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f5f0ea', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {TAB('calendar', '行事曆', '📅')}
        {TAB('events',   '外部活動', '📋')}
      </div>

      {/* Content */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        {tab === 'calendar' && (
          <CalendarTab onAdd={() => setEventModal({})} />
        )}
        {tab === 'events' && (
          <ExternalEventsTab
            events={extEvents}
            loading={evtLoading}
            onAdd={() => setEventModal({})}
            onEdit={(ev) => setEventModal(ev)}
            onDelete={loadExternalEvents}
            onRefresh={loadExternalEvents}
          />
        )}
      </div>

      {/* 新增/編輯 Modal */}
      {eventModal !== null && (
        <EventModal
          event={eventModal?.id ? eventModal : null}
          onClose={() => setEventModal(null)}
          onSave={() => {
            setEventModal(null);
            if (tab === 'events') loadExternalEvents();
          }}
        />
      )}
    </div>
  );
}
