// pages/vendor/VendorContractsPage.jsx — 廠商前台「我的合約」（2026-10-20）
// 樂活在合約管理裡把合約對應到這家廠商、且勾「廠商看得到」才會出現；檔案是 1 小時有效的連結
import { useEffect, useState } from 'react';
import { vendorApi } from '../../services/api';
import HelpTip from '../../components/help/HelpTip';

const C = { dark: '#50422d', border: '#e0d5c8', bg: '#f5f0ea', textMid: '#6b5640', textLight: '#9a8878' };
const fmt = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString());

export default function VendorContractsPage() {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { vendorApi.contracts().then((r) => setList(r?.data || [])).catch((e) => setErr(e.message || '讀取失敗')); }, []);
  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 22, color: C.dark, marginBottom: 4 }}>📄 我的合約<HelpTip title="我的合約" body={'這裡列出樂活與貴公司簽的合約（樂活設定成「廠商看得到」的）。\n點檔案名稱可以下載，連結 1 小時內有效，過期重新整理頁面即可。\n合約內容有疑問請聯絡樂活營運部。'} /></h1>
      <p style={{ marginTop: 0, color: C.textLight, fontSize: 13 }}>與樂活簽訂的合約。有疑問請聯絡樂活營運部。</p>
      {err && <div style={{ color: '#c53030' }}>{err}</div>}
      {!list && !err && <div style={{ color: C.textLight }}>載入中…</div>}
      {list && list.length === 0 && <div style={{ color: C.textLight }}>目前沒有合約。</div>}
      {(list || []).map((c) => (
        <div key={c.id} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{c.name}</div>
          <div style={{ fontSize: 13, color: C.textMid, marginTop: 4 }}>
            期間 {c.start_date || '—'} ～ {c.end_date || '—'}{c.signed_date ? `｜簽約 ${c.signed_date}` : ''}{c.total_amount ? `｜金額 ${fmt(c.total_amount)}` : ''}
          </div>
          {Array.isArray(c.benefits) && c.benefits.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <b>年度回饋</b>
              {c.benefits.map((b, i) => <div key={i}>・{b.threshold != null ? `達 ${fmt(b.threshold)}` : ''} {b.reward || b.rate || b.description || JSON.stringify(b)}</div>)}
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {c.files.length === 0 && <span style={{ fontSize: 12, color: C.textLight }}>沒有附檔</span>}
            {c.files.map((f) => f.url
              ? <a key={f.id} href={f.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#3182ce' }}>📎 {f.name}</a>
              : <span key={f.id} style={{ fontSize: 13 }}>📎 {f.name}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}
