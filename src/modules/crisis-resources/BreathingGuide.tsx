import { useEffect, useRef, useState } from 'react';

// 4-7-8 呼吸法（通用安神）：吸 4s → 屏 7s → 呼 8s，循环
// 视觉：一个大圆吸气时放大、屏气时停、呼气时缩小

type Phase = 'inhale' | 'hold' | 'exhale';

const PHASE_SECS: Record<Phase, number> = {
  inhale: 4,
  hold: 7,
  exhale: 8,
};
const PHASE_LABEL: Record<Phase, string> = {
  inhale: '慢慢吸气',
  hold: '轻轻屏住',
  exhale: '慢慢呼出',
};
const NEXT: Record<Phase, Phase> = {
  inhale: 'hold',
  hold: 'exhale',
  exhale: 'inhale',
};

interface Props { onClose: () => void }

export default function BreathingGuide({ onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('inhale');
  const [remain, setRemain] = useState(PHASE_SECS.inhale);
  const [cycles, setCycles] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setRemain((r) => {
        if (r > 1) return r - 1;
        setPhase((p) => {
          const n = NEXT[p];
          if (n === 'inhale') setCycles((c) => c + 1);
          return n;
        });
        return 0;
      });
    }, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    setRemain(PHASE_SECS[phase]);
  }, [phase]);

  const scale = phase === 'inhale' ? 1.3 : phase === 'hold' ? 1.3 : 0.7;
  const duration = PHASE_SECS[phase];

  return (
    <div className="breathing-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="breathing-card">
        <div className="breathing-circle-wrap">
          <div
            className="breathing-circle"
            style={{ transform: `scale(${scale})`, transition: `transform ${duration}s ease-in-out` }}
          />
        </div>
        <div className="breathing-label">{PHASE_LABEL[phase]}</div>
        <div className="breathing-count">{remain}</div>
        <div className="breathing-cycles">已完成 {cycles} 轮</div>
        <button onClick={onClose}>先休息一下</button>
      </div>
    </div>
  );
}
