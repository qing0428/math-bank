import { InlineMath, BlockMath } from 'react-katex'

/**
 * Parse mixed content (Chinese text + $...$ / $$...$$ LaTeX)
 * into an array of segments: { type: 'text' | 'inline' | 'block' | 'tabular', content: string }
 */
function parseMixedContent(text) {
  if (!text) return []

  // ── Step 0: Extract \begin{tabular}...\end{tabular} blocks ──
  // Handle both bare tabular and $$\begin{tabular}...\end{tabular}$$
  const tabularBlocks = []
  let processed = text
  let tabIdx = 0
  while (true) {
    const bIdx = processed.indexOf('\\begin{tabular}')
    if (bIdx < 0) break
    const eIdx = processed.indexOf('\\end{tabular}', bIdx)
    if (eIdx < 0) break
    const fullEnd = eIdx + '\\end{tabular}'.length

    // Check if wrapped in $$...$$
    let start = bIdx
    let end = fullEnd
    if (start >= 2 && processed.slice(start - 2, start) === '$$') {
      start -= 2
    }
    if (end + 2 <= processed.length && processed.slice(end, end + 2) === '$$') {
      end += 2
    }

    const raw = processed.slice(bIdx, eIdx + '\\end{tabular}'.length)
    const placeholder = `\x00T${tabIdx}\x00`
    tabularBlocks.push({ placeholder, raw })
    processed = processed.slice(0, start) + placeholder + processed.slice(end)
    tabIdx++
  }

  // ── Step 1: Parse $ delimiters ──
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
      if (remaining) segments.push({ type: 'text', content: remaining })
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
        if (!prevIsDollar && !nextIsDollar) { closeIdx = pos; break }
        search = pos + 1
      }
    }

    if (closeIdx >= 0) {
      segments.push({ type: delimType, content: processed.slice(contentStart, closeIdx) })
      i = closeIdx + delimLen
    } else {
      segments.push({ type: 'text', content: processed.slice(i) })
      break
    }
  }

  // ── Step 2: Expand tabular placeholders inside text segments ──
  const finalSegments = []
  for (const seg of segments) {
    if (seg.type === 'text' && seg.content.includes('\x00')) {
      let remaining = seg.content
      for (const tb of tabularBlocks) {
        const idx = remaining.indexOf(tb.placeholder)
        if (idx >= 0) {
          if (idx > 0) finalSegments.push({ type: 'text', content: remaining.slice(0, idx) })
          finalSegments.push({ type: 'tabular', raw: tb.raw })
          remaining = remaining.slice(idx + tb.placeholder.length)
        }
      }
      if (remaining) finalSegments.push({ type: 'text', content: remaining })
    } else {
      finalSegments.push(seg)
    }
  }

  return finalSegments
}

/**
 * Parse a LaTeX \begin{tabular}{colspec}...\end{tabular} block.
 */
function parseTabular(raw) {
  const specMatch = raw.match(/\\begin\{tabular\}\{([^}]*)\}/)
  const colSpec = specMatch ? specMatch[1] : ''

  const beginEnd = raw.indexOf('}', raw.indexOf('\\begin{tabular}'))
  const bodyStart = beginEnd + 1
  const bodyEnd = raw.lastIndexOf('\\end{tabular}')
  let body = raw.slice(bodyStart, bodyEnd).trim()

  // Clean up hlines and rules
  body = body.replace(/\\(?:hline|toprule|midrule|bottomrule)\s*/g, '')
  body = body.replace(/\\cline\{[^}]*\}\s*/g, '')

  // Split rows by \\
  const rawRows = body.split(/\\\\(?:\[[^\]]*\])?/).map(r => r.trim()).filter(Boolean)

  const rows = rawRows.map(row => {
    if (!row) return null
    const cells = splitByAmpersand(row)
    return cells.map(c => cleanCellContent(c))
  }).filter(r => r && r.length > 0)

  // Parse column alignment
  const colAlignments = []
  for (const ch of colSpec) {
    if (ch === 'l') colAlignments.push('left')
    else if (ch === 'c') colAlignments.push('center')
    else if (ch === 'r') colAlignments.push('right')
  }

  return { rows, colAlignments, hasVLines: colSpec.includes('|') }
}

