// pages/processing/ProcessingPage.jsx — 加工中心開帳（2026-10-20）
// 獨立入口 /processing：加工中心主管用獨立帳密登入（proc_token）；營運部帳號（operation_token）也能直接進
// 流程：選月份 → 填這個月收到、還沒設金額的品項 → 看各店 → 點店看逐單、追加金額 → 正確就「開帳」（寫進門市月報 代工中心代工費）
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const http = axios.create({
  baseURL: isLocal ? '/api/processing' : ((import.meta.env.VITE_API_URL || 'https://operation-backend.onrender.com/api') + '/processing'),
  timeout: 120000,
});
http.interceptors.request.use((c) => {
  const t = localStorage.getItem('proc_token') || localStorage.getItem('operation_token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});
const call = async (fn) => { try { return (await fn()).data; } catch (e) { return e.response?.data || { success: false, message: e.message }; } };

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('zh-TW', { maximumFractionDigits: 2 }));
const thisYm = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7);
const lastYm = () => { const d = new Date(Date.now() + 8 * 3600e3); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };

const C = {
  page: { minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui, -apple-system, "PingFang TC", sans-serif', color: '#1f2933' },
  bar: { background: '#2f4858', color: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  tab: (on) => ({ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', background: on ? '#fff' : 'transparent', color: on ? '#2f4858' : '#fff', fontWeight: 600 }),
  wrap: { maxWidth: 1180, margin: '0 auto', padding: 20 },
  card: { background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.08)', marginBottom: 16 },
  btn: (k = 'p') => ({ padding: '7px 14px', borderRadius: 6, border: k === 'g' ? '1px solid #cbd2d9' : 'none', cursor: 'pointer', fontWeight: 600,
    background: k === 'p' ? '#2f80ed' : k === 'd' ? '#e5484d' : k === 'ok' ? '#2e9e5b' : '#fff', color: k === 'g' ? '#1f2933' : '#fff' }),
  input: { padding: '7px 10px', border: '1px solid #cbd2d9', borderRadius: 6, fontSize: 14 },
  th: { textAlign: 'left', padding: '8px 6px', borderBottom: '2px solid #e4e7eb', fontSize: 13, color: '#52606d', whiteSpace: 'nowrap' },
  td: { padding: '8px 6px', borderBottom: '1px solid #eef0f2', fontSize: 14, verticalAlign: 'top' },
  num: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  tag: (c) => ({ display: 'inline-block', padding: '1px 8px', borderRadius: 10, fontSize: 12, background: c, color: '#fff', marginRight: 4 }),
  help: { fontSize: 13, color: '#616e7c', lineHeight: 1.7 },
};

// 頁內對話框（App 內建瀏覽器的 confirm／prompt 不可靠，陷阱 143）
function Dialog({ d, onClose }) {
  const [v, setV] = useState('');
  useEffect(() => setV(''), [d]);
  if (!d) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ ...C.card, width: 420, maxWidth: '92vw' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{d.title}</div>
        <div style={{ ...C.help, whiteSpace: 'pre-wrap', marginBottom: 12 }}>{d.body}</div>
        {d.input && <input style={{ ...C.input, width: '100%', boxSizing: 'border-box', marginBottom: 12 }} placeholder={d.input} value={v} onChange={(e) => setV(e.target.value)} autoFocus />}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={C.btn('g')} onClick={() => onClose(null)}>取消</button>
          <button style={C.btn(d.danger ? 'd' : 'p')} disabled={d.input && !v.trim()} onClick={() => onClose(d.input ? v.trim() : true)}>{d.ok || '確定'}</button>
        </div>
      </div>
    </div>
  );
}
function useDialog() {
  const [d, setD] = useState(null);
  const ask = (opt) => new Promise((resolve) => setD({ ...opt, resolve }));
  const node = <Dialog d={d} onClose={(r) => { const res = d && d.resolve; setD(null); res && res(r); }} />;
  return [ask, node];
}

function Login({ onDone }) {
  const [f, setF] = useState({ username: '', password: '' });
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    const r = await call(() => http.post('/login', f));
    if (!r.success) return setErr(r.message || '登入失敗');
    localStorage.setItem('proc_token', r.token);
    onDone();
  };
  return (
    <div style={{ ...C.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={submit} style={{ ...C.card, width: 340 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>加工中心開帳</div>
        <div style={{ ...C.help, marginBottom: 16 }}>請用加工中心帳號登入</div>
        {err && <div style={{ color: '#e5484d', marginBottom: 10 }}>⚠ {err}</div>}
        <input style={{ ...C.input, width: '100%', boxSizing: 'border-box', marginBottom: 10 }} placeholder="帳號" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoFocus />
        <input style={{ ...C.input, width: '100%', boxSizing: 'border-box', marginBottom: 14 }} type="password" placeholder="密碼" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <button style={{ ...C.btn('p'), width: '100%' }}>登入</button>
      </form>
    </div>
  );
}

function Guide({ onClose }) {
  return (
    <div style={{ ...C.card, background: '#fffbea', border: '1px solid #f0d78c' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>📖 怎麼用（第一次使用請看一下）</div>
      <div style={C.help}>
        ① <b>填金額</b>：選開帳月份後，上方會列出「這個月收到、還沒設定金額的品項」，直接在每一列填金額（不收費就按「不收費」＝0 元）→ 按「全部存」。存過的品項之後的月份都會自動帶入，不用再填；要改價到「主檔金額」分頁。<br />
        ② <b>開帳</b>：選月份 → 看每家店的張數與金額。算法＝這個月在加工站第一次到「品管消毒完待返回」的單；一張單同一個品項只算一次；沒設金額的品項不算錢。<br />
        ③ 點一家店 → 逐單看品項與金額；要多收或沖銷就按「追加金額」（減少填負數，一定要寫原因）。<br />
        ④ 確認正確 → 按「開帳」，金額就進那家店的門市月報（代工中心代工費）。開帳後要改先按「重新開帳」（門市月報那個月已關帳就只能記在下個月）。<br />
        ⚠ 已取消的單、之前月份已開帳過的單（重工）不會算進來。
      </div>
      <button style={{ ...C.btn('g'), marginTop: 8 }} onClick={onClose}>知道了</button>
    </div>
  );
}

function Prices() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState('');
  const [ask, dlg] = useDialog();
  const load = async () => { const r = await call(() => http.get('/prices')); if (r.success) setList(r.data); };
  useEffect(() => { load(); }, []);
  const search = async (e) => {
    e && e.preventDefault(); if (!q.trim()) return;
    setBusy(true); const r = await call(() => http.get('/products', { params: { q } })); setBusy(false);
    if (!r.success) return setMsg(r.message); setFound(r.data);
  };
  const save = async () => {
    const r = await call(() => http.post('/prices', edit));
    if (!r.success) return setMsg(r.message);
    setMsg(`✅ 已存：${edit.name || edit.bind_id} ${fmt(edit.amount)} 元（${edit.effective_from} 起）`); setEdit(null); load();
  };
  const del = async (p) => {
    if (!(await ask({ title: '刪除這筆金額？', body: `${p.name || p.bind_id}｜${fmt(p.amount)} 元（${p.effective_from} 起）\n已開帳的月份不受影響。`, danger: true, ok: '刪除' }))) return;
    const r = await call(() => http.delete(`/prices/${p.id}`)); if (!r.success) return setMsg(r.message); load();
  };
  const pick = (p) => setEdit({ bind_id: p.bind_id, name: p.name, brand: p.brand, catena: p.catena, model: p.model,
    amount: p.price ? p.price.amount : '', effective_from: thisYm(), note: '' });
  return (
    <>
      {dlg}
      <div style={C.card}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>另外搜尋商品設定金額（通常不用）</div>
        <div style={{ ...C.help, marginBottom: 8 }}>每月收到的品項會自動列在「開帳」頁上方等你填金額；這裡只在想先設定還沒收到的商品時才用。</div>
        <form onSubmit={search} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input style={{ ...C.input, flex: 1, minWidth: 220 }} placeholder="搜尋商品名稱、品牌、系列、型號或商品編號" value={q} onChange={(e) => setQ(e.target.value)} />
          <button style={C.btn('p')} disabled={busy}>{busy ? '搜尋中…' : '搜尋'}</button>
        </form>
        {found && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
            <thead><tr><th style={C.th}>商品</th><th style={C.th}>物料／品牌／系列</th><th style={{ ...C.th, ...C.num }}>目前金額</th><th style={C.th}></th></tr></thead>
            <tbody>
              {found.length === 0 && <tr><td style={C.td} colSpan={4}>找不到，換個關鍵字試試</td></tr>}
              {found.map((p) => (
                <tr key={p.bind_id}>
                  <td style={C.td}>{p.name}{!p.active && <span style={C.tag('#9aa5b1')}>ERP 已下架</span>}<div style={{ fontSize: 12, color: '#9aa5b1' }}>#{p.bind_id}</div></td>
                  <td style={C.td}>{[p.materiel, p.brand, p.catena, p.model].filter(Boolean).join('／')}</td>
                  <td style={{ ...C.td, ...C.num }}>{p.price ? fmt(p.price.amount) : '—'}</td>
                  <td style={C.td}><button style={C.btn('g')} onClick={() => pick(p)}>設定金額</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {edit && (
          <div style={{ marginTop: 12, padding: 12, background: '#f0f4f8', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <b>{edit.name || edit.bind_id}</b>
            <label>金額 <input style={{ ...C.input, width: 110 }} type="number" min="0" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></label>
            <label>從 <input style={{ ...C.input, width: 110 }} type="month" value={edit.effective_from} onChange={(e) => setEdit({ ...edit, effective_from: e.target.value })} /> 起</label>
            <input style={{ ...C.input, flex: 1, minWidth: 140 }} placeholder="備註（選填）" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
            <button style={C.btn('ok')} disabled={edit.amount === '' || Number(edit.amount) < 0} onClick={save}>存</button>
            <button style={C.btn('g')} onClick={() => setEdit(null)}>取消</button>
          </div>
        )}
        {msg && <div style={{ marginTop: 10, ...C.help }}>{msg}</div>}
      </div>
      <div style={C.card}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>已設定的主檔金額（{list.length}）</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={C.th}>商品</th><th style={{ ...C.th, ...C.num }}>金額</th><th style={C.th}>生效月份</th><th style={C.th}>備註</th><th style={C.th}>最後修改</th><th style={C.th}></th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td style={C.td} colSpan={6}>還沒有設定 —— 到「開帳」選月份，上方會列出要填金額的品項</td></tr>}
            {list.map((p) => (
              <tr key={p.id}>
                <td style={C.td}>{p.name || p.bind_id}<div style={{ fontSize: 12, color: '#9aa5b1' }}>#{p.bind_id} {[p.brand, p.catena].filter(Boolean).join('／')}</div></td>
                <td style={{ ...C.td, ...C.num }}>{fmt(p.amount)}</td>
                <td style={C.td}>{p.effective_from} 起</td>
                <td style={C.td}>{p.note}</td>
                <td style={C.td}>{p.updated_by || p.created_by}</td>
                <td style={C.td}><button style={C.btn('g')} onClick={() => pick({ ...p, price: p })}>改</button> <button style={C.btn('g')} onClick={() => del(p)}>刪</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StoreDetail({ ym, store, onBack }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ex, setEx] = useState(null);
  const [filter, setFilter] = useState('all');
  const [ask, dlg] = useDialog();
  const load = async (fresh) => {
    setErr(''); const r = await call(() => http.get(`/months/${ym}/stores/${store}`, { params: fresh ? { fresh: 1 } : {} }));
    if (!r.success) return setErr(r.message); setD(r.data);
  };
  useEffect(() => { load(); }, [ym, store]);
  if (err) return <div style={C.card}>⚠ {err} <button style={C.btn('g')} onClick={onBack}>返回</button></div>;
  if (!d) return <div style={C.card}>讀取加工站資料中…（一個月的單大約要幾秒）</div>;
  const opened = d.opened;
  const rows = (d.orders || []).filter((o) => filter === 'all' || (filter === 'zero' ? o.state === 'count' && !o.amount : filter === 'skip' ? o.state !== 'count' : o.state === 'count' && o.amount));
  const doOpen = async () => {
    const body = `${d.store_name}｜${ym}\n計價 ${d.counted} 張單 ${fmt(d.order_amount)} 元＋追加 ${fmt(d.extra_amount)} 元＝${fmt(d.total)} 元\n開帳後會寫進門市月報「代工中心代工費」。`;
    if (!(await ask({ title: '確定開帳？', body, ok: '開帳' }))) return;
    setBusy(true); const r = await call(() => http.post(`/months/${ym}/stores/${store}/open`)); setBusy(false);
    if (!r.success) return setErr(r.message); load();
  };
  const doReopen = async () => {
    const reason = await ask({ title: '重新開帳', body: '會作廢已開的帳單（門市月報那筆會拿掉），之後可以修改再開帳。', input: '原因（必填）', danger: true, ok: '重新開帳' });
    if (!reason) return;
    setBusy(true); const r = await call(() => http.post(`/months/${ym}/stores/${store}/reopen`, { reason })); setBusy(false);
    if (!r.success) return setErr(r.message); load(true);
  };
  const saveEx = async () => {
    const r = await call(() => http.post('/extra', { ym, store_erpid: store, ...ex }));
    if (!r.success) return setErr(r.message); setEx(null); load();
  };
  const delEx = async (e) => {
    if (!(await ask({ title: '刪除這筆追加？', body: `${fmt(e.amount)} 元｜${e.reason}`, danger: true, ok: '刪除' }))) return;
    const r = await call(() => http.delete(`/extra/${e.id}`)); if (!r.success) return setErr(r.message); load();
  };
  return (
    <>
      {dlg}
      <div style={{ ...C.card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button style={C.btn('g')} onClick={onBack}>‹ 回各店</button>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{d.store_name}｜{ym}</div>
        <div style={{ flex: 1 }} />
        {opened
          ? <><span style={C.tag('#2e9e5b')}>已開帳 {fmt(opened.amount)} 元</span><span style={C.help}>{opened.opened_by}｜{String(opened.opened_at).slice(0, 16).replace('T', ' ')}{opened.report_ym && opened.report_ym !== ym ? `（月報已關帳，列入 ${opened.report_ym}）` : ''}</span>
            <button style={C.btn('d')} disabled={busy} onClick={doReopen}>重新開帳</button></>
          : <button style={C.btn('ok')} disabled={busy} onClick={doOpen}>{busy ? '處理中…' : `開帳 ${fmt(d.total)} 元`}</button>}
      </div>
      {opened && d.diff ? <div style={{ ...C.card, background: '#fff4e5' }}>⚠ 開帳之後資料有變（現在算出來 {fmt(d.total)} 元，比開帳時差 {fmt(d.diff)} 元）。要更新請按「重新開帳」，月報已關帳就記在下個月的追加金額。</div> : null}
      <div style={C.card}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
          <div>計價單：<b>{d.counted}</b> 張／<b>{fmt(d.order_amount)}</b> 元</div>
          <div>沒有計價品項：{d.zero} 張</div>
          <div>不算（已取消／之前月份開帳過）：{(d.canceled || 0) + (d.other_month || 0)} 張</div>
          {d.unsynced ? <div style={{ color: '#c05621' }}>⚠ {d.unsynced} 張品項還沒從 ERP 同步，金額可能不完整</div> : null}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[['all', '全部'], ['priced', '有金額'], ['zero', '沒有計價品項'], ['skip', '不算的']].map(([k, l]) => (
            <button key={k} style={C.btn(filter === k ? 'p' : 'g')} onClick={() => setFilter(k)}>{l}</button>
          ))}
          <div style={{ flex: 1 }} />
          <button style={C.btn('g')} onClick={() => load(true)}>重新抓加工站資料</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={C.th}>訂單</th><th style={C.th}>完成時間</th><th style={C.th}>品項（有金額的標藍）</th><th style={{ ...C.th, ...C.num }}>金額</th><th style={C.th}></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td style={C.td} colSpan={5}>沒有資料</td></tr>}
            {rows.map((o) => (
              <tr key={o.order_number} style={o.state !== 'count' ? { opacity: 0.5 } : null}>
                <td style={C.td}>{o.order_number}{o.state === 'canceled' && <div><span style={C.tag('#9aa5b1')}>已取消</span></div>}{o.state === 'other_month' && <div><span style={C.tag('#9aa5b1')}>{o.other_month} 已開帳</span></div>}{!o.bind_synced && <div><span style={C.tag('#c05621')}>品項未同步</span></div>}</td>
                <td style={C.td}>{o.done_at}</td>
                <td style={C.td}>{o.lines.length === 0 ? <span style={C.help}>（沒有品項資料）</span> : o.lines.map((l) => (
                  <div key={l.bind_id} style={{ color: l.price != null ? '#1d4ed8' : '#9aa5b1', fontSize: 13 }}>{l.name || `#${l.bind_id}`}{l.price != null ? `　${fmt(l.price)}` : ''}</div>))}</td>
                <td style={{ ...C.td, ...C.num, fontWeight: 600 }}>{o.state === 'count' ? fmt(o.amount) : '—'}</td>
                <td style={C.td}>{!opened && o.state === 'count' && <button style={C.btn('g')} onClick={() => setEx({ order_number: o.order_number, amount: '', reason: '' })}>追加金額</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={C.card}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>追加金額（{d.extras.length}）合計 {fmt(d.extra_amount)} 元</div>
          <div style={{ flex: 1 }} />
          {!opened && <button style={C.btn('g')} onClick={() => setEx({ order_number: '', amount: '', reason: '' })}>＋ 追加（不指定訂單）</button>}
        </div>
        {ex && (
          <div style={{ padding: 12, background: '#f0f4f8', borderRadius: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <input style={{ ...C.input, width: 150 }} placeholder="訂單編號（選填）" value={ex.order_number} onChange={(e) => setEx({ ...ex, order_number: e.target.value })} />
            <input style={{ ...C.input, width: 120 }} type="number" placeholder="金額（減少填負數）" value={ex.amount} onChange={(e) => setEx({ ...ex, amount: e.target.value })} />
            <input style={{ ...C.input, flex: 1, minWidth: 180 }} placeholder="原因（必填）" value={ex.reason} onChange={(e) => setEx({ ...ex, reason: e.target.value })} />
            <button style={C.btn('ok')} disabled={!Number(ex.amount) || !ex.reason.trim()} onClick={saveEx}>存</button>
            <button style={C.btn('g')} onClick={() => setEx(null)}>取消</button>
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {d.extras.length === 0 && <tr><td style={C.td}>沒有追加</td></tr>}
            {d.extras.map((e) => (
              <tr key={e.id}><td style={C.td}>{e.order_number || '（不指定訂單）'}</td><td style={{ ...C.td, ...C.num }}>{fmt(e.amount)}</td><td style={C.td}>{e.reason}</td><td style={C.td}>{e.created_by}</td>
                <td style={C.td}>{!opened && <button style={C.btn('g')} onClick={() => delEx(e)}>刪</button>}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// 這個月實際收到、還沒設定金額的品項：直接填，不用自己搜尋主檔（營運 10-20）
function Unpriced({ ym, items, onSaved }) {
  const [val, setVal] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(true);
  useEffect(() => { setVal({}); setMsg(''); }, [ym, items]);
  const filled = items.filter((i) => val[i.bind_id] !== undefined && val[i.bind_id] !== '' && Number(val[i.bind_id]) >= 0);
  const saveAll = async () => {
    setBusy(true); setMsg('');
    const r = await call(() => http.post('/prices/batch', { items: filled.map((i) => ({
      bind_id: i.bind_id, name: i.name, brand: i.brand, catena: i.catena, model: i.model, amount: Number(val[i.bind_id]), effective_from: ym })) }));
    setBusy(false);
    if (!r.success) return setMsg('⚠ ' + r.message);
    setMsg(`✅ 已存 ${r.data.saved} 個品項（${ym} 起）`); onSaved();
  };
  if (!items.length) return <div style={{ ...C.card, background: '#ecfdf3' }}>✅ 這個月收到的品項都已經設定金額了。</div>;
  return (
    <div style={{ ...C.card, border: '2px solid #f0a020' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <b>⚠ 這個月收到、還沒設定金額的品項（{items.length}）</b>
        <span style={C.help}>沒設金額的品項不會算錢；鏡框不列入。填好按「全部存」，{ym} 起的月份都會用這個價。</span>
        <div style={{ flex: 1 }} />
        <button style={C.btn('g')} onClick={() => setOpen(!open)}>{open ? '收起' : '展開'}</button>
      </div>
      {open && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
            <thead><tr><th style={C.th}>品項</th><th style={{ ...C.th, ...C.num }}>張數</th><th style={C.th}>門市</th><th style={C.th}>金額（元）</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.bind_id}>
                  <td style={C.td}>{i.name || `#${i.bind_id}`}<div style={{ fontSize: 12, color: '#9aa5b1' }}>{[i.materiel, i.brand, i.catena].filter(Boolean).join('／')} #{i.bind_id}</div></td>
                  <td style={{ ...C.td, ...C.num }}>{i.orders}</td>
                  <td style={{ ...C.td, fontSize: 13 }}>{i.store_count > 3 ? `${i.stores.slice(0, 3).join('、')} 等 ${i.store_count} 家` : i.stores.join('、')}</td>
                  <td style={{ ...C.td, whiteSpace: 'nowrap' }}>
                    <input style={{ ...C.input, width: 100 }} type="number" min="0" inputMode="decimal" placeholder="填金額"
                      value={val[i.bind_id] ?? ''} onChange={(e) => setVal({ ...val, [i.bind_id]: e.target.value })} />
                    {' '}<button style={C.btn('g')} onClick={() => setVal({ ...val, [i.bind_id]: '0' })}>不收費</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <button style={C.btn('ok')} disabled={busy || !filled.length} onClick={saveAll}>{busy ? '存檔中…' : `全部存（${filled.length}）`}</button>
            {msg && <span style={C.help}>{msg}</span>}
          </div>
        </>
      )}
    </div>
  );
}

function Months() {
  const [ym, setYm] = useState(lastYm());
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [store, setStore] = useState(null);
  const load = async (fresh) => {
    setErr(''); setD(null);
    const r = await call(() => http.get(`/months/${ym}`, { params: fresh ? { fresh: 1 } : {} }));
    if (!r.success) return setErr(r.message); setD(r.data);
  };
  useEffect(() => { if (!store) load(); }, [ym, store]);
  if (store) return <StoreDetail ym={ym} store={store} onBack={() => setStore(null)} />;
  const done = d ? d.stores.filter((s) => s.opened).length : 0;
  return (
    <>
      <div style={{ ...C.card, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <b>開帳月份</b>
        <input style={C.input} type="month" value={ym} onChange={(e) => e.target.value && setYm(e.target.value)} />
        <button style={C.btn('g')} onClick={() => load(true)}>重新抓加工站資料</button>
        <div style={{ flex: 1 }} />
        {d && <div>已開帳 <b>{done}</b>／{d.stores.length} 家｜合計 <b>{fmt(d.total)}</b> 元｜加工站本月完成 {d.feed.count} 張</div>}
      </div>
      {err && <div style={{ ...C.card, color: '#e5484d' }}>⚠ {err}</div>}
      {!d && !err && <div style={C.card}>讀取加工站資料中…</div>}
      {d && d.unpriced && <Unpriced ym={ym} items={d.unpriced} onSaved={() => load()} />}
      {d && (
        <div style={C.card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={C.th}>門市</th><th style={{ ...C.th, ...C.num }}>計價單</th><th style={{ ...C.th, ...C.num }}>單據金額</th><th style={{ ...C.th, ...C.num }}>追加</th><th style={{ ...C.th, ...C.num }}>合計</th><th style={C.th}>狀態</th><th style={C.th}></th></tr></thead>
            <tbody>
              {d.stores.length === 0 && <tr><td style={C.td} colSpan={7}>這個月加工站沒有完成的單</td></tr>}
              {d.stores.map((s) => (
                <tr key={s.store_erpid} style={{ cursor: 'pointer' }} onClick={() => setStore(s.store_erpid)}>
                  <td style={C.td}>{s.store_name}<div style={{ fontSize: 12, color: '#9aa5b1' }}>{s.store_erpid}</div></td>
                  <td style={{ ...C.td, ...C.num }}>{s.counted}{s.zero ? <div style={{ fontSize: 12, color: '#9aa5b1' }}>0 元 {s.zero} 張</div> : null}</td>
                  <td style={{ ...C.td, ...C.num }}>{fmt(s.order_amount)}</td>
                  <td style={{ ...C.td, ...C.num }}>{s.extra_amount ? fmt(s.extra_amount) : ''}</td>
                  <td style={{ ...C.td, ...C.num, fontWeight: 700 }}>{fmt(s.opened ? s.opened.amount : s.total)}</td>
                  <td style={C.td}>{s.opened ? <span style={C.tag('#2e9e5b')}>已開帳</span> : <span style={C.tag('#f0a020')}>待開帳</span>}{s.opened && s.diff ? <span style={C.tag('#e5484d')}>資料有變</span> : null}{s.unsynced ? <span style={C.tag('#c05621')}>{s.unsynced} 張品項未同步</span> : null}</td>
                  <td style={C.td}><button style={C.btn('g')}>查看 ›</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Accounts() {
  const [list, setList] = useState(null);
  const [f, setF] = useState({ username: '', password: '', display_name: '' });
  const [msg, setMsg] = useState('');
  const load = async () => { const r = await call(() => http.get('/accounts')); if (r.success) setList(r.data); else setMsg(r.message); };
  useEffect(() => { load(); }, []);
  const save = async () => { const r = await call(() => http.post('/accounts', f)); setMsg(r.success ? `✅ ${r.data.reset ? '已重設密碼' : '已建立'}：${r.data.username}` : r.message); if (r.success) { setF({ username: '', password: '', display_name: '' }); load(); } };
  const toggle = async (a) => { await call(() => http.patch(`/accounts/${a.id}`, { is_active: !a.is_active })); load(); };
  return (
    <div style={C.card}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>加工中心登入帳號（營運部 super_admin 管理）</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <input style={C.input} placeholder="帳號" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
        <input style={C.input} placeholder="顯示名稱" value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} />
        <input style={C.input} placeholder="密碼（至少 8 碼；同帳號＝重設）" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <button style={C.btn('p')} onClick={save}>建立／重設</button>
      </div>
      {msg && <div style={C.help}>{msg}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>{(list || []).map((a) => (
          <tr key={a.id}><td style={C.td}>{a.username}</td><td style={C.td}>{a.display_name}</td><td style={C.td}>{a.last_login_at ? `最後登入 ${String(a.last_login_at).slice(0, 16).replace('T', ' ')}` : '還沒登入過'}</td>
            <td style={C.td}><button style={C.btn('g')} onClick={() => toggle(a)}>{a.is_active ? '停用' : '啟用'}</button></td></tr>))}</tbody>
      </table>
    </div>
  );
}

export default function ProcessingPage() {
  const [me, setMe] = useState(undefined);
  const [tab, setTab] = useState('months');
  const [guide, setGuide] = useState(() => { try { return !localStorage.getItem('proc_guide_seen'); } catch { return true; } });
  const check = async () => { const r = await call(() => http.get('/me')); setMe(r.success ? r.data : null); };
  useEffect(() => { check(); }, []);
  const tabs = useMemo(() => [['months', '開帳'], ['prices', '主檔金額']].concat(me && me.kind === 'system' && me.role === 'super_admin' ? [['accounts', '帳號']] : []), [me]);
  if (me === undefined) return <div style={{ ...C.page, padding: 40 }}>載入中…</div>;
  if (me === null) return <Login onDone={check} />;
  const logout = () => { localStorage.removeItem('proc_token'); if (me.kind === 'system') window.location.href = '/dashboard'; else setMe(null); };
  return (
    <div style={C.page}>
      <div style={C.bar}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>🔬 加工中心開帳</div>
        {tabs.map(([k, l]) => <button key={k} style={C.tab(tab === k)} onClick={() => setTab(k)}>{l}</button>)}
        <div style={{ flex: 1 }} />
        <button style={C.tab(false)} onClick={() => setGuide(true)}>？說明</button>
        <span>{me.name}</span>
        <button style={C.tab(false)} onClick={logout}>{me.kind === 'system' ? '回營運部' : '登出'}</button>
      </div>
      <div style={C.wrap}>
        {guide && <Guide onClose={() => { setGuide(false); try { localStorage.setItem('proc_guide_seen', '1'); } catch { /* */ } }} />}
        {tab === 'months' && <Months />}
        {tab === 'prices' && <Prices />}
        {tab === 'accounts' && <Accounts />}
      </div>
    </div>
  );
}
