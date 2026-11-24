// components/RebateBox.jsx —— 廠商回饋：帳面金額／回饋金額／出款金額（2026-11-24）
const money = (n) => (n == null ? '—' : `$${Math.round(Number(n)).toLocaleString()}`);
export const REBATE_MODE = { inclusive: '帳單內含', exclusive: '帳單外加' };

export default function RebateBox({ r, vendor }) {
  if (!r) return null;
  const cell = (label, v, color, note) => (
    <div style={{ flex: 1, minWidth: 120, background: '#fff', borderRadius: 6, padding: '8px 10px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 12, color: '#718096' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{money(v)}</div>
      {note && <div style={{ fontSize: 11, color: '#a0aec0' }}>{note}</div>}
    </div>
  );
  return (
    <div style={{ background: '#fffbeb', border: '1px solid #f6e05e', borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
        🎁 廠商回饋 {r.pct}%（{REBATE_MODE[r.mode] || r.mode}）{r.preview && <span style={{ fontSize: 11, color: '#b7791f', fontWeight: 400 }}>　預估（送審後確定）</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {cell(vendor ? '帳面金額' : '帳面金額（門市分帳）', r.gross, '#2d3748', r.mode === 'exclusive' ? '帳單金額 ÷ (1 − 回饋%)' : '＝帳單金額')}
        {cell('回饋金額', r.rebate, '#2f855a')}
        {cell(vendor ? '實際匯款金額' : '出款金額（實付廠商）', r.payout, '#c05621', r.mode === 'exclusive' ? '＝帳單金額' : '帳單金額 − 回饋')}
      </div>
    </div>
  );
}
