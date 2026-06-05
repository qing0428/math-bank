import { useState, useEffect } from 'react'
import 'katex/dist/katex.min.css'
import MixedContent from '../common/MixedContent'
import StarRating from '../QuestionEntry/StarRating'
import { GRADES, TOPICS, getQuestionTypesForGrade } from '../../store/questionStore'
import { findSimilarQuestions } from '../../services/compositionService'

function stripForPreview(text) {
  if (!text) return ''
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, '…')
    .replace(/\$[^$]*\$/g, '…')
    .replace(/\\[a-zA-Z]+\{?[^}]*\}?/g, '')
    .replace(/[{}\\^_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function useIsTallImage(src) {
  const [tall, setTall] = useState(false)
  useEffect(() => {
    if (!src) return
    const img = new Image()
    img.onload = () => setTall(img.naturalHeight > img.naturalWidth * 1.3)
    img.src = src
  }, [src])
  return tall
}

function QuestionContent({ q }) {
  const tall = useIsTallImage(q.imageUrl)

  if (!q.imageUrl) {
    return <MixedContent content={q.content} />
  }

  if (tall) {
    return (
      <div>
        <MixedContent content={q.content} />
        <img src={q.imageUrl} alt="题目图片"
          className="w-full max-h-40 rounded border border-border object-contain mt-2" />
      </div>
    )
  }

  return (
    <div className="flex gap-3 items-start">
      <img src={q.imageUrl} alt="题目图片"
        className="max-h-24 rounded border border-border object-contain flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <MixedContent content={q.content} />
      </div>
    </div>
  )
}

export default function SearchResults({ results, onEdit, onDelete, allQuestions, llmConfig }) {
  const [detailQuestion, setDetailQuestion] = useState(null)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [similarTarget, setSimilarTarget] = useState(null)
  const [similarResults, setSimilarResults] = useState([])
  const [similarLoading, setSimilarLoading] = useState(false)
  const [similarError, setSimilarError] = useState('')

  const textConfigured = llmConfig?.text?.connected && llmConfig?.text?.model

  const handleFindSimilar = async (question) => {
    setSimilarTarget(question)
    setSimilarResults([])
    setSimilarError('')
    setSimilarLoading(true)

    try {
      const results = await findSimilarQuestions(question, allQuestions || [], llmConfig?.text || {}, 5)
      setSimilarResults(results)
    } catch (err) {
      setSimilarError(err.message || '查找失败')
    } finally {
      setSimilarLoading(false)
    }
  }

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-gray-400 text-sm">没有找到匹配的题目</p>
        <p className="text-gray-300 text-xs mt-1">尝试调整筛选条件</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 mb-2">共找到 {results.length} 道题目</p>
      {results.map(q => (
        <div
          key={q.id}
          className="bg-white rounded-xl border border-border shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => setDetailQuestion(q)}
        >
          <div className="flex items-start justify-between gap-3">
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="mb-2">
                {q.content ? (
                  <QuestionContent q={q} />
                ) : (
                  <p className="text-gray-400 text-sm italic">无题目内容</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                {q.grade && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">📚 {q.grade}</span>}
                {q.topic && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">📂 {q.topic}</span>}
                {q.difficulty > 0 && <StarRating value={q.difficulty} size="sm" />}
                {q.tags?.slice(0, 3).map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">🏷️ {tag}</span>
                ))}
                {q.tags?.length > 3 && <span className="text-xs text-gray-400">+{q.tags.length - 3}</span>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
              {textConfigured && (
                <button
                  onClick={() => handleFindSimilar(q)}
                  className="px-3 py-1.5 rounded-lg bg-purple-50 text-purple-600 text-xs font-medium hover:bg-purple-100 transition-colors cursor-pointer"
                  title="查找相似题目"
                >
                  🔍 相似
                </button>
              )}
              <button
                onClick={() => setEditingQuestion({ ...q })}
                className="px-3 py-1.5 rounded-lg bg-primary-50 text-primary-600 text-xs font-medium hover:bg-primary-100 transition-colors cursor-pointer"
              >
                编辑
              </button>
              <button
                onClick={() => onDelete?.(q.id)}
                className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors cursor-pointer"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Detail Modal */}
      {detailQuestion && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setDetailQuestion(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="text-sm font-semibold text-text">题目详情</h3>
              <button
                onClick={() => setDetailQuestion(null)}
                className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Content + Image */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">题目内容</p>
                <div className="bg-gray-50 rounded-lg border border-border p-3">
                  {detailQuestion.imageUrl ? (
                    <div>
                      <div className="text-sm text-gray-800 leading-relaxed mb-3">
                        <MixedContent content={detailQuestion.content || ''} answer={detailQuestion.answer} />
                      </div>
                      <img
                        src={detailQuestion.imageUrl}
                        alt="题目图片"
                        className="max-w-full max-h-60 object-contain rounded border border-border mx-auto"
                      />
                    </div>
                  ) : (
                    <div className="text-sm text-gray-800 leading-relaxed">
                      <MixedContent content={detailQuestion.content || ''} answer={detailQuestion.answer} />
                    </div>
                  )}
                </div>
              </div>

              {/* Answer */}
              {detailQuestion.answer && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">答案</p>
                  <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 text-sm text-blue-800">
                    <MixedContent content={detailQuestion.answer} />
                  </div>
                </div>
              )}

              {/* Solution */}
              {detailQuestion.solution && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">解析</p>
                  <div className="bg-gray-50 rounded-lg border border-border p-3 text-sm text-gray-700 max-h-60 overflow-y-auto">
                    <MixedContent content={detailQuestion.solution} />
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-2">
                {detailQuestion.grade && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">📚 {detailQuestion.grade}</span>}
                {detailQuestion.topic && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">📂 {detailQuestion.topic}</span>}
                {detailQuestion.questionType && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">📝 {detailQuestion.questionType}</span>}
                {detailQuestion.difficulty > 0 && <StarRating value={detailQuestion.difficulty} size="sm" />}
              </div>

              {/* Tags */}
              {detailQuestion.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detailQuestion.tags.map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">🏷️ {tag}</span>
                  ))}
                </div>
              )}

              {/* Notes */}
              {detailQuestion.notes && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">备注</p>
                  <p className="text-xs text-gray-600 bg-gray-50 rounded p-2">{detailQuestion.notes}</p>
                </div>
              )}

              {/* Timestamps */}
              <p className="text-xs text-gray-300">
                创建于 {new Date(detailQuestion.createdAt).toLocaleDateString('zh-CN')} ·
                更新于 {new Date(detailQuestion.updatedAt).toLocaleDateString('zh-CN')}
              </p>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border flex justify-end gap-2 flex-shrink-0">
              <button
                onClick={() => { setDetailQuestion(null); setEditingQuestion({ ...detailQuestion }) }}
                className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer"
              >
                编辑
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Similar Questions Dialog */}
      {similarTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSimilarTarget(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="text-sm font-semibold text-text">🔍 相似题目</h3>
              <button onClick={() => setSimilarTarget(null)} className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer">✕</button>
            </div>

            {/* Target question summary */}
            <div className="px-5 py-3 bg-gray-50 border-b border-border flex-shrink-0">
              <p className="text-xs text-gray-400 mb-1">目标题目</p>
              <p className="text-sm text-gray-700 line-clamp-2">{stripForPreview(similarTarget.content)}</p>
              <div className="flex gap-2 mt-1">
                {similarTarget.grade && <span className="text-xs text-blue-600">{similarTarget.grade}</span>}
                {similarTarget.topic && <span className="text-xs text-green-600">{similarTarget.topic}</span>}
                {similarTarget.difficulty > 0 && <span className="text-xs text-amber-600">难度{similarTarget.difficulty}</span>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {similarLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin text-3xl mb-2">⏳</div>
                  <p className="text-sm text-gray-500">AI 正在查找相似题目...</p>
                </div>
              ) : similarError ? (
                <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-red-600 text-sm">
                  ❌ {similarError}
                </div>
              ) : similarResults.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  未找到相似题目
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 mb-2">找到 {similarResults.length} 道相似题目</p>
                  {similarResults.map((sq, i) => (
                    <div key={sq.id} className="bg-gray-50 rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 mb-1">#{i + 1}</p>
                          <div className="text-sm text-gray-700 mb-2">
                            <MixedContent content={sq.content || ''} />
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {sq.grade && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{sq.grade}</span>}
                            {sq.topic && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">{sq.topic}</span>}
                            {sq.difficulty > 0 && <StarRating value={sq.difficulty} size="sm" />}
                            {sq.tags?.slice(0, 2).map(tag => (
                              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border flex justify-end flex-shrink-0">
              <button
                onClick={() => setSimilarTarget(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingQuestion(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="text-sm font-semibold text-text">编辑题目</h3>
              <button onClick={() => setEditingQuestion(null)} className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">题目内容</label>
                <textarea value={editingQuestion.content || ''} onChange={e => setEditingQuestion(p => ({ ...p, content: e.target.value }))} rows={4} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">答案</label>
                <textarea value={editingQuestion.answer || ''} onChange={e => setEditingQuestion(p => ({ ...p, answer: e.target.value }))} rows={2} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">解析</label>
                <textarea value={editingQuestion.solution || ''} onChange={e => setEditingQuestion(p => ({ ...p, solution: e.target.value }))} rows={4} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">年级</label>
                  <select value={editingQuestion.grade || ''} onChange={e => setEditingQuestion(p => ({ ...p, grade: e.target.value, questionType: '' }))} className="w-full rounded-lg border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                    <option value="">未选</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">知识板块</label>
                  <select value={editingQuestion.topic || ''} onChange={e => setEditingQuestion(p => ({ ...p, topic: e.target.value }))} className="w-full rounded-lg border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                    <option value="">未选</option>
                    {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">题型</label>
                  <select value={editingQuestion.questionType || ''} onChange={e => setEditingQuestion(p => ({ ...p, questionType: e.target.value }))} className="w-full rounded-lg border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                    <option value="">未选</option>
                    {getQuestionTypesForGrade(editingQuestion.grade).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">难度</label>
                  <StarRating value={editingQuestion.difficulty || 0} onChange={v => setEditingQuestion(p => ({ ...p, difficulty: v }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">备注</label>
                  <input value={editingQuestion.notes || ''} onChange={e => setEditingQuestion(p => ({ ...p, notes: e.target.value }))} className="w-full rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">标签（用逗号分隔）</label>
                <input value={(editingQuestion.tags || []).join(', ')} onChange={e => setEditingQuestion(p => ({ ...p, tags: e.target.value.split(/[,，]/).map(t => t.trim()).filter(Boolean) }))} className="w-full rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" placeholder="如：计算, 方程, 应用题" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end gap-2 flex-shrink-0">
              <button onClick={() => setEditingQuestion(null)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 cursor-pointer">取消</button>
              <button onClick={() => { onEdit?.(editingQuestion); setEditingQuestion(null) }} className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
