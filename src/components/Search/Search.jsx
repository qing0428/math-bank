import { useState, useMemo } from 'react'
import SearchFilters from './SearchFilters'
import SearchResults from './SearchResults'

export default function Search({ questions, setQuestions }) {
  const [filters, setFilters] = useState({
    grade: '',
    topic: '',
    difficulty: '',
    tag: '',
    search: '',
  })

  // Get all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set()
    questions.forEach(q => (q.tags || []).forEach(t => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [questions])

  // Filter questions
  const results = useMemo(() => {
    return questions.filter(q => {
      if (filters.grade && q.grade !== filters.grade) return false
      if (filters.semester && q.semester !== filters.semester) return false
      if (filters.unit && q.unit !== filters.unit) return false
      if (filters.topic && q.topic !== filters.topic) return false
      if (filters.difficulty && q.difficulty !== filters.difficulty) return false
      if (filters.tag && !(q.tags || []).includes(filters.tag)) return false
      if (filters.search) {
        const s = filters.search.toLowerCase()
        const matchContent = (q.content || '').toLowerCase().includes(s)
        const matchAnswer = (q.answer || '').toLowerCase().includes(s)
        const matchNotes = (q.notes || '').toLowerCase().includes(s)
        if (!matchContent && !matchAnswer && !matchNotes) return false
      }
      return true
    })
  }, [questions, filters])

  const handleDelete = (id) => {
    if (confirm('确定要删除这道题目吗？')) {
      setQuestions(questions.filter(q => q.id !== id))
    }
  }

  const handleEdit = (updatedQ) => {
    setQuestions(questions.map(q => q.id === updatedQ.id ? { ...updatedQ, updatedAt: Date.now() } : q))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h2 className="font-heading text-2xl font-bold text-text">题库</h2>
        <p className="text-gray-500 text-sm mt-1">按年级、知识板块、难度、标签等维度自由组合筛选</p>
      </div>

      <SearchFilters filters={filters} onChange={setFilters} allTags={allTags} />

      <div className="mt-4">
        <SearchResults results={results} onEdit={handleEdit} onDelete={handleDelete} />
      </div>
    </div>
  )
}
