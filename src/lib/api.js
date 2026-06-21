// 前端 API 封装
export async function getHealth() {
  const r = await fetch('/api/health')
  return r.json()
}

// 运行对齐流水线
export async function runPipeline(prompt, principles, dimensions) {
  const r = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, principles, dimensions }),
  })
  if (!r.ok) throw new Error((await r.json()).error || '请求失败')
  return r.json()
}

// Best-of-N：采样 N 个候选并用奖励选最优
export async function runBestOfN(prompt, principles, dimensions, n) {
  const r = await fetch('/api/bestofN', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, principles, dimensions, n }),
  })
  if (!r.ok) throw new Error((await r.json()).error || '请求失败')
  return r.json()
}

// 在已收集的人类偏好上训练 reward model
export async function trainRewardModel(dimensions) {
  const r = await fetch('/api/train-rm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dimensions }),
  })
  if (!r.ok) throw new Error((await r.json()).error || '请求失败')
  return r.json()
}

// SP4：困难数据集——单题打分（逐题调用、避免超时）
export async function scoreSeed(seed, principles, dimensions, threshold = 1) {
  const r = await fetch('/api/redteam/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed, principles, dimensions, threshold }),
  })
  if (!r.ok) throw new Error((await r.json()).error || '请求失败')
  return r.json()
}

// 保存困难集 + 完整构建结果（供默认加载）
export async function saveHardSet(payload) {
  const r = await fetch('/api/redteam/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return r.json()
}

// 读取已构建的困难数据集
export async function getHardDataset() {
  const r = await fetch('/api/redteam/dataset')
  return r.json()
}

export async function submitStudy(entry) {
  const r = await fetch('/api/userstudy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
  return r.json()
}

export async function getStudy() {
  const r = await fetch('/api/userstudy')
  return r.json()
}
