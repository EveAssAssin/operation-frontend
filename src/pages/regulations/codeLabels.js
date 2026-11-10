// codeLabels —— 條文代碼（900002-3.2）換成人看得懂的編號（三、2.）（2026-11-10 Louis：AI 檢查裡的代碼看不懂）
//   本規範：依編輯器目前內容即時換算（移動條文後也對）；其他規範：用 AI 檢查時後端查好的 code_labels（《規範名稱》五、9.）
const CN = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十'];
const cnNo = (i) => CN[i] || String(i + 1);
const displayNo = (level, p) => level === 1 ? `${p[0] + 1}.` : level === 2 ? `${p[0] + 1}-${p[1] + 1}.` : `${p[0] + 1}-${p[1] + 1}.${p.slice(2).map((n) => n + 1).join('.')}`;

/** doc → { code: { no:'三、2.', text:'條文前 18 字' } } */
export function docLabels(doc) {
  const out = {};
  (doc?.sections || []).forEach((sec, si) => {
    const walk = (items, level, path) => (items || []).forEach((c, i) => {
      const p = [...path, i];
      if (c.code) out[c.code] = { no: `${cnNo(si)}、${displayNo(level, p)}`, text: String(c.text || '').replace(/\s+/g, ' ').slice(0, 18) };
      walk(c.subs, level + 1, p);
    });
    walk(sec.items, 1, []);
  });
  return out;
}

const RE = /\[?(\d{2,}-\d+(?:\.\d+)*)\]?/g;
/** 文字裡的代碼換成編號；others＝其他規範的對照 */
export function humanize(text, mine, others = {}) {
  return String(text || '').replace(RE, (m, code) => {
    if (mine[code]) return `「${mine[code].no}」`;
    if (others[code]) return others[code];
    return m;
  });
}
/** 代碼清單 → 人看的標籤（含條文開頭幾個字） */
export function codeChip(code, mine, others = {}) {
  if (mine[code]) return `${mine[code].no} ${mine[code].text}${mine[code].text.length >= 18 ? '…' : ''}`;
  if (others[code]) return others[code];
  return `${code}（已刪除或找不到）`;
}
