import { useState } from 'react'
import EntryLeft from './EntryLeft'
import EntryMiddle from './EntryMiddle'
import EntryRight from './EntryRight'
import { createQuestion } from '../../store/questionStore'

export default function QuestionEntry({ questions, setQuestions, llmConfig }) {
  const [question, setQuestion] = useState(() => createQuestion())
  const [saved, setSaved] = useState(false)
  const [batchQuestions, setBatchQuestions] = useState([])
  const [selectedBatchIndex, setSelectedBatchIndex] = useState(-1)

  const handleImageRecognized = (result) => {
    setQuestion(prev => ({
      ...prev,
      content: result.content || prev.content,
      answer: result.answer || prev.answer,
      grade: prev.grade || result.grade || '',
      topic: prev.topic || result.topic || '',
      tags: result.tags?.length
        ? [...new Set([...(prev.tags || []), ...result.tags])]
        : prev.tags,
      imageUrl: result.imageUrl || prev.imageUrl,
    }))
  }

  const handleBatchRecognized = (results) => {
    // Create question objects from batch results
    const batchList = results.map((r, i) => createQuestion({
      content: r.content,
      answer: r.answer,
      grade: r.grade,
      topic: r.topic,
      tags: r.tags,
    }))
    setBatchQuestions(batchList)
    // Select the first one
    if (batchList.length > 0) {
      setSelectedBatchIndex(0)
      setQuestion(batchList[0])
    }
  }

  const selectBatchQuestion = (index) => {
    // Save current question back to batch list first
    if (selectedBatchIndex >= 0 && selectedBatchIndex < batchQuestions.length) {
      const updated = [...batchQuestions]
      updated[selectedBatchIndex] = { ...question }
      setBatchQuestions(updated)
    }
    setSelectedBatchIndex(index)
    setQuestion(batchQuestions[index])
  }

  const handleSave = () => {
    if (!question.content?.trim()) return

    const now = Date.now()
    const toSave = {
      ...question,
      id: question.id || createQuestion().id,
      updatedAt: now,
    }

    const existing = questions.findIndex(q => q.id === toSave.id)
    let newQuestions
    if (existing >= 0) {
      newQuestions = [...questions]
      newQuestions[existing] = toSave
    } else {
      newQuestions = [...questions, { ...toSave, createdAt: now }]
    }

    setQuestions(newQuestions)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      // In batch mode, move to next question
      if (batchQuestions.length > 0) {
        const nextIndex = selectedBatchIndex + 1
        if (nextIndex < batchQuestions.length) {
          setSelectedBatchIndex(nextIndex)
          setQuestion(batchQuestions[nextIndex])
        } else {
          // All saved, reset
          setBatchQuestions([])
          setSelectedBatchIndex(-1)
          setQuestion(createQuestion())
        }
      } else {
        setQuestion(createQuestion())
      }
    }, 1500)
  }

  return (
    <div className="p-6 h-full">
      <div className="mb-6">
        <h2 className="font-heading text-2xl font-bold text-text">录入题目</h2>
        <p className="text-gray-500 text-sm mt-1">AI 图片识别 · LaTeX 编辑 · 实时预览</p>
      </div>

      {saved && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium animate-pulse">
          ✅ 题目保存成功！{batchQuestions.length > 0 && `(${selectedBatchIndex + 1}/${batchQuestions.length})`}
        </div>
      )}

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100%-6rem)]">
        {/* Left Column */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-border shadow-sm p-4 overflow-y-auto">
          <EntryLeft
            onImageRecognized={handleImageRecognized}
            onBatchRecognized={handleBatchRecognized}
            llmConfig={llmConfig}
            onCropComplete={(dataUrl) => setQuestion(prev => ({ ...prev, imageUrl: dataUrl }))}
          />
        </div>

        {/* Middle Column */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-border shadow-sm p-4 overflow-y-auto">
          <EntryMiddle
            question={question}
            onChange={setQuestion}
            llmConfig={llmConfig}
            batchQuestions={batchQuestions}
            selectedBatchIndex={selectedBatchIndex}
            onSelectBatchQuestion={selectBatchQuestion}
          />
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-border shadow-sm p-4 overflow-y-auto">
          <EntryRight question={question} onSave={handleSave} />
        </div>
      </div>
    </div>
  )
}
