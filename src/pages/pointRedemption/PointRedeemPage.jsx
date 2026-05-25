// pages/pointRedemption/PointRedeemPage.jsx
// 分數兌換 — 員工自助頁（手機 / LINE 內開啟）
// 進入方式：/points?app_number=XXXXXXXX
//   1. 用 app_number 驗證員工身份
//   2. 顯示目前 MAP 分數餘額
//   3. 列出兌換品項，員工可直接兌換（兌換即扣分、寫負分回 MAP）
//   4. 顯示我的兌換紀錄

import { useEffect, useState, useCallback } from 'react';
import { pointRedemptionPublicApi } from '../../services/api';

const C = {
  primary:   '#c8860d',   // 金棕（分數主題）
  primaryD:  '#a76f08',
  bg:        '#f5f4f1',
  card:      '#ffffff',
  border:    '#e3e0d8',
  text:      '#2b2b2b',
  textMid:   '#6b6b6b',
  textLight: '#9a9a9a',
  danger:    '#c53030',
  ok:        '#2d6a4f',
};

const TYPE_META = {
  physical: { label: '實體獎品', icon: '🎁' },
  cash:     { label: '獎金/禮券', icon: '💰' },
  title:    { label: '稱號/權限', icon: '🏅' },
  other:    { label: '其他',     icon: '✨' },
};
const STATUS_META = {
  pending:   { label: '審核中', color: '#b7791f' },
  completed: { label: '已通過', color: C.ok },
  fulfilled: { label: '已發放', color: '#1d4ed8' },
  rejected:  { label: '已駁回', color: C.danger },
  cancelled: { label: '已取消', color: C.danger },
};
const LS_KEY = 'point_redeem_app_number';

