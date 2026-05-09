import { useState } from 'react';
import BreathingGuide from '../../modules/crisis-resources/BreathingGuide.tsx';

export default function CrisisBanner() {
  const [showBreath, setShowBreath] = useState(false);

  return (
    <>
      <div className="crisis-banner">
        <div><strong>先轻轻放下手。</strong></div>
        <div>
          你愿意把这么重的话说出来，已经很勇敢。
          如果现在很难熬，打一个电话也没关系 —— <br />
          全国心理援助热线 <a href="tel:400-161-9995">400-161-9995</a> 24 小时都有人在。
        </div>
        <div style={{ marginTop: '0.7rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button onClick={() => setShowBreath(true)}>跟着一起呼吸</button>
        </div>
      </div>
      {showBreath && <BreathingGuide onClose={() => setShowBreath(false)} />}
    </>
  );
}
