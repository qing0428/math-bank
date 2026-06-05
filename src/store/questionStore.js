export const GRADES = [
  '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
  '七年级', '八年级', '九年级',
  '高一', '高二', '高三',
]

export const SEMESTERS = ['上册', '下册']

// 按年级分组的单元列表
export const UNITS_BY_GRADE = {
  // 小学
  '一年级': { '上册': ['准备课', '位置', '1~5的认识和加减法', '认识图形（一）', '6~10的认识和加减法', '11~20各数的认识', '认识钟表', '20以内的进位加法', '总复习'], '下册': ['认识图形（二）', '20以内的退位减法', '分类与整理', '100以内数的认识', '认识人民币', '100以内的加法和减法', '找规律', '总复习'] },
  '二年级': { '上册': ['长度单位', '100以内的加法和减法', '角的初步认识', '表内乘法（一）', '观察物体（一）', '表内乘法（二）', '认识时间', '数学广角', '总复习'], '下册': ['数据收集整理', '表内除法（一）', '图形的运动（一）', '表内除法（二）', '混合运算', '有余数的除法', '万以内数的认识', '克和千克', '数学广角', '总复习'] },
  '三年级': { '上册': ['时、分、秒', '万以内的加法和减法', '测量', '万以内的加法和减法（二）', '倍的认识', '多位数乘一位数', '长方形和正方形', '分数的初步认识', '数学广角', '总复习'], '下册': ['位置与方向', '除数是一位数的除法', '复式统计表', '两位数乘两位数', '面积', '年、月、日', '小数的初步认识', '数学广角', '总复习'] },
  '四年级': { '上册': ['大数的认识', '公顷和平方千米', '角的度量', '三位数乘两位数', '平行四边形和梯形', '除数是两位数的除法', '条形统计图', '数学广角', '总复习'], '下册': ['四则运算', '观察物体（二）', '运算定律', '小数的意义和性质', '三角形', '小数的加法和减法', '图形的运动（二）', '平均数与条形统计图', '数学广角', '总复习'] },
  '五年级': { '上册': ['小数乘法', '位置', '小数除法', '可能性', '简易方程', '多边形的面积', '数学广角', '总复习'], '下册': ['观察物体（三）', '因数与倍数', '长方体和正方体', '分数的意义和性质', '图形的运动（三）', '分数的加法和减法', '折线统计图', '数学广角', '总复习'] },
  '六年级': { '上册': ['位置与方向（二）', '分数乘法', '分数除法', '比', '圆', '百分数', '扇形统计图', '数学广角', '总复习'], '下册': ['负数', '百分数（二）', '圆柱与圆锥', '比例', '数学广角——鸽巢问题', '整理和复习'] },
  // 初中
  '七年级': { '上册': ['有理数', '整式的加减', '一元一次方程', '几何图形初步', '总复习'], '下册': ['相交线与平行线', '实数', '平面直角坐标系', '二元一次方程组', '不等式与不等式组', '数据的收集、整理与描述', '总复习'] },
  '八年级': { '上册': ['三角形', '全等三角形', '轴对称', '整式的乘法与因式分解', '分式', '总复习'], '下册': ['二次根式', '勾股定理', '平行四边形', '一次函数', '数据的分析', '总复习'] },
  '九年级': { '上册': ['一元二次方程', '二次函数', '旋转', '圆', '概率初步', '总复习'], '下册': ['反比例函数', '相似', '锐角三角函数', '投影与视图', '总复习'] },
  // 高中
  '高一': { '上册': ['集合与常用逻辑用语', '一元二次函数、方程与不等式', '函数的概念与性质', '指数函数与对数函数', '三角函数', '总复习'], '下册': ['平面向量及其应用', '复数', '立体几何初步', '统计', '概率', '总复习'] },
  '高二': { '上册': ['空间向量与立体几何', '直线和圆的方程', '圆锥曲线的方程', '总复习'], '下册': ['数列', '一元函数的导数及其应用', '计数原理', '随机变量及其分布', '统计案例', '总复习'] },
  '高三': { '上册': ['高考专题复习'], '下册': ['高考专题复习'] },
}

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
  return [...new Set([...QUESTION_TYPES.elementary, ...QUESTION_TYPES.middle, ...QUESTION_TYPES.high])]
}

/**
 * Get available units for a given grade and semester.
 */
export function getUnitsForGrade(grade, semester) {
  if (!grade || !semester) return []
  return UNITS_BY_GRADE[grade]?.[semester] || []
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> (c === 'x' ? 0 : 3)
    return r.toString(16)
  })
}

export function createQuestion(data = {}) {
  const now = Date.now()
  return {
    id: generateId(),
    content: data.content || '',
    answer: data.answer || '',
    solution: data.solution || '',
    grade: data.grade || '',
    semester: data.semester || '',
    unit: data.unit || '',
    topic: data.topic || '',
    questionType: data.questionType || '',
    difficulty: data.difficulty || 3,
    tags: data.tags || [],
    notes: data.notes || '',
    examName: data.examName || '',
    imageUrl: data.imageUrl || '',
    imagePosition: data.imagePosition || 'right', // 'right' | 'below' | 'bottom-right'
    hasHandwriting: data.hasHandwriting || false,
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  }
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

  // 按册统计
  const semesterCount = {}
  questions.forEach(q => {
    if (q.semester) {
      const key = q.grade ? `${q.grade}${q.semester}` : q.semester
      semesterCount[key] = (semesterCount[key] || 0) + 1
    }
  })
  const topSemesters = Object.entries(semesterCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }))

  // 按单元统计
  const unitCount = {}
  questions.forEach(q => {
    if (q.unit) {
      unitCount[q.unit] = (unitCount[q.unit] || 0) + 1
    }
  })
  const topUnits = Object.entries(unitCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  return { total, todayNew, todayModified, avgDifficulty, topTags, topSemesters, topUnits }
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
