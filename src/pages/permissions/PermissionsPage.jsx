// pages/permissions/PermissionsPage.jsx
// 分權系統管理頁
//   表格：行=模組，列=角色，格子是 ☑ 看 ☑ 改
//   只有「全權」角色（is_admin=true）可進來編輯
//   - 是 admin 的格子：顯示 ✓ 全權（不可點）
//   - 不是 admin 的格子：可勾選 看/改

import { useState, useEffect, useCallback } from 'react';
import { permissionsApi } from '../../services/api';

const C = {
  dark: '#50422d', mid: '#8b6f4e', light: '#cdbea2',
  bg: '#f5f0ea', bgCard: '#ffffff', border: '#e0d5c8',
  textDark: '#3a2e1e', textMid: '#6b5640', textLight: '#9a8878',
};

const btn = (v = 'default') => {
  const base = { padding: '7px 14px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
  if (v === 'primary') return { ...base, background: C.dark, color: '#fff' };
  if (v === 'ghost')   return { ...base, background: '#fff', color: C.textDark, border: `1px solid ${C.border}` };
  return { ...base, background: C.mid, color: '#fff' };
};

export default function PermissionsPage() {
  const [roles, setRoles]       = useState([]);
  const [modules, setModules]   = useState([]);
  const [perms, setPerms]       = useState([]);   // [{role_key, module_key, can_view, can_edit}]
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [dirty, setDirty]       = useState(new Set());   // 變動過的 "role_key|module_key"

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, m, p] = await Promise.all([
        permissionsApi.listRoles(),
        permissionsApi.listModules(),
        permissionsApi.listPermissions(),
      ]);
      setRoles(Array.isArray(r?.data) ? r.data : []);
      setModules(Array.isArray(m?.data) ? m.data : []);
      setPerms(Array.isArray(p?.data) ? p.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function getPerm(roleKey, moduleKey) {
    return perms.find(p => p.role_key === roleKey && p.module_key === moduleKey)
        || { role_key: roleKey, module_key: moduleKey, can_view: false, can_edit: false };
  }

  function togglePerm(roleKey, moduleKey, field) {
    setPerms(prev => {
      const idx = prev.findIndex(p => p.role_key === roleKey && p.module_key === moduleKey);
      let next;
      if (idx >= 0) {
        next = [...prev];
        next[idx] = { ...next[idx], [field]: !next[idx][field] };
        // 不能看自然不能改
        if (field === 'can_view' && !next[idx].can_view) next[idx].can_edit = false;
        if (field === 'can_edit' && next[idx].can_edit)  next[idx].can_view = true;
      } else {
        const np = { role_key: roleKey, module_key: moduleKey, can_view: false, can_edit: false };
        np[field] = true;
        if (field === 'can_edit') np.can_view = true;
        next = [...prev, np];
      }
      return next;
    });
    setDirty(prev => new Set(prev).add(`${roleKey}|${moduleKey}`));
  }

  async function handleSave() {
    if (dirty.size === 0) return;
    setSaving(true);
    try {
      const items = Array.from(dirty).map(k => {
        const [rk, mk] = k.split('|');
        const p = perms.find(x => x.role_key === rk && x.module_key === mk);
        return { role_key: rk, module_key: mk, can_view: !!p?.can_view, can_edit: !!p?.can_edit };
      });
      await permissionsApi.setBulk(items);
      setDirty(new Set());
      await load();
      alert(`已儲存 ${items.length} 筆變動`);
    } catch (e) { alert('儲存失敗：' + (e?.message || e)); }
    finally { setSaving(false); }
  }

  // 只列「非系統設定」的模組（系統設定就是這頁本身）
  const editableModules = modules;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: C.dark, padding: '20px 28px' }}>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>⚙ 系統設定 — 權限管理</div>
        <div style={{ color: C.light, fontSize: 13 }}>
          設定各角色對每個模組的「看 / 改」權限 — 全權角色（橘底）自動全開
        </div>
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ flex: 1, fontSize: 12, color: C.textMid }}>
            💡 V = 能看（顯示在 sidebar）　/　E = 能改（可新增/編輯/刪除）　·　變動: <b>{dirty.size}</b> 筆
          </div>
          <button style={btn('ghost')} onClick={load} disabled={loading}>↻ 重新載入</button>
          <button style={btn('primary')} onClick={handleSave} disabled={saving || dirty.size === 0}>
            {saving ? '儲存中...' : `💾 儲存 (${dirty.size})`}
          </button>
        </div>

        <div style={{ background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: C.bg, position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ ...th(), position: 'sticky', left: 0, background: C.bg, zIndex: 2, minWidth: 200 }}>模組</th>
                {roles.map(r => (
                  <th key={r.key} style={{ ...th(), textAlign: 'center', minWidth: 130, background: r.color || '#f5f0ea' }}>
                    <div style={{ color: r.text_color || C.textDark, fontWeight: 700 }}>{r.label}</div>
                    {r.is_admin && <div style={{ fontSize: 10, color: r.text_color || C.textDark, fontWeight: 500 }}>(全權)</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={roles.length + 1} style={td('center')}>載入中...</td></tr>}
              {!loading && editableModules.map(m => (
                <tr key={m.key} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ ...td(), position: 'sticky', left: 0, background: C.bgCard, fontWeight: 600 }}>
                    <span style={{ marginRight: 6 }}>{m.icon || '📦'}</span>{m.label}
                    {m.description && <div style={{ fontSize: 10, color: C.textLight, fontWeight: 400, marginTop: 2 }}>{m.description}</div>}
                  </td>
                  {roles.map(r => {
                    const isDirty = dirty.has(`${r.key}|${m.key}`);
                    if (r.is_admin) {
                      return (
                        <td key={r.key} style={{ ...td(), textAlign: 'center', background: '#fef3c722' }}>
                          <span style={{ color: '#92400e', fontWeight: 700, fontSize: 11 }}>✓ 全權</span>
                        </td>
                      );
                    }
                    const p = getPerm(r.key, m.key);
                    return (
                      <td key={r.key} style={{ ...td(), textAlign: 'center', background: isDirty ? '#fff8ec' : undefined }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 6, cursor: 'pointer', fontSize: 11 }}>
                          <input type="checkbox" checked={!!p.can_view} onChange={() => togglePerm(r.key, m.key, 'can_view')} />
                          <span>看</span>
                        </label>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 11 }}>
                          <input type="checkbox" checked={!!p.can_edit} onChange={() => togglePerm(r.key, m.key, 'can_edit')} />
                          <span>改</span>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 14, padding: 14, background: '#fff8ec', border: `1px solid #e5c99a`, borderRadius: 8, fontSize: 12, color: C.textMid, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>📝 說明</div>
          <div>• <b>全權角色</b>（超級管理員 / 部門主管 / 營運部主管）— 自動擁有所有模組權限，不可修改</div>
          <div>• <b>分權角色</b>（會計 / 人事 / 部員）— 由此頁設定。看 = sidebar 顯示該選項；改 = 進到頁面後可編輯</div>
          <div>• 改動後記得按右上「💾 儲存」，5 分鐘內全系統權限快取會自動更新</div>
          <div>• 一般人員角色修改在「人員管理」頁面，本頁僅負責「角色 × 模組」對照</div>
        </div>
      </div>
    </div>
  );
}

function th() { return { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.textDark, borderBottom: `1px solid ${C.border}` }; }
function td(align = 'left') { return { padding: '10px 12px', textAlign: align, fontSize: 13, color: C.textDark, verticalAlign: 'top' }; }
