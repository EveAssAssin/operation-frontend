// 門市基礎設定（2026-10-20，合約 C2）：一家店一頁
// 房租合約（月報引用）＋基本資料（房租／電／水／電話網路／金雞）＋固定支出與近 6 個月付款狀態＋行銷基金／折舊＋股東
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ledgerApi, recurringExpensesApi, contractsApi } from '../../services/api';

const fmt = (n) => (n == null || n === '' ? '—' : Math.round(Number(n)).toLocaleString('zh-TW'));
const errMsg = (e) => (e && e.response && e.response.data && e.response.data.message) || (e && e.message) || '讀取失敗';
const thisYm = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7);

export default function StoreProfilePage() {
  const [sp, setSp] = useSearchParams();
  const store = sp.get('store') || '';
  const ym = sp.get('ym') || thisYm();
  const [stores, setStores] = useState([]);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { recurringExpensesApi.getStores().then((r) => setStores(r.data || [])).catch(() => {}); }, []);
  const load = useCallback(async () => {
    if (!store) { setD(null); return; }
    setLoading(true); setErr('');
    try { const r = await ledgerApi.storeProfile(store, ym); setD(r.data); } catch (e) { setErr(errMsg(e)); }
    setLoading(false);
  }, [store, ym]);
  useEffect(() => { load(); }, [load]);

  const rentCons = d ? d.contracts.filter((c) => c.type === 'rent') : [];
  const otherCons = d ? d.contracts.filter((c) => c.type !== 'rent') : [];
  const rentBasic = d ? d.basics.find((b) => b.category === '房租') : null;
  const useActual = rentCons.some((c) => c.purpose === 'actual' && c.status !== 'archived');

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>🏪 門市基礎設定</h2>
        <select style={S.input} value={store} onChange={(e) => setSp({ store: e.target.value, ym })}>
          <option value="">— 選門市 —</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="month" style={S.input} value={ym} onChange={(e) => setSp({ store, ym: e.target.value })} />
        {store && <Link style={S.link} to={`/monthly-report?store=${store}&ym=${ym}`}>📒 看這家店 {ym} 月報</Link>}
        <Link style={S.link} to="/contracts">📄 合約管理</Link>
        {loading && <span style={S.sub}>讀取中…</span>}
      </div>
      {err && <div style={{ color: '#c53030' }}>{err}</div>}
      {!store && <div style={S.sub}>選一家門市，看它的房租合約、基本資料、固定支出付款狀態、行銷基金折舊和股東。</div>}
      {!store && <OpenChecks stores={stores} onPick={(id) => setSp({ store: id, ym })} />}

      {d && <>
        <div style={S.card} data-yaya="sp-rent">
          <div style={S.h}>🏠 房租（月報引用：{useActual ? '實際合約' : rentCons.length ? '只有報稅版合約' : rentBasic ? '還沒有合約，暫用基本資料' : '沒有資料'}）</div>
          {rentCons.length === 0 && <div style={{ color: '#c05621', fontSize: 13 }}>這家店還沒有房租合約。到「合約管理 → 房租合約」新增並選這家門市，月報就會改用合約金額。</div>}
          {rentCons.map((c) => (
            <div key={c.id} style={{ ...S.row, opacity: c.status === 'archived' ? 0.55 : 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <b>{c.name}</b>
                <span style={S.tag(c.purpose === 'tax' ? '#b7791f' : '#2f855a')}>{c.purpose === 'tax' ? '報稅版' : '實際'}</span>
                {c.status === 'archived' && <span style={S.tag('#a0aec0')}>已封存</span>}
                {c.renewed_from && <span style={S.sub}>（續約）</span>}
                <span style={S.sub}>房東 {c.party_name || '—'}｜{c.start_date || '?'} ～ {c.end_date || '?'}</span>
                {c.days_left != null && c.status !== 'archived' && <span style={{ fontSize: 12, color: c.days_left < 0 ? '#c53030' : c.days_left < 90 ? '#c05621' : '#718096' }}>{c.days_left < 0 ? `已到期 ${-c.days_left} 天` : `剩 ${c.days_left} 天`}</span>}
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                {ym} 月報金額 <b>{fmt(c.this_month && c.this_month.amount)}</b>{c.this_month && c.this_month.days < c.this_month.dim ? `（${c.this_month.days}/${c.this_month.dim} 天）` : ''}
                ｜押金 {fmt((c.type_data || {}).deposit)}
                {((c.type_data || {}).rent_schedule || []).length > 1 && <span>｜分段：{c.type_data.rent_schedule.map((x) => `${x.from_date} 起 ${fmt(x.monthly_amount)}`).join('、')}</span>}
              </div>
              {c.status !== 'archived' && <ContractPayees contract={c} recurring={d.recurring} onDone={load} />}
            </div>
          ))}
          {rentBasic && (
            <div style={{ marginTop: 8 }}>
              <div style={S.sub}>基本資料（營運部「基本資料」頁）</div>
              <div style={S.kv}>{rentBasic.rows.map((r) => <span key={r.key}><span style={S.sub}>{r.label}</span> {r.value}</span>)}</div>
            </div>
          )}
        </div>

        <div style={S.card} data-yaya="sp-pay">
          <div style={S.h}>💳 固定支出與付款狀態（近 6 個月）</div>
          {d.recurring.length === 0 && <div style={S.sub}>這家店的固定支出還沒綁門市（營運部「固定支出」要選門市才會出現在這裡）。</div>}
          {d.recurring.map((r) => (
            <div key={r.id} style={S.row}>
              <div><b>{r.name}</b> <span style={S.sub}>{r.payment_method || ''}｜收款 {r.payee_name || '—'}｜每月 {r.cycle_day || '?'} 號｜{fmt(r.amount)}{r.is_active ? '' : '｜已停用'}{r.contract_id ? `｜🔗 連動合約（${Math.round(Number(r.contract_share) * 10000) / 100}%）` : ''}</span></div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {r.payments.map((p) => <PayChip key={p.year_month} p={p} method={r.payment_method} onDone={load} />)}
                {r.payments.length === 0 && <span style={S.sub}>近 6 個月沒有付款紀錄</span>}
              </div>
            </div>
          ))}
        </div>

        <div style={S.card}>
          <div style={S.h}>📋 基本資料</div>
          {d.basics.filter((b) => b.category !== '房租').map((b) => (
            <div key={b.id} style={S.row}>
              <b>{b.category}</b> <span style={S.sub}>更新 {String(b.updated_at || '').slice(0, 10)}</span>
              <div style={S.kv}>{b.rows.map((r) => <span key={r.key}><span style={S.sub}>{r.label}</span> {String(r.value)}</span>)}</div>
            </div>
          ))}
          {d.basics.length === 0 && <div style={S.sub}>還沒有基本資料。</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <FixedEditor store={store} items={d.fixed} onDone={load} />
          <HolderEditor store={store} ym={ym} items={d.shareholders} onDone={load} />
        </div>

        {otherCons.length > 0 && (
          <div style={S.card}>
            <div style={S.h}>📄 其他合約</div>
            {otherCons.map((c) => <div key={c.id} style={{ fontSize: 13 }}>{c.name}｜{c.party_name || ''}｜{c.start_date || '?'} ～ {c.end_date || '?'}</div>)}
          </div>
        )}
      </>}
    </div>
  );
}

const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 },
  h: { fontWeight: 700, marginBottom: 8 },
  sub: { fontSize: 12, color: '#718096' },
  row: { padding: '8px 0', borderTop: '1px solid #edf2f7' },
  kv: { display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 13, marginTop: 4 },
  tag: (c) => ({ fontSize: 11, color: '#fff', background: c, borderRadius: 10, padding: '1px 8px' }),
  input: { padding: 6, border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 14 },
  link: { fontSize: 13, color: '#3182ce' },
  btn: { padding: '4px 10px', border: '1px solid #cbd5e0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 },
  btnLink: { border: 'none', background: 'none', color: '#3182ce', cursor: 'pointer', padding: 0, fontSize: 12 },
};

