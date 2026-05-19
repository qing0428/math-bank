const LLM_CONFIG_KEY = 'llmConfig'

// Default config — two independent API configs:
// 1. vision: for image recognition (multimodal LLM required)
// 2. text: for solution generation & auto-tagging (text-only LLM is fine)
const defaultConfig = {
  vision: {
    name: '视觉识别 API',
    baseUrl: '',
    apiKey: '',
    model: '',
    // endpoint paths — auto-detect if left empty
    chatPath: '',       // e.g. /v1/chat/completions
    modelsPath: '',     // e.g. /v1/models
    // test results
    connected: false,
    visionAvailable: false,
    availableModels: [],
    lastTested: 0,
  },
  text: {
    name: '文本生成 API',
    baseUrl: '',
    apiKey: '',
    model: '',
    chatPath: '',
    modelsPath: '',
    connected: false,
    availableModels: [],
    lastTested: 0,
  },
}

export function loadLLMConfig() {
  try {
    const stored = localStorage.getItem(LLM_CONFIG_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Merge with defaults so new fields are always present
      return {
        vision: { ...defaultConfig.vision, ...parsed.vision },
        text: { ...defaultConfig.text, ...parsed.text },
      }
    }
  } catch { /* ignore */ }
  return { ...defaultConfig }
}

export function saveLLMConfig(config) {
  localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(config))
}

export function resetLLMConfig() {
  localStorage.removeItem(LLM_CONFIG_KEY)
  return { ...defaultConfig }
}

export { defaultConfig }
