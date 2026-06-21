// ValueCompass 后端
// ------------------------------------------------------------
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { complete, usingRealApi, modelName, genModel, judgeModel } from './claude.js'
import { buildGenerate, buildAlign, buildJudge, parseAlign } from './prompts.js'
import { dimensionWeights, computeReward, trainBradleyTerry, thetaToWeights } from './reward.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
const STUDY_FILE = path.join(DATA_DIR, 'userstudy.json')
fs.mkdirSync(DATA_DIR, { recursive: true })

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const MODEL = modelName

// 从模型文本里稳健地抽取 JSON
function extractJson(text) {
  try {
    return JSON.parse(text)
  } catch {}
  const m = text.match(/\{[\s\S]*\}/)
  if (m) {
    try {
      return JSON.parse(m[0])
    } catch {}
  }
  return null
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, usingRealApi, model: MODEL, genModel, judgeModel })
})

// 对齐流水线：原始回答 → 自我批评+修订 → 对前后分别评分
app.post('/api/run', async (req, res) => {
  try {
    const { prompt, principles, dimensions } = req.body
    if (!prompt || !Array.isArray(principles)) {
      return res.status(400).json({ error: 'prompt 与 principles 必填' })
    }

    const raw = await complete('generate', buildGenerate(prompt))
    const alignText = await complete('align', buildAlign(prompt, raw, principles))
    const aligned = parseAlign(alignText)

    const [rawJudgeText, revJudgeText] = await Promise.all([
      complete('judge', buildJudge(prompt, raw, principles, dimensions)),
      complete('judge', buildJudge(prompt, aligned.revised, principles, dimensions)),
    ])
    const rawScores = extractJson(rawJudgeText)?.scores || {}
    const revisedScores = extractJson(revJudgeText)?.scores || {}

    res.json({
      prompt,
      raw,
      critique: aligned.critique,
      revised: aligned.revised,
      rawScores,
      revisedScores,
      usingRealApi,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// 评分一个回答 → 维度分向量
async function judgeScores(prompt, answer, principles, dimensions) {
  const text = await complete('judge', buildJudge(prompt, answer, principles, dimensions))
  return extractJson(text)?.scores || {}
}

// Best-of-N：采样 N 个候选 → 评分 → 用奖励选最优（推理期 RLHF）
app.post('/api/bestofN', async (req, res) => {
  try {
    const { prompt, principles, dimensions, n = 4, temperature = 0.9 } = req.body
    if (!prompt || !Array.isArray(principles)) {
      return res.status(400).json({ error: 'prompt 与 principles 必填' })
    }
    const weights = dimensionWeights(dimensions)

    // 采样 N 个候选（逐个调用，带温度；mock 用 variant 制造差异）
    const candidates = []
    for (let i = 0; i < n; i++) {
      const text = await complete('generate', buildGenerate(prompt), { temperature, variant: i })
      const scores = await judgeScores(prompt, text, principles, dimensions)
      candidates.push({ i, text, scores, reward: computeReward(scores, weights) })
    }

    // 价值分 vs N 曲线：前 k 个候选里的最优奖励
    const curve = []
    let best = -Infinity
    for (let k = 0; k < candidates.length; k++) {
      best = Math.max(best, candidates[k].reward)
      curve.push(Number(best.toFixed(3)))
    }

    const ranked = [...candidates].sort((a, b) => b.reward - a.reward)
    res.json({
      prompt,
      candidates,
      ranked,
      chosen: ranked[0],
      curve,
      n,
      weights,
      usingRealApi,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// 用一组维度权重在偏好对上的判别准确率（奖励更高者是否=人类所选）
function weightsAccuracy(pairs, weights) {
  if (!pairs.length) return 0
  let correct = 0
  for (const p of pairs) {
    if (computeReward(p.win, weights) >= computeReward(p.lose, weights)) correct++
  }
  return correct / pairs.length
}

// SP4：半自动困难数据集构建（红队）
// 对每条种子：生成器作答 → 评审打分 → 目标维度上"翻车"(低分)者进入困难集。
const HARD_FILE = path.join(DATA_DIR, 'hard_dataset.json')

// 单题打分（避免一个请求里串跑全部 → 客户端超时）。前端逐题调用、显示进度。
app.post('/api/redteam/score', async (req, res) => {
  try {
    const { seed, principles, dimensions, threshold = 1 } = req.body
    if (!seed || !Array.isArray(principles)) {
      return res.status(400).json({ error: 'seed 与 principles 必填' })
    }
    const enabledDimIds = dimensions
      .filter((d) => principles.some((p) => p.dimId === d.id))
      .map((d) => d.id)
    const raw = await complete('generate', buildGenerate(seed.prompt), { temperature: 0.7 })
    const scores = await judgeScores(seed.prompt, raw, principles, dimensions)
    const diffScore = seed.dim
      ? scores[seed.dim] ?? 0
      : Math.min(...enabledDimIds.map((id) => scores[id] ?? 0))
    res.json({
      category: seed.category,
      dim: seed.dim || 'min',
      prompt: seed.prompt,
      rawSnippet: raw.slice(0, 200),
      scores,
      score: diffScore,
      hard: diffScore <= threshold,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// 保存困难集 + 完整构建结果（含逐题记录与各技术统计），供下次默认加载
app.post('/api/redteam/save', (req, res) => {
  try {
    const { items, records, stats, total, hardCount } = req.body
    fs.writeFileSync(
      HARD_FILE,
      JSON.stringify({ builtAt: new Date().toISOString(), items: items || [], records: records || [], stats: stats || {}, total, hardCount }, null, 2),
    )
    res.json({ ok: true, count: (items || []).length })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

app.get('/api/redteam/dataset', (req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync(HARD_FILE, 'utf-8')))
  } catch {
    res.json({ builtAt: null, items: [] })
  }
})

// Tier-2：在已收集的人类偏好对上训练 reward model（Bradley-Terry）
app.post('/api/train-rm', (req, res) => {
  try {
    const { dimensions } = req.body
    if (!Array.isArray(dimensions) || !dimensions.length) {
      return res.status(400).json({ error: 'dimensions 必填' })
    }
    const handWeights = dimensionWeights(dimensions)
    const dimIds = Object.keys(handWeights)

    const all = readStudy()
    const pairs = []
    for (const e of all) {
      if (!e.featRaw || !e.featRevised || !e.prefer) continue
      if (e.prefer === 'revised') pairs.push({ win: e.featRevised, lose: e.featRaw })
      else if (e.prefer === 'raw') pairs.push({ win: e.featRaw, lose: e.featRevised })
    }
    if (pairs.length < 3) {
      return res.json({ ok: false, n: pairs.length, message: '带特征的人类偏好样本不足（需≥3），请先在 Playground 多投几次票' })
    }

    const result = trainBradleyTerry(pairs, dimIds)
    const learnedWeights = thetaToWeights(result.theta, dimIds)
    res.json({
      ok: true,
      n: pairs.length,
      dimIds,
      theta: result.theta,
      learnedAccuracy: result.accuracy, // 学到的 RM 在偏好对上的判别准确率
      handAccuracy: weightsAccuracy(pairs, handWeights), // 手设权重基线
      handWeights,
      learnedWeights,
      loss: result.loss,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// 用户调研：保存一条反馈
app.post('/api/userstudy', (req, res) => {
  const entry = { ...req.body, ts: new Date().toISOString() }
  const all = readStudy()
  all.push(entry)
  fs.writeFileSync(STUDY_FILE, JSON.stringify(all, null, 2))
  res.json({ ok: true, count: all.length })
})

// 用户调研：返回原始记录 + 简单统计
app.get('/api/userstudy', (req, res) => {
  const all = readStudy()
  res.json({ entries: all, stats: aggregate(all) })
})

function readStudy() {
  try {
    return JSON.parse(fs.readFileSync(STUDY_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function aggregate(all) {
  if (!all.length) return { n: 0 }
  const num = (k) => all.map((e) => e[k]).filter((v) => typeof v === 'number')
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)
  const preferRevised = all.filter((e) => e.prefer === 'revised').length
  return {
    n: all.length,
    preferRevisedRate: all.length ? preferRevised / all.length : 0,
    avgTrust: avg(num('trust')),
    avgHelpful: avg(num('helpful')),
  }
}

const PORT = process.env.PORT || 8787
app.listen(PORT, () => {
  console.log(`[ValueCompass] api on :${PORT}  realApi=${usingRealApi}  model=${MODEL}`)
})