// 行銷基金／折舊：每月固定金額（月報「可分配盈餘」先扣這兩項）
function FixedEditor({ store, items, onDone }) {
  const [f, setF] = useState({ ledger_code: 'marketing_fund', amount: '', from_ym: thisYm(), to_ym: '', note: '' });
  const [msg, setMsg] = useState('');
  const add = async () => {
    try { await ledgerApi.addFixed({ store, ...f, amount: Number(f.amount) }); setF({ ...f, amount: '', note: '' }); setMsg('已新增'); onDone(); } catch (e) { setMsg(errMsg(e)); }
  };
  const del = async (id) => { try { await ledgerApi.delFixed(id); onDone(); } catch (e) { setMsg(errMsg(e)); } };
  return (
    <div style={S.card} data-yaya="sp-fixed">
      <div style={S.h}>📈 行銷基金／折舊（每月固定）</div>
      {items.length === 0 && <div style={S.sub}>還沒設。</div>}
      {items.map((x) => <div key={x.id} style={{ fontSize: 13, display: 'flex', gap: 8 }}>
        <span>{x.ledger_code === 'marketing_fund' ? '行銷基金' : '折舊'} {fmt(x.amount)}／月｜{x.from_ym} ～ {x.to_ym || '至今'}{x.note ? `｜${x.note}` : ''}</span>
        <button style={S.btnLink} onClick={() => del(x.id)}>刪除</button></div>)}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <select style={S.input} value={f.ledger_code} onChange={(e) => setF({ ...f, ledger_code: e.target.value })}><option value="marketing_fund">行銷基金</option><option value="depreciation">折舊</option></select>
        <input style={{ ...S.input, width: 100 }} placeholder="每月金額" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <input style={S.input} type="month" value={f.from_ym} onChange={(e) => setF({ ...f, from_ym: e.target.value })} />
        <input style={S.input} type="month" value={f.to_ym} onChange={(e) => setF({ ...f, to_ym: e.target.value })} title="結束月份（空白＝至今）" />
        <input style={{ ...S.input, minWidth: 120 }} placeholder="備註" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <button style={S.btn} disabled={!f.amount} onClick={add}>新增</button>
      </div>
      {msg && <div style={S.sub}>{msg}</div>}
    </div>
  );
}

