// pages/pointRedemption/PointRedeemAdminPage.jsx
// 分數兌換 — 後台管理（套 Layout）
//   兌換品項：新增 / 編輯 / 上下架 / 刪除
//   兌換紀錄：檢視全部兌換、實體獎品標記已發放

import { useState, useEffect, useCallback } from 'react';
import { pointRedemptionApi } from '../../services/api';

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
  danger: '#c53030',
  ok:     '#2d6a4f',
};

const TABS = [
  { key: 'items',       label: '兌換品項', icon: '🎁' },
  { key: 'redemptions', label: '兌換紀錄', icon: '📜' },
];

const ITEM_TYPES = [
  { value: 'physical', label: '實體獎品' },
  { value: 'cash',     label: '獎金/禮券' },
  { value: 'title',    label: '稱號/權限' },
  { value: 'other',    label: '其他' },
];
const typeLabel = (v) => (ITEM_TYPES.find(t => t.value === v) || {}).label || v;

const STATUS_META = {
  pending:   { label: '送審中', color: '#b7791f' },
  completed: { label: '已通過', color: C.ok },
  fulfilled: { label: '已發放', color: '#1d4ed8' },
  rejected:  { label: '已駁回', color: C.danger },
  cancelled: { label: '已取消', color: C.danger },
};

export default function PointRedeemAdminPage() {
  const [tab, setTab] = useState('items');
  return (
    <div style={{ padding: '4px 4px 40px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.textDark, margin: '4px 0 16px' }}>
        🪙 分數兌換管理
      </h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${tab === t.key ? C.dark : C.border}`,
            background: tab === t.key ? C.dark : '#fff',
            color: tab === t.key ? '#fff' : C.textMid,
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'items'       && <ItemsTab />}
      {tab === 'redemptions' && <RedemptionsTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 兌換品項
// ═══════════════════════════════════════════════════════════
function ItemsTab() {
  const [items, setItems]   = useState([]);
  const [loading, setLoad]  = useState(true);
  const [editing, setEdit]  = useState(null);   // null=不開, {}=新增, {...}=編輯

  const reload = useCallback(async () => {
    setLoad(true);
    try {
      const r = await pointRedemptionApi.listItems();
      setItems(Array.isArray(r.data) ? r.data : []);
    } catch (e) { alert('讀取失敗：' + (e?.message || e)); }
    finally { setLoad(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function toggleActive(item) {
    try {
      await pointRedemptionApi.updateItem(item.id, { is_active: !item.is_active });
      reload();
    } catch (e) { alert('更新失敗：' + (e?.message || e)); }
  }
  async function remove(item) {
    if (!window.confirm(`確定刪除「${item.name}」？已產生的兌換紀錄會保留。`)) return;
    try {
      await pointRedemptionApi.deleteItem(item.id);
      reload();
    } catch (e) { alert('刪除失敗：' + (e?.message || e)); }
  }

  return (
    <div>
      <button onClick={() => setEdit({})} style={primaryBtn}>＋ 新增兌換品項</button>

      {loading ? <Loading /> : (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.length === 0 && <Empty>還沒有兌換品項，點上方按鈕新增</Empty>}
          {items.map(it => (
            <div key={it.id} style={{
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: 14, display: 'flex', gap: 12, alignItems: 'center',
              opacity: it.is_active ? 1 : 0.55,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                background: it.image_url ? `center/cover no-repeat url(${it.image_url})` : '#f3efe4',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>{!it.image_url && '🎁'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark }}>
                  {it.name}
                  <span style={tagStyle}>{typeLabel(it.item_type)}</span>
                  {!it.is_active && <span style={{ ...tagStyle, background: '#fde8e8', color: C.danger }}>已下架</span>}
                </div>
                <div style={{ fontSize: 12, color: C.textMid, marginTop: 3 }}>
                  <b style={{ color: C.mid }}>{it.points_cost} 分</b>
                  {' · '}
                  {it.stock === null || it.stock === undefined ? '不限量' : `庫存 ${it.stock}`}
                  {it.description ? ` · ${it.description}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => toggleActive(it)} style={miniBtn}>
                  {it.is_active ? '下架' : '上架'}
                </button>
                <button onClick={() => setEdit(it)} style={miniBtn}>編輯</button>
                <button onClick={() => remove(it)} style={{ ...miniBtn, color: C.danger, borderColor: '#e8c5c5' }}>刪除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ItemModal
          item={editing}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); reload(); }}
        />
      )}
    </div>
  );
}

