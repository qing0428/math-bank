/**
 * Feishu API Client
 *
 * 封装飞书开放平台 API，提供消息发送、图片上传等功能。
 *
 * 飞书开放平台文档：https://open.feishu.cn/document
 */

const https = require('https')
const http = require('http')

// Config from environment
const APP_ID = process.env.FEISHU_APP_ID || ''
const APP_SECRET = process.env.FEISHU_APP_SECRET || ''
const BASE_URL = process.env.FEISHU_API_BASE || 'https://open.feishu.cn'

let tenantAccessToken = ''
let tokenExpiresAt = 0

/**
 * Make an HTTP(S) request.
 */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const mod = parsed.protocol === 'https:' ? https : http

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...options.headers,
      },
    }

    const req = mod.request(reqOptions, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          resolve({ raw: data })
        }
      })
    })

    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(new Error('Request timeout')) })

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
    }
    req.end()
  })
}

/**
 * Get tenant access token.
 * https://open.feishu.cn/document/server-docs/authentication-management/access-token/tenant_access_token_internal
 */
async function getTenantAccessToken() {
  if (tenantAccessToken && Date.now() < tokenExpiresAt) {
    return tenantAccessToken
  }

  if (!APP_ID || !APP_SECRET) {
    throw new Error('飞书 APP_ID 和 APP_SECRET 未配置')
  }

  const res = await request(`${BASE_URL}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    body: { app_id: APP_ID, app_secret: APP_SECRET },
  })

  if (res.code !== 0) {
    throw new Error(`获取 tenant_access_token 失败: ${res.msg}`)
  }

  tenantAccessToken = res.tenant_access_token
  tokenExpiresAt = Date.now() + (res.expire - 300) * 1000 // 提前5分钟刷新
  return tenantAccessToken
}

/**
 * Send a text message to a user or chat.
 * @param {string} receiveId - open_id or chat_id
 * @param {string} receiveIdType - 'open_id' | 'chat_id' | 'user_id'
 * @param {string} text - Message text
 */
async function sendTextMessage(receiveId, receiveIdType, text) {
  const token = await getTenantAccessToken()

  return request(`${BASE_URL}/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: {
      receive_id: receiveId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    },
  })
}

/**
 * Send a rich text (post) message.
 * @param {string} receiveId
 * @param {string} receiveIdType
 * @param {Object} content - Post content object
 */
async function sendPostMessage(receiveId, receiveIdType, content) {
  const token = await getTenantAccessToken()

  return request(`${BASE_URL}/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: {
      receive_id: receiveId,
      msg_type: 'post',
      content: JSON.stringify(content),
    },
  })
}

/**
 * Send an interactive card message.
 * @param {string} receiveId
 * @param {string} receiveIdType
 * @param {Object} card - Card JSON
 */
async function sendCardMessage(receiveId, receiveIdType, card) {
  const token = await getTenantAccessToken()

  return request(`${BASE_URL}/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: {
      receive_id: receiveId,
      msg_type: 'interactive',
      content: JSON.stringify(card),
    },
  })
}

/**
 * Reply to a message.
 * @param {string} messageId - Message ID to reply to
 * @param {string} msgType - 'text' | 'post' | 'interactive'
 * @param {string} content - JSON string content
 */
async function replyMessage(messageId, msgType, content) {
  const token = await getTenantAccessToken()

  return request(`${BASE_URL}/open-apis/im/v1/messages/${messageId}/reply`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: {
      msg_type: msgType,
      content,
    },
  })
}

/**
 * Upload an image to Feishu.
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} imageType - 'message' | 'avatar'
 * @returns {Promise<string>} Image key
 */
async function uploadImage(imageBuffer, imageType = 'message') {
  const token = await getTenantAccessToken()

  // Use multipart form data
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
  const parts = []

  // image_type field
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="image_type"\r\n\r\n${imageType}`)

  // image field
  parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="image.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`)

  const header = Buffer.from(parts.join('\r\n') + '\r\n')
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
  const body = Buffer.concat([header, imageBuffer, footer])

  return new Promise((resolve, reject) => {
    const parsed = new URL(`${BASE_URL}/open-apis/im/v1/images`)
    const mod = parsed.protocol === 'https:' ? https : http

    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.code === 0) {
            resolve(result.data.image_key)
          } else {
            reject(new Error(`Upload failed: ${result.msg}`))
          }
        } catch {
          reject(new Error('Invalid response'))
        }
      })
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

/**
 * Download an image from Feishu by message_id and image_key.
 * @param {string} messageId
 * @param {string} imageKey
 * @returns {Promise<Buffer>} Image buffer
 */
async function downloadImage(messageId, imageKey) {
  const token = await getTenantAccessToken()

  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}/open-apis/im/v1/messages/${messageId}/resources/${imageKey}?type=image`
    const parsed = new URL(url)
    const mod = parsed.protocol === 'https:' ? https : http

    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    }, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })

    req.on('error', reject)
    req.end()
  })
}

module.exports = {
  sendTextMessage,
  sendPostMessage,
  sendCardMessage,
  replyMessage,
  uploadImage,
  downloadImage,
  getTenantAccessToken,
}
