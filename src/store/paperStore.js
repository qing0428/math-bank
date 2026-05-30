import { saveAs } from 'file-saver'
import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  HeadingLevel, AlignmentType, PageBreak,
  convertInchesToTwip, PageOrientation,
} from 'docx'

const STORAGE_KEY = 'mathPaperConfig'

const PAGE_SIZES = {
  A4: { widthMm: 210, heightMm: 297 },
  A3: { widthMm: 297, heightMm: 420 },
}

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
    pageSize: 'A4',
    selectedIds: [],
    paperTitle: '数学试卷',
  }
}

/**
 * Capture an HTML element as a high-res canvas via html2canvas.
 */
async function captureElement(element, scale = 2) {
  const html2canvas = (await import('html2canvas')).default
  return html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
  })
}

/**
 * Export the paper preview element to PDF.
 *
 * @param {HTMLElement} element - The DOM element to capture
 * @param {string} filename - Output filename (without extension)
 * @param {'A4'|'A3'} pageSize - Page size
 */
export async function exportToPDF(element, filename, pageSize = 'A4') {
  const { jsPDF } = await import('jspdf')
  const size = PAGE_SIZES[pageSize] || PAGE_SIZES.A4

  // Store original styles
  const origWidth = element.style.width
  const origOverflow = element.style.overflow

  // Set element to page width for capture
  const pageWidthPx = (size.widthMm / 25.4) * 96
  element.style.width = `${pageWidthPx}px`
  element.style.overflow = 'visible'

  const canvas = await captureElement(element, 2)
  const imgData = canvas.toDataURL('image/png')

  // Restore styles
  element.style.width = origWidth
  element.style.overflow = origOverflow

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: pageSize.toLowerCase(),
  })

  const pdfWidth = size.widthMm
  const pdfHeight = size.heightMm
  const imgWidth = pdfWidth
  const imgHeight = (canvas.height * pdfWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0

  // First page
  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
  heightLeft -= pdfHeight

  // Additional pages
  while (heightLeft > 0) {
    position -= pdfHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pdfHeight
  }

  pdf.save(`${filename}.pdf`)
}

/**
 * Convert a data URL to a Uint8Array for docx ImageRun.
 */
function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(',')[1]
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * Try to load an image from URL and return width/height.
 * Falls back to default dimensions if loading fails.
 */
async function getImageDimensions(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      // Limit max width to ~500px for Word document
      const maxWidth = 500
      let w = img.width
      let h = img.height
      if (w > maxWidth) {
        h = (maxWidth / w) * h
        w = maxWidth
      }
      // Convert px to EMU (English Metric Units): 1 px ≈ 9525 EMU
      resolve({ width: Math.round(w * 9525), height: Math.round(h * 9525) })
    }
    img.onerror = () => resolve({ width: 400 * 9525, height: 300 * 9525 })
    img.src = url
  })
}

/**
 * Export paper to Word (.docx) file using the `docx` library.
 *
 * @param {Array} numbered - Array of numbered question items
 * @param {string} numberingMode - 'nested' | 'flat'
 * @param {string} paperTitle - Paper title
 * @param {'student'|'teacher'} version - Student or teacher version
 * @param {'A4'|'A3'} pageSize - Page size
 * @param {string} filename - Output filename
 */
