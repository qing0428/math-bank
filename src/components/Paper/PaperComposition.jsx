import { useState, useCallback, useEffect, useRef } from 'react'
import QuestionSelector from './QuestionSelector'
import PaperPreview from './PaperPreview'
import PaperSettings from './PaperSettings'
import AiComposePanel from './AiComposePanel'
import {
  loadPaperConfig, savePaperConfig, exportToPDF, exportToWord,
  loadCompositions, saveComposition, deleteComposition,
} from '../../store/paperStore'
import { generateFlatNumbers, generateNestedNumbers } from '../../utils/numbering'
import { autoSelectQuestions, aiComposeQuestions } from '../../services/compositionService'

export default function PaperComposition({ questions, llmConfig }) {
  const savedConfig = loadPaperConfig()

  const [compId, setCompId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(savedConfig.selectedIds || [])
  const [numberingMode, setNumberingMode] = useState(savedConfig.numberingMode || 'nested')
  const [previewMode, setPreviewMode] = useState('student')
  const [paperTitle, setPaperTitle] = useState(savedConfig.paperTitle || '数学试卷')
  const [groupOrder, setGroupOrder] = useState(savedConfig.groupOrder || [])
  const [savedComps, setSavedComps] = useState(loadCompositions())
  const [showExportDialog, setShowExportDialog] = useState(null) // { format, version }
  const [exportFilename, setExportFilename] = useState('')
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [composeMessage, setComposeMessage] = useState('')

  const previewRef = useRef(null)

  // Auto-save on change
  useEffect(() => {
    if (selectedIds.length === 0) return
    const entry = saveComposition({
      id: compId,
      paperTitle,
      numberingMode,
      selectedIds,
      groupOrder,
    })
    if (!compId) setCompId(entry.id)
    setSavedComps(loadCompositions())
    savePaperConfig({ numberingMode, selectedIds, paperTitle, groupOrder })
  }, [selectedIds, numberingMode, paperTitle, groupOrder])

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

  const handleLoadComp = (comp) => {
    setCompId(comp.id)
    setPaperTitle(comp.paperTitle)
    setNumberingMode(comp.numberingMode)
    setSelectedIds(comp.selectedIds)
  }

  const handleDeleteComp = (id) => {
    deleteComposition(id)
    setSavedComps(loadCompositions())
    if (compId === id) setCompId(null)
  }

  const handleNewComp = () => {
    setCompId(null)
    setPaperTitle('数学试卷')
    setSelectedIds([])
    setNumberingMode('nested')
  }

  const handleAiCompose = async (requirements, useAI) => {
    setComposeMessage('')

    let result
    if (useAI && llmConfig?.text?.connected) {
      result = await aiComposeQuestions(questions, requirements, llmConfig.text)
    } else {
      result = autoSelectQuestions(questions, requirements)
    }

    if (result.selected.length === 0) {
      setComposeMessage(result.message || '没有找到符合条件的题目')
      return
    }

    // Replace current selection with AI-selected questions
    setSelectedIds(result.selected.map(q => q.id))
    setComposeMessage(result.message)
    setShowAiPanel(false)
  }

  const selectedQuestions = selectedIds
    .map(id => questions.find(q => q.id === id))
    .filter(Boolean)

  // Auto-detect group order from selected questions
  useEffect(() => {
    if (selectedQuestions.length === 0) return
    const types = [...new Set(selectedQuestions.map(q => q.questionType || '其他'))]
    if (groupOrder.length === 0 || !types.every(t => groupOrder.includes(t))) {
      setGroupOrder(prev => {
        // Keep existing order, append new types
        const existing = prev.filter(t => types.includes(t))
        const newTypes = types.filter(t => !prev.includes(t))
        return [...existing, ...newTypes]
      })
    }
  }, [selectedQuestions.map(q => q.questionType).join(',')])

  // Export with confirmation dialog
  const handleExportClick = (format, version) => {
    if (selectedQuestions.length === 0) return
    const date = new Date().toISOString().slice(0, 10)
    const defaultName = `${date}_${paperTitle}_${version === 'student' ? '学生版' : '教师版'}`
    setExportFilename(defaultName)
    setShowExportDialog({ format, version })
  }

  const handleExportConfirm = async () => {
    const { format, version } = showExportDialog
    setShowExportDialog(null)

    const numbered = numberingMode === 'flat'
      ? generateFlatNumbers(selectedQuestions)
      : generateNestedNumbers(selectedQuestions, groupOrder)

    if (format === 'word') {
      await exportToWord(numbered, numberingMode, paperTitle, version, 'A4', exportFilename)
    } else if (format === 'pdf') {
      const container = document.querySelector('[data-paper-container]')
      if (container) {
        await exportToPDF(container, exportFilename)
      }
    }
  }

  return (
    <div className="flex flex-col h-full gap-4 p-6">
      <PaperSettings
        numberingMode={numberingMode}
        onNumberingModeChange={setNumberingMode}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
        paperTitle={paperTitle}
        onPaperTitleChange={setPaperTitle}
        onExport={handleExportClick}
        selectedCount={selectedQuestions.length}
        onAiCompose={() => setShowAiPanel(true)}
      />

      {/* Compose message */}
      {composeMessage && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-3 text-sm text-green-700 flex items-center justify-between">
          <span>{composeMessage}</span>
          <button onClick={() => setComposeMessage('')} className="text-green-500 hover:text-green-700 cursor-pointer">✕</button>
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left: saved compositions + question selector */}
        <div className="w-[360px] flex-shrink-0 overflow-hidden flex flex-col gap-4">
          {/* Saved compositions */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-500">已保存的组卷</h3>
              <button onClick={handleNewComp} className="text-xs text-primary-600 hover:text-primary-800 cursor-pointer">
                ＋ 新建
              </button>
            </div>
            {savedComps.length === 0 ? (
              <p className="text-xs text-gray-300 py-1">暂无保存的组卷</p>
            ) : (
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {savedComps.map(c => (
                  <div key={c.id} className={`flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer group
                    ${compId === c.id ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50'}`}
                    onClick={() => handleLoadComp(c)}>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-gray-300 text-[10px]">{c.selectedIds.length}题</span>
                    <button onClick={e => { e.stopPropagation(); handleDeleteComp(c.id) }}
                      className="text-gray-300 hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Question selector */}
          <div className="flex-1 overflow-hidden min-h-0">
            <QuestionSelector
              questions={questions}
              selectedIds={selectedIds}
              onToggle={handleToggle}
              onReorder={handleReorder}
              groupOrder={groupOrder}
              onGroupOrderChange={setGroupOrder}
            />
          </div>
        </div>

        {/* Right: paper preview */}
        <div className="flex-1 overflow-hidden" ref={previewRef}>
          <PaperPreview
            questions={selectedQuestions}
            numberingMode={numberingMode}
            previewMode={previewMode}
            paperTitle={paperTitle}
            groupOrder={groupOrder}
          />
        </div>
      </div>

      {/* AI Compose Panel */}
      {showAiPanel && (
        <AiComposePanel
          questions={questions}
          onCompose={handleAiCompose}
          onClose={() => setShowAiPanel(false)}
          llmConfig={llmConfig}
        />
      )}

      {/* Export confirmation dialog */}
      {showExportDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowExportDialog(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-text mb-4">确认导出</h3>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">文件名</label>
              <input
                type="text"
                value={exportFilename}
                onChange={e => setExportFilename(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
              <p className="text-xs text-gray-400 mt-1">
                将导出为 {showExportDialog.format === 'word' ? '.docx' : '.pdf'} 文件
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowExportDialog(null)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm cursor-pointer">取消</button>
              <button onClick={handleExportConfirm} className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm cursor-pointer">确认导出</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
