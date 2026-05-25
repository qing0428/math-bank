/**
 * LLM Service Layer
 *
 * Supports two API modes:
 *
 * 1. OpenAI-compatible (OpenAI, DeepSeek, Ollama, etc.)
 *    - Image: { type: "image_url", image_url: { url: "data:image/..." } }
 *    - Response: { choices: [{ message: { content: "..." } }] }
 *
 * 2. Alibaba Cloud Dashscope (百炼) — OpenAI compatible mode
 *    - Base URL: https://dashscope.aliyuncs.com/compatible-mode/v1
 *    - Image: same as OpenAI format { type: "image_url", image_url: { url: "..." } }
 *    - Response: same as OpenAI format
 *    - Model names: qwen3.6-plus, qwen3.6-flash, qwen3.6-max-preview, qwen-vl-max, etc.
 *
 * Two independent configs:
 *   - vision: multimodal LLM for image → LaTeX recognition
 *   - text:   text-only LLM for solution generation & auto-tagging
 */

// ─── Helpers ───────────────────────────────────────────────

function buildUrl(base, path) {
  const b = base.replace(/\/+$/, '')
  const p = path.startsWith('/') ? path : '/' + path
  return b + p
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('请求超时', 'TimeoutError')), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接或 API 地址是否正确')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Detect whether an API URL is Alibaba Cloud Dashscope (百炼).
 * Supports both:
 *   - OpenAI compatible: dashscope.aliyuncs.com/compatible-mode/v1
 *   - Native DashScope:   dashscope.aliyuncs.com/api/v1/...
 */
function isDashscope(baseUrl) {
  return /dashscope/i.test(baseUrl)
}

/**
 * Detect whether using DashScope native API (not OpenAI compatible mode).
 * Native URLs look like: https://dashscope.aliyuncs.com/api/v1/services/...
 * OpenAI compatible URLs look like: https://dashscope.aliyuncs.com/compatible-mode/v1
 */
function isDashscopeNative(baseUrl) {
  return /dashscope/i.test(baseUrl) && /\/api\/v1\//i.test(baseUrl)
}

// ─── Connection & Model Detection ──────────────────────────

/**
 * Test API connectivity and fetch available models.
 * Returns { connected, models: [...], error? }
 */
export async function testConnection(config) {
  const { baseUrl, apiKey, modelsPath } = config
  if (!baseUrl) return { connected: false, models: [], error: '请输入 API Key' }

  // ── Dashscope (百炼) ──
  if (isDashscope(baseUrl)) {
    return testDashscopeConnection(config)
  }

  // ── OpenAI-compatible ──
  const mp = modelsPath || '/v1/models'
  try {
    const res = await fetchWithTimeout(buildUrl(baseUrl, mp), {
      headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
    }, 10000)

    if (res.ok) {
      const data = await res.json()
      const models = (data.data || []).map(m => m.id || m.name || m).filter(Boolean)
      return { connected: true, models, error: null }
    }

    return await testChatConnectivity(config)
  } catch (err) {
    if (err.name === 'AbortError') {
      return { connected: false, models: [], error: '连接超时，请检查 URL 和网络' }
    }
    return { connected: false, models: [], error: `连接失败: ${err.message}` }
  }
}

/**
 * Try to fetch available models from Dashscope.
 * Dashscope doesn't have a standard /v1/models endpoint, so we try several known endpoints.
 * If none work, we fall back to testing chat connectivity and return common Dashscope models.
 */
