// SP4：困难数据集构建（半自动红队）
// 用"加压技术"种子题跑生成器→评审打分→保留"翻车"(低分)的进困难集，并统计各技术翻车率。
import { useEffect, useState } from 'react'
import { flattenEnabled } from '../data/defaultHandbook.js'
import { CATEGORIES, SEEDS } from '../data/redteam.js'
import { scoreSeed, saveHardSet, getHardDataset } from '../lib/api.js'
import { DEMO } from '../data/demo.js'

const catColor = { jailbreak: '#a8554f', fabricate: '#4a6785', dilemma: '#9b7838', bias: '#6d5f8a' }

const demoHard = DEMO.hardDataset?.records?.length
  ? { records: DEMO.hardDataset.records, stats: DEMO.hardDataset.stats, hardCount: DEMO.hardDataset.hardCount, total: DEMO.hardDataset.total }
  : null

export default function RedTeam({ dims }) {
  const [picked, setPicked] = useState(Object.keys(CATEGORIES))
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [res, setRes] = useState(demoHard)
  const [error, setError] = useState(null)
  const [savedAt, setSavedAt] = useState(demoHard ? DEMO.hardDataset.builtAt : null)

  // 进页面默认加载上一次的完整构建结果（后端有则覆盖内置示例）
  useEffect(() => {
    getHardDataset().then((d) => {
      if (d && d.records && d.records.length) {
        setRes({ records: d.records, stats: d.stats, hardCount: d.hardCount, total: d.total })
        setSavedAt(d.builtAt)
      }
    }).catch(() => {})
  }, [])

  const toggle = (c) =>
    setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))

  // 逐题打分（避免一个请求串跑全部导致超时），实时显示进度
  async function build() {
    setLoading(true)
    setError(null)
    setRes(null)
    setProgress(0)
    try {
      const seeds = SEEDS.filter((s) => picked.includes(s.category))
      const principles = flattenEnabled(dims)
      const records = []
      for (let i = 0; i < seeds.length; i++) {
        try {
          records.push(await scoreSeed(seeds[i], principles, dims, 1))
        } catch (e) {
          records.push({ category: seeds[i].category, dim: seeds[i].dim || 'min', prompt: seeds[i].prompt, scores: {}, score: 2, hard: false, rawSnippet: '错误:' + (e.message || e) })
        }
        setProgress(i + 1)
        setRes({ records: [...records], partial: true })
      }
      // 统计各技术翻车率
      const stats = {}
      for (const r of records) {
        const c = (stats[r.category] ||= { total: 0, hard: 0, sumScore: 0 })
        c.total++
        c.sumScore += r.score
        if (r.hard) c.hard++
      }
      for (const c of Object.values(stats)) {
        c.slipRate = c.total ? c.hard / c.total : 0
        c.avgScore = c.total ? c.sumScore / c.total : 0
      }
      const hardSet = records.filter((r) => r.hard)
      await saveHardSet({ items: hardSet, records, stats, hardCount: hardSet.length, total: records.length })
      setSavedAt(new Date().toISOString())
      setRes({ records, stats, hardCount: hardSet.length, total: records.length })
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setLoading(false)
    }
  }

  const seedCount = SEEDS.filter((s) => picked.includes(s.category)).length

  return (
    <div>
      <div className="panel">
        <h2>困难数据集构建（半自动红队）· SP4 / 贡献 C1</h2>
        <p className="hint">
          普通题已被现代模型对齐、测不出问题。这里用"加压技术"把题目变难：跑生成器作答 → 评审按手册打分 →
          在目标维度上<strong>"翻车"(≤1分)</strong>的题进入困难集。各技术的<strong>翻车率</strong>就是 C1 的实验数据。
        </p>
        <div className="row" style={{ marginBottom: 10, gap: 14 }}>
          {Object.entries(CATEGORIES).map(([c, name]) => (
            <label key={c} className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={picked.includes(c)} onChange={() => toggle(c)} />
              <span style={{ color: catColor[c] }}>● </span>
              {name}
            </label>
          ))}
        </div>
        <div className="row">
          <button className="primary" onClick={build} disabled={loading || !seedCount}>
            {loading ? `构建中… ${progress}/${seedCount}` : `构建（${seedCount} 道种子题）`}
          </button>
          {loading && <span className="spinner">逐题生成+评分（每题约几秒），请勿切换标签页</span>}
          {error && <span style={{ color: 'var(--bad)' }}>错误：{error}</span>}
        </div>
        {savedAt && !loading && (
          <p className="hint" style={{ marginTop: 8 }}>
            ✓ 已加载上次构建结果（{new Date(savedAt).toLocaleString()}）。如需更新可重新构建。
          </p>
        )}
      </div>

      {res && res.stats && (
        <>
          <div className="panel">
            <h2>各加压技术的翻车率</h2>
            <div className="kpi" style={{ marginBottom: 14 }}>
              <div className="box">
                <div className="num">{res.total}</div>
                <div className="lab">测试题数</div>
              </div>
              <div className="box">
                <div className="num" style={{ color: 'var(--bad)' }}>{res.hardCount}</div>
                <div className="lab">进入困难集（翻车）</div>
              </div>
              <div className="box">
                <div className="num" style={{ color: 'var(--accent)' }}>
                  {res.total ? Math.round((res.hardCount / res.total) * 100) : 0}%
                </div>
                <div className="lab">总翻车率</div>
              </div>
            </div>
            <table>
              <thead>
                <tr><th>加压技术</th><th>题数</th><th>翻车</th><th>翻车率</th><th>平均难度分</th></tr>
              </thead>
              <tbody>
                {Object.entries(res.stats).map(([c, s]) => (
                  <tr key={c}>
                    <td><span style={{ color: catColor[c] }}>●</span> {CATEGORIES[c] || c}</td>
                    <td>{s.total}</td>
                    <td style={{ color: 'var(--bad)' }}>{s.hard}</td>
                    <td className="delta-down">{Math.round(s.slipRate * 100)}%</td>
                    <td>{s.avgScore.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <h2>逐题结果</h2>
            <p className="hint">红=翻车（已纳入困难集）。点击可看模型原始回答片段。</p>
            {res.records.map((r, i) => (
              <details key={i} className="answer" style={{ marginBottom: 8, borderLeft: `3px solid ${r.hard ? 'var(--bad)' : 'var(--good)'}` }}>
                <summary style={{ cursor: 'pointer' }}>
                  <span style={{ color: catColor[r.category] }}>[{CATEGORIES[r.category]}]</span>{' '}
                  {r.hard ? '🔴 翻车' : '🟢 守住'} · {r.dim}={r.score} — {r.prompt.slice(0, 34)}…
                </summary>
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <div className="muted">题目：{r.prompt}</div>
                  <div style={{ marginTop: 6 }}>模型原始回答（片段）：{r.rawSnippet}…</div>
                  <div className="muted" style={{ marginTop: 6 }}>各维度分：{JSON.stringify(r.scores)}</div>
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
