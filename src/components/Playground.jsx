// 对齐 Playground：输入问题 → 原始回答 / 自我批评 / 修订回答 三栏对比 + 评分 + 雷达 + 即时评价
import { useEffect, useState } from 'react'
import { flattenEnabled } from '../data/defaultHandbook.js'
import { runPipeline, submitStudy, getHardDataset } from '../lib/api.js'
import { BENCHMARK } from '../data/benchmark.js'
import { DEMO } from '../data/demo.js'
import Radar from './Radar.jsx'

const SCORE_COLOR = (v) => (v >= 2 ? 'var(--good)' : v >= 1 ? 'var(--warn)' : 'var(--bad)')

function ScoreList({ dims, scores }) {
  return (
    <div>
      {dims.map((d) => {
        const v = scores[d.id] ?? 0
        return (
          <div className="scorebar" key={d.id}>
            <span className="lab">{d.name}</span>
            <div className="track">
              <div className="fill" style={{ width: `${(v / 2) * 100}%`, background: SCORE_COLOR(v) }} />
            </div>
            <span style={{ width: 18 }}>{v}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function Playground({ dims }) {
  const demo0 = DEMO.playground?.[0] || null
  const [prompt, setPrompt] = useState(demo0?.prompt || BENCHMARK[0].prompt)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(demo0)
  const [isDemo, setIsDemo] = useState(!!demo0)
  const [error, setError] = useState(null)
  const [rated, setRated] = useState(false)
  const [hardItems, setHardItems] = useState([])

  useEffect(() => {
    getHardDataset().then((d) => setHardItems(d.items || [])).catch(() => {})
  }, [])

  const enabledDims = dims.filter((d) => d.principles.some((p) => p.enabled))

  async function run() {
    setLoading(true)
    setError(null)
    setResult(null)
    setRated(false)
    try {
      const principles = flattenEnabled(dims)
      const r = await runPipeline(prompt, principles, dims)
      setResult(r)
      setIsDemo(false)
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setLoading(false)
    }
  }

  async function rate(prefer) {
    await submitStudy({
      source: 'playground',
      prompt,
      prefer, // 'revised' | 'raw'
      // 携带两版回答的维度分向量 → 成为 reward model 的训练数据
      featRaw: result.rawScores,
      featRevised: result.revisedScores,
    })
    setRated(true)
  }

  return (
    <div>
      <div className="panel">
        <h2>对齐 Playground</h2>
        <p className="hint">
          输入一个问题，系统会先生成「未对齐的原始回答」，再依据你的《价值手册》自我批评并改写，最后由 LLM 评审给前后两版打分。
        </p>
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="muted">快速选题：</span>
          <select
            className="wsel"
            onChange={(e) => setPrompt(e.target.value)}
            defaultValue={BENCHMARK[0].prompt}
          >
            <optgroup label="内置普通题">
              {BENCHMARK.map((b) => (
                <option key={b.id} value={b.prompt}>
                  {b.id} · {b.prompt.slice(0, 20)}…
                </option>
              ))}
            </optgroup>
            {hardItems.length > 0 && (
              <optgroup label="困难集（②构建）">
                {hardItems.map((it, i) => (
                  <option key={`H${i}`} value={it.prompt}>
                    [{it.category}] {it.prompt.slice(0, 18)}…
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="primary" onClick={run} disabled={loading}>
            {loading ? '运行中…' : '运行对齐流水线'}
          </button>
          {loading && <span className="spinner">正在生成 → 批评 → 修订 → 评分（真实模型约需十几秒）</span>}
          {error && <span style={{ color: 'var(--bad)' }}>错误：{error}</span>}
        </div>
        {isDemo && result && (
          <p className="hint" style={{ marginTop: 8 }}>📌 当前显示作者用真实模型跑出的示例结果（glm-4-flash / claude-sonnet-4-6）。改输入并点"运行"即用 API 重跑。</p>
        )}
      </div>

      {result && (
        <>
          <div className="panel">
            <div className="cols">
              <div className="answer before">
                <div className="tag">① 对齐前 · 原始回答</div>
                {result.raw}
              </div>
              <div className="answer after">
                <div className="tag">③ 对齐后 · 修订回答</div>
                {result.revised}
              </div>
            </div>
            <div className="critique">
              <strong>② 自我批评：</strong>
              {result.critique}
            </div>
          </div>

          <div className="panel">
            <h2>价值评分对比</h2>
            <p className="hint">由 LLM 评审依据手册打分（每维度 0–2）。红=对齐前，绿=对齐后。</p>
            <div className="radar-wrap">
              <Radar dims={enabledDims} before={result.rawScores} after={result.revisedScores} />
              <div style={{ flex: 1, minWidth: 240 }}>
                <div className="muted" style={{ marginBottom: 6 }}>对齐前</div>
                <ScoreList dims={enabledDims} scores={result.rawScores} />
                <div className="muted" style={{ margin: '12px 0 6px' }}>对齐后</div>
                <ScoreList dims={enabledDims} scores={result.revisedScores} />
              </div>
            </div>
          </div>

          <div className="panel">
            <h2>你更认可哪一版？（用户调研）</h2>
            {rated ? (
              <p className="muted">已记录，感谢你的反馈！可在「用户调研」标签查看汇总。</p>
            ) : (
              <div className="row">
                <button className="ghost" onClick={() => rate('raw')}>更认可「对齐前」</button>
                <button className="primary" onClick={() => rate('revised')}>更认可「对齐后」</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