async function fetchDashscopeModels(baseUrl, apiKey) {
  // Try OpenAI-compatible models endpoint first (compatible-mode)
  if (!isDashscopeNative(baseUrl)) {
    try {
      const res = await fetchWithTimeout(buildUrl(baseUrl, '/models'), {
        headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
      }, 8000)
      if (res.ok) {
        const data = await res.json()
        const models = (data.data || []).map(m => m.id || m.name || m).filter(Boolean)
        if (models.length > 0) return models
      }
    } catch { /* ignore, try next */ }
  }

  // Dashscope doesn't expose a public models listing API.
  // Return a curated list of known models so the user can pick.
  return [
    // Vision / multimodal models
    'qwen-vl-max',
    'qwen-vl-max-latest',
    'qwen-vl-plus',
    'qwen-vl-plus-latest',
    'qwen3-vl-8b-instruct',
    'qwen3-vl-32b-instruct',
    // Text models
    'qwen3.6-plus',
    'qwen3.6-flash',
    'qwen3.6-max-preview',
    'qwen-max',
    'qwen-max-latest',
    'qwen-plus',
    'qwen-plus-latest',
    'qwen-turbo',
    'qwen-turbo-latest',
    'qwen-long',
    'qwen-coder-plus',
    'qwen-math-plus',
    // Other supported models
    'deepseek-v3',
    'deepseek-r1',
    'llama3.1-70b-instruct',
    'llama3.1-8b-instruct',
    'baichuan2-13b-chat-v1',
    'chatglm3-6b',
  ]
}

async function testDashscopeConnection(config) {
  const { baseUrl, apiKey, model } = config
  if (!apiKey) return { connected: false, models: [], error: '请输入 API Key' }

  const testModel = model || 'qwen3.6-plus'

  if (isDashscopeNative(baseUrl)) {
    // Native DashScope format — test with a simple chat request
    try {
      const res = await fetchWithTimeout(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: testModel,
          input: { messages: [{ role: 'user', content: 'Hi' }] },
          parameters: { max_tokens: 5 },
        }),
      }, 10000)

      if (res.ok) {
        const models = await fetchDashscopeModels(baseUrl, apiKey)
        return { connected: true, models, error: null }
      }
      const errText = await res.text().catch(() => '')
      return { connected: false, models: [], error: `API 返回 ${res.status}: ${errText.slice(0, 200)}` }
    } catch (err) {
      if (err.name === 'AbortError') {
        return { connected: false, models: [], error: '连接超时，请检查 URL 和网络' }
      }
      return { connected: false, models: [], error: `连接失败: ${err.message}` }
    }
  } else {
    // OpenAI compatible mode — try models endpoint first, then chat test
    const models = await fetchDashscopeModels(baseUrl, apiKey)

    try {
      const res = await fetchWithTimeout(buildUrl(baseUrl, '/chat/completions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        }),
      }, 10000)

      if (res.ok) {
        return { connected: true, models, error: null }
      }
      const errText = await res.text().catch(() => '')
      return { connected: false, models: [], error: `API 返回 ${res.status}: ${errText.slice(0, 200)}` }
    } catch (err) {
      if (err.name === 'AbortError') {
        return { connected: false, models: [], error: '连接超时，请检查 URL 和网络' }
      }
      return { connected: false, models: [], error: `连接失败: ${err.message}` }
    }
  }
}

async function testChatConnectivity(config) {
  const { baseUrl, apiKey, model, chatPath } = config
  const cp = chatPath || '/v1/chat/completions'
  const testModel = model || 'gpt-4o'

  try {
    const res = await fetchWithTimeout(buildUrl(baseUrl, cp), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: testModel,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }),
    }, 10000)

    if (res.ok) {
      return { connected: true, models: [testModel], error: null }
    }
    const errText = await res.text().catch(() => '')
    return { connected: false, models: [], error: `API 返回 ${res.status}: ${errText.slice(0, 200)}` }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { connected: false, models: [], error: '连接超时' }
    }
    return { connected: false, models: [], error: `连接失败: ${err.message}` }
  }
}

// ─── Vision Capability Detection ───────────────────────────

/**
 * Test whether a specific model supports vision (multimodal).
 * Returns { visionAvailable, error? }
 */
/**
 * Generate a small but valid test image (16x16 red square) as a data URL.
 * This meets the minimum size requirement of most vision APIs (e.g. Dashscope requires >10px).
 */
function generateTestImage() {
  const size = 16
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  // Draw a red square with a white "?" in the center so the model can describe it
  ctx.fillStyle = '#FF0000'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('?', size / 2, size / 2)
  return canvas.toDataURL('image/png')
}

