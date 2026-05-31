import { InlineMath, BlockMath } from 'react-katex'

/**
 * Parse mixed content (Chinese text + $...$ / $$...$$ LaTeX)
 * into an array of segments: { type: 'text' | 'inline' | 'block' | 'tabular', content: string }
 */
function parseMixedContent(text) {
  if (!text) return []

  // ── Step 0: Extract \begin{tabular}...\end{tabular} blocks ──
  const tabularBlocks = []
  let processed = text
  let tabIdx = 0
  while (true) {
    const beginTag = '\\begin{tabular}'
    const endTag = '\\end{tabular}'
    const bIdx = processed.indexOf(beginTag)
    if (bIdx < 0) break
    const eIdx = processed.indexOf(endTag, bIdx + beginTag.length)
    if (eIdx < 0) break
    const fullEnd = eIdx + endTag.length
    const raw = processed.slice(bIdx, fullEnd)
    const placeholder = `\x00TABULAR_${tabIdx}\x00`
    tabularBlocks.push({ placeholder, raw })
    processed = processed.slice(0, bIdx) + placeholder + processed.slice(fullEnd)
    tabIdx++
  }

  // ── Step 1: Parse $ delimiters (same as before) ──
  const segments = []
  let i = 0

  while (i < processed.length) {
    let nextDelim = -1
    let delimType = null
    let delimLen = 0

    let bi = processed.indexOf('$$', i)
    let ci = processed.indexOf('$', i)
    while (ci >= 0 && ci === bi) {
      ci = processed.indexOf('$', ci + 2)
      bi = processed.indexOf('$$', i)
    }

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
      const remaining = processed.slice(i)
      if (remaining) {
        segments.push({ type: 'text', content: remaining })
      }
      break
    }

    if (nextDelim > i) {
      segments.push({ type: 'text', content: processed.slice(i, nextDelim) })
    }

    const contentStart = nextDelim + delimLen
    let closeIdx = -1

    if (delimType === 'block') {
      closeIdx = processed.indexOf('$$', contentStart)
    } else {
      let search = contentStart
      while (search < processed.length) {
        const pos = processed.indexOf('$', search)
        if (pos < 0) break
        const prevIsDollar = pos > 0 && processed[pos - 1] === '$'
        const nextIsDollar = pos < processed.length - 1 && processed[pos + 1] === '$'
        if (!prevIsDollar && !nextIsDollar) {
          closeIdx = pos
          break
        }
        search = pos + 1
      }
    }

    if (closeIdx >= 0) {
      const mathContent = processed.slice(contentStart, closeIdx)
      segments.push({ type: delimType, content: mathContent })
      i = closeIdx + delimLen
    } else {
      segments.push({ type: 'text', content: processed.slice(i) })
      break
    }
  }

  // ── Step 2: Expand tabular placeholders inside text segments ──
  const finalSegments = []
  for (const seg of segments) {
    if (seg.type === 'text') {
      let remaining = seg.content
      for (const tb of tabularBlocks) {
        const idx = remaining.indexOf(tb.placeholder)
        if (idx >= 0) {
          if (idx > 0) {
            finalSegments.push({ type: 'text', content: remaining.slice(0, idx) })
          }
          finalSegments.push({ type: 'tabular', raw: tb.raw })
          remaining = remaining.slice(idx + tb.placeholder.length)
        }
      }
      if (remaining) {
        finalSegments.push({ type: 'text', content: remaining })
      }
    } else {
      finalSegments.push(seg)
    }
  }

  return finalSegments
}

/**
 * Parse a LaTeX \begin{tabular}{colspec}...\end{tabular} block
 * into structured rows and cells for HTML rendering.
 */
