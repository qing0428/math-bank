import { useRef, useState } from 'react'
import StatsCard from './StatsCard'
import TagCloud from './TagCloud'
import { getStats, exportToJSON, importFromJSON } from '../../store/questionStore'
import { normalizeTags } from '../../utils/tagNormalize'
import { migrateImages } from '../../services/questionApi'

export default function Dashboard({ questions, setQuestions }) {
  const stats = getStats(questions)
  const fileInputRef = useRef(null)
  const [cleaning, setCleaning] = useState(false)
  const [migrating, setMigrating] = useState(false)

  const handleExport = () => {
    if (questions.length === 0) {
      alert('题库为空，无需导出')
      return
    }
    exportToJSON(questions)
  }

  const handleCleanTags = () => {
    if (questions.length === 0) {
      alert('题库为空，无需清洗')
      return
    }

    setCleaning(true)

    // Find questions whose tags would change after normalization
    let changedCount = 0
    const updated = questions.map(q => {
      const normalized = normalizeTags(q.tags)
      const isChanged = JSON.stringify(normalized) !== JSON.stringify(q.tags)
      if (isChanged) changedCount++
      return isChanged ? { ...q, tags: normalized, updatedAt: Date.now() } : q
    })

    if (changedCount === 0) {
      alert('✅ 所有标签已是标准格式，无需清洗')
      setCleaning(false)
      return
    }

    if (confirm(`发现 ${changedCount} 道题目的标签需要标准化。是否执行清洗？`)) {
      setQuestions(updated)
      alert(`✅ 已清洗 ${changedCount} 道题目的标签`)
    }

    setCleaning(false)
  }

  const handleMigrateImages = async () => {
    if (questions.length === 0) {
      alert('题库为空，无需迁移')
      return
    }

    const base64Count = questions.filter(q => q.imageUrl?.startsWith('data:')).length
    if (base64Count === 0) {
      alert('✅ 所有图片已是文件存储格式，无需迁移')
      return
    }

    if (confirm(`发现 ${base64Count} 张 base64 图片需要迁移到文件存储。是否执行？`)) {
      setMigrating(true)
      try {
        const result = await migrateImages()
        alert(`✅ 迁移完成！成功 ${result.migrated} 张，失败 ${result.failed} 张`)
        // Reload questions to get updated URLs
        window.location.reload()
      } catch (err) {
        alert('迁移失败：' + err.message)
      } finally {
        setMigrating(false)
      }
    }
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
            onClick={handleMigrateImages}
            disabled={migrating}
            className="px-4 py-2 rounded-lg bg-white border border-border text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
          >
            {migrating ? '⏳ 迁移中...' : '🖼️ 图片迁移'}
          </button>
          <button
            onClick={handleCleanTags}
            disabled={cleaning}
            className="px-4 py-2 rounded-lg bg-white border border-border text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
          >
            {cleaning ? '⏳ 清洗中...' : '🏷️ 标签清洗'}
          </button>
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

      {/* Semester & Unit Stats */}
      {(stats.topSemesters.length > 0 || stats.topUnits.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {stats.topSemesters.length > 0 && (
            <div className="bg-white rounded-xl border border-border shadow-sm p-6">
              <h3 className="font-heading text-lg font-semibold text-text mb-4">📖 按册分布</h3>
              <div className="space-y-2">
                {stats.topSemesters.map(({ name, count }) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 w-32 truncate">{name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-primary-400 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (count / stats.total) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {stats.topUnits.length > 0 && (
            <div className="bg-white rounded-xl border border-border shadow-sm p-6">
              <h3 className="font-heading text-lg font-semibold text-text mb-4">📄 热门单元</h3>
              <div className="space-y-2">
                {stats.topUnits.map(({ name, count }) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 w-32 truncate">{name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-amber-400 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (count / stats.total) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
