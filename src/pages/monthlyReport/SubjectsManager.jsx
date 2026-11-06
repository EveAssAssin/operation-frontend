// 會計科目管理（2026-10-21；2026-11 搬到「營運管理 → 會計科目」頁）
// 會計科目＝月報格子底下的細項（例：雜費 → 營運雜貨、文具、清潔用品）。手填／調帳／分攤／開帳／廠商請款通過都要選。
// 每一格有一個同名「預設科目」：系統自動進來的帳沒選科目就算在預設科目；預設科目不能停用。
import { useEffect, useState, useCallback } from 'react';
import { ledgerApi } from '../../services/api';
import { clearSubjects } from '../../components/ledger/SubjectSelect';

const errMsg = (e) => (e && (e.message || e.error)) || '失敗';

export default function SubjectsManager({ accs, manageCells, onCellsChanged }) {
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
  const delSubject = async (s) => {
    if (!window.confirm(`刪除科目「${s.name}」？\n只有沒被任何帳用過的才能刪；用過的請改用「停用」。`)) return;
    try { await ledgerApi.subjectDel(s.id); done(`已刪除「${s.name}」`); } catch (e) { setMsg(errMsg(e)); }
  };
  // 月報格子：停用／啟用／刪除（只在「營運管理 → 會計科目」頁開放）
  const cellActive = async (a, on) => {
    if (!on && !window.confirm(`停用月報格子「${a.name}」？\n停用後月報不再顯示這一格、也選不到底下的科目；有帳在用的格子不能停用。`)) return;
    try { await ledgerApi.patchAccount(a.code, { is_active: on }); setMsg(on ? `已啟用「${a.name}」` : `已停用「${a.name}」`); clearSubjects(); onCellsChanged && onCellsChanged(); } catch (e) { setMsg(errMsg(e)); }
  };
  const cellDelete = async (a) => {
    if (!window.confirm(`刪除月報格子「${a.name}」？\n只有自己新增、而且完全沒被用過的格子才能刪（例：建錯的）。`)) return;
    try { await ledgerApi.delAccount(a.code); setMsg(`已刪除「${a.name}」`); clearSubjects(); load(); onCellsChanged && onCellsChanged(); } catch (e) { setMsg(errMsg(e)); }
  };
  const groups = (accs || []).filter((a) => showOff || a.is_active !== false)
    .map((a) => ({ a, items: list.filter((s) => s.ledger_code === a.code && (showOff || s.is_active)) }))
    .filter((g) => g.items.length || manageCells);

  return (
    <div style={{ marginTop: 14 }} data-yaya="mr-subjects">
      <div style={S.h}>會計科目（月報格子底下的細項）</div>
      <div style={S.sub}>開帳、手填、調帳、分攤、廠商請款通過都要選會計科目；選了科目就決定列在月報哪一格。帳單管理「📒 帳本明細 → 依會計科目」可以看每個科目逐月變化。</div>
      {/* 訊息固定在畫面下方（芽芽回報 #123：捲到下面按「停用格子」被擋，原因印在最上面看不到，以為按了沒反應） */}
      {msg && <div role="status" style={{ position: 'fixed', left: '50%', bottom: 20, transform: 'translateX(-50%)', zIndex: 1000, maxWidth: 'min(720px, 92vw)', background: '#fffbea', border: '1px solid #f6c343', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,.15)', padding: '10px 36px 10px 14px', fontSize: 14, color: '#2d2416', lineHeight: 1.6 }}>
        {msg}<button onClick={() => setMsg('')} title="關閉" style={{ position: 'absolute', right: 8, top: 6, border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#8b6f4e' }}>×</button></div>}
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
            <td style={{ ...S.td, whiteSpace: 'nowrap', verticalAlign: 'top', opacity: a.is_active === false ? 0.5 : 1 }}>
              {a.name}{a.is_active === false && <span style={S.sub}>（已停用）</span>}
              {manageCells && (
                <div style={{ marginTop: 2 }}>
                  <button style={{ ...S.link, paddingLeft: 0 }} onClick={() => cellActive(a, a.is_active === false)}>{a.is_active === false ? '啟用格子' : '停用格子'}</button>
                  {String(a.code).startsWith('x_') && <button style={{ ...S.link, color: '#c53030' }} onClick={() => cellDelete(a)}>刪除格子</button>}
                </div>
              )}
            </td>
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
                    {!s.is_default && <button style={{ ...S.link, color: '#c53030' }} onClick={() => delSubject(s)}>刪除</button>}
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
