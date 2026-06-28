import { useState, useEffect } from 'react';
import './App.css';
import { ToolsDashboard } from './components/ToolsDashboard';
import { StepCredentials } from './components/StepCredentials';
import { StepAnalysis } from './components/StepAnalysis';
import { StepProgress } from './components/StepProgress';
import { StepSummary } from './components/StepSummary';
import type { MigrationProgress } from './types';
import { Check, Sun, Moon, Code2, Home, Database, ShieldCheck, Menu, Search, UserPlus } from 'lucide-react';
import { PmsTestTool } from './components/PmsTestTool/PmsTestTool';
import { RegexTester } from './components/RegexTester/RegexTester';

type Step = 'credentials' | 'analysis' | 'progress' | 'summary';
type Theme = 'dark' | 'light';
type View = 'dashboard' | 'migrator' | 'test-tool' | 'regex-tester';

function App() {
  const [view, setView] = useState<View>('dashboard');
  const [step, setStep] = useState<Step>('credentials');
  const [sourceConn, setSourceConn] = useState('');
  const [targetConn, setTargetConn] = useState('');
  const [migrationDirection, setMigrationDirection] = useState('SqlServerToPostgres'); // SqlServerToPostgres or PostgresToSqlServer
  const [finalProgress, setFinalProgress] = useState<MigrationProgress | null>(null);

  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('db_migrator_theme') as Theme) || 'dark';
  });

  // Apply theme to document root
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('db_migrator_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleCredentialsSuccess = (source: string, target: string, direction: string) => {
    setSourceConn(source);
    setTargetConn(target);
    setMigrationDirection(direction);
    setStep('analysis');
  };

  const handleStartMigration = async (selectedTables: string[], cleanTarget: boolean) => {
    try {
      const response = await fetch('http://localhost:5252/api/migration/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceConnectionString: sourceConn,
          targetConnectionString: targetConn,
          selectedTables,
          cleanTarget,
          direction: migrationDirection
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setStep('progress');
      } else {
        alert(data.message || 'Failed to start migration.');
      }
    } catch (e: any) {
      alert('Error connecting to backend server: ' + e.message);
    }
  };

  const handleMigrationFinished = (progress: MigrationProgress) => {
    setFinalProgress(progress);
    setStep('summary');
  };

  const handleReset = () => {
    setStep('credentials');
    setFinalProgress(null);
  };

  const getStepIndex = () => {
    switch (step) {
      case 'credentials': return 1;
      case 'analysis':    return 2;
      case 'progress':    return 3;
      case 'summary':     return 4;
      default:            return 1;
    }
  };

  const currentStepIndex = getStepIndex();
  const progressLinePercent = ((currentStepIndex - 1) / 3) * 100;

  const stepsMeta = [
    { label: 'Credentials', index: 1 },
    { label: 'Analyze',     index: 2 },
    { label: 'Migrate',     index: 3 },
    { label: 'Summary',     index: 4 },
  ];

  const getActiveViewTitle = () => {
    switch (view) {
      case 'dashboard': return 'DeVault Utility Hub';
      case 'migrator': return 'SQL Server → PostgreSQL Migrator';
      case 'test-tool': return 'PMS Unit Test Generator';
      default: return 'DeVault';
    }
  };

  return (
    <div className="app-layout">
      {/* ── Left Sidebar Navigation ───────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div 
            className="sidebar-logo"
            onClick={() => { setView('dashboard'); handleReset(); }}
            style={{ cursor: 'pointer' }}
          >
            <span className="brand-logo-crown">
              <span>De</span>
              <span className="crown-v-box">
                <span className="v-char v-top">V</span>
                <span className="v-char v-bottom">V</span>
              </span>
              <span>ault</span>
            </span>
          </div>
          <button className="sidebar-toggle-btn">
            <Menu size={16} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <span className="sidebar-section-title">Navigation</span>
            <button 
              className={`sidebar-item ${view === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setView('dashboard'); handleReset(); }}
            >
              <Home size={16} />
              <span>Home</span>
            </button>
          </div>

          <div className="sidebar-section">
            <span className="sidebar-section-title">Active Tools</span>
            <button 
              className={`sidebar-item ${view === 'migrator' ? 'active' : ''}`}
              onClick={() => { setView('migrator'); setStep('credentials'); }}
            >
              <Database size={16} style={{ color: '#818cf8' }} />
              <span>Schema Migrator</span>
            </button>

            <button 
              className={`sidebar-item ${view === 'test-tool' ? 'active' : ''}`}
              onClick={() => { setView('test-tool'); }}
            >
              <ShieldCheck size={16} style={{ color: '#10b981' }} />
              <span>Unit Test Gen</span>
            </button>

            <button 
              className={`sidebar-item ${view === 'regex-tester' ? 'active' : ''}`}
              onClick={() => { setView('regex-tester'); }}
            >
              <Code2 size={16} style={{ color: '#a78bfa' }} />
              <span>Regex Tester</span>
            </button>
          </div>

          <div className="sidebar-section">
            <span className="sidebar-section-title">Favorites</span>
            <div className="sidebar-item disabled">
              <span className="sidebar-dot green" />
              <span>JWT Debugger</span>
            </div>
            <div className="sidebar-item disabled">
              <span className="sidebar-dot pink" />
              <span>JSON Formatter</span>
            </div>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="invite-btn">
            <UserPlus size={14} />
            <span>Invite teammates</span>
          </button>
        </div>
      </aside>

      {/* ── Main Panel Viewport ───────────────────── */}
      <div className="main-viewport">
        {/* Top Horizontal Header */}
        <header className="viewport-header">
          <div className="viewport-header-left">
            <div className="viewport-project-icon">
              {view === 'migrator' ? (
                <Database size={16} />
              ) : view === 'test-tool' ? (
                <ShieldCheck size={16} />
              ) : (
                <Code2 size={16} />
              )}
            </div>
            <div className="viewport-project-info">
              <div className="viewport-project-title-row">
                <h1>{getActiveViewTitle()}</h1>
              </div>
              <span className="viewport-project-status">
                <span className="status-dot" />
                On Track
              </span>
            </div>
          </div>

          <div className="viewport-header-right">
            <div className="viewport-search-bar">
              <Search size={14} />
              <input type="text" placeholder="Search..." />
            </div>

            <span className="version-tag">v1.0.0</span>
            
            <a
              href="https://github.com/patan-abubakar8/DevVault"
              target="_blank"
              rel="noopener noreferrer"
              className="theme-toggle"
              title="View on GitHub"
              aria-label="GitHub Repository"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', textDecoration: 'none' }}
            >
              <svg height="17" width="17" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>

            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        {/* View Workspace Container */}
        <div className="viewport-content">
          {view === 'migrator' && (
            <div className="stepper" style={{ marginBottom: '2.5rem' }}>
              <div className="stepper-line">
                <div className="stepper-line-progress" style={{ width: `${progressLinePercent}%` }} />
              </div>

              {stepsMeta.map(({ label, index }) => {
                const isCompleted = currentStepIndex > index;
                const isActive    = currentStepIndex === index;
                const className   = `step-item${isActive ? ' active' : ''}${isCompleted ? ' completed' : ''}`;

                return (
                  <div key={index} className={className}>
                    <div className="step-number">
                      {isCompleted ? <Check size={15} /> : index}
                    </div>
                    <span className="step-label">{label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {view === 'dashboard' ? (
            <ToolsDashboard 
              onSelectSqlServerToPostgres={() => setView('migrator')} 
              onSelectPmsTestTool={() => setView('test-tool')}
              onSelectRegexTester={() => setView('regex-tester')}
            />
          ) : view === 'test-tool' ? (
            <PmsTestTool />
          ) : view === 'regex-tester' ? (
            <RegexTester />
          ) : (
            <>
              {step === 'credentials' && (
                <StepCredentials onSuccess={handleCredentialsSuccess} />
              )}

              {step === 'analysis' && (
                <StepAnalysis
                  sourceConn={sourceConn}
                  direction={migrationDirection}
                  onBack={() => setStep('credentials')}
                  onStartMigration={handleStartMigration}
                />
              )}

              {step === 'progress' && (
                <StepProgress onFinished={handleMigrationFinished} />
              )}

              {step === 'summary' && finalProgress && (
                <StepSummary progress={finalProgress} onReset={handleReset} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
