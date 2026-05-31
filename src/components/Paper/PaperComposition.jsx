import { useState, useCallback, useEffect, useRef } from 'react'
import QuestionSelector from './QuestionSelector'
import PaperPreview from './PaperPreview'
import PaperSettings from './PaperSettings'
import { loadPaperConfig, savePaperConfig, exportToPDF, exportToWord } from '../../store/paperStore'
import { generateFlatNumbers, generateNestedNumbers } from '../../utils/numbering'

export default function PaperComposition({ questions }) {
  const savedConfig = loadPaperConfig()

  const [selectedIds, setSelectedIds] = useState(savedConfig.selectedIds || [])
  const [numberingMode, setNumberingMode] = useState(savedConfig.numberingMode || 'nested')
  const [previewMode, setPreviewMode] = useState('student')
  const [paperTitle, setPaperTitle] = useState(savedConfig.paperTitle || '数学试卷')

  const previewRef = useRef(null)

  useEffect(() => {
    savePaperConfig({ numberingMode, selectedIds, paperTitle })
  }, [numberingMode, selectedIds, paperTitle])

  const handleToggle = useCallback((id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }, [])

  const handleReorder = useCallback((fromIndex, toIndex) => {
    setSelectedIds(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }, [])

  const selectedQuestions = selectedIds
    .map(id => questions.find(q => q.id === id))
    .filter(Boolean)

  const handleExport = useCallback(async (format, version) => {
    if (selectedQuestions.length === 0) return

    const numbered = numberingMode === 'flat'
      ? generateFlatNumbers(selectedQuestions)
      : generateNestedNumbers(selectedQuestions)

    const filename = `${paperTitle}_${version === 'student' ? '学生版' : '教师版'}`

    if (format === 'word') {
      await exportToWord(numbered, numberingMode, paperTitle, version, 'A4', filename)
    } else if (format === 'pdf') {
      const container = document.querySelector('[data-paper-container]')
      if (container) {
        await exportToPDF(container, filename, 'A4')
      }
    }
  }, [selectedQuestions, numberingMode, paperTitle])

  return (
    <div className="flex flex-col h-full gap-4 p-6">
      <PaperSettings
        numberingMode={numberingMode}
        onNumberingModeChange={setNumberingMode}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
        paperTitle={paperTitle}
        onPaperTitleChange={setPaperTitle}
        onExport={handleExport}
        selectedCount={selectedQuestions.length}
      />

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="w-[360px] flex-shrink-0 overflow-hidden">
          <QuestionSelector
            questions={questions}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            onReorder={handleReorder}
          />
        </div>

        <div className="flex-1 overflow-hidden" ref={previewRef}>
          <PaperPreview
            questions={selectedQuestions}
            numberingMode={numberingMode}
            previewMode={previewMode}
            paperTitle={paperTitle}
          />
        </div>
      </div>
    </div>
  )
}
