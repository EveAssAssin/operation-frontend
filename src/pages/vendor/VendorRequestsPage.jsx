// pages/vendor/VendorRequestsPage.jsx
// 廠商前台 — 請款管理（列表 + 新增 + 上傳附件 + 送審）

import { useState, useEffect, useCallback } from 'react';
import { vendorApi } from '../../services/api';
import { useVendorAuth } from '../../contexts/VendorAuthContext';

const C = {
  dark: '#50422d', mid: '#8b6f4e', bg: '#f5f0ea',
  bgCard: '#ffffff', border: '#e0d5c8',
  textDark: '#3a2e1e', textMid: '#6b5640', textLight: '#9a8878',
};

const btn = {
  primary: { padding: '8px 16px', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: C.dark, color: '#fff' },
  ghost:   { padding: '8px 16px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#fff', color: C.textDark },
  success: { padding: '8px 16px', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: '#2d6a4f', color: '#fff' },
  danger:  { padding: '6px 12px', border: '1px solid #fed7d7', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff5f5', color: '#c53030' },
  small:   { padding: '6px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff', color: C.textDark },
};

const inputStyle = { width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, background: '#fff', boxSizing: 'border-box' };

const STATUS_LABEL = {
  draft:     '📝 草稿',
  submitted: '⏳ 審核中',
  approved:  '✓ 已通過',
  paid:      '💰 已撥款',
  rejected:  '✗ 已退回',
};
const STATUS_COLOR = {
  draft:     ['#f3f3f3', '#666', '#ccc'],
  submitted: ['#fff8ec', '#8b6f4e', '#e5c99a'],
  approved:  ['#f0fff4', '#2d6a4f', '#b7e4c7'],
  paid:      ['#e6fffa', '#2c7a7b', '#81e6d9'],
  rejected:  ['#fff0f0', '#c53030', '#feb2b2'],
};

const fmtMoney = (v) => v == null ? '—' : `NT$ ${Number(v).toLocaleString()}`;

export default function VendorRequestsPage() {
  const { vendor } = useVendorAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', period: '' });
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.period) params.period = filter.period;
      const r = await vendorApi.listRequests(params);
      setList(Array.isArray(r?.data) ? r.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 22, color: C.textDark, marginBottom: 4 }}>📋 我的請款</h1>
      <p style={{ marginTop: 0, color: C.textLight, fontSize: 13 }}>
        建立請款單 → 上傳總表/明細/發票 → 送審。樂活審核通過後安排撥款。
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={{ ...inputStyle, width: 130 }} value={filter.status}
                onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="">全部狀態</option>
          {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input type="month" style={{ ...inputStyle, width: 150 }} value={filter.period}
               onChange={e => setFilter(f => ({ ...f, period: e.target.value }))} />
        <div style={{ flex: 1 }} />
        <button onClick={() => setCreating(true)} style={btn.primary}>+ 新增請款</button>
      </div>

      <div style={{ background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: C.bg }}>
            <tr>
              <th style={th}>單號 / 月份</th>
              <th style={th}>標題</th>
              <th style={{ ...th, textAlign: 'right' }}>金額</th>
              <th style={th}>狀態</th>
              <th style={th}>建立</th>
              <th style={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', padding: 30, color: C.textLight }}>載入中…</td></tr>}
            {!loading && list.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', padding: 30, color: C.textLight }}>尚無請款單</td></tr>}
            {!loading && list.map(r => {
              const [bg, color, border] = STATUS_COLOR[r.status] || STATUS_COLOR.draft;
              return (
                <tr key={r.id}>
                  <td style={td}>
                    <b style={{ fontFamily: 'monospace' }}>{r.request_no || '—'}</b>
                    <div style={{ fontSize: 11, color: C.textLight }}>{r.period}</div>
                  </td>
                  <td style={td}>{r.title}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtMoney(r.total_amount)}</td>
                  <td style={td}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: bg, color, border: `1px solid ${border}` }}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 12, color: C.textMid }}>
                    {new Date(r.created_at).toLocaleDateString('zh-TW')}
                  </td>
                  <td style={td}>
                    <button onClick={() => setDetail(r)} style={btn.small}>檢視</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {creating && <CreateRequestModal onClose={() => { setCreating(false); load(); }} />}
      {detail   && <DetailModal requestId={detail.id} onClose={() => { setDetail(null); load(); }} />}
    </div>
  );
}

