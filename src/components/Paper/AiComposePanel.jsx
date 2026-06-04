import { useState } from 'react'
import { GRADES, SEMESTERS, getUnitsForGrade, getQuestionTypesForGrade } from '../../store/questionStore'

const DIFFICULTY_PRESETS = [
  { label: '7:2:1（基础）', value: { easy: 7, medium: 2, hard: 1 } },
  { label: '6:3:1（标准）', value: { easy: 6, medium: 3, hard: 1 } },
  { label: '5:3:2（中等）', value: { easy: 5, medium: 3, hard: 2 } },
  { label: '4:3:3（偏难）', value: { easy: 4, medium: 3, hard: 3 } },
  { label: '自定义', value: null },
]

export default function AiComposePanel({ questions, onCompose, onClose, llmConfig }) {
  const [grade, setGrade] = useState('')
  const [semester, setSemester] = useState('')
  const [unit, setUnit] = useState('')
  const [totalCount, setTotalCount] = useState(10)
  const [diffPreset, setDiffPreset] = useState(0)
  const [customEasy, setCustomEasy] = useState(7)
  const [customMedium, setCustomMedium] = useState(2)
  const [customHard, setCustomHard] = useState(1)
  const [useAI, setUseAI] = useState(false)
  const [composing, setComposing] = useState(false)
  const [error, setError] = useState('')

  const textConfigured = llmConfig?.text?.connected && llmConfig?.text?.model

  // Count matching questions
  const matchCount = questions.filter(q => {
    if (grade && q.grade !== grade) return false
    if (semester && q.semester && q.semester !== semester) return false
    if (unit && q.unit && q.unit !== unit) return false
    return true
  }).length

  const handleCompose = async () => {
    if (!grade) {
      setError('请选择年级')
      return
    }
    if (matchCount === 0) {
      setError('题库中没有符合条件的题目')
      return
    }

    setError('')
    setComposing(true)

    const difficultyRatio = DIFFICULTY_PRESETS[diffPreset].value || {
      easy: customEasy,
      medium: customMedium,
      hard: customHard,
    }

    const requirements = {
      grade,
      semester,
      unit,
      totalCount: Math.min(totalCount, matchCount),
      difficultyRatio,
    }

    try {
      await onCompose(requirements, useAI && textConfigured)
    } catch (err) {
      setError(err.message || '组卷失败')
    } finally {
      setComposing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-semibold text-text">🤖 AI 自动组卷</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-lg">✕</button>
        </div>

        <div className="space-y-4">
          {/* Grade / Semester / Unit */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">年级 *</label>
              <select
                value={grade}
                onChange={(e) => { setGrade(e.target.value); setSemester(''); setUnit('') }}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="">选择年级</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">上/下册</label>
              <select
                value={semester}
                onChange={(e) => { setSemester(e.target.value); setUnit('') }}
                disabled={!grade}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">全部</option>
                {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">单元</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={!grade || !semester}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">全部单元</option>
                {getUnitsForGrade(grade, semester).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Match count */}
          <div className={`rounded-lg p-2.5 text-xs border ${
            matchCount > 0
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-yellow-50 border-yellow-200 text-yellow-700'
          }`}>
            {matchCount > 0
              ? `📚 题库中有 ${matchCount} 道符合条件的题目`
              : '⚠️ 没有找到符合条件的题目，请放宽筛选条件'}
          </div>

          {/* Total count */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">题目数量</label>
            <input
              type="number"
              min={1}
              max={Math.min(50, matchCount)}
              value={totalCount}
              onChange={(e) => setTotalCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {/* Difficulty ratio */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">难度分布</label>
            <div className="flex flex-wrap gap-1.5">
              {DIFFICULTY_PRESETS.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => setDiffPreset(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors
                    ${diffPreset === i
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {DIFFICULTY_PRESETS[diffPreset].value === null && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-0.5">简单</label>
                  <input type="number" min={0} max={10} value={customEasy} onChange={e => setCustomEasy(parseInt(e.target.value) || 0)} className="w-full rounded border border-border px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-0.5">中等</label>
                  <input type="number" min={0} max={10} value={customMedium} onChange={e => setCustomMedium(parseInt(e.target.value) || 0)} className="w-full rounded border border-border px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-0.5">困难</label>
                  <input type="number" min={0} max={10} value={customHard} onChange={e => setCustomHard(parseInt(e.target.value) || 0)} className="w-full rounded border border-border px-2 py-1 text-sm" />
                </div>
              </div>
            )}
          </div>

          {/* AI mode toggle */}
          {textConfigured && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={useAI}
                onChange={(e) => setUseAI(e.target.checked)}
                className="rounded border-gray-300 text-primary-500 focus:ring-primary-300"
              />
              <span>启用 AI 优化选题 <span className="text-gray-400 text-xs">（更智能但更慢）</span></span>
            </label>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-red-600 text-xs">
              ❌ {error}
            </div>
          )}

          {/* Compose button */}
          <button
            onClick={handleCompose}
            disabled={composing || !grade || matchCount === 0}
            className="w-full py-2.5 rounded-lg bg-cta text-white font-medium text-sm hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {composing ? '⏳ 组卷中...' : '🎯 开始自动组卷'}
          </button>
        </div>
      </div>
    </div>
  )
}
