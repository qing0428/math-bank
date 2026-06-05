/**
 * AI Auto-Composition Service
 *
 * 根据教师需求，从题库中自动筛选组合成试卷。
 *
 * 支持两种模式：
 * 1. 规则组卷 — 按知识点覆盖 + 难度分布 + 题型配比，纯算法选题
 * 2. AI 组卷 — 让 LLM 从候选池中选题并排序
 */

import { openaiCompatibleChat, isDashscope, isDashscopeNative, dashscopeNativeChat } from './llmService'
import { normalizeTags } from '../utils/tagNormalize'

// ─── 规则组卷 ──────────────────────────────────────────────

/**
 * 从题库中按规则自动选题。
 *
 * @param {Array} questions - 全部题目
 * @param {Object} requirements - 组卷需求
 * @param {string} requirements.grade - 年级
 * @param {string} requirements.semester - 上/下册
 * @param {string} requirements.unit - 单元（可选）
 * @param {number} requirements.totalCount - 总题数
 * @param {Object} requirements.difficultyRatio - 难度比例，如 { easy: 7, medium: 2, hard: 1 }
 * @param {Object} requirements.typeRatio - 题型比例，如 { '选择题': 5, '填空题': 5, '解答题': 3 }
 * @param {Array} requirements.tags - 必须包含的标签（可选）
 * @param {Array} requirements.excludeIds - 排除的题目 ID（已选过的）
 * @returns {{ selected: Array, coverage: Object, message: string }}
 */
export function autoSelectQuestions(questions, requirements) {
  const {
    grade,
    semester,
    unit,
    totalCount = 10,
    difficultyRatio = { easy: 7, medium: 2, hard: 1 },
    typeRatio = {},
    tags = [],
    excludeIds = [],
  } = requirements

  // Step 1: Filter candidates
  let candidates = questions.filter(q => {
    if (excludeIds.includes(q.id)) return false
    if (grade && q.grade !== grade) return false
    if (semester && q.semester && q.semester !== semester) return false
    if (unit && q.unit && q.unit !== unit) return false
    if (tags.length > 0 && !tags.some(t => (q.tags || []).includes(t))) return false
    return true
  })

  if (candidates.length === 0) {
    return { selected: [], coverage: {}, message: '没有找到符合条件的题目，请放宽筛选条件。' }
  }

  // Step 2: Calculate target counts per difficulty
  const totalRatio = Object.values(difficultyRatio).reduce((s, v) => s + v, 0)
  const targetByDifficulty = {
    easy: Math.round((difficultyRatio.easy / totalRatio) * totalCount),
    medium: Math.round((difficultyRatio.medium / totalRatio) * totalCount),
    hard: Math.round((difficultyRatio.hard / totalRatio) * totalCount),
  }
  // Adjust rounding
  const diffSum = targetByDifficulty.easy + targetByDifficulty.medium + targetByDifficulty.hard
  if (diffSum !== totalCount) {
    targetByDifficulty.medium += totalCount - diffSum
  }

  // Step 3: Categorize candidates by difficulty
  const byDifficulty = { easy: [], medium: [], hard: [] }
  candidates.forEach(q => {
    const d = q.difficulty || 3
    if (d <= 2) byDifficulty.easy.push(q)
    else if (d <= 3) byDifficulty.medium.push(q)
    else byDifficulty.hard.push(q)
  })

  // Step 4: Select from each difficulty bucket
  const selected = []
  const usedIds = new Set()

  for (const [level, target] of Object.entries(targetByDifficulty)) {
    const pool = shuffleArray(byDifficulty[level].filter(q => !usedIds.has(q.id)))
    const count = Math.min(target, pool.length)
    for (let i = 0; i < count; i++) {
      selected.push(pool[i])
      usedIds.add(pool[i].id)
    }
  }

  // Step 5: Fill remaining slots if under totalCount
  if (selected.length < totalCount) {
    const remaining = shuffleArray(candidates.filter(q => !usedIds.has(q.id)))
    const deficit = totalCount - selected.length
    for (let i = 0; i < Math.min(deficit, remaining.length); i++) {
      selected.push(remaining[i])
      usedIds.add(remaining[i].id)
    }
  }

  // Step 6: Apply type ratio if specified
  let finalSelected = selected
  if (Object.keys(typeRatio).length > 0) {
    finalSelected = applyTypeRatio(selected, typeRatio, totalCount)
  }

  // Step 7: Shuffle to avoid grouping by difficulty
  finalSelected = shuffleArray(finalSelected)

  // Calculate coverage stats
  const coverage = calculateCoverage(finalSelected)

  const messages = []
  if (finalSelected.length < totalCount) {
    messages.push(`题库中符合条件的题目不足，仅选出 ${finalSelected.length}/${totalCount} 道。`)
  }
  if (messages.length === 0) {
    messages.push(`✅ 已自动选出 ${finalSelected.length} 道题目。`)
  }

  return { selected: finalSelected, coverage, message: messages.join(' ') }
}