export async function testVisionCapability(config) {
  const { baseUrl, apiKey, model } = config
  if (!model) return { visionAvailable: false, error: '请先选择模型' }

  // Generate a proper-sized test image (16x16, meets >10px requirement)
  const testImage = generateTestImage()

  if (isDashscopeNative(baseUrl)) {
    return testDashscopeNativeVision(config, testImage)
  }

  // OpenAI compatible (including Dashscope compatible-mode)
  const chatPath = isDashscope(baseUrl) ? '/chat/completions' : (config.chatPath || '/v1/chat/completions')
  const url = isDashscope(baseUrl) ? buildUrl(baseUrl, chatPath) : buildUrl(baseUrl, chatPath)

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: '请用一句话描述这张图片的内容' },
            { type: 'image_url', image_url: { url: testImage } },
          ],
        }],
        max_tokens: 20,
      }),
    }, 15000)

    if (res.ok) {
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content?.trim() || ''
      if (/没有|未|无法|不能|no image|cannot|didn't receive|未提供|看不到/i.test(text)) {
        return { visionAvailable: false, error: `模型 "${model}" 未能接收到图片。请确认该模型支持多模态视觉输入。` }
      }
      return { visionAvailable: true, error: null }
    }

    const errText = await res.text().catch(() => '')
    return { visionAvailable: false, error: `测试失败 (${res.status}): ${errText.slice(0, 200)}` }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { visionAvailable: false, error: '请求超时' }
    }
    return { visionAvailable: false, error: `测试失败: ${err.message}` }
  }
}

async function testDashscopeNativeVision(config, testImage) {
  const { baseUrl, apiKey, model } = config

  try {
    const res = await fetchWithTimeout(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: {
          messages: [{
            role: 'user',
            content: [
              { text: '请用一句话描述这张图片的内容' },
              { image: testImage },
            ],
          }],
        },
        parameters: { max_tokens: 20 },
      }),
    }, 15000)

    if (res.ok) {
      const data = await res.json()
      const text = data.output?.text?.trim()
        || data.output?.choices?.[0]?.message?.content?.[0]?.text?.trim()
        || ''
      if (/没有|未|无法|不能|no image|cannot|didn't receive|未提供|看不到/i.test(text)) {
        return { visionAvailable: false, error: `模型 "${model}" 未能接收到图片。请确认该模型支持多模态视觉输入。` }
      }
      return { visionAvailable: true, error: null }
    }

    const errText = await res.text().catch(() => '')
    return { visionAvailable: false, error: `测试失败 (${res.status}): ${errText.slice(0, 200)}` }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { visionAvailable: false, error: '请求超时' }
    }
    return { visionAvailable: false, error: `测试失败: ${err.message}` }
  }
}

// ─── Image → LaTeX Recognition ────────────────────────────

/**
 * Send image to vision LLM for LaTeX recognition.
 *
 * Two-step approach:
 *   Step 1: Ask the model to describe the image content in plain text
 *   Step 2: Convert the description to structured LaTeX
 */
