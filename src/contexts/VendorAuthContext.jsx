// contexts/VendorAuthContext.jsx
// 廠商後台獨立認證 Context（與系統用戶的 AuthContext 完全分開）

import { createContext, useContext, useState, useEffect } from 'react';
import { vendorApi } from '../services/api';

const VendorAuthContext = createContext(null);

export function VendorAuthProvider({ children }) {
  const [vendor, setVendor]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('vendor_token');
    if (!token) { setLoading(false); return; }

    vendorApi.me()
      .then(res => {
        if (res.success) setVendor(res.data);
        else localStorage.removeItem('vendor_token');
      })
      .catch(() => localStorage.removeItem('vendor_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const res = await vendorApi.login(username, password);
    if (res.success) {
      localStorage.setItem('vendor_token', res.token);
      setVendor(res.vendor);
    }
    return res;
  };

  const logout = () => {
    localStorage.removeItem('vendor_token');
    setVendor(null);
  };

  return (
    <VendorAuthContext.Provider value={{ vendor, loading, login, logout }}>
      {children}
    </VendorAuthContext.Provider>
  );
}

export const useVendorAuth = () => useContext(VendorAuthContext);
