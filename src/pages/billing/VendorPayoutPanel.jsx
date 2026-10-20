// pages/billing/VendorPayoutPanel.jsx —— 廠商出款（2026-10-20）
// 會計分配好、通過的請款 → 排「出款日期＋出款銀行」（PayoutScheduler，在請款詳情裡）
// → 當天在這裡列出（含之前排了還沒出的）→ 依出款銀行匯出元大網銀 Excel → 銀行付完勾選按「已出款」（自動產生帳單進門市月報）
// 每天 10:00 LINE 提醒支票通知對象（後端 jobs/vendorPayoutNotify）。
import React, { useCallback, useEffect, useState } from 'react';
import { vendorPaymentApi } from '../../services/api';
import HelpTip from '../../components/help/HelpTip';
import { useCoachMarks } from '../../components/help/CoachMarks';

const money = (n) => 'NT$' + Math.round(Number(n) || 0).toLocaleString('en-US');
const twToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
const btn = { border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600 };
const primary = { ...btn, background: '#50422d', color: '#fff' };
const ghost = { ...btn, background: '#edf2f7', color: '#4a5568' };
const input = { border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', fontSize: 13 };
const card = { background: '#fff', border: '1px solid #e0d5c8', borderRadius: 10, padding: 14 };

async function errText(e) {
  try { if (e instanceof Blob) { const j = JSON.parse(await e.text()); return j.message || '失敗'; } } catch { /* ignore */ }
  return (e && e.message) || '失敗';
}

const HELP = {
  schedule: '請款「通過」、門市分配調好後，選哪一天出款、用公司哪個銀行帳戶付。\n到那天系統 10:00 會 LINE 提醒（跟支票同一批通知對象），並列在「帳單管理 → 💸 廠商出款」。\n分配合計跟請款金額不一樣不能排，先把分配調好。要改日期直接重設；按「取消排程」就回到沒排的狀態。',
  today: '列出出款日是這一天的，以及之前排了但還沒按「已出款」的（標「逾期」）。\n依出款銀行分組，一個帳戶匯出一個元大檔。',
  payee: '廠商收款帳號從哪裡來：①請款上指定的帳號 ②外部系統（市場部工務師等）帶來的帳號 ③廠商自己在廠商入口「我的資料」設的預設帳號。\n都沒有或格式不對（總行不是 3 碼、沒戶名）的不會放進匯出檔，請先到「廠商帳號管理」幫廠商補，或請廠商自己在廠商入口設定。',
  export: '下載元大網銀「整批付款」Excel（V20130123 版，跟以前範本一樣），到元大企業網銀上傳。\n付款日期＝這一天；逾期的也一起用這天付。匯出不會改狀態，可以重匯。',
  paid: '銀行確認付款成功後，勾選那幾筆按「已出款」。\n這一步等於「標記已撥款」：會依門市分配自動產生帳單、進門市月報（列入哪個月看付款日與每月截止日）。',
  banks: '公司付款用的銀行帳戶。目前匯出格式只有元大。\n只有會計、主管能新增或修改；停用的帳戶不能再被選，但舊的排程照樣顯示。',
};

const TOUR = [
  { sel: '[data-tour="po-date"]', title: '選日期', body: '預設今天。今天以前排了但還沒出款的也會列出來（標逾期）。' },
  { sel: '[data-tour="po-groups"]', title: '依出款銀行分組', body: '每個公司帳戶一組，各自匯出一個元大檔。' },
  { sel: '[data-tour="po-export"]', title: '匯出元大 Excel', body: '下載後到元大企業網銀「整批付款」上傳。收款帳號有問題的不會放進檔案，表格裡會標紅。' },
  { sel: '[data-tour="po-paid"]', title: '銀行付完按已出款', body: '勾選付成功的那幾筆 → 已出款。系統會照門市分配產生帳單、進門市月報。' },
  { sel: '[data-tour="po-unscheduled"]', title: '還沒排出款日的', body: '已通過但還沒選出款日的請款，點「排程」打開請款詳情設定日期與銀行。' },
  { sel: '[data-tour="po-banks"]', title: '公司出款帳戶', body: '設定公司付款用的帳戶（目前元大）。' },
];

// ── 請款詳情裡的「排出款」區塊 ─────────────────────────────
export function PayoutScheduler({ data, onSaved }) {
  const [banks, setBanks] = useState([]);
  const [date, setDate] = useState(data.payout_date || '');
  const [bankId, setBankId] = useState(data.payout_bank_id || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    vendorPaymentApi.payoutBanks().then(r => {
      const list = r?.data || [];
      setBanks(list);
      if (!data.payout_bank_id) { const d = list.find(b => b.is_default) || list[0]; if (d) setBankId(d.id); }
    }).catch(() => {});
  }, [data.payout_bank_id]);
  if (data.status !== 'approved' && !data.payout_date) return null;
  const editable = data.status === 'approved';
  async function save(clear) {
    setBusy(true); setMsg('');
    try {
      await vendorPaymentApi.setPayout(data.id, clear ? { payout_date: null } : { payout_date: date, payout_bank_id: bankId });
      setMsg(clear ? '已取消排程' : '已排好，當天 10:00 會提醒');
      onSaved && onSaved();
    } catch (e) { setMsg('⚠ ' + (await errText(e))); }
    finally { setBusy(false); }
  }
  const bankLabel = (banks.find(b => b.id === data.payout_bank_id) || {}).label;
  return (
    <div style={{ padding: 10, border: '1px solid #b7e4c7', background: '#f0fff4', borderRadius: 6 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#2d6a4f', marginBottom: 6 }}>
        💸 排出款<HelpTip title="排出款" body={HELP.schedule} />
        {data.payout_date && <span style={{ fontWeight: 400, color: '#4a5568', marginLeft: 8 }}>目前：{data.payout_date}・{bankLabel || '（銀行已停用）'}{data.payout_exported_at ? '・已匯出過' : ''}</span>}
      </div>
      {editable && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12 }}>出款日期 <input type="date" min={twToday()} value={date} onChange={e => setDate(e.target.value)} style={input} /></label>
          <label style={{ fontSize: 12 }}>出款銀行{' '}
            <select value={bankId} onChange={e => setBankId(e.target.value)} style={input}>
              <option value="">請選</option>
              {banks.map(b => <option key={b.id} value={b.id}>{b.label}（{b.bank_code}・尾 {String(b.account_no).slice(-4)}）</option>)}
            </select>
          </label>
          <button style={primary} disabled={busy || !date || !bankId} onClick={() => save(false)}>{data.payout_date ? '改排程' : '排定'}</button>
          {data.payout_date && <button style={ghost} disabled={busy} onClick={() => save(true)}>取消排程</button>}
          {!banks.length && <span style={{ fontSize: 12, color: '#c53030' }}>還沒有公司出款帳戶，請到「💸 廠商出款 → 公司出款帳戶」新增</span>}
        </div>
      )}
      {msg && <div style={{ fontSize: 12, marginTop: 6, color: msg.startsWith('⚠') ? '#c53030' : '#2d6a4f' }}>{msg}</div>}
    </div>
  );
}

