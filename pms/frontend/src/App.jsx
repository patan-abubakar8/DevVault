import { useState } from 'react'
import UploadZone from './components/UploadZone'
import Dashboard from './components/Dashboard'
import TestsView from './components/TestsView'
import ResultsView from './components/ResultsView'
import './App.css'

const TABS = [
  { key: 'upload', label: 'Upload', icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12' },
  { key: 'dashboard', label: 'Analysis', icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2 M9 14l2 2 4-4' },
  { key: 'tests', label: 'Tests', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8' },
  { key: 'results', label: 'Results', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
]

function TabIcon({ path }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {path.split(' ').map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

export default function App() {
  const [sessionId, setSessionId] = useState(null)
  const [analysisData, setAnalysisData] = useState(null)
  const [testResults, setTestResults] = useState(null)
  const [tab, setTab] = useState('upload')

  function handleAnalyzed(data) {
    setSessionId(data.sessionId)
    setAnalysisData(data)
    setTestResults(null)
    setTab('dashboard')
  }

  function handleError(msg) {
    console.error(msg)
  }

  async function handleRunTests() {
    if (!sessionId) return
    const res = await fetch(`http://localhost:5000/api/ProjectTest/run/${sessionId}`, { method: 'POST' })
    if (!res.ok) throw new Error('Failed to run tests')
    const data = await res.json()
    setTestResults(data)

    const res2 = await fetch(`http://localhost:5000/api/ProjectTest/tests/${sessionId}`)
    if (res2.ok) {
      const data2 = await res2.json()
      setAnalysisData(prev => ({ ...prev, tests: data2.tests }))
    }
    setTab('results')
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-name">PMSTest</span>
            <span className="brand-sub">Test Generator</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {TABS.map(t => {
            const disabled = (t.key === 'dashboard' || t.key === 'tests') && !analysisData
            const isResultsDisabled = t.key === 'results' && !testResults
            return (
              <button
                key={t.key}
                className={`nav-item ${tab === t.key ? 'active' : ''}`}
                disabled={disabled || isResultsDisabled}
                onClick={() => setTab(t.key)}
              >
                <TabIcon path={t.icon} />
                <span>{t.label}</span>
                {t.key === 'dashboard' && analysisData && (
                  <span className="nav-badge">{analysisData.services?.length || 0}S / {analysisData.controllers?.length || 0}C</span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="footer-info">
            <span className="footer-dot" />
            API: localhost:5000
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="page-transition" key={tab}>
          {tab === 'upload' && <UploadZone onAnalyzed={handleAnalyzed} onError={handleError} />}
          {tab === 'dashboard' && <Dashboard data={analysisData} />}
          {tab === 'tests' && <TestsView data={analysisData} onRunTests={handleRunTests} />}
          {tab === 'results' && <ResultsView results={testResults} />}
        </div>
      </main>
    </div>
  )
}
