import { useEffect, useState } from 'react'
import { loadHandbook, saveHandbook, resetHandbook } from './lib/storage.js'
import { getHealth } from './lib/api.js'
import Overview from './components/Overview.jsx'
import GuideHeader from './components/GuideHeader.jsx'
import HandbookEditor from './components/HandbookEditor.jsx'
import Playground from './components/Playground.jsx'
import BestOfN from './components/BestOfN.jsx'
import RewardModel from './components/RewardModel.jsx'
import RedTeam from './components/RedTeam.jsx'
import Dashboard from './components/Dashboard.jsx'
import UserStudy from './components/UserStudy.jsx'

const TABS = [
  { id: 'overview', name: '⓪ 项目导览' },
  { id: 'handbook', name: '① 价值手册' },
  { id: 'redteam', name: '② 困难数据集' },
  { id: 'play', name: '③ 对齐 Playground' },
  { id: 'bestofn', name: '④ Best-of-N' },
  { id: 'rm', name: '⑤ Reward Model' },
  { id: 'dash', name: '⑥ 评估面板' },
  { id: 'study', name: '⑦ 用户调研' },
]

// 每页的引导头：这一步做什么 / 你要做什么 / 体现贡献 / 下一步
const GUIDE = {
  handbook: {
    step: '① 价值手册',
    what: '把伦理价值编码成可读、带出处、带评分细则的机器可读条目。',
    todo: '浏览 5 个维度 13 条原则；可改权重、启停某条做对照实验。',
    contrib: 'C3 透明可编辑（出处溯源 UDHR/法规 + 评分 rubric）',
    nextTab: 'redteam', nextLabel: '② 构建困难数据集',
  },
  redteam: {
    step: '② 困难数据集',
    what: '用 4 类加压技术把题目变难，跑生成器→评审，筛出"翻车"题。',
    todo: '勾选加压技术 → 点"构建" → 看各技术翻车率（结果会自动保存）。',
    contrib: 'C1 困难数据集 + 构建方法学（核心贡献）',
    nextTab: 'play', nextLabel: '③ 看单题对齐',
  },
  play: {
    step: '③ 对齐 Playground',
    what: '单题看「弱模型原始 → 强评审批评 → 修订」三栏对比 + 评分雷达。',
    todo: '在快速选题里挑一道困难题运行；给"对齐前/后"投票（投票会成为⑤的训练数据）。',
    contrib: 'C2 对齐框架（宪法式自我批评-修订）',
    nextTab: 'bestofn', nextLabel: '④ Best-of-N',
  },
  bestofn: {
    step: '④ Best-of-N',
    what: '对同一题采样 N 个候选，用价值奖励选最优（推理期 RLHF）。',
    todo: '选一道困难题、设 N → 运行 → 看"价值分 vs N"曲线；可记一条偏好。',
    contrib: 'C2 对齐框架（用奖励对齐）',
    nextTab: 'rm', nextLabel: '⑤ Reward Model',
  },
  rm: {
    step: '⑤ Reward Model',
    what: '在③④收集的人类偏好上训练 Bradley-Terry 奖励模型。',
    todo: '先在③④多投几次票，再来点"训练"，对比学到的权重 vs 手设权重，可写回手册。',
    contrib: 'C2 对齐框架（从人类反馈学价值权重，RLHF 核心）',
    nextTab: 'dash', nextLabel: '⑥ 评估面板',
  },
  dash: {
    step: '⑥ 评估面板',
    what: '对所选题集批量跑对齐，量化"对齐前 vs 后"整体价值得分。',
    todo: '分别选「内置基准」与「困难集」运行，对比——普通题高、困难题低且对齐提升明显。',
    contrib: 'C1+C2 的量化结论（结果自动保存）',
    nextTab: 'study', nextLabel: '⑦ 用户调研',
  },
  study: {
    step: '⑦ 用户调研',
    what: '汇总所有投票：更认可对齐前/后、可信度、有用度。',
    todo: '找几位同学在③投票，这里看汇总统计。',
    contrib: '初步使用反馈（加分项）',
    nextTab: null,
  },
}

export default function App() {
  const [tab, setTab] = useState('overview')
  const [dims, setDims] = useState(loadHandbook)
  const [health, setHealth] = useState(null)

  useEffect(() => {
    saveHandbook(dims)
  }, [dims])

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth({ usingRealApi: false, model: '?' }))
  }, [])

  const guide = GUIDE[tab]

  return (
    <div className="app">
      <header className="top">
        <h1>🧭 价值罗盘 ValueCompass</h1>
        <span className="sub">价值手册驱动的大模型对齐工具 · 伦理设计课程项目</span>
        {health && (
          <span className={`badge ${health.usingRealApi ? 'real' : 'mock'}`}>
            {health.usingRealApi ? `真实模型 · ${health.model}` : 'Mock 演示模式（未配置 API Key）'}
          </span>
        )}
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.name}
          </button>
        ))}
      </nav>

      {guide && <GuideHeader {...guide} onNav={setTab} />}

      {tab === 'overview' && <Overview onNav={setTab} />}
      {tab === 'redteam' && <RedTeam dims={dims} />}
      {tab === 'play' && <Playground dims={dims} />}
      {tab === 'bestofn' && <BestOfN dims={dims} />}
      {tab === 'rm' && <RewardModel dims={dims} setDims={setDims} />}
      {tab === 'handbook' && (
        <HandbookEditor dims={dims} setDims={setDims} onReset={() => setDims(resetHandbook())} />
      )}
      {tab === 'dash' && <Dashboard dims={dims} />}
      {tab === 'study' && <UserStudy />}
    </div>
  )
}
