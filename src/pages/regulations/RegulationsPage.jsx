// 規範管理：規範主檔、修改送審、審核後台、引用條文扣分、設定
//   網址參數：?tab=review&v=<版本id>（推播連結）、?reg=<規範編號>
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { regulationApi as api } from '../../services/api';
import BrowsePanel from './BrowsePanel';
import EditorView from './EditorView';
import ReviewPanel from './ReviewPanel';
import DeductionPanel from './DeductionPanel';
import SettingsPanel from './SettingsPanel';
import AuditPanel from './AuditPanel';
import QuestionsPanel from './QuestionsPanel';
import { C, card, btn, btnSm, StatusBadge, fmtTime } from './ui';

export default function RegulationsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'browse');
  const [editing, setEditing] = useState(params.get('edit') ? Number(params.get('edit')) : null);
  const [settings, setSettings] = useState(null);
  const [categories, setCategories] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [flash, setFlash] = useState('');

  const loadSettings = useCallback(() => api.settings().then(r => r?.success && setSettings(r.data)), []);
  useEffect(() => {
    loadSettings();
    api.categories().then(r => r?.success && setCategories(r.data));
    api.reviews('pending').then(r => r?.success && setPendingCount(r.data.length));
  }, [loadSettings]);

  const go = (t) => { setTab(t); setEditing(null); setParams(t === 'browse' ? {} : { tab: t }); };
  const isReviewer = !!settings?.is_reviewer;
  const canApproveDeduction = isReviewer || ['super_admin', 'dept_head', 'operation_lead'].includes(user?.role);

  const TABS = [
    ['browse', '📘 規範'],
    ['drafts', '✏️ 修改中'],
    ['review', `🛡 審核${pendingCount ? `（${pendingCount}）` : ''}`],
    ['audit', '🔎 巡檢'],
    ['questions', '💬 人員提問'],
    ['deduct', '📌 引用條文扣分'],
    ['settings', '⚙ 設定'],
  ];

  return (
    <div style={{ padding: 16, background: C.bg, minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>規範管理</h2>
        <span style={{ fontSize: 12, color: C.mid }}>規範主檔在這裡維護；MAP 只接收扣分紀錄</span>
      </div>
      <div style={{ display: 'flex', gap: 4, borderBottom: `2px solid ${C.line}`, marginBottom: 12, flexWrap: 'wrap' }}>
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => go(k)} style={{ background: 'none', border: 'none', padding: '8px 14px', cursor: 'pointer', fontSize: 14, fontWeight: 700,
            color: tab === k ? C.ink : C.mid, borderBottom: tab === k ? `3px solid ${C.brand}` : '3px solid transparent', marginBottom: -2 }}>{l}</button>
        ))}
      </div>
      {flash && <div style={{ ...card, padding: '8px 12px', marginBottom: 10, color: C.ok }}>{flash}</div>}

      {editing ? (
        <EditorView versionId={editing} roles={settings?.roles || []} categories={categories} aiEnabled={!!settings?.ai}
          onClose={() => setEditing(null)}
          onSubmitted={(v) => { setEditing(null); setFlash(`已送審：${v.doc?.title}（第 ${v.version} 版），已通知審核人`); setPendingCount(n => n + 1); setTab('drafts'); }} />
      ) : (
        <>
          {tab === 'browse' && <BrowsePanel initialId={params.get('reg') ? Number(params.get('reg')) : null} categories={categories} onEdit={setEditing} canAudit={!!settings?.ai && (isReviewer || user?.role === 'super_admin')} />}
          {tab === 'drafts' && <DraftsPanel onEdit={setEditing} />}
          {tab === 'review' && <ReviewPanel initialVid={params.get('v') ? Number(params.get('v')) : null} isReviewer={isReviewer}
            roles={settings?.roles || []} categories={categories} onCountChange={setPendingCount} />}
          {tab === 'audit' && <AuditPanel settings={settings} reloadSettings={loadSettings} canRun={isReviewer || user?.role === 'super_admin'} onEdit={setEditing} aiEnabled={!!settings?.ai} />}
          {tab === 'questions' && <QuestionsPanel />}
          {tab === 'deduct' && <DeductionPanel canApprove={canApproveDeduction} />}
          {tab === 'settings' && <SettingsPanel settings={settings} reload={loadSettings} />}
        </>
      )}
    </div>
  );
}

function DraftsPanel({ onEdit }) {
  const [rows, setRows] = useState(null);
  const [pending, setPending] = useState([]);
  useEffect(() => {
    api.drafts().then(r => setRows(r?.success ? r.data : []));
    api.reviews('pending').then(r => setPending(r?.success ? r.data : []));
  }, []);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={card}>
        <div style={{ padding: '8px 12px', fontWeight: 700, borderBottom: `1px solid ${C.line}` }}>草稿與被退回（{rows?.length ?? '…'}）</div>
        {(rows || []).map(r => (
          <div key={r.id} style={{ padding: '8px 12px', borderBottom: `1px solid ${C.line}`, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <b>{r.title}</b> <StatusBadge s={r.status} /> <span style={{ fontSize: 12, color: C.mid }}>第 {r.version} 版 · {r.created_by_name || '—'} · {fmtTime(r.updated_at)}</span>
              {r.change_note && <div style={{ fontSize: 13 }}>{r.change_note}</div>}
              {r.status === 'returned' && r.review_note && <div style={{ fontSize: 13, color: C.bad }}>退回原因：{r.review_note}</div>}
            </div>
            <button style={{ ...btn, ...btnSm }} onClick={() => onEdit(r.id)}>繼續修改</button>
          </div>
        ))}
        {rows && !rows.length && <div style={{ padding: 16, color: '#a0aec0' }}>沒有修改中的規範。到「規範」選一份按「修改」開始。</div>}
      </div>
      <div style={card}>
        <div style={{ padding: '8px 12px', fontWeight: 700, borderBottom: `1px solid ${C.line}` }}>送審中（{pending.length}）</div>
        {pending.map(r => (
          <div key={r.id} style={{ padding: '8px 12px', borderBottom: `1px solid ${C.line}` }}>
            <b>{r.title}</b> <span style={{ fontSize: 12, color: C.mid }}>第 {r.version} 版 · {r.created_by_name || '—'} · {fmtTime(r.submitted_at)} 送審</span>
          </div>
        ))}
        {!pending.length && <div style={{ padding: 16, color: '#a0aec0' }}>沒有送審中的規範</div>}
      </div>
    </div>
  );
}
