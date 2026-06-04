const express = require('express')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const router = express.Router()

// Image storage directory — uses DB_PATH's parent dir, or /data in Docker
const IMAGES_DIR = process.env.IMAGES_DIR || path.join(
  process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : path.join(__dirname, '..', 'data'),
  'images'
)

// Ensure directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true })
}

/**
 * POST /api/images/upload
 * Accepts a base64 data URL or raw base64 string, saves to disk, returns the path.
 * Body: { dataUrl: "data:image/jpeg;base64,..." } or { base64: "...", mimeType: "image/jpeg" }
 * Returns: { url: "/api/images/<filename>" }
 */
router.post('/images/upload', (req, res) => {
  const { dataUrl, base64: rawBase64, mimeType: rawMime } = req.body

  let buffer, ext

  if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
    // Parse data URL: data:image/jpeg;base64,/9j/4AAQ...
    const match = dataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/)
    if (!match) {
      return res.status(400).json({ error: 'Invalid data URL format' })
    }
    const mime = match[1] // e.g. "image/jpeg"
    const b64 = match[2]
    ext = mime.split('/')[1] || 'png'
    if (ext === 'jpeg') ext = 'jpg'
    buffer = Buffer.from(b64, 'base64')
  } else if (rawBase64) {
    ext = (rawMime || 'image/png').split('/')[1] || 'png'
    if (ext === 'jpeg') ext = 'jpg'
    buffer = Buffer.from(rawBase64, 'base64')
  } else {
    return res.status(400).json({ error: 'Missing dataUrl or base64 field' })
  }

  // Generate unique filename
  const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 12)
  const timestamp = Date.now().toString(36)
  const filename = `${timestamp}_${hash}.${ext}`
  const filepath = path.join(IMAGES_DIR, filename)

  // Write file
  fs.writeFileSync(filepath, buffer)

  const url = `/api/images/${filename}`
  res.json({ url, filename })
})

/**
 * GET /api/images/:filename
 * Serves a stored image file.
 */
router.get('/images/:filename', (req, res) => {
  const filename = req.params.filename

  // Security: prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' })
  }

  const filepath = path.join(IMAGES_DIR, filename)

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Image not found' })
  }

  // Set cache headers (1 year — filenames are content-addressed)
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.sendFile(filepath)
})

/**
 * POST /api/images/migrate
 * Batch migrate base64 image_url values from the database to files.
 * Reads all questions with base64 image_url, saves images to disk, updates DB.
 */
const { db, stmts } = require('../db')

router.post('/images/migrate', (req, res) => {
  const rows = db.prepare("SELECT id, image_url FROM questions WHERE image_url LIKE 'data:image%'").all()

  if (rows.length === 0) {
    return res.json({ migrated: 0, message: 'No base64 images to migrate.' })
  }

  let migrated = 0
  let failed = 0

  const updateStmt = db.prepare('UPDATE questions SET image_url = ? WHERE id = ?')

  const migrateAll = db.transaction(() => {
    for (const row of rows) {
      try {
        const match = row.image_url.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/)
        if (!match) { failed++; continue }

        const mime = match[1]
        const b64 = match[2]
        let ext = mime.split('/')[1] || 'png'
        if (ext === 'jpeg') ext = 'jpg'

        const buffer = Buffer.from(b64, 'base64')
        const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 12)
        const timestamp = Date.now().toString(36)
        const filename = `${timestamp}_${hash}_${migrated}.${ext}`
        const filepath = path.join(IMAGES_DIR, filename)

        fs.writeFileSync(filepath, buffer)
        updateStmt.run(`/api/images/${filename}`, row.id)
        migrated++
      } catch (err) {
        console.error(`Failed to migrate image for ${row.id}:`, err.message)
        failed++
      }
    }
  })

  migrateAll()

  res.json({ migrated, failed, total: rows.length })
})

module.exports = router
