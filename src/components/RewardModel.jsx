// Reward Model（Tier-2）：在人类偏好对上训练 Bradley-Terry 奖励模型
// 对比「手设权重」与「从人类偏好学到的权重」，并可写回手册。
import { useState } from 'react'
import { trainRewardModel } from '../lib/api.js'
import { DEMO } from '../data/demo.js'

export default function RewardModel({ dims, setDims }) {
  const [res, setRes] = useState(DEMO.rewardModel || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [applied, setApplied] = useState(false)
  const [isDemo, setIsDemo] = useState(!!DEMO.rewardModel)

  const enabledDims = dims.filter((d) => d.principles.some((p) => p.enabled))

  async function train() {
    setLoading(true)
    setError(null)
    setApplied(false)
    try {
      setRes(await trainRewardModel(dims))
      setIsDemo(false)
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setLoading(false)
    }
  }

  // 把学到的维度权重写回手册（该维度下所有启用原则统一设为该权重）
  function applyLearned() {
    if (!res?.learnedWeights) return
    setDims((prev) =>
      prev.map((d) => {
        const w = res.learnedWeights[d.id]
        if (w == null) return d
        return { ...d, principles: d.principles.map((p) => (p.enabled ? { ...p, weight: w } : p)) }
      }),
    )
    setApplied(true)
  }

  const nameOf = (id) => enabledDims.find((d) => d.id === id)?.name || id

  return (
    <div>
      <div className="panel">
        <h2>Reward Model（从人类偏好学习权重）</h2>
        <p className="hint">
          RLHF 的核心机件：在你收集到的人类偏好对（来自 Playground 投票 / Best-of-N 记录）上，用 Bradley-Terry
          目标 P(a≻b)=σ(θ·(f<sub>a</sub>−f<sub>b</sub>)) 拟合各价值维度的权重 θ，再与手设权重对比。
        </p>
        <details style={{ marginBottom: 12, fontSize: 13 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-strong)' }}>怎么读这个面板 / 为什么不调 API 也能训练？</summary>
          <div className="muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
            · <b>不调 API 的原因</b>：训练的输入不是文本，而是每条回答<b>已经算好的 5 维分数向量</b>（评分阶段产生）。在这些数字上拟合权重是纯数学（逻辑回归），所以瞬间完成、无需模型。<br />
            · <b>「人类偏好对」哪来的</b>：你在 ③/④ 每点一次「更认可哪版」，就记下一对 (胜出版分向量, 落败版分向量)。<br />
            · <b>训练在学什么</b>：学一组维度权重 θ，使「人类更认可的那版奖励更高」。即<b>从人类反馈里反推出"人其实更看重哪个价值维度"</b>。<br />
            · <b>各指标含义</b>：「学习 RM 判别准确率」= 用学到的权重去判断，能多大比例和人类选择一致；「手设权重基线」= 用手册里你手设的权重做同样判断的准确率；二者对比说明"从人反馈学"是否比"拍脑袋设"更贴合。<br />
            · <b>下方权重表</b>：θ 是原始拟合值，「学到权重(1–5)」是归一化后可写回手册的版本——这就是 reward model 的产物，和"评估面板"的对齐结果是<b>两件事</b>（这里产出权重，那里用权重去评估）。<br />
            · <b>关于"我总是选对齐后"</b>：那样偏好高度一致，模型学到的就是"分数越高越好"这种较平凡的结论，演示意义大于发现意义。要看出"价值优先级"，需要有<b>分歧</b>的偏好（偶尔更认可对齐前、或在不同维度上取舍），那时学到的 θ 才有信息量。
          </div>
        </details>
        <div className="row">
          <button className="primary" onClick={train} disabled={loading}>
            {loading ? '训练中…' : '在人类偏好上训练 Reward Model'}
          </button>
          {error && <span style={{ color: 'var(--bad)' }}>错误：{error}</span>}
        </div>
        {isDemo && res && (
          <p className="hint" style={{ marginTop: 8 }}>📌 下方为作者真实偏好数据训练出的示例结果。点上方按钮可在当前偏好上重新训练。</p>
        )}
      </div>

      {res && res.ok === false && (
        <div className="panel">
          <p className="muted">{res.message}（当前可用样本 {res.n}）</p>
        </div>
      )}

      {res && res.ok && (
        <>
          <div className="panel">
            <h2>训练结果</h2>
            <div className="kpi" style={{ marginBottom: 14 }}>
              <div className="box">
                <div className="num">{res.n}</div>
                <div className="lab">人类偏好对</div>
              </div>
              <div className="box">
                <div className="num" style={{ color: 'var(--good)' }}>
                  {Math.round(res.learnedAccuracy * 100)}%
                </div>
                <div className="lab">学习 RM 判别准确率</div>
              </div>
              <div className="box">
                <div className="num" style={{ color: 'var(--muted)' }}>
                  {Math.round(res.handAccuracy * 100)}%
                </div>
                <div className="lab">手设权重基线</div>
              </div>
              <div className="box">
                <div className="num">{res.loss.toFixed(3)}</div>
                <div className="lab">训练损失</div>
              </div>
            </div>
            <p className="hint">
              学习 RM 与人类偏好的一致性{res.learnedAccuracy >= res.handAccuracy ? '不低于' : '低于'}手设权重——
              说明从人类反馈中{res.learnedAccuracy >= res.handAccuracy ? '确实能学到更贴合的价值权重' : '本批样本上提升有限（样本量小或已饱和）'}。
            </p>
          </div>

          <div className="panel">
            <h2>权重对比：手设 vs 学习</h2>
            <table>
              <thead>
                <tr>
                  <th>价值维度</th>
                  <th>原始 θ</th>
                  <th>手设权重</th>
                  <th>学到权重(1–5)</th>
                </tr>
              </thead>
              <tbody>
                {res.dimIds.map((id) => (
                  <tr key={id}>
                    <td>{nameOf(id)}</td>
                    <td className="muted">{res.theta[id].toFixed(2)}</td>
                    <td>{res.handWeights[id]}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{res.learnedWeights[id]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="primary" onClick={applyLearned}>把学到的权重写回价值手册</button>
              {applied && <span className="muted">已写回，可回「评估面板/Best-of-N」对比效果。</span>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
