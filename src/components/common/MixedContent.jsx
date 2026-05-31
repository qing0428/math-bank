import { InlineMath, BlockMath } from 'react-katex'

/**
 * Parse mixed content into segments.
 * Scans linearly: tabular blocks first, then $ delimiters, then plain text.
 */
function parseMixedContent(text) {
  if (!text) return []
  const segments = []
  let i = 0

  while (i < text.length) {
    // ── Check for \begin{tabular} at current position ──
    const tabBegin = '\\begin{tabular}'
    const tabEnd = '\\end{tabular}'
    const tbIdx = text.indexOf(tabBegin, i)

    // Also check for $$\begin{tabular}
    let tabStart = tbIdx
    let hasDoubleDollar = false
    if (tbIdx >= 2 && text.slice(tbIdx - 2, tbIdx) === '$$') {
      tabStart = tbIdx - 2
      hasDoubleDollar = true
    }

    // If tabular found at or near current position, extract it
    if (tbIdx === i || (hasDoubleDollar && tabStart === i)) {
      const endIdx = text.indexOf(tabEnd, tbIdx + tabBegin.length)
      if (endIdx >= 0) {
        const fullEnd = endIdx + tabEnd.length
        // Skip trailing $$ if present
        let consumeEnd = fullEnd
        if (text.slice(fullEnd, fullEnd + 2) === '$$') consumeEnd += 2
        const raw = text.slice(tbIdx, fullEnd)
        segments.push({ type: 'tabular', raw })
        i = consumeEnd
        continue
      }
    }

    // If tabular is ahead but not at current position, process text until then
    if (tbIdx > i) {
      const textChunk = text.slice(i, tabStart >= 0 ? tabStart : tbIdx)
      parseDelimiters(textChunk, segments)
      i = tabStart >= 0 ? tabStart : tbIdx
      continue
    }

    // No more tabular blocks, parse remaining text for $ delimiters
    parseDelimiters(text.slice(i), segments)
    break
  }

  return segments
}

/**
 * Parse $ and $$ delimiters in a plain text chunk and push to segments.
 */
