import { useState } from 'react'
import StarRating from './StarRating'
import { GRADES, TOPICS } from '../../store/questionStore'
import { generateSolution, autoTag } from '../../services/llmService'
import MixedContent from '../common/MixedContent'

// Common preset tags shown below the input
const PRESET_TAGS = [
  '计算', '方程', '几何', '函数', '应用题', '证明',
  '选择题', '填空题', '解答题', '数形结合', '分类讨论', '综合',
]

export default function EntryMiddle({ question, onChange, llmConfig, batchQuestions, selectedBatchIndex, onSelectBatchQuestion }) {
  const [tagInput, setTagInput] = useState('')
  const [suggestedTags, setSuggestedTags] = useState([])
  const [tagging, setTagging] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [autoGenerate, setAutoGenerate] = useState(false)
  const [fastMode, setFastMode] = useState(false)

  const textConfigured = llmConfig?.text?.connected && llmConfig?.text?.model

  const update = (field, value) => {
    onChange?.({ ...question, [field]: value })
  }

  const addTagsFromInput = () => {
    const tags = tagInput.split(/[;；]/).map(t => t.trim()).filter(Boolean)
    if (tags.length > 0) {
      const merged = [...new Set([...(question.tags || []), ...tags])]
      update('tags', merged)
    }
    setTagInput('')
  }

  const removeTag = (tag) => {
    update('tags', (question.tags || []).filter(t => t !== tag))
  }

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ';') {
      e.preventDefault()
      addTagsFromInput()
    }
  }

  const pickSuggestedTag = (tag) => {
    // Remove from suggestions
    setSuggestedTags(prev => prev.filter(t => t !== tag))
    // Add to input
    setTagInput(prev => prev ? `${prev}; ${tag}` : tag)
  }

  const handleAutoTag = async () => {
    if (!question.content?.trim()) return

    if (!textConfigured) {
      alert('请先前往「API 设置」配置文本生成 API')
      return
    }

    setTagging(true)
    setSuggestedTags([])
    try {
      const tags = await autoTag(question.content, llmConfig.text)
      // Filter out tags already on the question
      const existing = new Set(question.tags || [])
      const newTags = tags.filter(t => !existing.has(t))
      setSuggestedTags(newTags)
    } catch (err) {
      alert('AI 自动打标失败：' + (err.message || '未知错误'))
    } finally {
      setTagging(false)
    }
  }

  const handleGenerateSolution = async () => {
    if (!question.content?.trim()) return

    if (!textConfigured) {
      alert('请先前往「API 设置」配置文本生成 API')
      return
    }

    setGenerating(true)
    setGenerateError('')
    try {
      const solution = await generateSolution(
        question.content,
        question.answer,
        llmConfig.text,
        fastMode,
        question.grade
      )
      update('solution', solution)
    } catch (err) {
      setGenerateError(err.message || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-heading text-base font-semibold text-text">题目详情</h3>

      {/* Batch question list */}
      {batchQuestions && batchQuestions.length > 0 && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-700">📋 批量识别结果（共 {batchQuestions.length} 题）</span>
            <span className="text-xs text-amber-500">点击题目切换编辑</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {batchQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => onSelectBatchQuestion?.(i)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer
                  ${i === selectedBatchIndex
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600'}`}
              >
                {i + 1}. {q.content ? q.content.slice(0, 15).replace(/\$\$?[^$]*\$\$?/g, '…').replace(/[{}\\]/g, '') : '空'}…
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grade & Topic */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">年级</label>
          <select
            value={question.grade || ''}
            onChange={(e) => update('grade', e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
          >
            <option value="">选择年级</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">知识板块</label>
          <select
            value={question.topic || ''}
            onChange={(e) => update('topic', e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
          >
            <option value="">选择板块</option>
            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">难度星级</label>
        <StarRating value={question.difficulty || 0} onChange={(v) => update('difficulty', v)} />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          标签 <span className="text-gray-400">（用 ; 分隔，回车确认）</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="输入标签后按回车"
            className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
          />
          <button
            type="button"
            onClick={handleAutoTag}
            disabled={tagging || !question.content}
            className="px-3 py-2 rounded-lg bg-purple-100 text-purple-700 text-xs font-medium hover:bg-purple-200 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            {tagging ? '⏳ AI打标...' : '🤖 AI打标'}
          </button>
        </div>

        {/* Preset tags — always visible */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {PRESET_TAGS.filter(t => !(question.tags || []).includes(t)).map(tag => (
            <button
              key={tag}
              onClick={() => pickSuggestedTag(tag)}
              className="inline-flex items-center px-2.5 py-1 rounded-full border border-dashed border-gray-300 bg-gray-50 text-gray-500 text-xs hover:bg-primary-50 hover:border-primary-300 hover:text-primary-600 transition-colors cursor-pointer"
            >
              + {tag}
            </button>
          ))}
        </div>

        {/* AI suggested tags */}
        {suggestedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-xs text-gray-400">AI 建议：</span>
            {suggestedTags.map(tag => (
              <button
                key={tag}
                onClick={() => pickSuggestedTag(tag)}
                className="inline-flex items-center px-2.5 py-1 rounded-full border border-dashed border-purple-300 bg-purple-50 text-purple-600 text-xs hover:bg-purple-100 hover:border-purple-400 transition-colors cursor-pointer"
              >
                + {tag}
              </button>
            ))}
          </div>
        )}

        {!textConfigured && (
          <p className="text-xs text-yellow-600 mt-1">⚠️ 配置文本生成 API 后可启用 AI 自动打标</p>
        )}

        {/* Confirmed tags */}
        {question.tags && question.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {question.tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-100 text-primary-700 text-xs">
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-red-500 cursor-pointer">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">备注</label>
        <textarea
          value={question.notes || ''}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="可选备注信息..."
          rows={2}
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 resize-none"
        />
      </div>

      {/* Divider */}
      <hr className="border-border" />

      {/* LaTeX Content */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">题目内容 (LaTeX)</label>
        <textarea
          value={question.content || ''}
          onChange={(e) => update('content', e.target.value)}
          placeholder="输入 LaTeX 格式的题目，如：解方程 $x^2 - 5x + 6 = 0$"
          rows={4}
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">答案 (LaTeX)</label>
        <textarea
          value={question.answer || ''}
          onChange={(e) => update('answer', e.target.value)}
          placeholder="仅最终答案或算式，如 $x = 2$ 或 $S = 60\,\mathrm{m}^2$"
          rows={2}
          className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 resize-none"
        />
      </div>

      {/* Solution Options */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={autoGenerate}
            onChange={(e) => setAutoGenerate(e.target.checked)}
            className="rounded border-gray-300 text-primary-500 focus:ring-primary-300"
          />
          <span>录入同时生成解析</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={fastMode}
            onChange={(e) => setFastMode(e.target.checked)}
            className="rounded border-gray-300 text-primary-500 focus:ring-primary-300"
          />
          <span>快速模式 <span className="text-gray-400 text-xs">（提示词更简洁，生成更快）</span></span>
        </label>
      </div>

      {/* Text API Status */}
      {!textConfigured && (
        <div className="bg-yellow-50 rounded-lg p-2.5 text-xs border border-yellow-200 text-yellow-700">
          ⚠️ 未配置文本生成 API，生成解析和 AI 打标功能不可用
        </div>
      )}

      {/* Generate Button */}
      <button
        type="button"
        onClick={handleGenerateSolution}
        disabled={generating || !question.content}
        className="w-full py-2.5 rounded-lg bg-cta text-white font-medium text-sm hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {generating ? '⏳ AI 生成解析中...' : '🤖 生成解析'}
      </button>

      {/* Error */}
      {generateError && (
        <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-red-600 text-xs">
          ❌ {generateError}
        </div>
      )}

      {/* Solution Preview (inline) */}
      {question.solution && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">题目解析</label>
          <div className="bg-gray-50 rounded-lg border border-border p-3 max-h-40 overflow-y-auto text-xs text-gray-700">
            <MixedContent content={question.solution} />
          </div>
        </div>
      )}
    </div>
  )
}
