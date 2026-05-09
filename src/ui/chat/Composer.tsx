import { useEffect, useRef, useState } from 'react';

interface Props {
  onSend: (text: string, opts: { silent: boolean; ephemeral: boolean }) => Promise<void> | void;
  disabled?: boolean;
}

type SRCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: unknown) => void) | null;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
}

function getSR(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function Composer({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [silent, setSilent] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [listening, setListening] = useState(false);
  const composingRef = useRef(false);
  const srRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef('');   // 录音开始时已有的文字
  const finalTextRef = useRef('');  // 本次录音累积的最终识别文本

  const SR = getSR();
  const voiceSupported = !!SR;

  useEffect(() => {
    return () => { try { srRef.current?.stop(); } catch { /* noop */ } };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setText('');        // 立即清空，不等后端
    setSending(true);
    try {
      await onSend(t, { silent, ephemeral });
    } catch {
      // 失败时把内容还回去，让用户不丢
      setText(t);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (composingRef.current) return;
    const ne = e.nativeEvent as KeyboardEvent;
    if (ne.isComposing || ne.keyCode === 229) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(e as unknown as React.FormEvent);
    }
  };

  const toggleVoice = () => {
    if (!SR) return;
    if (listening) {
      try { srRef.current?.stop(); } catch { /* noop */ }
      setListening(false);
      return;
    }
    try {
      const sr = new SR();
      sr.lang = 'zh-CN';
      sr.continuous = true;
      sr.interimResults = true;

      baseTextRef.current = text ? text + (text.endsWith(' ') || text.endsWith('\n') ? '' : ' ') : '';
      finalTextRef.current = '';

      sr.onresult = (ev) => {
        let interim = '';
        // 遍历 results 所有元素（而非仅 resultIndex 之后），把已 final 的全累积起来
        for (let i = 0; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) {
            // 只在当前索引 >= 已处理过的时加入；为简单起见，每次都重新聚合所有 final
          }
        }
        // 更稳的做法：把所有 final 重新从头聚合，避免跨 result batch 漏取
        let finalAll = '';
        for (let i = 0; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) finalAll += r[0].transcript;
          else interim += r[0].transcript;
        }
        finalTextRef.current = finalAll;
        setText((baseTextRef.current + finalAll + interim).replace(/\s+$/, ''));
      };
      sr.onend = () => {
        // 兜底：最后一次把 final 写回（避免短时间 end 时 onresult 还没触发 final）
        const combined = (baseTextRef.current + finalTextRef.current).replace(/\s+$/, '');
        if (combined) setText(combined);
        setListening(false);
      };
      sr.onerror = () => setListening(false);
      sr.start();
      srRef.current = sr;
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const placeholder = silent
    ? '这次只写，不等回应…'
    : ephemeral
    ? '临时模式：这段对话不会被记住…'
    : '想说什么都可以，不急。';

  return (
    <div className="composer">
      <div className="composer-modes">
        <label>
          <input type="checkbox" checked={silent} onChange={(e) => setSilent(e.target.checked)} />
          <span>只写不回</span>
        </label>
        <label>
          <input type="checkbox" checked={ephemeral} onChange={(e) => setEphemeral(e.target.checked)} />
          <span>临时模式</span>
        </label>
      </div>
      <form onSubmit={submit}>
        {voiceSupported && (
          <button
            type="button"
            className={`voice-btn ${listening ? 'on' : ''}`}
            onClick={toggleVoice}
            disabled={disabled || sending}
            title={listening ? '停止录音' : '按住说话（中文）'}
          >{listening ? '●' : '🎙'}</button>
        )}
        <textarea
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
          rows={1}
          disabled={disabled || sending}
        />
        <button type="submit" disabled={disabled || sending || !text.trim()}>
          {sending ? '…' : (silent ? '写下' : '说')}
        </button>
      </form>
    </div>
  );
}
