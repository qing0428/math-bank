import { useMemo } from 'react'
import MixedContent from '../common/MixedContent'
import { generateFlatNumbers, generateNestedNumbers } from '../../utils/numbering'

export default function PaperPreview({
  questions,
  numberingMode,
  pageSize,
  previewMode,
  paperTitle,
}) {
  const numbered = useMemo(() => {
    if (questions.length === 0) return []
    if (numberingMode === 'flat') return generateFlatNumbers(questions)
    return generateNestedNumbers(questions)
  }, [questions, numberingMode])

  const totalScore = questions.length * 10 // 默认每题10分

  const pageClass = pageSize === 'A3'
    ? 'max-w-[1122px]' // A3 width at ~96dpi scaled
    : 'max-w-[794px]'  // A4 width at ~96dpi

  return (
    <div
      className={`bg-white rounded-xl border border-border shadow-sm overflow-y-auto h-full`}
      data-paper-container
    >
      <div className={`mx-auto ${pageClass} p-8`}>
        {/* Paper Header */}
        <div className="text-center mb-8 border-b-2 border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-gray-900 font-heading tracking-wider">
            {paperTitle || '数学试卷'}
          </h1>
          <div className="flex justify-between mt-3 text-sm text-gray-600">
            <span>姓名：_______________</span>
            <span>班级：_______________</span>
            <span>得分：_______/{totalScore}</span>
          </div>
        </div>

        {/* Questions */}
        {numbered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">👈 请从左侧选择题目</p>
            <p className="text-sm mt-2">筛选后勾选题目即可预览试卷</p>
          </div>
        ) : (
          <div className="space-y-6">
            {numberingMode === 'nested'
              ? renderNestedQuestions(numbered, previewMode)
              : renderFlatQuestions(numbered, previewMode)
            }
          </div>
        )}

        {/* Teacher version separator */}
        {previewMode === 'teacher' && questions.length > 0 && (
          <div className="mt-12 pt-4 border-t-2 border-dashed border-red-300">
            <h2 className="text-xl font-bold text-red-700 mb-6 text-center">
              ———— 参考答案 ————
            </h2>
            {numberingMode === 'nested'
              ? renderNestedAnswers(numbered)
              : renderFlatAnswers(numbered)
            }
          </div>
        )}
      </div>
    </div>
  )
}

function renderNestedQuestions(numbered, previewMode) {
  const elements = []
  let currentGroupLabel = null

  numbered.forEach((item, idx) => {
    if (item.groupLabel) {
      currentGroupLabel = item.groupLabel
      elements.push(
        <div key={`group-${idx}`} className="mt-4 first:mt-0">
          <h3 className="text-base font-bold text-gray-800 border-b border-gray-200 pb-1 mb-3">
            {currentGroupLabel}
          </h3>
          {renderQuestionItem(item, previewMode, idx)}
        </div>
      )
    } else {
      elements.push(
        <div key={`q-${idx}`}>
          {renderQuestionItem(item, previewMode, idx)}
        </div>
      )
    }
  })

  return elements
}

function renderFlatQuestions(numbered, previewMode) {
  return numbered.map((item, idx) => (
    <div key={`q-${idx}`}>
      {renderQuestionItem(item, previewMode, idx)}
    </div>
  ))
}

function renderQuestionItem(item, previewMode, idx) {
  const q = item.question
  return (
    <div className="question-block mb-4">
      <div className="flex gap-2">
        <span className="question-number font-bold text-gray-800 flex-shrink-0">
          {item.number}
        </span>
        <div className="flex-1">
          <div className="text-gray-800 leading-relaxed">
            <MixedContent content={q.content || ''} />
          </div>
          {q.imageUrl && (
            <img
              src={q.imageUrl}
              alt="题目图片"
              className="question-image max-w-[80%] max-h-60 mt-2 rounded border border-gray-200"
            />
          )}
          {/* Answer area lines for student version */}
          {previewMode === 'student' && (
            <div className="mt-2 border-b border-dashed border-gray-300 h-16" />
          )}
        </div>
      </div>
    </div>
  )
}

function renderNestedAnswers(numbered) {
  const elements = []
  let currentGroupLabel = null

  numbered.forEach((item, idx) => {
    if (item.groupLabel) {
      currentGroupLabel = item.groupLabel
      elements.push(
        <div key={`ans-group-${idx}`} className="mt-3 first:mt-0">
          <h4 className="text-sm font-bold text-gray-600 mb-2">
            {currentGroupLabel}
          </h4>
          {renderAnswerItem(item, idx)}
        </div>
      )
    } else {
      elements.push(
        <div key={`ans-${idx}`}>
          {renderAnswerItem(item, idx)}
        </div>
      )
    }
  })

  return elements
}

function renderFlatAnswers(numbered) {
  return numbered.map((item, idx) => (
    <div key={`ans-${idx}`}>
      {renderAnswerItem(item, idx)}
    </div>
  ))
}

function renderAnswerItem(item, idx) {
  const q = item.question
  const hasAnswer = q.answer && q.answer.trim()
  const hasSolution = q.solution && q.solution.trim()

  return (
    <div className="answer-block mb-3 flex gap-2 text-sm">
      <span className="font-bold text-gray-700 flex-shrink-0">
        {item.number}
      </span>
      <div className="flex-1">
        {hasAnswer ? (
          <div className="text-blue-700">
            <span className="font-medium">答案：</span>
            <MixedContent content={q.answer} />
          </div>
        ) : (
          <span className="text-gray-400 italic">（暂无答案）</span>
        )}
        {hasSolution && (
          <div className="text-gray-600 mt-1 text-xs">
            <span className="font-medium">解析：</span>
            <MixedContent content={q.solution} />
          </div>
        )}
      </div>
    </div>
  )
}