function parseDelimiters(text, segments) {
  if (!text) return
  let i = 0

  while (i < text.length) {
    // Find next $ delimiter
    let nextDelim = -1
    let delimType = null
    let delimLen = 0

    // Look for $$
    const bi = text.indexOf('$$', i)
    // Look for single $
    let ci = text.indexOf('$', i)
    // Skip $ that are part of $$
    while (ci >= 0 && ci === bi) {
      ci = text.indexOf('$', ci + 2)
    }
    // Also skip $ immediately before or after $$
    if (ci >= 0 && bi >= 0) {
      if (ci === bi + 1) {
        ci = text.indexOf('$', ci + 1)
      }
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
      const remaining = text.slice(i)
      if (remaining) segments.push({ type: 'text', content: remaining })
      break
    }

    if (nextDelim > i) {
      segments.push({ type: 'text', content: text.slice(i, nextDelim) })
    }

    const contentStart = nextDelim + delimLen
    let closeIdx = -1

    if (delimType === 'block') {
      closeIdx = text.indexOf('$$', contentStart)
    } else {
      // Find closing $ that is not part of $$
      let search = contentStart
      while (search < text.length) {
        const pos = text.indexOf('$', search)
        if (pos < 0) break
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
      if (mathContent.trim()) {
        segments.push({ type: delimType, content: mathContent })
      }
      i = closeIdx + delimLen
    } else {
      segments.push({ type: 'text', content: text.slice(i) })
      break
    }
  }
}

// ─── Tabular parsing ─────────────────────────────────────────

function parseTabular(raw) {
  // Extract column spec — must be {..} immediately after \begin{tabular}
  const tabIdx = raw.indexOf('\\begin{tabular}')
  const afterTab = tabIdx + '\\begin{tabular}'.length
  let colSpec = ''
  let bodyStart = afterTab

  if (raw[afterTab] === '{') {
    const specEnd = raw.indexOf('}', afterTab)
    if (specEnd >= 0) {
      colSpec = raw.slice(afterTab + 1, specEnd)
      bodyStart = specEnd + 1
    }
  }

  const bodyEnd = raw.lastIndexOf('\\end{tabular}')
  let body = raw.slice(bodyStart, bodyEnd).trim()

  body = body.replace(/\\(?:hline|toprule|midrule|bottomrule)\s*/g, '')
  body = body.replace(/\\cline\{[^}]*\}\s*/g, '')

  const rawRows = body.split(/\\\\(?:\[[^\]]*\])?/).map(r => r.trim()).filter(Boolean)

  const rows = rawRows.map(row => {
    if (!row) return null
    const cells = splitByAmpersand(row)
    return cells.map(c => cleanCellContent(c))
  }).filter(r => r && r.length > 0)

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
    .replace(/\\textasciitilde|\\texttildelow/g, '~')
    .replace(/\\quad|\\qquad/g, ' ')
    .replace(/\\,/g, ' ')
    .replace(/\s+/g, ' ')
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
    let mathStr = remaining.slice(dollarIdx + 1, closeIdx)
    // Fix LaTeX commands not supported by KaTeX
    mathStr = mathStr.replace(/\\textasciitilde|\\texttildelow/g, '\\sim')
    mathStr = mathStr.replace(/\\mathrm\{([^}]*)\}/g, '\\text{$1}')
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
              {row.length < maxCols && Array.from({ length: maxCols - row.length }, (_, k) => (
                <td key={`e-${k}`} className="border border-gray-400 px-3 py-1.5" />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Choice option formatting ───────────────────────────────

function formatChoiceOptions(text) {
  // Match each option: A. xxx or B. xxx etc, capturing the full line
  const optionPattern = /(?:^|\n)\s*([A-D][.．]\s*[^\n]*)/g
  const matches = [...text.matchAll(optionPattern)]

  if (matches.length < 2) return text

  // Only reformat if all options are on separate lines (1 per line)
  // If already on same line, leave as-is
  const allOnSeparateLines = matches.every((m, i) => {
    if (i === 0) return true
    return m.index > matches[i - 1].index + matches[i - 1][0].length + 5
  })

  if (!allOnSeparateLines) return text

  const options = matches.map(m => m[1].trim())
  const count = options.length

  const firstIdx = matches[0].index
  const before = text.slice(0, firstIdx).replace(/\s+$/, '')

  let formatted = before ? before + '\n' : ''

  if (count === 4) {
    formatted += options[0] + '　　' + options[1] + '\n' + options[2] + '　　' + options[3]
  } else if (count === 2) {
    formatted += options[0] + '　　' + options[1]
  } else {
    formatted += options.join('\n')
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
    let mathStr = seg.content
      .replace(/\\textasciitilde|\\texttildelow/g, '\\sim')
      .replace(/\\mathrm\{([^}]*)\}/g, '\\text{$1}')
    try { return <InlineMath key={index} math={mathStr} /> }
    catch { return <span key={index} className="text-red-500">${mathStr}$</span> }
  }

  if (seg.type === 'block') {
    if (!seg.content.trim()) return null
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

function renderWithNewlines(text) {
  if (!text) return text
  const parts = text.split('\n')
  if (parts.length === 1) return text
  return parts.map((part, i) => (
    <span key={i}>{part}{i < parts.length - 1 && <br />}</span>
  ))
}

export default function MixedContent({ content, answer, className = '' }) {
  if (!content || !content.trim()) {
    return <span className="text-gray-400 italic text-sm">暂无内容</span>
  }

  const hasTabular = content.includes('\\begin{tabular}')

  if (!content.includes('$') && !hasTabular) {
    const withOptions = formatChoiceOptions(content)
    const processed = expandBlanks(withOptions, answer)
    return <span className={className}>{renderWithNewlines(processed)}</span>
  }

  try {
    const segments = parseMixedContent(content)
    if (segments.length === 0) {
      const withOptions = formatChoiceOptions(content)
      const processed = expandBlanks(withOptions, answer)
      return <span className={className}>{renderWithNewlines(processed)}</span>
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
