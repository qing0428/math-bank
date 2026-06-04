import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Layout/Sidebar'
import Dashboard from './components/Dashboard/Dashboard'
import QuestionEntry from './components/QuestionEntry/QuestionEntry'
import Search from './components/Search/Search'
import Settings from './components/Settings/Settings'
import PaperComposition from './components/Paper/PaperComposition'
import { loadLLMConfig } from './store/llmConfigStore'
import { fetchQuestions, migrateQuestions, batchUpsertQuestions, createQuestionApi, updateQuestionApi, deleteQuestionApi } from './services/questionApi'
import { normalizeTags } from './utils/tagNormalize'

const pages = {
  dashboard: Dashboard,
  entry: QuestionEntry,
  search: Search,
  paper: PaperComposition,
  settings: Settings,
}

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [questions, setQuestions] = useState([])
  const [llmConfig, setLlmConfig] = useState(() => loadLLMConfig())
  const [loading, setLoading] = useState(true)

  // Async init: load from API + one-time migration
  useEffect(() => {
    async function init() {
      try {
        let loaded = await fetchQuestions()

        // Migration: if server is empty, check localStorage
        if (loaded.length === 0) {
          const stored = localStorage.getItem('mathQuestions')
          if (stored) {
            try {
              const localQuestions = JSON.parse(stored)
              if (Array.isArray(localQuestions) && localQuestions.length > 0) {
                const result = await migrateQuestions(localQuestions)
                if (result.migrated > 0) {
                  localStorage.removeItem('mathQuestions')
                  loaded = await fetchQuestions()
                  console.log(`Migrated ${result.migrated} questions to server`)
                }
              }
            } catch (e) {
              console.error('Migration failed:', e)
            }
          }
        }

        setQuestions(loaded)
      } catch (err) {
        console.error('Failed to load questions:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  // Sync questions to server — diff old vs new, or batch for large imports
  const saveQuestions = useCallback(async (rawQuestions) => {
    // Normalize tags on all questions before saving
    const newQuestions = rawQuestions.map(q => ({
      ...q,
      tags: normalizeTags(q.tags),
    }))

    const oldIds = new Set(questions.map(q => q.id))
    const newIds = new Set(newQuestions.map(q => q.id))

    // Detect batch import: many new questions or total replacement
    const addedCount = newQuestions.filter(q => !oldIds.has(q.id)).length
    const deletedCount = questions.filter(q => !newIds.has(q.id)).length
    const isBatchImport = addedCount > 20 || (questions.length > 0 && addedCount > questions.length * 0.5)

    if (isBatchImport) {
      try {
        await batchUpsertQuestions(newQuestions)
      } catch (err) {
        console.error('Batch save failed:', err)
      }
    } else {
      // Granular sync
      try {
        for (const q of newQuestions) {
          if (!oldIds.has(q.id)) {
            await createQuestionApi(q)
          } else {
            const old = questions.find(o => o.id === q.id)
            if (old && old.updatedAt !== q.updatedAt) {
              await updateQuestionApi(q)
            }
          }
        }
        for (const q of questions) {
          if (!newIds.has(q.id)) {
            await deleteQuestionApi(q.id)
          }
        }
      } catch (err) {
        console.error('Save failed:', err)
      }
    }

    // Refresh from server for consistent state
    try {
      const loaded = await fetchQuestions()
      setQuestions(loaded)
    } catch (err) {
      // Fallback: update local state directly
      setQuestions(newQuestions)
    }
  }, [questions])

  const handleConfigChange = (newConfig) => {
    setLlmConfig(newConfig)
  }

  const PageComponent = pages[currentPage] || Dashboard

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="text-text text-lg">加载中...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex-1 overflow-y-auto bg-bg relative">
        {Object.entries(pages).map(([key, Comp]) => (
          <div key={key} style={{ display: key === currentPage ? 'block' : 'none' }}>
            <Comp
              questions={questions}
              setQuestions={saveQuestions}
              llmConfig={llmConfig}
              onConfigChange={handleConfigChange}
            />
          </div>
        ))}
      </main>
    </div>
  )
}

export default App