export default function PointRedeemPage() {
  const [phase, setPhase]   = useState('init');   // init | ready | error
  const [error, setError]   = useState('');
  const [appNumber, setAppNumber] = useState('');
  const [employee, setEmployee]   = useState(null);
  const [balance, setBalance]     = useState(null);   // { totalScore, totalBonus, recordCount }
  const [items, setItems]         = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [redeeming, setRedeeming] = useState(null);   // 正在兌換的 item id
  const [tab, setTab]             = useState('catalog'); // catalog | history

  const loadAll = useCallback(async (app) => {
    const [balRes, catRes, hisRes] = await Promise.all([
      pointRedemptionPublicApi.balance(app),
      pointRedemptionPublicApi.catalog(),
      pointRedemptionPublicApi.myRedemptions(app),
    ]);
    if (!balRes.success) throw new Error(balRes.message || '查詢失敗');
    setEmployee(balRes.data.employee);
    setBalance(balRes.data.balance);
    setItems(Array.isArray(catRes.data) ? catRes.data : []);
    setRedemptions(Array.isArray(hisRes.data) ? hisRes.data : []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const q = new URLSearchParams(window.location.search);
        const app = (q.get('app_number') || localStorage.getItem(LS_KEY) || '').trim();
        if (!app) {
          setPhase('error');
          setError('缺少員工編號，請從正確的連結進入');
          return;
        }
        setAppNumber(app);
        localStorage.setItem(LS_KEY, app);
        await loadAll(app);
        setPhase('ready');
      } catch (e) {
        setPhase('error');
        setError(e?.message || '載入失敗');
      }
    })();
  }, [loadAll]);

  async function handleRedeem(item) {
    if (redeeming) return;
    const cost = Number(item.points_cost);
    if (balance && balance.totalScore < cost) {
      alert(`分數不足：目前 ${balance.totalScore} 分，需要 ${cost} 分`);
      return;
    }
    if (!window.confirm(`確定申請兌換「${item.name}」（${cost} 分）嗎？\n送出後需營運部主管審核通過才會扣分。`)) return;
    setRedeeming(item.id);
    try {
      const r = await pointRedemptionPublicApi.redeem(appNumber, item.id);
      if (!r.success) throw new Error(r.message || '兌換失敗');
      await loadAll(appNumber);
      setTab('history');
      alert(`已送出兌換申請！\n「${item.name}」正在等待營運部審核，通過後會扣分並以 LINE 通知你。`);
    } catch (e) {
      alert('兌換失敗：' + (e?.message || e));
    } finally {
      setRedeeming(null);
    }
  }

  if (phase === 'init')  return <FullScreen>載入中...</FullScreen>;
  if (phase === 'error') return <FullScreen>{error}</FullScreen>;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>

        {/* 餘額卡 */}
        <div style={{
          background: `linear-gradient(135deg, ${C.primary}, ${C.primaryD})`,
          borderRadius: 16, padding: '20px 22px', color: '#fff',
          boxShadow: '0 4px 12px rgba(168,111,8,0.25)',
        }}>
          <div style={{ fontSize: 13, opacity: 0.9 }}>
            {employee?.name}{employee?.store_name ? ` · ${employee.store_name}` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>
              {balance?.totalScore ?? '—'}
            </span>
            <span style={{ fontSize: 15, opacity: 0.9 }}>可兌換分數</span>
          </div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 8 }}>
            分數來自 MAP 系統紀錄即時加總
          </div>
        </div>

        {/* 分頁 */}
        <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
          <TabBtn active={tab === 'catalog'} onClick={() => setTab('catalog')}>
            兌換品項
          </TabBtn>
          <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>
            我的紀錄{redemptions.length ? `（${redemptions.length}）` : ''}
          </TabBtn>
        </div>

        {/* 兌換品項 */}
        {tab === 'catalog' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.length === 0 && (
              <Empty>目前沒有可兌換的品項</Empty>
            )}
            {items.map(item => {
              const cost      = Number(item.points_cost);
              const noStock   = item.stock !== null && item.stock !== undefined && Number(item.stock) <= 0;
              const notEnough = balance && balance.totalScore < cost;
              const disabled  = noStock || notEnough || !!redeeming;
              const meta      = TYPE_META[item.item_type] || TYPE_META.other;
              return (
                <div key={item.id} style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 14, padding: 14, display: 'flex', gap: 12,
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 12, flexShrink: 0,
                    background: item.image_url ? `center/cover no-repeat url(${item.image_url})` : '#f3efe4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                  }}>
                    {!item.image_url && meta.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{item.name}</span>
                      <span style={{
                        fontSize: 10, color: C.primaryD, background: '#fdf3df',
                        padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap',
                      }}>{meta.label}</span>
                    </div>
                    {item.description && (
                      <div style={{ fontSize: 12, color: C.textMid, marginTop: 3, lineHeight: 1.45 }}>
                        {item.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: C.primaryD }}>
                        {cost} <span style={{ fontSize: 11, fontWeight: 600 }}>分</span>
                      </span>
                      {item.stock !== null && item.stock !== undefined && (
                        <span style={{ fontSize: 11, color: noStock ? C.danger : C.textLight }}>
                          {noStock ? '已兌完' : `庫存 ${item.stock}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRedeem(item)}
                    disabled={disabled}
                    style={{
                      alignSelf: 'center', padding: '9px 14px', borderRadius: 9,
                      border: 'none', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      background: disabled ? '#e5e2da' : C.primary,
                      color: disabled ? C.textLight : '#fff',
                    }}>
                    {redeeming === item.id ? '送出中'
                      : noStock ? '已兌完'
                      : notEnough ? '分數不足'
                      : '申請兌換'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 我的兌換紀錄 */}
        {tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {redemptions.length === 0 && <Empty>還沒有兌換紀錄</Empty>}
            {redemptions.map(r => {
              const st = STATUS_META[r.status] || { label: r.status, color: C.textMid };
              const deducted = r.status === 'completed' || r.status === 'fulfilled';
              const pending  = r.status === 'pending';
              return (
                <div key={r.id} style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.item_name}</span>
                    <span style={{
                      fontSize: 14, fontWeight: 800,
                      color: deducted ? C.danger : pending ? '#b7791f' : C.textLight,
                      textDecoration: (r.status === 'rejected' || r.status === 'cancelled') ? 'line-through' : 'none',
                    }}>
                      {deducted ? '-' : ''}{r.points_cost} 分
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: C.textLight }}>
                      {fmtTime(r.redeemed_at)}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: st.color,
                      background: st.color + '15', padding: '2px 8px', borderRadius: 4,
                    }}>{st.label}</span>
                  </div>
                  {pending && (
                    <div style={{ fontSize: 11, color: '#b7791f', marginTop: 6 }}>
                      ⏳ 等待營運部審核，通過後才會扣分
                    </div>
                  )}
                  {r.status === 'rejected' && r.reject_reason && (
                    <div style={{ fontSize: 11, color: C.danger, marginTop: 6 }}>
                      駁回原因：{r.reject_reason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: 11, color: C.textLight, margin: '24px 0 8px' }}>
          樂活眼鏡 · 分數兌換
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '9px 0', borderRadius: 9, fontSize: 13, fontWeight: 700,
      cursor: 'pointer',
      border: `1px solid ${active ? C.primary : C.border}`,
      background: active ? C.primary : '#fff',
      color: active ? '#fff' : C.textMid,
    }}>{children}</button>
  );
}

function Empty({ children }) {
  return (
    <div style={{
      textAlign: 'center', color: C.textLight, fontSize: 13,
      padding: '40px 20px', background: C.card,
      border: `1px dashed ${C.border}`, borderRadius: 12,
    }}>{children}</div>
  );
}

function FullScreen({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui', color: C.textMid, fontSize: 14,
      padding: 24, textAlign: 'center',
    }}>
      <div>{children}</div>
    </div>
  );
}

function fmtTime(t) {
  if (!t) return '';
  try {
    return new Date(t).toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch { return t; }
}
