/**
 * Feishu Webhook Route
 *
 * 接收飞书事件订阅回调，处理消息事件。
 *
 * 飞书事件订阅文档：https://open.feishu.cn/document/server-docs/event-subscription-guide
 *
 * 配置步骤：
 * 1. 在飞书开放平台创建应用
 * 2. 开启「机器人」能力
 * 3. 配置事件订阅 URL: https://your-domain.com/feishu/webhook
 * 4. 订阅事件：im.message.receive_v1
 * 5. 配置权限：im:message、im:message.receive_v1
 */

const express = require('express')
const crypto = require('crypto')
const { handleTextMessage, handleImageMessage } = require('../feishu/handlers')

const router = express.Router()

// Event deduplication — store recent event IDs
const processedEvents = new Set()
const EVENT_CACHE_MAX = 1000

function deduplicateEvent(eventId) {
  if (!eventId) return false
  if (processedEvents.has(eventId)) return true
  processedEvents.add(eventId)
  // Evict old entries
  if (processedEvents.size > EVENT_CACHE_MAX) {
    const first = processedEvents.values().next().value
    processedEvents.delete(first)
  }
  return false
}

/**
 * POST /feishu/webhook
 *
 * 飞书事件回调入口。
 * 处理两种请求：
 * 1. URL Verification（首次配置验证）
 * 2. Event Callback（事件推送）
 */
router.post('/feishu/webhook', async (req, res) => {
  const body = req.body

  // 1. URL Verification — 飞书首次配置时的验证请求
  if (body.type === 'url_verification') {
    return res.json({ challenge: body.challenge })
  }

  // 2. Event Callback
  if (body.schema === '2.0' && body.header) {
    const { event_id, event_type, token } = body.header

    // Verify token (optional but recommended)
    const verifyToken = process.env.FEISHU_VERIFY_TOKEN
    if (verifyToken && token !== verifyToken) {
      console.warn('Feishu webhook: token mismatch')
      return res.status(403).json({ error: 'Token mismatch' })
    }

    // Deduplicate
    if (deduplicateEvent(event_id)) {
      return res.json({ code: 0 }) // Already processed
    }

    // Handle event
    if (event_type === 'im.message.receive_v1') {
      const event = body.event

      // Respond immediately (飞书要求 3 秒内响应)
      res.json({ code: 0 })

      // Process asynchronously
      processMessageEvent(event).catch(err => {
        console.error('Feishu message processing error:', err.message)
      })
      return
    }
  }

  // Legacy event format (v1.0)
  if (body.event) {
    const { type } = body.event
    if (type === 'message') {
      res.json({ code: 0 })
      processMessageEvent(body.event).catch(err => {
        console.error('Feishu message processing error:', err.message)
      })
      return
    }
  }

  res.json({ code: 0 })
})

/**
 * Process a message event.
 */
async function processMessageEvent(event) {
  const message = event.message || event
  const msgType = message.message_type || message.msg_type

  switch (msgType) {
    case 'text':
      await handleTextMessage(event)
      break
    case 'image':
      await handleImageMessage(event)
      break
    default:
      // Unsupported message type — ignore silently
      console.log(`Unsupported Feishu message type: ${msgType}`)
  }
}

/**
 * GET /feishu/status
 * Health check endpoint for the Feishu bot.
 */
router.get('/feishu/status', (req, res) => {
  const configured = !!(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET)
  res.json({
    status: configured ? 'ready' : 'not_configured',
    appId: process.env.FEISHU_APP_ID ? '***configured***' : 'not_set',
    visionApi: process.env.VISION_API_BASE ? 'configured' : 'not_set',
  })
})

module.exports = router
