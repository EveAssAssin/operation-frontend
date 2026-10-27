// 審核後台：送審清單 → AI 摘要、影響範圍、條文對照、檢查 → 修改／通過／退回；低風險一鍵全過
import React, { useCallback, useEffect, useState } from 'react';
import { regulationApi as api } from '../../services/api';
import DocEditor from './DocEditor';
import { C, card, btn, btnOk, btnD, btnSm, RiskBadge, StatusBadge, Modal, fmtTime, clone, linkify, input } from './ui';

const KIND = { add: ['新增', '#c6f6d5', '#22543d'], mod: ['修改', '#fefcbf', '#744210'], del: ['刪除', '#fed7d7', '#9b2c2c'], move: ['移動', '#e9d8fd', '#553c9a'] };
const META_LABEL = { title: '標題', category: '分類', doc_type: '類型', summary: '摘要', scenario: '適用情境', owner_dept: '負責部門', roles: '適用身分', sections: '大項' };

export default function ReviewPanel({ initialVid, isReviewer, roles, categories, onCountChange }) {
  const [filter, setFilter] = useState('pending');
  const [list, setList] = useState([]);
  const [cur, setCur] = useState(initialVid || null);
  const [data, setData] = useState(null);
  const [editDoc, setEditDoc] = useState(null);
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    const r = await api.reviews(filter);
    const rows = r?.success ? r.data : [];
    setList(rows);
    if (filter === 'pending') onCountChange?.(rows.length);
  }, [filter, onCountChange]);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => {
    if (!cur) { setData(null); return; }
    setEditDoc(null); setMsg(null);
    api.review(cur).then(r => setData(r?.success ? r.data : null));
  }, [cur]);

  const v = data?.version, rv = v?.review, reg = data?.regulation;
  const pending = v?.status === 'pending';

  const doApprove = async ({ notify, notice }) => {
    setBusy(true);
    try {
      const r = await api.approve(v.id, { doc: editDoc || undefined, notify_staff: notify, notice });
      if (!r?.success) throw new Error(r?.message || '通過失敗');
      setModal(null); setMsg({ text: `已通過${r.data.edited ? '（含你的修改）' : ''}${r.data.notified ? `，已推播給 ${r.data.notified} 人` : ''}` });
      await loadList(); const d = await api.review(v.id); setData(d?.success ? d.data : null); setEditDoc(null);
    } catch (e) { setMsg({ err: true, text: e.message }); } finally { setBusy(false); }
  };
  const doReturn = async (reason) => {
    setBusy(true);
    try {
      const r = await api.returnBack(v.id, reason);
      if (!r?.success) throw new Error(r?.message || '退回失敗');
      setModal(null); setMsg({ text: '已退回並通知送審人' });
      await loadList(); const d = await api.review(v.id); setData(d?.success ? d.data : null);
    } catch (e) { setMsg({ err: true, text: e.message }); } finally { setBusy(false); }
  };
  const lowCount = list.filter(x => x.risk === '低').length;
  const doLow = async () => {
    if (!window.confirm(`把 ${lowCount} 件低風險送審全部通過？`)) return;
    const r = await api.approveLow();
    setMsg(r?.success ? { text: `已通過 ${r.data.approved} 件` } : { err: true, text: r?.message || '失敗' });
    loadList();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px,320px) minmax(0,1fr)', gap: 12, alignItems: 'start' }}>
      <div style={card}>
        <div style={{ padding: 8, display: 'flex', gap: 6, borderBottom: `1px solid ${C.line}`, flexWrap: 'wrap' }}>
          {[['pending', '待審'], ['done', '已處理']].map(([k, l]) => (
            <button key={k} style={{ ...btn, ...btnSm, ...(filter === k ? { background: C.brand, color: '#fff', borderColor: C.brand } : {}) }} onClick={() => setFilter(k)}>{l}</button>
          ))}
          {isReviewer && filter === 'pending' && <button style={{ ...btn, ...btnSm, marginLeft: 'auto' }} disabled={!lowCount} onClick={doLow}>低風險一鍵全過（{lowCount}）</button>}
        </div>
        {list.map(x => (
          <div key={x.id} onClick={() => setCur(x.id)} style={{ padding: '8px 10px', borderBottom: `1px solid ${C.line}`, cursor: 'pointer', background: cur === x.id ? '#f3ede4' : undefined, borderLeft: cur === x.id ? `3px solid ${C.brand}` : '3px solid transparent' }}>
            <div style={{ fontWeight: 700 }}>{x.title} <RiskBadge r={x.risk} /> {x.status !== 'pending' && <StatusBadge s={x.status} />}</div>
            <div style={{ fontSize: 12, color: C.mid }}>第 {x.version} 版 · {x.created_by_name || '—'} · {fmtTime(x.submitted_at)}</div>
            <div style={{ fontSize: 12.5 }}>{x.change_note || x.summary?.[0] || ''}</div>
          </div>
        ))}
        {!list.length && <div style={{ padding: 20, color: '#a0aec0', textAlign: 'center' }}>{filter === 'pending' ? '目前沒有待審' : '沒有紀錄'}</div>}
      </div>

      <div style={{ ...card, minHeight: 300 }}>
        {!data && <div style={{ padding: 30, color: '#a0aec0', textAlign: 'center' }}>從左邊選一件送審</div>}
        {data && rv && (
          <div style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 19, fontWeight: 800 }}>{v.doc?.title}</div>
                <div style={{ fontSize: 12, color: C.mid }}>規範 {reg.id} · 第 {reg.current_version || '—'} → {v.version} 版 · {v.created_by_name || '—'} {fmtTime(v.submitted_at)} 送審 · <StatusBadge s={v.status} /></div>
                {v.change_note && <div style={{ fontSize: 13, marginTop: 2 }}>送審說明：{v.change_note}</div>}
              </div>
              <RiskBadge r={rv.risk} />
            </div>

            <div style={{ background: '#f0f7ff', border: '1px solid #bee3f8', borderRadius: 10, padding: '8px 14px', margin: '12px 0' }}>
              <b style={{ color: '#2b6cb0' }}>{rv.ai ? '🤖 AI 摘要' : '摘要'}：改了什麼</b>
              <ol style={{ margin: '4px 0 0', paddingLeft: 20 }}>{(rv.summary || []).map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8 }}>
              <Imp k="影響人員" v={`門市 ${rv.impact?.stores ?? 0} 間 ${rv.impact?.store_people ?? 0} 人`} d={rv.impact?.office_people ? `＋辦公室 ${rv.impact.office_people} 人` : '不含辦公室'} />
              <Imp k="連帶規範" v={`${(rv.impact?.linked || []).length} 份`} d={(rv.impact?.linked || []).slice(0, 3).map(l => l.title).join('、') || '沒有其他規範引用這份'} />
              <Imp k="可扣分條文變動" v={`${rv.impact?.penalty_changes ?? 0} 條`} d={`改到的條文近 90 天被引用扣分 ${rv.impact?.recent_deductions ?? 0} 次`} />
              <Imp k="適用身分" v={`${(rv.impact?.roles || []).length} 種`} d={(rv.impact?.roles || []).join('、')} />
            </div>

            {(rv.notes || []).length > 0 && (
              <div style={{ background: '#fffaf0', border: '1px solid #fbd38d', borderRadius: 10, padding: '8px 12px', marginTop: 10, fontSize: 13 }}>
                💡 <b style={{ color: '#975a16' }}>AI 提醒你注意</b>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{rv.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </div>
            )}

            <h3 style={{ fontSize: 15, margin: '16px 0 6px', borderBottom: `2px solid ${C.line}`, paddingBottom: 3 }}>
              條文對照（{rv.diff.changes.length} 處{rv.diff.meta.length ? `＋${rv.diff.meta.length} 個欄位` : ''}）
              {v.reviewer_edited && <span style={{ fontSize: 11, color: '#2b6cb0', marginLeft: 6 }}>審核人修改後通過</span>}
            </h3>
            {rv.diff.meta.map((m, i) => (
              <Diff key={`m${i}`} head={<><b>{META_LABEL[m.field] || m.field}</b></>} kind="mod"
                old={Array.isArray(m.old) ? m.old.join('、') : m.old} neu={Array.isArray(m.new) ? m.new.join('、') : m.new} />
            ))}
            {rv.diff.changes.map((c, i) => (
              <Diff key={i} kind={c.kind}
                head={<><span style={{ fontFamily: 'monospace', color: '#8b6f4e' }}>{c.code}</span> {c.display_no}
                  {(c.fields || []).includes('images') && <span style={{ fontSize: 12, color: '#2b6cb0' }}> 照片有變動</span>}
                  {(c.fields || []).includes('penalty') && <span style={{ color: C.bad, fontSize: 12 }}> 扣分 {c.old_penalty ?? '預設'} → {c.penalty ?? '預設'}</span>}
                  {c.moved && c.kind !== 'add' && <span style={{ fontSize: 12, color: '#553c9a' }}> 從 {c.old_display_no} 移到這裡</span>}</>}
                old={c.kind === 'add' || c.kind === 'move' ? null : c.old}
                neu={c.kind === 'del' ? null : (c.kind === 'move' ? c.new : c.new)}
                notes={(c.fields || []).includes('notes') ? c.notes : null} />
            ))}

            {rv.ai_checks && (
              <>
                <h3 style={{ fontSize: 15, margin: '16px 0 6px', borderBottom: `2px solid ${C.line}`, paddingBottom: 3 }}>🛡 AI 檢查（{fmtTime(rv.ai_checks.at)}）</h3>
                {!(rv.ai_checks.issues || []).length && <div style={{ fontSize: 13 }}>✅ AI 沒有發現問題</div>}
                {(rv.ai_checks.issues || []).map((i, k) => (
                  <div key={k} style={{ fontSize: 13, padding: '5px 8px', margin: '4px 0', borderRadius: 8, background: i.resolved?.how === 'ignored' ? '#fffaf0' : '#f7fafc', border: `1px solid ${i.resolved?.how === 'ignored' ? '#fbd38d' : C.line}` }}>
                    {i.level === 'warn' ? '⚠️' : '💡'} <b>{i.title}</b> <span style={{ color: C.mid }}>{i.detail}</span>
                    <div style={{ fontSize: 12, marginTop: 2 }}>
                      {i.resolved?.how === 'applied' && <span style={{ color: C.ok }}>✓ 送審人已套用 AI 修正</span>}
                      {i.resolved?.how === 'ignored' && <span style={{ color: '#975a16' }}>送審人選擇忽略，原因：<b>{i.resolved.reason}</b></span>}
                      {!i.resolved && i.level === 'info' && <span style={{ color: C.mid }}>建議（未處理）</span>}
                    </div>
                    {(i.other_regs || []).map((r, j) => <div key={j} style={{ fontSize: 12 }}>📎 {r.title} {r.code}：{r.suggestion}</div>)}
                  </div>
                ))}
              </>
            )}
            <h3 style={{ fontSize: 15, margin: '16px 0 6px', borderBottom: `2px solid ${C.line}`, paddingBottom: 3 }}>檢查</h3>
            {(rv.checks || []).map((c, i) => <div key={i} style={{ fontSize: 13, padding: '2px 0' }}>{c.lv === 'ok' ? '✅' : c.lv === 'warn' ? '⚠️' : '💡'} {c.text}</div>)}
            {(rv.risk_reasons || []).length > 0 && <div style={{ fontSize: 12, color: C.mid, marginTop: 4 }}>風險判定：{rv.risk_reasons.slice(0, 8).join('；')}</div>}
            {v.status === 'returned' && <div style={{ marginTop: 10, color: C.bad }}>↩️ 已退回：{v.review_note}</div>}

            {editDoc && (
              <div style={{ marginTop: 16, border: '2px solid #90cdf4', borderRadius: 10, padding: 12 }}>
                <b style={{ color: '#2b6cb0' }}>✏️ 你正在修改送審內容</b><span style={{ fontSize: 12, color: C.mid }}>（通過時會用你改過的版本，並記錄為「審核人修改後通過」）</span>
                <div style={{ marginTop: 8 }}><DocEditor doc={editDoc} onChange={setEditDoc} roles={roles} categories={categories} /></div>
              </div>
            )}
            {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.err ? C.bad : C.ok }}>{msg.text}</div>}
          </div>
        )}
        {data && pending && (
          <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: `1px solid ${C.line}`, padding: '10px 14px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderRadius: '0 0 10px 10px' }}>
            {!isReviewer ? <span style={{ fontSize: 13, color: C.mid }}>只有指定的審核人可以審核</span> : (
              <>
                {editDoc ? <button style={btn} onClick={() => setEditDoc(null)}>取消修改</button>
                  : <button style={btn} onClick={() => setEditDoc(clone(v.doc))}>✏️ 修改內容</button>}
                <span style={{ flex: 1 }} />
                <button style={btnD} disabled={busy} onClick={() => setModal('return')}>退回</button>
                <button style={btnOk} disabled={busy} onClick={() => setModal('approve')}>{editDoc ? '修改後通過' : '通過'}</button>
              </>
            )}
          </div>
        )}
      </div>

      {modal === 'approve' && <ApproveModal v={v} edited={!!editDoc} busy={busy} onClose={() => setModal(null)} onOk={doApprove} />}
      {modal === 'return' && <ReturnModal v={v} busy={busy} onClose={() => setModal(null)} onOk={doReturn} />}
    </div>
  );
}

