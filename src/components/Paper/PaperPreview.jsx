import { useMemo } from 'react'
import MixedContent from '../common/MixedContent'
import { generateFlatNumbers, generateNestedNumbers } from '../../utils/numbering'

const NEEDS_SPACE_TYPES = ['解决问题', '解答题', '证明题', '画图题']

export default function PaperPreview({
  questions,
  numberingMode,
  previewMode,
  paperTitle,
}) {
  const numbered = useMemo(() => {
    if (questions.length === 0) return []
    if (numberingMode === 'flat') return generateFlatNumbers(questions)
    return generateNestedNumbers(questions)
  }, [questions, numberingMode])

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-y-auto h-full" data-paper-container>
      <div className="mx-auto max-w-[794px] p-8">
        {/* Header */}
        <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-gray-900 font-heading tracking-wider">
            {paperTitle || '数学试卷'}
          </h1>
          <div className="flex justify-between mt-3 text-sm text-gray-600">
            <span>姓名：_______________</span>
            <span>班级：_______________</span>
            <span>得分：_______/{questions.length * 10}</span>
          </div>
        </div>

        {/* Questions */}
        {numbered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">请从左侧选择题目</p>
          </div>
        ) : (
          renderQuestionList(numbered, previewMode, numberingMode)
        )}

        {/* Teacher answers */}
        {previewMode === 'teacher' && questions.length > 0 && (
          <div className="mt-12 pt-4 border-t-2 border-dashed border-red-300">
            <h2 className="text-xl font-bold text-red-700 mb-6 text-center">参考答案</h2>
            {renderAnswerList(numbered, numberingMode)}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Question list ───────────────────────────────────────────

function renderQuestionList(numbered, previewMode, numberingMode) {
  if (numberingMode === 'nested') return renderNestedQuestions(numbered, previewMode)
  return renderFlatQuestions(numbered, previewMode)
}

function renderNestedQuestions(numbered, previewMode) {
  const elements = []
  let currentGroupLabel = null
  numbered.forEach((item, idx) => {
    if (item.groupLabel) {
      currentGroupLabel = item.groupLabel
      elements.push(
        <div key={`group-${idx}`} className="mt-3 first:mt-0">
          <h3 className="text-sm font-bold text-gray-800 border-b border-gray-200 pb-1 mb-2">
            {currentGroupLabel}
          </h3>
          <QuestionItem item={item} previewMode={previewMode} />
        </div>
      )
    } else {
      elements.push(<QuestionItem key={`q-${idx}`} item={item} previewMode={previewMode} />)
    }
  })
  return elements
}

function renderFlatQuestions(numbered, previewMode) {
  return numbered.map((item, idx) => (
    <QuestionItem key={`q-${idx}`} item={item} previewMode={previewMode} />
  ))
}

function QuestionItem({ item, previewMode }) {
  const q = item.question
  const pos = q.imagePosition || 'right'
  const needsSpace = NEEDS_SPACE_TYPES.includes(q.questionType)

  return (
    <div className="question-block mb-3">
      <div className="flex gap-1.5">
        <span className="question-number font-bold text-gray-800 flex-shrink-0 text-sm">
          {item.number}
        </span>
        <div className="flex-1">
          {q.imageUrl && pos === 'below' ? (
            <div>
              <div className="text-gray-800 leading-relaxed text-sm">
                <MixedContent content={q.content || ''} answer={q.answer} />
              </div>
              <img src={q.imageUrl} alt="题目图片"
                className="w-full max-h-48 object-contain mt-1 rounded border border-gray-200" />
            </div>
          ) : (
            <div className="flex gap-2 items-start">
              <div className="flex-1 min-w-0 text-gray-800 leading-relaxed text-sm">
                <MixedContent content={q.content || ''} answer={q.answer} />
              </div>
              {q.imageUrl && pos !== 'below' && (
                <img src={q.imageUrl} alt="题目图片"
                  className="w-1/4 max-h-32 object-contain rounded border border-gray-200 flex-shrink-0" />
              )}
            </div>
          )}
          {previewMode === 'student' && needsSpace && (
            <div className="mt-2 border-b border-dashed border-gray-300 h-20" />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Answer list ─────────────────────────────────────────────

function renderAnswerList(numbered, numberingMode) {
  if (numberingMode === 'nested') return renderNestedAnswers(numbered)
  return renderFlatAnswers(numbered)
}

function renderNestedAnswers(numbered) {
  const elements = []
  let currentGroupLabel = null
  numbered.forEach((item, idx) => {
    if (item.groupLabel) {
      currentGroupLabel = item.groupLabel
      elements.push(
        <div key={`ag-${idx}`} className="mt-2 first:mt-0">
          <h4 className="text-xs font-bold text-gray-600 mb-1">{currentGroupLabel}</h4>
          {renderAnswerItem(item, idx)}
        </div>
      )
    } else {
      elements.push(renderAnswerItem(item, idx))
    }
  })
  return elements
}

function renderFlatAnswers(numbered) {
  return numbered.map((item, idx) => renderAnswerItem(item, idx))
}

function renderAnswerItem(item, idx) {
  const q = item.question
  return (
    <div key={idx} className="answer-block mb-1.5 flex gap-1.5 text-xs">
      <span className="font-bold text-gray-700 flex-shrink-0">{item.number}</span>
      <div className="flex-1">
        {q.answer ? (
          <span className="text-blue-700">
            <span className="font-medium">答：</span>
            <MixedContent content={q.answer} />
          </span>
        ) : (
          <span className="text-gray-400 italic">（暂无）</span>
        )}
        {q.solution && (
          <span className="text-gray-500 ml-2">
            <span className="font-medium">解：</span>
            <MixedContent content={q.solution} />
          </span>
        )}
      </div>
    </div>
  )
}
