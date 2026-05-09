import { useState } from 'react';
import { useApp } from '../../state/AppContext.tsx';

export default function InviteCodeLogin() {
  const { login } = useApp();
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await login(code.trim(), nickname.trim());
    } catch (e) {
      setErr((e as Error).message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>🏮 LANTERN</h1>
        <p>这是一个可以慢慢说话的地方。<br />输入邀请码，打开属于你的那一盏。</p>
        <input
          placeholder="邀请码"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
        <input
          placeholder="怎么称呼你呢（可选）"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {err && <div className="err">{err}</div>}
        <button type="submit" disabled={loading || !code.trim()}>
          {loading ? '…' : '进来'}
        </button>
      </form>
    </div>
  );
}
