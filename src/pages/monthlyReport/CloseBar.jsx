// 門市月報關帳流程（2026-10-20）：整理中 → 送審閱（會計）→ 關帳（Louis，存快照、數字凍結）→ 重開要寫原因
// 關帳後店長才在市場部「店長評核」看得到月報、寫心得
import { useState } from 'react';
import { ledgerApi } from '../../services/api';

const errMsg = (e) => (e && e.response && e.response.data && e.response.data.message) || (e && e.message) || '失敗';

export default function CloseBar({ ym, store, status, report, onDone }) {
  const [ask, setAsk] = useState(null);      // { action, label }
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState((report && report.reviewer_note) || '');

  const go = async () => {
    if (!ask) return;
    if (ask.action === 'reopen' && !reason.trim()) { setMsg('重開一定要寫原因'); return; }
    setBusy(true); setMsg('');
    try {
      const r = await ledgerApi.status({ ym, stores: store ? [store] : 'all', action: ask.action, reason });
      const d = r.data || {};
      const skipped = (d.results || []).filter((x) => x.skip || x.error);
      setMsg(`完成 ${d.done} 家${skipped.length ? `；略過 ${skipped.length} 家（${skipped.slice(0, 5).map((x) => `${x.store} ${x.skip || x.error}`).join('、')}${skipped.length > 5 ? '…' : ''}）` : ''}`);
      setAsk(null); setReason('');
      onDone && onDone();
    } catch (e) { setMsg(errMsg(e)); }
    setBusy(false);
  };
  const saveNote = async () => {
    try { await ledgerApi.reviewerNote({ store, ym, note }); setMsg('主管說明已存（店長關帳後看得到）'); } catch (e) { setMsg(errMsg(e)); }
  };

  const btns = store
    ? [status === 'draft' && ['submit', '送審閱'], status !== 'closed' && ['close', '關帳'], status === 'closed' && ['reopen', '重開']].filter(Boolean)
    : [['submit', '全部送審閱'], ['close', '全部關帳'], ['reopen', '全部重開']];
  return (
    <div style={S.card} data-yaya="mr-close">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <b>🔒 關帳</b>
        <span style={S.sub}>整理中 → 送審閱（會計）→ 關帳（最高管理者；數字凍結、店長才看得到）</span>
        {btns.map(([a, l]) => <button key={a} style={S.btn} disabled={busy} onClick={() => { setAsk({ action: a, label: l }); setMsg(''); }}>{l}</button>)}
      </div>
      {ask && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b>確定要「{ask.label}」{store ? '' : `${ym} 全部門市`}？</b>
          {ask.action === 'reopen' && <input style={{ ...S.input, minWidth: 260 }} placeholder="重開原因（必填）" value={reason} onChange={(e) => setReason(e.target.value)} />}
          {ask.action === 'close' && <span style={S.sub}>關帳會存下現在的整份數字，之後帳本再變也不會改到這份。</span>}
          <button style={{ ...S.btn, background: '#2b6cb0', color: '#fff' }} disabled={busy} onClick={go}>{busy ? '處理中…' : '確定'}</button>
          <button style={S.link} onClick={() => setAsk(null)}>取消</button>
        </div>
      )}
      {msg && <div style={{ marginTop: 6, fontSize: 13, color: '#2c5282' }}>{msg}</div>}
      {store && (
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={S.sub}>主管說明（給店長看）</div>
            <textarea rows={3} style={{ ...S.input, width: '100%' }} value={note} onChange={(e) => setNote(e.target.value)} />
            <button style={S.btn} onClick={saveNote}>存說明</button>
          </div>
          <div>
            <div style={S.sub}>店長心得{report && report.manager_note_at ? `（${String(report.manager_note_at).slice(0, 10)}）` : ''}</div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: report && report.manager_note ? '#2d3748' : '#a0aec0' }}>{(report && report.manager_note) || '還沒寫（關帳後店長在市場部「店長評核」寫）'}</div>
            {report && report.reopen_reason && <div style={{ ...S.sub, marginTop: 6 }}>上次重開：{report.reopen_reason}（{report.reopened_by || ''}）</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 },
  sub: { fontSize: 12, color: '#718096' },
  btn: { padding: '4px 10px', border: '1px solid #cbd5e0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 },
  link: { border: 'none', background: 'none', color: '#3182ce', cursor: 'pointer', padding: 0, fontSize: 13 },
  input: { padding: 6, border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' },
};
