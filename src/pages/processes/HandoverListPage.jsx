// pages/processes/HandoverListPage.jsx —— 門市交接表（2026-10-20 合併）
// 原本營運部自己一套交接（operation migration 006，0 筆、填寫網址不用登入）停用；
// 改看市場部那套（App「樂活人員 → 營運工具 → 門市交接」，含「離職交接」），資料經 /api/hr-tool/handovers 唯讀。
// 營運部第三方確認簽名在 App／市場部後台 /handovers 做（要簽名板，手機比較方便）。
import React, { useCallback, useEffect, useState } from 'react';
import { hrToolApi } from '../../services/api';
import HelpTip from '../../components/help/HelpTip';

const C = { primary: '#50422d', bg: '#faf8f5', border: '#e0d5c8', muted: '#8a7a66', ok: '#2d6a4f', danger: '#c53030' };
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 };
const ghost = { border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600, background: '#edf2f7', color: '#4a5568' };
const ST = { pending: '等待同意', accepted: '填寫中', signing: '等簽名', signed: '等營運部確認', completed: '已完成', rejected: '已拒絕', cancelled: '已取消' };
const dt = (s) => (s ? new Date(s).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const MARKET_FE = 'https://market-frontend-qz17.onrender.com';
const HELP = '兩種交接都在這裡看：\n・門市交接：店長在 App「樂活人員 → 營運工具 → 門市交接」發起，雙方填寫、盤點、簽名，最後營運部第三方確認結案（在 App 或市場部後台「門市交接」簽名）。\n・離職交接：離職人員最後上班日早上收到連結，填完簽名送出，門市管理者簽名確認就完成；完成會自動回填人事工具。\n預設項目在這頁上方「預設項目」維護（2026-10-21 從市場部搬過來；門市交接、離職交接共用，改了只影響之後新建的交接表）。';

export default function HandoverListPage() {
  const [kind, setKind] = useState('');
  const [list, setList] = useState([]);
  const [sel, setSel] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    setErr('');
    if (kind === 'tpl') return;
    try { const r = await hrToolApi.handovers(kind ? { kind } : {}); setList(r.data || []); } catch (e) { setErr(e.message || '讀取失敗'); }
  }, [kind]);
  useEffect(() => { load(); }, [load]);
  return (
    <div style={{ padding: 20, background: C.bg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, color: C.primary }}>📝 門市交接表<HelpTip title="門市交接表" body={HELP} /></h2>
        {[['', '全部'], ['store', '門市交接'], ['resign', '離職／停薪交接'], ['tpl', '⚙ 預設項目']].map(([k, l]) => <button key={k} onClick={() => { setKind(k); setSel(null); }} style={{ ...ghost, background: kind === k ? C.primary : '#edf2f7', color: kind === k ? '#fff' : '#4a5568' }}>{l}</button>)}
        <div style={{ flex: 1 }} />
        <a href={`${MARKET_FE}/handovers`} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>市場部後台（第三方確認）↗</a>
      </div>
      {err && <div style={{ ...card, color: C.danger }}>⚠ {err}</div>}
      {kind === 'tpl' ? <Templates /> : <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr', gap: 14, alignItems: 'start' }}>
        <div style={card}>
          {list.map((h) => (
            <div key={h.id} onClick={() => setSel(h.id)} style={{ padding: '10px 8px', borderRadius: 8, cursor: 'pointer', background: sel === h.id ? '#f5f0ea' : 'transparent', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b>{h.kind === 'resign' ? `${h.from_name} ${h.resign_kind === 'suspend' ? '停薪' : '離職'}交接` : h.store_name}</b>
                <span style={{ fontSize: 12, color: h.status === 'completed' ? C.ok : C.muted }}>{ST[h.status] || h.status}</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>{h.kind === 'resign' ? `${h.store_name}・確認人 ${h.to_name}` : `${h.from_name} → ${h.to_name}`}・{dt(h.created_at)}</div>
            </div>
          ))}
          {!list.length && <div style={{ color: C.muted, fontSize: 13 }}>沒有交接</div>}
        </div>
        <div>{sel ? <Detail id={sel} /> : <div style={{ ...card, color: C.muted }}>點左邊一份交接看內容</div>}</div>
      </div>}
    </div>
  );
}

const inp = { padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff' };
const small = { padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: 12 };

// 交接預設項目（2026-10-21 從市場部後台搬過來；門市交接、離職交接共用）
function Templates() {
  const [items, setItems] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    hrToolApi.handoverTemplates().then((r) => { setItems((r.data && r.data.items) || []); setCanEdit(!!(r.data && r.data.can_edit)); }).catch((e) => setMsg('❌ ' + (e.message || '讀取失敗')));
  }, []);
  if (!items) return <div style={card}>{msg || '載入中…'}</div>;
  const set = (i, k, v) => { const a = [...items]; a[i] = { ...a[i], [k]: v }; setItems(a); };
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= items.length) return; const a = [...items]; [a[i], a[j]] = [a[j], a[i]]; setItems(a); };
  const save = async () => {
    if (!items.some((x) => String(x.title || '').trim())) { setMsg('❌ 至少要有一項'); return; }
    setSaving(true); setMsg('');
    try { const r = await hrToolApi.saveHandoverTemplates(items); setItems(r.data || []); setMsg('✅ 已儲存（之後新建的交接表才會用新項目）'); }
    catch (e) { setMsg('❌ ' + (e.response?.data?.message || e.message)); }
    setSaving(false);
  };
  return (
    <div style={{ ...card, maxWidth: 820 }}>
      <b>交接預設項目</b>
      <div style={{ fontSize: 12, color: C.muted, margin: '4px 0 12px' }}>每份交接表（門市交接、離職交接）一開始帶入的項目；店長發起時還可以自己加。改了只影響之後新建的，已經在填的不會變。{!canEdit && ' 你的帳號只能看，要改請找營運主管或人事。'}</div>
      {items.map((it, i) => (
        <div key={it.id || `n${i}`} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <span style={{ width: 22, fontSize: 12, color: C.muted }}>{i + 1}</span>
          <input value={it.title || ''} disabled={!canEdit} onChange={(e) => set(i, 'title', e.target.value)} style={{ ...inp, flex: 2 }} placeholder="項目" />
          <input value={it.hint || ''} disabled={!canEdit} onChange={(e) => set(i, 'hint', e.target.value)} style={{ ...inp, flex: 3 }} placeholder="說明（選填）" />
          {canEdit && <><button onClick={() => move(i, -1)} style={small}>↑</button><button onClick={() => move(i, 1)} style={small}>↓</button>
          <button onClick={() => setItems(items.filter((_, j) => j !== i))} style={{ ...small, color: C.danger }}>✕</button></>}
        </div>
      ))}
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <button onClick={() => setItems([...items, { title: '', hint: '' }])} style={ghost}>＋ 加項目</button>
          <button onClick={save} disabled={saving} style={{ ...ghost, background: C.primary, color: '#fff' }}>{saving ? '儲存中…' : '儲存'}</button>
        </div>
      )}
      {msg && <div style={{ fontSize: 12, marginTop: 8, color: msg.startsWith('❌') ? C.danger : C.ok }}>{msg}</div>}
    </div>
  );
}

