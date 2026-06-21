// 每个功能页顶部的统一「引导头」：这一步做什么 / 你要做什么 / 体现的贡献 + 下一步
export default function GuideHeader({ step, what, todo, contrib, nextTab, nextLabel, onNav }) {
  return (
    <div className="guide">
      <div className="guide-step">{step}</div>
      <div className="guide-body">
        <div className="guide-row"><span className="guide-ic">📍</span><span><b>这一步在做什么：</b>{what}</span></div>
        <div className="guide-row"><span className="guide-ic">👉</span><span><b>你要做的：</b>{todo}</span></div>
        <div className="guide-row"><span className="guide-ic">🎯</span><span><b>体现的贡献：</b>{contrib}</span></div>
      </div>
      {nextTab && (
        <button className="guide-next" onClick={() => onNav(nextTab)}>
          下一步：{nextLabel} →
        </button>
      )}
    </div>
  )
}
