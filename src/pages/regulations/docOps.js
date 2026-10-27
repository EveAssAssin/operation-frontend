// 套用 AI 建議的結構化修改指令（與後端 services/regulationDoc.js 的 applyOps 同一套規則）
function locate(doc, code) {
  for (const sec of doc.sections || []) {
    const walk = (arr, parent) => {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].code === code) return { arr, i, node: arr[i], parent, sec };
        const r = walk(arr[i].subs || [], arr[i]); if (r) return r;
      }
      return null;
    };
    const r = walk(sec.items || [], null); if (r) return r;
  }
  return null;
}
const META_FIELDS = ['title', 'category', 'doc_type', 'summary', 'scenario', 'owner_dept', 'roles'];
export function applyOps(docIn, ops = []) {
  const doc = JSON.parse(JSON.stringify(docIn));
  doc.sections = doc.sections || [];
  const need = (code) => { const r = locate(doc, code); if (!r) throw new Error(`找不到條文 ${code}`); return r; };
  const newClause = (o) => ({ text: String(o.text || '').trim(), t: null, notes: [], subs: [], pen: (o.pen === undefined || o.pen === null || o.pen === '') ? null : Number(o.pen) });
  for (const op of ops) {
    switch (op.op) {
      case 'replace_text': need(op.code).node.text = String(op.text || '').trim(); break;
      case 'delete_clause': { const r = need(op.code); r.arr.splice(r.i, 1); break; }
      case 'add_note': { const r = need(op.code); r.node.notes = r.node.notes || []; r.node.notes.push({ kind: op.kind === '例' ? '例' : '註', text: String(op.text || '').trim() }); break; }
      case 'set_penalty': need(op.code).node.pen = (op.pen === null || op.pen === '') ? null : Number(op.pen); break;
      case 'set_meta': if (META_FIELDS.includes(op.field)) doc[op.field] = op.value; break;
      case 'add_image': { const r = need(op.code); r.node.images = r.node.images || []; r.node.images.push({ url: op.url, caption: op.caption || '' }); break; }
      case 'set_image_caption': { const r = need(op.code); (r.node.images || []).forEach(im => { if (!op.url || im.url === op.url) im.caption = op.caption || ''; }); break; }
      case 'add_section': {
        const sec = { title: String(op.title || '').trim(), items: (op.clauses || []).map(t => newClause({ text: t })) };
        const at = Number.isInteger(op.after_section_index) ? op.after_section_index + 1 : doc.sections.length;
        doc.sections.splice(Math.max(0, Math.min(at, doc.sections.length)), 0, sec); break;
      }
      case 'add_clause': case 'move_clause': {
        let node;
        if (op.op === 'move_clause') { const r = need(op.code); node = r.node; r.arr.splice(r.i, 1); } else node = newClause(op);
        const parentCode = op.op === 'move_clause' ? op.to_parent_code : op.parent_code;
        const secIdx = op.op === 'move_clause' ? op.to_section_index : op.section_index;
        let arr;
        if (parentCode) { const p = need(parentCode); p.node.subs = p.node.subs || []; arr = p.node.subs; }
        else if (op.after_code) arr = need(op.after_code).arr;
        else if (Number.isInteger(secIdx) && doc.sections[secIdx]) arr = doc.sections[secIdx].items;
        else throw new Error('新增條文要指定放在哪裡');
        let pos = arr.length;
        if (op.after_code) { const k = arr.findIndex(x => x.code === op.after_code); if (k >= 0) pos = k + 1; }
        arr.splice(pos, 0, node); break;
      }
      default: throw new Error(`不認得的修改指令：${op.op}`);
    }
  }
  return doc;
}

/** 把差異 changes 轉成「新增／修改／刪除」對照（給方案預覽用） */
export function changeLabel(c) {
  return { add: '新增', del: '刪除', mod: '修改', move: '移動' }[c.kind] || c.kind;
}