export async function recognizeImage(file, config, onProgress) {
  const { baseUrl, apiKey, model } = config
  if (!baseUrl || !model) throw new Error('请先配置并测试视觉识别 API')

  onProgress?.('正在读取图片...')

  // Convert file to base64 data URL
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const nativeDashscope = isDashscopeNative(baseUrl)

  // ── Step 1: Recognize raw content from image ──
  onProgress?.('Step 1/2: 识别图片内容...')

  const step1Prompt = `请仔细查看这张图片，准确描述图片中包含的所有文字和数学内容。

要求：
1. 完整描述图片中你看到的每一个字、每一个符号、每一个公式
2. 不要遗漏任何内容，包括题号、选项、图形标注等
3. 如果包含数学公式，用文字描述公式结构（如"x的平方减去5x加6等于0"）
4. 如果图片中有题目和答案，分别说明
5. 只描述你实际看到的内容，不要猜测或补充`

  let rawText = ''

  if (nativeDashscope) {
    rawText = await dashscopeNativeChat(baseUrl, apiKey, model, step1Prompt, dataUrl, 2000, true)
  } else {
    // OpenAI compatible (including Dashscope compatible-mode)
    rawText = await openaiCompatibleChat(baseUrl, apiKey, model, step1Prompt, dataUrl, 2000, true)
  }

  if (!rawText || rawText.length < 5) {
    throw new Error('模型未能识别出图片内容。请确保：1) 图片清晰且包含数学题目 2) 模型支持多模态视觉输入')
  }

  // Check if the model said it can't see the image
  if (/没有.*图片|未.*图片|无法.*看到|不能.*查看|no image|didn't receive|not receive|看不到/i.test(rawText)) {
    throw new Error('模型表示无法看到图片。请确认：1) 模型支持多模态视觉输入（如 qwen3.6-plus、qwen-vl-max 等）2) API 配置正确')
  }

  // ── Step 2: Convert to structured LaTeX ──
  onProgress?.('Step 2/2: 转换为 LaTeX 格式...')

  const step2Prompt = `以下是图片中识别出的数学题目内容：

"""
${rawText}
"""

请将上述内容转换为结构化的 LaTeX 格式，返回 JSON：

{
  "content": "题目的 LaTeX 格式（必填，行间公式用 $$...$$，行内公式用 $...$）",
  "answer": "仅最终答案或算式，不要解题步骤。如果图片中有答案则直接使用；如果没有请自行计算。必填。",
  "grade": "年级（如「七年级」「高一」，不确定则空字符串）",
  "topic": "知识板块，必须从以下选项中选择一个：数与代数、图形与几何、统计与概率、综合与实践、集合与逻辑、函数、三角函数、数列、不等式、平面向量、立体几何、解析几何、导数与微积分、排列组合、概率、统计、复数、算法初步。不确定则空字符串。",
  "tags": ["标签1", "标签2", "标签3"]
}

规则：
1. 准确将数学公式转换为 LaTeX，保持上下标、根号、分式等
2. 中文文字保留原样
3. answer 字段只填写最终答案或算式，不包含解题步骤
4. topic 必须严格从上述列表中选择，不要自行发挥
5. 只返回 JSON，不要任何解释`

  let text = ''

  if (nativeDashscope) {
    text = await dashscopeNativeChat(baseUrl, apiKey, model, step2Prompt, null, 2000, false)
  } else {
    text = await openaiCompatibleChat(baseUrl, apiKey, model, step2Prompt, null, 2000, false)
  }

  // Try to parse as structured JSON
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        content: parsed.content || '',
        answer: parsed.answer || '',
        grade: parsed.grade || '',
        topic: parsed.topic || '',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      }
    }
  } catch {
    // Not valid JSON
  }

  // Fallback: return raw text as content
  return { content: rawText, answer: '', grade: '', topic: '', tags: [] }
}

/**
 * Batch recognition: extract multiple questions from one or more exam paper images.
 * Returns an array of question objects in order.
 */
