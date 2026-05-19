import { useState } from 'react'

export default function StarRating({ value = 0, onChange, size = 'md' }) {
  const [hover, setHover] = useState(0)
  const sizeMap = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' }

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`${sizeMap[size]} transition-all duration-150 cursor-pointer select-none
            ${(hover || value) >= star ? 'text-amber-400 scale-110' : 'text-gray-300'}
            hover:scale-125`}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange?.(star)}
        >
          ★
        </button>
      ))}
      <span className="ml-2 text-sm text-gray-500">{value > 0 ? `${value} 星` : '未选择'}</span>
    </div>
  )
}