// 股東：姓名＋持股 %＋起訖月份；同一期間合計不能超過 100%；比例變了＝舊的設結束月份、再新增一筆（保留歷史）
function HolderEditor({ store, ym, items, onDone }) {
  const [f, setF] = useState({ name: '', shares: '', from_ym: ym, to_ym: '' });
  const [msg, setMsg] = useState('');
  const active = items.filter((h) => h.from_ym <= ym && (!h.to_ym || h.to_ym >= ym));
  const sum = active.reduce((a, h) => a + h.shares, 0);
  const add = async () => {
    try { await ledgerApi.addHolder({ store, ...f, shares: Number(f.shares) }); setF({ ...f, name: '', shares: '' }); setMsg('已新增'); onDone(); } catch (e) { setMsg(errMsg(e)); }
  };
  const end = async (id) => { try { await ledgerApi.patchHolder(id, { to_ym: ym }); onDone(); } catch (e) { setMsg(errMsg(e)); } };
  const del = async (id) => { try { await ledgerApi.delHolder(id); onDone(); } catch (e) { setMsg(errMsg(e)); } };
  return (
    <div style={S.card} data-yaya="sp-holders">
      <div style={S.h}>👥 股東 <span style={S.sub}>{ym} 合計 {sum}%{sum !== 100 && items.length ? '（不是 100%）' : ''}</span></div>
      {items.length === 0 && <div style={S.sub}>還沒設。月報的可分配盈餘會依這裡的持股比例分給股東。</div>}
      {items.map((h) => <div key={h.id} style={{ fontSize: 13, display: 'flex', gap: 8, opacity: active.includes(h) ? 1 : 0.5 }}>
        <span>{h.name} {h.shares}%｜{h.from_ym} ～ {h.to_ym || '至今'}</span>
        {!h.to_ym && <button style={S.btnLink} onClick={() => end(h.id)}>到 {ym} 為止</button>}
        <button style={S.btnLink} onClick={() => del(h.id)}>刪除</button></div>)}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <input style={{ ...S.input, width: 110 }} placeholder="姓名" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input style={{ ...S.input, width: 70 }} placeholder="持股%" value={f.shares} onChange={(e) => setF({ ...f, shares: e.target.value })} />
        <input style={S.input} type="month" value={f.from_ym} onChange={(e) => setF({ ...f, from_ym: e.target.value })} />
        <input style={S.input} type="month" value={f.to_ym} onChange={(e) => setF({ ...f, to_ym: e.target.value })} title="結束月份（空白＝至今）" />
        <button style={S.btn} disabled={!f.name || !f.shares} onClick={add}>新增</button>
      </div>
      {msg && <div style={S.sub}>{msg}</div>}
    </div>
  );
}

