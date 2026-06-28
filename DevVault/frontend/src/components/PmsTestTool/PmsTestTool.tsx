import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { UploadZone } from './UploadZone';
import { Dashboard } from './Dashboard';
import { TestsView } from './TestsView';
import { ResultsView } from './ResultsView';
import type { AnalysisResult, TestResults } from './types';

type TabKey = 'upload' | 'dashboard' | 'tests' | 'results';

interface StepMeta {
  label: string;
  key: TabKey;
  index: number;
}

export const PmsTestTool: React.FC = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [tab, setTab] = useState<TabKey>('upload');

  const stepsMeta: StepMeta[] = [
    { label: 'Upload Code', key: 'upload', index: 1 },
    { label: 'Analyze', key: 'dashboard', index: 2 },
    { label: 'Test Cases', key: 'tests', index: 3 },
    { label: 'Results', key: 'results', index: 4 },
  ];

  const getStepIndex = () => {
    switch (tab) {
      case 'upload': return 1;
      case 'dashboard': return 2;
      case 'tests': return 3;
      case 'results': return 4;
      default: return 1;
    }
  };

  const currentStepIndex = getStepIndex();
  const progressLinePercent = ((currentStepIndex - 1) / 3) * 100;

  function handleAnalyzed(data: AnalysisResult) {
    setSessionId(data.sessionId);
    setAnalysisData(data);
    setTestResults(null);
    setTab('dashboard');
  }

  function handleError(msg: string) {
    console.error(msg);
  }

  async function handleRunTests() {
    if (!sessionId) return;
    try {
      const res = await fetch(`http://localhost:5252/api/ProjectTest/run/${sessionId}`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to run tests');
      const data = await res.json();
      setTestResults(data);

      const res2 = await fetch(`http://localhost:5252/api/ProjectTest/tests/${sessionId}`);
      if (res2.ok) {
        const data2 = await res2.json();
        setAnalysisData(prev => prev ? { ...prev, tests: data2.tests } : null);
      }
      setTab('results');
    } catch (err: any) {
      alert('Error running tests: ' + err.message);
    }
  }

  return (
    <div className="pms-tool-wrapper page-transition" style={{ gap: '2rem' }}>
      {/* ── Stepper Wizard ───────────────────────── */}
      <div className="stepper" style={{ width: '100%' }}>
        <div className="stepper-line">
          <div className="stepper-line-progress" style={{ width: `${progressLinePercent}%` }} />
        </div>

        {stepsMeta.map(({ label, key, index }) => {
          const isCompleted = currentStepIndex > index;
          const isActive = currentStepIndex === index;
          const isDashboardOrTestsDisabled = (key === 'dashboard' || key === 'tests') && !analysisData;
          const isResultsDisabled = key === 'results' && !testResults;
          const isDisabled = isDashboardOrTestsDisabled || isResultsDisabled;

          const className = `step-item${isActive ? ' active' : ''}${isCompleted ? ' completed' : ''}${isDisabled ? ' disabled' : ''}`;

          return (
            <button
              key={index}
              className={className}
              disabled={isDisabled}
              onClick={() => setTab(key)}
              style={{
                background: 'var(--bg-card)',
                border: 'none',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.7rem',
                padding: '0 0.5rem',
                position: 'relative',
                zIndex: 2,
                outline: 'none'
              }}
            >
              <div className="step-number" style={{ transition: 'all 0.28s ease' }}>
                {isCompleted ? <Check size={15} /> : index}
              </div>
              <span className="step-label">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Tab Panel */}
      <div className="pms-tab-content">
        {tab === 'upload' && (
          <UploadZone onAnalyzed={handleAnalyzed} onError={handleError} />
        )}
        {tab === 'dashboard' && (
          <Dashboard data={analysisData} onNavigateToTests={() => setTab('tests')} />
        )}
        {tab === 'tests' && (
          <TestsView data={analysisData} onRunTests={handleRunTests} />
        )}
        {tab === 'results' && (
          <ResultsView results={testResults} analysisData={analysisData} />
        )}
      </div>
    </div>
  );
};

export default PmsTestTool;
