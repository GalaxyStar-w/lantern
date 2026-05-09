import { useEffect, useRef, useState } from 'react';
import { api } from '../../core/api.ts';
import { detectCrisis } from '../../core/crisis.ts';
import type { Message } from '../../state/types.ts';
import MessageBubble from './MessageBubble.tsx';
import Composer from './Composer.tsx';
import CrisisBanner from './CrisisBanner.tsx';
import WeatherBackground from '../../modules/mood-weather/WeatherBackground.tsx';
import { useMoodWeather } from '../../modules/mood-weather/useMoodWeather.ts';

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCrisis, setShowCrisis] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { mood, refresh: refreshMood } = useMoodWeather();

  useEffect(() => {
    (async () => {
      try {
        const r = await api.listMessages();
        setMessages((r.messages as Message[]) || []);
        const hasRecentCrisis = (r.messages as Message[] || []).slice(-10).some(
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
  }, [messages.length]);

  const send = async (text: string) => {
    const local = detectCrisis(text);
    if (local.level === 'high') setShowCrisis(true);

    const optimistic: Message = {
      id: 'local-' + Date.now(),
      role: 'user',
      content: text,
      created_at: Date.now(),
      crisis_level: local.level,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const r = await api.chat(text);
      const userMsg = r.userMessage as Message;
      const reply = r.reply as Message;
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== optimistic.id);
        return [...filtered, userMsg, reply];
      });
      if (userMsg.crisis_level === 'high') setShowCrisis(true);
      refreshMood();
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
  };

  return (
    <>
      <WeatherBackground weather={mood?.current?.weather ?? null} wind={mood?.current?.wind ?? 0} />
      <div className="chat">
        <div className="chat-scroll" ref={scrollRef}>
          {loading ? (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '3rem 0' }}>…</div>
          ) : messages.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '3rem 0', lineHeight: 1.9 }}>
              慢慢来。<br />
              今天的你，是哪一种天气呢？
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} m={m} />)
          )}
          {showCrisis && <CrisisBanner />}
        </div>
        <Composer onSend={send} />
      </div>
    </>
  );
}
