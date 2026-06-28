import React, { useState, useMemo, useEffect } from 'react';
import { Play, Code, Check } from 'lucide-react';
import type { AnalysisResult, TestScenario } from './types';

// Explanations for each test category
const CATEGORIES_INFO = [
  {
    name: 'Happy Path',
    desc: 'Verifies standard workflows under normal conditions with valid parameters, ensuring positive outcomes.',
    color: '#6366f1', // Vibrant purple/indigo accent
  },
  {
    name: 'Null Check',
    desc: 'Ensures reference parameters defend against null references to prevent application crashes.',
    color: '#ec4899', // Pink
  },
  {
    name: 'Edge Case',
    desc: 'Validates behavior under unusual inputs like empty strings or whitespace values.',
    color: '#f97316', // Orange
  },
  {
    name: 'Boundary',
    desc: 'Verifies limits, zero bounds, and negative parameters are handled cleanly without overflow.',
    color: '#06b6d4', // Cyan
  },
  {
    name: 'Boolean State',
    desc: 'Tests alternate execution branches governed by boolean toggles or flags.',
    color: '#3b82f6', // Blue
  },
  {
    name: 'Validation',
    desc: 'Ensures input validation rules correctly reject incomplete or malformed payload data.',
    color: '#10b981', // Green
  },
  {
    name: 'Error Path',
    desc: 'Verifies downstream dependency crashes or mock failures are gracefully recovered.',
    color: '#ef4444', // Red
  }
];

interface TestsViewProps {
  data: AnalysisResult | null;
  onRunTests: () => Promise<void>;
}