export async function exportToWord(numbered, numberingMode, paperTitle, version, pageSize, filename) {
  const isTeacher = version === 'teacher'
  const size = PAGE_SIZES[pageSize] || PAGE_SIZES.A4

  // Convert mm to twip: 1 mm = ~56.7 twip
  const pageWidthTwip = Math.round(size.widthMm * 56.7)
  const pageHeightTwip = Math.round(size.heightMm * 56.7)

  const sections = []

  // --- Questions section ---
  const questionChildren = []

  // Paper title
  questionChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: paperTitle || '数学试卷',
          bold: true,
          size: 48, // 24pt
          font: 'SimSun',
        }),
      ],
    })
  )

  // Header info line
  questionChildren.push(
    new Paragraph({
      spacing: { after: 400 },
      children: [
        new TextRun({ text: '姓名：_______________', size: 22, font: 'SimSun' }),
        new TextRun({ text: '    ', size: 22 }),
        new TextRun({ text: '班级：_______________', size: 22, font: 'SimSun' }),
        new TextRun({ text: '    ', size: 22 }),
        new TextRun({ text: '得分：_______', size: 22, font: 'SimSun' }),
      ],
    })
  )

  // Questions
  for (const item of numbered) {
    // Group label for nested mode
    if (item.groupLabel) {
      questionChildren.push(
        new Paragraph({
          spacing: { before: 300, after: 150 },
          children: [
            new TextRun({
              text: item.groupLabel,
              bold: true,
              size: 28, // 14pt
              font: 'SimSun',
            }),
          ],
        })
      )
    }

    const q = item.question
    const runs = []

    // Question number
    runs.push(new TextRun({
      text: `${item.number} `,
      bold: true,
      size: 24,
      font: 'SimSun',
    }))

    // Question content (plain text - LaTeX markers kept as-is)
    runs.push(new TextRun({
      text: q.content || '',
      size: 24,
      font: 'SimSun',
    }))

    questionChildren.push(new Paragraph({
      spacing: { after: 100 },
      indent: { left: convertInchesToTwip(0.3) },
      children: runs,
    }))

    // Question image
    if (q.imageUrl) {
      try {
        const dim = await getImageDimensions(q.imageUrl)
        const imgData = dataUrlToUint8Array(q.imageUrl)
        questionChildren.push(
          new Paragraph({
            spacing: { after: 100 },
            indent: { left: convertInchesToTwip(0.3) },
            children: [
              new ImageRun({
                data: imgData,
                transformation: {
                  width: Math.min(dim.width, 500 * 9525),
                  height: Math.min(dim.height, 400 * 9525),
                },
              }),
            ],
          })
        )
      } catch (e) {
        // Skip image if it fails to load
      }
    }

    // Answer line for student version
    if (!isTeacher) {
      questionChildren.push(
        new Paragraph({
          spacing: { after: 200 },
          indent: { left: convertInchesToTwip(0.3) },
          children: [
            new TextRun({
              text: '_______________________________________________',
              color: 'CCCCCC',
              size: 24,
            }),
          ],
        })
      )
    }

    // Inline answer for teacher version
    if (isTeacher && q.answer) {
      questionChildren.push(
        new Paragraph({
          spacing: { after: 50 },
          indent: { left: convertInchesToTwip(0.3) },
          children: [
            new TextRun({
              text: '答案：',
              bold: true,
              size: 22,
              color: '1a56db',
              font: 'SimSun',
            }),
            new TextRun({
              text: q.answer,
              size: 22,
              color: '1a56db',
              font: 'SimSun',
            }),
          ],
        })
      )
    }
    if (isTeacher && q.solution) {
      questionChildren.push(
        new Paragraph({
          spacing: { after: 200 },
          indent: { left: convertInchesToTwip(0.3) },
          children: [
            new TextRun({
              text: '解析：',
              bold: true,
              size: 20,
              color: '374151',
              font: 'SimSun',
            }),
            new TextRun({
              text: q.solution,
              size: 20,
              color: '374151',
              font: 'SimSun',
            }),
          ],
        })
      )
    }
  }

  sections.push({
    properties: {
      page: {
        size: {
          width: pageWidthTwip,
          height: pageHeightTwip,
          orientation: PageOrientation.PORTRAIT,
        },
        margin: {
          top: convertInchesToTwip(0.8),
          bottom: convertInchesToTwip(0.8),
          left: convertInchesToTwip(0.8),
          right: convertInchesToTwip(0.8),
        },
      },
    },
    children: questionChildren,
  })

  const doc = new Document({
    sections,
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${filename}.docx`)
}
