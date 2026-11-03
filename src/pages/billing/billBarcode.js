// pages/billing/billBarcode.js
// 帳單條碼解析：把掃描槍逐條送進來的條碼，分組成一張張帳單
//
// 支援格式
//   A. 超商三段式（中華電信市話等）
//      第一段  9 碼：代收期限 YYMMDD(民國末兩碼) + 代收代號 3 碼     例 151110001
//      第二段 ≤20 碼：銷帳編號（可能含空白）→ 當作「識別碼」        例 "  42  8 24491279"
//      第三段 15 碼：帳單年月 YYMM + 檢碼 2 + 金額 9 碼            例 151016000000377 → 2026-10、$377
//   B. 代收代號 + 年月識別碼（遠傳、自來水、中華電信其他帳單…）
//      EJ0185 / EE0001 這種 2 英文 + 4 數字 = 代收代號
//      11510BBG1375308 = 民國年 3 + 月 2 + 2 英文 + 識別碼 → 2026-10、識別碼 G1375308
//      金額需手動輸入（條碼沒有或格式未知）
//   C. 其他：原樣保留，最長的那條當識別碼，民國日期 1150921 當繳費期限

export const RE_S1    = /^(\d{2})(\d{2})(\d{2})([0-9A-Z]{3})$/;
export const RE_S3    = /^(\d{2})(\d{2})([0-9A-Z]{2})(\d{9})$/;
export const RE_COLL  = /^[A-Z]{2}\d{4}$/;
export const RE_ALT   = /^(1\d{2})(\d{2})([A-Z]{2})([0-9A-Z]{4,})$/;
export const RE_ROCDT = /^(1\d{2})(\d{2})(\d{2})$/;

const rocYY = yy => 1911 + 100 + Number(yy);          // "15" → 2026
const rocYYY = yyy => 1911 + Number(yyy);             // "115" → 2026
const pad = n => String(n).padStart(2, '0');
const validMD = (m, d) => m >= 1 && m <= 12 && (d == null || (d >= 1 && d <= 31));

export function normKey(s) { return String(s || '').toUpperCase().replace(/[\s\-]/g, ''); }

