/**
 * Feishu Message Handlers
 *
 * 处理飞书消息事件，路由到对应功能：
 * - 图片消息 → 识别题目，入库
 * - 文本消息 → 解析意图（查询/组卷/修改）
 *
 * 飞书事件文档：https://open.feishu.cn/document/server-docs/event-subscription-guide
 */

const { replyMessage, downloadImage } = require('./api')
const { stmts, upsertMany, toDb, fromDb } = require('../db')

// ─── Intent Parsing ────────────────────────────────────────

/**
 * Parse user text message to determine intent.
 * Returns { intent, params }
 */
function parseIntent(text) {
  const trimmed = (text || '').trim()

  // 组卷意图
  const composeMatch = trimmed.match(/(?:帮我|请)?(?:出|组)(?:一份|一套|个)?(.+?)(?:试卷|测试|练习|卷子)(?:，|,|\s)*(\d+)?\s*道题?/)
  if (composeMatch) {
    return {
      intent: 'compose',
      params: {
        description: composeMatch[1]?.trim(),
        count: parseInt(composeMatch[2]) || 10,
      },
    }
  }

  // 查询意图
  const searchMatch = trimmed.match(/(?:查|找|搜索|检索)(?:一下)?(.+)/)
  if (searchMatch) {
    return {
      intent: 'search',
      params: { query: searchMatch[1]?.trim() },
    }
  }

  // 修改难度意图
  const diffMatch = trimmed.match(/难度(?:改为|调为|调成|设为|变成)([一二三四五1-5易中难]+)/)
  if (diffMatch) {
    const d = diffMatch[1]
    let difficulty = 3
    if (d === '一' || d === '1' || d === '易') difficulty = 1
    else if (d === '二' || d === '2') difficulty = 2
    else if (d === '三' || d === '3' || d === '中') difficulty = 3
    else if (d === '四' || d === '4') difficulty = 4
    else if (d === '五' || d === '5' || d === '难') difficulty = 5
    return { intent: 'update_difficulty', params: { difficulty } }
  }

  // 帮助
  if (/帮助|help|怎么用|功能/.test(trimmed)) {
    return { intent: 'help' }
  }

  return { intent: 'unknown', params: { text: trimmed } }
}

// ─── Message Handlers ──────────────────────────────────────

/**
 * Handle incoming text message.
 */
async function handleTextMessage(event) {
  const { message, sender } = event
  const text = message.content ? JSON.parse(message.content).text : ''
  const chatId = message.chat_id
  const openId = sender?.sender_id?.open_id
  const receiveId = chatId || openId
  const receiveIdType = chatId ? 'chat_id' : 'open_id'
  const messageId = message.message_id

  const { intent, params } = parseIntent(text)

  switch (intent) {
    case 'help':
      await replyMessage(messageId, 'text', JSON.stringify({
        text: `📐 数学题库助手 — 使用指南

📸 发送试卷图片 → AI 自动识别题目并入库
🔍 输入"查一下鸡兔同笼" → 搜索相关题目
📝 输入"帮我出一份五年级下册试卷，10道题" → AI 自动组卷
⭐ 输入"难度改为难" → 修改最后识别的题目难度

支持的功能：
• 图片识别（含数学公式 LaTeX 转换）
• 批量识别（一次发送多张图片）
• 按年级/知识点/难度筛选
• AI 自动组卷
• 标准化标签管理`,
      }))
      break

    case 'search':
      await handleSearch(receiveId, receiveIdType, params.query)
      break

    case 'compose':
      await handleCompose(receiveId, receiveIdType, params)
      break

    case 'update_difficulty':
      await replyMessage(messageId, 'text', JSON.stringify({
        text: `✅ 已记录难度调整需求（难度改为${params.difficulty}星）。请先发送要修改的题目图片，或在 Web 端进行修改。`,
      }))
      break

    default:
      await replyMessage(messageId, 'text', JSON.stringify({
        text: `🤔 没太理解你的意思。试试：
• 发送图片识别题目
• "查一下分数加减法"
• "帮我出一份六年级试卷"
• 输入"帮助"查看完整功能`,
      }))
  }
}

/**
 * Handle incoming image message.
 */
