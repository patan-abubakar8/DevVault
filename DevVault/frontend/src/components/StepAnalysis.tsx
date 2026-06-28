import React, { useState, useEffect } from 'react';
import type { SchemaAnalysisResult, TableMetadata } from '../types';
import { 
  Loader2, ArrowLeft, Play, Search, Check, 
  ChevronDown, ChevronUp, AlertCircle,
  Table, Hash, Link, Key
} from 'lucide-react';

interface StepAnalysisProps {
  sourceConn: string;
  direction: string;
  onBack: () => void;
  onStartMigration: (selectedTables: string[], cleanTarget: boolean) => void;
}

export const StepAnalysis: React.FC<StepAnalysisProps> = ({ 
  sourceConn, 
  direction,
  onBack, 
  onStartMigration 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analysisResult, setAnalysisResult] = useState<SchemaAnalysisResult | null>(null);
  
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cleanTarget, setCleanTarget] = useState(false);

  useEffect(() => {
    const fetchAnalysis = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('http://localhost:5252/api/migration/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            connectionString: sourceConn,
            provider: direction === 'PostgresToSqlServer' ? 'Postgres' : 'SqlServer'
          }),
        });
        const data = await response.json();

        if (response.ok && data.success) {
          setAnalysisResult(data.data);
          // Select all tables by default
          const allTableNames = data.data.tables.map((t: TableMetadata) => `${t.schemaName}.${t.tableName}`);
          setSelectedTables(allTableNames);
        } else {
          setError(data.error || 'Failed to analyze source database schema.');
        }
      } catch (e: any) {
        setError(e.message || 'Network error occurred while analyzing database.');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [sourceConn]);

  const toggleTableSelection = (fullName: string) => {
    if (selectedTables.includes(fullName)) {
      setSelectedTables(selectedTables.filter(name => name !== fullName));
    } else {
      setSelectedTables([...selectedTables, fullName]);
    }
  };

  const handleSelectAll = () => {
    if (!analysisResult) return;
    const allTableNames = filteredTables.map(t => `${t.schemaName}.${t.tableName}`);
    // If all filtered are already selected, deselect them. Otherwise select them.
    const allSelected = allTableNames.every(name => selectedTables.includes(name));
    if (allSelected) {
      setSelectedTables(selectedTables.filter(name => !allTableNames.includes(name)));
    } else {
      const newSelections = [...selectedTables];
      allTableNames.forEach(name => {
        if (!newSelections.includes(name)) newSelections.push(name);
      });
      setSelectedTables(newSelections);
    }
  };

  const toggleAccordion = (fullName: string) => {
    if (expandedTable === fullName) {
      setExpandedTable(null);
    } else {
      setExpandedTable(fullName);
    }
  };

  if (loading) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '5rem 2.5rem' }}>
        <Loader2 className="spinner" size={60} style={{ color: 'var(--accent)', marginBottom: '2rem' }} />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>Analyzing Database Schema</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Scanning SQL Server tables, identity columns, data type specifications, indexes, and constraint mappings...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ padding: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'hsl(var(--danger))', marginBottom: '1.5rem' }}>
          <AlertCircle size={36} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Schema Analysis Failed</h2>
        </div>
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1.25rem', borderRadius: '8px', color: '#fca5a5', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', marginBottom: '2rem', whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Back to Connection Setup
          </button>
        </div>
      </div>
    );
  }

  const tables = analysisResult?.tables || [];
  const filteredTables = tables.filter(t => 
    t.tableName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.schemaName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute overall stats for overview
  const totalTablesCount = tables.length;
  const totalRowsCount = tables.reduce((sum, t) => sum + t.rowCount, 0);
  const totalIndexesCount = tables.reduce((sum, t) => sum + t.indexes.length, 0);
  const totalFKsCount = tables.reduce((sum, t) => sum + t.foreignKeys.length, 0);
  const totalPKsCount = tables.filter(t => t.columns.some(c => c.isPrimaryKey)).length;

  const totalSelectedRows = tables
    .filter(t => selectedTables.includes(`${t.schemaName}.${t.tableName}`))
    .reduce((sum, t) => sum + t.rowCount, 0);

  return (
    <div className="glass-panel">
      {/* Overview Section */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Schema Analysis Overview</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Overview of the detected schema structure. Select tables below to configure mapping.
        </p>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">Tables</span>
              <div className="stat-card-icon">
                <Table size={16} />
              </div>
            </div>
            <div className="stat-card-value">{totalTablesCount}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">Total Rows</span>
              <div className="stat-card-icon">
                <Hash size={16} />
              </div>
            </div>
            <div className="stat-card-value">{totalRowsCount.toLocaleString()}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">Indexes</span>
              <div className="stat-card-icon">
                <Search size={16} />
              </div>
            </div>
            <div className="stat-card-value">{totalIndexesCount}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">Foreign Keys</span>
              <div className="stat-card-icon">
                <Link size={16} />
              </div>
            </div>
            <div className="stat-card-value">{totalFKsCount}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">PK Constraints</span>
              <div className="stat-card-icon">
                <Key size={16} />
              </div>
            </div>
            <div className="stat-card-value">{totalPKsCount}</div>
          </div>
        </div>
      </div>

      <div className="table-selector-container">
        {/* Table Selection Header */}
        <div className="table-selection-header">
          <div>
            <div className="table-selection-title">Table Selection & Mapping</div>
            <div className="table-selection-subtitle">
              Configure source-to-target tables and custom indexes mapping
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div className="row-count-badge" style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}>
              Selected Rows: <strong>{totalSelectedRows.toLocaleString()}</strong>
            </div>
            <div className="row-count-badge" style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}>
              Tables: <strong>{selectedTables.length} / {tables.length}</strong>
            </div>
          </div>
        </div>

        {/* Search & Toolbars */}
        <div className="list-toolbar">
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={16} className="search-icon" />
          </div>

          <button className="btn btn-secondary btn-sm" onClick={handleSelectAll}>
            Toggle Selection
          </button>
        </div>

        {/* Tables Checklist */}
        <div className="table-grid">
          {filteredTables.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)' }}>
              No tables matched your search query.
            </div>
          ) : (
            filteredTables.map((t) => {
              const fullName = `${t.schemaName}.${t.tableName}`;
              const isSelected = selectedTables.includes(fullName);
              const isExpanded = expandedTable === fullName;

              return (
                <div key={fullName} className={`accordion-item ${isSelected ? 'selected' : ''}`}>
                  <div className="accordion-trigger" onClick={() => toggleAccordion(fullName)}>
                    <div className="table-info-left">
                      <div 
                        className="checkbox-custom" 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTableSelection(fullName);
                        }}
                      >
                        <Check size={12} />
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="table-schema">{t.schemaName}</span>
                        <span className="table-name">{t.tableName}</span>
                      </div>
                    </div>

                    <div className="table-meta-right" onClick={(e) => e.stopPropagation()}>
                      <span className="row-count-badge">{t.rowCount.toLocaleString()} rows</span>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => toggleAccordion(fullName)}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        View Schema
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="accordion-content">
                      <div style={{ marginBottom: '1.25rem' }}>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Columns & Type Mappings</h4>
                        <table className="columns-table">
                          <thead>
                            <tr>
                              <th>Column</th>
                              <th>{direction === 'PostgresToSqlServer' ? 'Source (PostgreSQL)' : 'Source (SQL Server)'}</th>
                              <th>{direction === 'PostgresToSqlServer' ? 'Target (SQL Server)' : 'Target (PostgreSQL)'}</th>
                              <th>Nullability</th>
                              <th>Key Info</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.columns.map((c) => (
                              <tr key={c.name}>
                                <td style={{ fontWeight: 600 }}>{c.name}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{c.sourceType.toUpperCase()}</td>
                                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent)' }}>{c.targetType.toUpperCase()}</td>
                                <td style={{ color: c.isNullable ? 'var(--text-muted)' : 'var(--text-primary)', fontSize: '0.8rem' }}>
                                  {c.isNullable ? 'NULL' : 'NOT NULL'}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                                    {c.isPrimaryKey && <span className="badge-pk">PK</span>}
                                    {c.isIdentity && <span className="badge-identity">IDENTITY</span>}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.25rem' }}>
                        <div>
                          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Indexes ({t.indexes.length})</h4>
                          {t.indexes.length === 0 ? (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No secondary indexes detected.</p>
                          ) : (
                            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              {t.indexes.map(idx => (
                                <li key={idx.indexName} style={{ color: 'var(--text-secondary)' }}>
                                  <strong style={{ color: 'var(--text-primary)' }}>{idx.indexName}</strong>: {idx.columns.join(', ')} {idx.isUnique && <span style={{ color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 600 }}>(Unique)</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div>
                          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Foreign Keys ({t.foreignKeys.length})</h4>
                          {t.foreignKeys.length === 0 ? (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No foreign key relations defined.</p>
                          ) : (
                            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              {t.foreignKeys.map(fk => (
                                <li key={fk.constraintName} style={{ color: 'var(--text-secondary)' }}>
                                  <strong style={{ color: 'var(--text-primary)' }}>{fk.constraintName}</strong>: ({fk.columns.join(', ')}) &rarr; {fk.referencedTableName}({fk.referencedColumns.join(', ')})
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Clean Target Toggle */}
        <div className="toggle-option">
          <div className="toggle-details">
            <h3>Drop and recreate target tables</h3>
            <p>If active, this will drop existing tables of the same name in the target database using <code>DROP TABLE CASCADE</code> before starting.</p>
          </div>
          <label className="switch">
            <input 
              type="checkbox" 
              checked={cleanTarget} 
              onChange={(e) => setCleanTarget(e.target.checked)} 
            />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      <div className="btn-group" style={{ marginTop: '1.5rem' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to Connections
        </button>
        <button 
          className="btn btn-primary" 
          onClick={() => onStartMigration(selectedTables, cleanTarget)}
          disabled={selectedTables.length === 0}
        >
          Start Database Migration
          <Play size={16} />
        </button>
      </div>
    </div>
  );
};
