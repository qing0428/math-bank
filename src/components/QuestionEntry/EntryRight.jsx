import { useState, useEffect } from 'react'
import MixedContent from '../common/MixedContent'
import { stripMarkdown } from '../../utils/textUtils'
import StarRating from './StarRating'

/**
 * Adaptive image layout: if image is tall (> 1.5x width), show below content;
 * if short, show to the right of content.
 */
function AdaptiveImage({ src, alt }) {
  const [dims, setDims] = useState(null)

  useEffect(() => {
    if (!src) { setDims(null); return }
    const img = new Image()
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => setDims(null)
    img.src = src
  }, [src])

  if (!src) return null

  // Tall image: height > 1.5x width → show below
  if (dims && dims.h > dims.w * 1.5) {
    return (
      <div className="mt-3 w-full">
        <img src={src} alt={alt} className="w-full max-h-80 object-contain rounded border border-border" />
      </div>
    )
  }

  // Short/wide image: show to the right
  return (
    <div className="w-1/3 flex-shrink-0">
      <img src={src} alt={alt} className="w-full rounded border border-border object-contain" />
    </div>
  )
}

export default function EntryRight({ question, onSave }) {
  const getFilename = () => {
    if (!question.grade && !question.topic) return '未命名题目'
    const parts = [question.grade, question.topic, `难度${question.difficulty || 0}`].filter(Boolean)
    return parts.join('_')
  }

  const isValid = question.content?.trim()

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-heading text-base font-semibold text-text">最终预览</h3>

      {/* Filename */}
      <div className="bg-gray-50 rounded-lg border border-border p-2">
        <p className="text-xs text-gray-400">{getFilename()}.json</p>
      </div>

      {/* Question content + image side by side */}
      <div className="bg-white rounded-lg border border-border p-3">
        <p className="text-xs font-medium text-gray-500 mb-2">题目内容</p>
        <div className="flex gap-3 items-start">
          {/* Content on the left */}
          <div className="flex-1 min-w-0 text-sm text-gray-800 leading-relaxed">
            <MixedContent content={question.content || ''} answer={question.answer} />
          </div>
          {/* Image: adaptive layout based on dimensions */}
          {question.imageUrl && (
            <AdaptiveImage src={question.imageUrl} alt="题目图片" />
          )}
        </div>
      </div>

      {/* Meta info */}
      {(question.examName || question.grade || question.topic || question.difficulty > 0 || (question.tags && question.tags.length > 0)) && (
        <div className="bg-white rounded-lg border border-border p-3 text-xs text-gray-500 space-y-1">
          {question.examName && <p>📝 试卷：{question.examName}</p>}
          {question.grade && <p>📚 年级：{question.grade}</p>}
          {question.topic && <p>📂 板块：{question.topic}</p>}
          {question.difficulty > 0 && (
            <p>⭐ 难度：<StarRating value={question.difficulty} size="sm" /></p>
          )}
          {question.tags && question.tags.length > 0 && (
            <p>🏷️ 标签：{question.tags.join('、')}</p>
          )}
        </div>
      )}

      {/* Answer */}
      <div className="bg-white rounded-lg border border-border p-3">
        <p className="text-xs font-medium text-gray-500 mb-2">答案</p>
        {question.answer ? (
          <div className="text-sm text-gray-800 leading-relaxed">
            <MixedContent content={question.answer} />
          </div>
        ) : (
          <p className="text-xs text-gray-300 italic">暂无答案</p>
        )}
      </div>

      {/* Solution */}
      <div className="bg-white rounded-lg border border-border p-3">
        <p className="text-xs font-medium text-gray-500 mb-2">题目解析</p>
        {question.solution ? (
          <div className="text-sm text-gray-800 leading-relaxed max-h-60 overflow-y-auto">
            <MixedContent content={stripMarkdown(question.solution)} />
          </div>
        ) : (
          <p className="text-xs text-gray-300 italic">暂无解析</p>
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={() => onSave?.()}
        disabled={!isValid}
        className="w-full py-3 rounded-lg bg-primary-500 text-white font-semibold text-sm hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
      >
        💾 保存题目
      </button>
    </div>
  )
}
