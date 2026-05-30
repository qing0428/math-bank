const express = require('express')
const cors = require('cors')
const questionsRouter = require('./routes/questions')

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))

app.use('/api', questionsRouter)

const PORT = process.env.PORT || 3001
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MathBank API server running on port ${PORT}`)
})
