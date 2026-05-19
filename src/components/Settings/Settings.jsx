import { useState, useEffect } from 'react'
import { loadLLMConfig, saveLLMConfig, defaultConfig } from '../../store/llmConfigStore'
import { testConnection, testVisionCapability } from '../../services/llmService'

function isDashscope(url) {
  return /dashscope/i.test(url)
}

// Reusable section for one API config (vision or text)
function ApiConfigSection({ label, description, config, onChange, onTest, onTestVision }) {
  const [testing, setTesting] = useState(false)
  const [testingVision, setTestingVision] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const dashscope = isDashscope(config.baseUrl)

  const update = (field, value) => {
    onChange({ ...config, [field]: value })
  }

  const handleTest = async () => {
    setTesting(true)
    await onTest()
    setTesting(false)
  }

  const handleTestVision = async () => {
    setTestingVision(true)
    await onTestVision()
    setTestingVision(false)
  }

  const statusColor = config.connected
    ? 'bg-green-100 text-green-700 border-green-200'
    : 'bg-red-50 text-red-600 border-red-200'

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <button
        className="w-full px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="text-left">
          <h3 className="font-heading text-base font-semibold text-text">{label}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          {config.lastTested > 0 && (
            <span className={`text-xs px-2.5 py-1 rounded-full border ${statusColor}`}>
              {config.connected ? '✓ 已连接' : '✗ 未连接'}
            </span>
          )}
          <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
          {/* Base URL */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">API Base URL</label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => update('baseUrl', e.target.value)}
              placeholder="https://api.openai.com"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
            />
            {dashscope ? (
              <p className="text-xs text-blue-600 mt-1">🔵 检测到阿里云百炼 (Dashscope) 端点。图片格式将自动使用 <code className="bg-blue-50 px-1 rounded">{'{image: "data:..."}'}</code> 格式发送。</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">OpenAI 兼容端点，如 https://api.openai.com 或 https://api.deepseek.com</p>
            )}
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => update('apiKey', e.target.value)}
              placeholder="sk-..."
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
            />
          </div>

          {/* Custom Paths */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Chat 端点 <span className="text-gray-400">（可选）</span>
              </label>
              <input
                type="text"
                value={config.chatPath}
                onChange={(e) => update('chatPath', e.target.value)}
                placeholder="/v1/chat/completions"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Models 端点 <span className="text-gray-400">（可选）</span>
              </label>
              <input
                type="text"
                value={config.modelsPath}
                onChange={(e) => update('modelsPath', e.target.value)}
                placeholder="/v1/models"
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">模型</label>
            <div className="flex gap-2">
              {config.availableModels.length > 0 ? (
                <select
                  value={config.model}
                  onChange={(e) => update('model', e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
                >
                  <option value="">选择模型</option>
                  {config.availableModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={config.model}
                  onChange={(e) => update('model', e.target.value)}
                  placeholder="gpt-4o"
                  className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
                />
              )}
            </div>
            {config.availableModels.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">检测到 {config.availableModels.length} 个可用模型</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleTest}
              disabled={testing || !config.baseUrl}
              className="flex-1 py-2.5 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {testing ? '⏳ 检测中...' : '🔗 检测连接 & 获取模型'}
            </button>
            {label.includes('视觉') && (
              <button
                onClick={handleTestVision}
                disabled={testingVision || !config.connected || !config.model}
                className="flex-1 py-2.5 rounded-lg bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {testingVision ? '⏳ 检测中...' : '👁️ 检测视觉能力'}
              </button>
            )}
          </div>

          {/* Vision Status */}
          {label.includes('视觉') && config.lastTested > 0 && (
            <div className={`rounded-lg p-3 text-xs border ${
              config.visionAvailable
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-yellow-50 border-yellow-200 text-yellow-700'
            }`}>
              {config.visionAvailable
                ? '✅ 该模型支持视觉识别（多模态），可用于图片 → LaTeX 识别'
                : '⚠️ 该模型不支持视觉识别，图片识别功能将不可用。请使用支持多模态的模型（如 gpt-4o、claude-3 等）'}
            </div>
          )}

          {/* Last tested */}
          {config.lastTested > 0 && (
            <p className="text-xs text-gray-400">
              最后检测：{new Date(config.lastTested).toLocaleString('zh-CN')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Settings({ llmConfig, onConfigChange }) {
  const [localConfig, setLocalConfig] = useState(llmConfig)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setLocalConfig(llmConfig)
  }, [llmConfig])

  const handleSave = () => {
    saveLLMConfig(localConfig)
    onConfigChange(localConfig)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    if (confirm('确定要重置所有配置吗？')) {
      const fresh = { ...defaultConfig }
      setLocalConfig(fresh)
      saveLLMConfig(fresh)
      onConfigChange(fresh)
    }
  }

  const testVisionConnection = async () => {
    const result = await testConnection(localConfig.vision)
    setLocalConfig(prev => ({
      ...prev,
      vision: {
        ...prev.vision,
        connected: result.connected,
        availableModels: result.models,
        lastTested: Date.now(),
        model: result.models.length > 0 && !prev.vision.model ? result.models[0] : prev.vision.model,
      },
    }))
    if (!result.connected) {
      alert(`连接检测失败：${result.error}`)
    } else {
      alert(`连接成功！检测到 ${result.models.length} 个模型`)
    }
  }

  const testVisionCapability_ = async () => {
    const result = await testVisionCapability(localConfig.vision)
    setLocalConfig(prev => ({
      ...prev,
      vision: {
        ...prev.vision,
        visionAvailable: result.visionAvailable,
        lastTested: Date.now(),
      },
    }))
    if (result.visionAvailable) {
      alert('✅ 该模型支持视觉识别！')
    } else {
      alert(`视觉能力检测：${result.error}`)
    }
  }

  const testTextConnection = async () => {
    const result = await testConnection(localConfig.text)
    setLocalConfig(prev => ({
      ...prev,
      text: {
        ...prev.text,
        connected: result.connected,
        availableModels: result.models,
        lastTested: Date.now(),
        model: result.models.length > 0 && !prev.text.model ? result.models[0] : prev.text.model,
      },
    }))
    if (!result.connected) {
      alert(`连接检测失败：${result.error}`)
    } else {
      alert(`连接成功！检测到 ${result.models.length} 个模型`)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-text">LLM API 设置</h2>
          <p className="text-gray-500 text-sm mt-1">配置视觉识别和文本生成两个独立的 API 接口</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-lg bg-white border border-border text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
          >
            🔄 重置
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer"
          >
            💾 保存配置
          </button>
        </div>
      </div>

      {saved && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
          ✅ 配置已保存！
        </div>
      )}

      <div className="space-y-4">
        <ApiConfigSection
          label="🔍 视觉识别 API"
          description="用于图片 → LaTeX 识别，需要支持多模态（视觉）的 LLM"
          config={localConfig.vision}
          onChange={(v) => setLocalConfig(prev => ({ ...prev, vision: v }))}
          onTest={testVisionConnection}
          onTestVision={testVisionCapability_}
        />

        <ApiConfigSection
          label="✍️ 文本生成 API"
          description="用于生成解答和自动打标，纯文本 LLM 即可"
          config={localConfig.text}
          onChange={(v) => setLocalConfig(prev => ({ ...prev, text: v }))}
          onTest={testTextConnection}
          onTestVision={() => {}}
        />
      </div>

      {/* Tips */}
      <div className="mt-6 bg-primary-50 rounded-xl border border-primary-200 p-4">
        <h4 className="text-sm font-semibold text-primary-700 mb-2">💡 使用提示</h4>
        <ul className="text-xs text-primary-600 space-y-1.5">
          <li>• <strong>视觉识别 API</strong>：推荐使用 gpt-4o、claude-3-opus、gemini-pro-vision、<strong>阿里云 qwen-vl-max / qwen-vl-plus</strong> 等多模态模型</li>
          <li>• <strong>文本生成 API</strong>：可以使用 DeepSeek、GPT-3.5、<strong>阿里云 qwen-turbo / qwen-plus / qwen-max</strong> 等纯文本模型，成本更低</li>
          <li>• 两个 API 可以使用不同的服务商，例如视觉用 OpenAI、文本用 DeepSeek</li>
          <li>• <strong>阿里云百炼</strong>：视觉识别 API 填写 <code className="bg-white px-1 rounded">https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation</code>，模型填写 <code className="bg-white px-1 rounded">qwen-vl-max</code> 或 <code className="bg-white px-1 rounded">qwen-vl-plus</code></li>
          <li>• 支持任何 OpenAI API 兼容的端点（如 Ollama、LM Studio 等本地模型）</li>
          <li>• API Key 仅保存在浏览器本地，不会上传到任何服务器</li>
        </ul>
      </div>
    </div>
  )
}
