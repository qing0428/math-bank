import { useState } from 'react'
import Sidebar from './components/Layout/Sidebar'
import Dashboard from './components/Dashboard/Dashboard'
import QuestionEntry from './components/QuestionEntry/QuestionEntry'
import Search from './components/Search/Search'
import Settings from './components/Settings/Settings'
import PaperComposition from './components/Paper/PaperComposition'
import { loadLLMConfig } from './store/llmConfigStore'

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
  const [questions, setQuestions] = useState(() => {
    try {
      const stored = localStorage.getItem('mathQuestions')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [llmConfig, setLlmConfig] = useState(() => loadLLMConfig())

  const saveQuestions = (newQuestions) => {
    setQuestions(newQuestions)
    localStorage.setItem('mathQuestions', JSON.stringify(newQuestions))
  }

  const handleConfigChange = (newConfig) => {
    setLlmConfig(newConfig)
  }

  const PageComponent = pages[currentPage] || Dashboard

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex-1 overflow-y-auto bg-bg">
        <PageComponent
          questions={questions}
          setQuestions={saveQuestions}
          llmConfig={llmConfig}
          onConfigChange={handleConfigChange}
        />
      </main>
    </div>
  )
}

export default App
