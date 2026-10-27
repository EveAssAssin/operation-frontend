// 設定：審核人（所有送審固定送給他）、從 MAP 匯入
import React, { useEffect, useState } from 'react';
import { regulationApi as api } from '../../services/api';
import { C, card, btn, btnP, Field, EmployeePicker, fmtTime } from './ui';

export default function SettingsPanel({ settings, reload }) {
  const [emp, setEmp] = useState(null);
  const [msg, setMsg] = useState(null);
  const imp = settings?.import || {};

  useEffect(() => {
    if (!imp.running) return;
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
  }, [imp.running, reload]);

  const saveReviewer = async () => {
    const r = await api.setReviewer(emp.erpid);
    setMsg(r?.success ? { text: `審核人已設為 ${r.data.name}` } : { err: true, text: r?.message || '失敗' });
    if (r?.success) { setEmp(null); reload(); }
  };
  const startImport = async () => {
    if (!window.confirm('從左手 MAP 匯入全部規範？\n‧ 系統裡沒有的會新增\n‧ 已在本系統修改過的不會被覆蓋')) return;
    const r = await api.importFromMap();
    setMsg(r?.success ? { text: '匯入已開始，約 1～3 分鐘' } : { err: true, text: r?.message || '失敗' });
    reload();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 12, alignItems: 'start' }}>
      <div style={{ ...card, padding: 14 }}>
        <b style={{ fontSize: 16 }}>審核人</b>
        <div style={{ fontSize: 13, color: C.mid, margin: '4px 0 10px' }}>所有規範送審都送給這個人：有人送審時 LINE 立即通知。</div>
        <div style={{ marginBottom: 10 }}>目前：{settings?.reviewer?.name ? <b>{settings.reviewer.name}（ERP {settings.reviewer.erpid}）</b> : <span style={{ color: C.bad }}>尚未設定（送審不會推播）</span>}
          {settings?.reviewer?.name && !settings?.reviewer?.app_number && <div style={{ fontSize: 12, color: C.bad }}>這位員工沒有 APP 編號，收不到 LINE 推播</div>}</div>
        <Field label="更換審核人"><EmployeePicker api={api} value={emp} onChange={setEmp} /></Field>
        <button style={btnP} disabled={!emp} onClick={saveReviewer}>儲存</button>
      </div>
      <div style={{ ...card, padding: 14 }}>
        <b style={{ fontSize: 16 }}>從左手 MAP 匯入</b>
        <div style={{ fontSize: 13, color: C.mid, margin: '4px 0 10px' }}>第一次使用時匯入全部規範（目前約 491 份）。之後再按，只會補新增的、更新 MAP 有改但本系統沒改過的。</div>
        <div style={{ fontSize: 13, marginBottom: 10 }}>
          狀態：{imp.running ? <b style={{ color: '#b7791f' }}>匯入中：{imp.progress}</b> : imp.finishedAt ? (imp.error ? <span style={{ color: C.bad }}>失敗：{imp.error}</span> : <span style={{ color: C.ok }}>完成（{fmtTime(imp.finishedAt)}）</span>) : '尚未執行'}
          {imp.result && !imp.running && (
            <div style={{ fontSize: 12, color: C.mid, marginTop: 4 }}>共 {imp.result.total} 份：新增 {imp.result.created}、更新 {imp.result.updated}、未變 {imp.result.unchanged}、條文 {imp.result.clauses} 條
              {imp.result.parseFlags ? `；${imp.result.parseFlags} 份有格式問題（之後整理）` : ''}
              {imp.result.conflicts?.length ? `；${imp.result.conflicts.length} 份 MAP 有改但本系統也改過，未覆蓋` : ''}</div>
          )}
        </div>
        <button style={btnP} disabled={imp.running} onClick={startImport}>{imp.running ? '匯入中…' : '開始匯入'}</button>
        <div style={{ fontSize: 12, color: C.mid, marginTop: 10 }}>AI 審核摘要：{settings?.ai ? '已啟用' : '未啟用（Render 設定 ANTHROPIC_API_KEY 後啟用；未啟用時用規則摘要）'}</div>
      </div>
      {msg && <div style={{ fontSize: 13, color: msg.err ? C.bad : C.ok }}>{msg.text}</div>}
    </div>
  );
}
