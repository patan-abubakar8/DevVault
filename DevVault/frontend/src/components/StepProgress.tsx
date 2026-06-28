import React, { useState, useEffect, useRef } from 'react';
import type { MigrationProgress } from '../types';
import { Loader2, Terminal as TerminalIcon, ArrowRight } from 'lucide-react';

interface StepProgressProps {
  onFinished: (finalProgress: MigrationProgress) => void;
}

export const StepProgress: React.FC<StepProgressProps> = ({ onFinished }) => {
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // SSE progress listener
  useEffect(() => {
    const eventSource = new EventSource('http://localhost:5252/api/migration/progress');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as MigrationProgress;
        setProgress(data);

        if (data.phase === 'Complete' || data.phase === 'Failed') {
          setIsFinished(true);
        }
      } catch (err) {
        console.error('Error parsing SSE event data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      // Wait and try to fetch state as fallback
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Live stopwatch timer
  useEffect(() => {
    if (!progress?.startTime || isFinished) return;
    
    const start = new Date(progress.startTime).getTime();
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      setElapsedSeconds(Math.max(0, Math.floor((now - start) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [progress?.startTime, isFinished]);

  // Handle final duration from actual progress timestamps if complete
  useEffect(() => {
    if (progress?.startTime && progress?.endTime) {
      const start = new Date(progress.startTime).getTime();
      const end = new Date(progress.endTime).getTime();
      setElapsedSeconds(Math.max(0, Math.floor((end - start) / 1000)));
    }
  }, [progress?.startTime, progress?.endTime]);

  // Terminal scroll helper
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [progress?.recentLogs, autoScroll]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const response = await fetch('http://localhost:5252/api/migration/cancel', {
        method: 'POST',
      });
      if (!response.ok) {
        console.error('Failed to dispatch cancellation.');
      }
    } catch (err) {
      console.error('Error cancelling migration:', err);
    } finally {
      setCancelling(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [
      h > 0 ? h.toString().padStart(2, '0') : null,
      m.toString().padStart(2, '0'),
      s.toString().padStart(2, '0')
    ].filter(Boolean).join(':');
  };

  const getPhaseDisplay = (phase: string) => {
    switch (phase) {
      case 'Initializing': return 'Initializing engine...';
      case 'Analyzing': return 'Analyzing source schema...';
      case 'SchemaCreation': return 'Creating database schema...';
      case 'DataCopy': return 'Transferring table records...';
      case 'Constraints': return 'Applying indexes and keys...';
      case 'Complete': return 'Migration completed successfully';
      case 'Failed': return 'Migration failed';
      default: return 'Starting...';
    }
  };

  const getActiveMetrics = () => {
    if (!progress) return { activeTable: 'None', speed: 0 };
    const copyingTable = progress.tableMetrics.find(t => t.status === 'Copying');
    return {
      activeTable: copyingTable ? copyingTable.tableName : 'None',
      speed: copyingTable ? copyingTable.speed : 0
    };
  };

  const { activeTable, speed } = getActiveMetrics();

  return (
    <div className="glass-panel">
      {/* Step Title */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            {progress?.phase === 'Complete' && 'Migration Completed'}
            {progress?.phase === 'Failed' && 'Migration Failed'}
            {progress?.phase !== 'Complete' && progress?.phase !== 'Failed' && 'Migrating Database...'}
          </h2>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 0.9 }}>
            {progress ? getPhaseDisplay(progress.phase) : 'Connecting to migration event stream...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {progress?.phase !== 'Complete' && progress?.phase !== 'Failed' && (
            <Loader2 className="spinner" size={20} style={{ color: 'hsl(var(--primary))' }} />
          )}
        </div>
      </div>

      {/* Main Metrics Panels */}
      <div className="progress-header-grid">
        {/* Progress Fill */}
        <div className="metric-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Overall Progress</span>
            <span style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {progress ? progress.overallProgress.toFixed(1) : '0.0'}%
            </span>
          </div>
          <div className="progress-bar-container">
            <div 
              className={`progress-bar-fill ${progress?.phase === 'Complete' ? 'complete' : ''} ${progress?.phase === 'Failed' ? 'failed' : ''}`}
              style={{ width: `${progress ? progress.overallProgress : 0}%` }}
            ></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
            <span>Schema & Tables: {progress?.completedTables || 0} / {progress?.totalTables || 0}</span>
            <span>Active: {activeTable}</span>
          </div>
        </div>

        {/* Stopwatch & Speed Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="metric-panel" style={{ padding: '1rem 1.25rem' }}>
            <span className="metric-label">Elapsed Time</span>
            <span className="metric-value">{formatTime(elapsedSeconds)}</span>
          </div>
          <div className="metric-panel" style={{ padding: '1rem 1.25rem' }}>
            <span className="metric-label">Copy Velocity</span>
            <span className="metric-value" style={{ fontSize: '1.4rem' }}>
              {speed > 0 ? `${speed.toLocaleString(undefined, { maximumFractionDigits: 0 })} rows/s` : '0 rows/s'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Tables Progress */}
      {progress && progress.tableMetrics.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Tables Progress
          </h3>
          <div className="tables-progress-list">
            {progress.tableMetrics.map((table) => {
              const percentage = table.totalRows > 0 
                ? (table.rowsMigrated / table.totalRows) * 100 
                : (table.status === 'Completed' ? 100 : 0);

              return (
                <div key={table.tableName} className="table-progress-row">
                  <div className="table-progress-name" title={table.tableName}>
                    {table.tableName}
                  </div>
                  <div className="table-progress-bar-wrapper">
                    <div className="table-progress-bar">
                      <div 
                        className={`table-progress-bar-fill ${table.status.toLowerCase()}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="table-progress-stats">
                      {table.rowsMigrated.toLocaleString()} / {table.totalRows.toLocaleString()}
                    </div>
                  </div>
                  <div className={`table-progress-status ${table.status.toLowerCase()}`}>
                    {table.status}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cyber Console Terminal */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Migration Activity logs
        </h3>
        
        <div className="terminal-container">
          <div className="terminal-header">
            <div className="terminal-title">
              <span className="terminal-dot"></span>
              <span className="terminal-dot-3"></span>
              <TerminalIcon size={14} style={{ marginLeft: '10px' }} />
              <span>migration-agent-stdout.log</span>
            </div>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', cursor: 'pointer', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={autoScroll} 
                onChange={(e) => setAutoScroll(e.target.checked)}
                style={{ width: '12px', height: '12px' }}
              />
              Auto-scroll
            </label>
          </div>
          
          <div className="terminal-screen">
            {progress?.recentLogs.length === 0 ? (
              <div style={{ color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
                Waiting for migration execution logs...
              </div>
            ) : (
              progress?.recentLogs.map((log, index) => {
                const timeStr = new Date(log.timestamp).toLocaleTimeString();
                return (
                  <div key={index} className="log-row">
                    <span className="log-time">[{timeStr}]</span>
                    <span className={`log-level ${log.level.toLowerCase()}`}>{log.level}</span>
                    <span className="log-message">{log.message}</span>
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef}></div>
          </div>
        </div>
      </div>

      {/* Command Actions */}
      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
        {progress?.isRunning && (
          <button 
            className="btn btn-danger" 
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling && <Loader2 className="spinner" size={16} />}
            Abort Migration
          </button>
        )}
        
        {isFinished && progress && (
          <button 
            className="btn btn-primary" 
            onClick={() => onFinished(progress)}
          >
            View Summary Report
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