/**
 * Apply type ratio to selected questions.
 * Rebalances to match target type distribution.
 */
function applyTypeRatio(selected, typeRatio, totalCount) {
  const totalTypeRatio = Object.values(typeRatio).reduce((s, v) => s + v, 0)
  const targetByType = {}
  for (const [type, ratio] of Object.entries(typeRatio)) {
    targetByType[type] = Math.round((ratio / totalTypeRatio) * totalCount)
  }

  // Group selected by type
  const byType = {}
  selected.forEach(q => {
    const t = q.questionType || '其他'
    if (!byType[t]) byType[t] = []
    byType[t].push(q)
  })

  const result = []
  const usedIds = new Set()

  for (const [type, target] of Object.entries(targetByType)) {
    const pool = byType[type] || []
    const count = Math.min(target, pool.length)
    for (let i = 0; i < count; i++) {
      result.push(pool[i])
      usedIds.add(pool[i].id)
    }
  }

  // Fill remaining
  if (result.length < totalCount) {
    const remaining = selected.filter(q => !usedIds.has(q.id))
    const deficit = totalCount - result.length
    for (let i = 0; i < Math.min(deficit, remaining.length); i++) {
      result.push(remaining[i])
    }
  }

  return result
}

/**
 * Calculate coverage statistics for selected questions.
 */
function calculateCoverage(selected) {
  const tagCount = {}
  const topicCount = {}
  const typeCount = {}
  const diffCount = { '1星': 0, '2星': 0, '3星': 0, '4星': 0, '5星': 0 }

  selected.forEach(q => {
    ;(q.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1 })
    if (q.topic) topicCount[q.topic] = (topicCount[q.topic] || 0) + 1
    if (q.questionType) typeCount[q.questionType] = (typeCount[q.questionType] || 0) + 1
    const d = q.difficulty || 3
    diffCount[`${d}星`] = (diffCount[`${d}星`] || 0) + 1
  })

  return {
    total: selected.length,
    tags: tagCount,
    topics: topicCount,
    types: typeCount,
    difficulties: diffCount,
  }
}

/**
 * Fisher-Yates shuffle.
 */
