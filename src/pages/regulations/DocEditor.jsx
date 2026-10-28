// 規範內容編輯器：大項／條文樹（新增、刪除、上下移、子條文、類型、扣分、註／例）
// 條文代碼由後端存檔時配發；新條文顯示「（存檔後配發）」
import React from 'react';
import { C, input, btn, btnSm, cnNo, noOf, clone, Field } from './ui';
import { useRegApi } from './regApi';

const DOC_TYPES = ['作業流程', '行政規定', '產品知識', '工作職掌', '人事規範', '其他'];

// 依 path 取得「某層的陣列」：path=[si] → sections[si].items；path=[si,i] → items[i].subs …
function listAt(doc, path) {
  let arr = doc.sections[path[0]].items;
  for (let k = 1; k < path.length; k++) arr = arr[path[k]].subs;
  return arr;
}

function ClauseEd({ c, path, level, upd }) {
  const regulationApi = useRegApi();
  // path = [si, i0, i1, ...]，最後一個是自己的 index
  const parentPath = path.slice(0, -1), idx = path[path.length - 1];
  const set = (k, v) => upd(d => { listAt(d, parentPath)[idx][k] = v; });
  const move = (dir) => upd(d => { const a = listAt(d, parentPath); const j = idx + dir; if (j < 0 || j >= a.length) return; [a[idx], a[j]] = [a[j], a[idx]]; });
  const remove = () => {
    if ((c.subs || []).length && !window.confirm('這條底下還有子條文，會一起刪除。確定？')) return;
    upd(d => { listAt(d, parentPath).splice(idx, 1); });
  };
  const addSub = () => upd(d => { const it = listAt(d, parentPath)[idx]; it.subs = it.subs || []; it.subs.push({ text: '', t: null, notes: [], subs: [] }); });
  const addNote = (kind) => upd(d => { const it = listAt(d, parentPath)[idx]; it.notes = it.notes || []; it.notes.push({ kind, text: '' }); });
  const setNote = (ni, v) => upd(d => { listAt(d, parentPath)[idx].notes[ni].text = v; });
  const delNote = (ni) => upd(d => { listAt(d, parentPath)[idx].notes.splice(ni, 1); });
  return (
    <div style={{ marginLeft: (level - 1) * 22, borderLeft: `2px solid ${level === 1 ? C.line : '#efe6d8'}`, paddingLeft: 8, marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
        <b>{noOf(level, path.slice(1))}</b>
        <span style={{ fontFamily: 'ui-monospace,Consolas,monospace', color: '#8b6f4e' }}>{c.code || '（存檔後配發代碼）'}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.bad }} title="違反這條扣幾分；空白＝用整份規範的預設分數">扣分
          <input type="number" value={c.pen ?? ''} placeholder="預設" onChange={e => set('pen', e.target.value === '' ? null : Number(e.target.value))} style={{ ...input, width: 70, padding: '2px 6px', fontSize: 12 }} />
        </label>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button style={{ ...btn, ...btnSm }} title="上移" onClick={() => move(-1)}>↑</button>
          <button style={{ ...btn, ...btnSm }} title="下移" onClick={() => move(1)}>↓</button>
          {level < 4 && <button style={{ ...btn, ...btnSm }} onClick={addSub}>＋子條文</button>}
          <button style={{ ...btn, ...btnSm }} onClick={() => addNote('註')}>＋註</button>
          <button style={{ ...btn, ...btnSm }} onClick={() => addNote('例')}>＋例</button>
          <label style={{ ...btn, ...btnSm, display: 'inline-block' }}>＋照片
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
              const r = await regulationApi.upload(f);
              if (!r?.success) { window.alert(r?.message || '上傳失敗'); return; }
              upd(d => { const it = listAt(d, parentPath)[idx]; it.images = it.images || []; it.images.push({ url: r.data.url, caption: '' }); });
            }} />
          </label>
          <button style={{ ...btn, ...btnSm, color: C.bad }} onClick={remove}>刪除</button>
        </span>
      </div>
      <textarea value={c.text || ''} onChange={e => set('text', e.target.value)} rows={Math.min(8, Math.max(2, Math.ceil((c.text || '').length / 48)))}
        style={{ ...input, marginTop: 4, resize: 'vertical', borderColor: (c.text || '').trim() ? C.line : '#feb2b2' }} placeholder="條文內容" />
      {(c.notes || []).map((n, ni) => (
        <div key={ni} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 4, marginLeft: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: n.kind === '例' ? '#2f855a' : '#975a16', paddingTop: 6 }}>{n.kind}</span>
          <textarea value={n.text} onChange={e => setNote(ni, e.target.value)} rows={2} style={{ ...input, fontSize: 13, resize: 'vertical' }} />
          <button style={{ ...btn, ...btnSm, color: C.bad }} onClick={() => delNote(ni)}>✕</button>
        </div>
      ))}
      {(c.images || []).map((im, ii) => (
        <div key={ii} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, marginLeft: 16 }}>
          <img src={im.url} alt="" style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 4, border: `1px solid ${C.line}` }} />
          <input style={{ ...input, fontSize: 13, borderColor: im.caption ? C.line : '#fbd38d' }} value={im.caption || ''} placeholder="照片說明（照片裡的文字沒有規範效力，重點請寫成條文）"
            onChange={e => upd(d => { listAt(d, parentPath)[idx].images[ii].caption = e.target.value; })} />
          <button style={{ ...btn, ...btnSm, color: C.bad }} onClick={() => upd(d => { listAt(d, parentPath)[idx].images.splice(ii, 1); })}>✕</button>
        </div>
      ))}
      {(c.subs || []).map((s, i) => <ClauseEd key={s.code || `n${i}`} c={s} path={[...path, i]} level={level + 1} upd={upd} />)}
    </div>
  );
}

