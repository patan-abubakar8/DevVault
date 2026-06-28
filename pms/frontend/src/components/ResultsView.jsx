import { useState, useMemo } from 'react'

export default function ResultsView({ results }) {
  const [expanded, setExpanded] = useState(null)

  const stats = useMemo(() => {
    if (!results?.summary) return null
    const s = results.summary
    const total = s.total || 0
    const passed = s.passed || 0
    const failed = s.failed || 0
    const pending = s.pending || 0
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0
    return { total, passed, failed, pending, passRate }
  }, [results])

  if (!results || !stats) {
    return (
      <div className="results-view">
        <div className="empty-state">
          <h3>No Results Yet</h3>
          <p>Go to the Tests tab and click "Run All Tests" to see results here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="results-view">
      <div className="results-header">
        <h2>Test Results</h2>
      </div>

      <div className="results-overview">
        <div className="result-ring-section">
          <div className="result-ring">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#22223a" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="#34d399" strokeWidth="10"
                strokeDasharray={`${stats.passRate * 3.27}, 327`}
                transform="rotate(-90 60 60)" strokeLinecap="round" />
              <text x="60" y="50" textAnchor="middle" className="ring-pct">{stats.passRate}%</text>
              <text x="60" y="70" textAnchor="middle" className="ring-label">pass rate</text>
            </svg>
          </div>
          <div className="result-total">{stats.total} tests total</div>
        </div>

        <div className="result-stats-grid">
          <div className="result-stat-card passed">
            <div className="result-stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="result-stat-body">
              <span className="result-stat-value">{stats.passed}</span>
              <span className="result-stat-label">Passed</span>
            </div>
          </div>
          <div className="result-stat-card failed">
            <div className="result-stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div className="result-stat-body">
              <span className="result-stat-value">{stats.failed}</span>
              <span className="result-stat-label">Failed</span>
            </div>
          </div>
          <div className="result-stat-card pending">
            <div className="result-stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
            <div className="result-stat-body">
              <span className="result-stat-value">{stats.pending}</span>
              <span className="result-stat-label">Pending</span>
            </div>
          </div>
        </div>
      </div>

      <div className="results-table-section">
        <h3>Test Classes</h3>
        <div className="results-table-modern">
          <div className="rt-row rt-header">
            <span className="rt-col name">Test Class</span>
            <span className="rt-col status">Status</span>
            <span className="rt-col count">Scenarios</span>
            <span className="rt-col error">Error</span>
          </div>
          {results.details?.map((d, i) => (
            <div
              key={i}
              className={`rt-row ${expanded === i ? 'expanded' : ''}`}
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <span className="rt-col name">
                <span className="status-dot" data-status={d.status?.toLowerCase()} />
                {d.className}
              </span>
              <span className="rt-col status">
                <span className={`status-badge ${d.status?.toLowerCase()}`}>{d.status}</span>
              </span>
              <span className="rt-col count">{d.scenarioCount}</span>
              <span className="rt-col error">{d.errorMessage || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