function ItemModal({ item, onClose, onSaved }) {
  const isNew = !item.id;
  const [form, setForm] = useState({
    name:        item.name        || '',
    description: item.description || '',
    item_type:   item.item_type   || 'physical',
    points_cost: item.points_cost ?? '',
    stock:       item.stock ?? '',          // 空字串 = 不限量
    image_url:   item.image_url   || '',
    sort_order:  item.sort_order  ?? 0,
    is_active:   item.is_active ?? true,
    min_balance_after: item.min_balance_after ?? (item.item_type === 'cash' ? 200 : 0),
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setErr('');
    if (!form.name.trim())                return setErr('品項名稱必填');
    if (!form.points_cost || Number(form.points_cost) <= 0) return setErr('所需分數必須大於 0');
    setBusy(true);
    try {
      const payload = {
        name:        form.name.trim(),
        description: form.description.trim() || null,
        item_type:   form.item_type,
        points_cost: Number(form.points_cost),
        stock:       form.stock === '' ? null : Number(form.stock),
        image_url:   form.image_url.trim() || null,
        sort_order:  Number(form.sort_order) || 0,
        is_active:   !!form.is_active,
        min_balance_after: Math.max(0, Math.trunc(Number(form.min_balance_after) || 0)),
      };
      if (isNew) await pointRedemptionApi.createItem(payload);
      else       await pointRedemptionApi.updateItem(item.id, payload);
      onSaved();
    } catch (e) {
      setErr(e?.message || '儲存失敗');
    } finally { setBusy(false); }
  }

  return (
    <Modal title={isNew ? '新增兌換品項' : '編輯兌換品項'} onClose={onClose}>
      <Field label="品項名稱 *">
        <input value={form.name} onChange={e => set('name', e.target.value)} style={input} />
      </Field>
      <Field label="說明">
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          rows={2} style={{ ...input, resize: 'vertical' }} />
      </Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label="類型" style={{ flex: 1 }}>
          <select value={form.item_type} onChange={e => set('item_type', e.target.value)} style={input}>
            {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="所需分數 *" style={{ flex: 1 }}>
          <input type="number" value={form.points_cost} onChange={e => set('points_cost', e.target.value)}
            min={1} style={input} />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label="庫存（留空 = 不限量）" style={{ flex: 1 }}>
          <input type="number" value={form.stock} onChange={e => set('stock', e.target.value)}
            min={0} placeholder="不限量" style={input} />
        </Field>
        <Field label="排序（小的在前）" style={{ flex: 1 }}>
          <input type="number" value={form.sort_order} onChange={e => set('sort_order', e.target.value)}
            style={input} />
        </Field>
      </div>
      {form.item_type === 'cash' && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#92400e' }}>
          💰 現金型品項：兌換比例固定為 <b>1 分 = NT$100</b>。<br/>
          {form.points_cost && (
            <>此品項：扣 <b>{Number(form.points_cost) || 0}</b> 分 → 寫入 <b>NT${(Number(form.points_cost) || 0) * 100}</b> 獎金到員工 MAP。</>
          )}
        </div>
      )}
      <Field label={`兌換後最低餘額（≥ 此值才可兌換${form.item_type === 'cash' ? '；現金型建議 200' : '；填 0 = 不限制'}）`}>
        <input type="number" value={form.min_balance_after} onChange={e => set('min_balance_after', e.target.value)}
          min={0} placeholder="0" style={input} />
      </Field>
      <Field label="圖片網址（選填）">
        <input value={form.image_url} onChange={e => set('image_url', e.target.value)}
          placeholder="https://..." style={input} />
      </Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textMid, marginTop: 4 }}>
        <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
        立即上架（員工看得到並可兌換）
      </label>

      {err && <div style={{ color: C.danger, fontSize: 13, marginTop: 10 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        <button onClick={onClose} style={{ ...ghostBtn, flex: 1 }}>取消</button>
        <button onClick={save} disabled={busy} style={{ ...primaryBtn, flex: 2, marginTop: 0 }}>
          {busy ? '儲存中...' : '儲存'}
        </button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════
// 兌換紀錄
// ═══════════════════════════════════════════════════════════
function RedemptionsTab() {
  const [rows, setRows]    = useState([]);
  const [loading, setLoad] = useState(true);
  const [status, setStatus] = useState('pending');   // 預設先看待審
  const [busyId, setBusyId] = useState(null);

  const reload = useCallback(async () => {
    setLoad(true);
    try {
      const r = await pointRedemptionApi.listRedemptions(status ? { status } : {});
      setRows(Array.isArray(r.data) ? r.data : []);
    } catch (e) { alert('讀取失敗：' + (e?.message || e)); }
    finally { setLoad(false); }
  }, [status]);
  useEffect(() => { reload(); }, [reload]);

  async function approve(row) {
    if (!window.confirm(`確認通過 ${row.employee_name} 兌換「${row.item_name}」？\n通過後會立即扣 ${row.points_cost} 分並回寫 MAP。`)) return;
    setBusyId(row.id);
    try {
      await pointRedemptionApi.approve(row.id);
      await reload();
    } catch (e) { alert('審核失敗：' + (e?.message || e)); }
    finally { setBusyId(null); }
  }

  async function reject(row) {
    const reason = window.prompt(`駁回 ${row.employee_name} 的「${row.item_name}」兌換申請。\n請填寫駁回原因：`);
    if (reason == null) return;
    if (!reason.trim()) { alert('請填寫駁回原因'); return; }
    setBusyId(row.id);
    try {
      await pointRedemptionApi.reject(row.id, reason.trim());
      await reload();
    } catch (e) { alert('駁回失敗：' + (e?.message || e)); }
    finally { setBusyId(null); }
  }

  async function fulfill(row) {
    if (!window.confirm(`確認「${row.item_name}」已發放給 ${row.employee_name}？`)) return;
    setBusyId(row.id);
    try {
      await pointRedemptionApi.fulfill(row.id);
      await reload();
    } catch (e) { alert('操作失敗：' + (e?.message || e)); }
    finally { setBusyId(null); }
  }

  const pendingCount = rows.filter(r => r.status === 'pending').length;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: C.textMid }}>狀態：</span>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...input, width: 170 }}>
          <option value="pending">送審中（待審核）</option>
          <option value="completed">已通過（待發放）</option>
          <option value="fulfilled">已發放</option>
          <option value="rejected">已駁回</option>
          <option value="cancelled">已取消</option>
          <option value="">全部</option>
        </select>
        <button onClick={reload} style={{ ...miniBtn, padding: '6px 12px' }}>🔄 重新整理</button>
        {status === 'pending' && pendingCount > 0 && (
          <span style={{ fontSize: 12, color: '#b7791f', fontWeight: 700 }}>
            {pendingCount} 筆待審核
          </span>
        )}
      </div>

      {loading ? <Loading /> : (
        <div style={{ overflowX: 'auto', background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg, color: C.textMid, textAlign: 'left' }}>
                <Th>申請時間</Th><Th>員工</Th><Th>門市</Th><Th>品項</Th>
                <Th>類型</Th><Th>分數</Th><Th>MAP 寫入</Th><Th>狀態</Th><Th>審核</Th><Th>操作</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: C.textLight, padding: 30 }}>沒有兌換紀錄</td></tr>
              )}
              {rows.map(r => {
                const st = STATUS_META[r.status] || { label: r.status, color: C.textMid };
                const isPending  = r.status === 'pending';
                const canFulfill = r.status === 'completed' && r.item_type === 'physical';
                const busy = busyId === r.id;
                return (
                  <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <Td>{fmtTime(r.redeemed_at)}</Td>
                    <Td>{r.employee_name || r.employee_erpid}</Td>
                    <Td>{r.store_name || '—'}</Td>
                    <Td>{r.item_name}</Td>
                    <Td>{typeLabel(r.item_type)}</Td>
                    <Td><b style={{ color: C.danger }}>-{r.points_cost}</b></Td>
                    <Td>
                      {r.map_write_status == null
                        ? <span style={{ color: C.textLight }}>—</span>
                        : <span style={{ color: r.map_write_status === 'success' ? C.ok : C.danger }}>
                            {r.map_write_status === 'success' ? '成功' : '失敗'}
                          </span>}
                    </Td>
                    <Td>
                      <span style={{ color: st.color, fontWeight: 700 }}>{st.label}</span>
                      {r.status === 'rejected' && r.reject_reason && (
                        <div style={{ fontSize: 11, color: C.danger, marginTop: 2 }}>{r.reject_reason}</div>
                      )}
                    </Td>
                    <Td>
                      {r.approved_by
                        ? <span style={{ fontSize: 11, color: C.textLight }}>
                            {r.approved_by}<br />{fmtTime(r.approved_at)}
                          </span>
                        : '—'}
                    </Td>
                    <Td>
                      {isPending ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => approve(r)} disabled={busy}
                            style={{ ...miniBtn, background: C.ok, color: '#fff', borderColor: C.ok }}>
                            {busy ? '…' : '通過'}
                          </button>
                          <button onClick={() => reject(r)} disabled={busy}
                            style={{ ...miniBtn, background: '#fff', color: C.danger, borderColor: C.danger }}>
                            駁回
                          </button>
                        </div>
                      ) : canFulfill ? (
                        <button onClick={() => fulfill(r)} disabled={busy} style={miniBtn}>標記已發放</button>
                      ) : (r.status === 'fulfilled' && r.fulfilled_at)
                          ? <span style={{ fontSize: 11, color: C.textLight }}>{fmtTime(r.fulfilled_at)}</span>
                          : '—'}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 共用元件 / 樣式 ─────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460,
        maxHeight: '90vh', overflow: 'auto', padding: 22,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.textDark }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: C.textLight }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: 12, ...style }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}
