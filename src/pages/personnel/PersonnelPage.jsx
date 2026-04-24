// pages/personnel/PersonnelPage.jsx
// 人員管理：顯示所有在職員工、所屬門市/部門、系統角色，並支援授權操作

import { useState, useEffect, useCallback, useMemo } from 'react';
import { systemApi, personnelApi, pushGroupsApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// ── 角色定義 ────────────────────────────────────────────────
const ROLES = [
  { value: 'super_admin',     label: '超級管理員', bg: '#fff5f5', color: '#c53030' },
  { value: 'operation_lead',  label: '營運部主管', bg: '#faf5ee', color: '#8b6f4e' },
  { value: 'operation_staff', label: '營運部部員', bg: '#f5f0ea', color: '#50422d' },
];

const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.value, r]));

function RoleBadge({ role }) {
  if (!role) return <span style={s.badgeNone}>未授權</span>;
  const r = ROLE_MAP[role];
  if (!r) return <span style={s.badgeNone}>{role}</span>;
  return (
    <span style={{ ...s.badge, background: r.bg, color: r.color }}>
      {r.label}
    </span>
  );
}

// ── 授權 Modal ──────────────────────────────────────────────
function RoleModal({ target, onClose, onSave, saving, allowedRoles }) {
  const [selectedRole, setSelectedRole] = useState(() => {
    // 預設選目前角色；若目前角色超出可選範圍，預設 operation_staff
    if (target?.role && allowedRoles.map(r => r.value).includes(target.role)) return target.role;
    return allowedRoles[0]?.value || 'operation_staff';
  });

  if (!target) return null;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <strong style={{ fontSize: '16px' }}>
            {target.has_access ? '修改角色' : '授予系統權限'}
          </strong>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '0 0 4px' }}>
          <div style={s.modalEmployee}>
            <div style={s.empAvatar}>{target.name?.[0] || '？'}</div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '15px' }}>{target.name}</div>
              <div style={{ fontSize: '13px', color: '#718096' }}>
                {target.store_name} · {target.jobtitle || '—'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={s.modalLabel}>選擇角色</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {allowedRoles.map(r => (
              <label key={r.value} style={s.radioRow(selectedRole === r.value)}>
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  checked={selectedRole === r.value}
                  onChange={() => setSelectedRole(r.value)}
                  style={{ accentColor: '#50422d' }}
                />
                <div>
                  <span style={{ ...s.badge, background: r.bg, color: r.color }}>{r.label}</span>
                  <span style={s.roleDesc}>{ROLE_DESCS[r.value]}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button style={s.btnSecondary} onClick={onClose} disabled={saving}>取消</button>
          <button
            style={s.btnPrimary}
            disabled={saving}
            onClick={() => onSave(target, selectedRole)}
          >
            {saving ? '儲存中...' : '確認'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ROLE_DESCS = {
  super_admin:     '可管理所有功能與用戶授權',
  operation_lead:  '可查看帳單、人員清單',
  operation_staff: '基本系統存取',
};

// ── 推播群組：成員選擇 Modal ─────────────────────────────────
function GroupModal({ group, employees, onClose, onSave }) {
  const isEdit = !!group?.id;
  const [name, setName]        = useState(group?.name || '');
  const [desc, setDesc]        = useState(group?.description || '');
  const [selected, setSelected] = useState(() => new Set((group?.members || []).map(m => m.employee_id)));
  const [empSearch, setEmpSearch] = useState('');
  const [saving, setSaving]    = useState(false);
  const [error, setError]      = useState('');

  // 員工按門市分組（受 empSearch 過濾）
  const byStore = useMemo(() => {
    const kw = empSearch.trim().toLowerCase();
    const filtered = employees.filter(e =>
      !kw || e.name?.toLowerCase().includes(kw) || e.store_name?.toLowerCase().includes(kw)
    );
    const map = {};
    filtered.forEach(e => {
      const k = e.store_name || '未分類';
      if (!map[k]) map[k] = [];
      map[k].push(e);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'zh-Hant'));
  }, [employees, empSearch]);

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleStore(emps) {
    const allOn = emps.every(e => selected.has(e.id));
    setSelected(prev => {
      const next = new Set(prev);
      emps.forEach(e => (allOn ? next.delete(e.id) : next.add(e.id)));
      return next;
    });
  }
  function toggleAll() {
    if (selected.size === employees.length) setSelected(new Set());
    else setSelected(new Set(employees.map(e => e.id)));
  }

  async function handleSave() {
    if (!name.trim()) return setError('群組名稱為必填');
    setSaving(true); setError('');
    try {
      const members = employees
        .filter(e => selected.has(e.id))
        .map(e => ({ employee_id: e.id, employee_name: e.name, app_number: e.app_number, store_name: e.store_name }));
      const payload = { name: name.trim(), description: desc.trim() || null, members };
      if (isEdit) await pushGroupsApi.updateGroup(group.id, payload);
      else        await pushGroupsApi.createGroup(payload);
      onSave();
    } catch (e) { setError(e.message || '儲存失敗'); }
    finally     { setSaving(false); }
  }

  const ipt = { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '28px 28px 24px', width: 540, maxWidth: '96vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>

        {/* 標題 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>
            {isEdit ? '編輯推播群組' : '新增推播群組'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#718096' }}>×</button>
        </div>

        {/* 群組名稱 */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4a5568', marginBottom: 4 }}>群組名稱 *</label>
          <input style={ipt} value={name} onChange={e => setName(e.target.value)} placeholder="例：台北區主管群" />
        </div>

        {/* 說明 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4a5568', marginBottom: 4 }}>說明（選填）</label>
          <input style={ipt} value={desc} onChange={e => setDesc(e.target.value)} placeholder="群組用途說明" />
        </div>

        {/* 成員選擇 */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4a5568' }}>
              成員選擇
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#2d6a4f', background: '#f0fdf4', padding: '1px 8px', borderRadius: 99 }}>
                已選 {selected.size} 人
              </span>
            </label>
            <button onClick={toggleAll} style={{ fontSize: 12, color: '#2b6cb0', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {selected.size === employees.length ? '全部取消' : '全選'}
            </button>
          </div>
          <input
            style={{ ...ipt, marginBottom: 8 }}
            value={empSearch}
            onChange={e => setEmpSearch(e.target.value)}
            placeholder="🔍 搜尋姓名或門市..."
          />
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 280, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fafaf8' }}>
            {byStore.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#a0aec0', fontSize: 13 }}>查無符合的員工</div>
            ) : byStore.map(([store, emps]) => {
              const allOn = emps.every(e => selected.has(e.id));
              const someOn = emps.some(e => selected.has(e.id));
              return (
                <div key={store}>
                  {/* 門市 header — 點擊可全選/取消該門市 */}
                  <div
                    onClick={() => toggleStore(emps)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: allOn ? '#f0fdf4' : someOn ? '#fffbf0' : '#f5f0ea', cursor: 'pointer', borderBottom: '1px solid #e2e8f0', userSelect: 'none' }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: allOn ? '#276749' : someOn ? '#744210' : '#50422d' }}>
                      {allOn ? '☑' : someOn ? '⊟' : '☐'} {store}
                    </span>
                    <span style={{ fontSize: 11, color: '#a0aec0', marginLeft: 'auto' }}>{emps.filter(e => selected.has(e.id)).length}/{emps.length}</span>
                  </div>
                  {/* 員工列表 */}
                  {emps.map(e => (
                    <div key={e.id} onClick={() => toggle(e.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer', background: selected.has(e.id) ? '#f0fdf4' : 'transparent', borderBottom: '1px solid #f0ece6', transition: 'background 0.1s' }}>
                      <span style={{ fontSize: 16, color: selected.has(e.id) ? '#276749' : '#cbd5e0', lineHeight: 1 }}>
                        {selected.has(e.id) ? '☑' : '☐'}
                      </span>
                      <span style={{ fontSize: 14, color: '#2d3748', fontWeight: selected.has(e.id) ? 600 : 400 }}>{e.name}</span>
                      {e.line_uid && <span style={{ fontSize: 11, background: '#c6f6d5', color: '#276749', padding: '1px 6px', borderRadius: 99 }}>LINE</span>}
                      <span style={{ fontSize: 12, color: '#a0aec0', marginLeft: 'auto' }}>{e.jobtitle || ''}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* 錯誤 */}
        {error && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8, color: '#c53030', fontSize: 13 }}>{error}</div>
        )}

        {/* 按鈕 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#4a5568' }}>取消</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: saving ? '#a0aec0' : '#2d6a4f', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? '儲存中...' : (isEdit ? '儲存變更' : '建立群組')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 推播群組 Tab ──────────────────────────────────────────────
function PushGroupsTab() {
  const [groups,    setGroups]    = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);  // null | { mode:'create'|'edit', group }
  const [delConfirm, setDelConfirm] = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [err, setErr] = useState('');

  const loadGroups = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await pushGroupsApi.getGroups();
      setGroups(res.data || res || []);
    } catch (e) { setErr(e.message || '載入失敗'); }
    finally     { setLoading(false); }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const res = await pushGroupsApi.getEmployees();
      setEmployees(res.data || res || []);
    } catch (_) {}
  }, []);

  useEffect(() => { loadGroups(); loadEmployees(); }, [loadGroups, loadEmployees]);

  // 編輯時需先取得完整成員
  async function openEdit(g) {
    try {
      const res = await pushGroupsApi.getGroup(g.id);
      setModal({ mode: 'edit', group: res.data || res });
    } catch (e) { alert(e.message || '載入群組失敗'); }
  }

  async function doDelete(g) {
    setDeleting(true);
    try {
      await pushGroupsApi.deleteGroup(g.id);
      setDelConfirm(null);
      loadGroups();
    } catch (e) { alert(e.message || '刪除失敗'); }
    finally     { setDeleting(false); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e' }}>推播群組管理</div>
          <div style={{ fontSize: 13, color: '#718096', marginTop: 2 }}>建立推播名單群組，活動推播時快速選擇收件人</div>
        </div>
        <button
          onClick={() => setModal({ mode: 'create', group: null })}
          style={{ padding: '8px 16px', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >＋ 新增群組</button>
      </div>

      {err && <div style={{ padding: '10px 14px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8, color: '#c53030', fontSize: 13, marginBottom: 16 }}>{err}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#a0aec0' }}>載入中...</div>
      ) : groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#a0aec0', fontSize: 14 }}>
          尚無推播群組，點擊右上角「＋ 新增群組」建立
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groups.map(g => (
            <div key={g.id} style={{ background: '#fff', border: '1px solid #ede8e0', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e', marginBottom: 3 }}>📣 {g.name}</div>
                {g.description && <div style={{ fontSize: 13, color: '#718096' }}>{g.description}</div>}
                <div style={{ fontSize: 12, color: '#a0aec0', marginTop: 4 }}>
                  {g.member_count} 位成員
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => openEdit(g)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#4a5568' }}>編輯</button>
                <button onClick={() => setDelConfirm(g)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #fed7d7', background: '#fff5f5', fontSize: 12, cursor: 'pointer', color: '#c53030' }}>刪除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新增/編輯 Modal */}
      {modal && (
        <GroupModal
          group={modal.group}
          employees={employees}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); loadGroups(); }}
        />
      )}

      {/* 刪除確認 */}
      {delConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', maxWidth: 340, width: '90vw', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>確認刪除？</div>
            <div style={{ fontSize: 14, color: '#718096', marginBottom: 24 }}>群組「{delConfirm.name}」將被永久刪除。</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDelConfirm(null)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, cursor: 'pointer' }}>取消</button>
              <button onClick={() => doDelete(delConfirm)} disabled={deleting} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: deleting ? '#a0aec0' : '#e53e3e', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {deleting ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 主元件 ──────────────────────────────────────────────────
export default function PersonnelPage() {
  const { hasRole, user } = useAuth();
  const [mainTab, setMainTab] = useState('personnel');  // 'personnel' | 'groups'
  // operation_lead 可以管理 operation_staff；super_admin 可以管理所有人
  const canEdit = hasRole('operation_lead');
  const isSuperAdmin = user?.role === 'super_admin';

  const [allData, setAllData]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [message, setMessage]     = useState(null);  // { type, text }

  // 篩選
  const [keyword, setKeyword]     = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [filterAccess, setFilterAccess] = useState('all'); // all | yes | no
  const [filterLine, setFilterLine]   = useState('all');   // all | yes | no

  // Modal
  const [modalTarget, setModalTarget] = useState(null);
  const [saving, setSaving]       = useState(false);

  // 同步
  const [syncing, setSyncing]           = useState(false);
  const [lastSync, setLastSync]         = useState(null);
  const [syncingLineUid, setSyncingLineUid] = useState(false);
  const [lastLineUidSync, setLastLineUidSync] = useState(null);

  // ── 載入資料 ────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await systemApi.getEmployees({ limit: 500 });
      setAllData(res.data || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || '載入失敗' });
    } finally {
      setLoading(false);
    }
  }, []);

  // 載入最後同步記錄
  const loadLastSync = useCallback(async () => {
    try {
      const res = await personnelApi.getSyncStatus();
      setLastSync(res.data?.[0] || null);
    } catch (_) {}
  }, []);

  // 載入最後 LINE UID 同步記錄
  const loadLastLineUidSync = useCallback(async () => {
    try {
      const res = await personnelApi.getLineUidSyncStatus();
      setLastLineUidSync(res.data?.[0] || null);
    } catch (_) {}
  }, []);

  useEffect(() => { load(); loadLastSync(); loadLastLineUidSync(); }, [load, loadLastSync, loadLastLineUidSync]);

  // ── 門市清單（從資料中提取）────────────────────────────
  const storeList = useMemo(() => {
    const set = new Set(allData.map(e => e.store_name).filter(Boolean));
    return [...set].sort();
  }, [allData]);

  // ── 前端篩選 ────────────────────────────────────────────
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return allData.filter(emp => {
      if (kw && !emp.name?.toLowerCase().includes(kw) &&
                !emp.erpid?.toLowerCase().includes(kw) &&
                !emp.app_number?.toLowerCase().includes(kw)) return false;
      if (filterStore && emp.store_name !== filterStore) return false;
      if (filterAccess === 'yes' && !emp.has_access) return false;
      if (filterAccess === 'no'  && emp.has_access)  return false;
      if (filterLine === 'yes' && !emp.line_uid) return false;
      if (filterLine === 'no'  && emp.line_uid)  return false;
      return true;
    });
  }, [allData, keyword, filterStore, filterAccess]);

  const stats = useMemo(() => ({
    total:      allData.length,
    authorized: allData.filter(e => e.has_access).length,
  }), [allData]);

  // ── 手動同步人員 ──────────────────────────────────────────────
  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    try {
      await personnelApi.triggerSync();
      setMessage({ type: 'success', text: '人員同步已啟動，約 1-2 分鐘後重新整理可見最新資料' });
      setTimeout(() => { load(); loadLastSync(); }, 8000);
    } catch (err) {
      setMessage({ type: 'error', text: `同步失敗：${err.message}` });
    } finally {
      setSyncing(false);
    }
  }

  // ── 手動同步 LINE UID ──────────────────────────────────────
  async function handleSyncLineUid() {
    setSyncingLineUid(true);
    setMessage(null);
    try {
      await personnelApi.triggerLineUidSync();
      setMessage({ type: 'success', text: 'LINE UID 同步已啟動，約 1-2 分鐘後重新整理可見最新資料' });
      setTimeout(() => { load(); loadLastLineUidSync(); }, 8000);
    } catch (err) {
      setMessage({ type: 'error', text: `LINE UID 同步失敗：${err.message}` });
    } finally {
      setSyncingLineUid(false);
    }
  }

  // 當前用戶可管理的角色清單
  const allowedRoles = useMemo(() => {
    if (isSuperAdmin) return ROLES;
    return ROLES.filter(r => r.value === 'operation_staff');
  }, [isSuperAdmin]);

  // 判斷某員工是否可被當前用戶操作（主管只能操作未授權者或 operation_staff）
  function canEditEmp(emp) {
    if (!canEdit) return false;
    if (isSuperAdmin) return true;
    // operation_lead：只能操作未授權的人，或已是 operation_staff 的人
    return !emp.has_access || emp.role === 'operation_staff';
  }

  // ── 授權 / 修改角色 ─────────────────────────────────────
  async function handleSave(target, role) {
    setSaving(true);
    try {
      await systemApi.grantAccess(target.app_number, role);
      setMessage({ type: 'success', text: `已更新 ${target.name} 的角色為「${ROLE_MAP[role]?.label}」` });
      setModalTarget(null);
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || '操作失敗' });
    } finally {
      setSaving(false);
    }
  }

  // ── 撤銷 ────────────────────────────────────────────────
  async function handleRevoke(emp) {
    if (!window.confirm(`確定要撤銷「${emp.name}」的系統權限？`)) return;
    try {
      await systemApi.revokeAccess(emp.system_user_id);
      setMessage({ type: 'success', text: `已撤銷 ${emp.name} 的系統權限` });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || '操作失敗' });
    }
  }

  // ── Render ──────────────────────────────────────────────
  return (
    <div style={s.page}>
      {/* 頁首 */}
      <div style={{ ...s.header, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={s.title}>人員管理</h1>
          <div style={s.stats}>
            共 <strong>{stats.total}</strong> 位在職員工 ·
            已授權 <strong style={{ color: '#50422d' }}>{stats.authorized}</strong> 人 ·
            LINE 已綁定 <strong style={{ color: '#2b7a3d' }}>{allData.filter(e => e.line_uid).length}</strong> 人
            {lastSync && (
              <span style={{ marginLeft: '8px', color: '#a0aec0' }}>
                · 人員同步 {new Date(lastSync.completed_at || lastSync.started_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {lastLineUidSync && (
              <span style={{ marginLeft: '8px', color: '#a0aec0' }}>
                · LINE 同步 {new Date(lastLineUidSync.completed_at || lastLineUidSync.started_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {hasRole('operation_lead') && (
            <button
              style={{ ...s.btnSecondary, display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={handleSyncLineUid}
              disabled={syncingLineUid}
            >
              {syncingLineUid ? 'LINE 同步中...' : '💬 同步 LINE UID'}
            </button>
          )}
          {hasRole('operation_lead') && (
            <button
              style={{ ...s.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? '同步中...' : '🔄 同步人員'}
            </button>
          )}
        </div>
      </div>

      {/* ── Tab 切換 ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f5f0ea', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {[
          { id: 'personnel', label: '👥 人員清單' },
          { id: 'groups',    label: '📣 推播群組' },
        ].map(t => (
          <button key={t.id} onClick={() => setMainTab(t.id)} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: mainTab === t.id ? 700 : 500,
            background: mainTab === t.id ? '#50422d' : 'transparent',
            color: mainTab === t.id ? '#fff' : '#718096',
          }}>{t.label}</button>
        ))}
      </div>

      {mainTab === 'groups' && <PushGroupsTab />}

      {mainTab === 'personnel' && <>

      {/* 篩選列 */}
      <div style={s.toolbar}>
        <input
          style={s.search}
          type="text"
          placeholder="搜尋姓名 / 工號..."
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
        />
        <select
          style={s.select}
          value={filterStore}
          onChange={e => setFilterStore(e.target.value)}
        >
          <option value="">全部門市/部門</option>
          {storeList.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select
          style={s.select}
          value={filterAccess}
          onChange={e => setFilterAccess(e.target.value)}
        >
          <option value="all">全部人員</option>
          <option value="yes">已授權</option>
          <option value="no">未授權</option>
        </select>
        <select
          style={s.select}
          value={filterLine}
          onChange={e => setFilterLine(e.target.value)}
        >
          <option value="all">全部 LINE</option>
          <option value="yes">已綁定 LINE</option>
          <option value="no">未綁定 LINE</option>
        </select>
        <button style={s.btnSecondary} onClick={load}>重新整理</button>
      </div>

      {/* 訊息提示 */}
      {message && (
        <div style={s.alert(message.type)}>{message.text}</div>
      )}

      {/* 表格 */}
      <div style={s.card}>
        {loading ? (
          <div style={s.center}>載入中...</div>
        ) : filtered.length === 0 ? (
          <div style={s.center}>查無符合條件的人員</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>姓名</th>
                <th style={s.th}>所屬門市 / 部門</th>
                <th style={s.th}>職稱</th>
                <th style={s.th}>LINE</th>
                <th style={s.th}>系統角色</th>
                <th style={s.th}>最後登入</th>
                {canEdit && <th style={{ ...s.th, textAlign: 'right' }}>操作</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => (
                <tr key={emp.app_number || emp.erpid} style={s.tr}>
                  <td style={s.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={s.avatar}>{emp.name?.[0] || '？'}</div>
                      <div>
                        <div style={{ fontWeight: '500' }}>{emp.name}</div>
                        <div style={{ fontSize: '12px', color: '#a0aec0' }}>
                          {emp.erpid}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={s.td}>
                    <span style={{ color: '#4a5568' }}>{emp.store_name || '—'}</span>
                  </td>
                  <td style={s.td}>
                    <span style={{ color: '#718096', fontSize: '13px' }}>
                      {emp.jobtitle || '—'}
                    </span>
                  </td>
                  <td style={s.td}>
                    {emp.line_uid ? (
                      <span style={s.lineBound}>✓ 已綁定</span>
                    ) : (
                      <span style={s.lineUnbound}>未綁定</span>
                    )}
                  </td>
                  <td style={s.td}>
                    <RoleBadge role={emp.role} />
                  </td>
                  <td style={s.td}>
                    <span style={{ fontSize: '13px', color: '#718096' }}>
                      {emp.last_login_at
                        ? new Date(emp.last_login_at).toLocaleDateString('zh-TW')
                        : '—'}
                    </span>
                  </td>
                  {canEdit && (
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      {canEditEmp(emp) ? (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            style={s.actionBtn}
                            onClick={() => setModalTarget(emp)}
                          >
                            {emp.has_access ? '修改' : '授權'}
                          </button>
                          {emp.has_access && (
                            <button
                              style={{ ...s.actionBtn, ...s.actionBtnRevoke }}
                              onClick={() => handleRevoke(emp)}
                            >
                              撤銷
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#cbd5e0' }}>—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length > 0 && (
          <div style={s.footer}>顯示 {filtered.length} / {allData.length} 位員工</div>
        )}
      </div>

      {/* 授權 Modal */}
      <RoleModal
        target={modalTarget}
        onClose={() => setModalTarget(null)}
        onSave={handleSave}
        saving={saving}
        allowedRoles={allowedRoles}
      />

      </>}  {/* end personnel tab */}
    </div>
  );
}

// ── 樣式 ────────────────────────────────────────────────────
const s = {
  page:    { padding: '24px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' },
  header:  { marginBottom: '16px' },
  title:   { fontSize: '20px', fontWeight: '700', margin: '0 0 4px', color: '#1a202c' },
  stats:   { fontSize: '13px', color: '#718096' },
  toolbar: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' },
  search:  { padding: '8px 12px', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '14px', flex: '1', minWidth: '180px', maxWidth: '260px' },
  select:  { padding: '8px 12px', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '14px', background: '#fff', cursor: 'pointer' },
  card:    { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' },
  table:   { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th:      { background: '#f7fafc', padding: '11px 16px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#4a5568', whiteSpace: 'nowrap' },
  td:      { padding: '12px 16px', borderBottom: '1px solid #edf2f7', verticalAlign: 'middle' },
  tr:      { transition: 'background 0.1s' },
  center:  { textAlign: 'center', padding: '48px', color: '#a0aec0' },
  footer:  { padding: '10px 16px', fontSize: '13px', color: '#a0aec0', borderTop: '1px solid #edf2f7', background: '#f7fafc' },
  alert:   (type) => ({
    padding: '10px 16px', borderRadius: '6px', marginBottom: '14px', fontSize: '14px',
    background: type === 'error' ? '#fff5f5' : '#f0fff4',
    color:      type === 'error' ? '#c53030' : '#276749',
    border:     `1px solid ${type === 'error' ? '#feb2b2' : '#9ae6b4'}`,
  }),
  avatar:  {
    width: '32px', height: '32px', borderRadius: '50%',
    background: '#cdbea2', color: '#50422d',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '13px', fontWeight: '700', flexShrink: 0,
  },
  badge:     { display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600' },
  badgeNone: { display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '500', background: '#edf2f7', color: '#a0aec0' },
  lineBound:   { display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', background: '#c6f6d5', color: '#276749' },
  lineUnbound: { display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: '500', background: '#edf2f7', color: '#a0aec0' },
  actionBtn: {
    padding: '5px 12px', borderRadius: '5px', fontSize: '12px', fontWeight: '500',
    cursor: 'pointer', border: '1px solid #cdbea2', background: '#f5f0ea', color: '#50422d',
  },
  actionBtnRevoke: { border: '1px solid #fed7d7', background: '#fff5f5', color: '#c53030' },
  btnPrimary:   { padding: '8px 20px', background: '#50422d', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
  btnSecondary: { padding: '8px 16px', background: '#fff', color: '#4a5568', border: '1px solid #cbd5e0', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' },

  // Modal
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '16px',
  },
  modal: {
    background: '#fff', borderRadius: '12px', padding: '24px',
    width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  modalEmployee: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#f7fafc', borderRadius: '8px', marginBottom: '16px' },
  empAvatar: {
    width: '42px', height: '42px', borderRadius: '50%',
    background: '#cdbea2', color: '#50422d',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '16px', fontWeight: '700', flexShrink: 0,
  },
  modalLabel: { fontSize: '13px', fontWeight: '600', color: '#4a5568', marginBottom: '10px' },
  radioRow: (active) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
    border: `1.5px solid ${active ? '#50422d' : '#e2e8f0'}`,
    background: active ? '#f5f0ea' : '#fff',
    transition: 'all 0.1s',
  }),
  roleDesc: { fontSize: '12px', color: '#718096', marginLeft: '8px' },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#718096', padding: '0 4px', lineHeight: 1 },
};
