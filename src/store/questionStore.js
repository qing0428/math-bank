const STORAGE_KEY = 'mathQuestions'

export const GRADES = [
  '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
  '七年级', '八年级', '九年级',
  '高一', '高二', '高三',
]

export const TOPICS = [
  '数与代数', '图形与几何', '统计与概率', '综合与实践',
  '集合与逻辑', '函数', '三角函数', '数列', '不等式',
  '平面向量', '立体几何', '解析几何', '导数与微积分',
  '排列组合', '概率', '统计', '复数', '算法初步',
]

export const QUESTION_TYPES = {
  elementary: ['填空题', '选择题', '判断题', '计算题', '画图题', '解决问题'],
  middle: ['选择题', '填空题', '解答题', '计算题', '证明题'],
  high: ['选择题', '填空题', '解答题', '计算题', '证明题'],
}

export function getQuestionTypesForGrade(grade) {
  const elem = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级']
  const mid = ['七年级', '八年级', '九年级']
  if (elem.includes(grade)) return QUESTION_TYPES.elementary
  if (mid.includes(grade)) return QUESTION_TYPES.middle
  if (grade) return QUESTION_TYPES.high
  // No grade selected — return all unique types
  return [...new Set([...QUESTION_TYPES.elementary, ...QUESTION_TYPES.middle, ...QUESTION_TYPES.high])]
}

export function createQuestion(data = {}) {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    content: data.content || '',
    answer: data.answer || '',
    solution: data.solution || '',
    grade: data.grade || '',
    topic: data.topic || '',
    questionType: data.questionType || '',
    difficulty: data.difficulty || 3,
    tags: data.tags || [],
    notes: data.notes || '',
    examName: data.examName || '',
    imageUrl: data.imageUrl || '',
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  }
}

export function loadQuestions() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function saveQuestions(questions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(questions))
}

export function exportToJSON(questions) {
  const blob = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `math-questions-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (Array.isArray(data)) {
          resolve(data)
        } else {
          reject(new Error('Invalid format: expected array'))
        }
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export function getStats(questions) {
  const today = new Date().toISOString().slice(0, 10)
  const total = questions.length
  const todayNew = questions.filter(q => {
    const d = new Date(q.createdAt).toISOString().slice(0, 10)
    return d === today
  }).length
  const todayModified = questions.filter(q => {
    const d = new Date(q.updatedAt).toISOString().slice(0, 10)
    return d === today
  }).length
  const avgDifficulty = total > 0
    ? (questions.reduce((sum, q) => sum + (q.difficulty || 0), 0) / total).toFixed(1)
    : '0.0'

  // Tag frequency
  const tagCount = {}
  questions.forEach(q => {
    ;(q.tags || []).forEach(t => {
      tagCount[t] = (tagCount[t] || 0) + 1
    })
  })
  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag, count]) => ({ tag, count }))

  return { total, todayNew, todayModified, avgDifficulty, topTags }
}
