// pages/appointedUnits/AppointedUnitsPage.jsx
// 特約廠商後台管理：4 個 tab
//   廠商列表 — 列出 / 搜尋 / 點進詳情看員工 / 產生綁定碼 / 同步員工
//   LINE 綁定 — 列出已綁定的 LINE 帳號，可強制解綁
//   推播     — 建立推播 + 列表
//   同步     — 一鍵全量同步單位 / 員工 / 補類別

import { useState, useEffect, useCallback } from 'react';
import { appointedUnitsApi } from '../../services/api';

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

const TABS = [
  { key: 'units',      label: '廠商列表', icon: '🏢' },
  { key: 'bindings',   label: 'LINE 綁定', icon: '🔗' },
  { key: 'broadcasts', label: '推播',     icon: '📢' },
  { key: 'sync',       label: '同步',     icon: '🔄' },
];

const fmtDateTime = (s) => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
};

const pillStyle = (bg, text, border) => ({
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 11,
  fontWeight: 600,
  background: bg, color: text, border: `1px solid ${border}`,
});

const btn = (variant = 'default') => {
  const base = {
    padding: '7px 14px',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  };
  if (variant === 'primary') return { ...base, background: C.dark,  color: '#fff' };
  if (variant === 'danger')  return { ...base, background: '#c53030', color: '#fff' };
  if (variant === 'ghost')   return { ...base, background: '#fff',  color: C.textDark, border: `1px solid ${C.border}` };
  return { ...base, background: C.mid, color: '#fff' };
};

