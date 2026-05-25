/**
 * Strip Markdown syntax from text, keeping the plain content.
 * Handles: bold (**text**, __text__), italic (*text*, _text_),
 * headings (# ... ######), code (`code`, ```code```),
 * links [text](url), images ![alt](url), lists (- item, * item, 1. item),
 * blockquotes (> text), horizontal rules (---, ***), and inline HTML tags.
 */
export function stripMarkdown(text) {
  if (!text) return ''

  let result = text

  // Remove code blocks ```...```
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    return match.replace(/```\w*\n?/g, '').replace(/```/g, '').trim()
  })

  // Remove inline code `...`
  result = result.replace(/`([^`]+)`/g, '$1')

  // Remove images ![alt](url) → alt text
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')

  // Remove links [text](url) → text
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // Remove bold **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, '$1')
  result = result.replace(/__(.+?)__/g, '$1')

  // Remove italic *text* or _text_
  result = result.replace(/\*(.+?)\*/g, '$1')
  result = result.replace(/_(.+?)_/g, '$1')

  // Remove strikethrough ~~text~~
  result = result.replace(/~~(.+?)~~/g, '$1')

  // Remove headings # ... ######
  result = result.replace(/^#{1,6}\s+/gm, '')

  // Remove blockquotes >
  result = result.replace(/^>\s*/gm, '')

  // Remove horizontal rules --- or *** or ___
  result = result.replace(/^[-*_]{3,}\s*$/gm, '')

  // Remove list markers (- item, * item, + item)
  result = result.replace(/^[\s]*[-*+]\s+/gm, '')

  // Remove numbered list markers (1. item, 2. item)
  result = result.replace(/^[\s]*\d+\.\s+/gm, '')

  // Remove HTML tags
  result = result.replace(/<[^>]+>/g, '')

  // Remove trailing/leading whitespace on each line, collapse multiple blank lines
  result = result.split('\n').map(line => line.trim()).join('\n')
  result = result.replace(/\n{3,}/g, '\n\n')

  return result.trim()
}

/**
 * Strip leading question numbers from content.
 * Handles: "1." "13." "一、" "(1)" "1)" "①" etc.
 */
export function stripQuestionNumber(text) {
  if (!text) return ''
  // Match common question number patterns at the start
  return text.replace(/^\s*(?:\d+[\.\、\．]|\(\d+\)|\d+\)|[一二三四五六七八九十]+[\.\、]|\d+\s*[\.．])\s*/, '')
}