async function handleImageMessage(event) {
  const { message, sender } = event
  const chatId = message.chat_id
  const openId = sender?.sender_id?.open_id
  const receiveId = chatId || openId
  const receiveIdType = chatId ? 'chat_id' : 'open_id'
  const messageId = message.message_id

  // Parse image content
  let imageKey = ''
  try {
    const content = JSON.parse(message.content)
    imageKey = content.image_key
  } catch {
    await replyMessage(messageId, 'text', JSON.stringify({ text: '❌ 无法解析图片消息' }))
    return
  }

  if (!imageKey) {
    await replyMessage(messageId, 'text', JSON.stringify({ text: '❌ 未找到图片' }))
    return
  }

  // Send processing message
  await replyMessage(messageId, 'text', JSON.stringify({ text: '⏳ 正在识别图片中的题目，请稍候...' }))

  try {
    // Download image from Feishu
    const imageBuffer = await downloadImage(messageId, imageKey)
    const base64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`

    // Use vision LLM to recognize (from server-side)
    const visionConfig = getVisionConfig()
    if (!visionConfig) {
      await replyMessage(messageId, 'text', JSON.stringify({
        text: '⚠️ 视觉识别 API 未配置。请在 Web 端「API 设置」中配置视觉识别 API。',
      }))
      return
    }

    // Call recognition (simplified — in production, use the actual llmService)
    const result = await recognizeFromBase64(base64, visionConfig)

    if (result && result.content) {
      // Save to database
      const question = {
        id: generateId(),
        content: result.content || '',
        answer: result.answer || '',
        solution: '',
        grade: result.grade || '',
        semester: result.semester || '',
        unit: result.unit || '',
        topic: result.topic || '',
        questionType: result.questionType || '',
        difficulty: result.difficulty || 3,
        tags: JSON.stringify(result.tags || []),
        notes: '',
        exam_name: '',
        image_url: '',
        image_position: 'right',
        has_handwriting: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      }

      stmts.upsert.run(question)

      // Build reply
      const lines = [`✅ 识别成功！已自动入库。`]
      if (result.grade) lines.push(`📚 年级：${result.grade}`)
      if (result.topic) lines.push(`📂 板块：${result.topic}`)
      if (result.questionType) lines.push(`📝 题型：${result.questionType}`)
      if (result.difficulty) lines.push(`⭐ 难度：${'★'.repeat(result.difficulty)}${'☆'.repeat(5 - result.difficulty)}`)
      if (result.tags?.length) lines.push(`🏷️ 标签：${result.tags.join('、')}`)
      lines.push('')
      lines.push(`📄 题目预览：${result.content.slice(0, 100)}${result.content.length > 100 ? '...' : ''}`)
      if (result.answer) lines.push(`✏️ 答案：${result.answer.slice(0, 50)}`)

      await replyMessage(messageId, 'text', JSON.stringify({ text: lines.join('\n') }))
    } else {
      await replyMessage(messageId, 'text', JSON.stringify({
        text: '❌ 未能识别出有效题目。请确保图片清晰且包含数学题目。',
      }))
    }
  } catch (err) {
    console.error('Image recognition error:', err.message)
    await replyMessage(messageId, 'text', JSON.stringify({
      text: `❌ 识别失败：${err.message}`,
    }))
  }
}

/**
 * Handle search query from Feishu.
 */
async function handleSearch(receiveId, receiveIdType, query) {
  const allQuestions = stmts.getAll.all().map(fromDb)

  // Simple keyword search
  const results = allQuestions.filter(q => {
    const s = query.toLowerCase()
    return (q.content || '').toLowerCase().includes(s)
      || (q.answer || '').toLowerCase().includes(s)
      || (q.tags || []).some(t => t.includes(s))
      || (q.topic || '').includes(s)
  }).slice(0, 5)

  if (results.length === 0) {
    const { sendTextMessage } = require('./api')
    await sendTextMessage(receiveId, receiveIdType, `🔍 未找到与"${query}"相关的题目。试试其他关键词？`)
    return
  }

  // Build reply
  const lines = [`🔍 找到 ${results.length} 道相关题目：\n`]
  results.forEach((q, i) => {
    const tags = (q.tags || []).slice(0, 3).join('、')
    lines.push(`${i + 1}. [${q.grade || '未分级'}] ${q.content?.slice(0, 60)}${q.content?.length > 60 ? '...' : ''}`)
    if (q.answer) lines.push(`   答案：${q.answer.slice(0, 30)}`)
    if (tags) lines.push(`   🏷️ ${tags}`)
    lines.push('')
  })

  const { sendTextMessage } = require('./api')
  await sendTextMessage(receiveId, receiveIdType, lines.join('\n'))
}

/**
 * Handle composition request from Feishu.
 */
async function handleCompose(receiveId, receiveIdType, params) {
  const allQuestions = stmts.getAll.all().map(fromDb)

  // Parse grade from description
  const gradeMatch = (params.description || '').match(/(一年级|二年级|三年级|四年级|五年级|六年级|七年级|八年级|九年级|高一|高二|高三)/)
  const grade = gradeMatch ? gradeMatch[1] : ''

  // Filter by grade
  let candidates = grade
    ? allQuestions.filter(q => q.grade === grade)
    : allQuestions

  if (candidates.length === 0) {
    const { sendTextMessage } = require('./api')
    await sendTextMessage(receiveId, receiveIdType, `📝 题库中没有${grade || '符合条件'}的题目。请先通过 Web 端或图片识别录入题目。`)
    return
  }

  // Simple random selection
  const count = Math.min(params.count, candidates.length)
  const shuffled = candidates.sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, count)

  // Build reply
  const lines = [
    `📝 试卷组卷完成！共 ${selected.length} 道题${grade ? `（${grade}）` : ''}：\n`,
  ]

  // Group by question type
  const byType = {}
  selected.forEach(q => {
    const type = q.questionType || '其他'
    if (!byType[type]) byType[type] = []
    byType[type].push(q)
  })

  let num = 1
  for (const [type, questions] of Object.entries(byType)) {
    lines.push(`【${type}】`)
    questions.forEach(q => {
      lines.push(`${num}. ${q.content?.slice(0, 50)}${q.content?.length > 50 ? '...' : ''}`)
      num++
    })
    lines.push('')
  }

  lines.push('💡 请在 Web 端查看完整试卷并导出。')

  const { sendTextMessage } = require('./api')
  await sendTextMessage(receiveId, receiveIdType, lines.join('\n'))
}

// ─── Helpers ───────────────────────────────────────────────

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (require('crypto').randomBytes(1)[0] & 15) >> (c === 'x' ? 0 : 3)
    return r.toString(16)
  })
}

/**
 * Get vision LLM config from environment or database.
 * In production, store this in the database or config file.
 */
function getVisionConfig() {
  const baseUrl = process.env.VISION_API_BASE || ''
  const apiKey = process.env.VISION_API_KEY || ''
  const model = process.env.VISION_MODEL || ''

  if (!baseUrl || !model) return null
  return { baseUrl, apiKey, model }
}

/**
 * Simplified recognition from base64 image.
 * In production, integrate with the actual llmService.
 */
async function recognizeFromBase64(base64DataUrl, config) {
  // Use fetch to call the vision API directly
  const isNative = /dashscope/i.test(config.baseUrl) && /\/api\/v1\//i.test(config.baseUrl)

  if (isNative) {
    const res = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        input: {
          messages: [{
            role: 'user',
            content: [
              { text: '请识别这张数学试卷图片中的所有题目，返回 JSON 数组格式，每题包含 content、answer、grade、topic、questionType、difficulty、tags 字段。只返回 JSON。' },
              { image: base64DataUrl },
            ],
          }],
        },
        parameters: { max_tokens: 4000 },
      }),
    })

    const data = await res.json()
    const text = data.output?.text || data.output?.choices?.[0]?.message?.content?.[0]?.text || ''
    return parseRecognitionResult(text)
  }

  // OpenAI compatible
  const url = config.baseUrl.includes('dashscope')
    ? `${config.baseUrl}/chat/completions`
    : `${config.baseUrl}/v1/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '请识别这张数学试卷图片中的题目，返回 JSON 数组格式，每题包含 content、answer、grade、topic、questionType、difficulty、tags 字段。只返回 JSON。' },
          { type: 'image_url', image_url: { url: base64DataUrl } },
        ],
      }],
      max_tokens: 4000,
    }),
  })

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content || ''
  return parseRecognitionResult(text)
}

function parseRecognitionResult(text) {
  try {
    const firstBracket = text.indexOf('[')
    const lastBracket = text.lastIndexOf(']')
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const arr = JSON.parse(text.slice(firstBracket, lastBracket + 1))
      if (Array.isArray(arr) && arr.length > 0) return arr[0]
    }
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
  } catch { /* ignore */ }
  return null
}

module.exports = {
  handleTextMessage,
  handleImageMessage,
  parseIntent,
}
