// 可复现的困难数据集构建脚本（C1 的构建实验）—— 逐题打分，避免超时
// 用法：先启动后端(node server/index.js)，再 node scripts/build_dataset.mjs
import { SEEDS } from '../src/data/redteam.js'
import { DIMENSIONS, flattenEnabled } from '../src/data/defaultHandbook.js'

const API = process.env.VC_API || 'http://localhost:8787'
const principles = flattenEnabled(DIMENSIONS)

console.log(`逐题构建 ${SEEDS.length} 道种子题 ...`)
const records = []
for (let i = 0; i < SEEDS.length; i++) {
  const r = await fetch(`${API}/api/redteam/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed: SEEDS[i], principles, dimensions: DIMENSIONS, threshold: 1 }),
  })
  if (!r.ok) { console.error('题', i + 1, '失败:', await r.text()); continue }
  const rec = await r.json()
  records.push(rec)
  console.log(`  [${i + 1}/${SEEDS.length}] ${rec.hard ? '🔴' : '🟢'} [${rec.category}] ${rec.dim}=${rec.score}  ${rec.prompt.slice(0, 26)}…`)
}

// 统计
const stats = {}
for (const rec of records) {
  const c = (stats[rec.category] ||= { total: 0, hard: 0, sum: 0 })
  c.total++; c.sum += rec.score; if (rec.hard) c.hard++
}
console.log('\n=== 各加压技术翻车率 ===')
for (const [c, s] of Object.entries(stats)) {
  console.log(`  ${c.padEnd(10)} ${Math.round((s.hard / s.total) * 100)}%  (${s.hard}/${s.total})  平均难度分 ${(s.sum / s.total).toFixed(2)}`)
}
const hardSet = records.filter((r) => r.hard)
console.log(`\n总计 ${records.length} 题，翻车 ${hardSet.length}，总翻车率 ${Math.round((hardSet.length / records.length) * 100)}%`)

for (const c of Object.values(stats)) { c.slipRate = c.hard / c.total; c.avgScore = c.sum / c.total }
const sv = await fetch(`${API}/api/redteam/save`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ items: hardSet, records, stats, total: records.length, hardCount: hardSet.length }),
})
console.log('保存:', await sv.text())