export function classify(raw) {
  const s = String(raw || '').replace(/\r/g, '').replace(/\s+$/, '');
  const t = s.trim().toUpperCase();
  if (!t) return null;
  if (/^HTTPS?:\/\//.test(t)) return { type: 'url', raw: s };   // 帳單上的 QR 網址：不參與解析
  let m;
  if ((m = t.match(RE_S1)) && validMD(+m[2], +m[3]))
    return { type: 's1', raw: s, due_date: `${rocYY(m[1])}-${m[2]}-${m[3]}`, collector: m[4] };
  if ((m = t.match(RE_S3)) && validMD(+m[2]))
    return { type: 's3', raw: s, bill_ym: `${rocYY(m[1])}-${m[2]}`, amount: Number(m[4]) };
  if (RE_COLL.test(t)) return { type: 'coll', raw: s, collector: t };
  if ((m = t.match(RE_ALT)) && validMD(+m[2]))
    return { type: 'alt', raw: s, bill_ym: `${rocYYY(m[1])}-${m[2]}`, ident: m[3] + m[4] };
  if ((m = t.match(RE_ROCDT)) && validMD(+m[2], +m[3]))
    return { type: 'date', raw: s, due_date: `${rocYYY(m[1])}-${m[2]}-${m[3]}` };
  return { type: 'other', raw: s };
}

export function emptyBuf() { return { s1: null, s2: null, s3: null, coll: null, alt: null, date: null, extras: [] }; }
export function bufEmpty(b) { return !b.s1 && !b.s2 && !b.s3 && !b.coll && !b.alt && !b.date && b.extras.length === 0; }
const isStd = b => !!(b.s1 || b.s3);
const isComplete = b => !!(b.s1 && b.s2 && b.s3);

// 掃進一條：回傳 { buf, flushed: [帳單...] }
export function feed(buf, raw) {
  const c = classify(raw);
  if (!c) return { buf, flushed: [] };
  let b = { ...buf, extras: [...buf.extras] };
  if (c.type !== 'other' && c.type !== 'url') b.afterStd = false;
  const flushed = [];
  const flush = () => { if (!bufEmpty(b)) flushed.push(toBill(b)); b = emptyBuf(); };

  switch (c.type) {
    case 's1':
      if (b.s1 || b.coll || b.alt) flush();
      b.s1 = c; break;
    case 's3':
      // 郵局／銀行那組（EJ0115、ED0003 開頭）裡碰巧像第三段的長碼 → 當附屬條碼
      if ((b.coll || b.alt) && !b.s1) { b.extras.push(c); break; }
      if (b.s3) flush();
      b.s3 = c; break;
    case 'coll':
      if (b.coll || isStd(b) || b.alt) flush();
      b.coll = c; break;
    case 'alt':
      // 三段式還缺第二段時，這種長碼就是第二段（銷帳編號）
      if (isStd(b) && !b.s2) { b.s2 = c; break; }
      if (b.alt || isStd(b)) flush();
      b.alt = c; break;
    case 'url':
      break;
    case 'date':
      if (b.date) flush();
      b.date = c; break;
    default: {
      const t = c.raw.trim().toUpperCase();
      // 第三段前 6 碼不是年月的（台電）：已有第一、二段時，15 碼尾 9 碼數字就當金額
      if (b.s1 && b.s2 && !b.s3 && /^[0-9A-Z]{6}\d{9}$/.test(t)) {
        b.s3 = { type: 's3', raw: c.raw, bill_ym: '', amount: Number(t.slice(6)) };
        break;
      }
      // 三段式剛完成，帳單上多出來的條碼（例：台電第 4 條）→ 略過
      if (bufEmpty(b) && b.afterStd) return { buf: b, flushed: [], ignored: c.raw };
      if (isStd(b) && !b.s2 && t.length <= 24) b.s2 = c;
      else b.extras.push(c);
    }
  }
  // 三段式先掃第二段的情況：補位
  if (isStd(b) && !b.s2) {
    const i = b.extras.findIndex(x => x.raw.trim().length <= 24);
    if (i >= 0) { b.s2 = b.extras[i]; b.extras.splice(i, 1); }
  }
  if (isComplete(b)) { flush(); b.afterStd = true; }
  return { buf: b, flushed };
}

function monthBefore(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
}

// 把 buffer 轉成一張帳單
export function toBill(b) {
  const raw = [b.s1, b.s2, b.s3, b.coll, b.alt, b.date, ...b.extras].filter(Boolean).map(x => x.raw);
  let key = '', format = 'other', bill_ym = '', amount = null, due_date = null;

  if (isStd(b)) {
    format = 'std';
    const coll = b.s1?.collector || '';
    const s2n = b.s2 ? normKey(b.s2.raw) : '';
    // 台電：第二段 = 電號 11 碼 + 民國 YYMMDD（帳單日）→ 用電號當識別、帳單日的月份當掛帳月
    const tp = s2n.match(/^(\d{11})(\d{2})(\d{2})(\d{2})$/);
    if (tp && validMD(+tp[3], +tp[4])) {
      key = `TPC:${tp[1]}`;
      bill_ym = b.s3?.bill_ym || `${rocYY(tp[2])}-${tp[3]}`;
    } else {
      key = s2n ? `STD:${coll}:${s2n}` : '';
      bill_ym = b.s3?.bill_ym || '';
    }
    amount = b.s3 ? b.s3.amount : null;
    due_date = b.s1?.due_date || null;
  } else if (b.alt || b.coll) {
    format = 'alt';
    const coll = b.coll?.collector || 'X';
    const ident = b.alt?.ident || normKey(b.extras.sort((x, y) => y.raw.length - x.raw.length)[0]?.raw || '');
    key = ident ? `${coll}:${ident}` : '';
    bill_ym = b.alt?.bill_ym || '';
  } else {
    const longest = [...b.extras].sort((x, y) => y.raw.length - x.raw.length)[0];
    key = longest ? `RAW:${normKey(longest.raw)}` : '';
  }
  if (!due_date && b.date) due_date = b.date.due_date;
  if (!bill_ym && due_date) bill_ym = monthBefore(due_date);

  const missing = [];
  if (format === 'std') {
    if (!b.s1) missing.push('第一段');
    if (!b.s2) missing.push('第二段');
    if (!b.s3) missing.push('第三段');
  }
  return { key, format, bill_ym, amount, due_date, raw, missing };
}

export function describeBuf(b) {
  const parts = [];
  if (b.s1) parts.push(`代收期限 ${b.s1.due_date}`);
  if (b.s2) parts.push(`識別 ${normKey(b.s2.raw)}`);
  if (b.s3) parts.push(`${b.s3.bill_ym} $${b.s3.amount.toLocaleString()}`);
  if (b.coll) parts.push(`代收 ${b.coll.collector}`);
  if (b.alt) parts.push(`${b.alt.bill_ym} 識別 ${b.alt.ident}`);
  if (b.date) parts.push(`日期 ${b.date.due_date}`);
  for (const x of b.extras) parts.push(`其他 ${x.raw.trim()}`);
  return parts;
}
