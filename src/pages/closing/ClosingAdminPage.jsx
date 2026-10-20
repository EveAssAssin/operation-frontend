// pages/closing/ClosingAdminPage.jsx — 結帳資料：門市每月繳交清點（2026-10-21）
// 左側「結帳資料」。資料在市場部（門市在營運工具填），這裡：月份 × 門市矩陣、逐項清點、通過／退回、支出憑證核對、清單設定（示範照片）、截止日
import { useCallback, useEffect, useState } from 'react';
import { closingApi } from '../../services/api';

const ST = { none: ['未開始', '#718096', '#edf2f7'], draft: ['整理中', '#975a16', '#fefcbf'], submitted: ['已寄出・待清點', '#2b6cb0', '#bee3f8'], reviewing: ['清點中（暫存）', '#6b46c1', '#e9d8fd'], approved: ['已通過', '#276749', '#c6f6d5'], returned: ['已退回', '#c53030', '#fed7d7'] };
const RECIP = { '營運部會計': '#2b6cb0', '營運副理': '#6b46c1', '會計事務所': '#2c7a7b', '倉庫': '#c05621', '企劃部': '#b83280', '其他': '#718096' };
const fmt = (n) => Number(n || 0).toLocaleString();
const dt = (s) => (s ? new Date(s).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—');
const d10 = (s) => (s ? String(s).slice(0, 10) : '');
const tpeYm = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7);
const shiftYm = (ym, n) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
async function shrink(file) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.85);
}
const unwrap = (r) => (r && r.data && r.data.success === false ? Promise.reject(new Error(r.data.message)) : r.data.data);

