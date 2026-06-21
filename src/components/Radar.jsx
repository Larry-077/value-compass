// 纯 SVG 雷达图：对比「对齐前」与「对齐后」在各价值维度的得分（0-2）
export default function Radar({ dims, before, after, size = 260 }) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 40
  const max = 2
  const n = dims.length
  if (n < 3) return <div className="muted">维度不足（雷达图需至少 3 个启用维度）</div>

  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2
  const point = (i, val) => {
    const rr = (val / max) * r
    return [cx + rr * Math.cos(angle(i)), cy + rr * Math.sin(angle(i))]
  }
  const polygon = (vals) => vals.map((v, i) => point(i, v).join(',')).join(' ')

  const beforeVals = dims.map((d) => before[d.id] ?? 0)
  const afterVals = dims.map((d) => after[d.id] ?? 0)
  const grid = [0.5, 1, 1.5, 2]

  return (
    <svg width={size} height={size}>
      {grid.map((g, gi) => (
        <polygon
          key={gi}
          points={polygon(dims.map(() => g))}
          fill="none"
          stroke="#e4e4e7"
          strokeWidth="1"
        />
      ))}
      {dims.map((d, i) => {
        const [x, y] = point(i, max)
        const [lx, ly] = point(i, max + 0.45)
        return (
          <g key={d.id}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#e4e4e7" strokeWidth="1" />
            <text x={lx} y={ly} fontSize="12" fill="#71717a" textAnchor="middle" dominantBaseline="middle">
              {d.name}
            </text>
          </g>
        )
      })}
      <polygon points={polygon(beforeVals)} fill="rgba(168,85,79,.14)" stroke="#a8554f" strokeWidth="2" />
      <polygon points={polygon(afterVals)} fill="rgba(77,122,99,.18)" stroke="#4d7a63" strokeWidth="2" />
    </svg>
  )
}
