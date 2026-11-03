// pages/ledgerSubjects/LedgerSubjectsPage.jsx —— 營運管理 → 會計科目（2026-11，從門市月報「⚙ 科目與廠商」搬過來）
// 會計科目＝月報格子底下的細項；開帳、手填、調帳、分攤、廠商請款、門市每月固定費用都用這裡的科目。
import { useEffect, useState } from 'react';
import { ledgerApi } from '../../services/api';
import SubjectsManager from '../monthlyReport/SubjectsManager';

export default function LedgerSubjectsPage() {
  const [accs, setAccs] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    ledgerApi.accounts()
      .then((a) => setAccs((a.data || []).filter((x) => x.kind === 'expense')))
      .catch((e) => setErr((e && e.message) || '讀取失敗'));
  }, []);
  return (
    <div style={{ padding: 20, background: '#faf8f5', minHeight: '100vh' }}>
      <h2 style={{ margin: '0 0 12px', color: '#50422d' }}>🗂 會計科目</h2>
      {err && <div style={{ color: '#c53030', marginBottom: 10 }}>⚠ {err}</div>}
      <div style={{ background: '#fff', border: '1px solid #e0d5c8', borderRadius: 10, padding: 16 }}>
        <SubjectsManager accs={accs} />
      </div>
      <div style={{ fontSize: 12, color: '#8a7a66', marginTop: 10 }}>
        要新增「月報格子」（大分類）請到 門市月報 → ⚙ 科目與廠商 → ① 新增月報科目。
      </div>
    </div>
  );
}
