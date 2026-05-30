const API_BASE = '/api'

export async function fetchQuestions() {
  const res = await fetch(`${API_BASE}/questions`)
  if (!res.ok) throw new Error(`Failed to load questions: ${res.status}`)
  const data = await res.json()
  return data.questions
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/questions/stats`)
  if (!res.ok) throw new Error(`Failed to load stats: ${res.status}`)
  return await res.json()
}

export async function createQuestionApi(question) {
  const res = await fetch(`${API_BASE}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  if (!res.ok) throw new Error(`Failed to create: ${res.status}`)
  return (await res.json()).question
}

export async function updateQuestionApi(question) {
  const res = await fetch(`${API_BASE}/questions/${question.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  if (!res.ok) throw new Error(`Failed to update: ${res.status}`)
  return (await res.json()).question
}

export async function deleteQuestionApi(id) {
  const res = await fetch(`${API_BASE}/questions/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete: ${res.status}`)
}

export async function batchUpsertQuestions(questions) {
  const res = await fetch(`${API_BASE}/questions/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  })
  if (!res.ok) throw new Error(`Failed batch upsert: ${res.status}`)
  return await res.json()
}

export async function migrateQuestions(questions) {
  const res = await fetch(`${API_BASE}/migrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  })
  if (!res.ok) throw new Error(`Migration failed: ${res.status}`)
  return await res.json()
}
