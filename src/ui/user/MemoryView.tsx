import { useEffect, useState } from 'react';
import { api } from '../../core/api.ts';

interface Profile {
  summary: string | null;
  entities: string | null;
  preferences: string | null;
  updated_at: number | null;
}
interface Moment {
  id: string;
  tag: string;
  summary: string;
  created_at: number;
}

const TAG_LABELS: Record<string, string> = {
  milestone: '里程碑',
  relationship: '重要的人',
  pet: '宠物',
  anxiety: '难熬的时刻',
  joy: '开心',
  loss: '失去',
  work: '工作/学业',
  health: '身体',
  other: '其他',
};

function fmtDate(ms: number) {
  const d = new Date(ms);
  return d.toLocaleDateString('zh-CN');
}

export default function MemoryView() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const r = await api.myMemory();
      setProfile(r.profile as Profile | null);
      setMoments(r.moments || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    if (!confirm('让 AI 忘了这件事？')) return;
    await api.deleteMoment(id);
    await load();
  };

  const forgetAll = async () => {
    if (!confirm('清空 AI 对你的画像（不会删除聊天记录本身）。继续？')) return;
    await api.forgetProfile();
    await load();
  };

  if (loading) return <div style={{ padding: '3rem', color: 'var(--text-dim)', textAlign: 'center' }}>…</div>;

  return (
    <div className="memory-view">
      <h2>AI 记得的关于你</h2>
      <p className="hint">
        这些是 AI 慢慢记下来的你。<br />
        每一条都可以删掉，AI 就会忘记。
      </p>

      {profile?.summary && (
        <section className="memory-section">
          <h3>整体印象</h3>
          <div className="memory-card">{profile.summary}</div>
          <div style={{ marginTop: 8 }}>
            <button onClick={forgetAll} style={{ fontSize: '0.85rem' }}>让 AI 重新认识我</button>
          </div>
        </section>
      )}

      {moments.length === 0 ? (
        <section className="memory-section">
          <p className="hint">还没有记下什么。聊得多了，这里就会慢慢有东西。</p>
        </section>
      ) : (
        <section className="memory-section">
          <h3>重要时刻</h3>
          <div className="moments-list">
            {moments.map((m) => (
              <div key={m.id} className="moment-item">
                <div className="moment-meta">
                  <span className="moment-tag">{TAG_LABELS[m.tag] || m.tag}</span>
                  <span className="moment-date">{fmtDate(m.created_at)}</span>
                </div>
                <div className="moment-summary">{m.summary}</div>
                <button className="moment-forget" onClick={() => del(m.id)}>让 AI 忘记这件事</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
