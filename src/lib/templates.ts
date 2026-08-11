export interface ChapterTemplateField {
  label: string
  emoji?: string
  placeholder?: string
}

export interface ChapterTemplate {
  id: string
  name: string
  desc: string
  category?: string
  fields?: ChapterTemplateField[]
  content: string
}

const D = String.fromCharCode(36) + String.fromCharCode(36)

export const CHAPTER_TEMPLATES: ChapterTemplate[] = [
  {
    id: 'standard',
    name: '标准笔记',
    desc: '学习目标 / 核心知识点 / 例题 / 易错点 / 总结',
    category: '通用',
    fields: [
      { label: '学习目标', emoji: '🎯', placeholder: '这一节学完要学会什么' },
      { label: '核心知识点', emoji: '📖', placeholder: '逐条列出知识点' },
      { label: '例题', emoji: '✍️', placeholder: '题目与解答' },
      { label: '易错点', emoji: '⚠️', placeholder: '容易踩的坑' },
      { label: '总结', emoji: '📝', placeholder: '一句话回顾' },
    ],
    content: '# 章节标题\n\n## 🎯 学习目标\n\n- \n\n## 📖 核心知识点\n\n- \n\n## ✍️ 例题\n\n### 例 1\n\n**题目**：\n\n**解答**：\n\n## ⚠️ 易错点\n\n- \n\n## 📝 总结\n\n',
  },
  {
    id: 'formula',
    name: '公式 / 定理笔记',
    desc: '内置 LaTeX 公式骨架',
    category: '理科',
    fields: [
      { label: '重要公式', emoji: '🔑', placeholder: D + '\n\\text{公式}\n' + D },
      { label: '定理', emoji: '📐', placeholder: '定理内容与证明要点' },
      { label: '常用结论', emoji: '🧮', placeholder: '可推导出的结论' },
    ],
    content: '# 章节标题\n\n## 🔑 重要公式\n\n' + D + '\n\\text{示例公式：}\n\\int_a^b f(x)\\,dx\n' + D + '\n\n## 📐 定理\n\n**定理内容**：\n\n**证明要点**：\n\n## 🧮 常用结论\n\n- \n\n',
  },
  {
    id: 'concept',
    name: '概念 / 定义卡',
    desc: '定义 / 理解要点 / 关联概念 / 例子',
    category: '通用',
    fields: [
      { label: '定义', emoji: '🏷️', placeholder: '严格定义' },
      { label: '理解要点', emoji: '💡', placeholder: '用自己的话解释' },
      { label: '例子', emoji: '📌', placeholder: '最典型的例子' },
      { label: '关联概念', emoji: '🔗', placeholder: '它和谁有关' },
    ],
    content: '# 章节标题\n\n## 🏷️ 定义\n\n- \n\n## 💡 理解要点\n\n- \n\n## 📌 例子\n\n- \n\n## 🔗 关联概念\n\n- \n\n',
  },
  {
    id: 'outline',
    name: '章节大纲 / 思维导图',
    desc: '先搭结构，再逐点展开',
    category: '通用',
    fields: [
      { label: '章节结构', emoji: '🗂️', placeholder: '一二三级标题骨架' },
      { label: '分点展开', emoji: '🧩', placeholder: '每个部分的核心内容' },
      { label: '逻辑关系', emoji: '🔗', placeholder: '各部分如何串联' },
    ],
    content: '# 章节标题\n\n## 🗂️ 章节结构\n\n1. \n2. \n3. \n\n## 🧩 分点展开\n\n### 1\n\n- \n\n### 2\n\n- \n\n## 🔗 逻辑关系\n\n- \n\n',
  },
  {
    id: 'mistake',
    name: '错题本',
    desc: '题目 / 错误原因 / 正确解法 / 反思',
    category: '应试',
    fields: [
      { label: '题目', emoji: '📄', placeholder: '完整题目' },
      { label: '错误解答与原因', emoji: '❌', placeholder: '当时怎么错的' },
      { label: '正确解法', emoji: '✅', placeholder: '标准解法' },
      { label: '反思', emoji: '💡', placeholder: '下次如何避免' },
    ],
    content: '# 错题：\n\n## 📄 题目\n\n## ❌ 错误解答与原因\n\n## ✅ 正确解法\n\n## 💡 反思\n\n',
  },
  {
    id: 'language',
    name: '外语学习',
    desc: '生词 / 句型 / 例句 / 易混点',
    category: '外语',
    fields: [
      { label: '生词与短语', emoji: '🔤', placeholder: '词、释义、例句' },
      { label: '句型 / 语法', emoji: '🧩', placeholder: '句式结构与用法' },
      { label: '易混点', emoji: '⚠️', placeholder: '形近/义近词辨析' },
      { label: '复习提示', emoji: '📝', placeholder: '哪些词需要反复记' },
    ],
    content: '# 章节标题\n\n## 🔤 生词与短语\n\n- **词**：\n  - 释义：\n  - 例句：\n\n## 🧩 句型 / 语法\n\n- \n\n## ⚠️ 易混点\n\n- \n\n## 📝 复习提示\n\n- \n',
  },
  {
    id: 'essay',
    name: '论述 / 作文',
    desc: '论点 / 论据 / 结构 / 关键表达',
    category: '文科',
    fields: [
      { label: '核心论点', emoji: '💬', placeholder: '你主张什么' },
      { label: '论据与素材', emoji: '📚', placeholder: '支撑材料' },
      { label: '结构提纲', emoji: '🧱', placeholder: '开头-正文-结尾' },
      { label: '关键表达', emoji: '✍️', placeholder: '好词好句' },
    ],
    content: '# 章节标题\n\n## 💬 核心论点\n\n- \n\n## 📚 论据与素材\n\n- \n\n## 🧱 结构提纲\n\n- \n\n## ✍️ 关键表达\n\n- \n',
  },
  {
    id: 'reading',
    name: '读书笔记',
    desc: '核心内容 / 我的理解 / 可引用观点 / 行动启发',
    category: '文科',
    fields: [
      { label: '核心内容', emoji: '📚', placeholder: '这本书/文章讲了什么' },
      { label: '我的理解', emoji: '💭', placeholder: '我的解读与评价' },
      { label: '可引用观点', emoji: '🗣️', placeholder: '金句与出处' },
      { label: '行动启发', emoji: '✨', placeholder: '看完想做什么' },
    ],
    content: '# 章节标题\n\n## 📚 核心内容\n\n- \n\n## 💭 我的理解\n\n- \n\n## 🗣️ 可引用观点\n\n> \n\n## ✨ 行动启发\n\n- \n',
  },
  {
    id: 'timeline',
    name: '历史 / 时间线',
    desc: '时间 / 事件 / 因果 / 影响',
    category: '文科',
    fields: [
      { label: '时间', emoji: '📅', placeholder: '年代' },
      { label: '事件', emoji: '🏛️', placeholder: '发生了什么' },
      { label: '因果', emoji: '🧭', placeholder: '前因后果' },
      { label: '影响', emoji: '📌', placeholder: '对后世的影响' },
    ],
    content: '# 章节标题\n\n## 📅 时间\n\n- \n\n## 🏛️ 事件\n\n- \n\n## 🧭 因果\n\n- \n\n## 📌 影响\n\n- \n',
  },
  {
    id: 'experiment',
    name: '实验 / 实践记录',
    desc: '目的 / 步骤 / 数据 / 结论',
    category: '理科',
    fields: [
      { label: '目的', emoji: '🧪', placeholder: '要验证什么' },
      { label: '步骤', emoji: '🛠️', placeholder: '操作流程' },
      { label: '数据与结果', emoji: '📊', placeholder: '观测数据' },
      { label: '结论与反思', emoji: '💬', placeholder: '结果说明了什么' },
    ],
    content: '# 章节标题\n\n## 🧪 目的\n\n- \n\n## 🛠️ 步骤\n\n1. \n2. \n3. \n\n## 📊 数据与结果\n\n- \n\n## 💬 结论与反思\n\n- \n',
  },
  {
    id: 'code',
    name: '编程 / 算法笔记',
    desc: '思路 / 代码 / 复杂度 / 坑点',
    category: '其他',
    fields: [
      { label: '思路', emoji: '🧠', placeholder: '解题/实现思路' },
      { label: '代码', emoji: '💻', placeholder: '代码块' },
      { label: '复杂度', emoji: '⏱️', placeholder: '时间/空间' },
      { label: '坑点', emoji: '⚠️', placeholder: '边界与易错' },
    ],
    content: '# 章节标题\n\n## 🧠 思路\n\n- \n\n## 💻 代码\n\n' + '```' + '\n// TODO\n' + '```' + '\n\n## ⏱️ 复杂度\n\n- 时间：\n- 空间：\n\n## ⚠️ 坑点\n\n- \n',
  },
  {
    id: 'blank',
    name: '空白章节',
    desc: '从零开始',
    category: '通用',
    fields: [],
    content: '# 章节标题\n\n',
  },
]

export function templatesByCategory(list: ChapterTemplate[]): { category: string; items: ChapterTemplate[] }[] {
  const order = ['通用', '理科', '文科', '外语', '应试', '其他', '自定义']
  const groups: { category: string; items: ChapterTemplate[] }[] = []
  for (const cat of order) {
    const items = list.filter(function (t) { return (t.category || '自定义') === cat })
    if (items.length > 0) groups.push({ category: cat, items: items })
  }
  return groups
}

export function buildTemplateContent(fields: ChapterTemplateField[]): string {
  let out = '# 章节标题\n\n'
  for (const f of fields) {
    out += '## ' + (f.emoji ? f.emoji + ' ' : '') + (f.label || '未命名') + '\n\n'
    out += '- ' + (f.placeholder || '') + '\n\n'
  }
  return out
}
