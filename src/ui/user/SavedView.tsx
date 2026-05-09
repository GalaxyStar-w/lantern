import { useEffect, useState } from 'react';
import { api } from '../../core/api.ts';

interface Saved {
  id: string;
  message_id: string;
  content: string;
  created_at: number;
}

function fmt(ms: number) {
  return new Date(ms).toLocaleDateString('zh-CN');
}

export default function SavedView() {
  const [items, setItems] = useState<Saved[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const r = await api.listSaved();
      setItems(r.saved || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    if (!confirm('从收藏里拿出来？')) return;
    await api.deleteSaved(id);
    await load();
  };

  if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>…</div>;

  return (
    <div className="memory-view">
      <h2>你收进口袋的话</h2>
      <p className="hint">心情不好的时候，可以回来翻翻。</p>

      {items.length === 0 ? (
        <p className="hint">还是空的。<br />聊天时看见喜欢的那句，点 ♡ 收起来。</p>
      ) : (
        <div className="moments-list">
          {items.map((s) => (
            <div key={s.id} className="moment-item">
              <div className="moment-meta">
                <span className="moment-date">{fmt(s.created_at)}</span>
              </div>
              <div style={{ lineHeight: 1.9, fontSize: '0.95rem' }}>{s.content}</div>
              <button className="moment-forget" onClick={() => del(s.id)}>拿出来</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
