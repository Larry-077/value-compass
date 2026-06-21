// 价值手册编辑器：增删改 / 启停 / 调权重
import { useState } from 'react'

export default function HandbookEditor({ dims, setDims, onReset }) {
  const [editing, setEditing] = useState(null) // {dimId, pid} or null

  function update(dimId, pid, patch) {
    setDims((prev) =>
      prev.map((d) =>
        d.id !== dimId
          ? d
          : { ...d, principles: d.principles.map((p) => (p.id === pid ? { ...p, ...patch } : p)) },
      ),
    )
  }

  function addPrinciple(dimId) {
    const pid = `${dimId}-custom-${Date.now().toString(36)}`
    setDims((prev) =>
      prev.map((d) =>
        d.id !== dimId
          ? d
          : { ...d, principles: [...d.principles, { id: pid, statement: '新的价值原则……', weight: 3, enabled: true }] },
      ),
    )
    setEditing({ dimId, pid })
  }

  function removePrinciple(dimId, pid) {
    setDims((prev) =>
      prev.map((d) => (d.id !== dimId ? d : { ...d, principles: d.principles.filter((p) => p.id !== pid) })),
    )
  }

  const enabledCount = dims.reduce((a, d) => a + d.principles.filter((p) => p.enabled).length, 0)

  return (
    <div className="panel">
      <h2>价值手册编辑器</h2>
      <p className="hint">
        把伦理价值「编码」成机器可读的原则。启用 {enabledCount} 条原则将注入到模型的自我批评与评分中。
        关闭某些原则可做对照实验，观察对齐效果的变化。
      </p>

      {dims.map((dim) => (
        <div className="dim" key={dim.id}>
          <div className="dim-head">
            <span className="dim-dot" style={{ background: dim.color }} />
            <strong>
              {dim.name} <span className="muted">/ {dim.en}</span>
            </strong>
            <span className="desc">{dim.desc}</span>
            <button className="ghost" style={{ marginLeft: 'auto' }} onClick={() => addPrinciple(dim.id)}>
              + 加原则
            </button>
          </div>
          {dim.rubric && (
            <div className="rubric">
              <span className="rubric-lab">评分细则</span>
              <span><b>2</b> {dim.rubric[2]}</span>
              <span><b>1</b> {dim.rubric[1]}</span>
              <span><b>0</b> {dim.rubric[0]}</span>
            </div>
          )}
          {dim.principles.map((p) => (
            <div className={`principle ${p.enabled ? '' : 'off'}`} key={p.id}>
              <input
                type="checkbox"
                checked={p.enabled}
                onChange={(e) => update(dim.id, p.id, { enabled: e.target.checked })}
              />
              <div className="stmt">
                {editing && editing.pid === p.id ? (
                  <textarea
                    autoFocus
                    rows={2}
                    value={p.statement}
                    onChange={(e) => update(dim.id, p.id, { statement: e.target.value })}
                    onBlur={() => setEditing(null)}
                  />
                ) : (
                  <div onClick={() => setEditing({ dimId: dim.id, pid: p.id })} style={{ cursor: 'text' }}>
                    {p.statement}
                  </div>
                )}
                <div className="pid">{p.id}</div>
                {p.source && <div className="src">📖 依据：{p.source}</div>}
              </div>
              <div className="row">
                <label className="muted" style={{ fontSize: 12 }}>权重</label>
                <select
                  className="wsel"
                  value={p.weight}
                  onChange={(e) => update(dim.id, p.id, { weight: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5].map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
                <button className="ghost" onClick={() => removePrinciple(dim.id, p.id)}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      <button className="ghost" onClick={onReset}>
        恢复默认手册
      </button>
    </div>
  )
}
