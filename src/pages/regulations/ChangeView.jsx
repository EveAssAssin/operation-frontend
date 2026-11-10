// ChangeView —— 一處修改的預覽（2026-11-10：只加「註」時文字沒變，以前只顯示劃掉又一樣的條文，看不出改了什麼）
//   文字有變才顯示 舊（劃線）／新；註只列「新增的」「拿掉的」；扣分、照片另列
import { changeLabel } from './docOps';

const noteKey = (n) => `${n.kind || '註'}|${n.text || ''}`;
export default function ChangeView({ c, codeColor = '#8b6f4e', label }) {
  const textChanged = c.kind !== 'mod' || (c.old || '') !== (c.new || '');
  const oldN = new Set((c.old_notes || []).map(noteKey)), newN = new Set((c.notes || []).map(noteKey));
  const addedNotes = (c.notes || []).filter((n) => !oldN.has(noteKey(n)));
  const removedNotes = (c.old_notes || []).filter((n) => !newN.has(noteKey(n)));
  const fields = c.fields || [];
  return (
    <div style={{ fontSize: 12, borderLeft: '2px solid #e2e8f0', paddingLeft: 6, margin: '4px 0' }}>
      <span title={`條文代碼 ${c.code}`} style={{ color: codeColor, fontWeight: 600 }}>{label || c.display_no || c.code}</span> {changeLabel(c)}
      {c.kind === 'mod' && !textChanged && <span style={{ color: '#718096' }}>（條文文字不變）</span>}
      {textChanged && c.old && c.kind !== 'add' && <div style={{ color: '#9b2c2c', textDecoration: 'line-through' }}>{c.old}</div>}
      {textChanged && c.new && c.kind !== 'del' && <div style={{ color: '#22543d', background: '#f0fff4' }}>{c.new}</div>}
      {c.kind === 'add' && (c.notes || []).map((n, j) => <div key={'n' + j} style={{ color: '#22543d' }}>{n.kind || '註'}：{n.text}</div>)}
      {c.kind !== 'add' && addedNotes.map((n, j) => <div key={'a' + j} style={{ color: '#22543d', background: '#f0fff4' }}>＋{n.kind || '註'}：{n.text}</div>)}
      {c.kind !== 'add' && removedNotes.map((n, j) => <div key={'r' + j} style={{ color: '#9b2c2c', textDecoration: 'line-through' }}>－{n.kind || '註'}：{n.text}</div>)}
      {fields.includes('penalty') && <div style={{ color: '#22543d' }}>扣分：{c.old_penalty ?? '—'} → {c.penalty ?? '—'}</div>}
      {fields.includes('images') && <div style={{ color: '#22543d' }}>＋照片</div>}
    </div>
  );
}
