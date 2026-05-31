const express = require('express')
const { stmts, upsertMany, fromDb } = require('../db')

const router = express.Router()

// GET /api/questions — list all
router.get('/questions', (req, res) => {
  const rows = stmts.getAll.all()
  res.json({ questions: rows.map(fromDb) })
})

// GET /api/questions/stats — statistics
router.get('/questions/stats', (req, res) => {
  const s = stmts.stats.get()
  const topTags = stmts.tagFreq.all().map(r => ({ tag: r.tag, count: r.count }))
  res.json({
    total: s.total,
    todayNew: s.todayNew || 0,
    todayModified: s.todayModified || 0,
    avgDifficulty: s.avgDifficulty ? Number(s.avgDifficulty).toFixed(1) : '0.0',
    topTags,
  })
})

// GET /api/questions/:id — single question
router.get('/questions/:id', (req, res) => {
  const row = stmts.getById.get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Question not found' })
  res.json({ question: fromDb(row) })
})

// POST /api/questions — create
router.post('/questions', (req, res) => {
  const q = req.body.question
  if (!q || !q.id) return res.status(400).json({ error: 'Missing question or id' })
  stmts.upsert.run({
    id: q.id, content: q.content || '', answer: q.answer || '',
    solution: q.solution || '', grade: q.grade || '', topic: q.topic || '',
    question_type: q.questionType || '', difficulty: q.difficulty ?? 3,
    tags: JSON.stringify(q.tags || []), notes: q.notes || '',
    exam_name: q.examName || '', image_url: q.imageUrl || '',
    image_position: q.imagePosition || 'right',
    created_at: q.createdAt || Date.now(), updated_at: q.updatedAt || Date.now(),
  })
  res.json({ question: q })
})

// PUT /api/questions/:id — update
router.put('/questions/:id', (req, res) => {
  const q = req.body.question
  if (!q) return res.status(400).json({ error: 'Missing question' })
  const now = Date.now()
  stmts.upsert.run({
    id: req.params.id, content: q.content || '', answer: q.answer || '',
    solution: q.solution || '', grade: q.grade || '', topic: q.topic || '',
    question_type: q.questionType || '', difficulty: q.difficulty ?? 3,
    tags: JSON.stringify(q.tags || []), notes: q.notes || '',
    exam_name: q.examName || '', image_url: q.imageUrl || '',
    image_position: q.imagePosition || 'right',
    created_at: q.createdAt || now, updated_at: now,
  })
  res.json({ question: { ...q, id: req.params.id, updatedAt: now } })
})

// DELETE /api/questions/:id — delete
router.delete('/questions/:id', (req, res) => {
  stmts.delete.run(req.params.id)
  res.json({ success: true })
})

// POST /api/questions/batch — bulk upsert (for import)
router.post('/questions/batch', (req, res) => {
  const questions = req.body.questions
  if (!Array.isArray(questions)) return res.status(400).json({ error: 'Expected questions array' })
  const count = upsertMany(questions)
  res.json({ inserted: count })
})

// POST /api/migrate — one-time migration from localStorage
router.post('/migrate', (req, res) => {
  const questions = req.body.questions
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.json({ migrated: 0 })
  }
  const { count } = stmts.count.get()
  if (count > 0) {
    return res.json({ migrated: 0, message: `Server already has ${count} questions.` })
  }
  const inserted = upsertMany(questions)
  res.json({ migrated: inserted })
})

module.exports = router
