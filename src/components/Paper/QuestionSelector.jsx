import { useState, useMemo } from 'react'
import { GRADES, TOPICS } from '../../store/questionStore'
import MixedContent from '../common/MixedContent'

export default function QuestionSelector({ questions, selectedIds, onToggle, onReorder, groupOrder, onGroupOrderChange }) {
  const allTags = useMemo(() => {
    const tagSet = new Set()
    questions.forEach(q => (q.tags || []).forEach(t => tagSet.add(t)))
    return [...tagSet].sort()
  }, [questions])

  const [filters, setFilters] = useState({
    grade: '', topic: '', difficulty: '', tag: '', search: '',
  })

  // We use a local useState import — need to add it
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (filters.grade && q.grade !== filters.grade) return false
      if (filters.topic && q.topic !== filters.topic) return false
      if (filters.difficulty && q.difficulty !== Number(filters.difficulty)) return false
      if (filters.tag && !(q.tags || []).includes(filters.tag)) return false
      if (filters.search) {
        const s = filters.search.toLowerCase()
        const inContent = (q.content || '').toLowerCase().includes(s)
        const inAnswer = (q.answer || '').toLowerCase().includes(s)
        const inNotes = (q.notes || '').toLowerCase().includes(s)
        if (!inContent && !inAnswer && !inNotes) return false
      }
      return true
    })
  }, [questions, filters])

  const selectedQuestions = useMemo(() => {
    return selectedIds
      .map(id => questions.find(q => q.id === id))
      .filter(Boolean)
  }, [questions, selectedIds])

  const update = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const allFilteredSelected = filteredQuestions.length > 0 &&
    filteredQuestions.every(q => selectedIds.includes(q.id))

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      filteredQuestions.forEach(q => {
        if (selectedIds.includes(q.id)) onToggle(q.id)
      })
    } else {
      filteredQuestions.forEach(q => {
        if (!selectedIds.includes(q.id)) onToggle(q.id)
      })
    }
  }

  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex-shrink-0">
        <h3 className="font-heading text-sm font-semibold text-text mb-3">筛选题目</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">年级</label>
            <select
              value={filters.grade}
              onChange={(e) => update('grade', e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="">全部年级</option>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">知识板块</label>
            <select
              value={filters.topic}
              onChange={(e) => update('topic', e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="">全部板块</option>
              {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">难度</label>
            <select
              value={filters.difficulty}
              onChange={(e) => update('difficulty', e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="">全部难度</option>
              {[1, 2, 3, 4, 5].map(d => (
                <option key={d} value={d}>{'⭐'.repeat(d)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">标签</label>
            <select
              value={filters.tag}
              onChange={(e) => update('tag', e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="">全部标签</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <input
            type="text"
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
            placeholder="🔍 搜索题目内容..."
            className="w-full rounded-lg border border-border bg-gray-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            共 {filteredQuestions.length} 题，已选 {selectedIds.length} 题
          </span>
          <button
            onClick={toggleSelectAll}
            className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer"
          >
            {allFilteredSelected ? '取消全选' : '全选'}
          </button>
        </div>
      </div>

      {/* Filtered question list */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-3 flex-1 overflow-y-auto min-h-0">
        <h4 className="text-xs font-semibold text-gray-500 mb-2">筛选结果</h4>
        {filteredQuestions.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">没有匹配的题目</p>
        ) : (
          <div className="space-y-2">
            {filteredQuestions.map(q => {
              const isSelected = selectedIds.includes(q.id)
              return (
                <label
                  key={q.id}
                  className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors text-sm
                    ${isSelected ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50 border border-transparent'}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(q.id)}
                    className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      {q.questionType && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                          {q.questionType}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400">
                        {'⭐'.repeat(q.difficulty || 0)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-700 line-clamp-2 overflow-hidden">
                      <MixedContent content={(q.content || '').slice(0, 120)} />
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* Group order for nested mode */}
      {selectedQuestions.length > 0 && groupOrder && onGroupOrderChange && (
        <div className="bg-white rounded-xl border border-border shadow-sm p-3 flex-shrink-0">
          <h4 className="text-xs font-semibold text-gray-500 mb-2">题型分组顺序（嵌套模式）</h4>
          <div className="space-y-1">
            {groupOrder.map((type, idx) => (
              <div key={type} className="flex items-center gap-2 px-2 py-1 rounded bg-gray-50 text-xs group">
                <span className="text-gray-400 w-5 text-center flex-shrink-0">{idx + 1}</span>
                <span className="flex-1 text-gray-700">{'一二三四五六七八九十'[idx] || idx + 1}、{type}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {idx > 0 && (
                    <button onClick={() => {
                      const next = [...groupOrder];[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; onGroupOrderChange(next)
                    }} className="text-gray-400 hover:text-primary-600 cursor-pointer">↑</button>
                  )}
                  {idx < groupOrder.length - 1 && (
                    <button onClick={() => {
                      const next = [...groupOrder];[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; onGroupOrderChange(next)
                    }} className="text-gray-400 hover:text-primary-600 cursor-pointer">↓</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-300 mt-1">上下拖动调整题型出现顺序</p>
        </div>
      )}

      {/* Selected questions order */}
      {selectedQuestions.length > 0 && (
        <div className="bg-white rounded-xl border border-border shadow-sm p-3 flex-shrink-0 max-h-48 overflow-y-auto">
          <h4 className="text-xs font-semibold text-gray-500 mb-2">
            已选题目（拖拽调整顺序）
          </h4>
          <div className="space-y-1">
            {selectedQuestions.map((q, index) => (
              <div
                key={q.id}
                className="flex items-center gap-2 px-2 py-1 rounded bg-gray-50 text-xs group"
              >
                <span className="text-gray-400 w-5 text-center flex-shrink-0">
                  {index + 1}
                </span>
                <span className="flex-1 truncate text-gray-700">
                  {(q.content || '').slice(0, 40).replace(/\$\$?[^$]*\$\$?/g, '[公式]')}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {index > 0 && (
                    <button
                      onClick={() => onReorder(index, index - 1)}
                      className="text-gray-400 hover:text-primary-600 cursor-pointer"
                      title="上移"
                    >
                      ↑
                    </button>
                  )}
                  {index < selectedQuestions.length - 1 && (
                    <button
                      onClick={() => onReorder(index, index + 1)}
                      className="text-gray-400 hover:text-primary-600 cursor-pointer"
                      title="下移"
                    >
                      ↓
                    </button>
                  )}
                  <button
                    onClick={() => onToggle(q.id)}
                    className="text-gray-400 hover:text-red-500 cursor-pointer"
                    title="移除"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
