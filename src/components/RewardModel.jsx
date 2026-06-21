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
