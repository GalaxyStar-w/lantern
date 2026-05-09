import { useState } from 'react';
import type { Message } from '../../state/types.ts';
import { api } from '../../core/api.ts';

interface Props {
  m: Message;
  onDelete?: (id: string) => void;
}

export default function MessageBubble({ m, onDelete }: Props) {
  const [saved, setSaved] = useState(false);
  const isAssistant = m.role === 'assistant';
  const isUser = m.role === 'user';

  const save = async () => {
    try {
      await api.saveMessage(m.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silent */ }
  };

  const del = async () => {
    if (!confirm('删掉这条？')) return;
    try {
      await api.deleteMessage(m.id);
      onDelete?.(m.id);
    } catch { /* silent */ }
  };

  if (m.id.startsWith('local-')) {
    return <div className={`bubble ${m.role}`}>{m.content}</div>;
  }

  return (
    <div className={`bubble-wrap ${m.role}`}>
      <div className={`bubble ${m.role}`}>{m.content}</div>
      <div className="bubble-actions">
        {isAssistant && (
          <button onClick={save} title="收藏这句话">
            {saved ? '♥' : '♡'}
          </button>
        )}
        {isUser && (
          <button onClick={del} title="删除">×</button>
        )}
      </div>
    </div>
  );
}
