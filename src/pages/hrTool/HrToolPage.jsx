// pages/hrTool/HrToolPage.jsx —— 人事工具（2026-10-20）
// 離職申請（App 營運工具 → 其他申請 → 離職申請，門市管理者簽核後進來）的後續作業：
//   人事確認 → 補填 → 勞保退保 → 健保退保 → 資遣通報（只有資遣）→ 離職交接（自動）→ 關閉登入（自動）→ 左手設離職 → 結案
// 資料在市場部（/api/hr-tool 轉 /api/internal/resign）；投保單位在這邊設定。
import React, { useCallback, useEffect, useState } from 'react';
import { hrToolApi } from '../../services/api';
import HelpTip from '../../components/help/HelpTip';
import { useCoachMarks } from '../../components/help/CoachMarks';

const C = { primary: '#50422d', bg: '#faf8f5', border: '#e0d5c8', muted: '#8a7a66', ok: '#2d6a4f', danger: '#c53030', warn: '#b45309' };
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 };
const btn = (bg, fg) => ({ border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600, background: bg, color: fg || '#fff' });
const ghost = { ...btn('#edf2f7', '#4a5568') };
const input = { border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', fontSize: 13 };
const dt = (s) => (s ? new Date(s).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const ST = { pending_manager: ['等門市管理者', '#92400e', '#fef3c7'], pending_hr: ['等人事確認', '#1d4ed8', '#dbeafe'], processing: ['作業中', '#7c3aed', '#ede9fe'], closed: ['已結案', '#065f46', '#d1fae5'], rejected: ['已退回', '#991b1b', '#fee2e2'], cancelled: ['已取消', '#6b7280', '#f3f4f6'] };
const chip = (st) => { const x = ST[st] || [st, '#444', '#eee']; return <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: x[1], background: x[2] }}>{x[0]}</span>; };
async function errText(e) { return (e && e.message) || '失敗'; }
const daysTo = (ymd) => { const t = new Date(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' })); return Math.round((new Date(ymd) - t) / 86400000); };

const HELP = {
  page: '離職申請由人員在 App「樂活人員 → 營運工具 → 其他申請 → 離職申請」送出，門市管理者簽名通過後會出現在這裡（沒有門市管理者的直接進來）。\n每一張卡由上往下做，做完一步打勾，全部完成按「結案」。人員填的身分證字號、生日、地址只有這裡看得到，結案 90 天後自動刪除。',
  accept: '確認離職日（可以改）和離職類型。選「資遣」才會出現資遣通報那一步。',
  extra: '人員沒填或要修正的資料在這裡補。到職日、資遣事由是資遣通報要的；投保單位會自動依門市帶出（在右上「⚙ 設定」維護），特殊情況可以手動改。',
  li: '勞保、就保、職保、勞退是同一張退保申報。系統不能代送（要單位憑證＋自然人憑證），按「開啟網站」登入後，照下面逐欄按「複製」貼上。送出後回來按「已退保」。離職日前 10 天內可以預辦。',
  nhi: '健保退保要另外到健保署的系統辦。一樣逐欄複製，送出後按「已退保」。',
  layoff: '資遣才要通報，法定在離職日前 10 日內完成。系統依門市所在縣市帶出受理網站（臺北、新北、臺中有自己的網站，其他縣市用勞動力發展署）。網站要手動填寫，照下面逐欄複製，完成後按「已通報」。',
  handover: '人員最後上班日早上 9 點系統會推播「離職交接」連結，人員填完簽名、門市管理者簽名確認後，這一步自動打勾。',
  access: '離職日隔天 00:00 系統自動關閉這位人員的登入：App 樂活人員入口、市場部系統、營運部系統（App 變回一般會員要主後端更新後才生效）。提早離開可以按「現在關閉」；取消離職或關錯了按「恢復」。',
  lefthand: '左手系統的離職要人事到左手後台自己按（左手沒有開放這個 API）。按完回來打勾。',
  final_pay: '最後一期薪資、加班費、勞健保費用結算完成後打勾（自願離職聲明有寫「離職當下已結算完成」）。',
};
const TOUR = [
  { sel: '[data-tour="hr-list"]', title: '待處理的離職', body: '門市管理者簽核過的離職申請都在這裡，依離職日排序；快到離職日或資遣通報快到期會標紅。' },
  { sel: '[data-tour="hr-settings"]', title: '先設定投保單位', body: '第一次用請先按「⚙ 設定」填各公司的勞保保險證號、健保投保單位代號，並指定哪些門市屬於哪家公司。' },
  { sel: '[data-tour="hr-steps"]', title: '一步一步做', body: '點左邊一位人員，右邊由上往下做：確認 → 補資料 → 退保 → 資遣通報（資遣才有）→ 交接、關閉登入（系統自動）→ 結案。每一步旁邊的「?」有說明。' },
  { sel: '[data-tour="hr-copy"]', title: '逐欄複製', body: '勞保局、健保署、資遣通報網站系統不能代送，按「開啟網站」後照順序按「複製」貼上就好。' },
];

export default function HrToolPage() {
  const [tab, setTab] = useState('open');
  const [list, setList] = useState([]);
  const [sel, setSel] = useState(null);
  const [err, setErr] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const { start, overlay } = useCoachMarks(TOUR, 'tour_hr_tool_v1', true);
  const load = useCallback(async () => {
    setErr('');
    try { const r = await hrToolApi.list(tab); setList(r.data || []); } catch (e) { setErr(await errText(e)); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);
  return (
    <div style={{ padding: 20, background: C.bg, minHeight: '100vh' }}>
      {overlay}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, color: C.primary }}>🧾 人事工具・離職後續<HelpTip title="人事工具" body={HELP.page} /></h2>
        <div style={{ flex: 1 }} />
        <button style={ghost} onClick={start}>📖 使用說明</button>
        <button data-tour="hr-settings" style={ghost} onClick={() => setShowSettings(true)}>⚙ 設定</button>
      </div>
      {err && <div style={{ ...card, color: C.danger }}>⚠ {err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 14, alignItems: 'start' }}>
        <div data-tour="hr-list" style={card}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[['open', '進行中'], ['closed', '已結束']].map(([k, l]) => <button key={k} onClick={() => { setTab(k); setSel(null); }} style={tab === k ? btn(C.primary) : ghost}>{l}</button>)}
          </div>
          {list.map((r) => {
            const d = daysTo(r.resign_date);
            const layoffLate = r.resign_type === 'layoff' && !(r.steps || {}).layoff && d <= 12;
            return (
              <div key={r.id} onClick={() => setSel(r.id)} style={{ padding: '10px 8px', borderRadius: 8, cursor: 'pointer', background: sel === r.id ? '#f5f0ea' : 'transparent', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{r.name}</b>{chip(r.status)}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{r.store_name}・離職日 {r.resign_date}{tab === 'open' && <span style={{ color: d <= 3 ? C.danger : C.muted }}>（{d >= 0 ? `${d} 天後` : `已過 ${-d} 天`}）</span>}</div>
                {layoffLate && <div style={{ fontSize: 11, color: C.danger }}>⚠ 資遣通報還沒做（離職日前 10 日）</div>}
                {r.blocked && <div style={{ fontSize: 11, color: C.muted }}>🔒 已關閉登入</div>}
              </div>
            );
          })}
          {!list.length && <div style={{ color: C.muted, fontSize: 13 }}>{tab === 'open' ? '目前沒有待處理的離職' : '沒有資料'}</div>}
        </div>
        <div data-tour="hr-steps">{sel ? <Detail id={sel} onChanged={load} /> : <div style={{ ...card, color: C.muted }}>點左邊一位人員開始處理</div>}</div>
      </div>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function Detail({ id, onChanged }) {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [acc, setAcc] = useState({ resign_type: '', resign_date: '' });
  const [extra, setExtra] = useState({});
  const load = useCallback(async () => {
    try {
      const r = await hrToolApi.get(id); const x = r.data;
      setD(x);
      setAcc({ resign_type: x.request.resign_type || '', resign_date: x.request.resign_date });
      setExtra({ hire_date: '', gender: x.request.gender || '', layoff_reason: '', need_job_service: '', insurance_unit_id: (x.unit || {}).id || '', city: x.city || '', ...(x.request.hr_extra || {}), id_no: (x.pii || {}).id_no || '', birthday: (x.pii || {}).birthday || '', address: (x.pii || {}).address || '', phone: x.request.phone || '' });
    } catch (e) { setMsg('⚠ ' + await errText(e)); }
  }, [id]);
  useEffect(() => { setD(null); setMsg(''); load(); }, [load]);
  if (!d) return <div style={{ ...card, color: msg ? C.danger : C.muted }}>{msg || '載入中…'}</div>;
  const r = d.request, steps = r.steps || {};
  const act = async (body, okMsg) => {
    setBusy(true); setMsg('');
    try { await hrToolApi.action(r.id, body); setMsg(okMsg || '已更新'); await load(); onChanged && onChanged(); } catch (e) { setMsg('⚠ ' + await errText(e)); } finally { setBusy(false); }
  };
  const isLayoff = r.resign_type === 'layoff';
  const need = ['li', 'nhi', ...(isLayoff ? ['layoff'] : []), 'lefthand', 'final_pay'];
  const missing = need.filter((k) => !steps[k]);
  const Step = ({ k, label, help, children, auto }) => (
    <div style={{ ...card, borderLeft: `4px solid ${steps[k] ? C.ok : C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b>{steps[k] ? '✅' : '⬜'} {label}</b><HelpTip title={label} body={help} />
        {steps[k] && <span style={{ fontSize: 12, color: C.muted }}>{dt(steps[k].at)}・{steps[k].by}{steps[k].note ? `・${steps[k].note}` : ''}</span>}
        <div style={{ flex: 1 }} />
        {!auto && r.status !== 'closed' && (steps[k]
          ? <button style={ghost} disabled={busy} onClick={() => act({ action: 'unstep', step: k })}>取消打勾</button>
          : <button style={btn(C.ok)} disabled={busy} onClick={() => act({ action: 'step', step: k }, `已完成：${label}`)}>標記完成</button>)}
      </div>
      {children}
    </div>
  );
  const sig = (label, url, at) => url ? <div style={{ flex: '0 0 160px' }}><div style={{ fontSize: 12, color: C.muted }}>{label}</div><img src={url} alt="簽名" style={{ width: 160, height: 60, objectFit: 'contain', background: '#fafafa', border: `1px solid ${C.border}`, borderRadius: 6 }} /><div style={{ fontSize: 11, color: C.muted }}>{dt(at)}</div></div> : null;
  return (
    <div>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>{r.name}</h3>{chip(r.status)}
          <span style={{ color: C.muted, fontSize: 13 }}>{r.store_name}・{r.jobtitle || '—'}・客編 {r.app_number}{r.erpid ? `・員編 ${r.erpid}` : ''}</span>
        </div>
        <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.8 }}>
          申請 {r.apply_date}・預計離職 <b>{r.resign_date}</b>{d.type_name ? `・${d.type_name}` : ''}・電話 {r.phone || '—'}<br />
          {r.reason && <>事由：{r.reason}<br /></>}
          主管：{r.manager_name ? `${r.manager_name} ${dt(r.manager_at)} 簽核` : r.approver_app ? `等 ${r.approver_name} 簽核` : '沒有門市管理者（直接送人事）'}{r.manager_note ? `（${r.manager_note}）` : ''}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>{sig('自願離職聲明 本人簽名', r.decl_signature, r.decl_signed_at)}{sig(`直屬主管 ${r.manager_name || ''}`, r.manager_signature, r.manager_at)}</div>
        {msg && <div style={{ marginTop: 8, fontSize: 13, color: msg.startsWith('⚠') ? C.danger : C.ok }}>{msg}</div>}
      </div>

      <div style={{ ...card, borderLeft: `4px solid ${r.hr_at ? C.ok : C.warn}` }}>
        <b>{r.hr_at ? '✅' : '⬜'} ① 人事確認</b><HelpTip title="人事確認" body={HELP.accept} />
        {r.hr_at && <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>{r.hr_name} {dt(r.hr_at)}</span>}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13 }}>離職日 <input type="date" value={acc.resign_date} onChange={(e) => setAcc({ ...acc, resign_date: e.target.value })} style={input} /></label>
          <label style={{ fontSize: 13 }}>類型{' '}
            <select value={acc.resign_type} onChange={(e) => setAcc({ ...acc, resign_type: e.target.value })} style={input}>
              <option value="">請選</option><option value="voluntary">自願離職</option><option value="layoff">資遣</option><option value="other">其他</option>
            </select>
          </label>
          {r.hr_at
            ? <button style={ghost} disabled={busy || !acc.resign_type} onClick={() => act({ action: 'update', resign_type: acc.resign_type, resign_date: acc.resign_date })}>更新</button>
            : <button style={btn(C.primary)} disabled={busy || !acc.resign_type || ['closed', 'cancelled', 'rejected'].includes(r.status)} onClick={() => act({ action: 'accept', resign_type: acc.resign_type, resign_date: acc.resign_date }, '已確認，開始作業')}>確認</button>}
          {r.status === 'pending_manager' && <span style={{ fontSize: 12, color: C.warn }}>門市管理者還沒簽核；人事也可以直接確認</span>}
        </div>
      </div>

      <div style={card}>
        <b>② 資料（可補填）</b><HelpTip title="補填資料" body={HELP.extra} />
        {d.pii && d.pii.error && <div style={{ color: C.danger, fontSize: 13 }}>⚠ {d.pii.error}</div>}
        {!d.pii && r.pii_purged_at && <div style={{ color: C.muted, fontSize: 13 }}>個資已於 {dt(r.pii_purged_at)} 自動刪除</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginTop: 8 }}>
          {[['id_no', '身分證字號'], ['birthday', '出生日期', 'date'], ['address', '地址'], ['phone', '電話'], ['hire_date', '到職日', 'date'], ['gender', '性別'], ['city', '工作地縣市']].map(([k, l, t]) => (
            <label key={k} style={{ fontSize: 12, color: C.muted }}>{l}<br /><input type={t || 'text'} value={extra[k] || ''} onChange={(e) => setExtra({ ...extra, [k]: e.target.value })} style={{ ...input, width: '100%' }} /></label>
          ))}
          <label style={{ fontSize: 12, color: C.muted }}>投保單位<br />
            <select value={extra.insurance_unit_id || ''} onChange={(e) => setExtra({ ...extra, insurance_unit_id: e.target.value })} style={{ ...input, width: '100%' }}>
              <option value="">（依門市自動）</option>{(d.units || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          {isLayoff && <>
            <label style={{ fontSize: 12, color: C.muted, gridColumn: '1 / -1' }}>資遣事由（勞基法第 11 條第幾款＋說明）<br /><input value={extra.layoff_reason || ''} onChange={(e) => setExtra({ ...extra, layoff_reason: e.target.value })} style={{ ...input, width: '100%' }} /></label>
            <label style={{ fontSize: 12, color: C.muted }}>是否需要就業服務<br /><select value={extra.need_job_service || ''} onChange={(e) => setExtra({ ...extra, need_job_service: e.target.value })} style={{ ...input, width: '100%' }}><option value="">—</option><option>是</option><option>否</option></select></label>
          </>}
        </div>
        {!d.units?.length && <div style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>還沒設定投保單位，請按右上「⚙ 設定」</div>}
        <button style={{ ...btn(C.primary), marginTop: 10 }} disabled={busy} onClick={() => {
          const { id_no, birthday, address, phone, ...hr } = extra;
          act({ action: 'update', hr_extra: hr, phone, pii: { id_no, birthday, address } }, '資料已更新');
        }}>儲存資料</button>
      </div>

      <div data-tour="hr-copy"><FormStep k="li" label="③ 勞保退保（勞保局 e化服務）" help={HELP.li} form={d.forms.li} Step={Step} /></div>
      <FormStep k="nhi" label="④ 健保退保（健保署）" help={HELP.nhi} form={d.forms.nhi} Step={Step} />
      {isLayoff && <FormStep k="layoff" label={`⑤ 資遣通報（${d.forms.layoff.city || '縣市不明'}）`} help={HELP.layoff} form={d.forms.layoff} Step={Step} warn={daysTo(r.resign_date) <= 10 && !steps.layoff ? `離職日 ${r.resign_date}，法定要在離職日前 10 日通報，請盡快處理` : ''} />}

      <Step k="handover" label="離職交接（系統自動）" help={HELP.handover} auto>
        <div style={{ fontSize: 13, marginTop: 6 }}>{d.handover ? `狀態：${{ accepted: '離職人員填寫中', signing: `等 ${d.handover.to_name} 確認`, completed: '已完成', cancelled: '已取消' }[d.handover.status] || d.handover.status}` : `還沒開始（最後上班日 ${r.resign_date} 早上 9 點自動推播）`}</div>
      </Step>
      <Step k="access" label="關閉系統登入（離職日隔天自動）" help={HELP.access} auto>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13 }}>{d.blocked ? `🔒 已關閉（${dt(r.access_blocked_at)}）` : r.access_restored_at ? `已恢復（${dt(r.access_restored_at)}）` : `未關閉（${r.resign_date} 隔天 00:00 自動）`}</span>
          {!d.blocked && r.status !== 'cancelled' && <button style={btn(C.danger)} disabled={busy} onClick={() => { if (window.confirm(`現在就關閉 ${r.name} 的系統登入？`)) act({ action: 'block' }, '已關閉登入'); }}>現在關閉</button>}
          {d.blocked && <button style={ghost} disabled={busy} onClick={() => { if (window.confirm(`恢復 ${r.name} 的系統登入？`)) act({ action: 'restore' }, '已恢復'); }}>恢復</button>}
        </div>
      </Step>
      <Step k="lefthand" label="左手系統設為離職" help={HELP.lefthand} />
      <Step k="final_pay" label="薪資／費用結算完成" help={HELP.final_pay} />

      <div style={card}>
        {r.status === 'closed'
          ? <><b>🎉 已結案</b>（{dt(r.closed_at)}）　<button style={ghost} disabled={busy} onClick={() => act({ action: 'reopen' }, '已重開')}>重開</button></>
          : <>
            <button style={{ ...btn(C.ok), opacity: missing.length || r.status !== 'processing' ? 0.5 : 1 }} disabled={busy || missing.length > 0 || r.status !== 'processing'} onClick={() => act({ action: 'close' }, '已結案')}>✅ 結案</button>
            {missing.length > 0 && <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>還沒完成：{missing.map((k) => ({ li: '勞保退保', nhi: '健保退保', layoff: '資遣通報', lefthand: '左手離職', final_pay: '薪資結算' }[k])).join('、')}</span>}
            <button style={{ ...ghost, marginLeft: 12 }} disabled={busy} onClick={() => { if (window.confirm(`${r.name} 不離職了？會取消申請並恢復登入。`)) act({ action: 'cancel' }, '已取消'); }}>人員不離職了（取消）</button>
          </>}
      </div>

      <details style={card}><summary style={{ cursor: 'pointer' }}>操作紀錄（{(d.logs || []).length}）</summary>
        {(d.logs || []).map((l) => <div key={l.id} style={{ fontSize: 12, color: C.muted, padding: '2px 0' }}>{dt(l.created_at)}・{l.actor_name || l.actor}・{l.action}</div>)}
      </details>
    </div>
  );
}

function FormStep({ k, label, help, form, Step, warn }) {
  const [copied, setCopied] = useState('');
  const copy = async (v, i) => { try { await navigator.clipboard.writeText(String(v || '')); setCopied(i); setTimeout(() => setCopied(''), 1500); } catch (e) { window.prompt('複製下面文字', String(v || '')); } };
  return (
    <Step k={k} label={label} help={help}>
      {warn && <div style={{ fontSize: 12, color: C.danger, marginTop: 4 }}>⚠ {warn}</div>}
      <div style={{ fontSize: 12, color: C.muted, margin: '6px 0' }}>{form.note}</div>
      <a href={form.url} target="_blank" rel="noreferrer" style={{ ...btn('#2b6cb0'), display: 'inline-block', textDecoration: 'none' }}>🔗 開啟網站：{form.name}</a>
      <table style={{ width: '100%', fontSize: 13, marginTop: 8, borderCollapse: 'collapse' }}>
        <tbody>
          {form.fields.map(([l, v], i) => (
            <tr key={l} style={{ borderTop: '1px solid #f1ede6' }}>
              <td style={{ padding: '4px 6px', color: C.muted, width: 150 }}>{l}</td>
              <td style={{ padding: '4px 6px', color: v ? '#222' : C.danger }}>{v || '（沒資料，請在上面補填）'}</td>
              <td style={{ width: 70 }}>{v ? <button style={{ ...ghost, padding: '3px 8px' }} onClick={() => copy(v, i)}>{copied === i ? '已複製' : '複製'}</button> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Step>
  );
}

function Settings({ onClose }) {
  const [d, setD] = useState(null);
  const [units, setUnits] = useState([]);
  const [hr, setHr] = useState([]);
  const [msg, setMsg] = useState('');
  useEffect(() => { hrToolApi.settings().then((r) => { setD(r.data); setUnits(r.data.insurance_units || []); setHr(r.data.hr_apps || []); }).catch(async (e) => setMsg('⚠ ' + await errText(e))); }, []);
  const save = async () => {
    setMsg('');
    try { await hrToolApi.saveSettings({ insurance_units: units, hr_apps: hr }); setMsg('已儲存'); } catch (e) { setMsg('⚠ ' + await errText(e)); }
  };
  const set = (i, k, v) => setUnits(units.map((u, j) => (j === i ? { ...u, [k]: v } : u)));
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 18, width: 'min(860px, 100%)', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>⚙ 人事工具設定</h3><button style={ghost} onClick={onClose}>關閉</button></div>
        {!d ? <div style={{ color: C.muted }}>{msg || '載入中…'}</div> : <>
          <h4>投保單位<HelpTip title="投保單位" body={'每家公司（投保單位）一列：勞保保險證號（勞保局）、健保投保單位代號（健保署）。\n「門市」填這家公司的門市 ERP 編號（逗號分隔），離職人員依門市自動帶出；勾「預設」＝沒對到門市時用這家。'} /></h4>
          {units.map((u, i) => (
            <div key={u.id || i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', padding: 8, background: '#f7fafc', borderRadius: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 12 }}>公司名稱<br /><input value={u.name || ''} onChange={(e) => set(i, 'name', e.target.value)} style={{ ...input, width: 160 }} /></label>
              <label style={{ fontSize: 12 }}>勞保保險證號<br /><input value={u.li_no || ''} onChange={(e) => set(i, 'li_no', e.target.value)} style={{ ...input, width: 130 }} /></label>
              <label style={{ fontSize: 12 }}>健保投保單位代號<br /><input value={u.nhi_no || ''} onChange={(e) => set(i, 'nhi_no', e.target.value)} style={{ ...input, width: 130 }} /></label>
              <label style={{ fontSize: 12, flex: 1, minWidth: 200 }}>門市 ERP 編號（逗號分隔）<br /><input value={Array.isArray(u.store_erpids) ? u.store_erpids.join(',') : (u.store_erpids || '')} onChange={(e) => set(i, 'store_erpids', e.target.value)} style={{ ...input, width: '100%' }} /></label>
              <label style={{ fontSize: 12 }}><input type="checkbox" checked={!!u.is_default} onChange={(e) => setUnits(units.map((x, j) => ({ ...x, is_default: j === i ? e.target.checked : (e.target.checked ? false : x.is_default) })))} /> 預設</label>
              <button style={ghost} onClick={() => setUnits(units.filter((_, j) => j !== i))}>刪</button>
            </div>
          ))}
          <button style={ghost} onClick={() => setUnits([...units, { name: '', li_no: '', nhi_no: '', store_erpids: [], is_default: !units.length }])}>＋ 新增投保單位</button>
          <h4>離職通知對象（人事）<HelpTip title="通知對象" body={'門市管理者簽核後，LINE 通知這些人（另外也會通知市場部）。'} /></h4>
          {d.market_error && <div style={{ color: C.danger, fontSize: 12 }}>⚠ 市場部連不到：{d.market_error}</div>}
          {(d.hr_users || []).map((u) => (
            <label key={u.member_id} style={{ display: 'block', fontSize: 13 }}><input type="checkbox" checked={hr.includes(String(u.member_id))} onChange={(e) => setHr(e.target.checked ? [...hr, String(u.member_id)] : hr.filter((x) => x !== String(u.member_id)))} /> {u.name}（{u.member_id}）</label>
          ))}
          <div style={{ marginTop: 14 }}><button style={btn(C.primary)} onClick={save}>儲存</button> {msg && <span style={{ fontSize: 13, color: msg.startsWith('⚠') ? C.danger : C.ok }}>{msg}</span>}</div>
        </>}
      </div>
    </div>
  );
}
