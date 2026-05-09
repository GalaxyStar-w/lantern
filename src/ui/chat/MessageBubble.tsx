import type { Message } from '../../state/types.ts';

export default function MessageBubble({ m }: { m: Message }) {
  return (
    <div className={`bubble ${m.role}`}>{m.content}</div>
  );
}
