import 'katex/dist/katex.min.css'
import MixedContent from '../common/MixedContent'
import StarRating from '../QuestionEntry/StarRating'

export default function SearchResults({ results, onEdit, onDelete }) {
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
        <div key={q.id} className="bg-white rounded-xl border border-border shadow-sm p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-3">
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="mb-2">
                {q.content ? (
                  <div className="flex gap-3 items-start">
                    {q.imageUrl && (
                      <img
                        src={q.imageUrl}
                        alt="题目图片"
                        className="max-h-24 rounded border border-border object-contain flex-shrink-0 cursor-pointer hover:opacity-80"
                        onClick={() => window.open(q.imageUrl, '_blank')}
                        title="点击放大"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <MixedContent content={q.content} />
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm italic">无题目内容</p>
                )}
              </div>

              {q.answer && (
                <div className="text-xs text-gray-500 mb-1">
                  <span className="font-medium">答案：</span>
                  <MixedContent content={q.answer} />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-2">
                {q.grade && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">📚 {q.grade}</span>}
                {q.topic && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">📂 {q.topic}</span>}
                {q.difficulty > 0 && <StarRating value={q.difficulty} size="sm" />}
                {q.tags?.map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">🏷️ {tag}</span>
                ))}
              </div>

              {q.notes && (
                <p className="text-xs text-gray-400 mt-1">📝 {q.notes}</p>
              )}

              <p className="text-xs text-gray-300 mt-2">
                创建于 {new Date(q.createdAt).toLocaleDateString('zh-CN')} ·
                更新于 {new Date(q.updatedAt).toLocaleDateString('zh-CN')}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => onEdit?.(q)}
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
    </div>
  )
}
