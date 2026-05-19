import { useRef } from 'react'
import StatsCard from './StatsCard'
import TagCloud from './TagCloud'
import { getStats, exportToJSON, importFromJSON } from '../../store/questionStore'

export default function Dashboard({ questions, setQuestions }) {
  const stats = getStats(questions)
  const fileInputRef = useRef(null)

  const handleExport = () => {
    if (questions.length === 0) {
      alert('题库为空，无需导出')
      return
    }
    exportToJSON(questions)
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const data = await importFromJSON(file)
      const mergeMode = confirm(
        `导入文件包含 ${data.length} 道题目。\n\n点击「确定」合并到现有题库\n点击「取消」覆盖现有题库`
      )

      if (mergeMode) {
        // Merge: deduplicate by content
        const existingContents = new Set(questions.map(q => q.content))
        const newItems = data.filter(q => !existingContents.has(q.content))
        setQuestions([...questions, ...newItems])
        alert(`成功导入 ${newItems.length} 道新题目（跳过 ${data.length - newItems.length} 道重复）`)
      } else {
        setQuestions(data)
        alert(`已覆盖，当前题库共 ${data.length} 道题目`)
      }
    } catch (err) {
      alert('导入失败：' + err.message)
    }

    // Reset input
    e.target.value = ''
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-text">数据概览</h2>
          <p className="text-gray-500 text-sm mt-1">题库统计信息一览</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-lg bg-white border border-border text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
          >
            📤 导出 JSON
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer shadow-sm"
          >
            📥 导入 JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatsCard icon="📚" label="题库总题目数" value={stats.total} color="primary" />
        <StatsCard icon="🆕" label="今日新增题目" value={stats.todayNew} color="green" />
        <StatsCard icon="✏️" label="今日改动题目" value={stats.todayModified} color="amber" />
        <StatsCard icon="⭐" label="平均难度星级" value={stats.avgDifficulty} sub="满分 5 星" color="orange" />
        <StatsCard icon="🏷️" label="标签总数" value={stats.topTags.length} color="purple" />
        <StatsCard icon="📅" label="最近更新" value={questions.length > 0 ? new Date(Math.max(...questions.map(q => q.updatedAt))).toLocaleDateString('zh-CN') : '-'} sub="最近一条" color="primary" />
      </div>

      {/* Tag Cloud */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-6">
        <h3 className="font-heading text-lg font-semibold text-text mb-4">热门标签</h3>
        <TagCloud tags={stats.topTags} />
      </div>
    </div>
  )
}
