import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, XCircle, Loader2, Play, Eye, EyeOff } from 'lucide-react';

/* ── Types ─────────────────────────────────────────────── */

interface SqlServerFields {
  server:        string;
  port:          string;
  database:      string;
  userId:        string;
  password:      string;
  trustCert:     boolean;
  multipleActive: boolean;
}

interface PostgresFields {
  host:     string;
  port:     string;
  database: string;
  username: string;
  password: string;
  sslMode:  string;
}

interface StepCredentialsProps {
  onSuccess: (sourceConn: string, targetConn: string, direction: string) => void;
}

/* ── Helpers: build connection strings ─────────────────── */

const buildSqlServerConnectionString = (f: SqlServerFields): string => {
  const serverPart = f.port ? `${f.server},${f.port}` : f.server;
  const parts = [
    `Data Source=${serverPart}`,
    `Initial Catalog=${f.database}`,
    f.userId   ? `User ID=${f.userId}`         : '',
    f.password ? `Password=${f.password}`       : '',
    `TrustServerCertificate=${f.trustCert ? 'True' : 'False'}`,
    `MultipleActiveResultSets=${f.multipleActive ? 'True' : 'False'}`,
  ];
  return parts.filter(Boolean).join(';') + ';';
};

const buildPostgresConnectionString = (f: PostgresFields): string => {
  const parts = [
    `Host=${f.host}`,
    `Port=${f.port || '5432'}`,
    `Database=${f.database}`,
    f.username ? `Username=${f.username}` : '',
    f.password ? `Password=${f.password}` : '',
    f.sslMode  ? `SSL Mode=${f.sslMode}`  : '',
  ];
  return parts.filter(Boolean).join(';') + ';';
};

/* ── Storage helpers ───────────────────────────────────── */

const STORAGE_KEY_SQL = 'db_migrator_sqlserver_fields';
const STORAGE_KEY_PG  = 'db_migrator_postgres_fields';
const STORAGE_KEY_DIR = 'db_migrator_direction';

const defaultSqlFields: SqlServerFields = {
  server: '', port: '', database: '', userId: '', password: '',
  trustCert: true, multipleActive: true,
};

const defaultPgFields: PostgresFields = {
  host: 'localhost', port: '5432', database: '', username: '', password: '', sslMode: 'Prefer',
};

const loadFromStorage = <T,>(key: string, defaults: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaults;
};

/* ── Component ─────────────────────────────────────────── */