const isCheck = (m) => /支票|票/.test(String(m || ''));
// 一期應付：點開可填支票（票號、開票日、票面到期日、兌現日）
function PayChip({ p, method, onDone }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ check_no: p.check_no || '', check_issue_date: p.check_issue_date || '', check_due_date: p.check_due_date || '', check_cashed_date: p.check_cashed_date || '', check_note: p.check_note || '' });
  const [msg, setMsg] = useState('');
  const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  const overdue = p.check_no && !p.check_cashed_date && p.check_due_date && p.check_due_date < today;
  const color = p.check_no ? (p.check_cashed_date ? '#2f855a' : overdue ? '#c53030' : '#b7791f') : p.status === 'paid' ? '#2f855a' : (p.due_date && p.due_date < today) ? '#c53030' : '#a0aec0';
  const label = p.check_no ? (p.check_cashed_date ? '已兌現' : overdue ? '票到期未兌現' : '已開票') : p.status === 'paid' ? '已付' : '未付';
  const save = async () => { try { await recurringExpensesApi.updateCheck(p.id, f); setOpen(false); onDone(); } catch (e) { setMsg(errMsg(e)); } };
  return (
    <span style={{ display: 'inline-block', position: 'relative' }}>
      <span style={{ ...S.tag(color), cursor: 'pointer' }} onClick={() => setOpen(!open)} title={`${fmt(p.amount)}｜到期 ${p.due_date || ''}${p.check_no ? `｜票號 ${p.check_no}` : ''}`}>{p.year_month.slice(5)} 月 {label}</span>
      {open && (
        <div style={{ ...S.card, position: 'absolute', zIndex: 10, padding: 10, marginTop: 4, width: 300 }}>
          <div style={S.sub}>{p.year_month}｜應付 {fmt(p.amount)}｜{p.status === 'paid' ? '已付' : '未付'}{isCheck(method) ? '' : `｜付款方式 ${method || '—'}`}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 4, marginTop: 6, fontSize: 13 }}>
            <span>票號</span><input style={S.input} value={f.check_no} onChange={(e) => setF({ ...f, check_no: e.target.value })} />
            <span>開票日</span><input style={S.input} type="date" value={f.check_issue_date} onChange={(e) => setF({ ...f, check_issue_date: e.target.value })} />
            <span>票面到期</span><input style={S.input} type="date" value={f.check_due_date} onChange={(e) => setF({ ...f, check_due_date: e.target.value })} />
            <span>兌現日</span><input style={S.input} type="date" value={f.check_cashed_date} onChange={(e) => setF({ ...f, check_cashed_date: e.target.value })} />
            <span>備註</span><input style={S.input} value={f.check_note} onChange={(e) => setF({ ...f, check_note: e.target.value })} />
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 8 }}><button style={S.btn} onClick={save}>存</button><button style={S.btnLink} onClick={() => setOpen(false)}>關閉</button></div>
          {msg && <div style={{ color: '#c53030', fontSize: 12 }}>{msg}</div>}
        </div>
      )}
    </span>
  );
}

