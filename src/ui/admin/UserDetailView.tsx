import { useEffect, useState } from 'react';
import { api, apiFetch } from '../../core/api.ts';

interface Msg {
  id: string;
  role: string;
  content: string;
  created_at: number;
  rule_tags: string | null;
  crisis_level: string | null;
}
interface Assessment {
  id: string;
  created_at: number;
  source: string;
  phq9_total: number | null;
  phq9_items: string | null;
  gad7_total: number | null;
  gad7_items: string | null;
  notes: string | null;
}
interface Detail {
  user: { id: string; nickname: string; role: string; created_at: number };
  messages: Msg[];
  assessments: Assessment[];
  crises: { id: string; level: string; matched_keywords: string; created_at: number }[];
  profile: { summary: string | null; entities: string | null; preferences: string | null } | null;
  moments: { id: string; tag: string; summary: string; created_at: number }[];
}

const PHQ_LABELS = ['兴趣', '低落', '睡眠', '疲劳', '食欲', '否定', '注意', '运动', '自伤'];
const GAD_LABELS = ['紧张', '担心', '过虑', '难松', '坐立', '激惹', '恐惧'];

function Bars({ label, items, labels, max = 3 }: { label: string; items: Record<string, number>; labels: string[]; max?: number }) {
  const keys = Object.keys(items);
  return (
    <div>
      <div style={{ color: 'var(--text-dim)', fontSize: '0.88rem', margin: '0.5rem 0' }}>{label}</div>
      <div className="metric-bars">
        {keys.map((k, i) => (
          <div key={k} className="row">
            <span className="dim">{labels[i]}</span>
            <div className="bar"><div style={{ width: `${(items[k] / max) * 100}%` }} /></div>
            <span>{items[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UserDetailView({ userId }: { userId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pro, setPro] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const r = await apiFetch<Detail>(`/api/admin/users/${userId}`);
      setDetail(r);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [userId]);

  const runAssessment = async () => {
    setBusy(true);
    try {
      await api.adminRunAssessment(userId);
      await load();
    } finally { setBusy(false); }
  };

  if (loading) return <div style={{ color: 'var(--text-dim)' }}>…</div>;
  if (!detail) return <div>用户不存在</div>;

  const latest = detail.assessments[0];
  const phq9_items = latest?.phq9_items ? JSON.parse(latest.phq9_items) : null;
  const gad7_items = latest?.gad7_items ? JSON.parse(latest.gad7_items) : null;

  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={{ fontWeight: 300, letterSpacing: '0.1em' }}>{detail.user.nickname}</h2>
      <label className="professional-toggle">
        <input type="checkbox" checked={pro} onChange={(e) => setPro(e.target.checked)} />
        专业模式（显示 PHQ-9 / GAD-7 原始分项）
      </label>

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={runAssessment} disabled={busy}>{busy ? '…' : '手动触发一次评估（规则聚合）'}</button>
      </div>

      {pro && latest && (
        <div style={{ background: 'var(--bubble-other)', padding: '1rem', borderRadius: 12 }}>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>
            最近一次评估 · {new Date(latest.created_at).toLocaleString('zh-CN')} · {latest.source}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '1.4rem' }}>
            PHQ-9 {latest.phq9_total ?? '—'} · GAD-7 {latest.gad7_total ?? '—'}
          </div>
          {latest.notes && <div style={{ marginTop: '0.5rem', color: 'var(--text-dim)' }}>备注：{latest.notes}</div>}
          {phq9_items && <Bars label="PHQ-9 分项" items={phq9_items} labels={PHQ_LABELS} />}
          {gad7_items && <Bars label="GAD-7 分项" items={gad7_items} labels={GAD_LABELS} />}
        </div>
      )}

      {detail.crises.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontWeight: 300, color: 'var(--danger)' }}>危机事件</h3>
          {detail.crises.map((c) => (
            <div key={c.id} style={{ fontSize: '0.88rem', color: 'var(--text-dim)', padding: '0.3rem 0' }}>
              <span className="crisis-dot" />
              {new Date(c.created_at).toLocaleString('zh-CN')} · {c.level} · {c.matched_keywords}
            </div>
          ))}
        </div>
      )}

      <h3 style={{ fontWeight: 300, marginTop: '1.5rem' }}>消息流</h3>
      <div className="messages-stream">
        {detail.messages.slice().reverse().map((m) => (
          <div key={m.id} className={`msg ${m.role} crisis-${m.crisis_level || 'none'}`}>
            <div className="meta">
              <span>{m.role === 'user' ? '用户' : 'AI'}</span>
              <span>{new Date(m.created_at).toLocaleString('zh-CN')}</span>
              {m.crisis_level && m.crisis_level !== 'none' && <span style={{ color: 'var(--danger)' }}>{m.crisis_level}</span>}
            </div>
            <div>{m.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