function parseTabular(raw) {
  // Extract column spec
  const specMatch = raw.match(/\\begin\{tabular\}\{([^}]*)\}/)
  const colSpec = specMatch ? specMatch[1] : ''

  // Extract body (between \begin{tabular}{colspec} and \end{tabular})
  const bodyStart = raw.indexOf('}', raw.indexOf('\\begin{tabular}')) + 1
  const bodyEnd = raw.lastIndexOf('\\end{tabular}')
  let body = raw.slice(bodyStart, bodyEnd).trim()

  // Remove outer \hline at start/end
  body = body.replace(/^\\hline\s*/, '').replace(/\s*\\hline\s*$/, '')

  // Split into rows by \\
  const rawRows = body.split('\\\\').map(r => r.trim()).filter(Boolean)

  const rows = rawRows.map(row => {
    // Remove \hline from row
    let cleaned = row.replace(/\\hline/g, '').trim()
    if (!cleaned) return null
    // Split cells by &
    const cells = cleaned.split('&').map(c => c.trim())
    return cells
  }).filter(Boolean)

  // Parse column alignment from colSpec
  const colAlignments = []
  for (const ch of colSpec) {
    if (ch === 'l') colAlignments.push('left')
    else if (ch === 'c') colAlignments.push('center')
    else if (ch === 'r') colAlignments.push('right')
    // skip |, @{}, p{}, etc.
  }

  return { rows, colAlignments, hasVLines: colSpec.includes('|') }
}

/**
 * Render a single cell's content (may contain $...$ math inline).
 */
function CellContent({ text }) {
  if (!text) return null
  // Try to parse inline math within the cell
  const parts = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const dollarIdx = remaining.indexOf('$')
    if (dollarIdx < 0) {
      parts.push(<span key={key++}>{remaining}</span>)
      break
    }
    if (dollarIdx > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, dollarIdx)}</span>)
    }
    const closeIdx = remaining.indexOf('$', dollarIdx + 1)
    if (closeIdx < 0) {
      parts.push(<span key={key++}>{remaining.slice(dollarIdx)}</span>)
      break
    }
    const mathStr = remaining.slice(dollarIdx + 1, closeIdx)
    try {
      parts.push(<InlineMath key={key++} math={mathStr} />)
    } catch {
      parts.push(<span key={key++} className="text-red-500">${mathStr}$</span>)
    }
    remaining = remaining.slice(closeIdx + 1)
  }

  return <>{parts}</>
}

/**
 * Render a parsed tabular structure as an HTML table.
 */
function TabularTable({ raw }) {
  const { rows, colAlignments, hasVLines } = parseTabular(raw)
  if (!rows || rows.length === 0) return null

  const maxCols = Math.max(...rows.map(r => r.length))

  const getAlign = (colIdx) => {
    return colAlignments[colIdx] || 'center'
  }

  return (
    <div className="my-3 overflow-x-auto">
      <table className="border-collapse text-sm">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`border border-gray-400 px-3 py-1.5 whitespace-nowrap
                    ${hasVLines ? 'border-l border-r border-gray-600' : ''}
                    ${ri === 0 ? 'border-t border-gray-600' : ''}
                    ${ri === rows.length - 1 ? 'border-b border-gray-600' : ''}`}
                  style={{ textAlign: getAlign(ci) }}
                >
                  <CellContent text={cell} />
                </td>
              ))}
              {/* Fill empty cells if row has fewer columns */}
              {row.length < maxCols && Array.from({ length: maxCols - row.length }, (_, i) => (
                <td key={`empty-${i}`} className="border border-gray-400 px-3 py-1.5" />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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

  if (seg.type === 'tabular') {
    return <TabularTable key={index} raw={seg.raw} />
  }

  return null
}

export default function MixedContent({ content, className = '' }) {
  if (!content || !content.trim()) {
    return <span className="text-gray-400 italic text-sm">暂无内容</span>
  }

  const hasTabular = content.includes('\\begin{tabular}')

  // If no math delimiters and no tabular, just render as plain text
  if (!content.includes('$') && !hasTabular) {
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
