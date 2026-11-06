// 參考既有規範產生（2026-11）
//   選 1～3 份舊規範（常用：以前的行銷企劃）＋寫這次的新需求 → AI 沿用舊規範的架構與邏輯，寫出新規範
//   產生好先預覽，按「套用到編輯器」才放進草稿（跟上傳 Word 一樣，可按 ↶ 復原）
import React, { useEffect, useRef, useState } from 'react';
import { useRegApi } from './regApi';
import { C, input, btn, btnP, btnSm } from './ui';

const listOf = (r) => (Array.isArray(r?.data) ? r.data : Array.isArray(r?.data?.data) ? r.data.data : []);

export default function RefGenerate({ doc, title, onApply }) {
  const api = useRegApi();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [refs, setRefs] = useState([]);            // [{id,title}]
  const [need, setNeed] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null);
  const tm = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    clearTimeout(tm.current);
    tm.current = setTimeout(async () => {
      const r = await api.refList(q.trim());
      setHits(listOf(r).slice(0, 40));
    }, 300);
    return () => clearTimeout(tm.current);
  }, [q, open]); // eslint-disable-line

  const toggle = (r) => setRefs(x => (x.some(y => y.id === r.id) ? x.filter(y => y.id !== r.id) : x.length >= 3 ? x : [...x, { id: r.id, title: r.title }]));

  const run = async () => {
    setErr(''); setRes(null);
    if (!refs.length) { setErr('請至少選一份參考規範'); return; }
    if (need.trim().length < 5) { setErr('請寫這次的新需求'); return; }
    setBusy('送出中…');
    const r = await api.refGenerate({ reference_ids: refs.map(x => x.id), requirement: need.trim(), title });
    if (!r?.success) { setBusy(''); setErr(r?.message || '送出失敗'); return; }
    const t0 = Date.now();
    const poll = async () => {
      const p = await api.refGenerateJob(r.data.job);
      if (!p?.success) { setBusy(''); setErr(p?.message || '產生失敗'); return; }
      if (p.data.status === 'running') {
        if (Date.now() - t0 > 12 * 60 * 1000) { setBusy(''); setErr('產生太久，請稍後再試或把需求拆小一點'); return; }
        setBusy(`AI 參考舊規範撰寫中（已 ${Math.round((Date.now() - t0) / 1000)} 秒，通常 1～3 分鐘）…`); setTimeout(poll, 3000); return;
      }
      setBusy('');
      if (p.data.status === 'error') { setErr(p.data.error || '產生失敗'); return; }
      setRes(p.data.result);
    };
    setBusy('AI 參考舊規範撰寫中（通常 1～3 分鐘，請不要關掉這頁）…');
    setTimeout(poll, 3000);
  };

  const hasContent = (doc?.sections || []).some(s => (s.items || []).length);
  const apply = () => {
    const x = res;
    const placeholder = !doc.title || doc.title === '（未命名規範）';
    onApply({ ...doc, sections: x.sections,
      title: placeholder ? (x.title || doc.title) : doc.title,
      summary: doc.summary || x.summary, scenario: doc.scenario || x.scenario });
    setRes(null); setOpen(false);
  };

  if (!open) {
    return (
      <div style={{ border: `1px dashed ${C.line}`, borderRadius: 10, padding: '8px 10px', marginTop: 8, background: '#fcfaf6', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button style={btn} onClick={() => setOpen(true)}>📋 參考既有規範產生</button>
        <span style={{ fontSize: 12, color: C.mid }}>選以前的規範／企劃當範本，寫這次的新需求，AI 沿用原本的架構與邏輯幫你寫出新的一份。</span>
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, marginTop: 8, background: '#fcfaf6', fontSize: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b>📋 參考既有規範產生</b>
        <button style={{ ...btn, ...btnSm }} disabled={!!busy} onClick={() => { setOpen(false); setRes(null); setErr(''); }}>收起</button>
      </div>

      <div style={{ marginTop: 8, fontWeight: 700 }}>① 選參考規範（最多 3 份）</div>
      {refs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {refs.map(r => (
            <span key={r.id} style={{ background: C.brand, color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 12 }}>
              《{r.title}》 <span style={{ cursor: 'pointer' }} onClick={() => toggle(r)}>✕</span>
            </span>
          ))}
        </div>
      )}
      <input style={{ ...input, marginTop: 6 }} value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋規範名稱，例：生日、母親節、週年慶" />
      <div style={{ maxHeight: 160, overflow: 'auto', border: `1px solid ${C.line}`, borderRadius: 6, marginTop: 4, background: '#fff' }}>
        {hits.length === 0 && <div style={{ padding: 8, color: C.mid, fontSize: 12 }}>沒有符合的規範</div>}
        {hits.map(r => {
          const on = refs.some(x => x.id === r.id);
          return (
            <div key={r.id} onClick={() => toggle(r)} style={{ padding: '5px 8px', cursor: 'pointer', borderBottom: `1px solid ${C.line}`, background: on ? '#f0fff4' : '#fff', fontSize: 12 }}>
              {on ? '✅' : '⬜'} {r.title} <span style={{ color: C.mid }}>#{r.id}{r.category ? `・${r.category}` : ''}</span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, fontWeight: 700 }}>② 這次的新需求</div>
      <textarea style={{ ...input, minHeight: 110, marginTop: 4, resize: 'vertical' }} value={need} onChange={e => setNeed(e.target.value)}
        placeholder={'例：2027 年母親節活動，期間 4/20～5/12，全門市；買鏡框送鏡片升級，媽媽本人到店再送眼鏡清潔組；目標客群 45 歲以上女性；要有門市佈置、話術、成效追蹤。\n沒寫到的日期、金額，AI 會留「（請填）」。'} />

      {err && <div style={{ color: C.bad, marginTop: 6 }}>{err}</div>}
      {busy && <div style={{ color: '#b7791f', marginTop: 6 }}>⏳ {busy}</div>}
      {!res && <button style={{ ...btnP, marginTop: 8 }} disabled={!!busy} onClick={run}>✨ 開始產生</button>}

      {res && (
        <div style={{ marginTop: 10, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: 10 }}>
          <b>產生好了：《{res.title || '（未命名）'}》</b>
          <div style={{ color: C.mid, marginTop: 2 }}>
            參考：{(res.references || []).map(r => `《${r.title}》`).join('、')}　{res.stats.sections} 個大項、{res.stats.clauses} 條條文
            {res.stats.to_fill > 0 && <span style={{ color: '#b7791f' }}>，有 {res.stats.to_fill} 處「（請填）」要補</span>}
          </div>
          {res.ai_notes?.length > 0 && <ul style={{ margin: '6px 0', paddingLeft: 18, color: C.mid }}>{res.ai_notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          <details style={{ marginTop: 4 }}>
            <summary style={{ cursor: 'pointer', color: C.mid }}>先看大綱</summary>
            {res.sections.map((s, i) => (
              <div key={i} style={{ marginTop: 4 }}>
                <b>{s.title}</b>
                <ul style={{ margin: '2px 0', paddingLeft: 18 }}>{s.items.slice(0, 8).map((c, k) => <li key={k}>{c.text}</li>)}{s.items.length > 8 && <li style={{ color: C.mid }}>…還有 {s.items.length - 8} 條</li>}</ul>
              </div>
            ))}
          </details>
          {hasContent && <div style={{ color: '#b7791f', marginTop: 6 }}>⚠ 套用會取代目前編輯器裡的全部條文（可按「↶ 復原」回來）。</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button style={btnP} onClick={apply}>套用到編輯器</button>
            <button style={btn} onClick={run}>重新產生</button>
            <button style={btn} onClick={() => setRes(null)}>不要</button>
          </div>
        </div>
      )}
    </div>
  );
}
