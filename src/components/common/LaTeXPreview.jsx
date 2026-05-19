import 'katex/dist/katex.min.css'
import MixedContent from './MixedContent'

export default function LaTeXPreview({ content, label, emptyText = '暂无内容' }) {
  if (!content || !content.trim()) {
    return (
      <div className="text-gray-400 text-sm italic py-2">
        {emptyText}
      </div>
    )
  }

  return (
    <div>
      {label && <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>}
      <div className="bg-white rounded-lg border border-border p-3 overflow-x-auto">
        <MixedContent content={content} />
      </div>
    </div>
  )
}
