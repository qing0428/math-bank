import { GRADES, SEMESTERS, TOPICS, getUnitsForGrade } from '../../store/questionStore'

export default function SearchFilters({ filters, onChange, allTags }) {
  const update = (key, value) => {
    onChange?.({ ...filters, [key]: value })
  }

  const clearAll = () => {
    onChange?.({ grade: '', semester: '', unit: '', topic: '', difficulty: '', tag: '', search: '' })
  }

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5">
      <h3 className="font-heading text-base font-semibold text-text mb-4">筛选条件</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Grade */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">年级</label>
          <select
            value={filters.grade || ''}
            onChange={(e) => {
              const newGrade = e.target.value
              onChange?.({ ...filters, grade: newGrade, semester: '', unit: '' })
            }}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
          >
            <option value="">全部年级</option>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        {/* Semester */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">上/下册</label>
          <select
            value={filters.semester || ''}
            onChange={(e) => {
              const newSemester = e.target.value
              onChange?.({ ...filters, semester: newSemester, unit: '' })
            }}
            disabled={!filters.grade}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">全部</option>
            {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Unit */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">单元</label>
          <select
            value={filters.unit || ''}
            onChange={(e) => update('unit', e.target.value)}
            disabled={!filters.grade || !filters.semester}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">全部单元</option>
            {getUnitsForGrade(filters.grade, filters.semester).map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        {/* Topic */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">知识板块</label>
          <select
            value={filters.topic || ''}
            onChange={(e) => update('topic', e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
          >
            <option value="">全部板块</option>
            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Difficulty */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">难度星级</label>
          <select
            value={filters.difficulty || ''}
            onChange={(e) => update('difficulty', e.target.value ? Number(e.target.value) : '')}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
          >
            <option value="">全部难度</option>
            {[1, 2, 3, 4, 5].map(d => (
              <option key={d} value={d}>{d} 星</option>
            ))}
          </select>
        </div>

        {/* Tag */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">标签</label>
          <select
            value={filters.tag || ''}
            onChange={(e) => update('tag', e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
          >
            <option value="">全部标签</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Active filters */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(filters).filter(([, v]) => v).map(([key, value]) => (
            <span key={key} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary-100 text-primary-700 text-xs">
              {key === 'grade' && `📚 ${value}`}
              {key === 'semester' && `📖 ${value}`}
              {key === 'unit' && `📄 ${value}`}
              {key === 'topic' && `📂 ${value}`}
              {key === 'difficulty' && `⭐ ${value}星`}
              {key === 'tag' && `🏷️ ${value}`}
              <button onClick={() => {
                if (key === 'grade') onChange?.({ ...filters, grade: '', semester: '', unit: '' })
                else if (key === 'semester') onChange?.({ ...filters, semester: '', unit: '' })
                else update(key, '')
              }} className="hover:text-red-500 ml-0.5 cursor-pointer">×</button>
            </span>
          ))}
        </div>
        <button
          onClick={clearAll}
          className="text-xs text-gray-400 hover:text-primary-500 transition-colors cursor-pointer"
        >
          清除全部
        </button>
      </div>

      {/* Text search */}
      <div className="mt-4">
        <input
          type="text"
          value={filters.search || ''}
          onChange={(e) => update('search', e.target.value)}
          placeholder="🔍 搜索题目内容、答案、备注..."
          className="w-full rounded-lg border border-border bg-gray-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
        />
      </div>
    </div>
  )
}
