import { useRef } from 'react'
import { exportToJSON, importFromJSON } from '../../store/questionStore'

export default function Header({ questions, onSearch, onImport }) {
  const fileRef = useRef(null)

  const handleSearchInput = (e) => {
    const val = e.target.value
    onSearch?.(val)
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await importFromJSON(file)
      onImport?.(data)
    } catch (err) {
      alert('导入失败：' + (err.message || '文件格式错误'))
    }
    e.target.value = ''
  }

  return (
    <header className="h-14 bg-white border-b border-border flex items-center px-5 gap-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mr-2">
        <span className="text-xl">📐</span>
        <span className="font-heading font-bold text-lg text-text">MathBank</span>
      </div>

      {/* Question Count */}
      <div className="flex items-center gap-1.5 px-3 py-1 bg-primary-50 rounded-full">
        <span className="text-xs text-primary-600">题库</span>
        <span className="text-sm font-bold text-primary-700">{questions.length}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          onChange={handleSearchInput}
          placeholder="搜索题目内容、答案..."
          className="w-64 h-9 pl-9 pr-3 rounded-lg border border-border bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 focus:bg-white transition-colors"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Import / Export */}
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="h-9 px-3 rounded-lg border border-border text-sm text-gray-600 hover:bg-gray-50 hover:border-primary-300 transition-colors cursor-pointer"
        >
          导入
        </button>
        <button
          onClick={() => {
            if (questions.length === 0) {
              alert('题库为空，无法导出')
              return
            }
            exportToJSON(questions)
          }}
          className="h-9 px-3 rounded-lg border border-border text-sm text-gray-600 hover:bg-gray-50 hover:border-primary-300 transition-colors cursor-pointer"
        >
          导出
        </button>
      </div>
    </header>
  )
}
