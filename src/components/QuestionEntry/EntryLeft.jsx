import { useState, useRef } from 'react'
import { recognizeImage, recognizeBatchImage } from '../../services/llmService'
import ImageCropper from '../common/ImageCropper'

export default function EntryLeft({ onImageRecognized, onBatchRecognized, llmConfig, onCropComplete }) {
  const [mode, setMode] = useState('single')
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState(null)
  const [recognizing, setRecognizing] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [error, setError] = useState('')
  const [showCropper, setShowCropper] = useState(false)
  const [batchCount, setBatchCount] = useState(0)
  const fileInputRef = useRef(null)

  const visionConfigured = llmConfig?.vision?.connected && llmConfig?.vision?.model

  const handleSingleFile = async (file) => {
    setError('')
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.readAsDataURL(file)
    })
    setPreview(dataUrl)

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
    } catch (err) {
      setError(err.message || '识别失败，请重试')
    } finally {
      setRecognizing(false)
    }
  }

  const handleBatchFiles = async (files) => {
    setError('')
    const fileList = Array.from(files)
    setBatchCount(fileList.length)
    setPreview(null)

    if (!visionConfigured) {
      setError('请先前往「API 设置」配置并检测视觉识别 API')
      return
    }

    if (fileList.length === 0) return

    // Show first image as preview
    const firstDataUrl = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.readAsDataURL(fileList[0])
    })
    setPreview(firstDataUrl)

    setRecognizing(true)
    setProgressText(`正在识别 ${fileList.length} 张图片...`)

    try {
      const results = await recognizeBatchImage(fileList, llmConfig.vision, (text) => {
        setProgressText(text)
      })

      // Check for empty or invalid results
      const validResults = results.filter(r => r.content && r.content.trim())
      if (validResults.length === 0) {
        setError('未能识别到任何有效题目，请检查图片是否清晰，或尝试单张识别')
        setProgressText('')
        return
      }
      if (validResults.length < results.length) {
        setProgressText(`⚠️ 部分题目内容为空（${validResults.length}/${results.length} 题有效）`)
      }

      onBatchRecognized?.(results)

      setProgressText(`✅ 识别完成！共提取 ${results.length} 道题目`)
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

      {/* Vision API Status */}
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
          📋 批量模式：可选择多张试卷图片，AI 将识别所有题目并按顺序列出
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
          accept="image/*"
          multiple={mode === 'batch'}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {preview ? (
          <div>
            <img src={preview} alt="预览" className="max-h-48 mx-auto rounded-lg object-contain" />
            {mode === 'batch' && batchCount > 1 && (
              <p className="text-xs text-primary-600 mt-1 font-medium">共选择 {batchCount} 张图片</p>
            )}
            <p className="text-xs text-gray-400 mt-1">点击或拖拽更换图片</p>
          </div>
        ) : (
          <div>
            <div className="text-4xl mb-3">📷</div>
            <p className="text-sm font-medium text-gray-600">
              {mode === 'single' ? '上传题目图片' : '上传试卷图片（可多选）'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {mode === 'single' ? '拖拽或点击选择 · 支持 JPG/PNG' : '点击选择多张图片 · 支持 JPG/PNG'}
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

      {/* Crop button — single mode only */}
      {mode === 'single' && preview && (
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
        <p className="text-xs text-primary-700 font-medium mb-1">🤖 AI 图片识别</p>
        <p className="text-xs text-primary-600">
          {mode === 'single'
            ? '上传题目图片，AI 将自动识别并转换为 LaTeX 格式。'
            : '上传整张试卷图片，AI 将自动提取所有题目。'}
          {llmConfig?.vision?.visionAvailable && (
            <span className="block mt-1 text-green-600">✓ 当前模型支持多模态视觉识别</span>
          )}
        </p>
      </div>

      {/* Cropper Modal */}
      {showCropper && preview && (
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
