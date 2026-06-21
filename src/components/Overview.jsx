// ⓪ 项目导览：讲清"这网站在表达什么、你要做什么"——探索思考journey + 三项贡献
const JOURNEY = [
  { n: 1, t: '问题 · 价值对齐是黑箱', d: '传统 RLHF / 宪法式 AI 的价值不可编辑、不可度量。', tag: '' },
  { n: 2, t: '设想 · 把价值编码成可编辑手册', d: '让价值显式、有出处、可调权重。', tag: '① 价值手册 · C3' },
  { n: 3, t: '受挫 · 普通题测不出不对齐', d: '实测连小模型在明显题上也已对齐，没有差距可评估。', tag: '' },
  { n: 4, t: '关键转向 · 构建困难数据集让模型翻车', d: '用 4 类加压技术把题目变难，以翻车率量化。', tag: '② 困难数据集 · C1 核心', key: true },
  { n: 5, t: '对齐 · 手册作奖励 + 从人类反馈学权重', d: '自我批评 / Best-of-N / 训练 reward model。', tag: '③④⑤ · C2' },
  { n: 6, t: '度量 · 困难集上量化对齐前后', d: '对比对齐前后整体价值得分 + 用户调研。', tag: '⑥⑦ · C3' },
]

const CONTRIB = [
  { id: 'C1', t: '困难数据集 + 构建方法学', d: '用加压技术构造能让对齐模型翻车的"价值压力测试集"，并以翻车率实验量化——这是核心贡献。' },
  { id: 'C2', t: '价值手册→奖励的对齐框架', d: '把可编辑手册构造成奖励信号：自我批评-修订、Best-of-N、从人类偏好学习价值权重（RLHF 核心）。' },
  { id: 'C3', t: '透明可参与的伦理设计', d: '价值可编辑、出处可溯（UDHR/法规）、评分有据（rubric）、结果可度量。' },
]

export default function Overview({ onNav }) {
  return (
    <div>
      <div className="panel">
        <h2>这是什么</h2>
        <p className="hint">
          ValueCompass 是一个<strong>把"AI 价值对齐"做成可交互、可视化、可度量的系统</strong>（不是聊天机器人）。
          你写一份《价值手册》编码伦理价值，系统用它去约束模型、给回答打分、并从人类反馈反过来学习价值权重。
          下面是本项目的<strong>探索思考过程</strong>——顺着 1→6 走，你就知道每一步在做什么。
        </p>
      </div>

      <div className="panel">
        <h2>探索思考流程（点任意一步直接前往）</h2>
        <div className="journey">
          {JOURNEY.map((s) => (
            <div key={s.n} className={`jrow ${s.key ? 'jkey' : ''}`}>
              <div className="jnum">{s.n}</div>
              <div className="jbody">
                <div className="jt">{s.t}</div>
                <div className="jd">{s.d}</div>
              </div>
              {s.tag && <div className="jtag">{s.tag}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>三项贡献</h2>
        <div className="contrib">
          {CONTRIB.map((c) => (
            <div key={c.id} className="cbox">
              <div className="cid">{c.id}</div>
              <div className="ct">{c.t}</div>
              <div className="cd">{c.d}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ textAlign: 'center' }}>
        <p className="hint">建议从第一步开始：先看价值如何被编码，再去构建困难数据集。</p>
        <button className="primary" onClick={() => onNav('handbook')}>从第一步开始：① 价值手册 →</button>
        <button className="ghost" style={{ marginLeft: 10 }} onClick={() => onNav('redteam')}>直接去 ② 构建困难数据集 →</button>
      </div>
    </div>
  )
}