function Detail({ id }) {
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); hrToolApi.handover(id).then((r) => setD(r.data)).catch((e) => setD({ error: e.message })); }, [id]);
  if (!d) return <div style={card}>載入中…</div>;
  if (d.error) return <div style={{ ...card, color: C.danger }}>⚠ {d.error}</div>;
  const h = d.handover;
  const sig = (l, url, at) => <div style={{ flex: '0 0 160px' }}><div style={{ fontSize: 12, color: C.muted }}>{l}</div>{url ? <img src={url} alt="簽名" style={{ width: 160, height: 60, objectFit: 'contain', border: `1px solid ${C.border}`, borderRadius: 6 }} /> : <div style={{ height: 60, color: '#ccc', fontSize: 12 }}>未簽</div>}<div style={{ fontSize: 11, color: C.muted }}>{at ? dt(at) : ''}</div></div>;
  return (
    <div>
      <div style={card}>
        <h3 style={{ margin: 0 }}>{h.kind === 'resign' ? `${h.from_name} ${h.resign_kind === 'suspend' ? '停薪' : '離職'}交接` : `${h.store_name} 門市交接`}</h3>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{h.store_name}・{h.kind === 'resign' ? `${h.resign_kind === 'suspend' ? '停薪' : '離職'}人員 ${h.from_name}・確認人 ${h.to_name}` : `原人員 ${h.from_name} → 後人員 ${h.to_name}`}・{ST[h.status] || h.status}</div>
        {h.other_notes && <div style={{ fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap' }}>其他重要事項：{h.other_notes}</div>}
        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          {sig(h.kind === 'resign' ? (h.resign_kind === 'suspend' ? '停薪人員' : '離職人員') : '原人員', h.from_signature, h.from_signed_at)}
          {sig(h.kind === 'resign' ? '確認人' : '後人員', h.to_signature, h.to_signed_at)}
          {h.kind !== 'resign' && sig('營運部', h.third_signature, h.third_signed_at)}
        </div>
      </div>
      <div style={card}>
        <b>交接項目</b>
        <table style={{ width: '100%', fontSize: 13, marginTop: 6, borderCollapse: 'collapse' }}>
          <thead><tr style={{ color: C.muted, textAlign: 'left' }}><th>項目</th><th>{h.kind === 'resign' ? '已交接' : '原人員'}</th><th>備註</th>{h.kind !== 'resign' && <th>後人員</th>}</tr></thead>
          <tbody>
            {(d.items || []).map((it) => (
              <tr key={it.id} style={{ borderTop: '1px solid #f1ede6', verticalAlign: 'top' }}>
                <td style={{ padding: 4 }}>{it.title}</td>
                <td style={{ padding: 4 }}>{it.from_check === 'yes' ? '是' : it.from_check === 'no' ? '否' : '—'}</td>
                <td style={{ padding: 4, whiteSpace: 'pre-wrap' }}>{it.from_note || ''}{(it.from_photos || []).map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" style={{ marginLeft: 4 }}>📷</a>)}</td>
                {h.kind !== 'resign' && <td style={{ padding: 4 }}>{it.to_confirmed ? '✅' : ''}{it.to_note ? ` ${it.to_note}` : ''}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(d.customers || []).length > 0 && (
        <div style={card}>
          <b>特殊客人</b>
          {d.customers.map((c) => <div key={c.id} style={{ fontSize: 13, padding: '4px 0', borderTop: '1px solid #f1ede6' }}>{c.name || '—'} {c.phone || ''}　{c.note || ''}</div>)}
        </div>
      )}
    </div>
  );
}
