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
  const sppedTextRef = useRef('');

  const SR = getSR();
  const voiceSupported = !!SR;

  useEffect(() => {
    return () => { try { srRef.current?.stop(); } catch { /* noop */ } };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await onSend(t, { silent, ephemeral });
      setText('');
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
      sppedTextRef.current = text;
      sr.onresult = (ev) => {
        let interim = '';
        let final = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) final += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (final) {
          sppedTextRef.current = (sppedTextRef.current + final).trim();
          setText(sppedTextRef.current);
        } else {
          setText((sppedTextRef.current + interim).trim());
        }
      };
      sr.onend = () => setListening(false);
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