function shuffleArray(arr) {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// ─── AI 组卷 ──────────────────────────────────────────────

/**
 * 让 LLM 从候选池中选题并排序。
 * 先用规则组卷筛选候选，再让 LLM 优化选择。
 *
 * @param {Array} questions - 全部题目
 * @param {Object} requirements - 组卷需求（同 autoSelectQuestions）
 * @param {Object} llmConfig - LLM API 配置
 * @returns {{ selected: Array, coverage: Object, message: string }}
 */
export async function aiComposeQuestions(questions, requirements, llmConfig) {
  const { baseUrl, apiKey, model } = llmConfig
  if (!baseUrl || !model) throw new Error('请先配置文本生成 API')

  // Step 1: Use rule-based selection to get a candidate pool (2x target)
  const poolSize = requirements.totalCount * 3
  const poolResult = autoSelectQuestions(questions, {
    ...requirements,
    totalCount: poolSize,
    excludeIds: [],
  })

  if (poolResult.selected.length === 0) {
    return poolResult
  }

  // Step 2: Let LLM pick the best subset
  const candidateList = poolResult.selected.map((q, i) => {
    const tags = (q.tags || []).join('、')
    return `[${i + 1}] 难度${q.difficulty || 3} | ${q.questionType || '未分类'} | ${q.topic || ''} | 标签:${tags} | ${stripForAI(q.content)}`
  }).join('\n')

  const prompt = `你是一位经验丰富的数学教师，正在为学生出一份试卷。

题库候选题目如下：
${candidateList}

组卷要求：
- 总题数：${requirements.totalCount} 道
- 难度分布：${formatDifficultyRatio(requirements.difficultyRatio)}
${requirements.unit ? `- 单元：${requirements.unit}` : ''}
${requirements.tags?.length ? `- 知识点标签：${requirements.tags.join('、')}` : ''}

请从候选题目中选出最合适的 ${requirements.totalCount} 道题，要求：
1. 知识点覆盖全面，避免重复考查同一知识点
2. 难度分布符合要求
3. 题型搭配合理
4. 题目顺序由易到难

只返回选中的题目编号列表，用逗号分隔，如：1,3,5,7,9,11,13,15,17,19
不要其他解释。`

  let text = ''
  try {
    if (isDashscopeNative(baseUrl)) {
      text = await dashscopeNativeChat(baseUrl, apiKey, model, prompt, null, 200, false)
    } else {
      text = await openaiCompatibleChat(baseUrl, apiKey, model, prompt, null, 200, false)
    }
  } catch (err) {
    // Fallback to rule-based
    console.warn('AI 组卷失败，回退到规则组卷:', err.message)
    return poolResult
  }

  // Step 3: Parse LLM response
  const numbers = text.match(/\d+/g)
  if (!numbers || numbers.length === 0) {
    return poolResult
  }

  const selected = []
  const usedIndices = new Set()
  for (const numStr of numbers) {
    const idx = parseInt(numStr, 10) - 1
    if (idx >= 0 && idx < poolResult.selected.length && !usedIndices.has(idx)) {
      selected.push(poolResult.selected[idx])
      usedIndices.add(idx)
    }
    if (selected.length >= requirements.totalCount) break
  }

  if (selected.length === 0) {
    return poolResult
  }

  const coverage = calculateCoverage(selected)
  return {
    selected,
    coverage,
    message: `✅ AI 已自动选出 ${selected.length} 道题目。`,
  }
}

function stripForAI(text) {
  if (!text) return ''
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, '[公式]')
    .replace(/\$[^$]*\$/g, '[公式]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

function formatDifficultyRatio(ratio) {
  if (!ratio) return '均匀分布'
  const parts = []
  if (ratio.easy) parts.push(`简单${ratio.easy}`)
  if (ratio.medium) parts.push(`中等${ratio.medium}`)
  if (ratio.hard) parts.push(`困难${ratio.hard}`)
  return parts.join(' : ') || '均匀分布'
}

// ─── 相似题查找 ────────────────────────────────────────────

/**
 * Find similar questions from the bank using LLM.
 *
 * @param {Object} targetQuestion - The question to find similar ones for
 * @param {Array} allQuestions - Full question bank
 * @param {Object} llmConfig - LLM API config
 * @param {number} count - How many similar questions to return (default 5)
 * @returns {Promise<Array>} Array of similar questions with similarity scores
 */
export async function findSimilarQuestions(targetQuestion, allQuestions, llmConfig, count = 5) {
  const { baseUrl, apiKey, model } = llmConfig
  if (!baseUrl || !model) throw new Error('请先配置文本生成 API')

  // Pre-filter: same grade, exclude self
  let candidates = allQuestions.filter(q => {
    if (q.id === targetQuestion.id) return false
    if (targetQuestion.grade && q.grade === targetQuestion.grade) return true
    // Also include same topic or shared tags
    if (targetQuestion.topic && q.topic === targetQuestion.topic) return true
    if (targetQuestion.tags?.some(t => (q.tags || []).includes(t))) return true
    return false
  })

  if (candidates.length === 0) {
    // Fallback: include all questions
    candidates = allQuestions.filter(q => q.id !== targetQuestion.id)
  }

  if (candidates.length === 0) {
    return []
  }

  // Limit candidate pool size for LLM context
  const MAX_CANDIDATES = 50
  if (candidates.length > MAX_CANDIDATES) {
    // Prioritize: same grade > same topic > shared tags
    candidates.sort((a, b) => {
      const scoreA = (a.grade === targetQuestion.grade ? 10 : 0)
        + (a.topic === targetQuestion.topic ? 5 : 0)
        + (targetQuestion.tags?.filter(t => (a.tags || []).includes(t)).length || 0)
      const scoreB = (b.grade === targetQuestion.grade ? 10 : 0)
        + (b.topic === targetQuestion.topic ? 5 : 0)
        + (targetQuestion.tags?.filter(t => (b.tags || []).includes(t)).length || 0)
      return scoreB - scoreA
    })
    candidates = candidates.slice(0, MAX_CANDIDATES)
  }

  // Build candidate list for LLM
  const candidateList = candidates.map((q, i) => {
    const tags = (q.tags || []).join('、')
    return `[${i + 1}] 难度${q.difficulty || 3} | ${q.questionType || ''} | ${q.topic || ''} | ${tags} | ${stripForAI(q.content)}`
  }).join('\n')

  const targetTags = (targetQuestion.tags || []).join('、')
  const prompt = `你是一位数学教师，需要从题库中找出与目标题目最相似的题目。

目标题目：
- 年级：${targetQuestion.grade || '未知'}
- 题型：${targetQuestion.questionType || '未知'}
- 板块：${targetQuestion.topic || '未知'}
- 标签：${targetTags || '无'}
- 难度：${targetQuestion.difficulty || 3}
- 内容：${stripForAI(targetQuestion.content)}

题库候选：
${candidateList}

请选出与目标题目最相似的 ${Math.min(count, candidates.length)} 道题，相似标准：
1. 考查相同或相近的知识点
2. 题型和解题方法类似
3. 难度接近

只返回选中的题目编号，用逗号分隔，如：1,3,5,7,9
不要其他解释。`

  let text = ''
  try {
    if (isDashscopeNative(baseUrl)) {
      text = await dashscopeNativeChat(baseUrl, apiKey, model, prompt, null, 200, false)
    } else {
      text = await openaiCompatibleChat(baseUrl, apiKey, model, prompt, null, 200, false)
    }
  } catch (err) {
    console.warn('LLM similar search failed, falling back to tag matching:', err.message)
    return fallbackSimilar(targetQuestion, allQuestions, count)
  }

  // Parse response
  const numbers = text.match(/\d+/g)
  if (!numbers || numbers.length === 0) {
    return fallbackSimilar(targetQuestion, allQuestions, count)
  }

  const results = []
  const usedIndices = new Set()
  for (const numStr of numbers) {
    const idx = parseInt(numStr, 10) - 1
    if (idx >= 0 && idx < candidates.length && !usedIndices.has(idx)) {
      results.push(candidates[idx])
      usedIndices.add(idx)
    }
    if (results.length >= count) break
  }

  return results.length > 0 ? results : fallbackSimilar(targetQuestion, allQuestions, count)
}

/**
 * Fallback: find similar questions by tag/topic matching (no LLM).
 */
function fallbackSimilar(target, allQuestions, count) {
  const scored = allQuestions
    .filter(q => q.id !== target.id)
    .map(q => {
      let score = 0
      if (q.grade === target.grade) score += 3
      if (q.topic === target.topic) score += 5
      if (q.questionType === target.questionType) score += 2
      const diff = Math.abs((q.difficulty || 3) - (target.difficulty || 3))
      score += Math.max(0, 3 - diff)
      const sharedTags = target.tags?.filter(t => (q.tags || []).includes(t)).length || 0
      score += sharedTags * 2
      return { question: q, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(s => s.question)

  return scored
}