export default function ClosingAdminPage() {
  const [tab, setTab] = useState('list');
  const [ym, setYm] = useState(shiftYm(tpeYm(), -1));
  const [ov, setOv] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);   // { id } | { store }
  const load = useCallback(() => { setErr(''); closingApi.overview(ym).then(unwrap).then(setOv).catch((e) => setErr(e.message)); }, [ym]);
  useEffect(() => { load(); }, [load]);
  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 4px' }}>📦 結帳資料</h2>
      <div style={{ color: '#718096', fontSize: 13, marginBottom: 12 }}>門市每月在「營運工具 → 結帳資料」依 MAP 清單拍照、寄出；這裡清點、通過或退回，支出憑證核對通過後才算進門市月報。</div>
      {err && <div style={{ ...S.card, color: '#c53030' }}>⚠️ {err}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[['list', '清點'], ['tpl', '清單設定'], ['settings', '截止日']].map(([k, l]) => <button key={k} onClick={() => { setTab(k); setOpen(null); }} style={{ ...S.btn, background: tab === k ? '#2d3748' : '#fff', color: tab === k ? '#fff' : '#2d3748' }}>{l}</button>)}
      </div>
      {tab === 'tpl' && <Templates />}
      {tab === 'settings' && <Settings />}
      {tab === 'list' && open && <Detail open={open} ym={ym} onBack={() => { setOpen(null); load(); }} />}
      {tab === 'list' && !open && (
        <>
          <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button style={S.btn} onClick={() => setYm(shiftYm(ym, -1))}>‹</button>
            <b style={{ fontSize: 16 }}>{ym.replace('-', ' 年 ')} 月 結帳資料</b>
            <button style={S.btn} onClick={() => setYm(shiftYm(ym, 1))} disabled={ym >= tpeYm()}>›</button>
            {ov && <span style={{ fontSize: 13, color: '#718096' }}>截止 {ov.due}（每月 {ov.due_day} 號）　・　{ov.summary.stores} 家：待清點 {ov.summary.submitted}、清點中 {ov.summary.reviewing}、通過 {ov.summary.approved}、退回 {ov.summary.returned}、未繳 {ov.summary.none}{ov.summary.overdue ? <span style={{ color: '#c53030' }}>（逾期 {ov.summary.overdue} 家）</span> : ''}</span>}
            <button style={{ ...S.btn, marginLeft: 'auto' }} onClick={load}>↻</button>
          </div>
          {!ov ? <div style={S.card}>載入中…</div> : (
            <table style={S.table}>
              <thead><tr style={{ background: '#f7fafc' }}>{['門市', '狀態', '進度', '疑慮', '寄出', '清點人', '逾期', ''].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{ov.rows.map((r) => { const s = ST[r.status] || ST.none; return (
                <tr key={r.store_erpid} onClick={() => setOpen(r.submission_id ? { id: r.submission_id } : { store: r.store_erpid })} style={{ cursor: 'pointer' }}>
                  <td style={S.td}><b>{r.store_name}</b></td>
                  <td style={S.td}><span style={S.tag(s[1], s[2])}>{s[0]}</span></td>
                  <td style={S.td}>{r.progress.total ? `${r.progress.done}/${r.progress.total}` : '—'}</td>
                  <td style={{ ...S.td, color: r.issues ? '#c53030' : '#718096' }}>{r.issues || '—'}</td>
                  <td style={{ ...S.td, fontSize: 12 }}>{dt(r.submitted_at)}</td>
                  <td style={{ ...S.td, fontSize: 12 }}>{r.reviewed_by_name || '—'}</td>
                  <td style={{ ...S.td, color: r.overdue_days ? '#c53030' : '#718096', fontWeight: r.overdue_days ? 700 : 400 }}>{r.overdue_days ? `${r.overdue_days} 天` : '—'}</td>
                  <td style={S.td}>›</td>
                </tr>); })}</tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

function Detail({ open, ym, onBack }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback((refresh) => { setErr(''); const p = open.id ? closingApi.submission(open.id, refresh) : closingApi.byStore(open.store, ym); return p.then(unwrap).then(setD).catch((e) => setErr(e.message)); }, [open, ym]);
  useEffect(() => { load(); }, [load]);
  if (err) return <div style={{ ...S.card, color: '#c53030' }}>⚠️ {err} <button style={S.btn} onClick={onBack}>回列表</button></div>;
  if (!d) return <div style={S.card}>載入中…</div>;
  const sub = d.submission; const st = ST[sub.status] || ST.none;
  const canReview = ['submitted', 'reviewing', 'approved', 'returned'].includes(sub.status);
  const check = async (it, status) => {
    const note = status === 'issue' ? window.prompt('疑慮內容（會顯示給門市）', it.check_note || '') : '';
    if (status === 'issue' && note === null) return;
    setBusy(it.id); try { await closingApi.checkItem(sub.id, it.id, { check_status: status, check_note: note || '' }).then(unwrap); await load(); } catch (e) { setMsg('❌ ' + e.message); } setBusy('');
  };
  const setStatus = async (status) => {
    let note = '';
    if (status === 'returned') { note = window.prompt('退回原因（會推播給門市店長）'); if (!note) return; }
    else if (status === 'approved') { if (!window.confirm('清點通過？門市會收到通知。')) return; note = window.prompt('備註（選填）') || ''; }
    setBusy('status'); try { await closingApi.setStatus(sub.id, { status, note }).then(unwrap); setMsg(status === 'approved' ? '✅ 已通過' : status === 'returned' ? '↩️ 已退回' : '💾 已暫存'); await load(); } catch (e) { setMsg('❌ ' + e.message); } setBusy('');
  };
  const receipt = async (r, status) => {
    let note = '';
    if (status === 'rejected') { note = window.prompt('不通過原因（門市會看到）'); if (!note) return; }
    setBusy(String(r.pay_id)); try { await closingApi.receipt(r.pay_id, { status, review_note: note }).then(unwrap); await load(); } catch (e) { setMsg('❌ ' + e.message); } setBusy('');
  };
  const replacePhoto = async (r, e) => {
    const files = [...(e.target.files || [])]; if (!files.length) return;
    setBusy(String(r.pay_id));
    try { const urls = []; for (const f of files.slice(0, 6)) { const u = await closingApi.upload(await shrink(f)).then(unwrap); urls.push(u.url); } await closingApi.receipt(r.pay_id, { photos: [...((r.receipt && r.receipt.photos) || []), ...urls] }).then(unwrap); await load(); }
    catch (x) { setMsg('❌ ' + x.message); }
    setBusy('');
  };
  const delPhoto = async (r, u) => { setBusy(String(r.pay_id)); try { await closingApi.receipt(r.pay_id, { photos: (r.receipt.photos || []).filter((x) => x !== u) }).then(unwrap); await load(); } catch (e) { setMsg('❌ ' + e.message); } setBusy(''); };
  const ex = d.expenses;
  const allOk = d.items.every((i) => i.status === 'none' || i.check_status === 'ok') && ex.rows.every((r) => !r.receipt || r.receipt.status === 'approved');
  return (
    <div>
      <button style={{ ...S.btn, marginBottom: 10 }} onClick={onBack}>← 回列表</button>
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div><b style={{ fontSize: 17 }}>{sub.store_name}　{sub.ym}</b><div style={{ fontSize: 12, color: '#718096' }}>門市完成 {d.progress.done}/{d.progress.total}　・　截止 {d.due}{d.overdue_days ? <span style={{ color: '#c53030' }}>　逾期 {d.overdue_days} 天</span> : ''}</div></div>
          <span style={S.tag(st[1], st[2])}>{st[0]}</span>
        </div>
        {sub.submitted_at && <div style={{ fontSize: 13, marginTop: 8 }}>寄出：{sub.submitted_by_name} {dt(sub.submitted_at)}{sub.shipping_note ? `　備註：${sub.shipping_note}` : ''}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>{(sub.shipping_photos || []).map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="寄件憑證" style={S.thumb} /></a>)}</div></div>}
        {sub.status === 'returned' && <div style={{ ...S.note, background: '#fed7d7', color: '#c53030' }}>退回原因：{sub.return_reason}（{sub.reviewed_by_name} {dt(sub.returned_at)}）</div>}
        {sub.status === 'approved' && <div style={{ ...S.note, background: '#c6f6d5', color: '#276749' }}>✅ {sub.reviewed_by_name} 於 {dt(sub.approved_at)} 通過{sub.review_note ? `　${sub.review_note}` : ''}</div>}
        {!canReview && <div style={{ ...S.note, background: '#fefcbf', color: '#975a16' }}>門市還沒寄出，先看得到他們整理到哪裡。</div>}
        {canReview && sub.status !== 'approved' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button style={{ ...S.btn, background: '#6b46c1', color: '#fff' }} disabled={busy === 'status'} onClick={() => setStatus('reviewing')}>💾 暫存（清點中）</button>
            <button style={{ ...S.btn, background: '#2f855a', color: '#fff' }} disabled={busy === 'status'} onClick={() => setStatus('approved')}>✅ 通過</button>
            <button style={{ ...S.btn, background: '#c53030', color: '#fff' }} disabled={busy === 'status'} onClick={() => setStatus('returned')}>↩️ 退回門市</button>
            {!allOk && <span style={{ fontSize: 12, color: '#975a16' }}>還有項目沒勾「已收到」或支出憑證沒核對，仍可通過。</span>}
          </div>
        )}
        {msg && <div style={{ fontSize: 13, marginTop: 6, color: msg.startsWith('❌') ? '#c53030' : '#276749' }}>{msg}</div>}
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>應繳回清單</div>
        {d.items.map((it, i) => (
          <div key={it.id} style={{ borderTop: '1px solid #edf2f7', padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <b>{i + 1}. {it.title}</b>{it.recipient && <span style={S.tag(RECIP[it.recipient] || '#718096', '#fff', true)}>{it.recipient}</span>}
                {it.kind === 'expense' ? <div style={{ fontSize: 12, color: '#718096' }}>見下方「門市支出憑證」：{(it.expense_summary || {}).with_photo || 0}/{(it.expense_summary || {}).count || 0} 筆已拍</div>
                  : <div style={{ fontSize: 12, color: it.status === 'done' ? '#276749' : it.status === 'none' ? '#718096' : '#c53030' }}>{it.status === 'done' ? `✓ 門市完成 ${dt(it.done_at)}` : it.status === 'none' ? '門市：本月無此項' : '門市未完成'}{it.note ? `　備註：${it.note}` : ''}</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>{(it.photos || []).map((u, j) => <a key={j} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={S.thumb} /></a>)}</div>
                {it.check_status === 'issue' && <div style={{ fontSize: 12, color: '#c53030', marginTop: 2 }}>疑慮：{it.check_note}（{it.checked_by}）</div>}
                {it.check_status === 'ok' && <div style={{ fontSize: 12, color: '#276749', marginTop: 2 }}>已收到 ✓（{it.checked_by}）</div>}
              </div>
              {canReview && it.kind !== 'expense' && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button style={{ ...S.btn, background: it.check_status === 'ok' ? '#2f855a' : '#fff', color: it.check_status === 'ok' ? '#fff' : '#2f855a', border: '1px solid #2f855a', padding: '4px 8px', fontSize: 12 }} disabled={busy === it.id} onClick={() => check(it, it.check_status === 'ok' ? 'pending' : 'ok')}>已收到</button>
                  <button style={{ ...S.btn, background: it.check_status === 'issue' ? '#c53030' : '#fff', color: it.check_status === 'issue' ? '#fff' : '#c53030', border: '1px solid #c53030', padding: '4px 8px', fontSize: 12 }} disabled={busy === it.id} onClick={() => check(it, 'issue')}>有疑慮</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ ...S.cardTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span>門市支出憑證（ERP 費用單 {ex.count} 筆、NT$ {fmt(ex.total)}）</span>
          <span style={{ fontSize: 12, color: '#718096' }}>通過 {ex.approved} 筆 NT$ {fmt(ex.approved_total)}　退回 {ex.rejected}　<button style={{ ...S.btn, padding: '2px 8px', fontSize: 12 }} onClick={() => load(true)}>從 ERP 重抓</button></span>
        </div>
        <div style={{ fontSize: 12, color: '#718096', marginBottom: 6 }}>會計核對：通過的才會算進門市月報「分店支出雜項」。可以換照片或補照片。</div>
        {!ex.rows.length && <div style={{ color: '#718096' }}>本月 ERP 沒有費用單。</div>}
        {ex.rows.map((r) => {
          const rc = r.receipt; const stt = rc ? rc.status : 'none';
          return (
            <div key={r.pay_id} style={{ borderTop: '1px solid #edf2f7', padding: '8px 0', display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <b>NT$ {fmt(r.amount)}</b> <span style={{ fontSize: 12, color: '#718096' }}>{d10(r.date)}{r.emp_name ? `・${r.emp_name}` : ''}{r.category ? `・${r.category}` : ''}</span>
                <div style={{ fontSize: 13 }}>{r.remark || <span style={{ color: '#a0aec0' }}>（無備註）</span>}</div>
                {stt === 'rejected' && <div style={{ fontSize: 12, color: '#c53030' }}>退回：{rc.review_note}（{rc.reviewed_by}）</div>}
                {stt === 'approved' && <div style={{ fontSize: 12, color: '#276749' }}>✓ 通過（{rc.reviewed_by} {dt(rc.reviewed_at)}）</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {(rc ? rc.photos : []).map((u, i) => (
                  <span key={i} style={{ position: 'relative' }}><a href={u} target="_blank" rel="noreferrer"><img src={u} alt="" style={S.thumb} /></a>
                    {canReview && <button onClick={() => delPhoto(r, u)} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, border: 'none', background: '#c53030', color: '#fff', fontSize: 11, cursor: 'pointer' }}>×</button>}</span>
                ))}
                {!rc || !rc.photos.length ? <span style={{ fontSize: 12, color: '#c53030' }}>門市未拍</span> : null}
                {canReview && <label style={{ ...S.btn, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>📷 補／換<input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => replacePhoto(r, e)} /></label>}
              </div>
              {canReview && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={{ ...S.btn, background: stt === 'approved' ? '#2f855a' : '#fff', color: stt === 'approved' ? '#fff' : '#2f855a', border: '1px solid #2f855a', padding: '4px 8px', fontSize: 12 }} disabled={busy === String(r.pay_id)} onClick={() => receipt(r, stt === 'approved' ? 'pending' : 'approved')}>通過</button>
                  <button style={{ ...S.btn, background: stt === 'rejected' ? '#c53030' : '#fff', color: stt === 'rejected' ? '#fff' : '#c53030', border: '1px solid #c53030', padding: '4px 8px', fontSize: 12 }} disabled={busy === String(r.pay_id)} onClick={() => receipt(r, 'rejected')}>不通過</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {d.logs.length > 0 && <div style={S.card}><div style={S.cardTitle}>紀錄</div>{d.logs.map((l) => <div key={l.id} style={{ fontSize: 12, color: '#718096' }}>{dt(l.created_at)}　{l.actor_name}　{l.action}{l.detail && l.detail.note ? `：${l.detail.note}` : ''}</div>)}</div>}
    </div>
  );
}

function Templates() {
  const [items, setItems] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => { closingApi.templates().then(unwrap).then(setItems).catch((e) => setMsg('❌ ' + e.message)); }, []);
  if (!items) return <div style={S.card}>載入中…</div>;
  const set = (i, k, v) => { const a = [...items]; a[i] = { ...a[i], [k]: v }; setItems(a); };
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= items.length) return; const a = [...items]; [a[i], a[j]] = [a[j], a[i]]; setItems(a); };
  const addSample = async (i, e) => { const f = e.target.files && e.target.files[0]; if (!f) return; setBusy(String(i)); try { const u = await closingApi.upload(await shrink(f)).then(unwrap); set(i, 'sample_photos', [...(items[i].sample_photos || []), u.url]); } catch (x) { setMsg('❌ ' + x.message); } setBusy(''); };
  const save = async () => { try { const t = await closingApi.saveTemplates(items).then(unwrap); setItems(t); setMsg('✅ 已儲存（之後新建的月份才套用）'); } catch (e) { setMsg('❌ ' + e.message); } };
  return (
    <div style={S.card}>
      <div style={{ fontSize: 12, color: '#718096', marginBottom: 10 }}>依「每月結帳資料 MAP」#217。改了只影響之後新開的月份；每項可放示範照片給門市看。「門市支出」那項是特殊型（逐筆 ERP 費用單憑證），請保留一項。</div>
      {items.map((it, i) => (
        <div key={it.id || i} style={{ borderTop: '1px solid #edf2f7', padding: '8px 0', display: 'grid', gridTemplateColumns: '28px 2fr 3fr 130px auto', gap: 6, alignItems: 'start' }}>
          <span style={{ fontSize: 12, color: '#a0aec0', paddingTop: 8 }}>{i + 1}</span>
          <div><input value={it.title} onChange={(e) => set(i, 'title', e.target.value)} style={S.inp} placeholder="項目" />
            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {(it.sample_photos || []).map((u, j) => <span key={j} style={{ position: 'relative' }}><img src={u} alt="" style={S.thumb} /><button onClick={() => set(i, 'sample_photos', it.sample_photos.filter((x) => x !== u))} style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: 8, border: 'none', background: '#c53030', color: '#fff', fontSize: 10, cursor: 'pointer' }}>×</button></span>)}
              <label style={{ ...S.btn, padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}>{busy === String(i) ? '上傳中…' : '＋示範照片'}<input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => addSample(i, e)} /></label>
            </div></div>
          <textarea value={it.hint || ''} onChange={(e) => set(i, 'hint', e.target.value)} rows={2} style={{ ...S.inp, resize: 'vertical' }} placeholder="說明（整理方式、注意事項）" />
          <select value={it.recipient || ''} onChange={(e) => set(i, 'recipient', e.target.value)} style={S.inp}>{['', '營運部會計', '營運副理', '會計事務所', '倉庫', '企劃部', '其他'].map((r) => <option key={r} value={r}>{r || '收件人'}</option>)}</select>
          <div style={{ display: 'flex', gap: 4 }}><button style={S.small} onClick={() => move(i, -1)}>↑</button><button style={S.small} onClick={() => move(i, 1)}>↓</button>{it.kind !== 'expense' && <button style={{ ...S.small, color: '#c53030' }} onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</button>}{it.kind === 'expense' && <span style={S.tag('#2b6cb0', '#bee3f8')}>支出</span>}</div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
        <button style={S.btn} onClick={() => setItems([...items, { title: '', hint: '', recipient: '', kind: 'normal', sample_photos: [] }])}>＋ 加項目</button>
        <button style={{ ...S.btn, background: '#2d3748', color: '#fff' }} onClick={save}>儲存</button>
        {msg && <span style={{ fontSize: 12, color: msg.startsWith('❌') ? '#c53030' : '#276749' }}>{msg}</span>}
      </div>
    </div>
  );
}
function Settings() {
  const [v, setV] = useState(null); const [msg, setMsg] = useState('');
  useEffect(() => { closingApi.settings().then(unwrap).then(setV).catch((e) => setMsg('❌ ' + e.message)); }, []);
  if (!v) return <div style={S.card}>載入中…</div>;
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>繳回截止日</div>
      <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>每月 <input type="number" min={1} max={28} value={v.due_day} onChange={(e) => setV({ ...v, due_day: Number(e.target.value) })} style={{ ...S.inp, width: 70 }} /> 號前要寄出上個月的結帳資料。截止後每天 10:00 自動 LINE 提醒還沒寄出的門市店長，營運部主管收未繳摘要。</div>
      <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>從 <input type="month" value={v.start_ym || ''} onChange={(e) => setV({ ...v, start_ym: e.target.value })} style={{ ...S.inp, width: 150 }} /> 這個月的結帳資料開始用系統（之前的月份不提醒、不算逾期，門市照舊紙本繳）。
        <button style={{ ...S.btn, background: '#2d3748', color: '#fff' }} onClick={() => closingApi.saveSettings({ due_day: v.due_day, start_ym: v.start_ym }).then(unwrap).then((r) => { setV(r); setMsg('✅ 已存'); }).catch((e) => setMsg('❌ ' + e.message))}>儲存</button>{msg && <span style={{ fontSize: 12 }}>{msg}</span>}</div>
    </div>
  );
}

const S = {
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 },
  cardTitle: { fontWeight: 700, marginBottom: 10 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 },
  th: { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#718096', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '8px 10px', borderBottom: '1px solid #edf2f7', verticalAlign: 'middle' },
  btn: { padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e0', background: '#fff', cursor: 'pointer', fontSize: 13 },
  small: { padding: '2px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12 },
  inp: { padding: '6px 8px', border: '1px solid #cbd5e0', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
  tag: (color, bg, outline) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color, background: outline ? '#fff' : bg || '#edf2f7', border: outline ? `1px solid ${color}` : 'none', marginLeft: 6, whiteSpace: 'nowrap' }),
  thumb: { width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' },
  note: { fontSize: 13, padding: '8px 10px', borderRadius: 6, marginTop: 8 },
};