export async function recognizeBatchImage(files, config, onProgress) {
  const { baseUrl, apiKey, model } = config
  if (!baseUrl || !model) throw new Error('请先配置并测试视觉识别 API')

  onProgress?.(`正在读取 ${files.length} 张图片...`)

  // Convert all files to data URLs
  const dataUrls = await Promise.all(
    Array.from(files).map(file => new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    }))
  )

  onProgress?.('AI 正在识别所有题目...')

  // Build content array: text prompt + all images
  const contentParts = [
    {
      type: 'text',
      text: `这是一份数学试卷的图片（共 ${dataUrls.length} 张）。请识别图片中所有的题目，按题号顺序列出。

对每一题，提取以下信息并返回 JSON 数组：
[
  {
    "content": "题目的 LaTeX 格式（行间公式用 $$...$$，行内公式用 $...$）",
    "answer": "仅最终答案或算式，没有则空字符串",
    "grade": "年级，不确定则空字符串",
    "topic": "知识板块，必须从以下选项中选择：数与代数、图形与几何、统计与概率、综合与实践、集合与逻辑、函数、三角函数、数列、不等式、平面向量、立体几何、解析几何、导数与微积分、排列组合、概率、统计、复数、算法初步。不确定则空字符串。",
    "tags": ["标签1", "标签2"]
  }
]

规则：
1. 按题目在试卷中出现的顺序排列
2. 每道题的 content 包含完整的题目文字和公式，中文保留原样
3. 如果图片中有图形无法用文字描述，在 content 中标注"（如图）"
4. answer 只包含最终结果，不含解题步骤
5. 只返回 JSON 数组，不要任何解释`
    }
  ]

  for (const url of dataUrls) {
    contentParts.push({ type: 'image_url', image_url: { url } })
  }

  // Determine endpoint URL
  let url
  if (isDashscopeNative(baseUrl)) {
    url = baseUrl
  } else if (isDashscope(baseUrl)) {
    url = buildUrl(baseUrl, '/chat/completions')
  } else {
    url = buildUrl(baseUrl, '/v1/chat/completions')
  }

  let text = ''

  if (isDashscopeNative(baseUrl)) {
    const nativeContent = [
      { text: contentParts[0].text },
      ...dataUrls.map(url => ({ image: url })),
    ]
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: { messages: [{ role: 'user', content: nativeContent }] },
        parameters: { max_tokens: 16000 },
      }),
    }, 180000)

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`API 请求失败 (${res.status}): ${errText.slice(0, 300)}`)
    }
    const data = await res.json()
    text = data.output?.text?.trim()
      || data.output?.choices?.[0]?.message?.content?.[0]?.text?.trim()
      || ''
  } else {
    // OpenAI compatible
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: contentParts }],
        max_tokens: 16000,
      }),
    }, 180000)

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`API 请求失败 (${res.status}): ${errText.slice(0, 300)}`)
    }
    const data = await res.json()
    text = data.choices?.[0]?.message?.content?.trim() || ''
  }

  if (!text) {
    throw new Error('API 返回内容为空，请检查 API 配置和模型是否支持多模态识别')
  }

  // Parse the JSON array
  try {
    // Try extracting JSON from markdown code block first, then raw JSON
    let jsonStr = null
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim()
    } else {
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) jsonStr = jsonMatch[0]
    }

    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(q => ({
            content: q.content || '',
            answer: q.answer || '',
            grade: q.grade || '',
            topic: q.topic || '',
            tags: Array.isArray(q.tags) ? q.tags : [],
          }))
        }
      } catch {
        // JSON truncated — try fixing by appending closing brackets
        let fixed = jsonStr
        // Remove trailing comma before attempting to close
        fixed = fixed.replace(/,\s*$/, '')
        // Try adding ] at the end
        for (const suffix of [']', '"}]', '"}]']) {
          try {
            const parsed = JSON.parse(fixed + suffix)
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.warn('[recognizeBatchImage] JSON was truncated, recovered', parsed.length, 'questions')
              return parsed.map(q => ({
                content: q.content || '',
                answer: q.answer || '',
                grade: q.grade || '',
                topic: q.topic || '',
                tags: Array.isArray(q.tags) ? q.tags : [],
              }))
            }
          } catch {
            // keep trying
          }
        }
      }
    }
  } catch (err) {
    console.warn('[recognizeBatchImage] JSON parse failed:', err.message)
  }

  // Fallback: return raw text as single question
  console.warn('[recognizeBatchImage] Falling back to raw text, length:', text.length)
  return [{ content: text, answer: '', grade: '', topic: '', tags: [] }]
}

/**
 * OpenAI-compatible chat request (works for OpenAI, DeepSeek, Dashscope compatible-mode, etc.)
 * Image format: { type: "image_url", image_url: { url: "data:image/..." } }
 */
