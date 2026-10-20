// 月報「⚙ 科目與廠商 → ④ 會計科目」（2026-10-21）
// 會計科目＝月報格子底下的細項（例：雜費 → 營運雜貨、文具、清潔用品）。手填／調帳／分攤／開帳／廠商請款通過都要選。
// 每一格有一個同名「預設科目」：系統自動進來的帳沒選科目就算在預設科目；預設科目不能停用。
import { useEffect, useState, useCallback } from 'react';
import { ledgerApi } from '../../services/api';
import { clearSubjects } from '../../components/ledger/SubjectSelect';

const errMsg = (e) => (e && (e.message || e.error)) || '失敗';

export default function SubjectsManager({ accs }) {
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState('');
  const [nw, setNw] = useState({ ledger_code: '', name: '' });
  const [edit, setEdit] = useState(null);
  const [showOff, setShowOff] = useState(false);
  const load = useCallback(async () => { try { const r = await ledgerApi.subjects(true); setList(r.data || []); } catch (e) { setMsg(errMsg(e)); } }, []);
  useEffect(() => { load(); }, [load]);
  const done = (m) => { setMsg(m); clearSubjects(); load(); };
  const add = async () => {
    try { await ledgerApi.subjectAdd(nw); done(`已新增「${nw.name}」`); setNw({ ...nw, name: '' }); } catch (e) { setMsg(errMsg(e)); }
  };
  const patch = async (s, body, m) => { try { await ledgerApi.subjectPatch(s.id, body); done(m); setEdit(null); } catch (e) { setMsg(errMsg(e)); } };
  const groups = (accs || []).map((a) => ({ a, items: list.filter((s) => s.ledger_code === a.code && (showOff || s.is_active)) })).filter((g) => g.items.length);

  return (
    <div style={{ marginTop: 14 }} data-yaya="mr-subjects">
      <div style={S.h}>④ 會計科目（月報格子底下的細項）</div>
      <div style={S.sub}>開帳、手填、調帳、分攤、廠商請款通過都要選會計科目；選了科目就決定列在月報哪一格。帳單管理「📒 帳本明細 → 依會計科目」可以看每個科目逐月變化。</div>
      {msg && <div style={{ fontSize: 13, color: '#2c5282', margin: '6px 0' }}>{msg}</div>}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', margin: '8px 0' }}>
        <select style={S.input} value={nw.ledger_code} onChange={(e) => setNw({ ...nw, ledger_code: e.target.value })}>
          <option value="">放在哪個月報格子</option>{(accs || []).map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
        </select>
        <input style={{ ...S.input, width: 160 }} placeholder="科目名稱（例：營運雜貨）" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} />
        <button style={S.btn} disabled={!nw.ledger_code || !nw.name.trim()} onClick={add}>新增科目</button>
        <label style={{ fontSize: 12, marginLeft: 8 }}><input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} /> 顯示已停用</label>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr><th style={S.th}>月報格子</th><th style={S.th}>會計科目</th></tr></thead>
        <tbody>{groups.map(({ a, items }) => (
          <tr key={a.code}>
            <td style={{ ...S.td, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{a.name}</td>
            <td style={S.td}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {items.map((s) => edit && edit.id === s.id ? (
                  <span key={s.id} style={{ display: 'inline-flex', gap: 4 }}>
                    <input style={{ ...S.input, width: 120 }} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                    <button style={S.btn} onClick={() => patch(s, { name: edit.name }, '已改名')}>存</button>
                    <button style={S.link} onClick={() => setEdit(null)}>取消</button>
                  </span>
                ) : (
                  <span key={s.id} style={{ ...S.chip, opacity: s.is_active ? 1 : 0.5 }}>
                    {s.name}{s.is_default ? <span style={S.sub}>（預設）</span> : ''}
                    <button style={S.link} onClick={() => setEdit({ id: s.id, name: s.name })}>改名</button>
                    {!s.is_default && <button style={S.link} onClick={() => patch(s, { is_active: !s.is_active }, s.is_active ? `已停用「${s.name}」（舊帳照舊顯示，之後不能再選）` : `已重新啟用「${s.name}」`)}>{s.is_active ? '停用' : '啟用'}</button>}
                  </span>
                ))}
              </div>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

const S = {
  sub: { fontSize: 12, color: '#718096' },
  h: { fontWeight: 600, fontSize: 14, marginBottom: 6 },
  btn: { padding: '3px 10px', border: '1px solid #cbd5e0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 },
  link: { border: 'none', background: 'none', color: '#3182ce', cursor: 'pointer', padding: '0 0 0 4px', fontSize: 12 },
  input: { padding: 4, border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13 },
  th: { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0', color: '#718096', fontWeight: 500 },
  td: { padding: '6px 8px', borderBottom: '1px solid #edf2f7' },
  chip: { display: 'inline-flex', alignItems: 'center', padding: '2px 8px', border: '1px solid #cbd5e0', borderRadius: 12, background: '#f7fafc' },
};
