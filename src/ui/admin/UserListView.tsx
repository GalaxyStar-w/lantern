import { useEffect, useState } from 'react';
import { api } from '../../core/api.ts';

interface UserRow {
  id: string;
  nickname: string;
  role: string;
  created_at: number;
  latest_phq9: number | null;
  latest_gad7: number | null;
  unread_crisis: number;
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function UserListView() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.adminUsers();
        setUsers(((r as { users: UserRow[] }).users) || []);
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div style={{ color: 'var(--text-dim)' }}>…</div>;
  if (users.length === 0) return <div style={{ color: 'var(--text-dim)' }}>还没有人来过。</div>;

  return (
    <div className="user-list">
      <div className="user-row" style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>
        <span>昵称</span>
        <span>注册时间</span>
        <span>角色</span>
        <span>PHQ</span>
        <span>GAD</span>
        <span>危机</span>
      </div>
      {users.map((u) => (
        <div key={u.id} className="user-row">
          <a href={`#/admin/users/${u.id}`}>{u.nickname}</a>
          <span className="dim">{fmtDate(u.created_at)}</span>
          <span className="dim">{u.role}</span>
          <span>{u.latest_phq9 ?? '—'}</span>
          <span>{u.latest_gad7 ?? '—'}</span>
          <span>{u.unread_crisis > 0 ? (<><span className="crisis-dot" />{u.unread_crisis}</>) : '—'}</span>
        </div>
      ))}
    </div>
  );
}
