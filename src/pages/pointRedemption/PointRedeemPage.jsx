// pages/pointRedemption/PointRedeemPage.jsx
// 分數兌換 — 員工自助頁（手機 / LINE 內開啟）
// 進入方式：/points?app_number=XXXXXXXX
//   1. 用 app_number 驗證員工身份
//   2. 顯示目前 MAP 分數餘額
//   3. 列出兌換品項，員工可直接兌換（兌換即扣分、寫負分回 MAP）
//   4. 顯示我的兌換紀錄

import { useEffect, useState, useCallback } from 'react';
import { pointRedemptionPublicApi, scoreApplicationPublicApi } from '../../services/api';

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
const CASH_RATIO = 100;   // cash 型品項：1 分 = NT$100（與後端一致）

export default function PointRedeemPage() {
  const [phase, setPhase]   = useState('init');   // init | ready | error
  const [error, setError]   = useState('');
  const [appNumber, setAppNumber] = useState('');
  const [employee, setEmployee]   = useState(null);
  const [balance, setBalance]     = useState(null);   // { totalScore, totalBonus, recordCount }
  const [items, setItems]         = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [redeeming, setRedeeming] = useState(null);   // 正在兌換的 item id
  const [tab, setTab]             = useState('catalog'); // catalog | history | apply
  const [appTypes, setAppTypes]   = useState([]);
  const [myApps, setMyApps]       = useState([]);
  const [applyModal, setApplyModal] = useState(null); // null | type 物件
  const [qtyMap, setQtyMap]       = useState({});       // { [itemId]: quantity }，現金型選用
  // 自製 confirm/info modal（LINE 內嵌瀏覽器常擋 window.confirm/alert）
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, onOk }
  const [infoModal,    setInfoModal]    = useState(null); // { title, message, type }
  const [refreshing, setRefreshing] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail]         = useState(null);   // { records, totalScore, ... }
  const [detailLoading, setDetailLoading] = useState(false);

  const loadAll = useCallback(async (app) => {
    const [balRes, catRes, hisRes, typeRes, myAppRes] = await Promise.all([
      pointRedemptionPublicApi.balance(app),
      pointRedemptionPublicApi.catalog(),
      pointRedemptionPublicApi.myRedemptions(app),
      scoreApplicationPublicApi.listTypes().catch(() => ({ data: [] })),
      scoreApplicationPublicApi.myList(app).catch(() => ({ data: [] })),
    ]);
    if (!balRes.success) throw new Error(balRes.message || '查詢失敗');
    setEmployee(balRes.data.employee);
    setBalance(balRes.data.balance);
    setItems(Array.isArray(catRes.data) ? catRes.data : []);
    setRedemptions(Array.isArray(hisRes.data) ? hisRes.data : []);
    setAppTypes(Array.isArray(typeRes.data) ? typeRes.data : []);
    setMyApps(Array.isArray(myAppRes.data) ? myAppRes.data : []);
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

  // 手動刷新（餘額 + 我的紀錄；不重抓品項目錄）
  const refresh = useCallback(async () => {
    if (!appNumber || refreshing) return;
    setRefreshing(true);
    try {
      const [balRes, hisRes] = await Promise.all([
        pointRedemptionPublicApi.balance(appNumber),
        pointRedemptionPublicApi.myRedemptions(appNumber),
      ]);
      if (balRes?.success) {
        setEmployee(balRes.data.employee);
        setBalance(balRes.data.balance);
      }
      if (hisRes?.success) setRedemptions(Array.isArray(hisRes.data) ? hisRes.data : []);
      setDetail(null);   // 強制重抓明細
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  }, [appNumber, refreshing]);

  // 視窗回前景時自動刷新（解決：主管在後台按通過後員工頁面餘額未更新）
  useEffect(() => {
    function onVis() {
      if (document.visibilityState === 'visible') refresh();
    }
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  async function openDetail() {
    setDetailOpen(true);
    if (detail) return;
    setDetailLoading(true);
    try {
      const r = await pointRedemptionPublicApi.scoreDetail(appNumber);
      if (!r.success) throw new Error(r.message || '讀取明細失敗');
      setDetail(r.data);
    } catch (e) {
      alert('讀取明細失敗：' + (e?.message || e));
      setDetailOpen(false);
    } finally { setDetailLoading(false); }
  }

  // 算單一品項的最大可選倍數（讓「全換」/驗證用）
  function maxQtyOf(item) {
    if (!balance) return 1;
    const unit     = Number(item.points_cost) || 1;
    const minAfter = Number(item.min_balance_after || 0);
    const budget   = balance.totalScore - minAfter;
    const byBalance = Math.floor(budget / unit);
    const byStock   = (item.stock === null || item.stock === undefined)
      ? Infinity : Number(item.stock);
    return Math.max(0, Math.min(byBalance, byStock));
  }

  function getQty(item) {
    return Math.max(1, Math.trunc(Number(qtyMap[item.id]) || 1));
  }
  function setQty(item, n) {
    const maxQ = Math.max(1, maxQtyOf(item));
    const safe = Math.max(1, Math.min(maxQ, Math.trunc(Number(n) || 1)));
    setQtyMap(m => ({ ...m, [item.id]: safe }));
  }

  async function handleRedeem(item) {
    if (redeeming) return;
    const unit  = Number(item.points_cost) || 1;
    const qty   = item.item_type === 'cash' ? getQty(item) : 1;
    const cost  = unit * qty;
    if (balance && balance.totalScore < cost) {
      setInfoModal({ title: '分數不足', message: `目前 ${balance.totalScore} 分，需要 ${cost} 分`, type: 'error' });
      return;
    }
    const after = balance ? balance.totalScore - cost : null;
    const isCash = item.item_type === 'cash';
    const cashHint = isCash ? `換算：扣 ${cost} 分 → NT$${cost * CASH_RATIO} 獎金。` : '';
    const reserveHint = item.min_balance_after > 0
      ? `兌換後必須保留 ≥ ${item.min_balance_after} 分，預估剩 ${after}`
      : '';
    const label = isCash && qty > 1 ? `「${item.name}」×${qty}（${cost} 分）` : `「${item.name}」（${cost} 分）`;
    const lines = [`確定申請兌換${label} 嗎？`, cashHint, reserveHint, '送出後需營運部主管審核通過才會扣分。']
      .filter(Boolean).join('\n');

    // 顯示自製 confirm modal
    setConfirmModal({
      title: '確認兌換',
      message: lines,
      onOk: async () => {
        setConfirmModal(null);
        setRedeeming(item.id);
        try {
          const r = await pointRedemptionPublicApi.redeem(appNumber, item.id, qty);
          if (!r.success) throw new Error(r.message || '兌換失敗');
          await loadAll(appNumber);
          setTab('history');
          setInfoModal({ title: '已送出申請！', message: `${label} 正在等待營運部審核，通過後會扣分並以 LINE 通知你。`, type: 'success' });
        } catch (e) {
          setInfoModal({ title: '兌換失敗', message: e?.message || String(e), type: 'error' });
        } finally {
          setRedeeming(null);
        }
      },
    });
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
          position: 'relative',
        }}>
          <button
            onClick={refresh}
            disabled={refreshing}
            title="重新整理餘額"
            style={{
              position: 'absolute', top: 14, right: 14,
              background: 'rgba(255,255,255,0.18)', color: '#fff',
              border: 'none', borderRadius: 999, width: 34, height: 34,
              fontSize: 16, cursor: refreshing ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.5s',
              transform: refreshing ? 'rotate(360deg)' : 'none',
            }}>↻</button>
          <div style={{ fontSize: 13, opacity: 0.9, paddingRight: 40 }}>
            {employee?.name}{employee?.store_name ? ` · ${employee.store_name}` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>
              {balance?.totalScore ?? '—'}
            </span>
            <span style={{ fontSize: 15, opacity: 0.9 }}>可兌換分數</span>
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 8 }}>
            MAP 紀錄加總
            {balance?.recordCount != null && ` · 依 ${balance.recordCount} 筆紀錄`}
            {' · '}
            <span onClick={openDetail} style={{ textDecoration: 'underline', cursor: 'pointer' }}>
              看明細
            </span>
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
          <TabBtn active={tab === 'apply'} onClick={() => setTab('apply')}>
            申請加分
          </TabBtn>
        </div>

        {/* 兌換品項 */}
        {tab === 'catalog' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.length === 0 && (
              <Empty>目前沒有可兌換的品項</Empty>
            )}
            {items.map(item => {
              const unit      = Number(item.points_cost);
              const minAfter  = Number(item.min_balance_after || 0);
              const isCash    = item.item_type === 'cash';
              const qty       = isCash ? getQty(item) : 1;
              const cost      = unit * qty;
              const cashAmt   = isCash ? cost * CASH_RATIO : 0;
              const noStock   = item.stock !== null && item.stock !== undefined && Number(item.stock) <= 0;
              const after     = balance ? balance.totalScore - cost : 0;
              const notEnough = balance && (balance.totalScore < cost || after < minAfter);
              const disabled  = noStock || notEnough || !!redeeming;
              const meta      = TYPE_META[item.item_type] || TYPE_META.other;
              const maxQ      = isCash ? maxQtyOf(item) : 1;
              return (
                <div key={item.id} style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 14, padding: 14,
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                  {/* 上半：圖 + 資訊 + 單次按鈕 */}
                  <div style={{ display: 'flex', gap: 12 }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: C.primaryD }}>
                          {isCash ? unit : cost} <span style={{ fontSize: 11, fontWeight: 600 }}>分{isCash ? '/組' : ''}</span>
                        </span>
                        {isCash && (
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.ok }}>
                            → NT${unit * CASH_RATIO}/組
                          </span>
                        )}
                        {item.stock !== null && item.stock !== undefined && (
                          <span style={{ fontSize: 11, color: noStock ? C.danger : C.textLight }}>
                            {noStock ? '已兌完' : `庫存 ${item.stock}`}
                          </span>
                        )}
                        {minAfter > 0 && (
                          <span style={{ fontSize: 11, color: C.textMid, background: '#fffbeb', padding: '1px 6px', borderRadius: 4 }}>
                            兌換後須保留 ≥ {minAfter} 分
                          </span>
                        )}
                      </div>
                    </div>
                    {!isCash && (
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
                    )}
                  </div>

                  {/* 下半（僅現金型）：數量輸入 + 快速鈕 + 申請按鈕 */}
                  {isCash && (
                    <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: C.textMid }}>兌換組數</span>
                        <input
                          type="number" inputMode="numeric" min={1} max={maxQ || 1}
                          value={qty}
                          onChange={e => setQty(item, e.target.value)}
                          style={{
                            width: 86, padding: '6px 10px', fontSize: 16, fontWeight: 700,
                            border: `1px solid ${C.border}`, borderRadius: 8,
                            textAlign: 'center',
                          }}
                        />
                        <span style={{ fontSize: 11, color: C.textLight }}>最多 {maxQ}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {[10, 100, 1000].filter(n => n <= maxQ).map(n => (
                          <QtyChip key={n} onClick={() => setQty(item, n)}>{n}</QtyChip>
                        ))}
                        {maxQ > 0 && <QtyChip onClick={() => setQty(item, maxQ)}>全換 ({maxQ})</QtyChip>}
                      </div>
                      <div style={{
                        background: '#fdf6e7', borderRadius: 8, padding: '8px 10px',
                        marginTop: 10, fontSize: 13, color: C.text,
                      }}>
                        <div>共 <b>{qty}</b> 組 = 扣 <b style={{ color: C.danger }}>{cost} 分</b> →
                          <b style={{ color: C.ok }}> NT${cashAmt}</b> 獎金</div>
                        {balance && (
                          <div style={{ fontSize: 11, color: C.textMid, marginTop: 2 }}>
                            兌換後剩 <b style={{ color: after < minAfter ? C.danger : C.textMid }}>{after}</b> 分
                            {minAfter > 0 && `（須保留 ≥ ${minAfter}）`}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRedeem(item)}
                        disabled={disabled}
                        style={{
                          width: '100%', marginTop: 10, padding: '11px 14px', borderRadius: 10,
                          border: 'none', fontSize: 14, fontWeight: 800,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          background: disabled ? '#e5e2da' : C.primary,
                          color: disabled ? C.textLight : '#fff',
                        }}>
                        {redeeming === item.id ? '送出中...'
                          : noStock ? '已兌完'
                          : notEnough ? `不足或低於保留分（剩 ${after}）`
                          : `申請兌換 ${cost} 分（NT$${cashAmt}）`}
                      </button>
                    </div>
                  )}
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
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                      {r.item_name}
                      {Number(r.quantity) > 1 && (
                        <span style={{ marginLeft: 6, fontSize: 12, color: C.textMid }}>×{r.quantity}</span>
                      )}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{
                        fontSize: 14, fontWeight: 800,
                        color: deducted ? C.danger : pending ? '#b7791f' : C.textLight,
                        textDecoration: (r.status === 'rejected' || r.status === 'cancelled') ? 'line-through' : 'none',
                      }}>
                        {deducted ? '-' : ''}{r.points_cost} 分
                      </span>
                      {r.item_type === 'cash' && Number(r.bonus_amount) > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: deducted ? C.ok : C.textLight }}>
                          {deducted ? '+' : ''}NT${r.bonus_amount}
                        </span>
                      )}
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

        {/* 申請加分 */}
        {tab === 'apply' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>📝 申請加分</div>
              <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.6 }}>
                選擇下方的申請類型 → 填說明 + 上傳照片/PDF 佐證 → 送出後等待營運主管審核。<br/>
                通過後分數會直接寫入 MAP，並以 LINE 通知你。
              </div>
            </div>
            {appTypes.length === 0 && <Empty>目前沒有可申請的類型</Empty>}
            {appTypes.map(t => (
              <div key={t.id} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{t.name}</div>
                  {t.description && (
                    <div style={{ fontSize: 12, color: C.textMid, marginTop: 4, lineHeight: 1.5 }}>{t.description}</div>
                  )}
                  <div style={{ fontSize: 12, color: C.ok, fontWeight: 700, marginTop: 4 }}>
                    預設 +{t.default_score} 分（主管可調整）
                  </div>
                </div>
                <button onClick={() => setApplyModal(t)}
                  style={{ padding: '9px 14px', border: 'none', background: C.primary, color: '#fff',
                    borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  申請
                </button>
              </div>
            ))}

            {/* 我的申請紀錄 */}
            <div style={{ fontSize: 12, color: C.textMid, fontWeight: 700, marginTop: 12 }}>
              我的申請紀錄（{myApps.length}）
            </div>
            {myApps.length === 0 && <Empty>還沒有送出過申請</Empty>}
            {myApps.map(a => {
              const st = a.status === 'approved' ? { label: '✅ 已通過', color: C.ok }
                       : a.status === 'rejected' ? { label: '❌ 已駁回', color: C.danger }
                       :                            { label: '⏳ 審核中', color: '#b7791f' };
              return (
                <div key={a.id} style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{a.type_name}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: a.status === 'approved' ? C.ok : C.textLight }}>
                      {a.status === 'approved' ? `+${a.approved_score} 分` : `預設 ${a.default_score} 分`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: C.textLight }}>{fmtTime(a.applied_at)}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: st.color,
                      background: st.color + '15', padding: '2px 8px', borderRadius: 4 }}>
                      {st.label}
                    </span>
                  </div>
                  {a.apply_reason && (
                    <div style={{ fontSize: 12, color: C.textMid, marginTop: 6, whiteSpace: 'pre-wrap' }}>
                      {a.apply_reason}
                    </div>
                  )}
                  {Array.isArray(a.attachments) && a.attachments.length > 0 && (
                    <div style={{ fontSize: 11, color: C.textLight, marginTop: 4 }}>
                      📎 {a.attachments.length} 份附件
                    </div>
                  )}
                  {a.status === 'rejected' && a.reject_reason && (
                    <div style={{ fontSize: 11, color: C.danger, marginTop: 6 }}>
                      駁回原因：{a.reject_reason}
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

      {applyModal && (
        <ApplyModal
          type={applyModal}
          appNumber={appNumber}
          onClose={() => setApplyModal(null)}
          onSubmitted={async () => { setApplyModal(null); await loadAll(appNumber); }}
        />
      )}
      {detailOpen && (
        <DetailModal
          loading={detailLoading}
          detail={detail}
          onClose={() => setDetailOpen(false)}
        />
      )}

      {confirmModal && (
        <SimpleModal
          title={confirmModal.title}
          message={confirmModal.message}
          okLabel="確定送出"
          cancelLabel="取消"
          onOk={confirmModal.onOk}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {infoModal && (
        <SimpleModal
          title={infoModal.title}
          message={infoModal.message}
          okLabel="確定"
          tone={infoModal.type}
          onOk={() => setInfoModal(null)}
          onCancel={() => setInfoModal(null)}
        />
      )}
    </div>
  );
}

// 通用 modal — 不靠 window.confirm，LINE 內嵌瀏覽器 / iOS 也能用
function SimpleModal({ title, message, okLabel = '確定', cancelLabel, tone, onOk, onCancel }) {
  const accent = tone === 'error' ? '#c53030' : tone === 'success' ? '#2d6a4f' : '#c8860d';
  return (
    <div onClick={onCancel}
         style={{
           position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
           display: 'flex', alignItems: 'center', justifyContent: 'center',
           zIndex: 2000, padding: 24,
         }}>
      <div onClick={e => e.stopPropagation()}
           style={{
             background: '#fff', borderRadius: 14, maxWidth: 360, width: '100%',
             padding: '20px 22px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
           }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: accent, marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 14, color: '#4a5568', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 16 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {cancelLabel && (
            <button onClick={onCancel}
                    style={{ padding: '9px 18px', border: '1px solid #cbd5e0', background: '#fff', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
              {cancelLabel}
            </button>
          )}
          <button onClick={onOk}
                  style={{ padding: '9px 18px', border: 'none', background: accent, color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 申請加分 Modal
// ════════════════════════════════════════════════════════════
function ApplyModal({ type, appNumber, onClose, onSubmitted }) {
  const [reason, setReason]       = useState('');
  const [files, setFiles]         = useState([]);     // [{ url, name, mime, size }]
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmit]   = useState(false);
  const [err, setErr]             = useState('');

  async function pickFiles(e) {
    const list = Array.from(e.target.files || []);
    if (list.length === 0) return;
    if (files.length + list.length > 10) {
      setErr('最多 10 份附件');
      e.target.value = '';
      return;
    }
    setErr('');
    setUploading(true);
    try {
      const uploaded = [];
      for (const f of list) {
        if (f.size > 20 * 1024 * 1024) throw new Error(`${f.name} 超過 20 MB`);
        const r = await scoreApplicationPublicApi.uploadAttachment(f, f.name);
        if (!r.success) throw new Error(r.message || '上傳失敗');
        uploaded.push(r.data);
      }
      setFiles(prev => [...prev, ...uploaded]);
    } catch (e2) {
      setErr(e2.message || '上傳失敗');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    setErr('');
    if (uploading) { setErr('附件還在上傳，請稍候'); return; }
    setSubmit(true);
    try {
      const r = await scoreApplicationPublicApi.submit({
        app_number:   appNumber,
        type_id:      type.id,
        apply_reason: reason.trim(),
        attachments:  files,
      });
      if (!r.success) throw new Error(r.message || '送出失敗');
      alert('✅ 已送出申請！等待營運主管審核，通過後會以 LINE 通知你。');
      onSubmitted();
    } catch (e) {
      setErr(e.message || '送出失敗');
    } finally { setSubmit(false); }
  }

  const C2 = { dark:'#50422d', textMid:'#6b6b6b', textLight:'#9a9a9a', border:'#e3e0d8', danger:'#c53030', primary:'#c8860d' };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 16px', overflowY: 'auto', zIndex: 1500,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 480,
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C2.dark }}>申請加分</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: C2.textLight }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: C2.textMid, marginBottom: 4 }}>{type.name}</div>
        <div style={{ fontSize: 12, color: C2.primary, fontWeight: 700, marginBottom: 14 }}>
          預設加 {type.default_score} 分（主管審核時可調整）
        </div>

        <div style={{ fontSize: 12, color: C2.textMid, fontWeight: 600, marginBottom: 6 }}>說明 / 事由</div>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4}
          placeholder="簡述申請事由（選填）"
          style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: `1px solid ${C2.border}`,
            borderRadius: 8, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', marginBottom: 12 }} />

        <div style={{ fontSize: 12, color: C2.textMid, fontWeight: 600, marginBottom: 6 }}>
          附件（圖片 / PDF，最多 10 份，單檔 ≤ 20 MB）
        </div>
        {files.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {files.map((f, i) => {
              const isImg = (f.mime || '').startsWith('image/');
              return (
                <div key={i} style={{ position: 'relative' }}>
                  {isImg ? (
                    <img src={f.url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C2.border}` }} />
                  ) : (
                    <div style={{ width: 64, height: 64, background: '#f5f0ea', borderRadius: 6, border: `1px solid ${C2.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📄</div>
                  )}
                  <button onClick={() => removeFile(i)}
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                      border: 'none', background: C2.danger, color: '#fff', cursor: 'pointer', fontSize: 12 }}>×</button>
                </div>
              );
            })}
          </div>
        )}
        <label style={{
          display: 'inline-block', padding: '8px 14px', fontSize: 13,
          border: `1px dashed ${C2.border}`, borderRadius: 8, cursor: 'pointer',
          color: C2.textMid, background: '#fafaf7',
        }}>
          📎 加附件
          <input type="file" multiple accept="image/*,application/pdf,.heic,.heif"
            style={{ display: 'none' }} onChange={pickFiles} disabled={uploading} />
        </label>
        {uploading && <span style={{ marginLeft: 8, fontSize: 12, color: C2.textLight }}>上傳中…</span>}

        {err && <div style={{ color: C2.danger, fontSize: 13, marginTop: 10 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', border: `1px solid ${C2.border}`, background: '#fff',
            borderRadius: 8, fontSize: 14, cursor: 'pointer',
          }} disabled={submitting}>取消</button>
          <button onClick={submit} disabled={submitting || uploading} style={{
            flex: 2, padding: '12px', border: 'none', background: C2.primary, color: '#fff',
            borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
            {submitting ? '送出中…' : '送出申請'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ loading, detail, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '14px 14px 0 0', width: '100%', maxWidth: 480,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>MAP 評分紀錄明細</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: C.textMid }}>×</button>
        </div>

        <div style={{
          padding: '10px 16px', background: '#fffbeb',
          fontSize: 12, color: C.textMid, lineHeight: 1.5,
          borderBottom: `1px solid ${C.border}`,
        }}>
          ⚠️ 此為 MAP API 實際回傳的紀錄。若加總與你在 MAP 系統看到的「累計」不一致，
          代表 API 未提供前期分或部分來源紀錄。可截圖此頁與 MAP 系統對照後告知管理員。
        </div>

        {loading && <div style={{ padding: 40, textAlign: 'center', color: C.textLight }}>載入中...</div>}

        {!loading && detail && (
          <>
            <div style={{ padding: '12px 16px', background: '#f5f4f1', fontSize: 13 }}>
              <div>API 回傳：<b>{detail.recordCount}</b> 筆紀錄</div>
              <div>分數加總：<b style={{ color: C.primaryD }}>{detail.totalScore}</b> 分</div>
              <div>獎金加總：NT$<b>{detail.totalBonus}</b></div>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {(!detail.records || detail.records.length === 0) && (
                <div style={{ padding: 40, textAlign: 'center', color: C.textLight, fontSize: 13 }}>
                  沒有紀錄
                </div>
              )}
              {[...(detail.records || [])]
                .sort((a, b) => String(b.createTime || '').localeCompare(String(a.createTime || '')))
                .map((r, i) => {
                const s = Number(r.score || 0);
                return (
                  <div key={i} style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.reasonTitle}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: s < 0 ? C.danger : s > 0 ? C.ok : C.textLight }}>
                        {s > 0 ? '+' : ''}{s}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: C.textLight, marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        {(r.createTime || '').replace('T', ' ').slice(0, 16)}
                        {r.sourceType ? ` · ${r.sourceType}` : ''}
                        {r.reasonCategory ? ` · ${r.reasonCategory}` : ''}
                      </span>
                      {Number(r.bonus) !== 0 && (
                        <span style={{ color: C.ok }}>NT${r.bonus}</span>
                      )}
                    </div>
                    {r.editor && (
                      <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>編輯者：{r.editor}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function QtyChip({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', fontSize: 12, fontWeight: 700,
      borderRadius: 999, border: `1px solid ${C.border}`,
      background: '#fff', color: C.primaryD, cursor: 'pointer',
    }}>{children}</button>
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
