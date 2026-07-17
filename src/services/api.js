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
      // 凡是 LIFF / webhook / 廠商後台這類「不需 SSO 登入」的端點，
      // 即便回 401 也不該把人踢去 /login（否則 LIFF 頁會被營運部 SSO 蓋掉）
      const isPublicApi =
        reqUrl.includes('/public/') ||
        reqUrl.includes('/appointed-units/bind/') ||
        reqUrl.includes('/appointed-units/config') ||
        reqUrl.includes('/appointed-units/line/') ||
        reqUrl.includes('/vendor/') ||
        reqUrl.includes('/sign/');
      // 同樣，目前在 LIFF 頁時不要強制跳 /login
      const onLiffPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/liff/');
      if (!isPublicApi && !onLiffPage) {
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
  me:    () => api.get('/auth/me'),
  sso:   (app_number) => api.get('/auth/sso', { params: { app_number } }),
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
  triggerLineUidSync: () => api.post('/personnel/sync-line-uid'),
  getLineUidSyncStatus: () => api.get('/personnel/sync-line-uid/status'),
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
  // 路奇天格鏡片帳單（chi-finance-system）— 同步等待回應版本（最多 60 秒）
  syncChiFinanceLens: (period) =>
    api.post('/billing/sync/chi-finance-lens/sync-now', { period }, { timeout: 60000 }),
  // 企劃部廣告費同步 — 同步等待回應版本 (debug 含 DB 寫入後實際筆數 + samples)
  syncAdBudgetDebug: (month) =>
    api.post('/billing/ad-sync-debug', {}, { params: { month }, timeout: 60000 }),
  // 暴力版同步：所有 error 都回 200 + body，不會被任何中間件吞掉
  syncAdBudgetV2: (month) =>
    api.post('/billing/ad-sync-v2', {}, { params: { month }, timeout: 60000 }),
  // 企劃部廣告費明細（同月份）
  getAdOrders: (month) =>
    api.get('/billing/ad-orders', { params: { month } }),
  // 環境變數檢查（給 ad budget 用，看 AD_BUDGET_API_URL 是否設定）
  envCheck: () => api.get('/billing/env-check'),
  // 純測試廣告費 API（不寫 DB）— 看廣告費後端是否能正常回應
  adApiDebug: (month) =>
    api.get('/billing/ad-debug', { params: { month }, timeout: 30000 }),
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

// 路奇廠商代號 ↔ 中文名對照（chi-finance）
export const chiVendorsApi = {
  list:   (params = {}) => api.get('/chi-vendors', { params }),
  create: (data)        => api.post('/chi-vendors', data),
  update: (code, data)  => api.patch(`/chi-vendors/${code}`, data),
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

  // ── 廠商前台 — 基本資料 / 銀行帳號 / 請款（S1）─────────────
  // 基本資料
  getProfile:        ()         => vendorApi_base.get('/profile'),
  updateProfile:     (body)     => vendorApi_base.patch('/profile', body),
  // 銀行帳號
  listBankAccounts:  ()         => vendorApi_base.get('/bank-accounts'),
  createBankAccount: (body)     => vendorApi_base.post('/bank-accounts', body),
  updateBankAccount: (id, body) => vendorApi_base.patch(`/bank-accounts/${id}`, body),
  deleteBankAccount: (id)       => vendorApi_base.delete(`/bank-accounts/${id}`),
  // 請款單
  listRequests:      (params = {})    => vendorApi_base.get('/requests', { params }),
  getRequest:        (id)             => vendorApi_base.get(`/requests/${id}`),
  createRequest:     (body)           => vendorApi_base.post('/requests', body),
  updateRequest:     (id, body)       => vendorApi_base.patch(`/requests/${id}`, body),
  deleteRequest:     (id)             => vendorApi_base.delete(`/requests/${id}`),
  submitRequest:     (id)             => vendorApi_base.post(`/requests/${id}/submit`),
  // 附件
  addFile:           (id, body)       => vendorApi_base.post(`/requests/${id}/files`, body),
  deleteFile:        (id)             => vendorApi_base.delete(`/files/${id}`),
};

// Checks API（支票紀錄系統 v2）
export const checksApi = {
  // 科目
  getSubjects:     ()              => api.get('/checks/subjects'),
  getSubjectsTree: ()              => api.get('/checks/subjects/tree'),
  createSubject:   (name, parentId) => api.post('/checks/subjects', { name, parent_id: parentId || null }),
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
  getMonth:        (month)         => api.get('/checks/month', { params: { month } }),
  // 元大批次匯款 Excel
  exportEltonBatch: (yearMonth, checkIds = []) =>
    api.post(
      `/checks/export-elton/${yearMonth}`,
      { checkIds },
      { responseType: 'blob' }
    ),
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
  // 續票提醒
  getRenewalReminders: ()   => api.get('/checks/renewal-reminders'),
  resolveRenewal:      (id) => api.patch(`/checks/batches/${id}`, { renewal_needed: false }),
};

// Dashboard API（各模組獨立端點，平行載入互不阻塞）
export const dashboardApi = {
  getSalesHighlight:        (month) => api.get('/dashboard/highlights/sales',       month ? { params: { month } } : {}),
  getTrainingHighlight:     (date)  => api.get('/dashboard/highlights/training',    date  ? { params: { date  } } : {}),
  getEngineeringHighlight:  (date)  => api.get('/dashboard/highlights/engineering', date  ? { params: { date  } } : {}),
  getAuditHighlight:        (date)  => api.get('/dashboard/highlights/audit',       date  ? { params: { date  } } : {}),
  getEvaluationHighlight:   ()      => api.get('/dashboard/highlights/evaluation'),
  getRecruitmentHighlight:  ()      => api.get('/dashboard/highlights/recruitment'),
};

// Recruitment API（人力招募模組）
export const recruitmentApi = {
  getNeeds:          (status)       => api.get('/recruitment/needs', status ? { params: { status } } : {}),
  createNeed:        (body)         => api.post('/recruitment/needs', body),
  updateNeed:        (id, body)     => api.patch(`/recruitment/needs/${id}`, body),

  getApplicants:     (params = {})  => api.get('/recruitment/applicants', { params }),
  getAllApplicants:  (params = {})  => api.get('/recruitment/applicants', { params: { ...params, all: 'true' } }),
  createApplicant:   (body)         => api.post('/recruitment/applicants', body),
  updateApplicant:   (id, body)     => api.patch(`/recruitment/applicants/${id}`, body),
  editApplicant:     (id, body)     => api.put(`/recruitment/applicants/${id}`, body),
  checkRejectionHistory: (name, phone) =>
    api.get('/recruitment/applicants/check-rejection-history', { params: { name, phone } }),
  deleteApplicant:   (id)           => api.delete(`/recruitment/applicants/${id}`),

  getInterviews:     (result)       => api.get('/recruitment/interviews', result ? { params: { result } } : {}),
  // 帶任意參數版（支援 month、result 等）
  getInterviewsByParams: (params = {}) => api.get('/recruitment/interviews', { params }),
  updateInterview:   (id, body)     => api.patch(`/recruitment/interviews/${id}`, body),
  uploadAudio:       (id, file)     => {
    const form = new FormData();
    form.append('audio', file);
    return api.post(`/recruitment/interviews/${id}/audio`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  sendSms:           (id, phone, onboarding_url) => api.post(`/recruitment/interviews/${id}/sms`, { phone, onboarding_url }),
};

// Sales Events API（業績系統活動模組）
export const salesEventsApi = {
  getCalendar:       (month)     => api.get('/sales-events/calendar', month ? { params: { month } } : {}),
  getExternalEvents: ()          => api.get('/sales-events/external-events'),
  getExternalEvent:  (id)        => api.get(`/sales-events/external-events/${id}`),
  createExternalEvent: (body)    => api.post('/sales-events/external-events', body),
  updateExternalEvent: (id, body)=> api.put(`/sales-events/external-events/${id}`, body),
  deleteExternalEvent: (id)      => api.delete(`/sales-events/external-events/${id}`),
  updatePromotionPush: (templateId, body) => api.patch(`/sales-events/promotion-push/${templateId}`, body),
  updateAdPush:        (campaignId, body) => api.patch(`/sales-events/ad-push/${campaignId}`, body),
};

// Push Groups API（推播群組管理）
export const pushGroupsApi = {
  // 員工清單（有 app_number 且在職，用於選擇成員）
  getEmployees: ()           => api.get('/push-groups/employees'),
  // 群組 CRUD
  getGroups:    ()           => api.get('/push-groups'),
  getGroup:     (id)         => api.get(`/push-groups/${id}`),
  createGroup:  (body)       => api.post('/push-groups', body),
  updateGroup:  (id, body)   => api.put(`/push-groups/${id}`, body),
  deleteGroup:  (id)         => api.delete(`/push-groups/${id}`),
  // 發送推播
  sendPush:     (body)       => api.post('/push-groups/send', body),
};

// Recurring Expenses API（常態費用模組）
export const operationalExpensesApi = {
  list:   (params = {})            => api.get('/operational-expenses', { params }),
  get:    (id)                     => api.get(`/operational-expenses/${id}`),
  create: (body)                   => api.post('/operational-expenses', body),
  update: (id, body)               => api.patch(`/operational-expenses/${id}`, body),
  remove: (id)                     => api.delete(`/operational-expenses/${id}`),
  replaceAllocations: (id, allocations) => api.put(`/operational-expenses/${id}/allocations`, { allocations }),
  listFactsByCategory: (categoryId) => api.get(`/operational-expenses/facts/${categoryId}`),
  detectAnomalies: (month)         => api.get('/operational-expenses/anomalies', { params: month ? { month } : {} }),
  getFactHistory:  (factId, months = 12) => api.get(`/operational-expenses/facts/${factId}/history`, { params: { months } }),
  getFactAllocatedMonths: (factId, excludeExpenseId = null) =>
    api.get(`/operational-expenses/facts/${factId}/allocated-months`, {
      params: excludeExpenseId ? { exclude_expense_id: excludeExpenseId } : {},
    }),
  getReport:       (params = {})   => api.get('/operational-expenses/report', { params }),
  exportReport:    (params = {})   => api.get('/operational-expenses/report/export', { params, responseType: 'blob' }),
};

export const recurringExpensesApi = {
  // 主檔
  list:    (active)    => api.get('/recurring-expenses', active != null ? { params: { active } } : {}),
  get:     (id)        => api.get(`/recurring-expenses/${id}`),
  create:  (body)      => api.post('/recurring-expenses', body),
  update:  (id, body)  => api.patch(`/recurring-expenses/${id}`, body),
  remove:  (id)        => api.delete(`/recurring-expenses/${id}`),
  // 應付紀錄
  listPayments:   (month) => api.get('/recurring-expenses/payments', month ? { params: { month } } : {}),
  getTodayDue:    ()      => api.get('/recurring-expenses/payments/today'),
  markPaid:       (id, paid_note) => api.post(`/recurring-expenses/payments/${id}/pay`,   { paid_note }),
  unmarkPaid:     (id)            => api.post(`/recurring-expenses/payments/${id}/unpay`),
  // 元大批次匯款 Excel
  exportEltonBatch: (yearMonth, paymentIds = []) =>
    api.post(
      `/recurring-expenses/export-elton/${yearMonth}`,
      { payment_ids: paymentIds },
      { responseType: 'blob' }
    ),
  // 開帳對象選項
  getStores:      () => api.get('/recurring-expenses/options/stores'),
  getDepartments: () => api.get('/recurring-expenses/options/departments'),
};

// 文件庫
export const docLibraryApi = {
  // type: 'vendor' / 'rent' / 'employee'
  listCategories: (type)                       => api.get(`/doc-library/${type}/categories`),
  listDocs:       (type, category)             => api.get(`/doc-library/${type}/docs`, { params: { category } }),
  upload:         (type, file, params)         => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/doc-library/${type}/upload`, fd, {
      params,
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
  },
  update:         (id, body)                   => api.patch(`/doc-library/${id}`, body),
  remove:         (id)                         => api.delete(`/doc-library/${id}`),
};

// 通用附件
export const filesApi = {
  // entity_type 例：'contract' / 'medical_doc'
  list:    (entity_type, entity_id) =>
    api.get('/files', { params: { entity_type, entity_id } }),
  upload:  (entity_type, entity_id, file, { category, note } = {}) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/files/upload`, fd, {
      params:  { entity_type, entity_id, category, note },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  remove:  (id) => api.delete(`/files/${id}`),
};

// 合約管理模組
export const contractsApi = {
  list:        (type, status)   => api.get('/contracts', { params: { type, status } }),
  get:         (id)             => api.get(`/contracts/${id}`),
  create:      (body)           => api.post('/contracts', body),
  update:      (id, body)       => api.patch(`/contracts/${id}`, body),
  remove:      (id)             => api.delete(`/contracts/${id}`),
  listExpiring:(days = 60)      => api.get('/contracts/expiring', { params: { days } }),
  // 歷史
  listHistory:     (id, limit = 200) => api.get(`/contracts/${id}/history`, { params: { limit } }),
  // 提醒
  listReminders:   (id)              => api.get(`/contracts/${id}/reminders`),
  upsertReminders: (id, reminders)   => api.put(`/contracts/${id}/reminders`, { reminders }),
  // PDF 自動讀取（multipart）
  parsePdf:        (file, type)      => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/contracts/parse-pdf?type=${encodeURIComponent(type)}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,   // 2 分鐘超時，Render 冷啟動 + Gemini 處理大 PDF 需要時間
    });
  },
};

// 系統更新模組（展示開發績效）
export const systemUpdatesApi = {
  listMembers:    ()                       => api.get('/system-updates/members'),
  listMonths:     ()                       => api.get('/system-updates/months'),
  getDaily:       (memberId, params)       => api.get(`/system-updates/members/${memberId}/daily`,   { params }),
  getMonthly:     (memberId, yearMonth)    => api.get(`/system-updates/members/${memberId}/monthly`, { params: { ym: yearMonth } }),
  aiSummarize:    (memberId, params)       => api.get(`/system-updates/members/${memberId}/ai-summarize`, { params, timeout: 120000 }),  // 2 分鐘超時
};

// Quests API（任務派發 → 市場部）
// 對應 market-backend internal API:
//   POST /api/internal/quest/create   建立任務
//   GET  /api/internal/quest/groups   列出 employee_groups（給 dropdown）
//   GET  /api/internal/quest/list     列出市場部任務（debug 用，目前 UI 沒接）
// x-internal-key 驗證在後端 routes/quests.js 統一處理。
export const questsApi = {
  // ── 派發 ─────────────────────────────────────────────
  list:        (params = {})           => api.get('/quests', { params }),
  get:         (id)                    => api.get(`/quests/${id}`),
  create:      (body)                  => api.post('/quests', body),
  resend:      (id)                    => api.post(`/quests/${id}/resend`),
  // 取得市場部 employee_groups 給 dropdown
  // 可選 include_members=1 讓後端把成員清單一起帶回
  getGroups:   (includeMembers = false) =>
    api.get('/quests/groups', includeMembers ? { params: { include_members: 1 } } : {}),

  // ── 審核（reviewer 由後端從登入者自動帶）─────────────
  listPending:    ()                 => api.get('/quests/submissions/pending'),
  listReviewed:   (limit = 50)       => api.get('/quests/submissions/reviewed', { params: { limit } }),
  approve:        (submissionId)     => api.post(`/quests/submissions/${submissionId}/approve`),
  reject:         (submissionId, reason) => api.post(`/quests/submissions/${submissionId}/reject`, { reason }),
  rejectResubmit: (submissionId, reason) => api.post(`/quests/submissions/${submissionId}/reject-resubmit`, { reason }),
};

// Processes API（各類流程）
// admin（需登入）+ public（QR 掃描後）
export const processesApi = {
  // 模板
  listTemplates:   (store_erpid)      => api.get('/processes/templates', store_erpid ? { params: { store_erpid } } : {}),
  getTemplate:     (id)               => api.get(`/processes/templates/${id}`),
  createTemplate:  (body)             => api.post('/processes/templates', body),
  updateTemplate:  (id, body)         => api.patch(`/processes/templates/${id}`, body),
  deleteTemplate:  (id)               => api.delete(`/processes/templates/${id}`),
  // 交接
  listHandovers:   (params = {})      => api.get('/processes/handovers', { params }),
  getHandover:     (id)               => api.get(`/processes/handovers/${id}`),
  createHandover:  (body)             => api.post('/processes/handovers', body),
  cancelHandover:  (id, reason)       => api.post(`/processes/handovers/${id}/cancel`, { reason }),
  // 選項
  listStores:      ()                 => api.get('/processes/options/stores'),
};

// Processes Public API（公開填寫頁用，不會自動帶 token）
// 特意走 fetch 而非 axios 實例：避免 401 自動踢出 + 不帶登入 token
const publicBase = (typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? '/api/processes/public'
  : (import.meta.env.VITE_API_URL || 'https://operation-backend.onrender.com/api') + '/processes/public';

async function publicReq(method, path, body, isMultipart) {
  const opts = { method, headers: {} };
  if (body && !isMultipart) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (isMultipart) {
    opts.body = body;
  }
  const res = await fetch(`${publicBase}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export const handoverPublicApi = {
  get:           (id)                       => publicReq('GET',  `/handovers/${id}`),
  identify:      (id, body)                 => publicReq('POST', `/handovers/${id}/identify`, body),
  submitOriginal:(id, body)                 => publicReq('POST', `/handovers/${id}/submit-original`, body),
  submitNew:     (id, body)                 => publicReq('POST', `/handovers/${id}/submit-new`, body),
  submitThird:   (id, body)                 => publicReq('POST', `/handovers/${id}/submit-third`, body),
  uploadPhoto:   (id, fileBlob, fileName)   => {
    const fd = new FormData();
    fd.append('photo', fileBlob, fileName || 'photo.jpg');
    return publicReq('POST', `/handovers/${id}/upload-photo`, fd, true);
  },
};

// System API (系統用戶管理)
export const systemApi = {
  getEmployees:   (params = {}) => api.get('/system/employees', { params }),
  grantAccess:    (appNumber, role) => api.post('/system/grant', { app_number: appNumber, role }),
  updateUserRole: (id, role) => api.put(`/system/${id}/role`, { role }),
  revokeAccess:   (id) => api.put(`/system/${id}/revoke`),
};

// 特約廠商模組（管理後台 — 需 SSO 登入）
export const appointedUnitsApi = {
  listUnits:        (params = {}) => api.get('/appointed-units/units', { params }),
  getUnit:          (code)        => api.get(`/appointed-units/units/${code}`),
  listMembers:      (code, params = {}) => api.get(`/appointed-units/units/${code}/members`, { params }),
  syncUnitMembers:  (code)        => api.post(`/appointed-units/units/${code}/sync-members`),
  createBindCode:   (code, body)  => api.post(`/appointed-units/units/${code}/bind-codes`, body),
  listBindCodes:    (code)        => api.get(`/appointed-units/units/${code}/bind-codes`),
  revokeBindCode:   (id)          => api.delete(`/appointed-units/bind-codes/${id}`),

  listBindings:     (params = {}) => api.get('/appointed-units/bindings', { params }),
  forceUnbind:      (id)          => api.delete(`/appointed-units/bindings/${id}`),

  // 綁定報表
  bindingReport:    (params = {}) => api.get('/appointed-units/binding-report', { params }),

  createBroadcast:  (body)        => api.post('/appointed-units/broadcasts', body),
  listBroadcasts:   (params = {}) => api.get('/appointed-units/broadcasts', { params }),
  getBroadcast:     (id)          => api.get(`/appointed-units/broadcasts/${id}`),

  syncAllUnits:     ()            => api.post('/appointed-units/sync/units'),
  syncAllMembers:   ()            => api.post('/appointed-units/sync/members'),
  enrichCategories: (body = {})   => api.post('/appointed-units/sync/enrich-categories', body),
  syncStatus:       ()            => api.get('/appointed-units/sync/status'),

  getConfig:        ()            => api.get('/appointed-units/config'),
};

// LIFF 公開 API（不需 SSO Token；axios 攔截器即使帶 Token 不影響）
export const appointedUnitsPublicApi = {
  bindStatus:   (line_user_id)        => api.post('/appointed-units/bind/status', { line_user_id }),
  bindEmployee: (body)                => api.post('/appointed-units/bind/employee', body),
  bindAdmin:    (body)                => api.post('/appointed-units/bind/admin', body),
  unbind:       (line_user_id, reason) => api.post('/appointed-units/bind/unbind', { line_user_id, reason }),
  lookupCode:   (keyword)             => api.post('/appointed-units/bind/lookup-code', { keyword }),
  // 介紹門市 / 介紹人下拉用
  getIntroducerStores: ()             => api.get('/appointed-units/bind/introducer-stores'),
  getIntroducerStaff:  (store_erpid)  => api.get('/appointed-units/bind/introducer-staff', { params: { store_erpid } }),
};

// 分數兌換模組（管理後台 — 需 SSO 登入）
export const pointRedemptionApi = {
  listItems:       ()            => api.get('/point-redemption/items'),
  createItem:      (body)        => api.post('/point-redemption/items', body),
  updateItem:      (id, body)    => api.put(`/point-redemption/items/${id}`, body),
  deleteItem:      (id)          => api.delete(`/point-redemption/items/${id}`),
  listRedemptions: (params = {}) => api.get('/point-redemption/redemptions', { params }),
  approve:         (id)          => api.post(`/point-redemption/redemptions/${id}/approve`),
  reject:          (id, reason)  => api.post(`/point-redemption/redemptions/${id}/reject`, { reason }),
  fulfill:         (id)          => api.post(`/point-redemption/redemptions/${id}/fulfill`),
  getBalance:      (erpid)       => api.get(`/point-redemption/balance/${erpid}`),
};

// 分數加分申請（與兌換相對的方向）— 管理端 + 公開端
export const scoreApplicationApi = {
  // 類型 CRUD
  listTypes:      ()             => api.get('/score-application/types'),
  createType:     (body)         => api.post('/score-application/types', body),
  updateType:     (id, body)     => api.put(`/score-application/types/${id}`, body),
  deleteType:     (id)           => api.delete(`/score-application/types/${id}`),
  // 審核
  listApplications: (params = {}) => api.get('/score-application/applications', { params }),
  approve:        (id, score)    => api.post(`/score-application/applications/${id}/approve`, { score }),
  reject:         (id, reason)   => api.post(`/score-application/applications/${id}/reject`, { reason }),
};

// 分數加分申請 — 員工自助（公開，用 app_number 驗證）
// 走 fetch 避開 axios 401 攔截器自動 logout
const scoreApplyPublicBase = (typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? '/api/score-application/public'
  : (import.meta.env.VITE_API_URL || 'https://operation-backend.onrender.com/api') + '/score-application/public';

async function scoreApplyPublicReq(method, path, body, isMultipart) {
  const opts = { method, headers: {} };
  if (body && !isMultipart) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (isMultipart) {
    opts.body = body;
  }
  const res  = await fetch(`${scoreApplyPublicBase}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

export const scoreApplicationPublicApi = {
  listTypes:   ()                    => scoreApplyPublicReq('GET',  '/types'),
  myList:      (app_number)          => scoreApplyPublicReq('GET',  `/applications?app_number=${encodeURIComponent(app_number)}`),
  submit:      (body)                => scoreApplyPublicReq('POST', '/applications', body),
  uploadAttachment: (fileBlob, fileName) => {
    const fd = new FormData();
    fd.append('file', fileBlob, fileName || 'file');
    return scoreApplyPublicReq('POST', '/applications/upload-attachment', fd, true);
  },
};

// 分數兌換模組（員工自助公開入口 — 不需登入，用 app_number 驗證）
export const pointRedemptionPublicApi = {
  verify:        (app_number)          => api.get('/point-redemption/public/verify', { params: { app_number } }),
  catalog:       ()                    => api.get('/point-redemption/public/catalog'),
  balance:       (app_number)          => api.get('/point-redemption/public/balance', { params: { app_number } }),
  scoreDetail:   (app_number)          => api.get('/point-redemption/public/score-detail', { params: { app_number } }),
  redeem:        (app_number, item_id, quantity = 1) => api.post('/point-redemption/public/redeem', { app_number, item_id, quantity }),
  myRedemptions: (app_number)          => api.get('/point-redemption/public/redemptions', { params: { app_number } }),
};

// 基本資料模組（電費 / 電話 / 房租 / 自訂 — 含 audit log + LINE 推播）
export const basicDataApi = {
  // 選項
  getStores:        ()            => api.get('/basic-data/options/stores'),
  createStore:      (body)        => api.post('/basic-data/options/stores', body),
  deleteStore:      (erpid)       => api.delete(`/basic-data/options/stores/${encodeURIComponent(erpid)}`),
  getSystemUsers:   ()            => api.get('/basic-data/options/system-users'),
  // 分類
  listCategories:   ()            => api.get('/basic-data/categories'),
  createCategory:   (body)        => api.post('/basic-data/categories', body),
  updateCategory:   (id, body)    => api.patch(`/basic-data/categories/${id}`, body),
  deleteCategory:   (id)          => api.delete(`/basic-data/categories/${id}`),
  // 欄位
  listFields:       (categoryId)         => api.get(`/basic-data/categories/${categoryId}/fields`),
  createField:      (categoryId, body)   => api.post(`/basic-data/categories/${categoryId}/fields`, body),
  updateField:      (id, body)           => api.patch(`/basic-data/fields/${id}`, body),
  deleteField:      (id)                 => api.delete(`/basic-data/fields/${id}`),
  // 資料
  listFacts:        (params = {})        => api.get('/basic-data/facts', { params }),
  createFact:       (body)               => api.post('/basic-data/facts', body),
  updateFact:       (id, body)           => api.patch(`/basic-data/facts/${id}`, body),
  deleteFact:       (id)                 => api.delete(`/basic-data/facts/${id}`),
  // 歷史紀錄
  listHistory:      (params = {})        => api.get('/basic-data/history', { params }),
  // 推播訂閱
  listSubscribers:  ()                   => api.get('/basic-data/subscribers'),
  upsertSubscriber: (body)               => api.post('/basic-data/subscribers', body),
  deleteSubscriber: (id)                 => api.delete(`/basic-data/subscribers/${id}`),
};

// 排程推播模組（自訂排程 + 變數展開 + 個人/角色群收件人）
export const scheduledNotifyApi = {
  // 輔助
  getSystemUsers: () => api.get('/scheduled-notify/options/system-users'),
  getRoles:       () => api.get('/scheduled-notify/options/roles'),
  getVariables:   () => api.get('/scheduled-notify/options/variables'),
  preview:        (body) => api.post('/scheduled-notify/preview', body),
  // CRUD
  list:    ()           => api.get('/scheduled-notify'),
  get:     (id)         => api.get(`/scheduled-notify/${id}`),
  create:  (body)       => api.post('/scheduled-notify', body),
  update:  (id, body)   => api.patch(`/scheduled-notify/${id}`, body),
  remove:  (id)         => api.delete(`/scheduled-notify/${id}`),
  // 立即執行
  runNow:  (id)         => api.post(`/scheduled-notify/${id}/run-now`),
  // 歷史紀錄
  listLogs:    (id)     => api.get(`/scheduled-notify/${id}/logs`),
  listAllLogs: ()       => api.get('/scheduled-notify/logs/all'),
};

// 廠商請款（系統人員端）
export const vendorPaymentApi = {
  // 公司付款方資料
  getCompanyProfile:    ()           => api.get('/vendor-payment/company-profile'),
  upsertCompanyProfile: (body)       => api.put('/vendor-payment/company-profile', body),
  // 銀行帳號
  listBankAccounts:     (sourceId)            => api.get(`/vendor-payment/sources/${sourceId}/bank-accounts`),
  createBankAccount:    (sourceId, body)      => api.post(`/vendor-payment/sources/${sourceId}/bank-accounts`, body),
  updateBankAccount:    (id, body)            => api.patch(`/vendor-payment/bank-accounts/${id}`, body),
  deleteBankAccount:    (id)                  => api.delete(`/vendor-payment/bank-accounts/${id}`),
  // 請款單
  listRequests:         (params = {})         => api.get('/vendor-payment/requests', { params }),
  getRequest:           (id)                  => api.get(`/vendor-payment/requests/${id}`),
  createRequest:        (body)                => api.post('/vendor-payment/requests', body),
  updateRequest:        (id, body)            => api.patch(`/vendor-payment/requests/${id}`, body),
  deleteRequest:        (id)                  => api.delete(`/vendor-payment/requests/${id}`),
  submitRequest:        (id)                  => api.post(`/vendor-payment/requests/${id}/submit`),
  approveRequest:       (id)                  => api.post(`/vendor-payment/requests/${id}/approve`),
  rejectRequest:        (id, reason)          => api.post(`/vendor-payment/requests/${id}/reject`, { reason }),
  markPaid:             (id)                  => api.post(`/vendor-payment/requests/${id}/mark-paid`),
  // 附件
  addFile:              (id, body)            => api.post(`/vendor-payment/requests/${id}/files`, body),
  deleteFile:           (id)                  => api.delete(`/vendor-payment/files/${id}`),
  // 發票
  addInvoice:           (id, body)            => api.post(`/vendor-payment/requests/${id}/invoices`, body),
  updateInvoice:        (id, body)            => api.patch(`/vendor-payment/invoices/${id}`, body),
  deleteInvoice:        (id)                  => api.delete(`/vendor-payment/invoices/${id}`),
};

// 匯款批次（S2：元大格式 + 進項發票）
export const paymentBatchApi = {
  // 批次
  listBatches:    (params = {})  => api.get('/payment-batch/batches', { params }),
  getBatch:       (id)           => api.get(`/payment-batch/batches/${id}`),
  createBatch:    (body)         => api.post('/payment-batch/batches', body),
  cancelBatch:    (id, reason)   => api.post(`/payment-batch/batches/${id}/cancel`, { reason }),
  markPaid:       (id)           => api.post(`/payment-batch/batches/${id}/mark-paid`),
  // 可加入批次的請款
  listEligible:   (params = {})  => api.get('/payment-batch/eligible-requests', { params }),
  // 匯出 url（直接給 a tag 下載，需含 token 在 header → 用 fetch 包）
  exportBatchUrl: (id)           => `/payment-batch/batches/${id}/export`,
  exportInputInvoiceUrl: (period) => `/payment-batch/input-invoices/export?period=${period}`,
  // 進項發票
  listInputInvoices: (period)    => api.get('/payment-batch/input-invoices', { params: { period } }),
  listExportLog:     ()          => api.get('/payment-batch/input-invoices/export-log'),
};

// 分權系統（角色 / 模組 / 權限設定）
export const permissionsApi = {
  getMyModules:    () => api.get('/permissions/my-modules'),
  listRoles:       () => api.get('/permissions/roles'),
  listModules:     () => api.get('/permissions/modules'),
  listPermissions: () => api.get('/permissions/permissions'),
  setPermission:   (body)  => api.put('/permissions/permission', body),
  setBulk:         (items) => api.put('/permissions/permissions/bulk', { items }),
};

export default api;
