import { useEffect, useState } from 'react';
import { api } from '../../core/api.ts';

interface Code {
  code: string;
  role: string;
  created_at: number;
  used_at: number | null;
  used_by: string | null;
  used_by_name: string | null;
}

export default function InviteCodeView() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const r = await api.adminInvites();
      setCodes(((r as { codes: Code[] }).codes) || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const gen = async (role: 'user' | 'admin') => {
    setBusy(true);
    try {
      await api.adminCreateInvite(role);
      await load();
    } finally { setBusy(false); }
  };

  if (loading) return <div style={{ color: 'var(--text-dim)' }}>…</div>;

  return (
    <div style={{ maxWidth: 700 }}>
      <h2 style={{ fontWeight: 300, letterSpacing: '0.1em' }}>邀请码</h2>
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
        <button onClick={() => gen('user')} disabled={busy}>生成用户邀请码</button>
        <button onClick={() => gen('admin')} disabled={busy}>生成管理员邀请码</button>
      </div>
      <div className="user-list">
        {codes.map((c) => (
          <div key={c.code} className="user-row" style={{ gridTemplateColumns: '2fr 80px 1fr 1fr' }}>
            <code style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{c.code}</code>
            <span className="dim">{c.role}</span>
            <span className="dim">{c.used_at ? new Date(c.used_at).toLocaleString('zh-CN') : '未使用'}</span>
            <span>{c.used_by_name || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
