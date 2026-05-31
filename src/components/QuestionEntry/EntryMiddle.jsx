import { useState } from 'react'
import StarRating from './StarRating'
import { GRADES, TOPICS, getQuestionTypesForGrade } from '../../store/questionStore'
import { generateSolution, autoTag } from '../../services/llmService'
import MixedContent from '../common/MixedContent'
import ImageCropper from '../common/ImageCropper'

// Strip LaTeX and markdown for plain text preview
function stripForPreview(text) {
  if (!text) return ''
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, '…')
    .replace(/\$[^$]*\$/g, '…')
    .replace(/\\[a-zA-Z]+\{?[^}]*\}?/g, '')
    .replace(/[{}\\^_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Common preset tags — filtered by grade level
const PRESET_TAGS_BY_GRADE = {
  // 小学低年级（一至三年级）
  primary_low: ['加法', '减法', '乘法', '除法', '口算', '应用题', '认识图形', '长度单位', '人民币', '时间', '选择题', '填空题', '计算'],
  // 小学高年级（四至六年级）
  primary_high: ['大数认识', '乘除法', '平行四边形', '梯形', '鸡兔同笼', '条形统计图', '植树问题', '数学广角', '运算律', '角的度量', '选择题', '填空题', '解决问题', '计算', '应用题'],
  // 初中
  middle: ['方程', '不等式', '函数', '几何', '三角形', '全等', '相似', '圆', '概率', '统计', '选择题', '填空题', '解答题', '证明', '计算', '数形结合'],
  // 高中
  high: ['函数', '三角函数', '数列', '不等式', '向量', '立体几何', '解析几何', '导数', '概率统计', '选择题', '填空题', '解答题', '证明', '数形结合', '分类讨论'],
  // 默认
  default: ['计算', '方程', '几何', '函数', '应用题', '证明', '选择题', '填空题', '解答题', '数形结合', '分类讨论', '综合'],
}

function getPresetTags(grade) {
  if (!grade) return PRESET_TAGS_BY_GRADE.default
  if (/^[一二三]年级/.test(grade)) return PRESET_TAGS_BY_GRADE.primary_low
  if (/^[四五六]年级/.test(grade)) return PRESET_TAGS_BY_GRADE.primary_high
  if (/七|八|九|初[一二三]/.test(grade)) return PRESET_TAGS_BY_GRADE.middle
  if (/高[一二三]/.test(grade)) return PRESET_TAGS_BY_GRADE.high
  return PRESET_TAGS_BY_GRADE.default
}

export default function EntryMiddle({ question, onChange, llmConfig, batchQuestions, selectedBatchIndex, onSelectBatchQuestion, onBatchAutoTag, batchImages = [] }) {
  const [tagInput, setTagInput] = useState('')
  const [suggestedTags, setSuggestedTags] = useState([])
  const [tagging, setTagging] = useState(false)
  const [batchTagging, setBatchTagging] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [fastMode, setFastMode] = useState(true)
  const [showCropper, setShowCropper] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [editingSolution, setEditingSolution] = useState(false)

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
    // Add directly to question tags
    const merged = [...new Set([...(question.tags || []), tag])]
    update('tags', merged)
  }

  const toggleTag = (tag) => {
    const added = (question.tags || []).includes(tag)
    if (added) {
      removeTag(tag)
    } else {
      const merged = [...new Set([...(question.tags || []), tag])]
      update('tags', merged)
    }
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
      const tags = await autoTag(question.content, llmConfig.text, question.grade)
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

  const handleBatchAutoTag = async () => {
    if (!batchQuestions?.length || !textConfigured) return
    setBatchTagging(true)
    try {
      await onBatchAutoTag?.()
    } catch (err) {
      alert('批量打标失败：' + (err.message || '未知错误'))
    } finally {
      setBatchTagging(false)
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
      let solution = await generateSolution(
        question.content,
        question.answer,
        llmConfig.text,
        fastMode,
        question.grade
      )
      // Strip \boxed{...} artifacts from solution
      solution = solution.replace(/\\boxed\{([^}]*)\}/g, '$1')
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
            <div className="flex items-center gap-2">
              {textConfigured && (
                <button
                  onClick={handleBatchAutoTag}
                  disabled={batchTagging}
                  className="text-xs text-purple-600 hover:text-purple-800 cursor-pointer disabled:opacity-50"
                >
                  {batchTagging ? '⏳ 打标中...' : '🏷️ 批量打标'}
                </button>
              )}
              <span className="text-xs text-amber-500">点击题目切换编辑</span>
            </div>
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
                {i + 1}. {q.content ? stripForPreview(q.content).slice(0, 15) : '空'}…
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grade & Topic & Type */}
      <div className="grid grid-cols-3 gap-3">
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
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">题目类型</label>
          <select
            value={question.questionType || ''}
            onChange={(e) => update('questionType', e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
          >
            <option value="">选择类型</option>
            {getQuestionTypesForGrade(question.grade).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">难度星级</label>
        <StarRating value={question.difficulty || 0} onChange={(v) => update('difficulty', v)} />
        <p className="text-xs text-gray-400 mt-1">1=基础计算 2=简单应用 3=综合运用 4=较难综合 5=竞赛难度</p>
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

        {/* Preset tags — grade-aware, click to toggle */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {getPresetTags(question.grade).map(tag => {
            const added = (question.tags || []).includes(tag)
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs transition-colors cursor-pointer
                  ${added
                    ? 'border border-primary-300 bg-primary-50 text-primary-600 hover:bg-red-50 hover:border-red-300 hover:text-red-500'
                    : 'border border-dashed border-gray-300 bg-gray-50 text-gray-500 hover:bg-primary-50 hover:border-primary-300 hover:text-primary-600'}`}
              >
                {added ? `× ${tag}` : `+ ${tag}`}
              </button>
            )
          })}
        </div>

        {/* AI suggested tags */}
        {suggestedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-xs text-gray-400">AI 建议：</span>
            {suggestedTags.map(tag => {
              const added = (question.tags || []).includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs transition-colors cursor-pointer
                    ${added
                      ? 'border border-purple-300 bg-purple-100 text-purple-600 hover:bg-red-50 hover:border-red-300 hover:text-red-500'
                      : 'border border-dashed border-purple-300 bg-purple-50 text-purple-600 hover:bg-purple-100 hover:border-purple-400'}`}
                >
                  {added ? `× ${tag}` : `+ ${tag}`}
                </button>
              )
            })}
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

      {/* Notes — toggle to show */}
      {!showNotes ? (
        <button
          onClick={() => setShowNotes(true)}
          className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer flex items-center gap-1"
        >
          📝 添加备注
        </button>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-500">备注</label>
            <button
              onClick={() => setShowNotes(false)}
              className="text-xs text-gray-400 hover:text-red-500 cursor-pointer"
            >
              ✕ 收起
            </button>
          </div>
          <textarea
            value={question.notes || ''}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="可选备注信息..."
            rows={2}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 resize-none"
          />
        </div>
      )}

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

      {/* Attached image (from batch recognition) or attach button */}
      {question.imageUrl ? (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-blue-700">📎 附带图片</label>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCropper(true)}
                className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                ✂️ 裁剪
              </button>
              <button
                onClick={() => update('imageUrl', '')}
                className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
              >
                ✕ 移除
              </button>
            </div>
          </div>
          <div
            className="bg-white rounded border border-blue-200 p-2 flex justify-center cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => setShowCropper(true)}
            title="点击裁剪图片"
          >
            <img
              src={question.imageUrl}
              alt="题目图片"
              className="max-w-full max-h-48 object-contain rounded"
            />
          </div>
          <p className="text-xs text-blue-400 mt-1 text-center">点击图片裁剪</p>
          {/* Image position selector */}
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs text-gray-400 mr-1">位置：</span>
            {[
              { value: 'right', label: '→ 右侧' },
              { value: 'below', label: '↓ 下方' },
              { value: 'bottom-right', label: '↘ 右下' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => update('imagePosition', opt.value)}
                className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors
                  ${(question.imagePosition || 'right') === opt.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : batchImages.length > 0 ? (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
          <label className="text-xs font-medium text-gray-500 mb-2 block">📎 附带图片（点击选择）</label>
          <div className="flex flex-wrap gap-2">
            {batchImages.map((img, idx) => (
              <div
                key={idx}
                onClick={() => update('imageUrl', img)}
                className="w-16 h-16 rounded border border-gray-200 overflow-hidden cursor-pointer hover:border-primary-400 transition-colors flex-shrink-0"
              >
                <img src={img} alt={`图片${idx + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            id="attach-image-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => update('imageUrl', reader.result)
              reader.readAsDataURL(file)
              e.target.value = ''
            }}
          />
          <label
            htmlFor="attach-image-input"
            className="flex items-center justify-center gap-1 py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-400 hover:border-primary-300 hover:text-primary-500 cursor-pointer transition-colors"
          >
            📎 上传图片
          </label>
        </div>
      )}

      {/* Image Cropper overlay */}
      {showCropper && question.imageUrl && (
        <ImageCropper
          imageUrl={question.imageUrl}
          onCropComplete={(croppedUrl) => {
            update('imageUrl', croppedUrl)
            setShowCropper(false)
          }}
          onCancel={() => setShowCropper(false)}
        />
      )}

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

      {/* Solution Preview / Edit */}
      {question.solution && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-500">题目解析</label>
            <button
              onClick={() => setEditingSolution(!editingSolution)}
              className="text-xs text-primary-500 hover:text-primary-700 cursor-pointer"
            >
              {editingSolution ? '👁️ 预览' : '✏️ 编辑'}
            </button>
          </div>
          {editingSolution ? (
            <textarea
              value={question.solution}
              onChange={(e) => update('solution', e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 resize-y"
            />
          ) : (
            <div className="bg-gray-50 rounded-lg border border-border p-3 max-h-40 overflow-y-auto text-xs text-gray-700">
              <MixedContent content={question.solution} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
