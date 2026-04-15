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

const baseURL = isLocalhost
  ? '/api'
  : (import.meta.env.VITE_API_URL || 'https://operation-backend.onrender.com/api');

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

// Billing API（開帳系統，operation_lead 以上）
export const billingApi = {
  getSummary:  (month) =>
    api.get('/billing/summary', { params: { month } }),
  getOrders:   (month, store_erpid) =>
    api.get('/billing/orders', { params: { month, store_erpid } }),
  sync:        (month) =>
    api.post('/billing/sync', month ? { month } : {}),
  getSyncLogs: (limit = 10) =>
    api.get('/billing/sync/logs', { params: { limit } }),
  // Method B：從市場 API 取得含照片/完工備註的完整訂單明細
  getOrderDetail: (sourceType, sourceId) =>
    api.get(`/billing/order-detail/${sourceType}/${sourceId}`),
};

// Billing V2 API（開帳系統 v2）
export const billingV2Api = {
  // 來源單位
  getSources:       (params = {}) => api.get('/billing-v2/sources', { params }),
  getSource:        (id) => api.get(`/billing-v2/sources/${id}`),
  createSource:     (data) => api.post('/billing-v2/sources', data),
  updateSource:     (id, data) => api.patch(`/billing-v2/sources/${id}`, data),
  // 會計科目
  getCategories:    (sourceId, all = false) =>
    api.get(`/billing-v2/sources/${sourceId}/categories`, { params: { all } }),
  createCategory:   (sourceId, data) =>
    api.post(`/billing-v2/sources/${sourceId}/categories`, data),
  updateCategory:   (id, data) => api.patch(`/billing-v2/categories/${id}`, data),
  // 帳單
  getBills:         (params = {}) => api.get('/billing-v2/bills', { params }),
  getBill:          (id) => api.get(`/billing-v2/bills/${id}`),
  createBill:       (data) => api.post('/billing-v2/bills', data),
  updateBill:       (id, data) => api.patch(`/billing-v2/bills/${id}`, data),
  updateAllocations:(id, allocations) =>
    api.put(`/billing-v2/bills/${id}/allocations`, { allocations }),
  submitBill:       (id) => api.post(`/billing-v2/bills/${id}/submit`),
  confirmBill:      (id) => api.post(`/billing-v2/bills/${id}/confirm`),
  distributeBill:   (id) => api.post(`/billing-v2/bills/${id}/distribute`),
  voidBill:         (id, reason) =>
    api.post(`/billing-v2/bills/${id}/void`, { void_reason: reason }),
  // 月報
  getReport:        (period) => api.get(`/billing-v2/report/${period}`),
  // 廠商帳號管理（後台用）
  getVendorAccounts: (params = {}) => api.get('/billing-v2/vendors', { params }),
  createVendorAccount: (data) => api.post('/billing-v2/vendors', data),
  updateVendorAccount: (id, data) => api.patch(`/billing-v2/vendors/${id}`, data),
};

// Vendor API（廠商後台，獨立 JWT）
const vendorApi_base = axios.create({
  baseURL: (() => {
    const isLocalhost = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    return isLocalhost ? '/api/vendor'
      : (import.meta.env.VITE_API_URL
          ? import.meta.env.VITE_API_URL.replace('/api', '/api/vendor')
          : 'https://operation-backend.onrender.com/api/vendor');
  })(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});
vendorApi_base.interceptors.request.use((config) => {
  const token = localStorage.getItem('vendor_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
vendorApi_base.interceptors.response.use(
  (r) => r.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('vendor_token');
      window.location.href = '/vendor/login';
    }
    return Promise.reject(error.response?.data || { message: '網路連線異常' });
  }
);
export const vendorApi = {
  login:        (username, password) => vendorApi_base.post('/login', { username, password }),
  me:           () => vendorApi_base.get('/me'),
  getCategories:() => vendorApi_base.get('/categories'),
  getBills:     (params = {}) => vendorApi_base.get('/bills', { params }),
  getBill:      (id) => vendorApi_base.get(`/bills/${id}`),
  createBill:   (data) => vendorApi_base.post('/bills', data),
  updateBill:   (id, data) => vendorApi_base.patch(`/bills/${id}`, data),
  submitBill:   (id) => vendorApi_base.post(`/bills/${id}/submit`),
};

// Checks API（支票紀錄系統 v2）
export const checksApi = {
  // 科目
  getSubjects:     ()              => api.get('/checks/subjects'),
  createSubject:   (name)          => api.post('/checks/subjects', { name }),
  updateSubject:   (id, data)      => api.patch(`/checks/subjects/${id}`, data),
  // 批次
  getBatches:      (params = {})   => api.get('/checks/batches', { params }),
  getBatch:        (id)            => api.get(`/checks/batches/${id}`),
  createBatch:     (data)          => api.post('/checks/batches', data),
  updateBatch:     (id, data)      => api.patch(`/checks/batches/${id}`, data),
  // 個別支票
  updateCheck:     (id, data)      => api.patch(`/checks/checks/${id}`, data),
  payCheck:        (id)            => api.post(`/checks/checks/${id}/pay`),
  voidCheck:       (id, reason)    => api.post(`/checks/checks/${id}/void`, { void_reason: reason }),
  bounceCheck:     (id)            => api.post(`/checks/checks/${id}/bounce`),
  // 出款清單
  getToday:        ()              => api.get('/checks/today'),
  getUpcoming:     (days = 7)      => api.get('/checks/upcoming', { params: { days } }),
  // 台灣假日
  refreshHolidays: (year)          => api.post('/checks/holidays/refresh', null, { params: { year } }),
  // 通知名單
  getTargets:      ()              => api.get('/checks/notify-targets'),
  createTarget:    (data)          => api.post('/checks/notify-targets', data),
  updateTarget:    (id, data)      => api.patch(`/checks/notify-targets/${id}`, data),
  deleteTarget:    (id)            => api.delete(`/checks/notify-targets/${id}`),
  testNotify:      ()              => api.post('/checks/notify-targets/test'),
  // Excel 匯入（timeout 拉長到 120s，大量寫入需要時間）
  importParse:     (formData)      => api.post('/checks/import/parse', formData, { timeout: 60000 }),
  importConfirm:   (data)          => api.post('/checks/import/confirm', data,    { timeout: 120000 }),
  // 刪除 / 清除 / 補付款
  deleteBatch:     (id)            => api.delete(`/checks/batches/${id}`),
  clearAll:        ()              => api.post('/checks/clear-all'),
  bulkPayPast:     ()              => api.post('/checks/bulk-pay-past'),
  // 科目合併
  mergeSubjects:   (keepId, mergeIds) => api.post('/checks/subjects/merge', { keep_id: keepId, merge_ids: mergeIds }),
};

// System API (系統用戶管理)
export const systemApi = {
  getEmployees:   (params = {}) => api.get('/system/employees', { params }),
  grantAccess:    (appNumber, role) => api.post('/system/grant', { app_number: appNumber, role }),
  updateUserRole: (id, role) => api.put(`/system/${id}/role`, { role }),
  revokeAccess:   (id) => api.put(`/system/${id}/revoke`),
};

export default api;
