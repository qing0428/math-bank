import { useState } from 'react'

export default function PaperSettings({
  numberingMode,
  onNumberingModeChange,
  pageSize,
  onPageSizeChange,
  previewMode,
  onPreviewModeChange,
  paperTitle,
  onPaperTitleChange,
  onExport,
  selectedCount,
}) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async (format, version) => {
    if (selectedCount === 0) return
    setExporting(true)
    try {
      await onExport(format, version)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Paper title */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 whitespace-nowrap">试卷名称</label>
          <input
            type="text"
            value={paperTitle}
            onChange={(e) => onPaperTitleChange(e.target.value)}
            placeholder="数学试卷"
            className="rounded-lg border border-border px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        {/* Numbering mode */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 whitespace-nowrap">编号方式</label>
          <select
            value={numberingMode}
            onChange={(e) => onNumberingModeChange(e.target.value)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="nested">一、1.（1）① 嵌套</option>
            <option value="flat">1.2.3. 平铺</option>
          </select>
        </div>

        {/* Page size */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 whitespace-nowrap">纸面大小</label>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {['A4', 'A3'].map(size => (
              <button
                key={size}
                onClick={() => onPageSizeChange(size)}
                className={`px-3 py-1.5 text-sm cursor-pointer transition-colors
                  ${pageSize === size
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Preview mode */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 whitespace-nowrap">预览</label>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {[
              { value: 'student', label: '学生版' },
              { value: 'teacher', label: '教师版' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => onPreviewModeChange(opt.value)}
                className={`px-3 py-1.5 text-sm cursor-pointer transition-colors
                  ${previewMode === opt.value
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Export buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('word', 'student')}
            disabled={selectedCount === 0 || exporting}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-blue-500 text-white
              hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
              transition-colors"
            title="导出学生版 Word"
          >
            📄 Word（学生）
          </button>
          <button
            onClick={() => handleExport('word', 'teacher')}
            disabled={selectedCount === 0 || exporting}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white
              hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
              transition-colors"
            title="导出教师版 Word"
          >
            📄 Word（教师）
          </button>
          <button
            onClick={() => handleExport('pdf', 'student')}
            disabled={selectedCount === 0 || exporting}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-red-500 text-white
              hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
              transition-colors"
            title="导出学生版 PDF"
          >
            📕 PDF（学生）
          </button>
          <button
            onClick={() => handleExport('pdf', 'teacher')}
            disabled={selectedCount === 0 || exporting}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-red-600 text-white
              hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
              transition-colors"
            title="导出教师版 PDF"
          >
            📕 PDF（教师）
          </button>
        </div>
      </div>

      {exporting && (
        <div className="mt-2 text-xs text-primary-600 flex items-center gap-1">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          正在生成文件，请稍候...
        </div>
      )}
    </div>
  )
}
