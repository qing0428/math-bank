import MixedContent from '../common/MixedContent'
import { stripMarkdown } from '../../utils/textUtils'
import StarRating from './StarRating'

/**
 * Render image based on position setting.
 */
function QuestionImage({ src, alt, position = 'right' }) {
  if (!src) return null

  if (position === 'below') {
    return (
      <div className="mt-3 w-full">
        <img src={src} alt={alt} className="w-full max-h-80 object-contain rounded border border-border" />
      </div>
    )
  }

  if (position === 'bottom-right') {
    return (
      <div className="mt-3 w-2/3 ml-auto">
        <img src={src} alt={alt} className="w-full max-h-60 object-contain rounded border border-border" />
      </div>
    )
  }

  // Default: right
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
        {question.imageUrl && question.imagePosition === 'below' ? (
          <div>
            <div className="text-sm text-gray-800 leading-relaxed">
              <MixedContent content={question.content || ''} answer={question.answer} />
            </div>
            <QuestionImage src={question.imageUrl} alt="题目图片" position="below" />
          </div>
        ) : question.imageUrl && question.imagePosition === 'bottom-right' ? (
          <div>
            <div className="text-sm text-gray-800 leading-relaxed">
              <MixedContent content={question.content || ''} answer={question.answer} />
            </div>
            <QuestionImage src={question.imageUrl} alt="题目图片" position="bottom-right" />
          </div>
        ) : (
          <div className="flex gap-3 items-start">
            <div className="flex-1 min-w-0 text-sm text-gray-800 leading-relaxed">
              <MixedContent content={question.content || ''} answer={question.answer} />
            </div>
            {question.imageUrl && (
              <QuestionImage src={question.imageUrl} alt="题目图片" position="right" />
            )}
          </div>
        )}
      </div>

      {/* Meta info */}
      {(question.examName || question.grade || question.semester || question.unit || question.topic || question.difficulty > 0 || (question.tags && question.tags.length > 0)) && (
        <div className="bg-white rounded-lg border border-border p-3 text-xs text-gray-500 space-y-1">
          {question.examName && <p>📝 试卷：{question.examName}</p>}
          {question.grade && <p>📚 年级：{question.grade}{question.semester ? ` ${question.semester}` : ''}{question.unit ? ` · ${question.unit}` : ''}</p>}
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
