import { useState } from 'react'
import EntryLeft from './EntryLeft'
import EntryMiddle from './EntryMiddle'
import EntryRight from './EntryRight'
import { createQuestion, getQuestionTypesForGrade } from '../../store/questionStore'
import { autoTag } from '../../services/llmService'

export default function QuestionEntry({ questions, setQuestions, llmConfig }) {
  const [question, setQuestion] = useState(() => createQuestion())
  const [saved, setSaved] = useState(false)
  const [batchQuestions, setBatchQuestions] = useState([])
  const [selectedBatchIndex, setSelectedBatchIndex] = useState(-1)
  const [examName, setExamName] = useState('')

  const handleImageRecognized = (result) => {
    setQuestion(prev => ({
      ...prev,
      content: result.content || prev.content,
      answer: result.answer || prev.answer,
      grade: prev.grade || result.grade || '',
      topic: prev.topic || result.topic || '',
      questionType: prev.questionType || result.questionType || '',
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
      questionType: r.questionType,
      tags: r.tags,
      imageUrl: r.imageUrl || '',
      examName: examName || '',
    }))
    setBatchQuestions(batchList)
    // Select the first one
    if (batchList.length > 0) {
      setSelectedBatchIndex(0)
      setQuestion(batchList[0])
    }
  }

  const handleQuestionChange = (updated) => {
    // In batch mode, propagate grade changes to all questions
    if (batchQuestions.length > 0 && updated.grade !== question.grade) {
      const newTypes = getQuestionTypesForGrade(updated.grade)
      setBatchQuestions(prev => prev.map(q => ({
        ...q,
        grade: updated.grade,
        questionType: newTypes.includes(q.questionType) ? q.questionType : '',
      })))
    }
    // Clear questionType if not valid for new grade
    if (updated.grade !== question.grade && updated.questionType) {
      const validTypes = getQuestionTypesForGrade(updated.grade)
      if (!validTypes.includes(updated.questionType)) {
        updated = { ...updated, questionType: '' }
      }
    }
    setQuestion(updated)
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

  const handleBatchAutoTag = async () => {
    if (!batchQuestions.length) return
    // Save current question edits first
    const currentBatch = [...batchQuestions]
    if (selectedBatchIndex >= 0 && selectedBatchIndex < currentBatch.length) {
      currentBatch[selectedBatchIndex] = { ...question }
    }
    // Auto-tag each question that doesn't have tags
    const updated = [...currentBatch]
    for (let i = 0; i < updated.length; i++) {
      if (!updated[i].content?.trim()) continue
      try {
        const tags = await autoTag(updated[i].content, llmConfig.text)
        const existing = new Set(updated[i].tags || [])
        updated[i] = { ...updated[i], tags: [...new Set([...(updated[i].tags || []), ...tags])] }
      } catch (err) {
        console.warn(`批量打标第${i + 1}题失败:`, err.message)
      }
    }
    setBatchQuestions(updated)
    // Update current question view
    if (selectedBatchIndex >= 0) {
      setQuestion(updated[selectedBatchIndex])
    }
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
            examName={examName}
            onExamNameChange={setExamName}
          />
        </div>

        {/* Middle Column */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-border shadow-sm p-4 overflow-y-auto">
          <EntryMiddle
            question={question}
            onChange={handleQuestionChange}
            llmConfig={llmConfig}
            batchQuestions={batchQuestions}
            selectedBatchIndex={selectedBatchIndex}
            onSelectBatchQuestion={selectBatchQuestion}
            onBatchAutoTag={handleBatchAutoTag}
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
