// contexts/AuthContext.jsx
// 全域認證狀態管理（營運部系統）

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, permissionsApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [modules,   setModules]   = useState([]);
  const [myModules, setMyModules] = useState(null);   // 分權系統：null=未載入，[]=已載入無模組
  const [loading,   setLoading]   = useState(true);

  const fetchMyModules = useCallback(async () => {
    try {
      const r = await permissionsApi.getMyModules();
      setMyModules(Array.isArray(r?.data) ? r.data : []);
    } catch (e) {
      // 分權 API 失敗（例如 migration 還沒跑）→ 不擋登入，讓 Layout fallback
      console.warn('[AuthContext] 分權 API 失敗：', e?.message);
      setMyModules([]);
    }
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem('operation_token');
    const savedUser  = localStorage.getItem('operation_user');

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        authApi.me()
          .then(res => {
            setUser(res.user);
            setModules(res.modules || []);
            return fetchMyModules();
          })
          .catch(() => logout())
          .finally(() => setLoading(false));
      } catch {
        logout();
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [fetchMyModules]);

  const login = useCallback(async (memberId) => {
    const res = await authApi.login(memberId);
    if (!res.success) throw new Error(res.message);

    localStorage.setItem('operation_token', res.token);
    localStorage.setItem('operation_user', JSON.stringify(res.user));
    setUser(res.user);
    setModules(res.modules || []);
    await fetchMyModules();
    return res;
  }, [fetchMyModules]);

  const logout = useCallback(() => {
    localStorage.removeItem('operation_token');
    localStorage.removeItem('operation_user');
    setUser(null);
    setModules([]);
    setMyModules(null);
  }, []);

  const roleLevel = { operation_staff: 1, operation_accounting: 1, operation_hr: 1, operation_lead: 2, dept_head: 3, super_admin: 4 };

  const hasRole = useCallback((minRole) => {
    if (!user) return false;
    return (roleLevel[user.role] || 0) >= (roleLevel[minRole] || 999);
  }, [user]);

  // 分權檢查 helper
  const hasModule = useCallback((moduleKey, action = 'view') => {
    if (!myModules) return true;           // 還沒載入 → 暫時放行（不擋）
    const m = myModules.find(x => x.key === moduleKey);
    if (!m) return false;
    return action === 'edit' ? !!m.can_edit : !!m.can_view;
  }, [myModules]);

  const isAdmin = useCallback(() => {
    return ['super_admin', 'dept_head', 'operation_lead'].includes(user?.role);
  }, [user]);

  const roleLabel = {
    super_admin:          '超級管理員',
    dept_head:            '部門主管',
    operation_lead:       '營運部主管',
    operation_accounting: '營運部會計',
    operation_hr:         '營運部人事',
    operation_staff:      '營運部部員',
  };

  return (
    <AuthContext.Provider value={{ user, modules, myModules, loading, login, logout, hasRole, hasModule, isAdmin, roleLabel, refreshModules: fetchMyModules }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必須在 AuthProvider 內使用');
  return ctx;
}
