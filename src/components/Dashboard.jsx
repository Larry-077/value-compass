// 评估面板：对所选题集跑对齐流水线，汇总对齐前后的价值得分
import { useEffect, useState } from 'react'
import { flattenEnabled } from '../data/defaultHandbook.js'
import { runPipeline, getHardDataset } from '../lib/api.js'
import { BENCHMARK } from '../data/benchmark.js'
import { DEMO } from '../data/demo.js'
import Radar from './Radar.jsx'

const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)

export default function Dashboard({ dims }) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [source, setSource] = useState('hard') // benchmark | hard
  const [hardItems, setHardItems] = useState(DEMO.hardDataset?.items || [])
  // 各题集的「实时运行结果」；未运行则回退到内置示例 DEMO
  const [live, setLive] = useState({ benchmark: null, hard: null })
  const [liveRows, setLiveRows] = useState(null) // 运行中的进度缓冲

  const enabledDims = dims.filter((d) => d.principles.some((p) => p.enabled))

  useEffect(() => {
    getHardDataset().then((d) => { if (d.items?.length) setHardItems(d.items) }).catch(() => {})
    try {
      const saved = JSON.parse(localStorage.getItem('vc_dash_v2') || 'null')
      if (saved) setLive(saved)
    } catch {}
  }, [])

  function overall(scores) {
    return avg(enabledDims.map((d) => scores[d.id] ?? 0))
  }

  // 当前展示：运行中→进度缓冲；否则该题集的实时结果或内置示例
  const liveForSource = live[source]
  const rows = liveRows || (liveForSource ? liveForSource.rows : (DEMO.evaluation[source] || []))
  const isDemo = !liveRows && !liveForSource && rows.length > 0
  const savedAt = liveForSource ? liveForSource.savedAt : DEMO.generatedAt

  const dataset =
    source === 'hard'
      ? hardItems.map((it, i) => ({ id: `H${i + 1}`, prompt: it.prompt }))
      : BENCHMARK.map((b) => ({ id: b.id, prompt: b.prompt }))

  async function runAll() {
    setRunning(true)
    setLiveRows([])
    setProgress(0)
    const principles = flattenEnabled(dims)
    const out = []
    for (let i = 0; i < dataset.length; i++) {
      const b = dataset[i]
      try {
        const r = await runPipeline(b.prompt, principles, dims)
        out.push({ id: b.id, prompt: b.prompt, before: r.rawScores, after: r.revisedScores })
      } catch (e) {
        out.push({ id: b.id, prompt: b.prompt, before: {}, after: {}, error: String(e.message || e) })
      }
      setProgress(i + 1)
      setLiveRows([...out])
    }
    setRunning(false)
    setLiveRows(null)
    const next = { ...live, [source]: { rows: out, savedAt: new Date().toISOString() } }
    setLive(next)
    try {
      localStorage.setItem('vc_dash_v2', JSON.stringify(next))
    } catch {}
  }

  // 聚合每个维度的平均分
  const aggBefore = {}
  const aggAfter = {}
  for (const d of enabledDims) {
    aggBefore[d.id] = avg(rows.map((r) => r.before[d.id] ?? 0))
    aggAfter[d.id] = avg(rows.map((r) => r.after[d.id] ?? 0))
  }
  const overallBefore = avg(rows.map((r) => overall(r.before)))
  const overallAfter = avg(rows.map((r) => overall(r.after)))

  return (
    <div>
      <div className="panel">
        <h2>评估面板</h2>
        <p className="hint">
          对所选题集批量运行对齐流水线，量化「对齐前 vs 对齐后」的整体价值得分变化。
          困难集来自「②困难数据集」页的构建结果（更能看出对齐效果）。
        </p>
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="muted">评估题集：</span>
          <label className="row" style={{ gap: 6 }}>
            <input type="radio" checked={source === 'benchmark'} onChange={() => setSource('benchmark')} />
            内置基准（{BENCHMARK.length} 道普通题）
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input
              type="radio"
              checked={source === 'hard'}
              onChange={() => setSource('hard')}
              disabled={!hardItems.length}
            />
            困难集（{hardItems.length} 道）{!hardItems.length && '（请先在②构建）'}
          </label>
        </div>
        <div className="row">
          <button className="primary" onClick={runAll} disabled={running || !dataset.length}>
            {running ? `运行中 ${progress}/${dataset.length}…` : `运行评估（${dataset.length} 题）`}
          </button>
          {running && <span className="spinner">逐题运行中，请稍候</span>}
        </div>
        {savedAt && !running && (
          <p className="hint" style={{ marginTop: 8 }}>
            {isDemo
              ? `📌 当前显示作者真实 API 跑出的示例评估结果（${new Date(savedAt).toLocaleString()}）。点"运行评估"可用 API 重跑本题集。`
              : `✓ 显示的是你上次的评估结果（${new Date(savedAt).toLocaleString()}），切换标签不会丢失。`}
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <div className="panel">
            <h2>整体结果</h2>
            <div className="kpi" style={{ marginBottom: 16 }}>
              <div className="box">
                <div className="num" style={{ color: 'var(--bad)' }}>{overallBefore.toFixed(2)}</div>
                <div className="lab">对齐前平均分 / 2</div>
              </div>
              <div className="box">
                <div className="num" style={{ color: 'var(--good)' }}>{overallAfter.toFixed(2)}</div>
                <div className="lab">对齐后平均分 / 2</div>
              </div>
              <div className="box">
                <div className="num" style={{ color: 'var(--accent)' }}>
                  +{(overallAfter - overallBefore).toFixed(2)}
                </div>
                <div className="lab">提升</div>
              </div>
            </div>
            <div className="radar-wrap">
              <Radar dims={enabledDims} before={aggBefore} after={aggAfter} />
              <div className="legend">
                <div><span className="dot" style={{ background: '#e05a5a' }} />对齐前（各维度均分）</div>
                <div><span className="dot" style={{ background: '#3ca37a' }} />对齐后（各维度均分）</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <h2>逐题明细</h2>
            <table>
              <thead>
                <tr>
                  <th>题</th>
                  <th>问题</th>
                  <th>对齐前</th>
                  <th>对齐后</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const b = overall(r.before)
                  const a = overall(r.after)
                  const d = a - b
                  return (
                    <tr key={r.id}>
                      <td className="muted">{r.id}</td>
                      <td>{r.prompt.slice(0, 26)}…</td>
                      <td style={{ color: 'var(--bad)' }}>{b.toFixed(2)}</td>
                      <td style={{ color: 'var(--good)' }}>{a.toFixed(2)}</td>
                      <td className={d >= 0 ? 'delta-up' : 'delta-down'}>
                        {d >= 0 ? '+' : ''}
                        {d.toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
