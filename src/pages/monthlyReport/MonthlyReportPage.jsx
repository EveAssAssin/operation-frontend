// pages/monthlyReport/MonthlyReportPage.jsx —— 門市月報 v1（2026-10-20）
// 版型照「後甲月報」試算表。每一格都點得開看是哪幾筆（開帳單／部門開帳／營運費用／固定支出／ERP 費用單／手填／調帳）。
// 手填與調帳只有 billing「編輯」權限的人送得出去（後端擋）；已關帳月份不能改。
// ⚠ App 內建瀏覽器的 confirm／prompt 不可靠 → 全部用頁內表單（陷阱 143）
import { useState, useEffect, useCallback } from 'react';
import { ledgerApi } from '../../services/api';

const fmt = (n) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString('zh-TW'));
const SRC_COLOR = { 開帳單: '#2b6cb0', 部門開帳: '#6b46c1', 營運費用: '#2f855a', 固定支出: '#975a16', 固定金額: '#975a16', 'ERP 費用單': '#c05621', 手填: '#4a5568', 調帳: '#c53030' };
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
  const [ym, setYm] = useState(prevMonth());
  const [store, setStore] = useState('');
  const [ov, setOv] = useState(null);
  const [rep, setRep] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState({});      // code → 展開明細
  const [form, setForm] = useState(null);    // { code, name, group, entry_type, amount, vendor, reason, fee_ym }
  const [msg, setMsg] = useState('');

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
    setForm({ code: row.code, name: row.name, group: row.group, entry_type, amount: '', vendor, reason: '', fee_ym: '' });
  };
  const submit = async () => {
    if (!form) return;
    if (form.amount === '' || !Number.isFinite(Number(form.amount))) { setMsg('請填金額'); return; }
    if (form.entry_type === 'adjust' && !form.reason.trim()) { setMsg('調帳一定要寫原因'); return; }
    try {
      await ledgerApi.manual({ store, ym, ledger_code: form.code, entry_type: form.entry_type, amount: Number(form.amount), vendor: form.vendor, reason: form.reason, fee_ym: form.fee_ym || null });
      setForm(null); await loadReport();
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
            {row.name}
            {row.fee_months.length > 0 && <span style={S.tag('#805ad5')}>{row.fee_months.map((m) => `${Number(m.slice(5))}月帳`).join('、')}</span>}
            {row.adjust_count > 0 && <span style={S.tag('#c53030')}>含調帳 {row.adjust_count} 筆</span>}
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
                <span style={{ flex: 1 }}>{String(l.ref_title || '').replace(/^｜|｜$/g, '')}</span>
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

  const Section = ({ groups, title }) => (
    <div style={S.card}>
      <div style={S.cardTitle}>{title}</div>
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
        <select value={ym} onChange={(e) => setYm(e.target.value)} style={S.input}>{months().map((m) => <option key={m} value={m}>{m}</option>)}</select>
        {store && <button style={S.btn} onClick={() => setStore('')}>‹ 全部門市</button>}
        {store && rep && <span style={{ fontWeight: 600 }}>{rep.store_name || store}　<span style={S.tag(closed ? '#2f855a' : '#718096')}>{closed ? '已關帳' : rep.status === 'review' ? '待審閱' : '整理中'}</span></span>}
        <button style={S.btn} onClick={() => (store ? loadReport() : loadOverview())} disabled={loading}>{loading ? '讀取中…' : '重新整理'}</button>
      </div>
      {err && <div style={S.err}>{err}</div>}

      {/* ── 全部門市一覽 ── */}
      {!store && ov && (
        <div style={S.card}>
          {ov.market_error && <div style={S.warn}>⚠ {ov.market_error}（ERP 帳上業績、門市費用單暫時拿不到）</div>}
          <table style={S.table}>
            <thead><tr>{['門市', '總實收', 'ERP 帳上（眼鏡＋隱眼）', '總支出', '總盈餘', '實收', '提醒', ''].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {ov.stores.map((s) => (
                <tr key={s.store}>
                  <td style={S.td}>{s.store_name}<div style={S.sub}>{s.store}</div></td>
                  <td style={{ ...S.td, ...S.num }}>{fmt(s.total_in)}</td>
                  <td style={{ ...S.td, ...S.num, color: '#718096' }}>{fmt(s.erp_total)}</td>
                  <td style={{ ...S.td, ...S.num }}>{fmt(s.total_out)}</td>
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

          <div style={S.card}>
            <div style={S.cardTitle}>業績與實收</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.entries(rep.revenue).map(([code, r]) => (
                <div key={code} style={S.kpi}>
                  <div style={S.sub}>{r.name}</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{r.amount == null ? <span style={{ color: '#c05621' }}>待填</span> : fmt(r.amount)}</div>
                  {r.erp != null && <div style={S.sub}>ERP 帳上 {fmt(r.erp)}{r.amount != null && r.erp !== r.amount ? `（差 ${fmt(r.amount - r.erp)}）` : ''}</div>}
                  {!closed && <button style={S.linkBtn} onClick={() => startForm({ code, name: r.name, group: 'revenue' }, 'value')}>填寫</button>}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontWeight: 600 }}>總實收 {fmt(rep.totals.total_in)}</div>
          </div>

          {form && (
            <div style={{ ...S.card, borderColor: '#3182ce' }}>
              <div style={S.cardTitle}>{form.entry_type === 'adjust' ? '調帳' : '手填'}：{form.name}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <label>金額 <input style={S.input} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={form.entry_type === 'adjust' ? '可填負數' : ''} /></label>
                {(VENDOR_GROUPS.includes(form.group)) && <label>廠商 <input style={S.input} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="例 HOYA、晶碩" /></label>}
                <label>費用月 <select style={S.input} value={form.fee_ym} onChange={(e) => setForm({ ...form, fee_ym: e.target.value })}><option value="">同月報月份</option>{months(6).map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
                <label style={{ flex: 1, minWidth: 220 }}>{form.entry_type === 'adjust' ? '原因（必填）' : '備註'} <input style={{ ...S.input, width: '100%' }} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
              </div>
              {form.entry_type === 'value' && <div style={S.sub}>同一格（同科目、同廠商）只留一筆手填值：再填一次會把舊的作廢、留紀錄。</div>}
              {msg && <div style={S.err}>{msg}</div>}
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}><button style={S.primary} onClick={submit}>送出</button><button style={S.btn} onClick={() => setForm(null)}>取消</button></div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
            <Section title={`營運支出　合計 ${fmt(rep.totals.left_total)}`} groups={rep.left} />
            <Section title={`費用支出　合計 ${fmt(rep.totals.right_total)}`} groups={rep.right} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <div style={S.card}>
              <div style={S.cardTitle}>盈餘</div>
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
            <div style={S.card}>
              <div style={S.cardTitle}>分紅{rep.dividend.cash_label ? `　· ${rep.dividend.cash_label}` : ''}</div>
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
              {rep.shareholders.length === 0 && <div style={S.sub}>還沒設定股東群（第四期：從左手「股東群」匯入）</div>}
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
