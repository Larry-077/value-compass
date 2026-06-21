// 抓取真实 API 结果 → 固化为前端内置示例数据 src/data/demo.js
// 这样老师拿到项目无需配 key、无需等待，打开即见真实结果。
// 用法：后端在跑(node server/index.js) → node scripts/capture_demo.mjs
import fs from 'node:fs'
import { DIMENSIONS, flattenEnabled } from '../src/data/defaultHandbook.js'
import { BENCHMARK } from '../src/data/benchmark.js'

const API = process.env.VC_API || 'http://localhost:8787'
const principles = flattenEnabled(DIMENSIONS)
const dimIds = DIMENSIONS.filter((d) => principles.some((p) => p.dimId === d.id)).map((d) => d.id)
const overall = (s) => dimIds.reduce((a, id) => a + (s[id] ?? 0), 0) / dimIds.length

async function post(path, body) {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(path + ' ' + (await r.text()))
  return r.json()
}
const runPipeline = (prompt) => post('/api/run', { prompt, principles, dimensions: DIMENSIONS })
const runBoN = (prompt, n) => post('/api/bestofN', { prompt, principles, dimensions: DIMENSIONS, n })

const hard = JSON.parse(fs.readFileSync('data/hard_dataset.json', 'utf-8'))
const hardPrompts = hard.items.map((it) => it.prompt)
const benchPrompts = [3, 7, 9, 0].map((i) => BENCHMARK[i].prompt) // 性别/医疗/地域/投毒

// 1) 评估：困难集 + 普通基准（全量 /api/run，保留完整字段）
console.log('评估困难集', hardPrompts.length, '题...')
const evalHardFull = []
for (let i = 0; i < hardPrompts.length; i++) {
  const r = await runPipeline(hardPrompts[i])
  evalHardFull.push({ id: `H${i + 1}`, category: hard.items[i].category, ...r })
  console.log(`  H${i + 1} 前${overall(r.rawScores).toFixed(2)}→后${overall(r.revisedScores).toFixed(2)}`)
}
console.log('评估普通基准', benchPrompts.length, '题...')
const evalBenchFull = []
for (let i = 0; i < benchPrompts.length; i++) {
  const r = await runPipeline(benchPrompts[i])
  evalBenchFull.push({ id: `B${i + 1}`, ...r })
  console.log(`  B${i + 1} 前${overall(r.rawScores).toFixed(2)}→后${overall(r.revisedScores).toFixed(2)}`)
}

const toRow = (e) => ({ id: e.id, prompt: e.prompt, before: e.rawScores, after: e.revisedScores })
const toRun = (e) => ({ prompt: e.prompt, raw: e.raw, critique: e.critique, revised: e.revised, rawScores: e.rawScores, revisedScores: e.revisedScores })

// 2) Best-of-N：2 个示例
console.log('Best-of-N x2 ...')
const bon = []
bon.push(await runBoN(hardPrompts[0], 4))
bon.push(await runBoN(benchPrompts[0], 4))

// 3) 偏好数据（用于 Reward Model）：从评估中取 revised≻raw 的对，写入 userstudy.json
const prefs = [...evalHardFull, ...evalBenchFull]
  .filter((e) => overall(e.revisedScores) >= overall(e.rawScores))
  .map((e) => ({ source: 'demo', prompt: e.prompt, prefer: 'revised', featRaw: e.rawScores, featRevised: e.revisedScores, ts: new Date().toISOString() }))
fs.writeFileSync('data/userstudy.json', JSON.stringify(prefs, null, 2))
console.log('写入', prefs.length, '条示例偏好 → data/userstudy.json')

// 4) 训练 reward model（真实端点）
const rm = await post('/api/train-rm', { dimensions: DIMENSIONS })

// 5) 写出前端内置示例
const demo = {
  generatedAt: new Date().toISOString(),
  models: { gen: 'glm-4-flash', judge: 'claude-sonnet-4-6' },
  hardDataset: { builtAt: hard.builtAt, records: hard.records, stats: hard.stats, items: hard.items, total: hard.total, hardCount: hard.hardCount },
  evaluation: { hard: evalHardFull.map(toRow), benchmark: evalBenchFull.map(toRow) },
  playground: [toRun(evalHardFull[0]), toRun(evalHardFull[2] || evalHardFull[1]), toRun(evalBenchFull[0])],
  bestofn: bon,
  rewardModel: rm,
  preferencesCount: prefs.length,
}
const out = '// 自动生成（scripts/capture_demo.mjs）：真实 API 调用结果的内置缓存，供无 key/免等待直接展示。\nexport const DEMO = ' + JSON.stringify(demo, null, 2) + '\n'
fs.writeFileSync('src/data/demo.js', out)
console.log('\n✓ 已生成 src/data/demo.js（评估困难', demo.evaluation.hard.length, '/普通', demo.evaluation.benchmark.length, '，BoN', bon.length, '，RM acc', rm.learnedAccuracy, '）')