function Loading()  { return <div style={{ padding: 40, textAlign: 'center', color: C.textLight }}>載入中...</div>; }
function Empty({ children }) {
  return <div style={{ padding: 40, textAlign: 'center', color: C.textLight, fontSize: 13,
    background: C.bgCard, border: `1px dashed ${C.border}`, borderRadius: 12 }}>{children}</div>;
}
const Th = ({ children }) => <th style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</th>;
const Td = ({ children }) => <td style={{ padding: '10px 12px', color: C.textDark, whiteSpace: 'nowrap' }}>{children}</td>;

const input = {
  width: '100%', padding: '9px 11px', border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: 14, boxSizing: 'border-box', background: '#fff',
};
const primaryBtn = {
  padding: '10px 18px', background: C.dark, color: '#fff', border: 'none',
  borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 0,
};
const ghostBtn = {
  padding: '10px 18px', background: '#fff', color: C.textMid,
  border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
const miniBtn = {
  padding: '5px 10px', background: '#fff', color: C.textMid,
  border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const tagStyle = {
  fontSize: 10, fontWeight: 700, color: C.mid, background: '#f0e9dd',
  padding: '1px 6px', borderRadius: 4, marginLeft: 6, verticalAlign: 'middle',
};

function fmtTime(t) {
  if (!t) return '';
  try {
    return new Date(t).toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return t; }
}
