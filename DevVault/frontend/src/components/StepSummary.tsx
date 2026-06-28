import React from 'react';
import type { MigrationProgress } from '../types';
import { 
  CheckCircle2, XCircle, RefreshCw, 
  Hourglass, Layers, AlertCircle, Database
} from 'lucide-react';

interface StepSummaryProps {
  progress: MigrationProgress;
  onReset: () => void;
}

export const StepSummary: React.FC<StepSummaryProps> = ({ progress, onReset }) => {
  const isSuccess = progress.phase === 'Complete';
  
  const getDuration = () => {
    if (!progress.startTime || !progress.endTime) return '0s';
    const start = new Date(progress.startTime).getTime();
    const end = new Date(progress.endTime).getTime();
    const sec = Math.max(0, Math.floor((end - start) / 1000));
    
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    
    return [
      h > 0 ? `${h}h` : null,
      m > 0 ? `${m}m` : null,
      `${s}s`
    ].filter(Boolean).join(' ');
  };

  const totalRows = progress.tableMetrics.reduce((sum, t) => sum + (t.status === 'Completed' ? t.totalRows : t.rowsMigrated), 0);
  const totalTables = progress.tableMetrics.length;
  const successfulTables = progress.tableMetrics.filter(t => t.status === 'Completed').length;

  const warnings = progress.recentLogs.filter(log => log.level === 'WARN');

  return (
    <div className="glass-panel">
      {/* Visual Header */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          {isSuccess ? (
            <div className="summary-icon success" style={{ width: '80px', height: '80px', borderRadius: '50%' }}>
              <CheckCircle2 size={48} />
            </div>
          ) : (
            <div className="summary-icon" style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: 'hsl(var(--danger))' }}>
              <XCircle size={48} />
            </div>
          )}
        </div>
        
        <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          {isSuccess ? 'Migration Succeeded!' : 'Migration Failed'}
        </h2>
        <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '1rem', maxWidth: '600px', margin: '0 auto' }}>
          {isSuccess 
            ? 'The database schema was created, and all data was safely streamed and committed to your target PostgreSQL database.'
            : 'The database migration was aborted due to a critical error. Inspect the details below.'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-icon info">
            <Layers size={22} />
          </div>
          <h3>Tables Migrated</h3>
          <p>{successfulTables} / {totalTables}</p>
        </div>

        <div className="summary-card">
          <div className="summary-icon success">
            <Database size={22} />
          </div>
          <h3>Total Records Copied</h3>
          <p>{totalRows.toLocaleString()}</p>
        </div>

        <div className="summary-card">
          <div className="summary-icon warning" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'hsl(var(--warning))' }}>
            <Hourglass size={22} />
          </div>
          <h3>Execution Time</h3>
          <p>{getDuration()}</p>
        </div>
      </div>

      {/* Failure Info Panel */}
      {!isSuccess && progress.errorMessage && (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', padding: '1.5rem', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'hsl(var(--danger))', marginBottom: '0.5rem', fontWeight: 700 }}>
            <AlertCircle size={20} />
            <span>Critical Exception Details</span>
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#fca5a5', lineHeight: 1.5, wordBreak: 'break-all' }}>
            {progress.errorMessage}
          </p>
        </div>
      )}

      {/* Warnings Panel */}
      {isSuccess && warnings.length > 0 && (
        <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '8px', padding: '1.5rem', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'hsl(var(--warning))', marginBottom: '0.75rem', fontWeight: 700 }}>
            <AlertCircle size={20} />
            <span>Migration Warnings ({warnings.length})</span>
          </div>
          <ul style={{ paddingLeft: '1.25rem', fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {warnings.slice(0, 10).map((warn, index) => (
              <li key={index}>
                {warn.message}
              </li>
            ))}
            {warnings.length > 10 && (
              <li style={{ listStyleType: 'none', fontStyle: 'italic', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
                And {warnings.length - 10} more warnings... (inspect logs for details)
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Tables Breakdown */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Tables Breakdown</h3>
        <div style={{ border: '1px solid hsl(var(--border-muted))', borderRadius: '8px', overflow: 'hidden' }}>
          <table className="columns-table" style={{ fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Table Name</th>
                <th style={{ padding: '0.85rem 1rem' }}>Rows Migrated</th>
                <th style={{ padding: '0.85rem 1rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {progress.tableMetrics.map((t) => (
                <tr key={t.tableName}>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{t.tableName}</td>
                  <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)' }}>{t.rowsMigrated.toLocaleString()}</td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{ 
                      color: t.status === 'Completed' ? 'hsl(var(--success))' : 'hsl(var(--danger))',
                      fontWeight: 600
                    }}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Area */}
      <div className="btn-group" style={{ justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={onReset}>
          <RefreshCw size={16} />
          Migrate Another Database
        </button>
      </div>
    </div>
  );
};
