// 奖励函数 + Reward Model 训练
// ------------------------------------------------------------
// 奖励 r(answer) = Σ_d w_d · score_d(answer | 手册) / Σ_d w_d   （归一到 0–2）
//   score_d ∈ {0,1,2} 由 LLM 评审按维度给出
//   w_d 为维度权重（手册里各启用原则权重之和；或由人类偏好学习得到）
//
// Reward Model（Tier-2）：在人类偏好对上拟合 Bradley-Terry / 逻辑回归
//   P(a≻b) = sigmoid( θ · (f_a − f_b) )，f 为维度分向量
//   这正是 RLHF 中训练 reward model 的标准目标，只是特征维度极低、纯 JS 可解。

// 由手册聚合出每个维度的权重（启用原则权重之和）
export function dimensionWeights(dimensions) {
  const w = {}
  for (const d of dimensions) {
    const s = d.principles.filter((p) => p.enabled).reduce((a, p) => a + (p.weight || 0), 0)
    if (s > 0) w[d.id] = s
  }
  return w
}

// 加权归一奖励（0–2）
export function computeReward(scores, weights) {
  const ids = Object.keys(weights)
  if (!ids.length) return 0
  let num = 0
  let den = 0
  for (const id of ids) {
    const w = weights[id]
    num += w * (scores[id] ?? 0)
    den += w
  }
  return den ? num / den : 0
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z))

// 在偏好对上训练 Bradley-Terry reward model
// pairs: [{ win: {dimId:score}, lose: {dimId:score} }]
// dimIds: 固定的维度顺序
// 返回 { theta:{dimId:weight}, accuracy, n, loss }
export function trainBradleyTerry(pairs, dimIds, { lr = 0.5, epochs = 400, l2 = 0.01 } = {}) {
  const theta = {}
  for (const id of dimIds) theta[id] = 0

  const diff = (p) => dimIds.map((id) => (p.win[id] ?? 0) - (p.lose[id] ?? 0))

  for (let e = 0; e < epochs; e++) {
    const grad = {}
    for (const id of dimIds) grad[id] = 0
    for (const p of pairs) {
      const d = diff(p)
      let z = 0
      dimIds.forEach((id, i) => (z += theta[id] * d[i]))
      const err = sigmoid(z) - 1 // 目标 win 胜出 → label=1
      dimIds.forEach((id, i) => (grad[id] += err * d[i]))
    }
    for (const id of dimIds) {
      grad[id] = grad[id] / pairs.length + l2 * theta[id]
      theta[id] -= lr * grad[id]
    }
  }

  // 训练集准确率 & 损失
  let correct = 0
  let loss = 0
  for (const p of pairs) {
    const d = diff(p)
    let z = 0
    dimIds.forEach((id, i) => (z += theta[id] * d[i]))
    const pr = sigmoid(z)
    if (pr > 0.5) correct++
    loss += -Math.log(Math.max(pr, 1e-9))
  }

  return {
    theta,
    accuracy: pairs.length ? correct / pairs.length : 0,
    loss: pairs.length ? loss / pairs.length : 0,
    n: pairs.length,
  }
}

// 把学到的 θ 映射成手册可用的 1–5 权重（正部分 min-max → 1–5）
export function thetaToWeights(theta, dimIds) {
  const vals = dimIds.map((id) => Math.max(0, theta[id] ?? 0))
  const max = Math.max(...vals, 1e-9)
  const out = {}
  dimIds.forEach((id, i) => {
    out[id] = max > 0 ? Math.round(1 + (vals[i] / max) * 4) : 3
  })
  return out
}