// ────────────────────────────────────────────────
//  新增請款 Modal
// ────────────────────────────────────────────────
function CreateRequestModal({ onClose }) {
  const [form, setForm] = useState({
    period: new Date().toISOString().slice(0, 7),
    title: '',
    description: '',
    total_amount: '',
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form.period || !form.title || !form.total_amount) return alert('月份 / 標題 / 金額 必填');
    setBusy(true);
    try {
      await vendorApi.createRequest({
        ...form,
        total_amount: Number(form.total_amount),
      });
      onClose();
    } catch (e) { alert('失敗：' + e.message); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="➕ 新增請款" onClose={onClose} width={600}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="請款月份 *">
          <input type="month" style={inputStyle} value={form.period}
                 onChange={e => setForm(f => ({ ...f, period: e.target.value }))} />
        </Field>
        <Field label="標題 *">
          <input style={inputStyle} placeholder="例：2026 年 4 月貨款" value={form.title}
                 onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </Field>
        <Field label="總金額（含稅）*">
          <input type="number" style={inputStyle} placeholder="50000" value={form.total_amount}
                 onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
        </Field>
        <Field label="說明（選填）">
          <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </Field>
        <div style={{ padding: 10, background: '#fff8ec', border: '1px solid #e5c99a', borderRadius: 6, fontSize: 12, color: C.textMid }}>
          💡 建立後可以再上傳發票、總表、明細表
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btn.ghost}>取消</button>
          <button onClick={save} disabled={busy} style={btn.primary}>{busy ? '...' : '建立'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ────────────────────────────────────────────────
//  請款詳情 Modal — 看 + 上傳附件 + 送審
// ────────────────────────────────────────────────
function DetailModal({ requestId, onClose }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await vendorApi.getRequest(requestId);
      setData(r?.data || null);
    } catch (e) { console.error(e); }
  }, [requestId]);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!window.confirm('送出後將無法編輯，確定送審？')) return;
    setBusy(true);
    try { await vendorApi.submitRequest(requestId); load(); }
    catch (e) { alert('失敗：' + e.message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm('確定刪除此草稿？')) return;
    setBusy(true);
    try { await vendorApi.deleteRequest(requestId); onClose(); }
    catch (e) { alert('失敗：' + e.message); }
    finally { setBusy(false); }
  }

  async function handleFileUpload(file_type, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // ⚠️ MVP：不接 Supabase Storage，先用 data URL 存 metadata（檔案會超大，僅供測試）
    // 之後改為走 Supabase Storage upload，這裡只記 metadata。
    alert('附件上傳尚未串接 Supabase Storage，這個版本只記錄檔名。實際上傳功能將在下一階段（S1.5）加入。');
    setBusy(true);
    try {
      await vendorApi.addFile(requestId, {
        file_type,
        file_name: file.name,
        file_url:  '(pending-upload)',  // placeholder
        file_size: file.size,
        mime_type: file.type,
      });
      load();
    } catch (e) { alert('失敗：' + e.message); }
    finally { setBusy(false); e.target.value = ''; }
  }
  async function delFile(id) {
    if (!window.confirm('刪除此附件？')) return;
    try { await vendorApi.deleteFile(id); load(); }
    catch (e) { alert('失敗：' + e.message); }
  }

  if (!data) return <Modal title="載入中…" onClose={onClose} width={700}><div style={{ padding: 30, textAlign: 'center', color: C.textLight }}>載入中…</div></Modal>;

  const [bg, color, border] = STATUS_COLOR[data.status];
  const canEdit = data.status === 'draft' || data.status === 'rejected';

  return (
    <Modal title={`📝 ${data.request_no} — ${data.title}`} onClose={onClose} width={700}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ padding: 12, background: C.bg, borderRadius: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
          <div><span style={{ color: C.textLight }}>月份：</span>{data.period}</div>
          <div><span style={{ color: C.textLight }}>金額：</span><b>{fmtMoney(data.total_amount)}</b></div>
          <div><span style={{ color: C.textLight }}>狀態：</span>
            <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: bg, color, border: `1px solid ${border}` }}>
              {STATUS_LABEL[data.status]}
            </span>
          </div>
          <div><span style={{ color: C.textLight }}>附言：</span><code>{data.remit_memo || '—'}</code></div>
        </div>

        {data.description && (
          <div style={{ padding: 10, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {data.description}
          </div>
        )}

        {data.rejection_reason && (
          <div style={{ padding: 10, background: '#fff0f0', border: '1px solid #feb2b2', borderRadius: 6, fontSize: 13, color: '#c53030' }}>
            <b>退回原因：</b>{data.rejection_reason}
          </div>
        )}

        {/* 附件 */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📎 附件</div>
          {(!data.files || data.files.length === 0) && <div style={{ fontSize: 12, color: C.textLight, marginBottom: 6 }}>尚無附件</div>}
          {(data.files || []).map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: C.bg, borderRadius: 4, marginBottom: 4, fontSize: 12 }}>
              <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#fff', color: C.textMid, border: `1px solid ${C.border}` }}>
                {({ summary: '總表', detail: '明細', invoice: '發票', other: '其他' })[f.file_type]}
              </span>
              <span style={{ flex: 1 }}>{f.file_name}</span>
              {canEdit && <button onClick={() => delFile(f.id)} style={btn.danger}>刪</button>}
            </div>
          ))}

          {canEdit && (
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { t: 'summary', l: '📑 上傳總表' },
                { t: 'detail',  l: '📋 上傳明細' },
                { t: 'invoice', l: '🧾 上傳發票' },
                { t: 'other',   l: '📎 其他附件' },
              ].map(opt => (
                <label key={opt.t} style={{ ...btn.small, cursor: 'pointer', display: 'inline-block' }}>
                  {opt.l}
                  <input type="file" style={{ display: 'none' }} onChange={e => handleFileUpload(opt.t, e)} />
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 操作 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <button onClick={onClose} style={btn.ghost}>關閉</button>
          {data.status === 'draft' && (
            <>
              <button onClick={remove} disabled={busy} style={btn.danger}>刪除草稿</button>
              <button onClick={submit} disabled={busy} style={btn.success}>送審 →</button>
            </>
          )}
          {data.status === 'rejected' && (
            <button onClick={submit} disabled={busy} style={btn.success}>重新送審 →</button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

function Modal({ title, children, onClose, width = 700 }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 10, width: '100%', maxWidth: width, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.textMid }}>×</button>
        </div>
        <div style={{ padding: 18, overflow: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

const th = { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.textDark, borderBottom: `1px solid ${C.border}` };
const td = { padding: '10px 12px', fontSize: 14, color: C.textDark, borderTop: `1px solid ${C.border}` };