async function openaiCompatibleChat(baseUrl, apiKey, model, prompt, imageDataUrl, maxTokens, isMultimodal) {
  // Determine the chat endpoint
  let url
  if (isDashscope(baseUrl)) {
    // Dashscope compatible-mode: base URL already ends with /compatible-mode/v1
    url = buildUrl(baseUrl, '/chat/completions')
  } else {
    url = buildUrl(baseUrl, '/v1/chat/completions')
  }

  const content = isMultimodal
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ]
    : prompt

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      max_tokens: maxTokens,
    }),
  }, 120000)

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`API 请求失败 (${res.status}): ${errText.slice(0, 300)}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

/**
 * DashScope native chat request.
 * API format: { model, input: { messages: [...] }, parameters: {...} }
 * Image format: { image: "data:image/..." } inside content array
 * Response: { output: { text: "..." } } or { output: { choices: [{ message: { content: [{text: "..."}] } }] } }
 */
async function dashscopeNativeChat(baseUrl, apiKey, model, prompt, imageDataUrl, maxTokens, isMultimodal) {
  const messages = [{
    role: 'user',
    content: isMultimodal
      ? [
          { text: prompt },
          { image: imageDataUrl },
        ]
      : prompt,
  }]

  const res = await fetchWithTimeout(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: { messages },
      parameters: { max_tokens: maxTokens },
    }),
  }, 120000)

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`API 请求失败 (${res.status}): ${errText.slice(0, 300)}`)
  }

  const data = await res.json()

  // DashScope native response formats:
  // { output: { text: "..." } }
  // { output: { choices: [{ message: { content: [{text: "..."}] } }] } }
  if (data.output?.text) return data.output.text.trim()
  if (data.output?.choices?.[0]?.message?.content) {
    const c = data.output.choices[0].message.content
    if (typeof c === 'string') return c.trim()
    if (Array.isArray(c) && c[0]?.text) return c[0].text.trim()
  }

  throw new Error(`无法解析 API 响应: ${JSON.stringify(data).slice(0, 300)}`)
}

// ─── Solution Generation ───────────────────────────────────

function getGradeHint(grade) {
  if (!grade) return ''
  if (/一|二|三|四|五|六年级/.test(grade)) {
    return `适用年级：${grade}（小学），使用算术方法，避免方程。`
  }
  if (/七|八|九年级/.test(grade)) {
    return `适用年级：${grade}（初中），可使用方程、不等式、平面几何定理等。`
  }
  if (/高一|高二|高三/.test(grade)) {
    return `适用年级：${grade}（高中），可使用函数、三角函数、向量、导数、数列等。`
  }
  return `适用年级：${grade}。`
}

/**
 * Generate solution for a given math problem.
 */
export async function generateSolution(content, answer, config, fastMode = false, grade = '') {
  const { baseUrl, apiKey, model } = config
  if (!baseUrl || !model) throw new Error('请先配置并测试文本生成 API')

  const gradeHint = getGradeHint(grade)

  const fastPrompt = `请解答以下数学题，给出详细的解题步骤。用 LaTeX 格式输出，行间公式用 $$...$$，行内公式用 $...$。
${gradeHint}

题目：${content}
${answer ? `答案：${answer}` : ''}`

  const normalPrompt = `请详细解答以下数学题，要求：
1. 给出完整的解题思路和步骤，每一步要有清晰的说明
2. 如果有多种解题方法，必须全部列出（如代数法、几何法、数形结合法等）
3. 最终答案要明确标注
4. 使用 LaTeX 格式输出，行间公式用 $$...$$，行内公式用 $...$
${gradeHint}

题目：${content}
${answer ? `参考答案：${answer}` : ''}`

  const prompt = fastMode ? fastPrompt : normalPrompt

  if (isDashscopeNative(baseUrl)) {
    return dashscopeNativeChat(baseUrl, apiKey, model, prompt, null, fastMode ? 1000 : 3000, false)
  }

  return openaiCompatibleChat(baseUrl, apiKey, model, prompt, null, fastMode ? 1000 : 3000, false)
}

// ─── Auto Tagging ──────────────────────────────────────────

/**
 * Auto-generate tags for a math problem.
 */
export async function autoTag(content, config) {
  const { baseUrl, apiKey, model } = config
  if (!baseUrl || !model) throw new Error('请先配置并测试文本生成 API')

  const prompt = `请为以下数学题生成标签。要求：
1. 生成 2-5 个标签
2. 标签要精确描述题目涉及的知识点、题型、方法等
3. 只返回标签列表，用英文逗号分隔，不要其他内容
4. 标签使用中文

题目：${content}`

  let text = ''

  if (isDashscopeNative(baseUrl)) {
    text = await dashscopeNativeChat(baseUrl, apiKey, model, prompt, null, 200, false)
  } else {
    text = await openaiCompatibleChat(baseUrl, apiKey, model, prompt, null, 200, false)
  }

  return text.split(/[,，、]/).map(t => t.trim()).filter(Boolean)
}
