// contexts/AuthContext.jsx
// 全域認證狀態管理（營運部系統）

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  const login = useCallback(async (memberId) => {
    const res = await authApi.login(memberId);
    if (!res.success) throw new Error(res.message);

    localStorage.setItem('operation_token', res.token);
    localStorage.setItem('operation_user', JSON.stringify(res.user));
    setUser(res.user);
    setModules(res.modules || []);
    return res;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('operation_token');
    localStorage.removeItem('operation_user');
    setUser(null);
    setModules([]);
  }, []);

  const roleLevel = { operation_staff: 1, operation_lead: 2, dept_head: 3, super_admin: 4 };

  const hasRole = useCallback((minRole) => {
    if (!user) return false;
    return (roleLevel[user.role] || 0) >= (roleLevel[minRole] || 999);
  }, [user]);

  const roleLabel = {
    super_admin:      '超級管理員',
    dept_head:        '營運部主管',
    operation_lead:   '營運組長',
    operation_staff:  '營運部員工',
  };

  return (
    <AuthContext.Provider value={{ user, modules, loading, login, logout, hasRole, roleLabel }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必須在 AuthProvider 內使用');
  return ctx;
}
