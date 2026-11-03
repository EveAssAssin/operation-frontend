// 月報「📷 掃碼入帳」：電話費 / 水費 / 電費帳單刷條碼 → 進營運費用 → 月報自動帶入
import { useEffect, useState } from 'react';
import { basicDataApi } from '../../services/api';
import HelpTip from '../../components/help/HelpTip';
import BillScanModal from '../billing/BillScanModal';

export default function ScanBillPanel({ onDone }) {
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState([]);
  useEffect(() => {
    if (open && !cats.length) basicDataApi.listCategories().then((r) => setCats(r.success ? r.data : [])).catch(() => {});
  }, [open, cats.length]);

  return (
    <div style={S.card} data-yaya="mr-scan">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <b>📷 掃碼入帳</b>
        <HelpTip title="掃碼入帳怎麼用" body={'電話費、水費等紙本帳單，用掃描槍刷條碼就能入帳，不用打字。\n1. 按「打開」，點一下輸入框，把一張帳單上的條碼由上到下刷一次。\n2. 中華電信、遠傳：三條刷完自動成一張，年月和金額都自動帶出。\n3. 其他帳單：刷完輸入金額按 Enter。\n4. 第一次出現的帳號選一次對應門市，之後自動記住。\n5. 同帳號同月已入帳會標黃色，預設不送。\n6. 按「入帳」後，月報的電話網路費／水費會自動帶入（掛在帳單年月那個月）。\n也可以從「帳單管理 → 營運費用」進入。'} />
        <span style={S.sub}>電話費、水費帳單刷條碼入帳，月報自動帶入</span>
        <button style={S.link} onClick={() => setOpen(true)}>打開</button>
      </div>
      {open && (
        <BillScanModal
          categories={cats}
          onClose={() => setOpen(false)}
          onSaved={() => onDone && onDone()}
        />
      )}
    </div>
  );
}

const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 },
  sub:  { fontSize: 12, color: '#718096' },
  link: { background: 'none', border: 'none', color: '#3182ce', cursor: 'pointer', fontSize: 13, padding: 0 },
};