export const StepCredentials: React.FC<StepCredentialsProps> = ({ onSuccess }) => {
  const [direction, setDirection] = useState<'SqlServerToPostgres' | 'PostgresToSqlServer'>(() => {
    return (localStorage.getItem(STORAGE_KEY_DIR) as any) || 'SqlServerToPostgres';
  });

  const [sqlFields, setSqlFields] = useState<SqlServerFields>(
    () => loadFromStorage(STORAGE_KEY_SQL, defaultSqlFields)
  );
  const [pgFields, setPgFields] = useState<PostgresFields>(
    () => loadFromStorage(STORAGE_KEY_PG, defaultPgFields)
  );

  const [showSqlPassword, setShowSqlPassword] = useState(false);
  const [showPgPassword,  setShowPgPassword]  = useState(false);

  const [sqlState, setSqlState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [sqlError, setSqlError] = useState('');

  const [pgState, setPgState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [pgError, setPgError] = useState('');

  // Persist settings
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DIR, direction);
  }, [direction]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SQL, JSON.stringify(sqlFields));
    setSqlState('idle'); // reset test result on field change
  }, [sqlFields]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PG, JSON.stringify(pgFields));
    setPgState('idle');
  }, [pgFields]);

  /* ── SQL Server field change helper */
  const onSqlChange = (field: keyof SqlServerFields) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      setSqlFields(prev => ({ ...prev, [field]: value }));
    };

  /* ── PostgreSQL field change helper */
  const onPgChange = (field: keyof PostgresFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setPgFields(prev => ({ ...prev, [field]: e.target.value }));
    };

  /* ── Validation: all required fields filled */
  const isSqlReady = !!(sqlFields.server && sqlFields.database && sqlFields.userId && sqlFields.password);
  const isPgReady  = !!(pgFields.host && pgFields.database && pgFields.username && pgFields.password);

  /* ── Test SQL Server ── */
  const testSqlServer = async () => {
    if (!isSqlReady) return;
    setSqlState('testing');
    setSqlError('');

    const connectionString = buildSqlServerConnectionString(sqlFields);

    try {
      const response = await fetch('http://localhost:5252/api/connection/test-sqlserver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setSqlState('success');
      } else {
        setSqlState('error');
        setSqlError(data.error || 'Failed to connect to SQL Server.');
      }
    } catch (e: any) {
      setSqlState('error');
      setSqlError(e.message || 'Network error while contacting the backend.');
    }
  };

  /* ── Test PostgreSQL ── */
  const testPostgres = async () => {
    if (!isPgReady) return;
    setPgState('testing');
    setPgError('');

    const connectionString = buildPostgresConnectionString(pgFields);

    try {
      const response = await fetch('http://localhost:5252/api/connection/test-postgres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setPgState('success');
      } else {
        setPgState('error');
        setPgError(data.error || 'Failed to connect to PostgreSQL.');
      }
    } catch (e: any) {
      setPgState('error');
      setPgError(e.message || 'Network error while contacting the backend.');
    }
  };

  const handleProceed = () => {
    if (sqlState === 'success' && pgState === 'success') {
      const sqlConnStr = buildSqlServerConnectionString(sqlFields);
      const pgConnStr = buildPostgresConnectionString(pgFields);
      if (direction === 'SqlServerToPostgres') {
        onSuccess(sqlConnStr, pgConnStr, direction);
      } else {
        onSuccess(pgConnStr, sqlConnStr, direction);
      }
    }
  };

  const canProceed = sqlState === 'success' && pgState === 'success';

  /* ── SQL Server Form Card Renderer ── */
  const renderSqlServerForm = (isSource: boolean) => {
    return (
      <div className="form-section">
        <div className="form-section-header">
          <Database style={{ color: 'var(--mssql-red)' }} size={22} />
          <h2>{isSource ? 'Source: SQL Server' : 'Target: SQL Server'}</h2>
        </div>

        {/* Server + Port */}
        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="sql-server">Server / Host *</label>
            <input
              id="sql-server"
              type="text"
              placeholder="localhost or 192.168.1.1"
              value={sqlFields.server}
              onChange={onSqlChange('server')}
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label htmlFor="sql-port">Port</label>
            <input
              id="sql-port"
              type="text"
              placeholder="1433"
              value={sqlFields.port}
              onChange={onSqlChange('port')}
            />
          </div>
        </div>

        {/* Database */}
        <div className="form-group">
          <label htmlFor="sql-database">Database Name *</label>
          <input
            id="sql-database"
            type="text"
            placeholder="MyDatabase"
            value={sqlFields.database}
            onChange={onSqlChange('database')}
            autoComplete="off"
          />
        </div>

        {/* User + Password */}
        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="sql-user">User ID *</label>
            <input
              id="sql-user"
              type="text"
              placeholder="sa"
              value={sqlFields.userId}
              onChange={onSqlChange('userId')}
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label htmlFor="sql-password">Password *</label>
            <div className="input-wrapper">
              <input
                id="sql-password"
                type={showSqlPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={sqlFields.password}
                onChange={onSqlChange('password')}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="input-icon-btn"
                onClick={() => setShowSqlPassword(p => !p)}
                tabIndex={-1}
                aria-label={showSqlPassword ? 'Hide password' : 'Show password'}
              >
                {showSqlPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.25rem' }}>
          <label className="form-check">
            <input
              type="checkbox"
              checked={sqlFields.trustCert}
              onChange={onSqlChange('trustCert')}
            />
            Trust Server Certificate
          </label>
          <label className="form-check">
            <input
              type="checkbox"
              checked={sqlFields.multipleActive}
              onChange={onSqlChange('multipleActive')}
            />
            Multiple Active Result Sets (MARS)
          </label>
        </div>

        {/* Generated string preview */}
        {isSqlReady && (
          <>
            <p className="conn-string-label">Generated Connection String Preview</p>
            <div className="conn-string-preview">{buildSqlServerConnectionString(sqlFields)}</div>
          </>
        )}

        {/* Test button */}
        <button
          className="btn btn-secondary btn-full"
          onClick={testSqlServer}
          disabled={!isSqlReady || sqlState === 'testing'}
          style={{ marginTop: '0.5rem' }}
        >
          {sqlState === 'testing' && <Loader2 className="spinner" size={15} />}
          {sqlState === 'success' && <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />}
          {sqlState === 'error'   && <XCircle     size={15} style={{ color: 'var(--danger)' }}  />}
          Test SQL Server Connection
        </button>

        {sqlState === 'success' && (
          <div className="conn-status success">
            <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            Connection established successfully!
          </div>
        )}
        {sqlState === 'error' && (
          <div className="conn-status error">
            <XCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Connection failed:</strong>
              <p style={{ marginTop: '0.2rem', fontSize: '0.78rem', opacity: 0.9 }}>{sqlError}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ── PostgreSQL Form Card Renderer ── */
  const renderPostgresForm = (isSource: boolean) => {
    return (
      <div className="form-section">
        <div className="form-section-header">
          <Database style={{ color: 'var(--postgres-blue)' }} size={22} />
          <h2>{isSource ? 'Source: PostgreSQL' : 'Target: PostgreSQL'}</h2>
        </div>

        {/* Host + Port */}
        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="pg-host">Host *</label>
            <input
              id="pg-host"
              type="text"
              placeholder="localhost"
              value={pgFields.host}
              onChange={onPgChange('host')}
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label htmlFor="pg-port">Port</label>
            <input
              id="pg-port"
              type="text"
              placeholder="5432"
              value={pgFields.port}
              onChange={onPgChange('port')}
            />
          </div>
        </div>

        {/* Database */}
        <div className="form-group">
          <label htmlFor="pg-database">Database Name *</label>
          <input
            id="pg-database"
            type="text"
            placeholder="my_database"
            value={pgFields.database}
            onChange={onPgChange('database')}
            autoComplete="off"
          />
        </div>

        {/* Username + Password */}
        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="pg-username">Username *</label>
            <input
              id="pg-username"
              type="text"
              placeholder="postgres"
              value={pgFields.username}
              onChange={onPgChange('username')}
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label htmlFor="pg-password">Password *</label>
            <div className="input-wrapper">
              <input
                id="pg-password"
                type={showPgPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={pgFields.password}
                onChange={onPgChange('password')}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="input-icon-btn"
                onClick={() => setShowPgPassword(p => !p)}
                tabIndex={-1}
                aria-label={showPgPassword ? 'Hide password' : 'Show password'}
              >
                {showPgPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>

        {/* SSL Mode */}
        <div className="form-group">
          <label htmlFor="pg-ssl">SSL Mode</label>
          <select
            id="pg-ssl"
            value={pgFields.sslMode}
            onChange={onPgChange('sslMode')}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.9rem',
              padding: '0.7rem 0.9rem',
              borderRadius: 'var(--radius-sm)',
              width: '100%',
              outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
          >
            <option value="Disable">Disable</option>
            <option value="Allow">Allow</option>
            <option value="Prefer">Prefer</option>
            <option value="Require">Require</option>
            <option value="VerifyCA">Verify CA</option>
            <option value="VerifyFull">Verify Full</option>
          </select>
        </div>

        {/* Generated string preview */}
        {isPgReady && (
          <>
            <p className="conn-string-label">Generated Connection String Preview</p>
            <div className="conn-string-preview">{buildPostgresConnectionString(pgFields)}</div>
          </>
        )}

        {/* Test button */}
        <button
          className="btn btn-secondary btn-full"
          onClick={testPostgres}
          disabled={!isPgReady || pgState === 'testing'}
          style={{ marginTop: '0.5rem' }}
        >
          {pgState === 'testing' && <Loader2 className="spinner" size={15} />}
          {pgState === 'success' && <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />}
          {pgState === 'error'   && <XCircle     size={15} style={{ color: 'var(--danger)' }}  />}
          Test PostgreSQL Connection
        </button>

        {pgState === 'success' && (
          <div className="conn-status success">
            <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            Connection established successfully!
          </div>
        )}
        {pgState === 'error' && (
          <div className="conn-status error">
            <XCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Connection failed:</strong>
              <p style={{ marginTop: '0.2rem', fontSize: '0.78rem', opacity: 0.9 }}>{pgError}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ── UI ── */
  return (
    <div className="glass-panel">
      {/* Page header */}
      <div style={{ marginBottom: '2rem' }}>
        <p className="page-title">Database Connection Settings</p>
        <p className="page-subtitle">
          Enter the credentials for your source and target databases.
          We assemble connection strings securely on your machine.
        </p>
      </div>

      {/* Migration Direction Selector */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1rem', 
        background: 'var(--bg-card)', 
        border: '1px solid var(--border-default)',
        padding: '0.5rem', 
        borderRadius: 'var(--radius-md)', 
        marginBottom: '2rem',
        width: 'fit-content'
      }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '0.5rem', fontWeight: 600 }}>
          Migration Direction:
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn btn-sm ${direction === 'SqlServerToPostgres' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setDirection('SqlServerToPostgres');
              setSqlState('idle');
              setPgState('idle');
            }}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
          >
            SQL Server → PostgreSQL
          </button>
          <button
            className={`btn btn-sm ${direction === 'PostgresToSqlServer' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setDirection('PostgresToSqlServer');
              setSqlState('idle');
              setPgState('idle');
            }}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
          >
            PostgreSQL → SQL Server
          </button>
        </div>
      </div>

      <div className="grid-2">
        {direction === 'SqlServerToPostgres' ? (
          <>
            {renderSqlServerForm(true)}
            {renderPostgresForm(false)}
          </>
        ) : (
          <>
            {renderPostgresForm(true)}
            {renderSqlServerForm(false)}
          </>
        )}
      </div>

      {/* Footer action */}
      <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
        <button
          className="btn btn-primary"
          onClick={handleProceed}
          disabled={!canProceed}
        >
          Analyze Database Schema
          <Play size={15} />
        </button>
      </div>
    </div>
  );
};
