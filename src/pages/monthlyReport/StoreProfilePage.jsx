// 門市基礎設定（2026-10-20，合約 C2）：一家店一頁
// 房租合約（月報引用）＋基本資料（房租／電／水／電話網路／金雞）＋固定支出與近 6 個月付款狀態＋行銷基金／折舊＋股東
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ledgerApi, recurringExpensesApi } from '../../services/api';

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
              <div><b>{r.name}</b> <span style={S.sub}>{r.payment_method || ''}｜收款 {r.payee_name || '—'}｜每月 {r.cycle_day || '?'} 號｜{fmt(r.amount)}{r.is_active ? '' : '｜已停用'}</span></div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {r.payments.map((p) => <span key={p.year_month} title={p.paid_at ? `付款 ${String(p.paid_at).slice(0, 10)}` : `到期 ${p.due_date || ''}`}
                  style={S.tag(p.status === 'paid' ? '#2f855a' : (p.due_date && p.due_date < new Date().toISOString().slice(0, 10)) ? '#c53030' : '#a0aec0')}>{p.year_month.slice(5)} 月 {p.status === 'paid' ? '已付' : '未付'}</span>)}
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
          <div style={S.card}>
            <div style={S.h}>📈 行銷基金／折舊（每月固定）</div>
            {d.fixed.length === 0 && <div style={S.sub}>還沒設（在門市月報頁設定）。</div>}
            {d.fixed.map((f) => <div key={f.id} style={{ fontSize: 13 }}>{f.ledger_code === 'marketing_fund' ? '行銷基金' : '折舊'} {fmt(f.amount)}／月｜{f.from_ym} ～ {f.to_ym || '至今'}{f.note ? `｜${f.note}` : ''}</div>)}
          </div>
          <div style={S.card}>
            <div style={S.h}>👥 股東</div>
            {d.shareholders.length === 0 && <div style={S.sub}>還沒設。</div>}
            {d.shareholders.map((h) => <div key={h.id} style={{ fontSize: 13 }}>{h.name} {h.shares}%</div>)}
          </div>
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
};
