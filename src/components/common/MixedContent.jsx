import { InlineMath, BlockMath } from 'react-katex'

/**
 * Parse mixed content (Chinese text + $...$ / $$...$$ LaTeX)
 * into an array of segments: { type: 'text' | 'inline' | 'block', content: string }
 */
function parseMixedContent(text) {
  if (!text) return []

  const segments = []
  let i = 0

  while (i < text.length) {
    // Find next math delimiter
    let nextDelim = -1
    let delimType = null
    let delimLen = 0

    // Check for $$ first (block math)
    let bi = text.indexOf('$$', i)
    // Check for $ (inline math), but skip $$ positions
    let ci = text.indexOf('$', i)
    // Skip $$ when looking for inline $
    while (ci >= 0 && ci === bi) {
      // This $ is part of $$, skip both
      ci = text.indexOf('$', ci + 2)
      bi = text.indexOf('$$', i)
    }

    // Pick the earliest delimiter
    if (bi >= 0 && (ci < 0 || bi <= ci)) {
      nextDelim = bi
      delimType = 'block'
      delimLen = 2
    } else if (ci >= 0) {
      nextDelim = ci
      delimType = 'inline'
      delimLen = 1
    }

    if (nextDelim < 0) {
      // No more math delimiters — rest is plain text
      const remaining = text.slice(i)
      if (remaining) {
        segments.push({ type: 'text', content: remaining })
      }
      break
    }

    // Text before the delimiter
    if (nextDelim > i) {
      segments.push({ type: 'text', content: text.slice(i, nextDelim) })
    }

    // Find closing delimiter
    const contentStart = nextDelim + delimLen
    let closeIdx = -1

    if (delimType === 'block') {
      closeIdx = text.indexOf('$$', contentStart)
    } else {
      // Find closing $ that's not part of $$
      let search = contentStart
      while (search < text.length) {
        const pos = text.indexOf('$', search)
        if (pos < 0) break
        // Check it's not the start of $$
        const prevIsDollar = pos > 0 && text[pos - 1] === '$'
        const nextIsDollar = pos < text.length - 1 && text[pos + 1] === '$'
        if (!prevIsDollar && !nextIsDollar) {
          closeIdx = pos
          break
        }
        search = pos + 1
      }
    }

    if (closeIdx >= 0) {
      const mathContent = text.slice(contentStart, closeIdx)
      segments.push({ type: delimType, content: mathContent })
      i = closeIdx + delimLen
    } else {
      // No closing delimiter — treat rest as text
      segments.push({ type: 'text', content: text.slice(i) })
      break
    }
  }

  return segments
}

function renderSegment(seg, index) {
  if (seg.type === 'text') {
    const parts = seg.content.split('\n')
    return (
      <span key={index}>
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && <br />}
          </span>
        ))}
      </span>
    )
  }

  if (seg.type === 'inline') {
    if (!seg.content.trim()) return null
    try {
      return <InlineMath key={index} math={seg.content} />
    } catch {
      return (
        <span key={index} className="text-red-500">${seg.content}$</span>
      )
    }
  }

  if (seg.type === 'block') {
    if (!seg.content.trim()) return null
    try {
      return (
        <div key={index} className="my-2">
          <BlockMath math={seg.content} />
        </div>
      )
    } catch {
      return (
        <div key={index} className="my-2 text-red-500 whitespace-pre-wrap">$$ {seg.content} $$</div>
      )
    }
  }

  return null
}

export default function MixedContent({ content, className = '' }) {
  if (!content || !content.trim()) {
    return <span className="text-gray-400 italic text-sm">暂无内容</span>
  }

  // If no math delimiters at all, just render as plain text
  if (!content.includes('$')) {
    return <span className={className}>{content}</span>
  }

  try {
    const segments = parseMixedContent(content)

    if (segments.length === 0) {
      return <span className={className}>{content}</span>
    }

    return (
      <span className={className}>
        {segments.map((seg, i) => renderSegment(seg, i))}
      </span>
    )
  } catch {
    // Fallback: show raw text if parsing fails
    return <span className={className}>{content}</span>
  }
}
