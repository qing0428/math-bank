import { saveAs } from 'file-saver'
import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  AlignmentType, convertInchesToTwip,
} from 'docx'

const STORAGE_KEY = 'mathPaperConfig'

export function loadPaperConfig() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : getDefaultConfig()
  } catch {
    return getDefaultConfig()
  }
}

export function savePaperConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

function getDefaultConfig() {
  return {
    numberingMode: 'nested',
    selectedIds: [],
    paperTitle: '数学试卷',
  }
}

// ─── PDF Export ──────────────────────────────────────────────

async function captureElement(element, scale = 2) {
  const html2canvas = (await import('html2canvas')).default
  return html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
  })
}

export async function exportToPDF(element, filename) {
  const { jsPDF } = await import('jspdf')
  const pdfWidthMm = 210
  const pdfHeightMm = 297

  const origWidth = element.style.width
  const origOverflow = element.style.overflow

  const pageWidthPx = (pdfWidthMm / 25.4) * 96
  element.style.width = `${pageWidthPx}px`
  element.style.overflow = 'visible'

  const canvas = await captureElement(element, 2)
  const imgData = canvas.toDataURL('image/png')

  element.style.width = origWidth
  element.style.overflow = origOverflow

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const imgWidth = pdfWidthMm
  const imgHeight = (canvas.height * pdfWidthMm) / canvas.width
  const overlap = 15

  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
  heightLeft -= pdfHeightMm

  while (heightLeft > 0) {
    position -= (pdfHeightMm - overlap)
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= (pdfHeightMm - overlap)
  }

  pdf.save(`${filename}.pdf`)
}

// ─── Word Export ─────────────────────────────────────────────

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1]
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

async function getImageDimensions(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const maxWidth = 500
      let w = img.width
      let h = img.height
      if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth }
      resolve({ width: Math.round(w * 9525), height: Math.round(h * 9525) })
    }
    img.onerror = () => resolve({ width: 400 * 9525, height: 300 * 9525 })
    img.src = url
  })
}

const NEEDS_SPACE_TYPES = ['解决问题', '解答题', '证明题', '画图题']

function stripLatex(text) {
  if (!text) return ''
  return text
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => m
      .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2')
      .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
      .replace(/\\[a-zA-Z]+\{?[^}]*\}?/g, '')
      .replace(/[{}\\]/g, ''))
    .replace(/\$([^$]*)\$/g, (_, m) => m
      .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2')
      .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
      .replace(/\\[a-zA-Z]+\{?[^}]*\}?/g, '')
      .replace(/[{}\\]/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
}

export async function exportToWord(numbered, numberingMode, paperTitle, version, pageSize, filename) {
  const isTeacher = version === 'teacher'
  const questionChildren = []

  // Header
  questionChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: paperTitle || '数学试卷', bold: true, size: 48, font: 'SimSun' })],
  }))

  questionChildren.push(new Paragraph({
    spacing: { after: 400 },
    children: [
      new TextRun({ text: '姓名：_______________', size: 22, font: 'SimSun' }),
      new TextRun({ text: '    ', size: 22 }),
      new TextRun({ text: '班级：_______________', size: 22, font: 'SimSun' }),
      new TextRun({ text: '    ', size: 22 }),
      new TextRun({ text: '得分：_______', size: 22, font: 'SimSun' }),
    ],
  }))

  // Questions
  for (const item of numbered) {
    if (item.groupLabel) {
      questionChildren.push(new Paragraph({
        spacing: { before: 300, after: 150 },
        children: [new TextRun({ text: item.groupLabel, bold: true, size: 28, font: 'SimSun' })],
      }))
    }

    const q = item.question
    const runs = []
    runs.push(new TextRun({ text: `${item.number} `, bold: true, size: 24, font: 'SimSun' }))
    runs.push(new TextRun({ text: stripLatex(q.content || ''), size: 24, font: 'SimSun' }))

    questionChildren.push(new Paragraph({
      spacing: { after: 100 },
      indent: { left: convertInchesToTwip(0.3) },
      children: runs,
    }))

    // Image
    if (q.imageUrl) {
      try {
        const dim = await getImageDimensions(q.imageUrl)
        const imgData = dataUrlToUint8Array(q.imageUrl)
        questionChildren.push(new Paragraph({
          spacing: { after: 100 },
          indent: { left: convertInchesToTwip(0.3) },
          children: [new ImageRun({ data: imgData, transformation: { width: Math.min(dim.width, 500 * 9525), height: Math.min(dim.height, 400 * 9525) } })],
        }))
      } catch { /* skip */ }
    }

    // Answer space for student version (only for problem-solving types)
    const needsSpace = NEEDS_SPACE_TYPES.includes(q.questionType)
    if (!isTeacher && needsSpace) {
      questionChildren.push(new Paragraph({
        spacing: { after: 200 },
        indent: { left: convertInchesToTwip(0.3) },
        children: [new TextRun({ text: '_______________________________________________', color: 'CCCCCC', size: 24 })],
      }))
    }

    // Teacher answers
    if (isTeacher && q.answer) {
      questionChildren.push(new Paragraph({
        spacing: { after: 50 },
        indent: { left: convertInchesToTwip(0.3) },
        children: [
          new TextRun({ text: '答案：', bold: true, size: 22, color: '1a56db', font: 'SimSun' }),
          new TextRun({ text: stripLatex(q.answer), size: 22, color: '1a56db', font: 'SimSun' }),
        ],
      }))
    }
    if (isTeacher && q.solution) {
      questionChildren.push(new Paragraph({
        spacing: { after: 200 },
        indent: { left: convertInchesToTwip(0.3) },
        children: [
          new TextRun({ text: '解析：', bold: true, size: 20, color: '374151', font: 'SimSun' }),
          new TextRun({ text: stripLatex(q.solution), size: 20, color: '374151', font: 'SimSun' }),
        ],
      }))
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: Math.round(210 * 56.7), height: Math.round(297 * 56.7) },
          margin: {
            top: convertInchesToTwip(0.8),
            bottom: convertInchesToTwip(0.8),
            left: convertInchesToTwip(0.8),
            right: convertInchesToTwip(0.8),
          },
        },
      },
      children: questionChildren,
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${filename}.docx`)
}