function splitByAmpersand(str) {
  const cells = []
  let current = ''
  let inMath = false
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (ch === '$') { inMath = !inMath; current += ch }
    else if (ch === '&' && !inMath) { cells.push(current); current = '' }
    else { current += ch }
  }
  cells.push(current)
  return cells
}

function cleanCellContent(cell) {
  return cell
    .replace(/\\multicolumn\{[^}]*\}\{[^}]*\}\{([^}]*)\}/g, '$1')
    .replace(/\\text(?:bf|sf|rm|it)\{([^}]*)\}/g, '$1')
    .replace(/\\mathbf\{([^}]*)\}/g, '$1')
    .replace(/\\quad|\\qquad/g, ' ')
    .replace(/\\,/g, ' ')
    .trim()
}

function CellContent({ text }) {
  if (!text) return null
  const parts = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const dollarIdx = remaining.indexOf('$')
    if (dollarIdx < 0) { parts.push(<span key={key++}>{remaining}</span>); break }
    if (dollarIdx > 0) parts.push(<span key={key++}>{remaining.slice(0, dollarIdx)}</span>)
    const closeIdx = remaining.indexOf('$', dollarIdx + 1)
    if (closeIdx < 0) { parts.push(<span key={key++}>{remaining.slice(dollarIdx)}</span>); break }
    const mathStr = remaining.slice(dollarIdx + 1, closeIdx)
    try { parts.push(<InlineMath key={key++} math={mathStr} />) }
    catch { parts.push(<span key={key++} className="text-red-500">${mathStr}$</span>) }
    remaining = remaining.slice(closeIdx + 1)
  }
  return <>{parts}</>
}