export const TestsView: React.FC<TestsViewProps> = ({ data, onRunTests }) => {
  const [running, setRunning] = useState(false);
  const [selectedTestIndex, setSelectedTestIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('Happy Path');
  const [methodFilter, setMethodFilter] = useState('all');
  const [showCode, setShowCode] = useState(false);

  if (!data?.tests || data.tests.length === 0) {
    return (
      <div className="tests-view page-transition">
        <div className="empty-state">
          <p>No tests were generated. Make sure your project has services or controllers.</p>
        </div>
      </div>
    );
  }

  const activeTest = data.tests[selectedTestIndex];

  // Group scenarios of the active test class by category
  const byCategory = useMemo(() => {
    const groups: Record<string, TestScenario[]> = {};
    activeTest.scenarios?.forEach(s => {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    });
    return groups;
  }, [activeTest]);

  // Find categories that have at least one test case in this active class
  const availableCategories = CATEGORIES_INFO.filter(cat => byCategory[cat.name]?.length > 0);

  // If the currently selected category is not available in the new active test class, fallback to the first available category
  const currentCategoryName = byCategory[selectedCategory]?.length > 0 
    ? selectedCategory 
    : (availableCategories[0]?.name || 'Happy Path');

  const currentCategoryInfo = CATEGORIES_INFO.find(c => c.name === currentCategoryName);

  // Filter scenarios by selected category AND selected method
  const filteredScenarios = useMemo(() => {
    let list = byCategory[currentCategoryName] || [];
    if (methodFilter !== 'all') {
      list = list.filter(s => s.methodName === methodFilter);
    }
    return list;
  }, [byCategory, currentCategoryName, methodFilter]);

  // Group filtered scenarios by target method name
  const scenariosByMethod = useMemo(() => {
    const groups: Record<string, TestScenario[]> = {};
    filteredScenarios.forEach(s => {
      const mName = s.methodName || 'Unknown Method';
      if (!groups[mName]) groups[mName] = [];
      groups[mName].push(s);
    });
    return groups;
  }, [filteredScenarios]);

  // List of all unique methods that have scenarios in the active category
  const uniqueMethods = useMemo(() => {
    const methodsSet = new Set<string>();
    const list = byCategory[currentCategoryName] || [];
    list.forEach(s => {
      if (s.methodName) methodsSet.add(s.methodName);
    });
    return Array.from(methodsSet).sort();
  }, [byCategory, currentCategoryName]);

  // Reset method filter when changing category or test class
  useEffect(() => {
    setMethodFilter('all');
  }, [selectedTestIndex, selectedCategory]);

  async function handleRun() {
    setRunning(true);
    try {
      await onRunTests();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="tests-workspace page-transition">
      {/* Header Area */}
      <div className="tests-view-header">
        <div>
          <h2>Generated Test Cases</h2>
          <p className="tests-view-sub">
            Review the dynamically generated test suite structure for {data.projectName}.
          </p>
        </div>
        <button className="run-btn" onClick={handleRun} disabled={running}>
          {running ? (
            <>
              <div className="btn-spinner" />
              Running Tests...
            </>
          ) : (
            <>
              <Play size={16} style={{ marginRight: '6px' }} />
              Run All Tests
            </>
          )}
        </button>
      </div>

      {/* ── Test Class Selector Row (Horizontal Top) ── */}
      <div className="class-selector-row">
        <span className="selector-label">Test Class:</span>
        <div className="class-tabs">
          {data.tests.map((t, idx) => (
            <button
              key={idx}
              className={`class-tab-btn ${selectedTestIndex === idx ? 'active' : ''}`}
              onClick={() => {
                setSelectedTestIndex(idx);
                setShowCode(false);
              }}
            >
              {t.className}
              <span className="class-count-badge">{t.scenarios?.length || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Category Divisions Row (Horizontal Tabs) ── */}
      <div className="category-tabs-row">
        {availableCategories.map(cat => {
          const count = byCategory[cat.name]?.length || 0;
          const isActive = currentCategoryName === cat.name;

          return (
            <button
              key={cat.name}
              className={`category-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.name)}
              style={{
                borderBottomColor: isActive ? cat.color : 'transparent',
              }}
            >
              <span className="category-color-dot" style={{ backgroundColor: cat.color }} />
              <span style={{ color: isActive ? cat.color : 'inherit' }}>{cat.name}</span>
              <span className="category-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Full Width Scenarios Workspace ── */}
      <div className="tests-full-width-pane">
        <div className="pane-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div className="pane-header-title">
              <span className="category-dot" style={{ background: currentCategoryInfo?.color || 'var(--accent)' }} />
              <h3>{currentCategoryName} Scenarios</h3>
            </div>
            <p className="category-long-desc">{currentCategoryInfo?.desc}</p>
          </div>

          {uniqueMethods.length > 0 && (
            <div className="method-filter-container" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Filter Method:</span>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="method-filter-select"
                style={{
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.82rem',
                  padding: '0.4rem 1.8rem 0.4rem 0.8rem',
                  borderRadius: 'var(--radius-sm)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Scanned Methods ({uniqueMethods.length})</option>
                {uniqueMethods.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Grouped Scenarios Scroll List */}
        <div className="scenarios-scroll-area">
          {Object.keys(scenariosByMethod).length > 0 ? (
            Object.keys(scenariosByMethod).map(mName => (
              <div key={mName} className="method-group-section">
                <div className="method-group-header">
                  <span>{mName}</span>
                  <span className="group-count">{scenariosByMethod[mName].length}</span>
                </div>

                <div className="method-group-rows" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {scenariosByMethod[mName].map((s, idx) => {
                    const currentCategoryInfo = CATEGORIES_INFO.find(c => c.name === s.category);
                    const catColor = currentCategoryInfo?.color || 'var(--accent)';

                    return (
                      <div key={idx} className="scenario-list-row" style={{ borderLeftColor: catColor }}>
                        <div className="row-left-section">
                          <span className="row-check-icon">
                            <Check size={14} />
                          </span>
                          
                          <div className="row-code-invocation">
                            <span className="sig-obj">target</span>
                            <span className="sig-dot">.</span>
                            <span className="sig-method">{s.methodName || 'Method'}</span>
                            <span className="sig-paren">(</span>
                            <span className="sig-params">{s.inputSummary}</span>
                            <span className="sig-paren">)</span>
                          </div>

                          <span className="row-assertion-text" title={s.expectedBehavior}>
                            expect: {s.expectedBehavior}
                          </span>
                        </div>

                        <div className="row-badges-section">
                          <span 
                            className="row-badge"
                            style={{ 
                              background: catColor + '12', 
                              color: catColor,
                              border: `1px solid ${catColor}25`
                            }}
                          >
                            {s.category}
                          </span>
                          
                          <span className="row-badge waiting">
                            Pending
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state" style={{ padding: '3rem 1rem' }}>
              <p>No scenarios found for the selected filter.</p>
            </div>
          )}
        </div>

        {/* Test Code Preview Section */}
        <div className="test-code-preview-section">
          <button className="code-toggle" onClick={() => setShowCode(!showCode)}>
            <Code size={14} style={{ marginRight: '6px' }} />
            {showCode ? 'Hide' : 'View'} Complete Generated Source Code ({activeTest.className})
          </button>
          {showCode && (
            <div className="code-block-wrapper">
              <div className="code-block-header">
                <span>{activeTest.className} Code</span>
                <span className="code-lang-tag">{activeTest.testType}</span>
              </div>
              <pre className="code-block"><code>{activeTest.testCode}</code></pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
