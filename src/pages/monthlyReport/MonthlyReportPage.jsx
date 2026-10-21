// pages/monthlyReport/MonthlyReportPage.jsx —— 門市月報 v1（2026-10-20）
// 版型照「後甲月報」試算表。每一格都點得開看是哪幾筆（開帳單／部門開帳／營運費用／固定支出／ERP 費用單／手填／調帳）。
// 手填與調帳只有 billing「編輯」權限的人送得出去（後端擋）；已關帳月份不能改。
// ⚠ App 內建瀏覽器的 confirm／prompt 不可靠 → 全部用頁內表單（陷阱 143）
import { useState, useEffect, useCallback } from 'react';
import AuditPanel from './AuditPanel';
import CloseBar from './CloseBar';
import AccountsPanel from './AccountsPanel';
import CardFeePanel from './CardFeePanel';
import ImportPanel from './ImportPanel';
import AmortPanel from './AmortPanel';
import HelpTip from '../../components/help/HelpTip';
import { useCoachMarks } from '../../components/help/CoachMarks';
import { ROW_HELP, REV_HELP, SECTION_HELP, DEFAULT_ROW_HELP, TOUR_OVERVIEW, TOUR_STORE } from './helpTexts';
import { ledgerApi } from '../../services/api';
import VoucherBox from '../../components/vouchers/VoucherBox';
import SubjectSelect from '../../components/ledger/SubjectSelect';

const fmt = (n) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString('zh-TW'));
const SRC_COLOR = { 刷卡費率: '#2b6cb0', 左手薪資: '#2f855a', 支票: '#975a16', 開帳單: '#2b6cb0', 部門開帳: '#6b46c1', 營運費用: '#2f855a', 固定支出: '#975a16', 固定金額: '#975a16', 'ERP 費用單': '#c05621', 愛民支出: '#c05621', 企劃部開帳: '#6b46c1', 倉庫開帳: '#2c7a7b', 合約: '#8b6f4e', 基本資料: '#718096', 手填: '#4a5568', 調帳: '#c53030', 分攤: '#805ad5' };
const VENDOR_GROUPS = ['misc', 'frame', 'lens', 'contact'];
const CODE_NAME = { electricity: '電費', water: '水費', telecom: '電話網路', rent: '租金', golden_chicken: '金雞', ad_budget: '廣告費', repair: '工程修繕', edu_bonus: '教育訓練獎金' };

function months(n = 18) {
  const out = []; const d = new Date(); d.setDate(1);
  for (let i = 0; i < n; i++) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); d.setMonth(d.getMonth() - 1); }
  return out;
}
const prevMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const errMsg = (e) => (e && (e.message || e.error)) || '發生錯誤';

