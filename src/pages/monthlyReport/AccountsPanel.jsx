// 月報「⚙ 科目與廠商」（2026-10-20）：
// ① 新增月報科目（選放在哪一區，月報自動多一格）② 每個廠商／部門、它的每個會計科目 → 選月報上的哪一格
// 帳單歸格順序：分攤列 → 帳單 → 廠商的會計科目 → 廠商預設 → 都沒設就落「其他」（查帳提醒會抓）
import { useEffect, useState, useCallback } from 'react';
import { ledgerApi } from '../../services/api';

const GROUPS = { opex: '營運支出', planning: '企劃品', ads: '廣告費', misc: '雜費', frame: '鏡框', lens: '鏡片', contact: '藥拋' };
const RATIO = ['營運費用', '人事', '鏡框', '鏡片', '藥拋', '包裝'];
const errMsg = (e) => (e && e.response && e.response.data && e.response.data.message) || (e && e.message) || '失敗';

export default function AccountsPanel() {
  const [open, setOpen] = useState(false);
  const [accs, setAccs] = useState([]);
  const [map, setMap] = useState([]);
  const [msg, setMsg] = useState('');
  const [nw, setNw] = useState({ name: '', group_code: 'opex', ratio_group: '營運費用', auto_source: 'bill' });

  const load = useCallback(async () => {
    try {
      const [a, m] = await Promise.all([ledgerApi.accounts(), ledgerApi.mapping()]);
      setAccs((a.data || []).filter((x) => x.kind === 'expense')); setMap(m.data || []);
    } catch (e) { setMsg(errMsg(e)); }
  }, []);
  useEffect(() => { if (open) load(); }, [open, load]);

  const addAcc = async () => {
    try { await ledgerApi.addAccount(nw); setMsg(`已新增「${nw.name}」，月報「${GROUPS[nw.group_code]}」區會多這一格`); setNw({ ...nw, name: '' }); load(); }
    catch (e) { setMsg(errMsg(e)); }
  };
  const setSrc = async (id, code) => { try { await ledgerApi.mapSource(id, code); load(); } catch (e) { setMsg(errMsg(e)); } };
  const setCat = async (id, code) => { try { await ledgerApi.mapCategory(id, code); load(); } catch (e) { setMsg(errMsg(e)); } };
  const sel = (v, on, allowNone) => (
    <select style={S.input} value={v || ''} onChange={(e) => on(e.target.value || null)}>
      {allowNone && <option value="">（跟廠商預設）</option>}
      {!allowNone && <option value="">（沒設＝落在「其他」）</option>}
      {Object.entries(GROUPS).map(([g, gn]) => (
        <optgroup key={g} label={gn}>{accs.filter((a) => a.group_code === g).map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}</optgroup>
      ))}
    </select>
  );

  return (
    <div style={S.card} data-yaya="mr-accounts">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <b>⚙ 科目與廠商</b>
        <span style={S.sub}>新廠商或新科目要進月報：在這裡選它放哪一格，之後同一家的帳就自動歸位。</span>
        <button style={S.link} onClick={() => setOpen(!open)}>{open ? '收起' : '打開'}</button>
      </div>
      {open && <>
        {msg && <div style={{ fontSize: 13, color: '#2c5282', marginTop: 6 }}>{msg}</div>}
        <div style={{ marginTop: 10 }}>
          <div style={S.h}>① 新增月報科目</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ ...S.input, minWidth: 180 }} placeholder="科目名稱，例：清潔外包" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} />
            放在 <select style={S.input} value={nw.group_code} onChange={(e) => setNw({ ...nw, group_code: e.target.value })}>{Object.entries(GROUPS).map(([g, n]) => <option key={g} value={g}>{n}</option>)}</select>
            成本率算進 <select style={S.input} value={nw.ratio_group} onChange={(e) => setNw({ ...nw, ratio_group: e.target.value })}>{RATIO.map((r) => <option key={r}>{r}</option>)}</select>
            <select style={S.input} value={nw.auto_source} onChange={(e) => setNw({ ...nw, auto_source: e.target.value })}>
              <option value="bill">金額從帳單來</option><option value="manual">每月手填</option>
            </select>
            <button style={S.btn} disabled={!nw.name.trim()} onClick={addAcc}>新增</button>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={S.h}>② 廠商／部門 → 月報哪一格</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr><th style={S.th}>廠商／部門</th><th style={S.th}>會計科目（帳單上選的）</th><th style={S.th}>近 4 個月帳單</th><th style={S.th}>月報上的格子</th></tr></thead>
            <tbody>
              {map.filter((s) => s.is_active).map((s) => [
                <tr key={s.id} style={{ background: '#f7fafc' }}>
                  <td style={S.td}><b>{s.short_name || s.name}</b> <span style={S.sub}>{s.source_type === 'vendor' ? '廠商' : '部門'}</span></td>
                  <td style={S.td}><span style={S.sub}>廠商預設</span></td>
                  <td style={S.td}>{s.bills_120d}</td>
                  <td style={{ ...S.td, background: !s.ledger_code && s.bills_120d ? '#fff5f5' : undefined }}>{sel(s.ledger_code, (v) => setSrc(s.id, v), false)}</td>
                </tr>,
                ...s.categories.filter((c) => c.is_active).map((c) => (
                  <tr key={c.id}>
                    <td style={S.td} />
                    <td style={S.td}>└ {c.name}</td>
                    <td style={S.td}>{c.bills_120d}</td>
                    <td style={S.td}>{sel(c.ledger_code, (v) => setCat(c.id, v), true)}</td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
          <div style={S.sub}>新廠商：先到「帳單管理」建立廠商與它的會計科目，再回來這裡選格子。紅底＝有帳單但沒設，帳會落在「其他」。</div>
        </div>
      </>}
    </div>
  );
}

const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 },
  sub: { fontSize: 12, color: '#718096' },
  h: { fontWeight: 600, fontSize: 14, marginBottom: 6 },
  btn: { padding: '4px 10px', border: '1px solid #cbd5e0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 },
  link: { border: 'none', background: 'none', color: '#3182ce', cursor: 'pointer', padding: 0, fontSize: 13 },
  input: { padding: 4, border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13 },
  th: { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0', color: '#718096', fontWeight: 500 },
  td: { padding: '4px 8px', borderBottom: '1px solid #edf2f7' },
};
