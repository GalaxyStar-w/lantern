import { useState } from 'react';
import { api } from '../../core/api.ts';
import { useApp } from '../../state/AppContext.tsx';

export default function ConsentGate() {
  const { refreshMe } = useApp();
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      await api.updateSettings({ consent: true });
      await refreshMe();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="consent-wrap">
      <div className="consent-card">
        <div className="lantern-emoji">🏮</div>
        <h2>在你开始说话之前</h2>
        <p>
          lantern 是一个可以慢慢说话的地方。<br />
          它不会评判你，也不会把你当"病人"。
        </p>
        <div className="consent-facts">
          <div>· 你说的话会保存下来，这样 AI 才能<strong>记得你聊过的事</strong>。</div>
          <div>· 系统会悄悄把你的情绪转换成"天气"，这只给你一个人看。</div>
          <div>· 你可以随时<strong>删除消息</strong>，也可以导出或清空全部数据。</div>
          <div>· 这不是心理咨询，不能代替真实的专业人士。</div>
          <div>· 如果很难熬，请记得 <strong>24 小时援助热线 400-161-9995</strong>。</div>
        </div>
        <div className="consent-actions">
          <button onClick={accept} disabled={busy}>
            {busy ? '…' : '我知道了，开始吧'}
          </button>
        </div>
      </div>
    </div>
  );
}
