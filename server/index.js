const express = require('express')
const path = require('path')
const cors = require('cors')
const questionsRouter = require('./routes/questions')

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))

// API routes
app.use('/api', questionsRouter)

// Serve frontend static files
const distPath = path.join(__dirname, 'dist')
app.use(express.static(distPath))

// SPA fallback — any non-API route returns index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MathBank server running on port ${PORT}`)
})