export default function DocEditor({ doc, onChange, roles = [], categories = [] }) {
  const upd = (fn) => { const d = clone(doc); fn(d); onChange(d); };
  const setMeta = (k, v) => upd(d => { d[k] = v; });

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0 12px' }}>
        <Field label="規範標題 *"><input style={input} value={doc.title || ''} onChange={e => setMeta('title', e.target.value)} /></Field>
        <Field label="分類">
          <input style={input} list="reg-cats" value={doc.category || ''} onChange={e => setMeta('category', e.target.value)} />
          <datalist id="reg-cats">{categories.map(c => <option key={c.name} value={c.name} />)}</datalist>
        </Field>
        <Field label="類型">
          <select style={input} value={doc.doc_type || ''} onChange={e => setMeta('doc_type', e.target.value || null)}>
            <option value="">未分類</option>{DOC_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="負責部門"><input style={input} value={doc.owner_dept || ''} onChange={e => setMeta('owner_dept', e.target.value)} /></Field>
      </div>
      <Field label="一句話摘要（這份規範在管什麼）"><input style={input} value={doc.summary || ''} onChange={e => setMeta('summary', e.target.value)} /></Field>
      <Field label="適用情境（什麼時候會用到）"><input style={input} value={doc.scenario || ''} onChange={e => setMeta('scenario', e.target.value)} /></Field>
      <Field label="搜尋關鍵字（門市會怎麼問，用、分隔；人和 AI 都靠它找到這份）"><input style={input} value={doc.keywords || ''} onChange={e => setMeta('keywords', e.target.value)} /></Field>
      <Field label="適用身分">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {roles.map(r => (
            <label key={r} style={{ fontSize: 13, display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="checkbox" checked={(doc.roles || []).includes(r)}
                onChange={e => setMeta('roles', e.target.checked ? [...(doc.roles || []), r] : (doc.roles || []).filter(x => x !== r))} />{r}
            </label>
          ))}
        </div>
      </Field>

      {(doc.sections || []).map((s, si) => (
        <div key={si} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, marginTop: 12, background: '#fcfaf6' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <b style={{ fontSize: 16 }}>{cnNo(si)}、</b>
            <input style={{ ...input, fontWeight: 700, fontSize: 15 }} value={s.title || ''} placeholder="大項名稱" onChange={e => upd(d => { d.sections[si].title = e.target.value; })} />
            <button style={{ ...btn, ...btnSm }} onClick={() => upd(d => { if (si > 0) [d.sections[si - 1], d.sections[si]] = [d.sections[si], d.sections[si - 1]]; })}>↑</button>
            <button style={{ ...btn, ...btnSm }} onClick={() => upd(d => { if (si < d.sections.length - 1) [d.sections[si + 1], d.sections[si]] = [d.sections[si], d.sections[si + 1]]; })}>↓</button>
            <button style={{ ...btn, ...btnSm, color: C.bad }} onClick={() => { if ((s.items || []).length && !window.confirm('整個大項（含所有條文）會刪除，確定？')) return; upd(d => { d.sections.splice(si, 1); }); }}>刪除大項</button>
          </div>
          {(s.items || []).map((c, i) => <ClauseEd key={c.code || `n${i}`} c={c} path={[si, i]} level={1} upd={upd} />)}
          <button style={{ ...btn, ...btnSm, marginTop: 8 }} onClick={() => upd(d => { d.sections[si].items.push({ text: '', t: null, notes: [], subs: [] }); })}>＋ 新增條文</button>
        </div>
      ))}
      <button style={{ ...btn, marginTop: 12 }} onClick={() => upd(d => { d.sections.push({ title: '', items: [] }); })}>＋ 新增大項</button>
    </div>
  );
}