function Imp({ k, v, d }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: '8px 10px', background: '#fcfaf6' }}>
      <div style={{ fontSize: 11.5, color: C.mid }}>{k}</div>
      <div style={{ fontSize: 15, fontWeight: 800 }}>{v}</div>
      <div style={{ fontSize: 11.5, color: C.mid }}>{d}</div>
    </div>
  );
}
function Diff({ head, kind, old, neu, notes }) {
  const [t, bg, fg] = KIND[kind] || KIND.mod;
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, margin: '6px 0', overflow: 'hidden' }}>
      <div style={{ background: '#f6f1ea', padding: '4px 10px', fontSize: 12 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 6, padding: '0 6px', background: bg, color: fg, marginRight: 6 }}>{t}</span>{head}
      </div>
      {old != null && old !== '' && <div style={{ padding: '6px 10px', background: '#fff5f5', color: '#9b2c2c', textDecoration: 'line-through', whiteSpace: 'pre-wrap' }}>{old}</div>}
      {neu != null && neu !== '' && <div style={{ padding: '6px 10px', background: kind === 'move' ? '#faf5ff' : '#f0fff4', color: kind === 'move' ? '#553c9a' : '#22543d', whiteSpace: 'pre-wrap' }}>{linkify(neu)}</div>}
      {notes && notes.map((n, i) => <div key={i} style={{ padding: '3px 10px 3px 20px', fontSize: 12.5, background: '#f0fff4' }}>{n.kind}：{n.text}</div>)}
    </div>
  );
}
function ApproveModal({ v, edited, busy, onClose, onOk }) {
  const rv = v.review || {};
  const [notify, setNotify] = useState(rv.risk !== '低');
  const [notice, setNotice] = useState(`【規範更新】${v.doc?.title}（第 ${v.version} 版）\n${(rv.summary || []).join('\n')}`);
  return (
    <Modal title={`${edited ? '修改後通過' : '通過'}：${v.doc?.title} 第 ${v.version} 版`} onClose={onClose}>
      <div style={{ fontSize: 13, marginBottom: 8 }}>✅ 通過後立即生效，並通知送審人（LINE）。之後引用條文扣分會記錄這一版。</div>
      <label style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 13 }}>
        <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />
        <span>推播「規範更新」給受影響人員（門市 {rv.impact?.store_people ?? 0} 人{rv.impact?.office_people ? `＋辦公室 ${rv.impact.office_people} 人` : ''}）
          {rv.risk === '低' && <div style={{ color: C.mid, fontSize: 12 }}>低風險（只改順序或文字），建議不推播，避免訊息太多</div>}</span>
      </label>
      {notify && <textarea style={{ ...input, minHeight: 110, marginTop: 6 }} value={notice} onChange={e => setNotice(e.target.value)} />}
      <div style={{ fontSize: 12, color: C.mid, marginTop: 6 }}>同步回 MAP：等左手開放規範寫入 API 後自動進行，目前先記為「待同步」。</div>
      <div style={{ textAlign: 'right', marginTop: 12 }}>
        <button style={btn} onClick={onClose}>取消</button> <button style={btnOk} disabled={busy} onClick={() => onOk({ notify, notice })}>{busy ? '處理中…' : '確認通過'}</button>
      </div>
    </Modal>
  );
}
function ReturnModal({ v, busy, onClose, onOk }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title={`退回：${v.doc?.title}`} onClose={onClose}>
      <div style={{ fontSize: 13, color: C.mid, marginBottom: 6 }}>退回原因會推播給送審人（{v.created_by_name || '—'}），他修改後可以重新送審。</div>
      <textarea style={{ ...input, minHeight: 100 }} value={reason} onChange={e => setReason(e.target.value)} autoFocus placeholder="例如：月底跨月的業績歸屬先跟會計確認後再送" />
      <div style={{ textAlign: 'right', marginTop: 12 }}>
        <button style={btn} onClick={onClose}>取消</button> <button style={btnD} disabled={busy || !reason.trim()} onClick={() => onOk(reason.trim())}>確認退回</button>
      </div>
    </Modal>
  );
}
