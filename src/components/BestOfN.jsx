// Best-of-N 对齐：采样 N 个候选 → 价值手册奖励打分 → 选最优（推理期 RLHF）
import { useEffect, useState } from 'react'
import { flattenEnabled } from '../data/defaultHandbook.js'
import { runBestOfN, submitStudy, getHardDataset } from '../lib/api.js'
import { BENCHMARK } from '../data/benchmark.js'
import { DEMO } from '../data/demo.js'

const RC = (v) => (v >= 1.5 ? 'var(--good)' : v >= 0.8 ? 'var(--warn)' : 'var(--bad)')

// 价值分 vs N 折线（纯 SVG）
function Curve({ curve }) {
  const w = 320
  const h = 140
  const pad = 28
  const n = curve.length
  if (n < 2) return null
  const x = (i) => pad + (i * (w - 2 * pad)) / (n - 1)
  const y = (v) => h - pad - (v / 2) * (h - 2 * pad)
  const pts = curve.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  return (
    <svg width={w} height={h}>
      {[0, 1, 2].map((g) => (
        <g key={g}>
          <line x1={pad} y1={y(g)} x2={w - pad} y2={y(g)} stroke="#e4e4e7" />
          <text x={4} y={y(g) + 4} fontSize="11" fill="#71717a">{g}</text>
        </g>
      ))}
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {curve.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r="3.5" fill="var(--accent)" />
          <text x={x(i)} y={h - 8} fontSize="11" fill="#71717a" textAnchor="middle">{i + 1}</text>
        </g>
      ))}
    </svg>
  )
}

export default function BestOfN({ dims }) {
  const demo0 = DEMO.bestofn?.[0] || null
  const [prompt, setPrompt] = useState(demo0?.prompt || BENCHMARK[5].prompt)
  const [n, setN] = useState(demo0?.n || 4)
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState(demo0)
  const [isDemo, setIsDemo] = useState(!!demo0)
  const [error, setError] = useState(null)
  const [hardItems, setHardItems] = useState([])

  useEffect(() => {
    getHardDataset().then((d) => setHardItems(d.items || [])).catch(() => {})
  }, [])

  const enabledDims = dims.filter((d) => d.principles.some((p) => p.enabled))

  // 选题：内置示例直接显示缓存真实结果；否则填入问题待实时跑
  function pick(val) {
    setPrompt(val)
    setError(null)
    const demo = DEMO.bestofn?.find((b) => b.prompt === val)
    if (demo) {
      setRes(demo)
      setN(demo.n || 4)
      setIsDemo(true)
    }
  }

  async function run() {
    setLoading(true)
    setError(null)
    setRes(null)
    try {
      const principles = flattenEnabled(dims)
      setRes(await runBestOfN(prompt, principles, dims, n))
      setIsDemo(false)
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setLoading(false)
    }
  }

  // 把 best-of-N 的「最差 vs 选中」当作一条偏好对，喂给 reward model 训练
  async function logPref() {
    if (!res) return
    const worst = res.ranked[res.ranked.length - 1]
    await submitStudy({
      source: 'bestofN',
      prompt,
      prefer: 'revised',
      featRevised: res.chosen.scores,
      featRaw: worst.scores,
    })
  }

  return (
    <div>
      <div className="panel">
        <h2>Best-of-N 对齐（推理期 RLHF）</h2>
        <p className="hint">
          对同一问题采样 N 个候选回答，用《价值手册》构造的<strong>奖励</strong> r=Σ w·score 给每个打分，选奖励最高的那个。
          这是不训练策略、仅在推理期用 reward 重排的对齐方式。
        </p>
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="muted">快速选题：</span>
          <select className="wsel" onChange={(e) => pick(e.target.value)} defaultValue={demo0?.prompt || BENCHMARK[5].prompt}>
            {DEMO.bestofn?.length > 0 && (
              <optgroup label="⚡ 示例（秒出·作者真实结果）">
                {DEMO.bestofn.map((b, i) => (
                  <option key={`D${i}`} value={b.prompt}>{b.prompt.slice(0, 20)}…</option>
                ))}
              </optgroup>
            )}
            <optgroup label="内置普通题（点运行实时跑）">
              {BENCHMARK.map((b) => (
                <option key={b.id} value={b.prompt}>{b.id} · {b.prompt.slice(0, 18)}…</option>
              ))}
            </optgroup>
            {hardItems.length > 0 && (
              <optgroup label="困难集（点运行实时跑）">
                {hardItems.map((it, i) => (
                  <option key={`H${i}`} value={it.prompt}>[{it.category}] {it.prompt.slice(0, 16)}…</option>
                ))}
              </optgroup>
            )}
          </select>
          <span className="muted">N=</span>
          <select className="wsel" value={n} onChange={(e) => setN(Number(e.target.value))}>
            {[2, 3, 4, 6, 8].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="primary" onClick={run} disabled={loading}>
            {loading ? `采样并评分中…（${n} 个候选）` : '运行 Best-of-N'}
          </button>
          {loading && <span className="spinner">真实模型需为每个候选各做一次生成+评分，约需 30 秒以上，请耐心等待</span>}
          {error && <span style={{ color: 'var(--bad)' }}>错误：{error}</span>}
        </div>
        {isDemo && res && (
          <p className="hint" style={{ marginTop: 8 }}>📌 当前为作者真实 API 跑出的示例结果。改输入并点"运行 Best-of-N"即重跑。</p>
        )}
      </div>

      {res && (
        <>
          <div className="panel">
            <h2>价值分 vs N</h2>
            <p className="hint">前 k 个候选里的最高奖励——若随 N 上升，说明奖励信号能筛出更对齐的回答。</p>
            <Curve curve={res.curve} />
          </div>

          <div className="panel">
            <h2>候选回答（按奖励排序）</h2>
            {res.ranked.map((c, idx) => (
              <div
                key={c.i}
                className="answer"
                style={{
                  marginBottom: 10,
                  borderLeft: `3px solid ${idx === 0 ? 'var(--good)' : 'var(--border)'}`,
                }}
              >
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="tag">
                    {idx === 0 ? '✅ 选中（奖励最高）' : `候选 #${c.i + 1}`}
                  </span>
                  <span style={{ color: RC(c.reward), fontWeight: 600 }}>
                    奖励 {c.reward.toFixed(2)} / 2
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0' }}>
                  {enabledDims.map((d) => `${d.name}:${c.scores[d.id] ?? 0}`).join('  ')}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{c.text.slice(0, 280)}{c.text.length > 280 ? '…' : ''}</div>
              </div>
            ))}
            <button className="ghost" onClick={logPref}>把「选中 vs 最低」记为一条偏好（供训练 reward model）</button>
          </div>
        </>
      )}
    </div>
  )
}
