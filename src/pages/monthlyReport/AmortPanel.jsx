// 月報「🗓 分攤開帳」（2026-10-20）：一筆金額分好幾個月，列入同一家店的同一個科目
// 每月＝總額÷月數（取整），零頭放最後一個月；任何一個月已關帳就不能建；作廢只作廢還沒關帳的月份
import { useEffect, useState, useCallback } from 'react';
import { ledgerApi } from '../../services/api';
import HelpTip from '../../components/help/HelpTip';
import VoucherBox, { canSeeVouchers } from '../../components/vouchers/VoucherBox';
import { useAuth } from '../../contexts/AuthContext';
import SubjectSelect, { loadSubjects } from '../../components/ledger/SubjectSelect';

const GROUPS = { opex: '營運支出', planning: '企劃品', ads: '廣告費', misc: '雜費', frame: '鏡框', lens: '鏡片', contact: '藥拋' };
const errMsg = (e) => (e && e.response && e.response.data && e.response.data.message) || (e && e.message) || '失敗';
const fmt = (n) => Number(n || 0).toLocaleString();
const addYm = (ym, k) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 7); };

export default function AmortPanel({ ym, stores, store: fixedStore, onDone }) {
  const [open, setOpen] = useState(!!fixedStore);
  const [accs, setAccs] = useState([]);
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState([]);
  const [vg, setVg] = useState(null);   // 展開憑證的分攤組
  const { user } = useAuth();
  const showV = canSeeVouchers(user);
  const [f, setF] = useState({ store: fixedStore || '', ledger_code: '', subject_id: '', total: '', from_ym: ym, months: 12, vendor: '', reason: '' });
  useEffect(() => { setF((x) => ({ ...x, store: fixedStore || x.store, from_ym: x.from_ym || ym })); }, [fixedStore, ym]);

  const load = useCallback(async () => {
    try {
      const [a, l] = await Promise.all([ledgerApi.accounts(), ledgerApi.amortList(fixedStore)]);
      setAccs((a.data || []).filter((x) => x.kind === 'expense' && x.is_active !== false)); setList(l.data || []);
    } catch (e) { setMsg(errMsg(e)); }
  }, [fixedStore]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const n = Math.floor(Number(f.months)) || 0, total = Math.round(Number(f.total)) || 0;
  const each = n >= 2 ? Math.trunc(total / n) : 0, last = total - each * (n - 1);
  const ok = f.store && f.subject_id && total && n >= 2 && n <= 60 && /^\d{4}-\d{2}$/.test(f.from_ym) && f.reason.trim();
  const save = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await ledgerApi.amortAdd({ ...f, total, months: n });
      let up = '';
      if (files.length && r.data.group) { try { await ledgerApi.voucherUpload('amort', r.data.group, files); up = `，憑證 ${files.length} 個已上傳`; } catch (e) { up = `，但憑證上傳失敗：${errMsg(e)}（在下面那列「📎」補傳）`; } }
      setFiles([]);
      setMsg(`已建立：${r.data.months[0]}～${r.data.months[r.data.months.length - 1]}，每月 ${fmt(r.data.each)}${r.data.last !== r.data.each ? `（最後一個月 ${fmt(r.data.last)}）` : ''}${up}`);
      setF({ ...f, total: '', vendor: '', reason: '' }); load(); onDone && onDone();
    } catch (e) { setMsg(errMsg(e)); }
    setBusy(false);
  };
  const voidG = async (g) => {
    if (!window.confirm(`作廢這筆分攤？已關帳的月份會留著，其餘月份全部拿掉。`)) return;
    try { const r = await ledgerApi.amortDel(g.group); setMsg(`已作廢 ${r.data.voided} 個月${r.data.kept_closed.length ? `；${r.data.kept_closed.join('、')} 已關帳沒動` : ''}`); load(); onDone && onDone(); }
    catch (e) { setMsg(errMsg(e)); }
  };
  const [subs, setSubs] = useState([]);
  useEffect(() => { loadSubjects().then(setSubs).catch(() => {}); }, [list]);
  const accName = (c) => (accs.find((a) => a.code === c) || {}).name || c;
  const subName = (id) => (subs.find((x) => x.id === id) || {}).name;
  const storeName = (s) => ((stores || []).find((x) => x.store === s) || {}).store_name || s;

  return (
    <div style={S.card} data-yaya="mr-amort">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <b>🗓 分攤開帳</b>
        <HelpTip title="分攤開帳怎麼用" body={'一筆費用要分好幾個月算（例：招牌 6 萬分 12 個月、年度保險、整修），在這裡填一次就好。\n1. 選門市、月報上的哪一格（科目）、總金額、從哪個月開始、分幾個月。\n2. 每個月＝總額÷月數（取整數），除不盡的零頭放最後一個月。\n3. 建好後每個月的月報那一格都會多一筆「分攤」，點開看得到是第幾期。\n4. 要分攤的月份裡有任何一個已關帳就不能建，請從之後的月份開始。\n5. 填錯可以按「作廢」：已關帳的月份會留著，其他月份全部拿掉，再重建一筆。\n要新的科目（例：營運雜貨）先到「⚙ 科目與廠商 → ① 新增月報科目」。'} />
        <span style={S.sub}>一筆金額分好幾個月列入月報</span>
        {!fixedStore && <button style={S.link} onClick={() => setOpen(!open)}>{open ? '收起' : '打開'}</button>}
      </div>
      {open && <div style={{ marginTop: 8 }}>
        {msg && <div style={{ fontSize: 13, color: '#2c5282', marginBottom: 6 }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {!fixedStore && <select style={S.input} value={f.store} onChange={(e) => setF({ ...f, store: e.target.value })}>
            <option value="">選門市</option>{(stores || []).map((s) => <option key={s.store} value={s.store}>{s.store_name}</option>)}
          </select>}
          <SubjectSelect value={f.subject_id} onChange={(sj) => setF({ ...f, subject_id: sj ? sj.id : '', ledger_code: sj ? sj.ledger_code : '' })} />
          <input style={{ ...S.input, width: 110 }} type="number" placeholder="總金額" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} />
          從 <input style={{ ...S.input, width: 110 }} type="month" value={f.from_ym} onChange={(e) => setF({ ...f, from_ym: e.target.value })} />
          分 <input style={{ ...S.input, width: 60 }} type="number" min="2" max="60" value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })} /> 個月
          <input style={{ ...S.input, width: 120 }} placeholder="廠商（選填）" value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} />
          <input style={{ ...S.input, minWidth: 200, flex: 1 }} placeholder="說明（必填，例：招牌更換）" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          <button style={S.btn} disabled={!ok || busy} onClick={save}>建立分攤</button>
        </div>
        {showV && <div style={{ marginTop: 6, fontSize: 13 }}>原始憑證（照片／PDF）：<input type="file" accept="image/*,application/pdf" multiple onChange={(e) => setFiles([...e.target.files])} />{files.length > 0 && <span style={S.sub}>　{files.length} 個檔案，建立後一起上傳</span>}</div>}
        {n >= 2 && total ? <div style={{ ...S.sub, marginTop: 4 }}>{f.from_ym}～{/^\d{4}-\d{2}$/.test(f.from_ym) ? addYm(f.from_ym, n - 1) : '?'}，每月 {fmt(each)}{last !== each ? `，最後一個月 ${fmt(last)}` : ''}</div> : null}
        {list.length > 0 && <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 10 }}>
          <thead><tr>{[!fixedStore && '門市', '格子／科目', '說明', '總額', '期間', '已關帳／作廢', ''].filter((h) => h !== false).map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{list.map((g) => {
            const live = g.months.filter((m) => !m.void);
            return (
              <tr key={g.group} style={{ opacity: live.length ? 1 : 0.5 }}>
                {!fixedStore && <td style={S.td}>{storeName(g.store)}</td>}
                <td style={S.td}>{accName(g.ledger_code)}{g.subject_id && subName(g.subject_id) ? <div style={S.sub}>{subName(g.subject_id)}</div>
                  : <div><SubjectSelect ledgerCode={g.ledger_code} value="" placeholder="補選科目" style={{ fontSize: 12, padding: 2 }} onChange={async (sj) => { if (!sj || !g.months[0]) return; try { await ledgerApi.manualSubject(g.months[0].id, sj.id); load(); } catch (e) { setMsg(errMsg(e)); } }} /></div>}</td>
                <td style={S.td}>{g.reason}{g.vendor ? <span style={S.sub}>　{g.vendor}</span> : ''}<div style={S.sub}>{g.created_by || ''}</div></td>
                <td style={{ ...S.td, textAlign: 'right' }}>{fmt(g.total)}</td>
                <td style={S.td}>{g.from_ym}～{g.to_ym}（{g.n} 期）</td>
                <td style={S.td}>{live.length ? `剩 ${live.length} 期有效` : '已作廢'}</td>
                <td style={S.td}>
                  {showV && <button style={{ ...S.link, marginRight: 8 }} onClick={() => setVg(vg === g.group ? null : g.group)}>📎 憑證</button>}
                  {live.length > 0 && <button style={S.link} onClick={() => voidG(g)}>作廢</button>}
                  {vg === g.group && <VoucherBox refType="amort" refId={g.group} />}
                </td>
              </tr>
            );
          })}</tbody>
        </table>}
      </div>}
    </div>
  );
}

const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 },
  sub: { fontSize: 12, color: '#718096' },
  btn: { padding: '4px 12px', border: '1px solid #3182ce', borderRadius: 6, background: '#3182ce', color: '#fff', cursor: 'pointer', fontSize: 13 },
  link: { border: 'none', background: 'none', color: '#3182ce', cursor: 'pointer', padding: 0, fontSize: 13 },
  input: { padding: 4, border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13 },
  th: { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0', color: '#718096', fontWeight: 500 },
  td: { padding: '4px 8px', borderBottom: '1px solid #edf2f7' },
};
