// pages/companyProfile/CompanyProfilePage.jsx
// 公司付款方資料 — 給「產生本月元大匯款 Excel」用
//   只有 1 筆設定，欄位對應元大網銀批次匯款檔的主檔列

import { useEffect, useState } from 'react';
import { vendorPaymentApi } from '../../services/api';

const C = { primary: '#50422d', gold: '#8b6f4e', sand: '#cdbea2', bg: '#faf8f5', border: '#e8e3dc' };

const S = {
  page:    { padding: '24px 28px', maxWidth: 800, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif', color: C.primary },
  header:  { marginBottom: 18 },
  title:   { fontSize: 22, fontWeight: 700, color: C.primary, margin: 0 },
  subtitle:{ fontSize: 13, color: '#777', marginTop: 6 },

  card:    { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginTop: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  section: { fontSize: 14, fontWeight: 700, color: C.primary, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${C.border}` },
  formRow: { marginBottom: 14 },
  row2:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 },
  label:   { fontSize: 12, color: '#666', fontWeight: 600, marginBottom: 5, display: 'block' },
  hint:    { fontSize: 11, color: '#aaa', marginTop: 3 },
  input:   { padding: '8px 10px', border: `1px solid #ddd`, borderRadius: 6, fontSize: 13, color: C.primary, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },

  actions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 },
  btnPrimary: { padding: '8px 20px', background: C.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnGhost:   { padding: '8px 16px', background: '#fff', color: C.primary, border: `1px solid ${C.sand}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 },

  banner:  { padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 },
  err:     { background: '#fce4ec', color: '#c62828' },
  ok:      { background: '#e8f5e9', color: '#2e7d32' },
};

const OVERDUE_OPTS = [
  { value: '1', label: '1 - 隔日交易（推薦）' },
  { value: '2', label: '2 - 取消交易' },
];
const FEE_OPTS = [
  { value: '15', label: '15 - 付款方負擔（推薦）' },
  { value: '25', label: '25 - 收款方負擔' },
];
const NOTIFY_OPTS = [
  { value: '0', label: '0 - 不通知' },
  { value: '1', label: '1 - 通知收款方' },
];

export default function CompanyProfilePage() {
  const [data, setData] = useState({
    company_name: '', tax_id: '',
    payer_account_name: '', payer_account_no: '',
    payer_bank_code: '', payer_branch_code: '',
    default_overdue_code: '1', default_fee_burden: '15', default_notify_method: '0',
    gemini_api_key: '',
    binding_report_api_key: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');
  const [ok,      setOk]      = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await vendorPaymentApi.getCompanyProfile();
      if (r?.data) setData(d => ({ ...d, ...r.data }));
    } catch (e) { setErr(e?.message || '載入失敗'); }
    finally     { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function update(k, v) { setData(d => ({ ...d, [k]: v })); setOk(''); setErr(''); }

  async function save() {
    setErr(''); setOk('');
    if (!data.company_name?.trim()) return setErr('公司名稱必填');
    if (!data.payer_account_name?.trim()) return setErr('付款戶名必填（會出現在元大匯款主檔列）');
    if (!data.payer_account_no?.trim())   return setErr('付款帳號必填');
    if (!/^\d{3}$/.test(data.payer_bank_code  || ''))  return setErr('總行代號需為 3 碼數字');
    if (!/^\d{4}$/.test(data.payer_branch_code || '')) return setErr('分行代號需為 4 碼數字');

    setSaving(true);
    try {
      await vendorPaymentApi.upsertCompanyProfile(data);
      setOk('已儲存');
      await load();
    } catch (e) { setErr(e?.message || '儲存失敗'); }
    finally     { setSaving(false); }
  }

  if (loading) return <div style={S.page}>載入中...</div>;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>⚙ 公司資料</h1>
        <div style={S.subtitle}>
          作為元大網銀批次匯款檔的「付款方」資料（系統只 1 筆，給「產生本月元大匯款 Excel」使用）
        </div>
      </div>

      {err && <div style={{ ...S.banner, ...S.err }}>❗ {err}</div>}
      {ok  && <div style={{ ...S.banner, ...S.ok  }}>✅ {ok}</div>}

      <div style={S.card}>
        <div style={S.section}>公司基本資料</div>

        <div style={S.formRow}>
          <label style={S.label}>公司名稱 *</label>
          <input style={S.input} value={data.company_name || ''}
                 onChange={e => update('company_name', e.target.value)}
                 placeholder="例：樂活光學" />
        </div>
        <div style={S.formRow}>
          <label style={S.label}>統一編號</label>
          <input style={S.input} value={data.tax_id || ''}
                 onChange={e => update('tax_id', e.target.value)}
                 placeholder="例：12345678" />
        </div>
      </div>

      <div style={S.card}>
        <div style={S.section}>付款帳戶（元大網銀）</div>

        <div style={S.row2}>
          <div>
            <label style={S.label}>付款戶名 *</label>
            <input style={S.input} value={data.payer_account_name || ''}
                   onChange={e => update('payer_account_name', e.target.value)}
                   placeholder="例：黃信儒" />
          </div>
          <div>
            <label style={S.label}>付款帳號 *</label>
            <input style={S.input} value={data.payer_account_no || ''}
                   onChange={e => update('payer_account_no', e.target.value.replace(/\s/g, ''))}
                   placeholder="例：21102000344321" />
          </div>
        </div>

        <div style={S.row2}>
          <div>
            <label style={S.label}>付款總行（3 碼）*</label>
            <input style={S.input} value={data.payer_bank_code || ''}
                   onChange={e => update('payer_bank_code', e.target.value.replace(/\D/g, '').slice(0, 3))}
                   placeholder="806" maxLength={3} />
            <div style={S.hint}>元大銀行 = 806</div>
          </div>
          <div>
            <label style={S.label}>付款分行（4 碼）*</label>
            <input style={S.input} value={data.payer_branch_code || ''}
                   onChange={e => update('payer_branch_code', e.target.value.replace(/\D/g, '').slice(0, 4))}
                   placeholder="1102" maxLength={4} />
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.section}>匯款預設值</div>
        <div style={S.row2}>
          <div>
            <label style={S.label}>逾時處理指示</label>
            <select style={S.input} value={data.default_overdue_code || '1'}
                    onChange={e => update('default_overdue_code', e.target.value)}>
              {OVERDUE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>手續費負擔別</label>
            <select style={S.input} value={data.default_fee_burden || '15'}
                    onChange={e => update('default_fee_burden', e.target.value)}>
              {FEE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div style={S.formRow}>
          <label style={S.label}>通知方式</label>
          <select style={S.input} value={data.default_notify_method || '0'}
                  onChange={e => update('default_notify_method', e.target.value)}>
            {NOTIFY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.section}>外部 API 設定</div>

        <div style={S.formRow}>
          <label style={S.label}>Gemini API Key（合約 PDF 自動讀取用）</label>
          <input
            style={S.input}
            value={data.gemini_api_key || ''}
            onChange={e => update('gemini_api_key', e.target.value)}
            placeholder="AQ.Ab8RN6J... 或 AIza... 開頭"
            type="password"
          />
          <div style={S.hint}>
            到 https://aistudio.google.com/apikey 申請（免費）。
            設了之後在「📜 合約管理 → 新增房租合約」可以直接上傳 PDF 自動填表。
          </div>
        </div>

        <div style={S.formRow}>
          <label style={S.label}>特約廠商綁定報表 API Key（給其他部門對接用）</label>
          <input
            style={S.input}
            value={data.binding_report_api_key || ''}
            onChange={e => update('binding_report_api_key', e.target.value)}
            placeholder="自訂任意長字串（建議 32 字以上）"
            type="password"
          />
          <div style={S.hint}>
            其他部門呼叫綁定報表 API 時要帶這把 key。
            把 key 給對方並附上 API 文件，他們就能透過 https://operation-backend.onrender.com/api/external/appointed-units/binding-report 查資料。
          </div>
        </div>
      </div>

      <div style={S.actions}>
        <button style={S.btnGhost}   onClick={load} disabled={saving || loading}>重新載入</button>
        <button style={S.btnPrimary} onClick={save} disabled={saving}>{saving ? '儲存中...' : '💾 儲存'}</button>
      </div>
    </div>
  );
}
