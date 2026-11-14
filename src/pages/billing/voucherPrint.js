// voucherPrint.js —— 報帳憑證列印（黏存單／支出證明單）（2026-11-15）
// 市場部 market-frontend 與營運部 operation-frontend 各放一份，內容一致；改一邊要同步另一邊。
// 用法：printVoucher(v)  v＝expense_vouchers 一列（files 要有 url）
//   黏存單（粘貼憑證用紙）：有發票／收據時用，單據黏在下方「單據粘貼處」
//   支出證明單：取不到單據時用（大眾運輸、油資依公里數…），要寫不能取得單據原因，經手人＋證明人簽章
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('zh-TW');
const roc = (d) => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `中華民國 ${Number(m[1]) - 1911} 年 ${Number(m[2])} 月 ${Number(m[3])} 日` : ''; };

function itemsTable(v) {
  const it = Array.isArray(v.items) ? v.items : [];
  if (!it.length) return '';
  const rows = it.map((x) => `<tr><td>${esc(x.date || '')}</td><td>${esc(x.desc || [x.from, x.to].filter(Boolean).join(' → '))}</td><td>${esc(x.qty || '')}</td><td class="r">${x.amount != null ? money(x.amount) : ''}</td></tr>`).join('');
  return `<table class="it"><thead><tr><th style="width:18%">日期</th><th>內容（起訖／說明）</th><th style="width:18%">數量／單價</th><th style="width:16%">金額</th></tr></thead><tbody>${rows}</tbody></table>`;
}
const signRow = (labels) => `<table class="sg"><tr>${labels.map((l) => `<th>${l}</th>`).join('')}</tr><tr>${labels.map(() => '<td></td>').join('')}</tr></table>`;

export function voucherHtml(v) {
  const paste = v.kind === 'paste';
  const title = paste ? '粘貼憑證用紙' : '支出證明單';
  const head = `<div class="hd"><div class="co">${esc(v.company || '（公司名稱）')}</div><div class="tt">${title}</div>
    <div class="meta"><span>憑證編號：${esc(v.voucher_no || '')}</span><span>${roc(v.voucher_date)}</span></div></div>`;
  const basic = `<table class="bx">
    <tr><th>會計科目</th><td>${esc(v.subject_name || '差旅費')}</td><th>開帳單位／列帳月份</th><td>${esc(v.store_name || '')}${v.report_ym ? `／${esc(v.report_ym)}` : ''}</td></tr>
    <tr><th>金額</th><td colspan="3"><b>NT$ ${money(v.amount)}</b>　（${esc(v.amount_words || '')}）</td></tr>
    <tr><th>${paste ? '用途說明' : '支出事由'}</th><td colspan="3">${esc(v.purpose)}</td></tr>
    ${paste ? `<tr><th>附單據</th><td colspan="3">${Number(v.attach_count) || 0} 張</td></tr>`
      : `<tr><th>受領人</th><td colspan="3">姓名：${esc(v.applicant_name || '')}　　身分證統一編號：＿＿＿＿＿＿＿＿　　地址：＿＿＿＿＿＿＿＿＿＿＿＿</td></tr>
         <tr><th>不能取得單據原因</th><td colspan="3">${esc(v.no_receipt_reason || '')}</td></tr>`}
    ${v.note ? `<tr><th>備註</th><td colspan="3">${esc(v.note)}</td></tr>` : ''}
  </table>`;
  const signs = paste ? signRow(['經手人', '驗收或證明', '單位主管', '會計', '核准']) : signRow(['經手人', '證明人', '單位主管', '會計', '核准']);
  const applicant = `<div class="ap">申請人：${esc(v.applicant_name || '')}${v.store_name ? `（${esc(v.store_name)}）` : ''}</div>`;
  const imgs = (v.files || []).filter((f) => f.url).map((f) => `<div class="im"><img src="${esc(f.url)}"/><div>${esc(f.name || '')}${f.amount != null ? `　NT$ ${money(f.amount)}` : ''}</div></div>`).join('');
  const pasteArea = paste ? `<div class="pa">單 據 粘 貼 處${imgs ? '' : '<br/><small>（請將發票／收據黏貼於此）</small>'}</div>${imgs ? `<div class="pg"><div class="tt2">單據影本｜${esc(v.voucher_no || '')}</div><div class="ims">${imgs}</div></div>` : ''}` : '';
  const law = paste ? '' : '<div class="law">依商業會計處理準則及營利事業所得稅查核準則，支出無法取得原始憑證時，以本證明單代之，並由經手人及證明人簽章負責。</div>';
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(v.voucher_no || title)}</title><style>
    @page { size: A4; margin: 14mm; }
    body { font-family: "Noto Serif TC","PMingLiU","MingLiU",serif; color:#111; font-size: 13px; }
    .hd { text-align:center; margin-bottom:8px } .co { font-size:18px; font-weight:700 } .tt { font-size:22px; letter-spacing:8px; margin:4px 0 }
    .meta { display:flex; justify-content:space-between; font-size:12px; margin-top:6px }
    table { width:100%; border-collapse:collapse; } th, td { border:1px solid #333; padding:6px 8px; vertical-align:top; }
    .bx th { width:16%; background:#f3f3f3; text-align:left; white-space:nowrap }
    .it { margin-top:8px } .it th { background:#f3f3f3; } .r { text-align:right }
    .sg { margin-top:10px } .sg th { background:#f3f3f3; width:20% } .sg td { height:52px }
    .ap { margin-top:8px; font-size:12px; color:#333 }
    .pa { margin-top:12px; border:2px dashed #888; height:300px; display:flex; align-items:center; justify-content:center; text-align:center; color:#888; font-size:18px; letter-spacing:6px }
    .law { margin-top:8px; font-size:11px; color:#444 }
    .pg { page-break-before: always } .tt2 { font-weight:700; margin-bottom:8px }
    .ims { display:flex; flex-wrap:wrap; gap:8px } .im { width:48%; border:1px solid #ccc; padding:4px; box-sizing:border-box; page-break-inside: avoid }
    .im img { width:100%; max-height:420px; object-fit:contain } .im div { font-size:11px; margin-top:2px }
    .void { color:#c00; font-size:28px; font-weight:700; text-align:center; border:3px solid #c00; margin:6px 0 }
  </style></head><body>
    ${v.status === 'void' ? '<div class="void">作 廢</div>' : ''}
    ${head}${basic}${itemsTable(v)}${law}${signs}${applicant}${pasteArea}
  </body></html>`;
}

export function printVoucher(v) {
  const w = window.open('', '_blank');
  if (!w) { alert('瀏覽器擋了彈出視窗，請允許後再按一次列印'); return; }
  w.document.open(); w.document.write(voucherHtml(v)); w.document.close();
  let printed = false;
  const go = () => { if (printed) return; printed = true; try { w.focus(); w.print(); } catch { /* ignore */ } };
  const imgs = [...w.document.images];
  if (!imgs.length) return setTimeout(go, 200);
  let n = 0; const done = () => { n += 1; if (n >= imgs.length) setTimeout(go, 150); };
  imgs.forEach((im) => (im.complete ? done() : (im.onload = im.onerror = done)));
  setTimeout(go, 6000);
}
