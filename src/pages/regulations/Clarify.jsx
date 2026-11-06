// 「AI 想先跟你確認」卡片（2026-11）：寫規範前先確認方向，避免寫錯方向浪費時間
//   顯示 AI 的理解、打算的大綱、關鍵問題（可點選項或自己打字），確認後才開始寫
import React from 'react';
import { C, input, btn, btnP, btnSm } from './ui';

/** 把確認過的方向＋回答併進需求文字（送給產生／編輯助理用） */
export function composeWithAnswers(text, data, answers = {}) {
  if (!data) return text;
  const qa = (data.questions || []).map((q, i) => ({ q: q.q, a: String(answers[i] || '').trim() })).filter(x => x.a);
  const parts = [String(text || '').trim()];
  if (data.understanding || (data.plan || []).length) {
    parts.push('【確認過的方向】' + (data.understanding ? `\n${data.understanding}` : '') + ((data.plan || []).length ? `\n大綱：\n${data.plan.map(p => `- ${p}`).join('\n')}` : ''));
  }
  if (qa.length) parts.push('【補充回答】\n' + qa.map(x => `- ${x.q} → ${x.a}`).join('\n'));
  return parts.join('\n\n');
}

export default function ClarifyCard({ data, answers, setAnswers, busy, onConfirm, confirmLabel = '✨ 方向對，開始', onRecheck, onSkip, compact = false }) {
  const qs = data?.questions || [];
  const set = (i, v) => setAnswers(a => ({ ...a, [i]: v }));
  const pick = (i, opt) => setAnswers(a => {
    const cur = String(a[i] || '');
    return { ...a, [i]: cur === opt ? '' : opt };
  });
  return (
    <div style={{ background: '#fffaf0', border: '1px solid #fbd38d', borderRadius: 10, padding: compact ? 8 : 10, marginTop: 8, fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: '#975a16' }}>🤔 {qs.length ? '開始寫之前，想先跟你確認' : '我理解的方向，對嗎？'}</div>
      {data.understanding && <div style={{ marginTop: 4 }}><b>我的理解：</b>{data.understanding}</div>}
      {(data.plan || []).length > 0 && (
        <div style={{ marginTop: 4 }}>
          <b>{compact ? '打算這樣改：' : '打算的大綱：'}</b>
          <ul style={{ margin: '2px 0', paddingLeft: 18 }}>{data.plan.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}
      {qs.map((q, i) => (
        <div key={i} style={{ marginTop: 8, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: 8 }}>
          <div><b>Q{i + 1}. {q.q}</b></div>
          {q.why && <div style={{ fontSize: 11, color: C.mid }}>（{q.why}）</div>}
          {q.options?.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {q.options.map(o => (
                <button key={o} disabled={busy} onClick={() => pick(i, o)}
                  style={{ ...btn, ...btnSm, ...(answers[i] === o ? { background: C.brand, color: '#fff', borderColor: C.brand } : null) }}>{o}</button>
              ))}
            </div>
          )}
          <input style={{ ...input, fontSize: 12, marginTop: 4 }} disabled={busy} value={answers[i] || ''} onChange={e => set(i, e.target.value)}
            placeholder={q.options?.length ? '或自己寫（可補充）' : '你的回答'} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={btnP} disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
        {onRecheck && <button style={btn} disabled={busy} onClick={onRecheck} title="把回答帶進去，讓 AI 重新整理一次方向">🔁 帶著回答再確認一次</button>}
        {onSkip && <button style={{ ...btn, ...btnSm }} disabled={busy} onClick={onSkip}>不用問了，直接寫</button>}
        {qs.length > 0 && <span style={{ fontSize: 11, color: C.mid }}>沒回答的題目 AI 會自行判斷或留（請填）</span>}
      </div>
    </div>
  );
}