export default function MonthlyReportPage() {
  // 從門市基礎設定點過來會帶 ?store=&ym=
  const qs = new URLSearchParams(window.location.search);
  const [ym, setYm] = useState(/^\d{4}-\d{2}$/.test(qs.get('ym') || '') ? qs.get('ym') : prevMonth());
  const [store, setStore] = useState(qs.get('store') || '');
  const [ov, setOv] = useState(null);
  const [rep, setRep] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState({});      // code → 展開明細
  const [form, setForm] = useState(null);    // { code, name, group, entry_type, amount, vendor, reason, fee_ym }
  const [msg, setMsg] = useState('');
  const [vOpen, setVOpen] = useState({});   // 明細列 key → 展開憑證
  const [formFiles, setFormFiles] = useState([]);   // 手填／調帳一起送的憑證

  const tourAll = useCoachMarks(TOUR_OVERVIEW, 'tour_monthly_report_v1', !store);
  const tourStore = useCoachMarks(TOUR_STORE, 'tour_monthly_report_store_v1', !!store);

  const loadOverview = useCallback(async () => {
    setLoading(true); setErr('');
    try { const r = await ledgerApi.overview(ym); setOv(r.data); } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  }, [ym]);
  const loadReport = useCallback(async () => {
    if (!store) return;
    setLoading(true); setErr('');
    try { const r = await ledgerApi.report(ym, store); setRep(r.data); } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  }, [ym, store]);

  useEffect(() => { if (store) loadReport(); else { setRep(null); loadOverview(); } }, [store, ym, loadReport, loadOverview]);

  const closed = rep && rep.status === 'closed';
  const startForm = (row, entry_type = 'value', vendor = '') => {
    setMsg('');
    setForm({ code: row.code, name: row.name, group: row.group, entry_type, amount: '', vendor, reason: '', fee_ym: '', subject_id: '' });
    setFormFiles([]);
  };
  const submit = async () => {
    if (!form) return;
    if (form.amount === '' || !Number.isFinite(Number(form.amount))) { setMsg('請填金額'); return; }
    if (form.entry_type === 'adjust' && !form.reason.trim()) { setMsg('調帳一定要寫原因'); return; }
    const isExpense = !['revenue', 'info'].includes(form.group);
    if (isExpense && !form.subject_id) { setMsg('請選會計科目（之後才能歸類分析）'); return; }
    try {
      const r = await ledgerApi.manual({ store, ym, ledger_code: form.code, entry_type: form.entry_type, amount: Number(form.amount), vendor: form.vendor, reason: form.reason, fee_ym: form.fee_ym || null, subject_id: form.subject_id || null });
      if (formFiles.length && r && r.data && r.data.id) {
        try { await ledgerApi.voucherUpload('manual', r.data.id, formFiles); } catch (e) { setErr(`已記帳，但憑證上傳失敗：${errMsg(e)}（到那一格明細補傳）`); }
      }
      setForm(null); setFormFiles([]); await loadReport();
    } catch (e) { setMsg(errMsg(e)); }
  };
  const voidLine = async (id) => { try { await ledgerApi.voidManual(id); await loadReport(); } catch (e) { setErr(errMsg(e)); } };
  const [retained, setRetained] = useState('');
  const saveRetained = async (amount) => { try { await ledgerApi.retained({ store, ym, amount }); setRetained(''); await loadReport(); } catch (e) { setErr(errMsg(e)); } };

  // ── 一列（科目）──
  const Row = ({ row }) => {
    const isOpen = !!open[row.code];
    return (
      <>
        <tr style={{ cursor: 'pointer', background: isOpen ? '#f7fafc' : undefined }} onClick={() => setOpen((o) => ({ ...o, [row.code]: !o[row.code] }))}>
          <td style={S.td}>
            {row.name}<HelpTip title={row.name} body={ROW_HELP[row.code] || DEFAULT_ROW_HELP(row)} size={15} />
            {row.fee_months.length > 0 && <span style={S.tag('#805ad5')}>{row.fee_months.map((m) => `${Number(m.slice(5))}月帳`).join('、')}</span>}
            {row.adjust_count > 0 && <span style={S.tag('#c53030')}>含調帳 {row.adjust_count} 筆</span>}
            {rep.vouchers_visible && row.voucher_missing > 0 && <span style={S.tag('#dd6b20')}>缺憑證 {row.voucher_missing}</span>}
            {row.vendors.length > 0 && <div style={S.sub}>{row.vendors.map((v) => `${v.vendor} ${fmt(v.amount)}`).join('　')}</div>}
          </td>
          <td style={{ ...S.td, ...S.num }}>{row.has_data ? fmt(row.amount) : <span style={{ color: '#a0aec0' }}>—</span>}</td>
          <td style={S.td}>{row.sources.map((s) => <span key={s} style={S.tag(SRC_COLOR[s] || '#718096')}>{s}</span>)}</td>
        </tr>
        {isOpen && (
          <tr><td colSpan={3} style={{ ...S.td, background: '#f7fafc' }}>
            {(row.lines || []).length === 0 && <div style={S.sub}>這個月沒有任何一筆。</div>}
            {(row.lines || []).map((l) => (
              <div key={l.source + l.ref_id} style={S.line}>
                <span style={S.tag(SRC_COLOR[l.source_name] || '#718096')}>{l.source_name}</span>
                {l.fee_ym && l.fee_ym !== ym && <span style={S.tag('#805ad5')}>{l.fee_ym} 帳</span>}
                <span style={{ flex: 1 }}>{String(l.ref_title || '').replace(/^｜|｜$/g, '')}
                  {l.subject_name && <span style={S.tag(l.subject_set ? '#2c7a7b' : '#a0aec0')} title={l.subject_set ? '會計科目' : '沒選過，暫用這格的預設科目'}>{l.subject_set ? '' : '預設・'}{l.subject_name}</span>}
                  {!closed && !l.subject_set && (l.source === 'bill' || String(l.source || '').startsWith('manual_')) && (
                    <SubjectSelect ledgerCode={l.source === 'bill' ? undefined : (l.ledger_code || row.code)} value="" placeholder="補選科目" style={{ fontSize: 12, padding: 2 }}
                      onChange={async (sj) => { if (!sj) return; try { if (l.source === 'bill') await ledgerApi.billSubject(l.ref_id, sj.id); else await ledgerApi.manualSubject(l.ref_id, sj.id); await loadReport(); } catch (e) { setErr(errMsg(e)); } }} />
                  )}
                  {l.source === 'erp_cost' && l.receipt_status && l.receipt_status !== 'none' && <span style={S.tag(l.receipt_status === 'approved' ? '#2f855a' : l.receipt_status === 'rejected' ? '#c53030' : '#d69e2e')}>{l.receipt_status === 'approved' ? `憑證通過${l.receipt_reviewed_by ? '・' + l.receipt_reviewed_by : ''}` : l.receipt_status === 'rejected' ? '憑證退回' : '憑證待核'}</span>}
                  {rep.vouchers_visible && (l.voucher_ref || (l.vouchers || []).length > 0) && (
                    <button style={{ ...S.linkBtn, marginLeft: 6, color: (l.vouchers || []).length ? '#2b6cb0' : '#dd6b20' }}
                      onClick={(e) => { e.stopPropagation(); const k = l.source + l.ref_id; setVOpen((o) => ({ ...o, [k]: !o[k] })); }}>
                      {(l.vouchers || []).length ? `📎 憑證 ${l.vouchers.length}` : '📎 缺憑證'}
                    </button>
                  )}
                  {rep.vouchers_visible && vOpen[l.source + l.ref_id] && (
                    <VoucherBox refType={l.voucher_ref && l.voucher_ref.type} refId={l.voucher_ref && l.voucher_ref.id}
                      initial={l.vouchers || []} readOnly={!l.voucher_ref}
                      onChange={(fl) => { l.vouchers = fl.concat((l.vouchers || []).filter((v) => !v.deletable && !fl.some((x) => x.id === v.id))); setVOpen((o) => ({ ...o })); }} />
                  )}
                </span>
                <span style={S.num}>{fmt(l.amount)}</span>
                {!closed && (l.source === 'manual_value' || l.source === 'manual_adjust') && <button style={S.linkBtn} onClick={(e) => { e.stopPropagation(); voidLine(l.ref_id); }}>作廢</button>}
              </div>
            ))}
            {!closed && (
              <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                <button style={S.btn} onClick={() => startForm(row, 'value')}>手填金額</button>
                <button style={S.btn} onClick={() => startForm(row, 'adjust')}>調帳 ＋／−</button>
              </div>
            )}
          </td></tr>
        )}
      </>
    );
  };

  const Section = ({ groups, title, help, tour }) => (
    <div style={S.card} data-yaya={tour}>
      <div style={S.cardTitle}>{title}<HelpTip title="說明" body={help} /></div>
      <table style={S.table}><tbody>
        {groups.map((g) => (
          <FragmentGroup key={g.group} g={g} />
        ))}
      </tbody></table>
    </div>
  );
  const FragmentGroup = ({ g }) => (
    <>
      <tr><td colSpan={3} style={S.groupHead}>{g.name}<span style={{ float: 'right' }}>{fmt(g.total)}</span></td></tr>
      {g.rows.map((r) => <Row key={r.code} row={r} />)}
    </>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>📒 門市月報</h2>
        <select data-yaya="mr-month" value={ym} onChange={(e) => setYm(e.target.value)} style={S.input}>{months().map((m) => <option key={m} value={m}>{m}</option>)}</select>
        {store && <button style={S.btn} onClick={() => setStore('')}>‹ 全部門市</button>}
        {store && <a style={{ fontSize: 13, color: '#3182ce' }} href={`/store-profile?store=${store}&ym=${ym}`}>🏪 門市基礎設定（合約、付款狀態）</a>}
        {store && rep && <span style={{ fontWeight: 600 }}>{rep.store_name || store}　<span style={S.tag(closed ? '#2f855a' : '#718096')}>{closed ? '已關帳' : rep.status === 'review' ? '月報完成・待關帳' : '整理中'}</span></span>}
        <button style={S.btn} onClick={() => (store ? loadReport() : loadOverview())} disabled={loading}>{loading ? '讀取中…' : '重新整理'}</button>
        <button style={S.btn} onClick={() => (store ? tourStore.start() : tourAll.start())}>📖 使用說明</button>
      </div>
      {tourAll.overlay}{tourStore.overlay}
      {err && <div style={S.err}>{err}</div>}

      {!store && <CloseBar ym={ym} onDone={loadOverview} />}
      {!store && <CardFeePanel ym={ym} />}
      {!store && <ImportPanel onDone={loadOverview} />}
      {!store && <AmortPanel ym={ym} stores={ov ? ov.stores : []} onDone={loadOverview} />}
      {!store && <AccountsPanel />}
      {!store && <AuditPanel ym={ym} onPickStore={(id) => setStore(id)} />}

      {/* ── 全部門市一覽 ── */}
      {!store && ov && (
        <div style={S.card} data-yaya="mr-list">
          {ov.market_error && <div style={S.warn}>⚠ {ov.market_error}（ERP 帳上業績、門市費用單暫時拿不到）</div>}
          {ov.aimin_error && <div style={S.warn}>⚠ {ov.aimin_error}（愛民門市的眼鏡業績、門市支出暫時拿不到）</div>}
          <table style={S.table}>
            <thead><tr>{['門市', '總業績', '總真實實收', '眼鏡業績', '隱眼業績', '總支出', '總呆帳', '總盈餘', '實收', '提醒', ''].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {ov.stores.map((s) => (
                <tr key={s.store}>
                  <td style={S.td}>{s.store_name}<div style={S.sub}>{s.store}　<span style={S.tag(s.status === 'closed' ? '#2f855a' : s.status === 'review' ? '#b7791f' : '#a0aec0')}>{s.status === 'closed' ? '已關帳' : s.status === 'review' ? '月報完成・待關帳' : '整理中'}</span></div></td>
                  <td style={{ ...S.td, ...S.num }}>{fmt(s.sales_total)}</td>
                  <td style={{ ...S.td, ...S.num }}>{fmt(s.receipt_total)}</td>
                  <td style={{ ...S.td, ...S.num }}>{fmt(s.glasses_sales)}</td>
                  <td style={{ ...S.td, ...S.num }}>{fmt(s.contact_sales)}</td>
                  <td style={{ ...S.td, ...S.num }}>{fmt(s.total_out)}</td>
                  <td style={{ ...S.td, ...S.num, color: s.bad_debt > 0 ? '#c53030' : undefined }} title="總業績 − 帳面實收（ERP 收款，不含 API PAY）">{fmt(s.bad_debt)}</td>
                  <td style={{ ...S.td, ...S.num, color: s.profit < 0 ? '#c53030' : undefined }}>{fmt(s.profit)}</td>
                  <td style={S.td}>{s.error ? <span style={{ color: '#c53030' }}>{s.error}</span> : s.filled ? '✅ 已填' : <span style={{ color: '#c05621' }}>待填</span>}</td>
                  <td style={S.td}>{s.warnings ? `${s.warnings} 則` : ''}</td>
                  <td style={S.td}><button style={S.btn} onClick={() => setStore(s.store)}>看月報</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {(ov.others || []).length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={S.cardTitle}>部門與其他單位（不出門市月報，這個月帳上有費用）</div>
              <div style={S.sub}>營運部系統的電費、電話、開帳也會分到部門；這裡列出來，確認沒有錢跑錯單位。要把某個單位改成門市，請跟我說。</div>
              <table style={S.table}><tbody>
                {ov.others.map((o) => (
                  <tr key={o.store}>
                    <td style={S.td}>{o.name}<div style={S.sub}>{o.store}</div></td>
                    <td style={{ ...S.td, ...S.num }}>{fmt(o.total)}</td>
                    <td style={S.td}><span style={S.sub}>{Object.entries(o.codes).map(([k, v]) => `${CODE_NAME[k] || k} ${fmt(v)}`).join('、')}</span></td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
        </div>
      )}

      {/* ── 單店月報 ── */}
      {store && rep && (
        <>
          {rep.warnings.length > 0 && <div style={S.warn}>{rep.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>}

          <CloseBar ym={ym} store={store} status={rep.status} report={rep.report} onDone={loadReport} />
          {rep.vouchers_visible && rep.voucher_stats && rep.voucher_stats.total > 0 && (
            <div style={{ ...S.sub, margin: '-6px 0 10px' }}>📎 原始憑證：{rep.voucher_stats.total - rep.voucher_stats.missing}／{rep.voucher_stats.total} 筆有附{rep.voucher_stats.missing > 0 ? `，${rep.voucher_stats.missing} 筆缺（點開有「缺憑證」的格子補傳）` : ''}（只有營運部與超級管理員看得到）</div>
          )}
          {rep.frozen && <div style={S.warn}>🔒 已關帳：下面是關帳當下的數字（{String(rep.snapshot_at || '').slice(0, 16).replace('T', ' ')}）。之後帳本再變也不會改到這份；要改請先重開。</div>}
          <AuditPanel ym={ym} store={store} canEdit={!closed} />

          <div style={S.card} data-yaya="mr-revenue">
            <div style={S.cardTitle}>業績與實收<HelpTip title="業績與實收" body={SECTION_HELP.revenue} /></div>
            {(() => {
              const R = rep.revenue, T = rep.totals, G = rep.gap || {};
              const gapLine = (g) => (!g || g.diff == null ? null : (
                <div style={{ ...S.sub, color: g.alert ? '#c53030' : '#718096', fontWeight: g.alert ? 700 : 400 }}>
                  實收差 {g.diff > 0 ? '+' : ''}{fmt(g.diff)}{g.pct != null ? `（${g.pct > 0 ? '+' : ''}${g.pct}%）` : ''}{g.alert ? ' ⚠ 要關注' : ''}
                </div>));
              const card = (code, r, opt = {}) => (
                <div key={code} style={{ ...S.kpi, ...(opt.total ? { background: '#f7fafc' } : {}), ...(opt.gap && opt.gap.alert ? { borderColor: '#fc8181' } : {}) }}>
                  <div style={S.sub}>{r.name}{r.from === 'system' ? '（系統）' : r.from === 'system_adjusted' ? '（系統＋調帳）' : ''}<HelpTip title={r.name} body={REV_HELP[code] || (r.custom ? REV_HELP.custom : '')} size={14} /></div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{r.amount == null ? <span style={{ color: '#c05621' }}>{opt.sales ? '拿不到' : '待填'}</span> : fmt(r.amount)}</div>
                  {(r.refs || []).map((x) => <div key={x.label} style={S.sub}>{x.label} {fmt(x.amount)}</div>)}
                  {!opt.sales && r.erp != null && r.amount != null && r.erp !== r.amount && <div style={S.sub}>跟帳上參考差 {fmt(r.amount - r.erp)}</div>}
                  {r.no_source && <div style={S.sub}>系統來源還沒接，先手填</div>}
                  {opt.gap && gapLine(opt.gap)}
                  {!closed && !opt.total && (opt.sales
                    ? <button style={S.linkBtn} onClick={() => startForm({ code, name: r.name, group: 'revenue' }, 'adjust')}>調帳</button>
                    : <button style={S.linkBtn} onClick={() => startForm({ code, name: r.name, group: 'revenue' }, 'value')}>填寫</button>)}
                </div>);
              const row = (title, items) => (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ ...S.sub, fontWeight: 600, marginBottom: 4 }}>{title}</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{items}</div>
                </div>);
              return (<>
                {row('業績（系統帶入：ERP＋愛民系統）', [
                  card('glasses_sales', R.glasses_sales, { sales: true }),
                  card('contact_sales', R.contact_sales, { sales: true }),
                  card('sales_total', { name: '總業績', amount: T.sales_total }, { sales: true, total: true }),
                ])}
                {row('實收（真實實收＝會計對銀行後手填；帳面＝ERP 收款，不含 API PAY）', [
                  <div key="receipt_total" style={{ ...S.kpi, background: '#f7fafc', ...(G.total && G.total.alert ? { borderColor: '#fc8181' } : {}) }}>
                    <div style={S.sub}>總真實實收<HelpTip title="總真實實收" body={REV_HELP.receipt_total} size={14} /></div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{T.receipt_total == null ? <span style={{ color: '#c05621' }}>待填</span> : fmt(T.receipt_total)}</div>
                    {R.receipt_total && R.receipt_total.legacy && <div style={S.sub}>舊填法：眼鏡 {fmt(R.receipt_total.legacy.glasses)}＋隱眼 {fmt(R.receipt_total.legacy.contact)}（填了總數就以總數為準）</div>}
                    {!closed && R.receipt_total && <button style={S.linkBtn} onClick={() => startForm({ code: 'receipt_total', name: '總真實實收', group: 'revenue' }, 'value')}>填寫</button>}
                    {gapLine(G.total)}
                  </div>,
                  card('book_glasses_receipt', { name: '帳面眼鏡實收', amount: T.book_glasses_receipt }, { sales: true, total: true }),
                  card('book_contact_receipt', { name: '帳面隱眼實收', amount: T.book_contact_receipt }, { sales: true, total: true }),
                  <div key="bad_debt" style={{ ...S.kpi, background: '#f7fafc', ...(T.bad_debt > 0 ? { borderColor: '#fc8181' } : {}) }}>
                    <div style={S.sub}>帳面呆帳<HelpTip title="帳面呆帳" body={REV_HELP.bad_debt} size={14} /></div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.bad_debt > 0 ? '#c53030' : undefined }}>{T.bad_debt == null ? <span style={{ color: '#718096', fontSize: 14 }}>{T.book_receipt_total === undefined ? '這個月沒有帳面資料' : '拿不到'}</span> : fmt(T.bad_debt)}</div>
                    {T.bad_debt != null && T.glasses_sales != null && T.book_glasses_receipt != null && <div style={S.sub}>眼鏡 {fmt(T.glasses_sales - T.book_glasses_receipt)}</div>}
                    {T.bad_debt != null && T.contact_sales != null && T.book_contact_receipt != null && <div style={S.sub}>隱眼 {fmt(T.contact_sales - T.book_contact_receipt)}</div>}
                  </div>,
                ])}
                {row('其他', [card('api_pay', R.api_pay), card('stored_value', R.stored_value),
                  ...Object.entries(R).filter(([, v]) => v && v.custom).map(([k, v]) => card(k, v))])}
              </>);
            })()}
            <div style={{ marginTop: 4, fontWeight: 600 }}>算獲利用的實收（總實收＋API 支付{rep.totals.extra_in ? '＋自訂收入' : ''}）{fmt(rep.totals.total_in)}</div>
            {rep.aimin && rep.aimin.closings && (
              <div style={{ ...S.sub, marginTop: 6 }}>
                愛民系統（{rep.aimin.name}）：訂單 {rep.aimin.orders} 張、業績 {fmt(rep.aimin.sales)}、收款 {fmt(rep.aimin.paid)}；
                日結 {rep.aimin.closings.count} 次，現金收 {fmt(rep.aimin.closings.cash_received)}、刷卡 {fmt(rep.aimin.closings.card_total)}（日結含藥拋，僅供對帳）
              </div>
            )}
          </div>

          {form && (
            <div style={{ ...S.card, borderColor: '#3182ce' }}>
              <div style={S.cardTitle}>{form.entry_type === 'adjust' ? '調帳' : '手填'}：{form.name}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {!['revenue', 'info'].includes(form.group) && <label>會計科目 <SubjectSelect ledgerCode={form.code} value={form.subject_id} onChange={(sj) => setForm({ ...form, subject_id: sj ? sj.id : '' })} /></label>}
                <label>金額 <input style={S.input} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={form.entry_type === 'adjust' ? '可填負數' : ''} /></label>
                {(VENDOR_GROUPS.includes(form.group)) && <label>廠商 <input style={S.input} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="例 HOYA、晶碩" /></label>}
                <label>費用月 <select style={S.input} value={form.fee_ym} onChange={(e) => setForm({ ...form, fee_ym: e.target.value })}><option value="">同月報月份</option>{months(6).map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
                <label style={{ flex: 1, minWidth: 220 }}>{form.entry_type === 'adjust' ? '原因（必填）' : '備註'} <input style={{ ...S.input, width: '100%' }} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
              </div>
              {form.entry_type === 'value' && <div style={S.sub}>同一格（同科目、同廠商）只留一筆手填值：再填一次會把舊的作廢、留紀錄。</div>}
              {rep.vouchers_visible && <div style={{ marginTop: 6, fontSize: 13 }}>原始憑證（照片／PDF，建議一定要附）：
                <input type="file" accept="image/*,application/pdf" multiple onChange={(e) => setFormFiles([...e.target.files])} />
                {formFiles.length > 0 && <span style={S.sub}>　{formFiles.length} 個檔案，送出後一起上傳</span>}</div>}
              {msg && <div style={S.err}>{msg}</div>}
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}><button style={S.primary} onClick={submit}>送出</button><button style={S.btn} onClick={() => setForm(null)}>取消</button></div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
            <Section title={`營運支出　合計 ${fmt(rep.totals.left_total)}`} groups={rep.left} help={SECTION_HELP.left} tour="mr-left" />
            <Section title={`費用支出　合計 ${fmt(rep.totals.right_total)}`} groups={rep.right} help={SECTION_HELP.right} tour="mr-right" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <div style={S.card} data-yaya="mr-profit">
              <div style={S.cardTitle}>盈餘<HelpTip title="盈餘與成本率" body={SECTION_HELP.profit} /></div>
              <table style={S.table}><tbody>
                {[['眼鏡支出', rep.totals.glasses_out], ['眼鏡盈餘', rep.totals.glasses_profit], ['藥拋支出', rep.totals.contact_out], ['藥拋盈餘（含 API 支付）', rep.totals.contact_profit], ['總支出', rep.totals.total_out], ['總盈餘', rep.totals.profit]].map(([k, v]) => (
                  <tr key={k}><td style={S.td}>{k}</td><td style={{ ...S.td, ...S.num, color: v < 0 ? '#c53030' : undefined, fontWeight: k === '總盈餘' ? 700 : 400 }}>{fmt(v)}</td></tr>
                ))}
              </tbody></table>
              <div style={{ ...S.sub, marginTop: 8 }}>成本率（藥拋 ÷ 藥拋實收，其他 ÷ 總實收）</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {Object.entries(rep.ratio_target).map(([k, t]) => {
                  const v = rep.totals.ratio[k]; const over = v != null && (k === '淨利' ? v < t : v > t);
                  return <span key={k} style={S.tag(over ? '#c53030' : '#2f855a')}>{k} {v == null ? '—' : `${v}%`}／目標 {t}%</span>;
                })}
              </div>
            </div>
            <div style={S.card} data-yaya="mr-dividend">
              <div style={S.cardTitle}>分紅<HelpTip title="分紅" body={SECTION_HELP.dividend} />{rep.dividend.cash_label ? `　· ${rep.dividend.cash_label}` : ''}</div>
              <table style={S.table}><tbody>
                <tr><td style={S.td}>行銷基金（本月／累計）</td><td style={{ ...S.td, ...S.num }}>{fmt(rep.dividend.marketing_fund)}／{fmt(rep.dividend.marketing_fund_cum)}</td></tr>
                <tr><td style={S.td}>固定資產折舊（本月／累計）</td><td style={{ ...S.td, ...S.num }}>{fmt(rep.dividend.depreciation)}／{fmt(rep.dividend.depreciation_cum)}</td></tr>
                <tr><td style={S.td}>保留盈餘{rep.dividend.retained_set ? '（已設定）' : `（預設 ${Math.round(rep.dividend.retained_rate * 100)}%）`}</td>
                  <td style={{ ...S.td, ...S.num }}>{fmt(rep.dividend.retained)}
                    {!closed && <div style={{ marginTop: 4 }}>
                      <input style={{ ...S.input, width: 90 }} value={retained} onChange={(e) => setRetained(e.target.value)} placeholder="改金額" />
                      <button style={S.linkBtn} onClick={() => saveRetained(retained)}>存</button>
                      {rep.dividend.retained_set && <button style={S.linkBtn} onClick={() => saveRetained(null)}>改回預設</button>}
                    </div>}
                  </td></tr>
                <tr><td style={{ ...S.td, fontWeight: 700 }}>可分配（總分紅）</td><td style={{ ...S.td, ...S.num, fontWeight: 700, color: rep.dividend.distributable < 0 ? '#c53030' : undefined }}>{fmt(rep.dividend.distributable)}</td></tr>
              </tbody></table>
              <div style={{ ...S.sub, marginTop: 8 }}>股東（{rep.dividend.total_shares} 股）</div>
              {rep.shareholders.length === 0 && <div style={S.sub}>還沒設定股東（到「🏪 門市基礎設定 → 股東」設定）</div>}
              {rep.shareholders.map((h) => <div key={h.id} style={S.line}><span style={{ flex: 1 }}>{h.name}　{h.shares} 股</span><span style={{ ...S.num, color: h.amount < 0 ? '#c53030' : undefined }}>{fmt(h.amount)}</span></div>)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 },
  cardTitle: { fontWeight: 700, marginBottom: 10 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e2e8f0', color: '#4a5568', fontWeight: 600 },
  td: { padding: '6px 8px', borderBottom: '1px solid #edf2f7', verticalAlign: 'top' },
  num: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  groupHead: { padding: '8px', background: '#edf2f7', fontWeight: 600 },
  sub: { fontSize: 12, color: '#718096' },
  line: { display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0', fontSize: 13 },
  kpi: { border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', minWidth: 160 },
  tag: (c) => ({ display: 'inline-block', marginLeft: 6, padding: '0 6px', borderRadius: 10, fontSize: 11, color: c, border: `1px solid ${c}` }),
  input: { padding: '4px 8px', border: '1px solid #cbd5e0', borderRadius: 4 },
  btn: { padding: '4px 10px', border: '1px solid #cbd5e0', borderRadius: 4, background: '#fff', cursor: 'pointer' },
  primary: { padding: '4px 14px', border: 'none', borderRadius: 4, background: '#3182ce', color: '#fff', cursor: 'pointer' },
  linkBtn: { border: 'none', background: 'none', color: '#3182ce', cursor: 'pointer', padding: '0 4px', fontSize: 12 },
  warn: { background: '#fffaf0', border: '1px solid #fbd38d', color: '#7b341e', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13 },
  err: { color: '#c53030', margin: '8px 0' },
};
