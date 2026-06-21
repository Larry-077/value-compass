// 用户调研：展示汇总统计 + 提供独立问卷
import { useEffect, useState } from 'react'
import { getStudy, submitStudy } from '../lib/api.js'

function Stars({ value, onChange }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? 'on' : ''} onClick={() => onChange(n)}>
          ★
        </span>
      ))}
    </div>
  )
}

export default function UserStudy() {
  const [data, setData] = useState({ entries: [], stats: { n: 0 } })
  const [trust, setTrust] = useState(0)
  const [helpful, setHelpful] = useState(0)
  const [prefer, setPrefer] = useState('revised')
  const [comment, setComment] = useState('')
  const [done, setDone] = useState(false)

  async function refresh() {
    setData(await getStudy())
  }
  useEffect(() => {
    refresh()
  }, [])

  async function submit() {
    await submitStudy({ source: 'survey', prefer, trust, helpful, comment })
    setDone(true)
    setTrust(0)
    setHelpful(0)
    setComment('')
    refresh()
  }

  const s = data.stats

  return (
    <div>
      <div className="panel">
        <h2>用户调研汇总</h2>
        <p className="hint">收集真实用户对「价值对齐」效果的主观评价，用于验证系统的有效性（课程加分项）。</p>
        {s.n ? (
          <div className="kpi">
            <div className="box">
              <div className="num">{s.n}</div>
              <div className="lab">反馈样本数</div>
            </div>
            <div className="box">
              <div className="num">{Math.round((s.preferRevisedRate || 0) * 100)}%</div>
              <div className="lab">更认可「对齐后」的比例</div>
            </div>
            <div className="box">
              <div className="num">{s.avgTrust ? s.avgTrust.toFixed(1) : '—'}</div>
              <div className="lab">平均可信度 / 5</div>
            </div>
            <div className="box">
              <div className="num">{s.avgHelpful ? s.avgHelpful.toFixed(1) : '—'}</div>
              <div className="lab">平均有用度 / 5</div>
            </div>
          </div>
        ) : (
          <p className="muted">暂无反馈。可在下方填写问卷，或在 Playground 中对结果投票。</p>
        )}
      </div>

      <div className="panel">
        <h2>填写问卷</h2>
        <p className="hint">体验过 Playground 后，请基于「对齐后」的回答整体感受作答。</p>
        <div className="row" style={{ marginBottom: 12 }}>
          <span style={{ width: 160 }}>更认可哪一版回答？</span>
          <label>
            <input type="radio" checked={prefer === 'revised'} onChange={() => setPrefer('revised')} /> 对齐后
          </label>
          <label>
            <input type="radio" checked={prefer === 'raw'} onChange={() => setPrefer('raw')} /> 对齐前
          </label>
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          <span style={{ width: 160 }}>对齐后回答可信吗？</span>
          <Stars value={trust} onChange={setTrust} />
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          <span style={{ width: 160 }}>对齐后回答有用吗？</span>
          <Stars value={helpful} onChange={setHelpful} />
        </div>
        <textarea
          rows={3}
          placeholder="其他意见（可选）"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="primary" onClick={submit}>
            提交反馈
          </button>
          {done && <span className="muted">已提交，谢谢！</span>}
        </div>
      </div>

      {data.entries.length > 0 && (
        <div className="panel">
          <h2>最近反馈</h2>
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>来源</th>
                <th>偏好</th>
                <th>可信</th>
                <th>有用</th>
                <th>意见</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.slice(-12).reverse().map((e, i) => (
                <tr key={i}>
                  <td className="muted">{(e.ts || '').slice(5, 16).replace('T', ' ')}</td>
                  <td>{e.source}</td>
                  <td>{e.prefer === 'revised' ? '对齐后' : e.prefer === 'raw' ? '对齐前' : '—'}</td>
                  <td>{e.trust || '—'}</td>
                  <td>{e.helpful || '—'}</td>
                  <td>{e.comment || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
