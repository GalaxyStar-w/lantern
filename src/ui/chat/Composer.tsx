import { useState } from 'react';

interface Props {
  onSend: (text: string) => Promise<void> | void;
  disabled?: boolean;
}

export default function Composer({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await onSend(t);
      setText('');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="composer">
      <form onSubmit={submit}>
        <textarea
          placeholder="想说什么都可以，不急。"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled || sending}
        />
        <button type="submit" disabled={disabled || sending || !text.trim()}>
          {sending ? '…' : '说'}
        </button>
      </form>
    </div>
  );
}