// ════════════════════════════════════════════════════════════
//                       主頁面
// ════════════════════════════════════════════════════════════
export default function AppointedUnitsPage() {
  const [tab, setTab] = useState('units');

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: C.dark, padding: '20px 28px 0' }}>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          🤝 特約廠商管理
        </div>
        <div style={{ color: C.light, fontSize: 13, marginBottom: 16 }}>
          管理特約廠商、LINE OA 綁定、向廠商推播活動與行銷訊息
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
        {tab === 'units'      && <UnitsPanel />}
        {tab === 'bindings'   && <BindingsPanel />}
        {tab === 'broadcasts' && <BroadcastsPanel />}
        {tab === 'sync'       && <SyncPanel />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//                       Tab 1：廠商列表
// ════════════════════════════════════════════════════════════
function UnitsPanel() {
  const [list, setList]       = useState([]);
  const [pagi, setPagi]       = useState({ page: 1, size: 20, total: 0 });
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail]   = useState(null);   // {unit_code} 開啟詳情 modal

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await appointedUnitsApi.listUnits({ page, size: pagi.size, keyword });
      setList(Array.isArray(res?.data) ? res.data : []);
      setPagi(res?.pagination || { page, size: pagi.size, total: 0 });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [keyword, pagi.size]);

  useEffect(() => { load(1); }, []); // eslint-disable-line

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(1)}
          placeholder="搜尋廠商代碼或名稱..."
          style={{ flex: 1, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, background: '#fff' }}
        />
        <button style={btn('primary')} onClick={() => load(1)}>搜尋</button>
      </div>

      <div style={{ background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: C.bg }}>
            <tr>
              <th style={th()}>廠商代碼</th>
              <th style={th()}>廠商名稱</th>
              <th style={th()}>類別</th>
              <th style={th()}>合約日期</th>
              <th style={th()}>同步時間</th>
              <th style={th()}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={td('center')}>載入中...</td></tr>}
            {!loading && list.length === 0 && <tr><td colSpan={6} style={td('center')}>無資料</td></tr>}
            {!loading && list.map(u => (
              <tr key={u.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={td()}><b>{u.unit_code}</b></td>
                <td style={td()}>{u.unit_name}</td>
                <td style={td()}>{u.category_name || <span style={{ color: C.textLight }}>—</span>}</td>
                <td style={td()}>{u.contract_time ? fmtDateTime(u.contract_time).split(' ')[0] : '—'}</td>
                <td style={td()}><span style={{ color: C.textLight, fontSize: 11 }}>{fmtDateTime(u.last_synced_at)}</span></td>
                <td style={td()}>
                  <button style={btn('ghost')} onClick={() => setDetail({ unit_code: u.unit_code, unit_name: u.unit_name })}>
                    詳情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分頁 */}
      <Pagination pagi={pagi} onPage={p => load(p)} />

      {/* 詳情 Modal */}
      {detail && <UnitDetailModal unit={detail} onClose={() => { setDetail(null); load(pagi.page); }} />}
    </>
  );
}

// ════════════════════════════════════════════════════════════
// 廠商詳情 Modal
// ════════════════════════════════════════════════════════════
function UnitDetailModal({ unit, onClose }) {
  const [tab, setTab] = useState('members');
  const [unitData, setUnitData] = useState(null);
  const [members, setMembers] = useState([]);
  const [bindCodes, setBindCodes] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [u, m, c] = await Promise.all([
        appointedUnitsApi.getUnit(unit.unit_code),
        appointedUnitsApi.listMembers(unit.unit_code, { size: 200 }),
        appointedUnitsApi.listBindCodes(unit.unit_code),
      ]);
      setUnitData(u?.data || null);
      setMembers(Array.isArray(m?.data) ? m.data : []);
      setBindCodes(Array.isArray(c?.data) ? c.data : []);
    } catch (e) { console.error(e); }
  }, [unit.unit_code]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleSyncMembers() {
    setBusy(true);
    try {
      await appointedUnitsApi.syncUnitMembers(unit.unit_code);
      await loadAll();
      alert('員工同步完成');
    } catch (e) { alert('失敗：' + (e?.message || e)); }
    finally { setBusy(false); }
  }

  async function handleCreateBindCode() {
    const role = window.prompt('產生哪種綁定碼？輸入 admin（管理員）或 employee（員工）', 'admin');
    if (!role) return;
    if (!['admin', 'employee'].includes(role)) return alert('只能輸入 admin 或 employee');
    const minutes = Number(window.prompt('多久後過期（分鐘）？', '60')) || 60;
    setBusy(true);
    try {
      const res = await appointedUnitsApi.createBindCode(unit.unit_code, {
        intended_role: role,
        expires_in_minutes: minutes,
      });
      await loadAll();
      window.prompt(`綁定碼已產生（${minutes} 分鐘內有效）：`, res?.data?.bind_code || '');
    } catch (e) { alert('失敗：' + (e?.message || e)); }
    finally { setBusy(false); }
  }

  async function handleRevokeCode(id) {
    if (!window.confirm('確定要廢除這組綁定碼？')) return;
    try {
      await appointedUnitsApi.revokeBindCode(id);
      await loadAll();
    } catch (e) { alert('失敗：' + (e?.message || e)); }
  }

  return (
    <Modal onClose={onClose} title={`${unit.unit_code} ${unit.unit_name}`}>
      {!unitData && <div>載入中...</div>}
      {unitData && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <Stat label="員工數" value={unitData.stats?.member_count ?? 0} />
            <Stat label="綁定數（全部）" value={unitData.stats?.binding_count ?? 0} />
            <Stat label="綁定中" value={unitData.stats?.active_binding_count ?? 0} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button style={btn(tab === 'members' ? 'primary' : 'ghost')} onClick={() => setTab('members')}>員工 ({members.length})</button>
            <button style={btn(tab === 'codes'  ? 'primary' : 'ghost')} onClick={() => setTab('codes')}>綁定碼 ({bindCodes.length})</button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button disabled={busy} style={btn('ghost')} onClick={handleSyncMembers}>{busy ? '處理中...' : '🔄 同步員工'}</button>
              <button disabled={busy} style={btn('primary')} onClick={handleCreateBindCode}>+ 產生綁定碼</button>
            </div>
          </div>

          {tab === 'members' && (
            <div style={{ maxHeight: 400, overflow: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: C.bg, position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={th()}>客編</th>
                    <th style={th()}>姓名</th>
                    <th style={th()}>手機</th>
                    <th style={th()}>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 && <tr><td colSpan={4} style={td('center')}>尚無員工，請點「同步員工」</td></tr>}
                  {members.map(m => (
                    <tr key={m.id} style={{ borderTop: `1px solid ${C.border}` }}>
                      <td style={td()}>{m.client_id}</td>
                      <td style={td()}>{m.name || '—'}</td>
                      <td style={td()}>{m.mobile || '—'}</td>
                      <td style={td()}>
                        {m.is_active
                          ? <span style={pillStyle('#f0fff4', '#2d6a4f', '#b7e4c7')}>啟用</span>
                          : <span style={pillStyle('#fff0f0', '#c53030', '#feb2b2')}>停用</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'codes' && (
            <div style={{ maxHeight: 400, overflow: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: C.bg, position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={th()}>綁定碼</th>
                    <th style={th()}>角色</th>
                    <th style={th()}>過期</th>
                    <th style={th()}>已使用</th>
                    <th style={th()}>建立</th>
                    <th style={th()}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {bindCodes.length === 0 && <tr><td colSpan={6} style={td('center')}>尚未產生綁定碼</td></tr>}
                  {bindCodes.map(c => {
                    const expired = new Date(c.expires_at) < new Date();
                    return (
                      <tr key={c.id} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={td()}><b style={{ fontFamily: 'monospace' }}>{c.bind_code}</b></td>
                        <td style={td()}>{c.intended_role === 'admin' ? '管理員' : '員工'}</td>
                        <td style={td()}>
                          <span style={{ color: expired ? '#c53030' : C.textMid, fontSize: 11 }}>
                            {fmtDateTime(c.expires_at)}
                          </span>
                        </td>
                        <td style={td()}>
                          {c.used_at
                            ? <span style={pillStyle('#f0fff4', '#2d6a4f', '#b7e4c7')}>{fmtDateTime(c.used_at)}</span>
                            : expired
                              ? <span style={pillStyle('#fff0f0', '#c53030', '#feb2b2')}>已過期</span>
                              : <span style={pillStyle('#fff8ec', '#8b6f4e', '#e5c99a')}>未使用</span>}
                        </td>
                        <td style={td()}>{c.created_by_name || '—'}<br /><span style={{ color: C.textLight, fontSize: 10 }}>{fmtDateTime(c.created_at)}</span></td>
                        <td style={td()}>
                          {!c.used_at && !expired && (
                            <button style={btn('danger')} onClick={() => handleRevokeCode(c.id)}>廢除</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
//                     Tab 2：LINE 綁定
// ════════════════════════════════════════════════════════════
function BindingsPanel() {
  const [list, setList]       = useState([]);
  const [pagi, setPagi]       = useState({ page: 1, size: 20, total: 0 });
  const [filter, setFilter]   = useState({ unit_code: '', status: 'active', role: '' });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await appointedUnitsApi.listBindings({ page, size: pagi.size, ...filter });
      setList(Array.isArray(res?.data) ? res.data : []);
      setPagi(res?.pagination || { page, size: pagi.size, total: 0 });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filter, pagi.size]);

  useEffect(() => { load(1); }, []); // eslint-disable-line

  async function handleForceUnbind(id) {
    if (!window.confirm('確定要強制解除這個綁定？')) return;
    try {
      await appointedUnitsApi.forceUnbind(id);
      await load(pagi.page);
    } catch (e) { alert('失敗：' + (e?.message || e)); }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input
          value={filter.unit_code}
          onChange={e => setFilter(f => ({ ...f, unit_code: e.target.value }))}
          placeholder="廠商代碼"
          style={{ width: 120, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, background: '#fff' }}
        />
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, background: '#fff' }}>
          <option value="">全部狀態</option>
          <option value="active">綁定中</option>
          <option value="unbound">已解除</option>
          <option value="blocked">封鎖</option>
        </select>
        <select value={filter.role} onChange={e => setFilter(f => ({ ...f, role: e.target.value }))}
          style={{ padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, background: '#fff' }}>
          <option value="">全部身分</option>
          <option value="admin">管理員</option>
          <option value="employee">員工</option>
        </select>
        <button style={btn('primary')} onClick={() => load(1)}>查詢</button>
      </div>

      <div style={{ background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: C.bg }}>
            <tr>
              <th style={th()}>LINE 名稱</th>
              <th style={th()}>單位</th>
              <th style={th()}>身分</th>
              <th style={th()}>綁定客編</th>
              <th style={th()}>狀態</th>
              <th style={th()}>綁定時間</th>
              <th style={th()}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={td('center')}>載入中...</td></tr>}
            {!loading && list.length === 0 && <tr><td colSpan={7} style={td('center')}>無資料</td></tr>}
            {!loading && list.map(b => (
              <tr key={b.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={td()}>{b.line_display_name || '—'}</td>
                <td style={td()}><b>{b.unit_code}</b><br /><span style={{ color: C.textLight, fontSize: 11 }}>{b.unit_name_snap}</span></td>
                <td style={td()}>{b.binding_role === 'admin' ? '管理員' : '員工'}</td>
                <td style={td()}>{b.client_id || '—'}<br /><span style={{ color: C.textLight, fontSize: 11 }}>{b.member_name_snap || ''}</span></td>
                <td style={td()}>
                  {b.status === 'active' && <span style={pillStyle('#f0fff4', '#2d6a4f', '#b7e4c7')}>綁定中</span>}
                  {b.status === 'unbound' && <span style={pillStyle('#f3f3f3', '#666', '#ccc')}>已解除</span>}
                  {b.status === 'blocked' && <span style={pillStyle('#fff0f0', '#c53030', '#feb2b2')}>封鎖</span>}
                </td>
                <td style={td()}><span style={{ fontSize: 11 }}>{fmtDateTime(b.bound_at)}</span></td>
                <td style={td()}>
                  {b.status === 'active' && (
                    <button style={btn('danger')} onClick={() => handleForceUnbind(b.id)}>強制解綁</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pagi={pagi} onPage={p => load(p)} />
    </>
  );
}

// ════════════════════════════════════════════════════════════
//                       Tab 3：推播
// ════════════════════════════════════════════════════════════
function BroadcastsPanel() {
  const [list, setList]       = useState([]);
  const [pagi, setPagi]       = useState({ page: 1, size: 20, total: 0 });
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail]   = useState(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await appointedUnitsApi.listBroadcasts({ page, size: pagi.size });
      setList(Array.isArray(res?.data) ? res.data : []);
      setPagi(res?.pagination || { page, size: pagi.size, total: 0 });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [pagi.size]);

  useEffect(() => { load(1); }, []); // eslint-disable-line

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex' }}>
        <button style={btn('primary')} onClick={() => setCreating(true)}>+ 建立推播</button>
      </div>

      <div style={{ background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: C.bg }}>
            <tr>
              <th style={th()}>標題</th>
              <th style={th()}>通道</th>
              <th style={th()}>對象</th>
              <th style={th()}>狀態</th>
              <th style={th()}>送達 / 失敗 / 總數</th>
              <th style={th()}>建立</th>
              <th style={th()}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={td('center')}>載入中...</td></tr>}
            {!loading && list.length === 0 && <tr><td colSpan={7} style={td('center')}>尚無推播</td></tr>}
            {!loading && list.map(b => (
              <tr key={b.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={td()}><b>{b.title}</b></td>
                <td style={td()}>{
                  b.channel === 'line_oa' ? 'LINE OA'
                  : b.channel === 'lohas_app' ? '樂活 APP'
                  : 'LINE+APP'
                }</td>
                <td style={td()}>
                  {b.target_type === 'all'      && '全部廠商'}
                  {b.target_type === 'units'    && `指定 ${(b.target_unit_codes || []).length} 家`}
                  {b.target_type === 'category' && `類別 ${b.target_category_id || ''}`}
                  {b.target_type === 'members'  && `指定 ${(b.target_client_ids || []).length} 員工`}
                </td>
                <td style={td()}>
                  {b.status === 'pending' && <span style={pillStyle('#f0f4ff', '#3b5bdb', '#bac8ff')}>待送出</span>}
                  {b.status === 'sending' && <span style={pillStyle('#fff8ec', '#8b6f4e', '#e5c99a')}>發送中</span>}
                  {b.status === 'done'    && <span style={pillStyle('#f0fff4', '#2d6a4f', '#b7e4c7')}>完成</span>}
                  {b.status === 'failed'  && <span style={pillStyle('#fff0f0', '#c53030', '#feb2b2')}>失敗</span>}
                </td>
                <td style={td()}>{b.total_sent || 0} / {b.total_failed || 0} / {b.total_targets || 0}</td>
                <td style={td()}><span style={{ fontSize: 11 }}>{fmtDateTime(b.created_at)}</span></td>
                <td style={td()}><button style={btn('ghost')} onClick={() => setDetail(b)}>詳情</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pagi={pagi} onPage={p => load(p)} />

      {creating && <BroadcastCreateModal onClose={() => { setCreating(false); load(1); }} />}
      {detail   && <BroadcastDetailModal id={detail.id} onClose={() => setDetail(null)} />}
    </>
  );
}

function BroadcastCreateModal({ onClose }) {
  const [form, setForm] = useState({
    title: '', message: '', link_url: '', img_url: '',
    channel: 'line_oa',
    target_type: 'all',
    target_unit_codes_text: '',
    target_category_id: '',
    target_client_ids_text: '',
  });
  const [submitting, setSubmitting] = useState(false);

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit() {
    if (!form.title.trim() || !form.message.trim()) return alert('標題與內文必填');
    if (!window.confirm('確定要發送這則推播？發送後無法撤回')) return;
    setSubmitting(true);
    try {
      const body = {
        title: form.title.trim(),
        message: form.message.trim(),
        link_url: form.link_url.trim() || null,
        img_url: form.img_url.trim() || null,
        channel: form.channel,
        target_type: form.target_type,
      };
      if (form.target_type === 'units') {
        body.target_unit_codes = form.target_unit_codes_text.split(/[\s,，]+/).filter(Boolean);
      }
      if (form.target_type === 'category') {
        body.target_category_id = form.target_category_id.trim();
      }
      if (form.target_type === 'members') {
        body.target_client_ids = form.target_client_ids_text.split(/[\s,，]+/).filter(Boolean);
      }
      await appointedUnitsApi.createBroadcast(body);
      alert('推播已建立並開始發送');
      onClose();
    } catch (e) { alert('失敗：' + (e?.message || e)); }
    finally { setSubmitting(false); }
  }

  return (
    <Modal onClose={onClose} title="建立推播" width={600}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="標題">
          <input value={form.title} onChange={e => setF('title', e.target.value)} style={inputStyle()} />
        </Field>
        <Field label="內文">
          <textarea rows={4} value={form.message} onChange={e => setF('message', e.target.value)} style={{ ...inputStyle(), resize: 'vertical' }} />
        </Field>
        <Field label="連結 URL（選填）">
          <input value={form.link_url} onChange={e => setF('link_url', e.target.value)} style={inputStyle()} />
        </Field>
        <Field label="圖片 URL（選填）">
          <input value={form.img_url} onChange={e => setF('img_url', e.target.value)} style={inputStyle()} />
        </Field>
        <Field label="通道">
          <select value={form.channel} onChange={e => setF('channel', e.target.value)} style={inputStyle()}>
            <option value="line_oa">新 LINE OA（已綁定的廠商會員）</option>
            <option value="lohas_app">樂活 APP（廠商旗下會員）</option>
            <option value="both">兩個通道都送</option>
          </select>
        </Field>
        <Field label="收件對象">
          <select value={form.target_type} onChange={e => setF('target_type', e.target.value)} style={inputStyle()}>
            <option value="all">全部特約廠商</option>
            <option value="units">指定特定廠商</option>
            <option value="category">指定類別</option>
            <option value="members">指定會員（client_id）</option>
          </select>
        </Field>
        {form.target_type === 'units' && (
          <Field label="廠商代碼（用逗號或空白分隔）">
            <input value={form.target_unit_codes_text} onChange={e => setF('target_unit_codes_text', e.target.value)} style={inputStyle()} placeholder="例如：560 561 562" />
          </Field>
        )}
        {form.target_type === 'category' && (
          <Field label="類別 ID">
            <input value={form.target_category_id} onChange={e => setF('target_category_id', e.target.value)} style={inputStyle()} placeholder="例如：11" />
          </Field>
        )}
        {form.target_type === 'members' && (
          <Field label="會員客編（用逗號或空白分隔）">
            <textarea rows={3} value={form.target_client_ids_text} onChange={e => setF('target_client_ids_text', e.target.value)} style={{ ...inputStyle(), resize: 'vertical' }} placeholder="例如：28211088 28211089" />
          </Field>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button style={btn('ghost')} onClick={onClose}>取消</button>
          <button style={btn('primary')} disabled={submitting} onClick={handleSubmit}>{submitting ? '發送中...' : '送出'}</button>
        </div>
      </div>
    </Modal>
  );
}

function BroadcastDetailModal({ id, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    appointedUnitsApi.getBroadcast(id).then(r => setData(r?.data)).catch(console.error);
  }, [id]);
  if (!data) return <Modal onClose={onClose} title="推播詳情">載入中...</Modal>;
  const b = data.broadcast || {};
  const recips = data.recipients || [];
  return (
    <Modal onClose={onClose} title={`推播詳情 — ${b.title}`} width={700}>
      <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        <Stat label="總目標" value={b.total_targets || 0} />
        <Stat label="已送" value={b.total_sent || 0} />
        <Stat label="失敗" value={b.total_failed || 0} />
        <Stat label="狀態" value={b.status} />
      </div>
      <div style={{ background: C.bg, padding: 12, borderRadius: 6, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{b.title}</div>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{b.message}</div>
      </div>
      <div style={{ maxHeight: 400, overflow: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: C.bg, position: 'sticky', top: 0 }}>
            <tr>
              <th style={th()}>通道</th>
              <th style={th()}>廠商</th>
              <th style={th()}>對象</th>
              <th style={th()}>狀態</th>
              <th style={th()}>時間</th>
            </tr>
          </thead>
          <tbody>
            {recips.length === 0 && <tr><td colSpan={5} style={td('center')}>尚無收件紀錄</td></tr>}
            {recips.map(r => (
              <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={td()}>{r.channel}</td>
                <td style={td()}>{r.unit_code || '—'}</td>
                <td style={td()}>{r.line_user_id ? r.line_user_id.slice(0, 12) + '...' : (r.client_id || '—')}</td>
                <td style={td()}>{r.status}{r.error_message && <div style={{ color: '#c53030', fontSize: 10 }}>{r.error_message}</div>}</td>
                <td style={td()}>{fmtDateTime(r.sent_at || r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════
//                       Tab 4：同步
// ════════════════════════════════════════════════════════════
function SyncPanel() {
  const [status, setStatus] = useState({});
  const [hint, setHint]     = useState('');

  // 載入 / 輪詢同步狀態
  const loadStatus = useCallback(async () => {
    try {
      const r = await appointedUnitsApi.syncStatus();
      setStatus(r?.data || {});
    } catch (e) { /* 忽略 */ }
  }, []);

  useEffect(() => {
    loadStatus();
    const t = setInterval(loadStatus, 5000);   // 每 5 秒輪詢
    return () => clearInterval(t);
  }, [loadStatus]);

  async function trigger(name, fn) {
    setHint('');
    try {
      const r = await fn();
      setHint(r?.message || '已啟動');
      // 立即重抓一次狀態
      setTimeout(loadStatus, 500);
    } catch (e) {
      setHint(`啟動失敗：${e?.message || e}`);
    }
  }

  const Card = ({ name, title, desc, label, onRun }) => {
    const s = status[name] || {};
    const running = s.status === 'running';
    return (
      <div style={{ background: C.bgCard, borderRadius: 8, padding: 16, border: `1px solid ${C.border}`, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textDark }}>{title}</div>
          <SyncStatusBadge state={s} />
        </div>
        <div style={{ fontSize: 12, color: C.textMid, marginBottom: 12 }}>{desc}</div>
        <button style={btn('primary')} disabled={running} onClick={onRun}>
          {running ? '執行中...' : `🔄 ${label}`}
        </button>
        {s.result && !running && (
          <div style={{ marginTop: 10, fontSize: 11, color: C.textMid }}>
            上次結果：<code style={{ background: C.bg, padding: '2px 6px', borderRadius: 4 }}>{summarize(s.result)}</code>
          </div>
        )}
        {s.error && !running && (
          <div style={{ marginTop: 10, fontSize: 11, color: '#c53030' }}>失敗：{s.error}</div>
        )}
      </div>
    );
  };

  return (
    <>
      {hint && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #b7e4c7', borderRadius: 6, fontSize: 13, color: '#2d6a4f' }}>
          {hint}
        </div>
      )}

      <Card
        name="units"
        title="同步特約單位列表"
        desc="呼叫搜點子 API 23 getUnitList，更新本地 appointed_units 表（每天 04:00 自動執行）"
        label="同步單位"
        onRun={() => trigger('units', () => appointedUnitsApi.syncAllUnits())}
      />
      <Card
        name="categories"
        title="補抓特約單位類別"
        desc="呼叫搜點子 API 25 getAppointedUnitByCode，把每筆單位的 category_id / category_name 補齊（先做完「同步單位」再做這個）"
        label="補類別"
        onRun={() => trigger('categories', () => appointedUnitsApi.enrichCategories({ limit: 500 }))}
      />
      <Card
        name="members"
        title="同步全部廠商員工"
        desc="呼叫搜點子 API 26 getAppointedUnitMembers，更新本地 appointed_unit_members 表（每 2 小時自動執行；廠商多時可能跑 3-5 分鐘）"
        label="同步員工"
        onRun={() => trigger('members', () => appointedUnitsApi.syncAllMembers())}
      />
    </>
  );
}

function SyncStatusBadge({ state }) {
  if (!state || !state.status || state.status === 'idle') {
    return <span style={pillStyle('#f3f3f3', '#888', '#ccc')}>未執行</span>;
  }
  if (state.status === 'running') return <span style={pillStyle('#fff8ec', '#8b6f4e', '#e5c99a')}>執行中…</span>;
  if (state.status === 'done')    return <span style={pillStyle('#f0fff4', '#2d6a4f', '#b7e4c7')}>完成 {fmtRelative(state.finishedAt)}</span>;
  if (state.status === 'failed')  return <span style={pillStyle('#fff0f0', '#c53030', '#feb2b2')}>失敗</span>;
  return null;
}

function fmtRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '剛剛';
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時前`;
  return new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
}

function summarize(r) {
  if (!r || typeof r !== 'object') return '';
  if (typeof r.total === 'number')      return `total ${r.total} / inserted ${r.inserted || 0} / updated ${r.updated || 0}`;
  if (typeof r.units === 'number')      return `units ${r.units} / total ${r.total || 0} / inserted ${r.inserted || 0} / updated ${r.updated || 0}`;
  if (typeof r.enriched === 'number')   return `enriched ${r.enriched}`;
  return JSON.stringify(r).slice(0, 80);
}

// ════════════════════════════════════════════════════════════
//                       共用元件
// ════════════════════════════════════════════════════════════
function th() {
  return { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.textDark, borderBottom: `1px solid ${C.border}` };
}
function td(align = 'left') {
  return { padding: '10px 12px', textAlign: align, fontSize: 13, color: C.textDark, verticalAlign: 'top' };
}
function inputStyle() {
  return { width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, background: '#fff', boxSizing: 'border-box' };
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: C.bg, padding: 12, borderRadius: 6, textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: C.textLight }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.dark }}>{value}</div>
    </div>
  );
}

function Pagination({ pagi, onPage }) {
  if (!pagi.total) return null;
  const lastPage = Math.max(1, Math.ceil(pagi.total / pagi.size));
  return (
    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ color: C.textMid }}>共 {pagi.total} 筆</span>
      <button style={btn('ghost')} disabled={pagi.page <= 1} onClick={() => onPage(pagi.page - 1)}>‹</button>
      <span>{pagi.page} / {lastPage}</span>
      <button style={btn('ghost')} disabled={pagi.page >= lastPage} onClick={() => onPage(pagi.page + 1)}>›</button>
    </div>
  );
}

function Modal({ onClose, title, children, width = 800 }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 10, width: '100%', maxWidth: width, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark }}>{title}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: C.textMid }}>×</button>
        </div>
        <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
