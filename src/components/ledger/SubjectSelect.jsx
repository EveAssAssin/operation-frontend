// components/ledger/SubjectSelect.jsx —— 選會計科目（2026-10-21）
// 會計科目＝月報格子底下的細項；選科目＝決定月報格子。手填／調帳／分攤／開帳／廠商請款通過都要選。
// ledgerCode 有給＝只列那一格的科目；allowAdd＝最後一個選項可以當場新增科目。
import { useEffect, useState } from 'react';
import { ledgerApi } from '../../services/api';

let cache = null; let waiting = null;
export async function loadSubjects(fresh) {
  if (!fresh && cache) return cache;
  if (!fresh && waiting) return waiting;
  waiting = ledgerApi.subjects().then((r) => { cache = r.data || []; waiting = null; return cache; }).catch((e) => { waiting = null; throw e; });
  return waiting;
}
export const clearSubjects = () => { cache = null; };
const errMsg = (e) => (e && (e.message || e.error)) || '失敗';

export default function SubjectSelect({ value, onChange, ledgerCode, allowAdd = true, disabled, style, placeholder }) {
  const [list, setList] = useState(cache || []);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [cell, setCell] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { loadSubjects().then(setList).catch((e) => setMsg(errMsg(e))); }, []);

  const shown = list.filter((s) => s.is_active && (!ledgerCode || s.ledger_code === ledgerCode));
  const groups = shown.reduce((o, s) => { (o[s.ledger_code] = o[s.ledger_code] || { name: s.ledger_name, items: [] }).items.push(s); return o; }, {});
  const cells = Object.entries(list.reduce((o, s) => { o[s.ledger_code] = s.ledger_name; return o; }, {}));
  const pick = (id) => {
    if (id === '__add') { setAdding(true); setCell(ledgerCode || ''); return; }
    const s = list.find((x) => x.id === id) || null;
    onChange && onChange(s);
  };
  const add = async () => {
    const lc = ledgerCode || cell;
    if (!lc || !name.trim()) { setMsg('要選月報格子、填科目名稱'); return; }
    try {
      const r = await ledgerApi.subjectAdd({ ledger_code: lc, name: name.trim() });
      const fresh = await loadSubjects(true); setList(fresh);
      const s = fresh.find((x) => x.id === r.data.id);
      setAdding(false); setName(''); setMsg('');
      onChange && onChange(s || null);
    } catch (e) { setMsg(errMsg(e)); }
  };

  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
      <select disabled={disabled} style={{ padding: 4, border: `1px solid ${value ? '#cbd5e0' : '#dd6b20'}`, borderRadius: 6, fontSize: 13, ...style }} value={value || ''} onChange={(e) => pick(e.target.value)}>
        <option value="">{placeholder || '選會計科目（必選）'}</option>
        {Object.entries(groups).map(([c, g]) => (
          ledgerCode
            ? g.items.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_default ? '（預設）' : ''}</option>)
            : <optgroup key={c} label={g.name}>{g.items.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_default ? '（預設）' : ''}</option>)}</optgroup>
        ))}
        {allowAdd && <option value="__add">＋ 新增會計科目…</option>}
      </select>
      {adding && (
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          {!ledgerCode && <select style={{ padding: 4, border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13 }} value={cell} onChange={(e) => setCell(e.target.value)}>
            <option value="">放在哪個月報格子</option>{cells.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>}
          <input autoFocus style={{ padding: 4, border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13, width: 120 }} placeholder="科目名稱（例：營運雜貨）" value={name} onChange={(e) => setName(e.target.value)} />
          <button style={{ padding: '3px 10px', border: '1px solid #3182ce', background: '#3182ce', color: '#fff', borderRadius: 6, fontSize: 12, cursor: 'pointer' }} onClick={add}>新增</button>
          <button style={{ border: 'none', background: 'none', color: '#3182ce', cursor: 'pointer', fontSize: 12 }} onClick={() => { setAdding(false); setMsg(''); }}>取消</button>
        </span>
      )}
      {msg && <span style={{ fontSize: 12, color: '#c53030' }}>{msg}</span>}
    </span>
  );
}
