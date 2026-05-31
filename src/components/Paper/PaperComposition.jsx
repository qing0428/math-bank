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
  const [pageSize, setPageSize] = useState(savedConfig.pageSize || 'A4')
  const [previewMode, setPreviewMode] = useState('student')
  const [paperTitle, setPaperTitle] = useState(savedConfig.paperTitle || '数学试卷')
  const [schoolName, setSchoolName] = useState(savedConfig.schoolName || '')
  const [studentId, setStudentId] = useState(savedConfig.studentId ?? true)
  const [examTime, setExamTime] = useState(savedConfig.examTime || '90')
  const [totalScore, setTotalScore] = useState(savedConfig.totalScore || '120')
  const [showSealLine, setShowSealLine] = useState(savedConfig.showSealLine ?? true)

  const previewRef = useRef(null)

  // Persist config on change
  useEffect(() => {
    savePaperConfig({ numberingMode, pageSize, selectedIds, paperTitle, schoolName, studentId, examTime, totalScore, showSealLine })
  }, [numberingMode, pageSize, selectedIds, paperTitle, schoolName, studentId, examTime, totalScore, showSealLine])

  const handleToggle = useCallback((id) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
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

  // Export handler
  const handleExport = useCallback(async (format, version) => {
    if (selectedQuestions.length === 0) return

    const numbered = numberingMode === 'flat'
      ? generateFlatNumbers(selectedQuestions)
      : generateNestedNumbers(selectedQuestions)

    const filename = `${paperTitle}_${version === 'student' ? '学生版' : '教师版'}`

    if (format === 'word') {
      await exportToWord(numbered, numberingMode, paperTitle, version, pageSize, filename, { schoolName, studentId, examTime, totalScore })
    } else if (format === 'pdf') {
      const container = document.querySelector('[data-paper-container]')
      if (container) {
        await exportToPDF(container, filename, pageSize)
      }
    }
  }, [selectedQuestions, numberingMode, paperTitle, pageSize])

  return (
    <div className="flex flex-col h-full gap-4 p-6">
      {/* Settings toolbar */}
      <PaperSettings
        numberingMode={numberingMode}
        onNumberingModeChange={setNumberingMode}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
        paperTitle={paperTitle}
        onPaperTitleChange={setPaperTitle}
        schoolName={schoolName}
        onSchoolNameChange={setSchoolName}
        studentId={studentId}
        onStudentIdChange={setStudentId}
        examTime={examTime}
        onExamTimeChange={setExamTime}
        totalScore={totalScore}
        onTotalScoreChange={setTotalScore}
        showSealLine={showSealLine}
        onShowSealLineChange={setShowSealLine}
        onExport={handleExport}
        selectedCount={selectedQuestions.length}
      />

      {/* Main content area */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left: Question selector */}
        <div className="w-[360px] flex-shrink-0 overflow-hidden">
          <QuestionSelector
            questions={questions}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            onReorder={handleReorder}
          />
        </div>

        {/* Right: Paper preview */}
        <div className="flex-1 overflow-hidden" ref={previewRef}>
          <PaperPreview
            questions={selectedQuestions}
            numberingMode={numberingMode}
            pageSize={pageSize}
            previewMode={previewMode}
            paperTitle={paperTitle}
            schoolName={schoolName}
            studentId={studentId}
            examTime={examTime}
            totalScore={totalScore}
            showSealLine={showSealLine}
          />
        </div>
      </div>
    </div>
  )
}
