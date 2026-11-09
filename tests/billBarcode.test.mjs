// node tests/billBarcode.test.mjs —— 掃碼入帳條碼解析（台電第三段帶 -，2026-11-09 芽芽回報 #169）
import assert from 'node:assert/strict';
import { feed, emptyBuf, toBill } from '../src/pages/billing/billBarcode.js';

const run = (codes) => { let b = emptyBuf(); const out = []; for (const c of codes) { const r = feed(b, c); b = r.buf; out.push(...r.flushed); } return { out, b }; };

// 台電（電號、金額為測試值）：一、二、三段照順序
let { out, b } = run(['151224111', '01234567890151103', '00000-000000390']);
assert.equal(out.length, 1, '三段掃完自動成一張');
assert.equal(out[0].amount, 390);
assert.equal(out[0].key, 'TPC:01234567890');
assert.equal(out[0].bill_ym, '2026-11');
assert.equal(out[0].due_date, '2026-12-24');
assert.deepEqual(out[0].missing, []);

// 第三段先掃（在第二段之前）：不可被當成第二段
({ out } = run(['151224111', '00000-000000390', '01234567890151103']));
assert.equal(out.length, 1); assert.equal(out[0].amount, 390); assert.equal(out[0].key, 'TPC:01234567890');

// 掃描槍把 - 讀成空白也要認得
({ out } = run(['151224111', '01234567890151103', '00000 000000390']));
assert.equal(out.length, 1); assert.equal(out[0].amount, 390);

// 舊格式（沒有 -）照舊
({ out } = run(['151224111', '01234567890151103', '510100000000390']));
assert.equal(out.length, 1); assert.equal(out[0].amount, 390);

// 中華電信三段式不受影響
({ out } = run(['151110001', '42  8 24491279', '151016000000377']));
assert.equal(out.length, 1); assert.equal(out[0].amount, 377); assert.equal(out[0].bill_ym, '2026-10');

// 反向：只有第一段＋一條帶 - 的，不算完成（還缺第二段）
({ out, b } = run(['151224111', '00000-000000390']));
assert.equal(out.length, 0); assert.equal(toBill(b).missing.join(), '第二段');

console.log('billBarcode OK');
