import { useEffect, useRef, useState } from 'react';

// 暂不开放语音：Chrome 的 Web Speech API 依赖 Google 服务，国内常被墙。
// 待接入 OpenAI-compatible 的 /audio/transcriptions（如硅基流动、百炼）时改回 true。
const VOICE_ENABLED = false;

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
  onstart: (() => void) | null;
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
    console.log('[voice] toggleVoice, SR=', !!SR, 'listening=', listening);
    if (!SR) {
      alert('这个浏览器不支持语音识别。建议用 Chrome、Safari 或 Edge。');
      return;
    }
    if (listening) {
      try { srRef.current?.stop(); } catch { /* noop */ }
      setListening(false);
      return;
    }
    try {
      const sr = new SR();
      sr.lang = 'zh-CN';
      sr.continuous = false;
      sr.interimResults = true;

      baseTextRef.current = text ? text + (text.endsWith(' ') || text.endsWith('\n') ? '' : ' ') : '';
      finalTextRef.current = '';

      sr.onstart = () => { console.log('[voice] started, say something…'); };
      sr.onresult = (ev) => {
        let finalAll = '';
        let interim = '';
        for (let i = 0; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) finalAll += r[0].transcript;
          else interim += r[0].transcript;
        }
        console.log('[voice] onresult final=', finalAll, 'interim=', interim);
        finalTextRef.current = finalAll;
        setText((baseTextRef.current + finalAll + interim).replace(/\s+$/, ''));
      };
      sr.onend = () => {
        console.log('[voice] ended, final=', finalTextRef.current);
        const combined = (baseTextRef.current + finalTextRef.current).replace(/\s+$/, '');
        if (combined) setText(combined);
        setListening(false);
      };
      sr.onerror = (ev) => {
        const err = (ev as { error?: string }).error || 'unknown';
        console.warn('[voice] error:', err, ev);
        setListening(false);
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          alert('麦克风权限未允许。请在地址栏旁的锁图标里允许"麦克风"，或去系统设置 > 隐私 > 麦克风 给浏览器授权。');
        } else if (err === 'network') {
          alert('语音识别走不通。Chrome 默认用 Google 的识别服务，国内网络常被墙。可以试试 Safari，或者继续用键盘。');
        } else if (err !== 'no-speech' && err !== 'aborted') {
          alert(`语音识别出错了：${err}`);
        }
      };
      sr.start();
      console.log('[voice] start() called');
      srRef.current = sr;
      setListening(true);
    } catch (e) {
      console.error('[voice] start failed:', e);
      alert(`语音启动失败：${(e as Error).message || '未知错误'}`);
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
        {VOICE_ENABLED && voiceSupported && (
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