// ── 公司出款帳戶 ─────────────────────────────────────────
function BanksCard({ canEdit }) {
  const [list, setList] = useState([]);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState('');
  const load = useCallback(() => vendorPaymentApi.payoutBanks(true).then(r => setList(r?.data || [])).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  async function save() {
    setMsg('');
    try {
      const { id, created_at, updated_at, ...body } = edit;
      await vendorPaymentApi.savePayoutBank(id, body);
      setEdit(null); load();
    } catch (e) { setMsg('⚠ ' + (await errText(e))); }
  }
  const f = (k, label, w = 120, ph = '') => (
    <label style={{ fontSize: 12 }}>{label}<br /><input style={{ ...input, width: w }} placeholder={ph} value={edit[k] ?? ''} onChange={e => setEdit({ ...edit, [k]: e.target.value })} /></label>
  );
  return (
    <div style={card} data-tour="po-banks">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b>🏦 公司出款帳戶<HelpTip title="公司出款帳戶" body={HELP.banks} /></b>
        {canEdit && <button style={ghost} onClick={() => setEdit({ label: '', bank_name: '元大銀行', bank_code: '806', branch_code: '', account_no: '', account_name: '', is_default: !list.length, is_active: true })}>＋ 新增</button>}
      </div>
      <table style={{ width: '100%', fontSize: 13, marginTop: 8, borderCollapse: 'collapse' }}>
        <thead><tr style={{ color: '#718096', textAlign: 'left' }}><th>名稱</th><th>銀行</th><th>帳號</th><th>戶名</th><th></th></tr></thead>
        <tbody>
          {list.map(b => (
            <tr key={b.id} style={{ borderTop: '1px solid #edf2f7', opacity: b.is_active ? 1 : 0.5 }}>
              <td>{b.label}{b.is_default && <span style={{ fontSize: 11, color: '#2d6a4f', marginLeft: 4 }}>預設</span>}{!b.is_active && <span style={{ fontSize: 11, marginLeft: 4 }}>停用</span>}</td>
              <td>{b.bank_name || ''} {b.bank_code}{b.branch_code ? '-' + b.branch_code : ''}</td>
              <td>尾 {String(b.account_no).slice(-4)}</td>
              <td>{b.account_name}</td>
              <td>{canEdit && <button style={{ ...ghost, padding: '2px 8px' }} onClick={() => setEdit({ ...b })}>改</button>}</td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={5} style={{ color: '#a0aec0', padding: 8 }}>還沒有，請新增公司付款用的元大帳戶</td></tr>}
        </tbody>
      </table>
      {edit && (
        <div style={{ marginTop: 10, padding: 10, background: '#f7fafc', borderRadius: 6, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {f('label', '名稱', 140, '元大 公司戶')}{f('bank_name', '銀行名稱', 100)}{f('bank_code', '總行 3 碼', 70, '806')}{f('branch_code', '分行 4 碼', 70)}
          {f('account_no', '帳號', 160)}{f('account_name', '戶名', 160)}
          <label style={{ fontSize: 12 }}><input type="checkbox" checked={!!edit.is_default} onChange={e => setEdit({ ...edit, is_default: e.target.checked })} /> 預設</label>
          <label style={{ fontSize: 12 }}><input type="checkbox" checked={edit.is_active !== false} onChange={e => setEdit({ ...edit, is_active: e.target.checked })} /> 啟用</label>
          <button style={primary} onClick={save}>儲存</button><button style={ghost} onClick={() => { setEdit(null); setMsg(''); }}>取消</button>
          {msg && <span style={{ fontSize: 12, color: '#c53030' }}>{msg}</span>}
        </div>
      )}
    </div>
  );
}

// ── 主面板 ───────────────────────────────────────────────
export default function VendorPayoutPanel({ onOpenRequest, canManageBanks }) {
  const [date, setDate] = useState(twToday());
  const [day, setDay] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [unsched, setUnsched] = useState([]);
  const [log, setLog] = useState([]);
  const [sel, setSel] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const { start, overlay } = useCoachMarks(TOUR, 'tour_vendor_payout_v1', true);

  const load = useCallback(async () => {
    try {
      const [d, u, n, l] = await Promise.all([
        vendorPaymentApi.payoutDay(date), vendorPaymentApi.payoutUpcoming(14),
        vendorPaymentApi.payoutUnscheduled(), vendorPaymentApi.payoutExportLog(),
      ]);
      setDay(d?.data || null); setUpcoming(u?.data || []); setUnsched(n?.data || []); setLog(l?.data || []);
      setSel({});
    } catch (e) { setMsg('⚠ ' + (await errText(e))); }
  }, [date]);
  useEffect(() => { load(); }, [load]);

  async function doExport(g) {
    setBusy(true); setMsg('');
    try {
      const blob = await vendorPaymentApi.exportPayout({ date, bank_id: g.bank_id });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `廠商出款_${date.replace(/-/g, '')}_${g.bank_label}.xlsx`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMsg(`已下載 ${g.bank_label} 的元大檔` + (g.missing_payee ? `（${g.missing_payee} 筆收款帳號有問題沒放進去）` : ''));
      load();
    } catch (e) { setMsg('⚠ ' + (await errText(e))); }
    finally { setBusy(false); }
  }
  async function doPaid() {
    const ids = Object.keys(sel).filter(k => sel[k]);
    if (!ids.length) return;
    if (!window.confirm(`確定這 ${ids.length} 筆銀行已付款成功？會自動產生帳單進門市月報。`)) return;
    setBusy(true); setMsg('');
    try {
      const r = await vendorPaymentApi.markPayoutsPaid(ids);
      const d = r?.data || {};
      setMsg(`已出款 ${d.done?.length || 0} 筆` + (d.failed?.length ? `，失敗 ${d.failed.length} 筆：${d.failed.map(x => x.error).join('；')}` : ''));
      load();
    } catch (e) { setMsg('⚠ ' + (await errText(e))); }
    finally { setBusy(false); }
  }
  async function testNotify() {
    try { const r = await vendorPaymentApi.payoutNotifyTest(); const d = r?.data || {}; setMsg(d.skipped ? `沒有推播（${d.reason || '今天沒有要出的款'}）` : `已推播給 ${d.notified} 人`); }
    catch (e) { setMsg('⚠ ' + (await errText(e))); }
  }

  const items = day?.items || [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {overlay}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 16 }}>💸 廠商出款<HelpTip title="今日出款" body={HELP.today} /></b>
        <label data-tour="po-date" style={{ fontSize: 13 }}>日期 <input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} /></label>
        <button style={ghost} onClick={load}>重新整理</button>
        <button style={ghost} onClick={start}>📖 使用說明</button>
        {canManageBanks && <button style={ghost} onClick={testNotify} title="現在推一次今天的提醒">🔔 測試提醒</button>}
        {msg && <span style={{ fontSize: 13, color: msg.startsWith('⚠') ? '#c53030' : '#2d6a4f' }}>{msg}</span>}
      </div>

      <div style={card} data-tour="po-groups">
        {!day ? <div style={{ color: '#a0aec0' }}>載入中…</div> : !items.length ? (
          <div style={{ color: '#2d6a4f' }}>{date} 沒有要出的廠商款</div>
        ) : (
          <>
            <div style={{ marginBottom: 8 }}>共 <b>{day.total}</b> 筆 <b>{money(day.amount)}</b>{day.overdue_count ? <span style={{ color: '#c53030' }}>，其中 {day.overdue_count} 筆逾期（之前排了還沒出）</span> : null}</div>
            {day.groups.map(g => (
              <div key={g.bank_id || 'none'} style={{ borderTop: '1px solid #edf2f7', paddingTop: 8, marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b>🏦 {g.bank_label}</b><span>{g.count} 筆 {money(g.amount)}</span>
                  {g.exported > 0 && <span style={{ fontSize: 12, color: '#718096' }}>已匯出過 {g.exported} 筆</span>}
                  {g.bank_id && <span data-tour="po-export"><button style={primary} disabled={busy} onClick={() => doExport(g)}>📥 匯出元大 Excel</button><HelpTip title="匯出元大 Excel" body={HELP.export} /></span>}
                </div>
                <table style={{ width: '100%', fontSize: 13, marginTop: 6, borderCollapse: 'collapse' }}>
                  <thead><tr style={{ color: '#718096', textAlign: 'left' }}>
                    <th style={{ width: 28 }}></th><th>出款日</th><th>請款單</th><th>廠商</th><th style={{ textAlign: 'right' }}>金額</th>
                    <th>收款帳號<HelpTip title="廠商收款帳號" body={HELP.payee} size={14} /></th>
                  </tr></thead>
                  <tbody>
                    {items.filter(it => (it.bank_id || null) === (g.bank_id || null)).map(it => (
                      <tr key={it.id} style={{ borderTop: '1px solid #f7fafc', background: it.overdue ? '#fff5f5' : undefined }}>
                        <td><input type="checkbox" checked={!!sel[it.id]} onChange={e => setSel({ ...sel, [it.id]: e.target.checked })} /></td>
                        <td>{it.payout_date}{it.overdue && <span style={{ color: '#c53030', fontSize: 11, marginLeft: 4 }}>逾期</span>}</td>
                        <td><button type="button" style={{ background: 'none', border: 'none', color: '#3182ce', cursor: 'pointer', padding: 0 }} onClick={() => onOpenRequest && onOpenRequest(it.id)}>{it.request_no}</button> {it.title}</td>
                        <td>{it.vendor}</td>
                        <td style={{ textAlign: 'right' }}>{money(it.amount)}</td>
                        <td>{!it.payee ? <span style={{ color: '#c53030' }}>⚠ 廠商沒有收款帳號</span>
                          : it.payee.problem ? <span style={{ color: '#c53030' }}>⚠ {it.payee.problem}</span>
                          : <span>{it.payee.account_name}・{it.payee.bank_code}{it.payee.branch_code ? '-' + it.payee.branch_code : ''}・尾 {it.payee.account_no_tail}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <div style={{ marginTop: 10 }} data-tour="po-paid">
              <button style={{ ...primary, background: '#2c7a7b' }} disabled={busy || !Object.values(sel).some(Boolean)} onClick={doPaid}>✅ 已出款（勾選的）</button>
              <HelpTip title="已出款" body={HELP.paid} />
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <div style={card} data-tour="po-unscheduled">
          <b>📝 已通過、還沒排出款日（{unsched.length}）</b>
          {unsched.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid #f7fafc', padding: '4px 0' }}>
              <span>{r.request_no} {r.vendor} {r.title}</span>
              <span>{money(r.amount)} <button style={{ ...ghost, padding: '2px 8px' }} onClick={() => onOpenRequest && onOpenRequest(r.id)}>排程</button></span>
            </div>
          ))}
          {!unsched.length && <div style={{ color: '#a0aec0', fontSize: 13 }}>沒有</div>}
        </div>
        <div style={card}>
          <b>📅 之後 14 天排定的（{upcoming.length}）</b>
          {upcoming.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid #f7fafc', padding: '4px 0' }}>
              <span>{r.payout_date} {r.vendor} {r.title}</span><span>{money(r.amount)}</span>
            </div>
          ))}
          {!upcoming.length && <div style={{ color: '#a0aec0', fontSize: 13 }}>沒有</div>}
        </div>
      </div>

      <BanksCard canEdit={canManageBanks} />

      {log.length > 0 && (
        <div style={card}>
          <b>🧾 匯出紀錄</b>
          {log.slice(0, 20).map(x => (
            <div key={x.id} style={{ fontSize: 12, color: '#4a5568', borderTop: '1px solid #f7fafc', padding: '3px 0' }}>
              {new Date(x.exported_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}・付款日 {x.payout_date}・{x.request_ids.length} 筆 {money(x.total_amount)}{x.exported_by ? `・${x.exported_by}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
