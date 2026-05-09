import { useState } from 'react';
import BreathingGuide from '../../modules/crisis-resources/BreathingGuide.tsx';

export default function BreathingView() {
  const [on, setOn] = useState(false);
  if (on) return <BreathingGuide onClose={() => setOn(false)} />;
  return (
    <div className="memory-view" style={{ textAlign: 'center' }}>
      <h2>一起呼吸</h2>
      <p className="hint">
        心里很乱的时候，这个圆圈会陪你。<br />
        吸 4 秒 → 屏 7 秒 → 呼 8 秒。<br />
        做几轮，身体会慢下来，心也会。
      </p>
      <div style={{ margin: '2rem 0' }}>
        <button onClick={() => setOn(true)} style={{ padding: '0.9rem 2rem' }}>开始</button>
      </div>
    </div>
  );
}
