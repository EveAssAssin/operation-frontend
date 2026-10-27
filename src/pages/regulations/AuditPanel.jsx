// 每週巡檢：AI 定期掃描現行規範（矛盾、衝突、模糊、過時、重複、引用），問題可一鍵產生修正草稿或寫原因忽略
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { regulationApi as api } from '../../services/api';
import { C, card, input, btn, btnP, btnSm, fmtTime } from './ui';

const ST = [['open', '待處理'], ['drafted', '已開修正草稿'], ['resolved', '已修正上線'], ['ignored', '已忽略']];

export default function AuditPanel({ settings, reloadSettings, canRun, onEdit, aiEnabled }) {
  const [status, setStatus] = useState('open');
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState(null);
  const [ignoring, setIgnoring] = useState(null);
  const [reason, setReason] = useState('');
  const job = settings?.audit || {};
  const meta = settings?.meta || {};
  const md = settings?.meta_draft || {};
  const [busyAll, setBusyAll] = useState(false);

  const load = useCallback(() => api.findings(status).then(r => setRows(r?.success ? r.data : [])), [status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!job.running && !meta.running && !md.running) return;
    const t = setInterval(() => { reloadSettings(); load(); }, 5000);
    return () => clearInterval(t);
  }, [job.running, meta.running, md.running, reloadSettings, load]);

  const grouped = useMemo(() => {
    const m = new Map();
    rows.forEach(r => { if (!m.has(r.regulation_id)) m.set(r.regulation_id, { id: r.regulation_id, title: r.regulations?.title, items: [] }); m.get(r.regulation_id).items.push(r); });
    return [...m.values()];
  }, [rows]);

  const run = async () => {
    if (!window.confirm('現在執行一次巡檢？（掃描最久沒檢查的 60 份規範，約 10～30 分鐘，完成後 LINE 通知審核人）')) return;
    const r = await api.runAudit({});
    setMsg(r?.success ? { text: '巡檢已開始' } : { err: true, text: r?.message || '失敗' });
    reloadSettings();
  };
  const draft = async (f) => {
    const r = await api.draftFromFinding(f.id);
    if (!r?.success) { setMsg({ err: true, text: r?.message || '失敗' }); return; }
    if (r.data.note) window.alert(r.data.note);
    onEdit(r.data.version_id);
  };
  const runMeta = async () => {
    const r = await api.runMeta({});
    setMsg(r?.success ? { text: 'AI 整理已開始（每份約 3～5 秒）' } : { err: true, text: r?.message || '失敗' });
    reloadSettings();
  };
  const metaOpen = rows.filter(r => r.kind === '整理').length;
  const draftAll = async () => {
    setBusyAll(true);
    const r = await api.metaDraftAll();
    setBusyAll(false);
    setMsg(r?.success ? { text: '開始產生草稿並送審（背景處理，完成後 LINE 通知審核人）' } : { err: true, text: r?.message || '失敗' });
    reloadSettings();
  };
  const ignore = async (f) => {
    const r = await api.ignoreFinding(f.id, reason.trim());
    if (r?.success) { setIgnoring(null); setReason(''); load(); } else setMsg({ err: true, text: r?.message || '失敗' });
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ ...card, padding: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260, fontSize: 13 }}>
          <b style={{ fontSize: 15 }}>🔎 每週巡檢</b>　每週一 03:00 自動掃描最久沒檢查的 60 份規範（約 2 個月輪完一次），找出矛盾、衝突、模糊用語、過時內容、重複、引用錯誤。
          <div style={{ color: C.mid, marginTop: 2 }}>
            {!aiEnabled ? 'AI 尚未啟用（需要 ANTHROPIC_API_KEY）' : job.running ? <b style={{ color: '#b7791f' }}>巡檢中：{job.progress}</b>
              : job.finishedAt ? (job.error ? `上次失敗：${job.error}` : `上次完成 ${fmtTime(job.finishedAt)}：檢查 ${job.result?.checked} 份，發現 ${job.result?.found} 個問題`) : '這次開機後還沒執行過'}
          </div>
        </div>
        {canRun && <button style={btnP} disabled={!aiEnabled || job.running} onClick={run}>{job.running ? '巡檢中…' : '立即巡檢'}</button>}
      </div>
      <div style={{ ...card, padding: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260, fontSize: 13 }}>
          <b style={{ fontSize: 15 }}>🤖 AI 整理基本資料</b>　替還沒填「摘要／類型／適用情境／負責部門」的規範產生建議，並補上門市常用的搜尋關鍵字。建議出現在下面（標「整理」），人看過按「產生草稿」，或一次全部送審。
          <div style={{ color: C.mid, marginTop: 2 }}>
            {meta.running ? <b style={{ color: '#b7791f' }}>整理中：{meta.progress}</b>
              : meta.finishedAt ? (meta.error ? `上次失敗：${meta.error}` : `上次完成 ${fmtTime(meta.finishedAt)}：看了 ${meta.result?.checked} 份，產生 ${meta.result?.made} 筆建議`) : '這次開機後還沒執行過'}
            {md.running && <div><b style={{ color: '#b7791f' }}>送審中：{md.progress}</b></div>}
            {!md.running && md.result && <div>上次全部送審：送審 {md.result.submitted} 份{md.result.skipped?.length ? `，跳過 ${md.result.skipped.length} 份（${[...new Set(md.result.skipped.map(x => x.reason))].slice(0, 3).join('／')}）` : ''}；到「審核」按「低風險全部通過」就上線</div>}
          </div>
        </div>
        {canRun && <button style={btn} disabled={!aiEnabled || meta.running} onClick={runMeta}>{meta.running ? '整理中…' : '開始 AI 整理'}</button>}
        {canRun && status === 'open' && metaOpen > 0 && <button style={btnP} disabled={busyAll || md.running} onClick={draftAll}>{busyAll || md.running ? '處理中…' : `${metaOpen} 筆「整理」全部產生草稿並送審`}</button>}
      </div>
      {msg && <div style={{ fontSize: 13, color: msg.err ? C.bad : C.ok }}>{msg.text}</div>}
      <div style={card}>
        <div style={{ padding: 8, display: 'flex', gap: 6, borderBottom: `1px solid ${C.line}`, flexWrap: 'wrap' }}>
          {ST.map(([k, l]) => (
            <button key={k} style={{ ...btn, ...btnSm, ...(status === k ? { background: C.brand, color: '#fff', borderColor: C.brand } : {}) }} onClick={() => setStatus(k)}>{l}</button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.mid }}>{rows.length} 個問題 · {grouped.length} 份規範</span>
        </div>
        {grouped.map(g => (
          <div key={g.id} style={{ borderBottom: `1px solid ${C.line}`, padding: '8px 12px' }}>
            <div style={{ fontWeight: 700 }}><a href={`/regulations?reg=${g.id}`} target="_blank" rel="noreferrer" style={{ color: C.ink }}>{g.title}</a> <span style={{ fontSize: 12, color: C.mid, fontWeight: 400 }}>#{g.id}</span></div>
            {g.items.map(f => (
              <div key={f.id} style={{ margin: '6px 0 0 8px', padding: 8, borderRadius: 8, background: f.severity === 'warn' ? '#fffaf0' : '#f7fafc', border: `1px solid ${f.severity === 'warn' ? '#fbd38d' : C.line}`, fontSize: 13 }}>
                <div>{f.severity === 'warn' ? '⚠️' : '💡'} <span style={{ fontSize: 11, background: '#edf2f7', borderRadius: 6, padding: '0 5px' }}>{f.kind}</span> <b>{f.title}</b>
                  <span style={{ fontSize: 11, color: '#a0aec0', marginLeft: 6 }}>第 {f.version} 版 · {fmtTime(f.created_at)}</span></div>
                <div style={{ marginTop: 2, whiteSpace: 'pre-wrap' }}>{f.detail}</div>
                {f.codes?.length > 0 && <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#8b6f4e' }}>{f.codes.join('、')}</div>}
                {f.ignore_reason && <div style={{ fontSize: 12, color: C.mid }}>忽略原因：{f.ignore_reason}（{f.handled_by}）</div>}
                {status === 'open' && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button style={{ ...btnP, ...btnSm }} onClick={() => draft(f)}>{f.fix ? `產生修正草稿（${f.fix.label}）` : '開修正草稿（手動改）'}</button>
                    {ignoring === f.id ? (
                      <>
                        <input style={{ ...input, width: 200, padding: '2px 6px', fontSize: 12 }} value={reason} onChange={e => setReason(e.target.value)} placeholder="忽略原因（必填）" autoFocus />
                        <button style={{ ...btn, ...btnSm }} disabled={!reason.trim()} onClick={() => ignore(f)}>確定</button>
                      </>
                    ) : <button style={{ ...btn, ...btnSm }} onClick={() => { setIgnoring(f.id); setReason(''); }}>忽略</button>}
                  </div>
                )}
                {status === 'drafted' && f.draft_version_id && <button style={{ ...btn, ...btnSm, marginTop: 6 }} onClick={() => onEdit(f.draft_version_id)}>打開修正草稿</button>}
              </div>
            ))}
          </div>
        ))}
        {!rows.length && <div style={{ padding: 20, textAlign: 'center', color: '#a0aec0' }}>沒有{ST.find(s => s[0] === status)?.[1]}的問題</div>}
      </div>
    </div>
  );
}
