export default function TagCloud({ tags }) {
  if (!tags || tags.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        暂无标签数据，录入题目后标签将在此展示
      </div>
    )
  }

  const maxCount = Math.max(...tags.map(t => t.count))
  const minCount = Math.min(...tags.map(t => t.count))

  const getSize = (count) => {
    if (maxCount === minCount) return 'text-sm'
    const ratio = (count - minCount) / (maxCount - minCount)
    if (ratio > 0.75) return 'text-lg font-bold'
    if (ratio > 0.5) return 'text-base font-semibold'
    if (ratio > 0.25) return 'text-sm font-medium'
    return 'text-xs'
  }

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {tags.map(({ tag, count }) => (
        <span
          key={tag}
          className={`inline-block px-3 py-1 rounded-full bg-primary-100 text-primary-700 ${getSize(count)} hover:bg-primary-200 transition-colors cursor-default`}
          title={`出现 ${count} 次`}
        >
          {tag} <span className="text-primary-400 text-xs">({count})</span>
        </span>
      ))}
    </div>
  )
}