function TabularTable({ raw }) {
  const { rows, colAlignments, hasVLines } = parseTabular(raw)
  if (!rows || rows.length === 0) return null
  const maxCols = Math.max(...rows.map(r => r.length))
  const getAlign = (ci) => colAlignments[ci] || 'center'

  return (
    <div className="my-3 overflow-x-auto">
      <table className="border-collapse text-sm">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}
                  className={`border border-gray-400 px-3 py-1.5
                    ${ri === 0 ? 'border-t-2 border-gray-700' : ''}
                    ${ri === rows.length - 1 ? 'border-b-2 border-gray-700' : ''}
                    ${ci === 0 && hasVLines ? 'border-l-2 border-gray-700' : ''}
                    ${ci === row.length - 1 && hasVLines ? 'border-r-2 border-gray-700' : ''}`}
                  style={{ textAlign: getAlign(ci) }}>
                  <CellContent text={cell} />
                </td>
              ))}
              {row.length < maxCols && Array.from({ length: maxCols - row.length }, (_, i) => (
                <td key={`e-${i}`} className="border border-gray-400 px-3 py-1.5" />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Choice option formatting ───────────────────────────────

/**
 * Detect A/B/C/D choice options and format them with proper line breaks.
 * Layout rules:
 *   4 options → 2 per line (A. xx  B. xx \n C. xx  D. xx)
 *   3 options → 1 per line
 *   2 options → 1 line (A. xx  B. xx)
 */
function formatChoiceOptions(text) {
  // Match patterns like "A. xxx" or "A．xxx" (Chinese period)
  const optionPattern = /(?:(?:^|\n)\s*|[　 ])([A-D][.．]\s*)/g
  const matches = [...text.matchAll(optionPattern)]

  if (matches.length < 2) return text

  // Split content at each option boundary
  const parts = []
  let lastEnd = 0
  for (const m of matches) {
    const idx = m.index
    if (idx > lastEnd) {
      const before = text.slice(lastEnd, idx).trim()
      if (before) parts.push(before)
    }
    // Find end of this option: next option start or end of string
    const nextMatch = matches[matches.indexOf(m) + 1]
    const optEnd = nextMatch ? nextMatch.index : text.length
    parts.push(text.slice(idx, optEnd).trim())
    lastEnd = optEnd
  }
  // Remaining after last option
  if (lastEnd < text.length) {
    const rest = text.slice(lastEnd).trim()
    if (rest) parts.push(rest)
  }

  const optionParts = parts.filter(p => /^[A-D][.．]/.test(p))
  const nonOptionParts = parts.filter(p => !/^[A-D][.．]/.test(p))
  const count = optionParts.length

  if (count < 2) return text

  // Rejoin options with proper spacing
  let formatted = ''
  if (nonOptionParts.length > 0) {
    formatted = nonOptionParts.join('\n') + '\n'
  }

  if (count === 4) {
    // 2 per line
    formatted += optionParts[0] + '  ' + optionParts[1] + '\n' + optionParts[2] + '  ' + optionParts[3]
  } else if (count === 2) {
    // 1 line
    formatted += optionParts[0] + '  ' + optionParts[1]
  } else {
    // 1 per line (3 or more non-standard)
    formatted += optionParts.join('\n')
  }

  return formatted
}

// ─── Fill-in-the-blank ───────────────────────────────────────

function expandBlanks(text, answer) {
  if (!answer) return text
  const ansLen = answer.replace(/\$/g, '').replace(/\\[a-zA-Z]+\{?[^}]*\}?/g, 'X').length
  const blankChars = Math.max(4, Math.round(ansLen * 0.5))
  const blank = ' '.repeat(blankChars)
  return text
    .replace(/\(\s*\)/g, `（${blank}）`)
    .replace(/（\s*）/g, `（${blank}）`)
}

// ─── Render ──────────────────────────────────────────────────

function renderSegment(seg, index, answer) {
  if (seg.type === 'text') {
    const withOptions = formatChoiceOptions(seg.content)
    const processed = expandBlanks(withOptions, answer)
    const parts = processed.split('\n')
    return (
      <span key={index}>
        {parts.map((part, i) => (
          <span key={i}>{part}{i < parts.length - 1 && <br />}</span>
        ))}
      </span>
    )
  }

  if (seg.type === 'inline') {
    if (!seg.content.trim()) return null
    try { return <InlineMath key={index} math={seg.content} /> }
    catch { return <span key={index} className="text-red-500">${seg.content}$</span> }
  }

  if (seg.type === 'block') {
    if (!seg.content.trim()) return null
    // Check if block content contains tabular
    if (seg.content.includes('\\begin{tabular}')) {
      return <TabularTable key={index} raw={seg.content} />
    }
    try {
      return <div key={index} className="my-2"><BlockMath math={seg.content} /></div>
    } catch {
      return <div key={index} className="my-2 text-red-500 whitespace-pre-wrap">$$ {seg.content} $$</div>
    }
  }

  if (seg.type === 'tabular') {
    return <TabularTable key={index} raw={seg.raw} />
  }

  return null
}

export default function MixedContent({ content, answer, className = '' }) {
  if (!content || !content.trim()) {
    return <span className="text-gray-400 italic text-sm">暂无内容</span>
  }

  const hasTabular = content.includes('\\begin{tabular}')

  if (!content.includes('$') && !hasTabular) {
    const withOptions = formatChoiceOptions(content)
    const processed = expandBlanks(withOptions, answer)
    return <span className={className}>{processed}</span>
  }

  try {
    const segments = parseMixedContent(content)
    if (segments.length === 0) {
      const processed = expandBlanks(content, answer)
      return <span className={className}>{processed}</span>
    }
    return (
      <span className={className}>
        {segments.map((seg, i) => renderSegment(seg, i, answer))}
      </span>
    )
  } catch {
    return <span className={className}>{content}</span>
  }
}
