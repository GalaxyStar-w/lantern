import { useEffect, useRef, useState } from 'react';
import { api } from '../../core/api.ts';

interface Msg { role: 'user' | 'assistant'; content: string }

const STEP_HINTS = [
  '说说最近让你焦虑的一件事，越具体越好',
  '这件事最后的后果，是由谁承担？',
  '在你自己能掌控的部分，你打算怎么做？',
  '轻轻回顾一下，你走完了',
];

export default function DecoupleView() {
  const [step, setStep] = useState(1);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [finished, setFinished] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || finished) return;
    setSending(true);
    const next: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    try {
      const r = await api.decouple(step, next);
      if (r.reply) {
        setMessages([...next, { role: 'assistant', content: r.reply }]);
      } else if (r.error) {
        setMessages([...next, { role: 'assistant', content: `（出错了：${r.error}）` }]);
      }
      if (r.finished) setFinished(true);
      else setStep((s) => Math.min(4, s + 1));
    } catch (e) {
      const msg = (e as Error).message || '未知错误';
      console.error('decouple error', e);
      setMessages([...next, { role: 'assistant', content: `（${msg}）` }]);
    } finally {
      setSending(false);
    }
  };

  const restart = () => {
    setStep(1);
    setMessages([]);
    setInput('');
    setFinished(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (composingRef.current) return;
    const ne = e.nativeEvent as KeyboardEvent;
    if (ne.isComposing || ne.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="decouple-view">
      <h2>课题分离</h2>
      <p className="hint">
        这是一个简单的心理学方法。<br />
        当你被焦虑缠住时，它会一步步带你看清：
        <strong>哪些是你的事，哪些不是。</strong>
      </p>

      <div className="steps-bar">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`step ${step === s ? 'active' : ''} ${step > s || finished ? 'done' : ''}`}>
            {s}
          </div>
        ))}
      </div>

      <div className="decouple-chat" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="bubble assistant opener">{STEP_HINTS[0]}</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>{m.content}</div>
        ))}
      </div>

      {!finished ? (
        <div className="composer" style={{ background: 'transparent' }}>
          <form onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea
              placeholder={STEP_HINTS[step - 1] || '接着说'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; }}
              rows={2}
              disabled={sending}
            />
            <button type="submit" disabled={sending || !input.trim()}>
              {sending ? '…' : '说'}
            </button>
          </form>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
          <button onClick={restart}>再来一次</button>
        </div>
      )}
    </div>
  );
}
