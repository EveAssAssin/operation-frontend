// pages/checks/ChecksPage.jsx
// 支票紀錄系統：批次管理 / 今日到期 / 通知設定

import { useState, useEffect, useCallback } from 'react';
import { checksApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// ── 常數 ────────────────────────────────────────────────────
const PAYEE_TYPE_LABEL = { vendor: '廠商', landlord: '房東', other: '其他' };
const PAYEE_TYPE_COLOR = {
  vendor:   { bg: '#f0e6ff', text: '#6b46c1', border: '#d6bcfa' },
  landlord: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  other:    { bg: '#e2e8f0', text: '#4a5568', border: '#cbd5e0' },
};
const STATUS_LABEL = { pending: '待兌現', paid: '已付款', voided: '作廢' };
const STATUS_COLOR = { pending: '#d69e2e', paid: '#38a169', voided: '#718096' };
const STATUS_BG    = { pending: '#fffbeb', paid: '#f0fff4', voided: '#f7fafc' };

const ROLES_LEVEL  = { operation_staff: 1, operation_lead: 2, dept_head: 3, super_admin: 4 };
const canManage    = (role) => (ROLES_LEVEL[role] || 0) >= 2;
const canCreate    = (role) => (ROLES_LEVEL[role] || 0) >= 1;

function fmtAmt(v) {
  if (v == null) return '—';
  return 'NT$ ' + Number(v).toLocaleString('zh-TW', { minimumFractionDigits: 0 });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
function today() {
  return new Date().toLocaleDateString('sv-SE');
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}

// ── 狀態 badge ───────────────────────────────────────────────
function StatusBadge({ status }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 99,
      fontSize: 11, fontWeight: 600,
      color: STATUS_COLOR[status] || '#718096',
      background: STATUS_BG[status] || '#f7fafc',
      border: `1px solid ${STATUS_COLOR[status] || '#718096'}40`,
    }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function PayeeBadge({ type }) {
  const c = PAYEE_TYPE_COLOR[type] || PAYEE_TYPE_COLOR.other;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 99,
      fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>
      {PAYEE_TYPE_LABEL[type] || type}
    </span>
  );
}

// ── 新增批次 Modal ────────────────────────────────────────────
function CreateBatchModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    payee_name: '',
    payee_type: 'vendor',
    purpose:    '',
    notes:      '',
  });
  const [checks, setChecks] = useState([
    { check_no: '', bank_name: '', bank_account: '', amount: '', due_date: '', notes: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setChk = (i, k, v) =>
    setChecks(arr => arr.map((c, j) => j === i ? { ...c, [k]: v } : c));

  const addCheck = () =>
    setChecks(arr => [...arr, { check_no: '', bank_name: arr[0]?.bank_name || '', bank_account: arr[0]?.bank_account || '', amount: '', due_date: '', notes: '' }]);

  const removeCheck = (i) =>
    setChecks(arr => arr.filter((_, j) => j !== i));

  const totalAmt = checks.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

  const handleSubmit = async () => {
    setError('');
    if (!form.payee_name) { setError('請填寫收款人名稱'); return; }
    for (let i = 0; i < checks.length; i++) {
      if (!checks[i].amount || !checks[i].due_date) {
        setError(`第 ${i + 1} 張支票請填寫金額和兌現日期`); return;
      }
    }
    setSaving(true);
    try {
      const res = await checksApi.createBatch({
        ...form,
        checks: checks.map((c, i) => ({
          ...c,
          seq_no: i + 1,
          amount: parseFloat(c.amount),
        })),
      });
      if (res.success) {
        onCreated(res.data);
        onClose();
      } else setError(res.message);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={modalOverlay}>
      <div style={{ ...modalBox, maxWidth: 720 }}>
        <div style={modalHeader}>
          <h3 style={{ margin: 0, fontSize: 16 }}>新增支票批次</h3>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: 'calc(90vh - 120px)' }}>
          {error && <div style={errorBox}>{error}</div>}

          {/* 批次基本資料 */}
          <div style={{ ...sectionHeader, marginTop: 0 }}>收款人資料</div>
          <div style={formGrid}>
            <div style={formField}>
              <label style={labelStyle}>收款人名稱 *</label>
              <input style={inputStyle} value={form.payee_name} placeholder="如：台電公司、王房東"
                onChange={e => set('payee_name', e.target.value)} />
            </div>
            <div style={formField}>
              <label style={labelStyle}>收款人類型</label>
              <select style={selectStyle} value={form.payee_type} onChange={e => set('payee_type', e.target.value)}>
                <option value="vendor">廠商</option>
                <option value="landlord">房東</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div style={{ ...formField, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>用途說明</label>
              <input style={inputStyle} value={form.purpose} placeholder="如：2026年店租分期、設備採購分期"
                onChange={e => set('purpose', e.target.value)} />
            </div>
          </div>

          {/* 支票明細 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...sectionHeader }}>
            <span>支票明細（共 {checks.length} 張）</span>
            <span style={{ fontSize: 13, color: '#3182ce', fontWeight: 600 }}>合計：{fmtAmt(totalAmt)}</span>
          </div>

          <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr 1fr 1fr 32px', gap: 8, padding: '8px 12px', background: '#edf2f7', fontSize: 11, fontWeight: 600, color: '#718096' }}>
              <span>#</span>
              <span>支票號碼</span>
              <span>銀行</span>
              <span>金額 *</span>
              <span>兌現日期 *</span>
              <span>備註</span>
              <span></span>
            </div>
            {checks.map((c, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr 1fr 1fr 32px', gap: 8, padding: '8px 12px', borderTop: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#718096', fontWeight: 600 }}>{i + 1}</span>
                <input style={{ ...inputStyle, fontSize: 12 }} value={c.check_no} placeholder="票號"
                  onChange={e => setChk(i, 'check_no', e.target.value)} />
                <input style={{ ...inputStyle, fontSize: 12 }} value={c.bank_name} placeholder="銀行名稱"
                  onChange={e => setChk(i, 'bank_name', e.target.value)} />
                <input type="number" style={{ ...inputStyle, fontSize: 12 }} value={c.amount} placeholder="金額"
                  onChange={e => setChk(i, 'amount', e.target.value)} />
                <input type="date" style={{ ...inputStyle, fontSize: 12 }} value={c.due_date}
                  onChange={e => setChk(i, 'due_date', e.target.value)} />
                <input style={{ ...inputStyle, fontSize: 12 }} value={c.notes} placeholder="備註"
                  onChange={e => setChk(i, 'notes', e.target.value)} />
                <button onClick={() => removeCheck(i)} disabled={checks.length === 1}
                  style={{ background: 'none', border: 'none', cursor: checks.length === 1 ? 'not-allowed' : 'pointer', color: '#e53e3e', fontSize: 16, padding: 0 }}>
                  {checks.length > 1 ? '✕' : ''}
                </button>
              </div>
            ))}
          </div>
          <button onClick={addCheck} style={{ ...smallBtn, background: '#ebf8ff', color: '#2b6cb0', border: '1px solid #bee3f8', marginTop: 8 }}>
            ＋ 新增一張
          </button>

          <div style={{ ...formField, marginTop: 12 }}>
            <label style={labelStyle}>備註</label>
            <textarea style={{ ...inputStyle, height: 50, resize: 'vertical' }} value={form.notes}
              onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div style={modalFooter}>
          <button onClick={onClose} style={cancelBtn}>取消</button>
          <button onClick={handleSubmit} disabled={saving} style={primaryBtn}>
            {saving ? '建立中…' : `建立批次（${checks.length} 張支票）`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 批次詳情 Modal ────────────────────────────────────────────
function BatchDetailModal({ batch, onClose, onRefresh, userRole }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState('');
  const [voidTarget, setVoidTarget] = useState(null); // { id, seq_no }
  const [voidReason, setVoidReason] = useState('');
  const lead = canManage(userRole);

  const checks = (batch.checks || []).sort((a, b) => a.seq_no - b.seq_no);
  const pendingTotal = checks.filter(c => c.status === 'pending').reduce((s, c) => s + parseFloat(c.amount), 0);
  const paidTotal    = checks.filter(c => c.status === 'paid').reduce((s, c) => s + parseFloat(c.amount), 0);

  const doAction = async (fn, label) => {
    setLoading(true); setMsg('');
    try {
      await fn();
      setMsg(`✓ ${label}成功`);
      onRefresh();
    } catch (err) {
      setMsg(`✗ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = (id, seqNo) =>
    doAction(async () => {
      const res = await checksApi.payCheck(id);
      if (!res.success) throw new Error(res.message);
    }, `第 ${seqNo} 張支票標記付款`);

  const handleVoid = () =>
    doAction(async () => {
      const res = await checksApi.voidCheck(voidTarget.id, voidReason);
      if (!res.success) throw new Error(res.message);
      setVoidTarget(null); setVoidReason('');
    }, '作廢');

  const batchStatusColor = { active: '#d69e2e', completed: '#38a169', voided: '#718096' };
  const batchStatusLabel = { active: '進行中', completed: '已完成', voided: '已作廢' };

  return (
    <div style={modalOverlay}>
      <div style={{ ...modalBox, maxWidth: 720 }}>
        <div style={modalHeader}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>{batch.batch_no}</h3>
            <span style={{ fontSize: 12, color: '#718096' }}>{batch.payee_name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: batchStatusColor[batch.status] }}>
              ● {batchStatusLabel[batch.status]}
            </span>
            <button onClick={onClose} style={closeBtn}>✕</button>
          </div>
        </div>
        <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: 'calc(90vh - 120px)' }}>
          {msg && (
            <div style={msg.startsWith('✓') ? successBox : errorBox}>
              {msg}
              <button onClick={() => setMsg('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          )}

          {/* 基本資訊 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px', marginBottom: 16 }}>
            <InfoRow label="收款人" value={<><PayeeBadge type={batch.payee_type} /> {batch.payee_name}</>} />
            <InfoRow label="批次編號" value={<span style={{ fontFamily: 'monospace' }}>{batch.batch_no}</span>} />
            <InfoRow label="支票張數" value={`${batch.check_count} 張`} />
            <InfoRow label="批次總額" value={<strong style={{ fontSize: 15 }}>{fmtAmt(batch.total_amount)}</strong>} />
            <InfoRow label="待兌現" value={<span style={{ color: '#d69e2e', fontWeight: 600 }}>{fmtAmt(pendingTotal)}</span>} />
            <InfoRow label="已付款" value={<span style={{ color: '#38a169', fontWeight: 600 }}>{fmtAmt(paidTotal)}</span>} />
            {batch.purpose && <InfoRow label="用途" value={batch.purpose} />}
            {batch.notes   && <InfoRow label="備註" value={batch.notes} />}
          </div>

          {/* 支票明細表 */}
          <div style={sectionHeader}>支票明細</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f7fafc' }}>
                <th style={th}>#</th>
                <th style={th}>票號</th>
                <th style={th}>銀行</th>
                <th style={{ ...th, textAlign: 'right' }}>金額</th>
                <th style={th}>兌現日期</th>
                <th style={th}>距今</th>
                <th style={th}>狀態</th>
                <th style={th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {checks.map(c => {
                const days = daysUntil(c.due_date);
                const isPending  = c.status === 'pending';
                const isOverdue  = isPending && days !== null && days < 0;
                const isToday    = isPending && days === 0;
                return (
                  <tr key={c.id} style={{
                    background: isOverdue ? '#fff5f5' : isToday ? '#fffbeb' : '#fff',
                    borderBottom: '1px solid #f0f4f8',
                  }}>
                    <td style={{ ...td, fontWeight: 700, color: '#4a5568' }}>{c.seq_no}</td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{c.check_no || '—'}</td>
                    <td style={td}>{c.bank_name || '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmtAmt(c.amount)}</td>
                    <td style={td}>{fmtDate(c.due_date)}</td>
                    <td style={{ ...td, fontSize: 12 }}>
                      {isPending && days !== null ? (
                        <span style={{
                          fontWeight: 600,
                          color: isOverdue ? '#e53e3e' : isToday ? '#d69e2e' : days <= 3 ? '#e67e22' : '#4a5568',
                        }}>
                          {isOverdue ? `逾期 ${Math.abs(days)} 天` : isToday ? '今日到期' : `${days} 天後`}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={td}><StatusBadge status={c.status} /></td>
                    <td style={td}>
                      {isPending && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button disabled={loading} onClick={() => handlePay(c.id, c.seq_no)}
                            style={{ ...smallBtn, background: '#f0fff4', color: '#276749', border: '1px solid #c6f6d5' }}>
                            ✓ 標記付款
                          </button>
                          {lead && (
                            <button disabled={loading} onClick={() => { setVoidTarget(c); setVoidReason(''); }}
                              style={{ ...smallBtn, background: '#fff5f5', color: '#c53030', border: '1px solid #fed7d7' }}>
                              作廢
                            </button>
                          )}
                        </div>
                      )}
                      {c.status === 'paid' && (
                        <span style={{ fontSize: 11, color: '#718096' }}>
                          {c.paid_at ? new Date(c.paid_at).toLocaleDateString('zh-TW') : '—'}
                        </span>
                      )}
                      {c.status === 'voided' && (
                        <span style={{ fontSize: 11, color: '#718096' }}>{c.void_reason || '—'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* 作廢確認列 */}
          {voidTarget && (
            <div style={{ marginTop: 12, padding: 12, background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8 }}>
              <div style={{ fontSize: 13, marginBottom: 8, color: '#c53030', fontWeight: 600 }}>
                作廢第 {voidTarget.seq_no} 張支票（{fmtAmt(voidTarget.amount)}）
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="作廢原因（選填）"
                  value={voidReason} onChange={e => setVoidReason(e.target.value)} />
                <button disabled={loading} onClick={handleVoid}
                  style={{ ...primaryBtn, background: '#e53e3e' }}>確認作廢</button>
                <button onClick={() => setVoidTarget(null)} style={cancelBtn}>取消</button>
              </div>
            </div>
          )}
        </div>
        <div style={modalFooter}>
          <button onClick={onClose} style={cancelBtn}>關閉</button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ color: '#718096', fontSize: 11, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#2d3748' }}>{value}</span>
    </div>
  );
}

// ── 今日到期 Tab ──────────────────────────────────────────────
function DueTab() {
  const [date,    setDate]    = useState(today());
  const [checks,  setChecks]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState('');

  const load = useCallback(async (d) => {
    setLoading(true);
    try {
      const res = await checksApi.getDue(d);
      if (res.success) {
        setChecks(res.data);
        setTotal(res.total_amount || 0);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const handlePay = async (id, seq, payee) => {
    try {
      const res = await checksApi.payCheck(id);
      if (res.success) {
        setMsg(`✓ 已標記付款：${payee} 第 ${seq} 張`);
        load(date);
      }
    } catch (err) { setMsg(`✗ ${err.message}`); }
  };

  const isToday = date === today();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>查詢日期</label>
          <input type="date" style={{ ...inputStyle, width: 160 }} value={date}
            onChange={e => setDate(e.target.value)} />
        </div>
        {isToday && <span style={{ fontSize: 12, background: '#ebf8ff', color: '#2b6cb0', padding: '4px 10px', borderRadius: 99, border: '1px solid #bee3f8', fontWeight: 600 }}>今天</span>}
      </div>

      {msg && (
        <div style={msg.startsWith('✓') ? successBox : errorBox}>
          {msg} <button onClick={() => setMsg('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#718096' }}>載入中…</div>
      ) : checks.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 15, color: '#718096' }}>{date} 無到期支票</div>
        </div>
      ) : (
        <>
          {/* 彙總 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 10, padding: '12px 20px', flex: 1 }}>
              <div style={{ fontSize: 12, color: '#718096' }}>今日到期張數</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#e53e3e' }}>{checks.length} <span style={{ fontSize: 14 }}>張</span></div>
            </div>
            <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 10, padding: '12px 20px', flex: 2 }}>
              <div style={{ fontSize: 12, color: '#718096' }}>應付總金額</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#e53e3e' }}>{fmtAmt(total)}</div>
            </div>
          </div>

          {/* 清單 */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f7fafc' }}>
                <th style={th}>收款人</th>
                <th style={th}>用途</th>
                <th style={th}>第幾張</th>
                <th style={th}>票號</th>
                <th style={th}>銀行</th>
                <th style={{ ...th, textAlign: 'right' }}>金額</th>
                <th style={th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {checks.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f0f4f8', background: '#fff' }}>
                  <td style={td}>
                    <PayeeBadge type={c.check_batches?.payee_type} />
                    <span style={{ marginLeft: 6, fontWeight: 600 }}>{c.check_batches?.payee_name}</span>
                  </td>
                  <td style={{ ...td, color: '#718096' }}>{c.check_batches?.purpose || '—'}</td>
                  <td style={{ ...td, fontWeight: 600 }}>第 {c.seq_no} 張</td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{c.check_no || '—'}</td>
                  <td style={td}>{c.bank_name || '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#e53e3e' }}>{fmtAmt(c.amount)}</td>
                  <td style={td}>
                    <button onClick={() => handlePay(c.id, c.seq_no, c.check_batches?.payee_name)}
                      style={{ ...smallBtn, background: '#f0fff4', color: '#276749', border: '1px solid #c6f6d5' }}>
                      ✓ 標記付款
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ── 通知設定 Tab ──────────────────────────────────────────────
function NotifyTab() {
  const [targets, setTargets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', app_number: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await checksApi.getTargets();
    if (res.success) setTargets(res.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setError('');
    if (!form.name || !form.app_number) { setError('請填寫姓名和 App 編號'); return; }
    setSaving(true);
    try {
      const res = await checksApi.createTarget(form);
      if (res.success) {
        setMsg('✓ 已新增通知對象');
        setShowForm(false);
        setForm({ name: '', app_number: '', notes: '' });
        load();
      } else setError(res.message);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (t) => {
    try {
      const res = await checksApi.updateTarget(t.id, { is_active: !t.is_active });
      if (res.success) { setMsg(`✓ 已${!t.is_active ? '啟用' : '停用'} ${t.name}`); load(); }
    } catch (err) { setMsg(`✗ ${err.message}`); }
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`確定刪除 ${t.name}？`)) return;
    try {
      await checksApi.deleteTarget(t.id);
      setMsg(`✓ 已刪除 ${t.name}`);
      load();
    } catch (err) { setMsg(`✗ ${err.message}`); }
  };

  const handleTest = async () => {
    setTesting(true); setMsg('');
    try {
      const res = await checksApi.testNotify();
      if (res.success) {
        setMsg(res.skipped
          ? `✓ 測試完成（${res.check_count === 0 ? '今日無到期支票' : '無通知目標'}）`
          : `✓ 已發送通知給 ${res.notified} 人（${res.check_count} 張支票）`);
      }
    } catch (err) { setMsg(`✗ ${err.message}`); }
    finally { setTesting(false); }
  };

  return (
    <div>
      <div style={{ background: '#fffbeb', border: '1px solid #feebc8', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#7b341e' }}>
        <strong>⏰ 每日 10:00</strong> 自動推播當日到期支票清單至以下人員的 LINE。需填入該人員的 App 會員編號。
      </div>

      {msg && (
        <div style={msg.startsWith('✓') ? successBox : errorBox}>
          {msg} <button onClick={() => setMsg('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>通知名單（{targets.filter(t => t.is_active).length} 人啟用）</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleTest} disabled={testing}
            style={{ ...cancelBtn, border: '1px solid #d69e2e', color: '#7b341e' }}>
            {testing ? '發送中…' : '🔔 手動測試發送'}
          </button>
          <button onClick={() => { setShowForm(!showForm); setError(''); }} style={primaryBtn}>
            {showForm ? '取消' : '＋ 新增'}
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          {error && <div style={errorBox}>{error}</div>}
          <div style={formGrid}>
            <div style={formField}>
              <label style={labelStyle}>姓名 *</label>
              <input style={inputStyle} value={form.name} placeholder="如：財務部 陳會計"
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div style={formField}>
              <label style={labelStyle}>App 會員編號 *</label>
              <input style={inputStyle} value={form.app_number} placeholder="如：A001234"
                onChange={e => setForm(f => ({ ...f, app_number: e.target.value }))} />
            </div>
            <div style={{ ...formField, gridColumn: '1 / -1' }}>
              <label style={labelStyle}>備註</label>
              <input style={inputStyle} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button onClick={() => setShowForm(false)} style={cancelBtn}>取消</button>
            <button onClick={handleCreate} disabled={saving} style={primaryBtn}>{saving ? '新增中…' : '新增'}</button>
          </div>
        </div>
      )}

      {targets.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#a0aec0' }}>尚未設定通知對象</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f7fafc' }}>
              <th style={th}>姓名</th>
              <th style={th}>App 編號</th>
              <th style={th}>狀態</th>
              <th style={th}>備註</th>
              <th style={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {targets.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #f0f4f8', opacity: t.is_active ? 1 : 0.5 }}>
                <td style={{ ...td, fontWeight: 600 }}>{t.name}</td>
                <td style={{ ...td, fontFamily: 'monospace' }}>{t.app_number}</td>
                <td style={td}>
                  <span style={{ fontWeight: 600, color: t.is_active ? '#38a169' : '#718096' }}>
                    {t.is_active ? '● 通知中' : '○ 停用'}
                  </span>
                </td>
                <td style={{ ...td, color: '#718096' }}>{t.notes || '—'}</td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => toggleActive(t)}
                      style={{ ...smallBtn, background: t.is_active ? '#fff5f5' : '#f0fff4', color: t.is_active ? '#c53030' : '#276749', border: t.is_active ? '1px solid #fed7d7' : '1px solid #c6f6d5' }}>
                      {t.is_active ? '停用' : '啟用'}
                    </button>
                    <button onClick={() => handleDelete(t)}
                      style={{ ...smallBtn, background: '#fff', color: '#e53e3e', border: '1px solid #fed7d7' }}>
                      刪除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────
export default function ChecksPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('batches');
  const [batches, setBatches]       = useState([]);
  const [pagination, setPagination] = useState({});
  const [filter, setFilter] = useState({ payee_type: '', status: '', q: '' });
  const [loading, setLoading]       = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [todayCount, setTodayCount] = useState(0);
  const [upcoming, setUpcoming]     = useState([]);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await checksApi.getBatches({
        payee_type: filter.payee_type || undefined,
        status:     filter.status || undefined,
        q:          filter.q || undefined,
        limit: 50,
      });
      if (res.success) { setBatches(res.data); setPagination(res.pagination); }
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  // 今日到期數量 + 未來 7 天預覽
  useEffect(() => {
    checksApi.getDue().then(r => {
      if (r.success) setTodayCount(r.data.length);
    });
    checksApi.getUpcoming(7).then(r => {
      if (r.success) setUpcoming(r.data);
    });
  }, []);

  const openBatch = async (id) => {
    const res = await checksApi.getBatch(id);
    if (res.success) setSelectedBatch(res.data);
  };

  const refreshBatch = useCallback(async () => {
    if (!selectedBatch) return;
    const res = await checksApi.getBatch(selectedBatch.id);
    if (res.success) setSelectedBatch(res.data);
    loadBatches();
    // 重新載入今日到期數
    checksApi.getDue().then(r => r.success && setTodayCount(r.data.length));
    checksApi.getUpcoming(7).then(r => r.success && setUpcoming(r.data));
  }, [selectedBatch, loadBatches]);

  const batchStatusLabel = { active: '進行中', completed: '已完成', voided: '已作廢' };
  const batchStatusColor = { active: '#d69e2e', completed: '#38a169', voided: '#718096' };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#2d3748' }}>支票紀錄</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#718096' }}>管理對廠商與房東的分期支票批次</p>
        </div>
        {tab === 'batches' && canCreate(user?.role) && (
          <button onClick={() => setShowCreate(true)} style={primaryBtn}>＋ 新增支票批次</button>
        )}
      </div>

      {/* 今日到期 Banner */}
      {todayCount > 0 && (
        <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}
          onClick={() => setTab('due')}>
          <div>
            <span style={{ fontSize: 16, marginRight: 8 }}>🚨</span>
            <strong style={{ color: '#c53030' }}>今日有 {todayCount} 張支票到期</strong>
            <span style={{ fontSize: 13, color: '#718096', marginLeft: 8 }}>點此查看付款清單</span>
          </div>
          <span style={{ color: '#c53030', fontSize: 14 }}>→</span>
        </div>
      )}

      {/* 近期到期預覽 */}
      {upcoming.length > 0 && tab === 'batches' && (
        <div style={{ background: '#fffbeb', border: '1px solid #feebc8', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#7b341e', marginBottom: 8 }}>⏰ 近 7 天即將到期</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {upcoming.map(c => {
              const days = daysUntil(c.due_date);
              return (
                <div key={c.id} style={{ background: '#fff', border: '1px solid #feebc8', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>{c.check_batches?.payee_name}</span>
                  <span style={{ color: '#718096', marginLeft: 4 }}>第{c.seq_no}張</span>
                  <span style={{ color: '#d69e2e', marginLeft: 6, fontWeight: 600 }}>{fmtAmt(c.amount)}</span>
                  <span style={{ color: '#718096', marginLeft: 4 }}>
                    {days === 0 ? '今天' : `${days}天後`}（{fmtDate(c.due_date)}）
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        {[
          { key: 'batches', label: '支票批次' },
          { key: 'due',     label: `今日到期${todayCount > 0 ? ` 🔴${todayCount}` : ''}` },
          { key: 'notify',  label: '通知設定', hidden: !canManage(user?.role) },
        ].filter(t => !t.hidden).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '8px 20px', fontSize: 14, fontWeight: 600,
            color: tab === t.key ? '#3182ce' : '#718096',
            borderBottom: tab === t.key ? '2px solid #3182ce' : '2px solid transparent',
            marginBottom: -2,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 支票批次 Tab ── */}
      {tab === 'batches' && (
        <>
          {/* 篩選列 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>收款人類型</label>
              <select style={{ ...selectStyle, width: 130 }} value={filter.payee_type}
                onChange={e => setFilter(f => ({ ...f, payee_type: e.target.value }))}>
                <option value="">全部類型</option>
                <option value="vendor">廠商</option>
                <option value="landlord">房東</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div>
              <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>批次狀態</label>
              <select style={{ ...selectStyle, width: 120 }} value={filter.status}
                onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
                <option value="">全部狀態</option>
                <option value="active">進行中</option>
                <option value="completed">已完成</option>
                <option value="voided">已作廢</option>
              </select>
            </div>
            <div>
              <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>搜尋收款人</label>
              <input style={{ ...inputStyle, width: 180 }} value={filter.q} placeholder="輸入名稱…"
                onChange={e => setFilter(f => ({ ...f, q: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && loadBatches()} />
            </div>
            <button onClick={loadBatches} style={{ ...primaryBtn, alignSelf: 'flex-end' }}>搜尋</button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#718096' }}>載入中…</div>
          ) : batches.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 15, color: '#718096' }}>尚無支票批次紀錄</div>
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f7fafc' }}>
                    <th style={th}>批次編號</th>
                    <th style={th}>收款人</th>
                    <th style={th}>用途</th>
                    <th style={{ ...th, textAlign: 'center' }}>張數</th>
                    <th style={{ ...th, textAlign: 'right' }}>總金額</th>
                    <th style={th}>進度</th>
                    <th style={th}>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map(b => {
                    const paid   = (b.checks || []).filter(c => c.status === 'paid').length;
                    const voided = (b.checks || []).filter(c => c.status === 'voided').length;
                    const total  = (b.checks || []).length;
                    const pct    = total > 0 ? Math.round((paid / (total - voided)) * 100) : 0;
                    return (
                      <tr key={b.id} style={{ ...trHover, cursor: 'pointer', borderBottom: '1px solid #f0f4f8' }}
                        onClick={() => openBatch(b.id)}>
                        <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: '#4a5568' }}>{b.batch_no}</td>
                        <td style={td}>
                          <PayeeBadge type={b.payee_type} />
                          <span style={{ marginLeft: 6, fontWeight: 600 }}>{b.payee_name}</span>
                        </td>
                        <td style={{ ...td, color: '#718096' }}>{b.purpose || '—'}</td>
                        <td style={{ ...td, textAlign: 'center' }}>{b.check_count} 張</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fmtAmt(b.total_amount)}</td>
                        <td style={{ ...td, minWidth: 120 }}>
                          {b.status !== 'voided' && (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 99 }}>
                                  <div style={{ width: `${pct}%`, height: '100%', background: '#38a169', borderRadius: 99, transition: 'width 0.3s' }} />
                                </div>
                                <span style={{ fontSize: 11, color: '#718096', minWidth: 36 }}>{paid}/{total - voided}</span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={td}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: batchStatusColor[b.status] }}>
                            ● {batchStatusLabel[b.status]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pagination.total > 0 && (
                <div style={{ marginTop: 8, color: '#718096', fontSize: 12 }}>共 {pagination.total} 筆</div>
              )}
            </>
          )}
        </>
      )}

      {/* ── 今日到期 Tab ── */}
      {tab === 'due' && <DueTab />}

      {/* ── 通知設定 Tab ── */}
      {tab === 'notify' && <NotifyTab />}

      {/* 批次詳情 Modal */}
      {selectedBatch && (
        <BatchDetailModal
          batch={selectedBatch}
          onClose={() => setSelectedBatch(null)}
          onRefresh={refreshBatch}
          userRole={user?.role}
        />
      )}

      {/* 新增批次 Modal */}
      {showCreate && (
        <CreateBatchModal
          onClose={() => setShowCreate(false)}
          onCreated={(batch) => {
            setSelectedBatch(batch);
            loadBatches();
          }}
        />
      )}
    </div>
  );
}

// ── 樣式常數 ──────────────────────────────────────────────────
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 };
const modalBox     = { background: '#fff', borderRadius: 12, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' };
const modalHeader  = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e2e8f0' };
const modalFooter  = { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #e2e8f0' };
const closeBtn     = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#718096' };
const primaryBtn   = { background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 };
const cancelBtn    = { background: '#edf2f7', color: '#4a5568', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, cursor: 'pointer' };
const smallBtn     = { border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 };
const inputStyle   = { border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none' };
const selectStyle  = { ...inputStyle, cursor: 'pointer' };
const labelStyle   = { fontSize: 12, color: '#718096', fontWeight: 600 };
const formGrid     = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' };
const formField    = { display: 'flex', flexDirection: 'column', gap: 4 };
const errorBox     = { background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 6, padding: '8px 12px', marginBottom: 12, color: '#c53030', fontSize: 13 };
const successBox   = { background: '#f0fff4', border: '1px solid #c6f6d5', borderRadius: 6, padding: '8px 12px', marginBottom: 12, color: '#276749', fontSize: 13 };
const sectionHeader = { fontSize: 13, fontWeight: 700, color: '#4a5568', margin: '16px 0 8px', paddingBottom: 6, borderBottom: '1px solid #e2e8f0' };
const th = { padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 12, color: '#4a5568', borderBottom: '2px solid #e2e8f0' };
const td = { padding: '10px 12px', verticalAlign: 'middle' };
const trHover = { transition: 'background 0.1s' };
