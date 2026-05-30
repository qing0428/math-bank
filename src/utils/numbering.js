/**
 * Chinese hierarchical numbering utilities for paper composition.
 *
 * Mode 1 (nested): 一、 → 1. → （1） → ①
 * Mode 2 (flat):   1. 2. 3. 4. ...
 */

const CHINESE_NUMBERS = [
  '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '二十一', '二十二', '二十三', '二十四', '二十五', '二十六', '二十七', '二十八', '二十九', '三十',
  '三十一', '三十二', '三十三', '三十四', '三十五', '三十六', '三十七', '三十八', '三十九', '四十',
]

const CIRCLED_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
  '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳']

function toChineseNumber(n) {
  if (n >= 1 && n <= CHINESE_NUMBERS.length) return CHINESE_NUMBERS[n - 1]
  return String(n)
}

function toCircled(n) {
  if (n >= 1 && n <= CIRCLED_NUMBERS.length) return CIRCLED_NUMBERS[n - 1]
  return `(${n})`
}

/**
 * Generate flat sequential numbers: 1. 2. 3. ...
 * @param {Array} questions - Array of question objects
 * @returns {Array} - [{ question, number: '1.' }, ...]
 */
export function generateFlatNumbers(questions) {
  return questions.map((q, i) => ({
    question: q,
    number: `${i + 1}.`,
  }))
}

/**
 * Generate nested numbers grouped by questionType.
 * Level 1: 一、二、三 (question type groups)
 * Level 2: 1. 2. 3. (questions within group)
 *
 * @param {Array} questions - Array of question objects
 * @returns {Array} - [{ question, groupLabel, number, type }, ...]
 */
export function generateNestedNumbers(questions) {
  // Group by questionType
  const groups = []
  const groupMap = {}

  questions.forEach(q => {
    const type = q.questionType || '其他'
    if (!groupMap[type]) {
      groupMap[type] = { type, questions: [] }
      groups.push(groupMap[type])
    }
    groupMap[type].questions.push(q)
  })

  const result = []
  groups.forEach((group, gi) => {
    const groupLabel = `${toChineseNumber(gi + 1)}、${group.type}`
    group.questions.forEach((q, qi) => {
      result.push({
        question: q,
        groupLabel: qi === 0 ? groupLabel : null,
        number: `${qi + 1}.`,
        type: group.type,
      })
    })
  })

  return result
}

/**
 * Format a sub-number for nested lists.
 * @param {number} level - 0 = (1), 1 = ①
 * @param {number} n - 1-based index
 * @returns {string}
 */
export function formatSubNumber(level, n) {
  if (level === 0) return `（${n}）`
  return toCircled(n)
}
