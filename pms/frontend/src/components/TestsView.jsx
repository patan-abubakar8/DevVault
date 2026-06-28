import { useState, useMemo } from 'react'

function ScenarioCard({ scenario }) {
  const [expanded, setExpanded] = useState(false)

  const categoryColors = {
    'Happy Path': '#34d399',
    'Null Check': '#fbbf24',
    'Edge Case': '#a78bfa',
    'Boundary': '#60a5fa',
    'Boolean State': '#22d3ee',
    'Validation': '#f472b6',
    'Error Path': '#f87171',
  }

  const color = categoryColors[scenario.category] || '#888'

  return (
    <div className={`scenario-card ${expanded ? 'expanded' : ''}`} style={{ borderLeftColor: color }}>
      <div className="scenario-head" onClick={() => setExpanded(!expanded)}>
        <div className="scenario-left">
          <span className="scenario-dot" style={{ background: color }} />
          <span className="scenario-name">{scenario.name}</span>
        </div>
        <div className="scenario-right">
          <span className="scenario-cat" style={{ color, borderColor: color + '40', background: color + '15' }}>
            {scenario.category}
          </span>
          <span className={`chevron ${expanded ? 'open' : ''}`}>▼</span>
        </div>
      </div>
      {expanded && (
        <div className="scenario-body">
          <div className="scenario-field">
            <span className="field-label">Description</span>
            <p>{scenario.description}</p>
          </div>
          <div className="scenario-field">
            <span className="field-label">Input</span>
            <code className="field-value">{scenario.inputSummary}</code>
          </div>
          <div className="scenario-field">
            <span className="field-label">Expected Behavior</span>
            <p>{scenario.expectedBehavior}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function TestClassCard({ test }) {
  const [showCode, setShowCode] = useState(false)

  const byCategory = useMemo(() => {
    const groups = {}
    test.scenarios?.forEach(s => {
      if (!groups[s.category]) groups[s.category] = []
      groups[s.category].push(s)
    })
    return groups
  }, [test.scenarios])

  const categories = ['Happy Path', 'Null Check', 'Edge Case', 'Boundary', 'Boolean State', 'Validation', 'Error Path']

  return (
    <div className="test-class-card">
      <div className="test-class-header">
        <div className="test-class-info">
          <h3>{test.className}</h3>
          <div className="test-class-meta">
            <span className="test-type-badge">{test.testType}</span>
            <span>→</span>
            <code>{test.targetClass}</code>
          </div>
        </div>
        <div className="test-class-stats">
          <span className="test-scenario-count">{test.scenarios?.length || 0} scenarios</span>
          <span className={`test-status-dot ${test.status?.toLowerCase() || 'pending'}`} />
        </div>
      </div>

      <div className="test-class-body">
        {categories.map(cat => {
          const items = byCategory[cat] || []
          if (items.length === 0) return null
          return (
            <div key={cat} className="scenario-group">
              <div className="scenario-group-header">
                <span className="group-name">{cat}</span>
                <span className="group-count">{items.length}</span>
              </div>
              <div className="scenario-group-body">
                {items.map((s, i) => <ScenarioCard key={i} scenario={s} />)}
              </div>
            </div>
          )
        })}

        <div className="test-code-section">
          <button className="code-toggle" onClick={() => setShowCode(!showCode)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
            {showCode ? 'Hide' : 'Show'} Generated Code
          </button>
          {showCode && (
            <pre className="code-block"><code>{test.testCode}</code></pre>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TestsView({ data, onRunTests }) {
  const [running, setRunning] = useState(false)

  if (!data?.tests) return null

  const totalScenarios = data.tests.reduce((a, t) => a + (t.scenarios?.length || 0), 0)

  async function handleRun() {
    setRunning(true)
    try {
      await onRunTests?.()
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="tests-view">
      <div className="tests-view-header">
        <div>
          <h2>Generated Tests</h2>
          <p className="tests-view-sub">
            {data.tests.length} test classes with {totalScenarios} scenarios for {data.projectName}
          </p>
        </div>
        <button className="run-btn" onClick={handleRun} disabled={running}>
          {running ? (
            <>
              <div className="btn-spinner" />
              Running...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Run All Tests
            </>
          )}
        </button>
      </div>

      {data.tests.length === 0 ? (
        <div className="empty-state">
          <p>No tests were generated. Make sure your project has services or controllers.</p>
        </div>
      ) : (
        <div className="test-class-list">
          {data.tests.map((t, i) => <TestClassCard key={i} test={t} />)}
        </div>
      )}
    </div>
  )
}
