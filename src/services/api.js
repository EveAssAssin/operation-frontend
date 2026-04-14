// services/api.js
// Axios 實例設定：統一管理 API 請求 / 錯誤處理 / Token
// ⚠️ Response interceptor 已自動解包 response.data
//    所以 api.get() / api.post() 的回傳值已經是後端 JSON body
//    正確用法：res.success / res.data / res.message
//    錯誤用法：res.data.success（多解了一層）

import axios from 'axios';

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

// ⚠️ 部署時改成營運部後端的 Render URL
const baseURL = isLocalhost
  ? '/api'
  : (import.meta.env.VITE_API_URL || '/api');

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request 攔截器：自動帶入 Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('operation_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Response 攔截器：統一解包 + 錯誤處理
api.interceptors.response.use(
  (response) => response.data,   // ← 已自動解包一層
  (error) => {
    if (error.response?.status === 401) {
      const reqUrl = error.config?.url || '';
      const isPublicApi = reqUrl.includes('/public/');
      if (!isPublicApi) {
        localStorage.removeItem('operation_token');
        localStorage.removeItem('operation_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error.response?.data || { message: '網路連線異常' });
  }
);

// Auth API
export const authApi = {
  login: (app_number) => api.post('/auth/login', { app_number }),
  me: () => api.get('/auth/me'),
};

// Personnel API
export const personnelApi = {
  getDepartments: () => api.get('/personnel/departments'),
  getEmployees: (params = {}) => api.get('/personnel/employees', { params }),
  getEmployee: (id) => api.get(`/personnel/employees/${id}`),
  updateLineUid: (id, lineUid) =>
    api.patch(`/personnel/employees/${id}/line-uid`, { line_uid: lineUid }),
  triggerSync: () => api.post('/personnel/sync'),
  getSyncStatus: () => api.get('/personnel/sync/status'),
  getSyncDetail: (logId) => api.get(`/personnel/sync/status/${logId}`),
};

// System API (系統用戶管理)
export const systemApi = {
  getEmployees:   (params = {}) => api.get('/system/employees', { params }),
  grantAccess:    (appNumber, role) => api.post('/system/grant', { app_number: appNumber, role }),
  updateUserRole: (id, role) => api.put(`/system/${id}/role`, { role }),
  revokeAccess:   (id) => api.put(`/system/${id}/revoke`),
};

export default api;
