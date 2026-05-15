// pages/processes/ProcessesHubPage.jsx
// 各類流程 — 入口
// 之後新增的流程都加在 PROCESSES 陣列即可

import { Link } from 'react-router-dom';

const C = { dark: '#50422d', mid: '#8b6f4e', light: '#cdbea2', bg: '#f5f0ea',
  bgCard: '#ffffff', border: '#e0d5c8', textDark: '#3a2e1e', textMid: '#6b5640' };

const PROCESSES = [
  {
    path: '/processes/handover',
    icon: '📝',
    title: '門市交接表',
    desc: '由營運主管建立交接、原 → 新 → 第三方三方確認',
    color: '#8b6f4e',
  },
  // 之後新增的流程加在這
];

export default function ProcessesHubPage() {
  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ background: C.dark, padding: '20px 28px' }}>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>🗂️ 各類流程</div>
        <div style={{ color: C.light, fontSize: 13 }}>
          管理門市與內部各類標準作業流程
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {PROCESSES.map(p => (
            <Link key={p.path} to={p.path} style={{ textDecoration: 'none' }}>
              <div style={{
                background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: 20, cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: p.color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20,
                  }}>{p.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark }}>{p.title}</div>
                </div>
                <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.5 }}>{p.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