// 合約的收款人（＝連動的固定支出）：把現有固定支出連過來，或新增一位收款人
function ContractPayees({ contract, recurring, onDone }) {
  const linked = recurring.filter((r) => r.contract_id === contract.id);
  const free = recurring.filter((r) => !r.contract_id && r.is_active);
  const [pick, setPick] = useState('');
  const [add, setAdd] = useState(null);
  const [msg, setMsg] = useState('');
  const link = async () => { try { await contractsApi.linkExpense(contract.id, pick); setPick(''); onDone(); } catch (e) { setMsg(errMsg(e)); } };
  const unlink = async (id) => { try { await contractsApi.unlinkExpense(id); onDone(); } catch (e) { setMsg(errMsg(e)); } };
  const create = async () => { try { await contractsApi.addPayee(contract.id, { ...add, amount: Number(add.amount), cycle_day: Number(add.cycle_day) }); setAdd(null); onDone(); } catch (e) { setMsg(errMsg(e)); } };
  const sum = linked.reduce((a, r) => a + Number(r.contract_share || 0), 0);
  return (
    <div style={{ marginTop: 6, padding: 8, background: '#f7fafc', borderRadius: 6 }} data-yaya="sp-payees">
      <div style={{ fontSize: 13 }}><b>💳 付款連動</b> <span style={S.sub}>每月應付＝合約當月金額 × 比例（已扣代扣稅）；合約調漲自動跟著變、到期自動停</span></div>
      {linked.length === 0 && <div style={S.sub}>還沒連動：把下面的固定支出連過來，或新增收款人。</div>}
      {linked.map((r) => <div key={r.id} style={{ fontSize: 13 }}>{r.payee_name || r.name}｜{r.payment_method || '—'}｜{Math.round(Number(r.contract_share) * 10000) / 100}%（本月約 {fmt((contract.this_month && contract.this_month.amount || 0) * Number(r.contract_share))}）
        <button style={{ ...S.btnLink, marginLeft: 6 }} onClick={() => unlink(r.id)}>取消連動</button></div>)}
      {linked.length > 0 && <div style={S.sub}>比例合計 {Math.round(sum * 10000) / 100}%（剩下的是代扣稅、二代健保）</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
        {free.length > 0 && <>
          <select style={S.input} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">— 把固定支出連過來 —</option>{free.map((r) => <option key={r.id} value={r.id}>{r.name}（{fmt(r.amount)}）</option>)}</select>
          <button style={S.btn} disabled={!pick} onClick={link}>連動</button>
        </>}
        <button style={S.btn} onClick={() => setAdd(add ? null : { payee_name: '', amount: '', payment_method: '匯款', cycle_day: 5, bank_code: '', bank_branch: '', bank_account: '' })}>＋ 新增收款人</button>
      </div>
      {add && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          <input style={{ ...S.input, width: 100 }} placeholder="收款人" value={add.payee_name} onChange={(e) => setAdd({ ...add, payee_name: e.target.value })} />
          <input style={{ ...S.input, width: 110 }} placeholder="每月實拿金額" value={add.amount} onChange={(e) => setAdd({ ...add, amount: e.target.value })} />
          <select style={S.input} value={add.payment_method} onChange={(e) => setAdd({ ...add, payment_method: e.target.value })}>{['匯款', '支票', '現金繳納', '其他'].map((m) => <option key={m}>{m}</option>)}</select>
          <input style={{ ...S.input, width: 70 }} placeholder="每月幾號" value={add.cycle_day} onChange={(e) => setAdd({ ...add, cycle_day: e.target.value })} />
          {add.payment_method === '匯款' && <>
            <input style={{ ...S.input, width: 70 }} placeholder="銀行代碼" value={add.bank_code} onChange={(e) => setAdd({ ...add, bank_code: e.target.value })} />
            <input style={{ ...S.input, width: 90 }} placeholder="分行" value={add.bank_branch} onChange={(e) => setAdd({ ...add, bank_branch: e.target.value })} />
            <input style={{ ...S.input, width: 140 }} placeholder="帳號" value={add.bank_account} onChange={(e) => setAdd({ ...add, bank_account: e.target.value })} />
          </>}
          <button style={S.btn} disabled={!add.payee_name || !add.amount} onClick={create}>建立</button>
        </div>
      )}
      {msg && <div style={{ color: '#c53030', fontSize: 12 }}>{msg}</div>}
    </div>
  );
}

// 全公司：開了還沒兌現的支票（票面到期日過了＝紅字）
function OpenChecks({ stores, onPick }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { recurringExpensesApi.openChecks().then((r) => setRows(r.data || [])).catch(() => setRows([])); }, []);
  const name = (id) => (stores.find((s) => s.id === id) || {}).name || id || '—';
  const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  if (!rows) return null;
  return (
    <div style={{ ...S.card, marginTop: 12 }} data-yaya="sp-checks">
      <div style={S.h}>🧾 還沒兌現的支票（{rows.length}）</div>
      {rows.length === 0 && <div style={S.sub}>沒有。</div>}
      {rows.map((r) => { const e = r.recurring_expenses || {}; const late = r.check_due_date && r.check_due_date < today;
        return <div key={r.id} style={{ fontSize: 13, color: late ? '#c53030' : undefined }}>
          <a style={S.link} href="#" onClick={(ev) => { ev.preventDefault(); onPick(e.store_erpid); }}>{name(e.store_erpid)}</a>｜{e.payee_name || e.name}｜{r.year_month}｜{fmt(r.amount)}｜票號 {r.check_no}｜到期 {r.check_due_date || '—'}{late ? '（已過到期日）' : ''}</div>; })}
    </div>
  );
}
