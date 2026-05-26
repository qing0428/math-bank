import { useState, useRef } from 'react'
import { recognizeImage, recognizeBatchImage, recognizeText, recognizeBatchText } from '../../services/llmService'
import ImageCropper from '../common/ImageCropper'

// pdfjs-dist setup
import * as pdfjsLib from 'pdfjs-dist'
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()

// mammoth for Word extraction
import mammoth from 'mammoth'

// File type helpers
function getFileType(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx' || ext === 'doc') return 'word'
  if (file.type && file.type.startsWith('image/')) return 'image'
  // Fallback by extension
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) return 'image'
  return 'unknown'
}

async function renderPdfToImages(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const images = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise
    images.push(canvas.toDataURL('image/png'))
  }
  return images
}

async function extractWordText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

export default function EntryLeft({ onImageRecognized, onBatchRecognized, llmConfig, onCropComplete, examName, onExamNameChange }) {
  const [mode, setMode] = useState('single')
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState(null)
  const [previewType, setPreviewType] = useState(null) // 'image' | 'pdf' | 'word'
  const [fileName, setFileName] = useState('')
  const [recognizing, setRecognizing] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [error, setError] = useState('')
  const [showCropper, setShowCropper] = useState(false)
  const [batchCount, setBatchCount] = useState(0)
  const fileInputRef = useRef(null)

  const visionConfigured = llmConfig?.vision?.connected && llmConfig?.vision?.model
  const textConfigured = llmConfig?.text?.connected && llmConfig?.text?.model

  // Get the best available config for text-based recognition
  const getTextConfig = () => textConfigured ? llmConfig.text : llmConfig.vision

  const handleSingleFile = async (file) => {
    setError('')
    const fileType = getFileType(file)
    setFileName(file.name)

    if (fileType === 'image') {
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target.result)
        reader.readAsDataURL(file)
      })
      setPreview(dataUrl)
      setPreviewType('image')

      if (!visionConfigured) {
        setError('请先前往「API 设置」配置并检测视觉识别 API')
        return
      }

      setRecognizing(true)
      setProgressText('准备识别...')

      try {
        const result = await recognizeImage(file, llmConfig.vision, (text) => {
          setProgressText(text)
        })
        onImageRecognized?.({ ...result, imageUrl: dataUrl })
        showSuccessFields(result)
      } catch (err) {
        setError(err.message || '识别失败，请重试')
      } finally {
        setRecognizing(false)
      }
    } else if (fileType === 'pdf') {
      if (!visionConfigured) {
        setPreview(null)
        setPreviewType('pdf')
        setFileName(file.name)
        setError('请先前往「API 设置」配置并检测视觉识别 API')
        return
      }

      setRecognizing(true)
      setProgressText('正在渲染 PDF 页面...')

      try {
        const images = await renderPdfToImages(file)
        if (images.length === 0) {
          throw new Error('PDF 文件为空或无法渲染')
        }

        // Show first page as preview
        setPreview(images[0])
        setPreviewType('pdf')
        setProgressText(`PDF 共 ${images.length} 页，正在识别...`)

        // Convert data URLs to File objects for the recognition pipeline
        const imageFiles = await Promise.all(images.map((dataUrl, idx) =>
          dataUrlToFile(dataUrl, `pdf_page_${idx + 1}.png`)
        ))

        const results = await recognizeBatchImage(imageFiles, llmConfig.vision, (text) => {
          setProgressText(text)
        })

        if (results.length === 1) {
          onImageRecognized?.({ ...results[0], imageUrl: images[0] })
          showSuccessFields(results[0])
        } else {
          onBatchRecognized?.(results)
          setProgressText(`✅ 识别完成！共提取 ${results.length} 道题目`)
          setTimeout(() => setProgressText(''), 3000)
        }
      } catch (err) {
        setError(err.message || 'PDF 识别失败，请重试')
      } finally {
        setRecognizing(false)
      }
    } else if (fileType === 'word') {
      setPreview(null)
      setPreviewType('word')
      setFileName(file.name)

      const config = getTextConfig()
      if (!config?.connected || !config?.model) {
        setError('请先前往「API 设置」配置并检测 API（视觉或文本 API 均可）')
        return
      }

      setRecognizing(true)
      setProgressText('正在读取 Word 文档...')

      try {
        const text = await extractWordText(file)
        if (!text || text.trim().length < 5) {
          throw new Error('Word 文档内容为空，请检查文件是否包含数学题目')
        }

        setProgressText('AI 正在分析文档内容...')
        const result = await recognizeText(text, config, (msg) => {
          setProgressText(msg)
        })
        onImageRecognized?.(result)
        showSuccessFields(result)
      } catch (err) {
        setError(err.message || 'Word 文档识别失败，请重试')
      } finally {
        setRecognizing(false)
      }
    } else {
      setError('不支持的文件格式。请上传图片（JPG/PNG）、PDF 或 Word（.docx）文件')
    }
  }

  const handleBatchFiles = async (files) => {
    setError('')
    const fileList = Array.from(files)
    setBatchCount(fileList.length)
    setPreview(null)
    setPreviewType(null)

    if (!visionConfigured && !textConfigured) {
      setError('请先前往「API 设置」配置并检测 API')
      return
    }

    if (fileList.length === 0) return

    setRecognizing(true)
    setProgressText(`正在处理 ${fileList.length} 个文件...`)

    try {
      // Separate files by type
      const allResults = []
      const allImageFiles = []
      let previewSet = false

      for (const file of fileList) {
        const fileType = getFileType(file)

        if (fileType === 'image') {
          // Set first image as preview
          if (!previewSet) {
            const dataUrl = await new Promise((resolve) => {
              const reader = new FileReader()
              reader.onload = (e) => resolve(e.target.result)
              reader.readAsDataURL(file)
            })
            setPreview(dataUrl)
            setPreviewType('image')
            previewSet = true
          }
          allImageFiles.push(file)
        } else if (fileType === 'pdf') {
          const images = await renderPdfToImages(file)
          if (!previewSet && images.length > 0) {
            setPreview(images[0])
            setPreviewType('pdf')
            previewSet = true
          }
          const imageFiles = await Promise.all(images.map((dataUrl, idx) =>
            dataUrlToFile(dataUrl, `pdf_page_${idx}.png`)
          ))
          allImageFiles.push(...imageFiles)
        } else if (fileType === 'word') {
          if (!previewSet) {
            setPreview(null)
            setPreviewType('word')
            setFileName(file.name)
            previewSet = true
          }
          const text = await extractWordText(file)
          if (text && text.trim().length >= 5) {
            const config = getTextConfig()
            const wordResults = await recognizeBatchText(text, config, (msg) => {
              setProgressText(msg)
            })
            allResults.push(...wordResults)
          }
        }
      }

      // Process all image-based files (images + PDF pages) in one batch
      if (allImageFiles.length > 0 && visionConfigured) {
        setProgressText(`AI 正在识别 ${allImageFiles.length} 张图片...`)
        const imageResults = await recognizeBatchImage(allImageFiles, llmConfig.vision, (text) => {
          setProgressText(text)
        })
        allResults.push(...imageResults)
      }

      if (allResults.length === 0) {
        setError('未能识别到任何有效题目')
        setProgressText('')
        return
      }

      onBatchRecognized?.(allResults)
      setProgressText(`✅ 识别完成！共提取 ${allResults.length} 道题目`)
      setTimeout(() => setProgressText(''), 3000)
    } catch (err) {
      setError(err.message || '批量识别失败，请重试')
    } finally {
      setRecognizing(false)
    }
  }

  const handleFiles = async (files) => {
    if (mode === 'batch') {
      handleBatchFiles(files)
    } else {
      handleSingleFile(files[0])
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  function showSuccessFields(result) {
    const fields = []
    if (result.content) fields.push('题目内容')
    if (result.answer) fields.push('答案')
    if (result.grade) fields.push(`年级(${result.grade})`)
    if (result.topic) fields.push(`板块(${result.topic})`)
    if (result.tags?.length) fields.push(`${result.tags.length}个标签`)
    if (fields.length > 0) {
      setError('')
      setProgressText(`✅ 识别成功！已自动填入：${fields.join('、')}`)
      setTimeout(() => setProgressText(''), 3000)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-heading text-base font-semibold text-text">录入方式</h3>

      {/* Mode Tabs */}
      <div className="flex rounded-lg border border-border overflow-hidden">
        <button
          className={`flex-1 py-2 text-sm font-medium transition-all cursor-pointer
            ${mode === 'single' ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          onClick={() => { setMode('single'); setBatchCount(0) }}
        >
          单题录入
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium transition-all cursor-pointer
            ${mode === 'batch' ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          onClick={() => { setMode('batch'); setPreview(null) }}
        >
          批量录入
        </button>
      </div>

      {/* API Status */}
      <div className={`rounded-lg p-2.5 text-xs border ${
        visionConfigured
          ? 'bg-green-50 border-green-200 text-green-700'
          : 'bg-yellow-50 border-yellow-200 text-yellow-700'
      }`}>
        {visionConfigured
          ? `✅ 视觉识别就绪 (${llmConfig.vision.model})`
          : '⚠️ 未配置视觉识别 API，请前往「API 设置」进行配置'}
      </div>

      {/* Batch mode hint */}
      {mode === 'batch' && (
        <div className="bg-amber-50 rounded-lg p-2.5 text-xs border border-amber-200 text-amber-700">
          📋 批量模式：可选择多个文件（图片/PDF/Word），AI 将识别所有题目并按顺序列出
        </div>
      )}

      {/* Exam name — batch mode only */}
      {mode === 'batch' && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">试卷名称（可选）</label>
          <input
            type="text"
            value={examName || ''}
            onChange={(e) => onExamNameChange?.(e.target.value)}
            placeholder="如：2021年日照市新营小学期末试卷"
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
          />
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer
          ${dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:border-primary-300 hover:bg-gray-50'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.docx,.doc"
          multiple={mode === 'batch'}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {preview ? (
          <div>
            <img src={preview} alt="预览" className="max-h-48 mx-auto rounded-lg object-contain" />
            {previewType === 'pdf' && (
              <p className="text-xs text-primary-600 mt-1 font-medium">{fileName}</p>
            )}
            {mode === 'batch' && batchCount > 1 && (
              <p className="text-xs text-primary-600 mt-1 font-medium">共选择 {batchCount} 个文件</p>
            )}
            <p className="text-xs text-gray-400 mt-1">点击或拖拽更换文件</p>
          </div>
        ) : previewType === 'word' && fileName ? (
          <div>
            <div className="text-4xl mb-3">📄</div>
            <p className="text-sm font-medium text-gray-600">{fileName}</p>
            <p className="text-xs text-gray-400 mt-1">Word 文档</p>
          </div>
        ) : (
          <div>
            <div className="text-4xl mb-3">📁</div>
            <p className="text-sm font-medium text-gray-600">
              {mode === 'single' ? '上传题目文件' : '上传试卷文件（可多选）'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {mode === 'single'
                ? '拖拽或点击选择 · 支持 JPG/PNG/PDF/Word'
                : '点击选择多个文件 · 支持 JPG/PNG/PDF/Word'}
            </p>
          </div>
        )}

        {recognizing && (
          <div className="absolute inset-0 bg-white/90 rounded-xl flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin text-3xl mb-2">⏳</div>
              <p className="text-sm text-primary-600 font-medium">{progressText || 'AI 识别中...'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Crop button — single mode + image only */}
      {mode === 'single' && preview && previewType === 'image' && (
        <button
          onClick={() => setShowCropper(true)}
          className="w-full py-2 rounded-lg border border-primary-300 text-primary-600 text-sm font-medium hover:bg-primary-50 transition-colors cursor-pointer"
        >
          ✂️ 裁剪图片
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-red-600 text-xs">
          ❌ {error}
        </div>
      )}

      {/* AI Info */}
      <div className="bg-primary-50 rounded-lg p-3 border border-primary-200">
        <p className="text-xs text-primary-700 font-medium mb-1">🤖 AI 识别</p>
        <p className="text-xs text-primary-600">
          {mode === 'single'
            ? '上传图片/PDF/Word文件，AI 将自动识别并转换为 LaTeX 格式。'
            : '上传试卷文件（图片/PDF/Word），AI 将自动提取所有题目。'}
          {llmConfig?.vision?.visionAvailable && (
            <span className="block mt-1 text-green-600">✓ 当前模型支持多模态视觉识别</span>
          )}
        </p>
      </div>

      {/* Cropper Modal */}
      {showCropper && preview && previewType === 'image' && (
        <ImageCropper
          imageUrl={preview}
          onCropComplete={(dataUrl) => {
            setPreview(dataUrl)
            onCropComplete?.(dataUrl)
            setShowCropper(false)
          }}
          onCancel={() => setShowCropper(false)}
        />
      )}
    </div>
  )
}

// Helper: convert a data URL to a File object
async function dataUrlToFile(dataUrl, fileName) {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], fileName, { type: 'image/png' })
}
