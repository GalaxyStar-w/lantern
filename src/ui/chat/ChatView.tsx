import { useEffect, useRef, useState } from 'react';
import { api } from '../../core/api.ts';
import { detectCrisis } from '../../core/crisis.ts';
import { useApp } from '../../state/AppContext.tsx';
import type { Message } from '../../state/types.ts';
import MessageBubble from './MessageBubble.tsx';
import Composer from './Composer.tsx';
import CrisisBanner from './CrisisBanner.tsx';
import WeatherBackground from '../../modules/mood-weather/WeatherBackground.tsx';
import { useMoodWeather } from '../../modules/mood-weather/useMoodWeather.ts';

export default function ChatView() {
  const { user } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCrisis, setShowCrisis] = useState(false);
  const [opener, setOpener] = useState<string | null>(null);
  const [pendingLetterId, setPendingLetterId] = useState<string | null>(null);
  const [milestonePhrase, setMilestonePhrase] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { mood, refresh: refreshMood } = useMoodWeather();

  useEffect(() => {
    (async () => {
      try {
        const [r, o, p] = await Promise.all([
          api.listMessages(),
          api.opener(),
          api.pendingLetter().catch(() => ({ pendingLetterId: null })),
        ]);
        setMessages((r.messages as Message[]) || []);
        setOpener(o.opener || null);
        setPendingLetterId(p.pendingLetterId || null);
        if (o.milestone?.phrase) setMilestonePhrase(o.milestone.phrase);
        const hasRecentCrisis = ((r.messages as Message[]) || []).slice(-10).some(
          (m) => m.crisis_level === 'high',
        );
        if (hasRecentCrisis) setShowCrisis(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, opener]);

  const send = async (text: string, opts: { silent: boolean; ephemeral: boolean }) => {
    const local = detectCrisis(text);
    if (local.level === 'high' && !opts.ephemeral) setShowCrisis(true);

    const optimistic: Message = {
      id: 'local-' + Date.now(),
      role: 'user',
      content: text,
      created_at: Date.now(),
      crisis_level: opts.ephemeral ? 'none' : local.level,
    };
    setMessages((prev) => [...prev, optimistic]);
    if (opener) setOpener(null);

    // silent 走非流式（没有 AI 回复）
    if (opts.silent) {
      try {
        const r = await api.chat(text, opts);
        const userMsg = r.userMessage as Message;
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== optimistic.id);
          return [...filtered, userMsg, {
            id: 'silent-' + userMsg.id,
            role: 'assistant',
            content: '（静静地听着）',
            created_at: userMsg.created_at + 1,
          } as Message];
        });
        if (userMsg.crisis_level === 'high') setShowCrisis(true);
        refreshMood();
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      }
      return;
    }

    // 流式：边收边追加
    let userMsg: Message | null = null;
    let assistantId: string | null = null;
    let buffer = '';
    try {
      for await (const ev of api.chatStream(text, opts)) {
        if (ev.event === 'meta') {
          const data = ev.data as { userMessage: Message; assistantMessageId: string };
          userMsg = data.userMessage;
          assistantId = data.assistantMessageId;
          // 用真实 user 消息替换占位，插入空的 assistant
          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== optimistic.id);
            return [...filtered, userMsg!, { id: assistantId!, role: 'assistant', content: '', created_at: Date.now() } as Message];
          });
          if (userMsg.crisis_level === 'high') setShowCrisis(true);
        } else if (ev.event === 'chunk') {
          const d = ev.data as { delta: string };
          buffer += d.delta;
          const currentBuf = buffer;
          const aid = assistantId;
          if (aid) {
            setMessages((prev) => prev.map((m) => m.id === aid ? { ...m, content: currentBuf } : m));
          }
        } else if (ev.event === 'done') {
          refreshMood();
          const data = ev.data as { milestones?: Array<{ phrase: string }> };
          const m = data.milestones?.[0];
          if (m?.phrase) setMilestonePhrase(m.phrase);
        }
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id && m.id !== assistantId));
      // 失败提示
      setMessages((prev) => [...prev, {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: '（这会儿说不出话了。稍后再试？）',
        created_at: Date.now(),
      } as Message]);
      console.error('chat stream error', e);
    }
  };

  const handleDelete = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <>
      <WeatherBackground
        weather={mood?.current?.weather ?? null}
        wind={mood?.current?.wind ?? 0}
        background={user?.background || 'weather'}
      />
      <div className="chat">
        <div className="chat-scroll" ref={scrollRef}>
          {loading ? (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '3rem 0' }}>…</div>
          ) : (
            <>
              {opener && messages.length === 0 && (
                <div className="bubble assistant opener">{opener}</div>
              )}
              {opener && messages.length > 0 && (
                <div className="bubble assistant opener">{opener}</div>
              )}
              {messages.length === 0 && !opener && (
                <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '3rem 0', lineHeight: 1.9 }}>
                  慢慢来。<br />
                  今天的你，是哪一种天气呢？
                </div>
              )}
              {messages.map((m) => <MessageBubble key={m.id} m={m} onDelete={handleDelete} />)}
            </>
          )}
          {showCrisis && <CrisisBanner />}
          {pendingLetterId && (
            <a
              href="#/me/letters"
              className="letter-notice"
              onClick={() => setPendingLetterId(null)}
            >
              💌 过去的你，给你寄了一封信
            </a>
          )}
          {milestonePhrase && (
            <div className="milestone-notice" onClick={() => setMilestonePhrase(null)}>
              🕯 {milestonePhrase}
            </div>
          )}
        </div>
        <Composer onSend={send} />
      </div>
    </>
  );
}
