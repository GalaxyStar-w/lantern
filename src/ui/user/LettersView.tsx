import { useEffect, useState } from 'react';
import { api } from '../../core/api.ts';

interface Letter {
  id: string;
  content: string;
  created_at: number;
  deliver_at: number;
  delivered: number;
  read_at: number | null;
}

function fmt(ms: number) {
  return new Date(ms).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtShort(ms: number) {
  return new Date(ms).toLocaleDateString('zh-CN');
}

export default function LettersView() {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [content, setContent] = useState('');
  const [deliver, setDeliver] = useState(''); // yyyy-mm-ddThh:mm
  const [busy, setBusy] = useState(false);
  const [openedLetter, setOpenedLetter] = useState<Letter | null>(null);
  const composingRef = useState({ current: false })[0];

  const load = async () => {
    const r = await api.listLetters();
    setLetters(r.letters || []);
  };

  useEffect(() => {
    load();
    // 默认送达时间 = 30 天后
    const d = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    setDeliver(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }, []);

  const write = async () => {
    if (!content.trim() || !deliver) return;
    setBusy(true);
    try {
      const deliverAt = new Date(deliver).getTime();
      await api.createLetter(content.trim(), deliverAt);
      setContent('');
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const open = async (id: string) => {
    try {
      const r = await api.readLetter(id);
      setOpenedLetter(r.letter as Letter);
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const del = async (id: string) => {
    if (!confirm('删除这封信？')) return;
    await api.deleteLetter(id);
    await load();
  };

  const now = Date.now();
  const arrived = letters.filter((l) => l.deliver_at <= now);
  const pending = letters.filter((l) => l.deliver_at > now);

  return (
    <div className="letters-view">
      <h2>给未来的自己</h2>
      <p className="hint">
        写一封信，挑一个未来的日子，到那天自己再来打开。<br />
        有时你会在一个难受的日子里，收到几个月前的自己为你留下的一句温柔。
      </p>

      <section className="memory-section">
        <h3>写一封新的</h3>
        <textarea
          placeholder="对将来的自己说点什么…（哪怕只是几个字也行）"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
          rows={4}
          style={{ resize: 'vertical', minHeight: '6rem' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.88rem' }}>送达日期：</span>
          <input
            type="datetime-local"
            value={deliver}
            onChange={(e) => setDeliver(e.target.value)}
            style={{ width: 'auto', flex: '0 0 auto' }}
          />
          <button onClick={write} disabled={busy || !content.trim() || !deliver}>
            {busy ? '…' : '封存'}
          </button>
        </div>
      </section>

      {arrived.length > 0 && (
        <section className="memory-section">
          <h3>已到达（{arrived.length}）</h3>
          <div className="moments-list">
            {arrived.map((l) => (
              <div key={l.id} className="moment-item">
                <div className="moment-meta">
                  <span className="moment-tag">{l.read_at ? '已读' : '新到 ✨'}</span>
                  <span className="moment-date">写于 {fmtShort(l.created_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button onClick={() => open(l.id)}>{l.read_at ? '再读一遍' : '打开'}</button>
                  <button onClick={() => del(l.id)} style={{ color: 'var(--text-dim)' }}>删除</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section className="memory-section">
          <h3>还在路上（{pending.length}）</h3>
          <div className="moments-list">
            {pending.map((l) => (
              <div key={l.id} className="moment-item">
                <div className="moment-meta">
                  <span className="moment-tag">未送达</span>
                  <span className="moment-date">{fmt(l.deliver_at)} 送达</span>
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: 4 }}>
                  封存于 {fmtShort(l.created_at)}，暂时看不到内容。
                </div>
                <button onClick={() => del(l.id)} style={{ marginTop: 6, color: 'var(--text-dim)', fontSize: '0.82rem' }}>取消这封</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {letters.length === 0 && (
        <p className="hint">还没有信。写第一封试试看？</p>
      )}

      {openedLetter && (
        <div className="letter-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpenedLetter(null); }}>
          <div className="letter-paper">
            <div className="letter-from">来自 {fmtShort(openedLetter.created_at)} 的你</div>
            <div className="letter-content">{openedLetter.content}</div>
            <button onClick={() => setOpenedLetter(null)}>合上</button>
          </div>
        </div>
      )}
    </div>
  );
}
