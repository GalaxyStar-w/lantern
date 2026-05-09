export default function ToolsHub() {
  const tools = [
    { to: '#/me/tools/decouple', icon: '⚖️', label: '课题分离', desc: '焦虑来袭时，分清这是谁的事' },
    { to: '#/me/tools/breathing', icon: '🫁', label: '一起呼吸', desc: '跟着圆圈慢慢吸、慢慢呼' },
    { to: '#/me/letters', icon: '💌', label: '给未来的自己', desc: '写一封信，在某个未来打开' },
    { to: '#/me/saved', icon: '🌿', label: '收藏', desc: '你收进口袋的、被抚慰的那些话' },
  ];
  return (
    <div className="tools-hub">
      <h2>小工具</h2>
      <p className="hint">不想说话时可以试试这些</p>
      <div className="tools-grid">
        {tools.map((t) => (
          <a key={t.to} href={t.to} className="tool-card">
            <div className="tool-icon">{t.icon}</div>
            <div className="tool-label">{t.label}</div>
            <div className="tool-desc">{t.desc}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
